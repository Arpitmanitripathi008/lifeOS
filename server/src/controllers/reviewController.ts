import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { z } from 'zod';
import { GeminiService } from '../services/geminiService.js';

export const submitReviewSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summaryNotes: z.string().optional().nullable(),
  taskUpdates: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['COMPLETED', 'PARTIALLY_COMPLETED', 'POSTPONED', 'CANCELLED']),
        remainingDuration: z.number().int().nonnegative().optional().nullable(),
        postponedReason: z.string().optional().nullable(),
      })
    )
    .optional()
    .default([]),
});

export async function getReview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const date = req.params.date as string;

    const review = await prisma.dailyReview.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
    });

    const tasks = await prisma.task.findMany({
      where: { userId, scheduledDate: date },
      include: { subject: true, unitTopic: true, personalGoal: true },
    });

    const pendingProposal = await prisma.aIProposal.findFirst({
      where: { userId, targetDate: date, proposalType: 'CARRY_FORWARD', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      review,
      tasks,
      pendingProposal,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitReview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { date, summaryNotes, taskUpdates } = req.body;

    let completedCount = 0;
    let partialCount = 0;
    let postponedCount = 0;
    let cancelledCount = 0;

    const incompleteTasksForAI: any[] = [];
    const repeatedlyPostponedTasks: any[] = [];

    // 1. Process and update each task belonging strictly to this user
    for (const update of taskUpdates) {
      const existingTask = await prisma.task.findFirst({
        where: { id: update.id, userId },
        include: { subject: true, unitTopic: true, personalGoal: true },
      });

      if (!existingTask) continue;

      if (update.status === 'COMPLETED') {
        completedCount++;
        await prisma.task.update({
          where: { id: update.id },
          data: {
            status: 'COMPLETED',
            remainingDuration: 0,
          },
        });

        // Update academic unit topic mastery if linked
        if (existingTask.unitTopicId) {
          await prisma.unitTopic.update({
            where: { id: existingTask.unitTopicId },
            data: { isCompleted: true },
          });
        }

        // Update personal goal session if linked
        if (existingTask.personalGoalId) {
          await prisma.goalSession.create({
            data: {
              personalGoalId: existingTask.personalGoalId,
              taskId: existingTask.id,
              scheduledDate: date,
              durationMins: existingTask.estimatedDuration,
              isCompleted: true,
              completedAt: new Date(),
            },
          });
        }
      } else if (update.status === 'PARTIALLY_COMPLETED') {
        partialCount++;
        const remainingDuration =
          typeof update.remainingDuration === 'number'
            ? update.remainingDuration
            : Math.max(15, Math.round(existingTask.estimatedDuration / 2));

        const updatedTask = await prisma.task.update({
          where: { id: update.id },
          data: {
            status: 'PARTIALLY_COMPLETED',
            remainingDuration,
            postponedReason: update.postponedReason || 'Partially finished remaining work',
          },
        });

        incompleteTasksForAI.push({
          id: updatedTask.id,
          title: updatedTask.title,
          category: updatedTask.category,
          priority: updatedTask.priority,
          originalDuration: updatedTask.estimatedDuration,
          remainingDuration,
          deadline: updatedTask.deadline,
          status: 'PARTIALLY_COMPLETED',
          timesPostponed: updatedTask.timesPostponed,
          reason: update.postponedReason || 'Partially finished',
        });
      } else if (update.status === 'POSTPONED') {
        postponedCount++;
        const nextTimesPostponed = existingTask.timesPostponed + 1;

        const updatedTask = await prisma.task.update({
          where: { id: update.id },
          data: {
            status: 'POSTPONED',
            postponedReason: update.postponedReason || 'Postponed during daily review',
            timesPostponed: nextTimesPostponed,
          },
        });

        if (nextTimesPostponed >= 2) {
          repeatedlyPostponedTasks.push({
            id: updatedTask.id,
            title: updatedTask.title,
            timesPostponed: nextTimesPostponed,
            reason: update.postponedReason,
          });
        }

        incompleteTasksForAI.push({
          id: updatedTask.id,
          title: updatedTask.title,
          category: updatedTask.category,
          priority: updatedTask.priority,
          estimatedDuration: updatedTask.estimatedDuration,
          deadline: updatedTask.deadline,
          status: 'POSTPONED',
          timesPostponed: nextTimesPostponed,
          reason: update.postponedReason || 'Ran out of time',
        });
      } else if (update.status === 'CANCELLED') {
        cancelledCount++;
        await prisma.task.update({
          where: { id: update.id },
          data: {
            status: 'CANCELLED',
            postponedReason: update.postponedReason || 'Cancelled by user',
          },
        });
        // Note: Cancelled tasks are strictly excluded from incompleteTasksForAI
      }
    }

    // 2. Compute follow-through score
    const totalAssessed = completedCount + partialCount + postponedCount + cancelledCount;
    const followThrough = totalAssessed > 0 ? (completedCount + partialCount * 0.5) / totalAssessed : 1.0;

    // 3. Upsert DailyReview record scoped to userId
    const review = await prisma.dailyReview.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      create: {
        userId,
        date,
        summaryNotes,
        tasksCompletedCount: completedCount,
        tasksPartiallyDone: partialCount,
        tasksPostponedCount: postponedCount,
        tasksCancelledCount: cancelledCount,
        followThroughScore: Math.round(followThrough * 100),
      },
      update: {
        summaryNotes,
        tasksCompletedCount: completedCount,
        tasksPartiallyDone: partialCount,
        tasksPostponedCount: postponedCount,
        tasksCancelledCount: cancelledCount,
        followThroughScore: Math.round(followThrough * 100),
        reviewedAt: new Date(),
      },
    });

    // 4. Generate Smart Carry-Forward Proposal via Gemini if there are unfinished tasks
    let carryForwardProposal: any = null;
    if (incompleteTasksForAI.length > 0) {
      // Calculate tomorrow's date using timezone-safe local calendar arithmetic
      const [year, month, day] = date.split('-').map(Number);
      const d = new Date(year, month - 1, day + 1);
      const tomorrowStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const tomorrowDayOfWeek = d.getDay();

      // Fetch tomorrow's existing schedule commitments to prevent overloading (scoped to userId)
      const tomorrowCommitments = await prisma.fixedCommitment.findMany({
        where: {
          userId,
          OR: [{ dayOfWeek: tomorrowDayOfWeek, isRecurring: true }, { specificDate: tomorrowStr }],
        },
      });

      const tomorrowTasks = await prisma.task.findMany({
        where: { userId, scheduledDate: tomorrowStr, status: 'PENDING' },
      });

      const upcomingScheduleSummary = {
        tomorrowDate: tomorrowStr,
        commitmentsCount: tomorrowCommitments.length,
        scheduledTasksCount: tomorrowTasks.length,
        totalScheduledMinutes: tomorrowTasks.reduce((sum, t) => sum + t.estimatedDuration, 0),
        dailyCapacityCapMinutes: 360,
      };

      try {
        const carryForwardResult = await GeminiService.smartCarryForward(
          incompleteTasksForAI,
          upcomingScheduleSummary
        );

        carryForwardProposal = await prisma.aIProposal.create({
          data: {
            userId,
            proposalType: 'CARRY_FORWARD',
            targetDate: tomorrowStr,
            proposalData: JSON.stringify({
              reviewDate: date,
              targetDate: tomorrowStr,
              incompleteTasks: incompleteTasksForAI,
              repeatedlyPostponedTasks,
              ...carryForwardResult,
            }),
            explanation: carryForwardResult.analysis,
            status: 'PENDING',
          },
        });
      } catch (aiErr: any) {
        console.warn('Gemini carry-forward error, using deterministic fallback:', aiErr.message);

        // Fallback: distribute tasks safely without overloading tomorrow
        const fallbackRecommendations = incompleteTasksForAI.map((t, idx) => {
          const slotOffset = Math.floor(idx / 2); // 2 tasks max per day
          const slotD = new Date(year, month - 1, day + 1 + slotOffset);
          const targetDate = `${slotD.getFullYear()}-${String(slotD.getMonth() + 1).padStart(2, '0')}-${String(slotD.getDate()).padStart(2, '0')}`;

          return {
            taskId: t.id,
            taskTitle: t.title,
            recommendedAction: t.originalDuration > 60 ? 'SPLIT_INTO_SMALLER' : 'MOVE_TO_TOMORROW',
            targetDate,
            reason: t.timesPostponed >= 2
              ? `Repeatedly postponed (${t.timesPostponed}x) — scheduled with buffer on ${targetDate}`
              : `Safely scheduled for ${targetDate}`,
          };
        });

        carryForwardProposal = await prisma.aIProposal.create({
          data: {
            userId,
            proposalType: 'CARRY_FORWARD',
            targetDate: tomorrowStr,
            proposalData: JSON.stringify({
              reviewDate: date,
              targetDate: tomorrowStr,
              incompleteTasks: incompleteTasksForAI,
              repeatedlyPostponedTasks,
              analysis: `LifeOS evaluated ${incompleteTasksForAI.length} unfinished task(s). Distributed across future days to protect tomorrow's capacity and keep personal goals balanced.`,
              recommendations: fallbackRecommendations,
            }),
            explanation: `Distributed ${incompleteTasksForAI.length} unfinished tasks to preserve daily balance.`,
            status: 'PENDING',
          },
        });
      }
    }

    res.json({
      success: true,
      review,
      metrics: {
        completedCount,
        partialCount,
        postponedCount,
        cancelledCount,
        followThroughScore: Math.round(followThrough * 100),
      },
      incompleteCount: incompleteTasksForAI.length,
      repeatedlyPostponedCount: repeatedlyPostponedTasks.length,
      proposal: carryForwardProposal,
    });
  } catch (error) {
    next(error);
  }
}
