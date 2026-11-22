import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { getClientDateInfo } from '../utils/dateUtils.js';
import { z } from 'zod';

export const createProposalSchema = z.object({
  proposalType: z
    .enum(['DAILY_SCHEDULE', 'CARRY_FORWARD', 'STUDY_PLAN', 'SCHEDULE_MODIFICATION', 'DATA_RESET'])
    .default('DAILY_SCHEDULE'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  proposalData: z.string(), // JSON string
  explanation: z.string().optional().nullable(),
});

export async function getProposals(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { status = 'PENDING', targetDate } = req.query;
    const where: any = { userId };
    if (status) where.status = status;
    if (targetDate) where.targetDate = targetDate;

    const proposals = await prisma.aIProposal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(proposals);
  } catch (error) {
    next(error);
  }
}

export async function createProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const proposal = await prisma.aIProposal.create({
      data: {
        ...req.body,
        userId,
      },
    });
    res.status(201).json(proposal);
  } catch (error) {
    next(error);
  }
}

export async function acceptProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const proposal = await prisma.aIProposal.findFirst({
      where: { id, userId },
    });
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const parsed = JSON.parse(proposal.proposalData);
    const { today } = getClientDateInfo(req);
    const targetDate = proposal.targetDate || today;

    // 0. Handle Data Reset Proposal
    if (proposal.proposalType === 'DATA_RESET') {
      const { WorkspaceService } = await import('../services/workspaceService.js');
      const resetResult = await WorkspaceService.executeReset(userId, parsed.resetMode || 'CLEAR_MOCK_DATA', id);
      const updated = await prisma.aIProposal.update({
        where: { id },
        data: { status: 'APPROVED' },
      });
      return res.json({
        message: resetResult.message,
        resetResult,
        proposal: updated,
      });
    }

    // 1. Commit schedule if it contains scheduledActivities
    if (Array.isArray(parsed.scheduledActivities)) {
      for (const act of parsed.scheduledActivities) {
        // Skip fixed commitments and system meal blocks (they are not user tasks)
        if (act.category === 'FIXED' || act.category === 'HEALTH') {
          continue;
        }

        if (act.id) {
          // Update existing task belonging to user
          const existing = await prisma.task.findFirst({
            where: { id: act.id, userId },
          });
          if (existing) {
            // PERMANENT USER DATA PROTECTION: Never overwrite or re-schedule completed tasks
            if (existing.status === 'COMPLETED') {
              continue;
            }
            await prisma.task.update({
              where: { id: act.id },
              data: {
                scheduledDate: targetDate,
                scheduledStartTime: act.startTime,
                scheduledEndTime: act.endTime,
                priority: act.priority || 'MEDIUM',
              },
            });
          }
        } else {
          // Avoid duplicate task creation if an identical task already exists on this day
          const duplicate = await prisma.task.findFirst({
            where: {
              userId,
              title: act.title,
              scheduledDate: targetDate,
            },
          });
          if (duplicate) {
            continue;
          }

          // Create new task with userId
          await prisma.task.create({
            data: {
              userId,
              title: act.title,
              category: act.category || 'FLEXIBLE',
              priority: act.priority || 'MEDIUM',
              estimatedDuration: act.durationMinutes || 45,
              scheduledDate: targetDate,
              scheduledStartTime: act.startTime,
              scheduledEndTime: act.endTime,
              source: 'AI_PROPOSAL',
              subjectId: act.subjectId || null,
              personalGoalId: act.personalGoalId || null,
            },
          });
        }
      }

      // Handle overflow tasks if present
      if (Array.isArray(parsed.overflowTasks)) {
        for (const ov of parsed.overflowTasks) {
          if (ov.id) {
            const existing = await prisma.task.findFirst({
              where: { id: ov.id, userId },
            });
            if (existing) {
              await prisma.task.update({
                where: { id: ov.id },
                data: {
                  scheduledDate: ov.recommendedDate,
                  timesPostponed: { increment: 1 },
                  postponedReason: ov.reason,
                },
              });
            }
          } else {
            await prisma.task.create({
              data: {
                userId,
                title: ov.title,
                category: 'FLEXIBLE',
                priority: ov.priority || 'MEDIUM',
                estimatedDuration: ov.estimatedDuration || 45,
                scheduledDate: ov.recommendedDate,
                source: 'AI_PROPOSAL',
                postponedReason: ov.reason,
              },
            });
          }
        }
      }

      // Upsert DailySchedule scoped to userId
      await prisma.dailySchedule.upsert({
        where: {
          userId_date: {
            userId,
            date: targetDate,
          },
        },
        create: {
          userId,
          date: targetDate,
          wakeUpTime: parsed.wakeUpTime || '07:30',
          isFinalized: true,
          notes: parsed.aiExplanation || 'Generated and approved via LifeOS Adaptive Scheduler',
        },
        update: {
          wakeUpTime: parsed.wakeUpTime || undefined,
          isFinalized: true,
          notes: parsed.aiExplanation || undefined,
        },
      });
    }

    // 2. Commit modifications (e.g. from rescheduleAroundUnavailableBlock)
    if (Array.isArray(parsed.rescheduledTasks)) {
      for (const t of parsed.rescheduledTasks) {
        if (t.id) {
          const existing = await prisma.task.findFirst({
            where: { id: t.id, userId },
          });
          if (existing) {
            await prisma.task.update({
              where: { id: t.id },
              data: {
                scheduledStartTime: t.startTime,
                scheduledEndTime: t.endTime,
              },
            });
          }
        }
      }
    }

    // 3. Backward compatibility: handle generic parsed.tasks format
    if (Array.isArray(parsed.tasks)) {
      for (const t of parsed.tasks) {
        if (t.id) {
          const existing = await prisma.task.findFirst({
            where: { id: t.id, userId },
          });
          if (existing) {
            await prisma.task.update({
              where: { id: t.id },
              data: {
                scheduledDate: t.scheduledDate || targetDate,
                scheduledStartTime: t.scheduledStartTime,
                scheduledEndTime: t.scheduledEndTime,
                priority: t.priority,
              },
            });
          }
        } else {
          await prisma.task.create({
            data: {
              userId,
              title: t.title,
              category: t.category || 'FLEXIBLE',
              priority: t.priority || 'MEDIUM',
              estimatedDuration: t.durationMinutes || 45,
              scheduledDate: t.scheduledDate || targetDate,
              scheduledStartTime: t.scheduledStartTime,
              scheduledEndTime: t.scheduledEndTime,
              source: 'AI_PROPOSAL',
            },
          });
        }
      }
    }

    // 4. Commit study plan if proposalType is STUDY_PLAN
    if (proposal.proposalType === 'STUDY_PLAN' && Array.isArray(parsed.tasks)) {
      for (const t of parsed.tasks) {
        await prisma.task.create({
          data: {
            userId,
            title: t.title,
            category: 'DEADLINE',
            priority: t.priority || 'HIGH',
            estimatedDuration: t.durationMinutes || 45,
            scheduledDate: t.scheduledDate || targetDate,
            source: 'STUDY_PLAN',
            subjectId: parsed.subjectId || null,
            unitTopicId: t.unitTopicId || null,
          },
        });
      }
    }

    // 5. Commit Smart Carry-Forward if proposalType is CARRY_FORWARD
    if (proposal.proposalType === 'CARRY_FORWARD' && Array.isArray(parsed.recommendations)) {
      for (const rec of parsed.recommendations) {
        if (!rec.taskId) continue;

        const existingTask = await prisma.task.findFirst({
          where: { id: rec.taskId, userId },
        });

        if (!existingTask) continue;

        // CRITICAL RULE: Never automatically reschedule cancelled tasks
        if (existingTask.status === 'CANCELLED') continue;

        if (rec.recommendedAction === 'SPLIT_INTO_SMALLER') {
          // Split task into two manageable blocks
          const totalDuration = existingTask.remainingDuration || existingTask.estimatedDuration;
          const part1Duration = Math.ceil(totalDuration / 2 / 15) * 15;
          const part2Duration = totalDuration - part1Duration;

          const [recY, recM, recD] = rec.targetDate.split('-').map(Number);
          const dayAfterTomorrow = new Date(recY, recM - 1, recD + 1);
          const dayAfterStr = `${dayAfterTomorrow.getFullYear()}-${String(dayAfterTomorrow.getMonth() + 1).padStart(2, '0')}-${String(dayAfterTomorrow.getDate()).padStart(2, '0')}`;

          await prisma.task.update({
            where: { id: rec.taskId },
            data: {
              title: existingTask.title.includes('(Part') ? existingTask.title : `${existingTask.title} (Part 1)`,
              scheduledDate: rec.targetDate,
              scheduledStartTime: rec.targetStartTime || null,
              estimatedDuration: part1Duration,
              remainingDuration: null,
              status: 'PENDING',
              postponedReason: rec.reason,
            },
          });

          if (part2Duration > 0) {
            await prisma.task.create({
              data: {
                userId,
                title: `${existingTask.title} (Part 2)`,
                category: existingTask.category,
                priority: existingTask.priority,
                estimatedDuration: part2Duration,
                scheduledDate: dayAfterStr,
                source: 'AI_PROPOSAL',
                subjectId: existingTask.subjectId,
                unitTopicId: existingTask.unitTopicId,
                personalGoalId: existingTask.personalGoalId,
                postponedReason: 'Split from previous day during Daily Review',
              },
            });
          }
        } else if (rec.recommendedAction === 'DROP_PRIORITY') {
          await prisma.task.update({
            where: { id: rec.taskId },
            data: {
              scheduledDate: rec.targetDate,
              scheduledStartTime: rec.targetStartTime || null,
              priority: 'LOW',
              status: 'PENDING',
              postponedReason: rec.reason,
            },
          });
        } else {
          // MOVE_TO_TOMORROW or SLOT_INTO_UPCOMING_DAY
          await prisma.task.update({
            where: { id: rec.taskId },
            data: {
              scheduledDate: rec.targetDate,
              scheduledStartTime: rec.targetStartTime || null,
              status: 'PENDING',
              postponedReason: rec.reason,
            },
          });
        }
      }
    }

    // 6. Mark proposal as APPROVED
    const updated = await prisma.aIProposal.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    res.json({ message: 'Proposal accepted and committed to persistent database', proposal: updated });
  } catch (error) {
    next(error);
  }
}

export async function rejectProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;

    const existing = await prisma.aIProposal.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const updated = await prisma.aIProposal.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
    res.json({ message: 'Proposal rejected', proposal: updated });
  } catch (error) {
    next(error);
  }
}
