import type { Request, Response, NextFunction } from 'express';
import { GeminiService } from '../services/geminiService.js';
import { prisma } from '../db/client.js';
import { z } from 'zod';
import dotenv from 'dotenv';

export const commandRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
});

export const breakdownRequestSchema = z.object({
  goalName: z.string().min(1, 'Goal name is required'),
  category: z.string().default('CODING'),
  targetWeeks: z.number().int().positive().default(4),
});

export async function getAIStatus(req: Request, res: Response, next: NextFunction) {
  try {
    dotenv.config();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';

    if (!apiKey) {
      return res.json({
        configured: false,
        model,
        connected: false,
        message: 'GEMINI_API_KEY is not set. Add it to server/.env to enable live AI features.',
      });
    }

    const test = await GeminiService.testConnection();
    res.json({
      configured: true,
      model,
      connected: test.success,
      message: test.message,
      latencyMs: test.latencyMs,
    });
  } catch (error: any) {
    res.json({
      configured: true,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      connected: false,
      message: error.message,
    });
  }
}

export async function handleCommand(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { prompt } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split('T')[0];
    const dayOfWeekName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

    // 1. Fetch current database context strictly for this authenticated user
    const profile = await prisma.userProfile.findFirst({
      where: { userId },
    });
    const fixedCommitments = await prisma.fixedCommitment.findMany({
      where: {
        userId,
        OR: [{ dayOfWeek, isRecurring: true }, { specificDate: today }],
      },
    });
    const todayTasks = await prisma.task.findMany({
      where: { userId, scheduledDate: today },
    });
    const personalGoals = await prisma.personalGoal.findMany({
      where: { userId, active: true },
    });
    const upcomingExams = await prisma.academicExam.findMany({
      where: { subject: { userId } },
      include: { subject: true },
      orderBy: { examDate: 'asc' },
    });
    const upcomingAssignments = await prisma.assignment.findMany({
      where: { subject: { userId } },
      include: { subject: true },
      orderBy: { deadline: 'asc' },
    });
    const subjects = await prisma.subject.findMany({
      where: { userId },
      select: { id: true, name: true, code: true },
    });

    let weeklyHolidays: number[] = [0];
    if (profile?.weeklyHolidays) {
      try {
        weeklyHolidays = JSON.parse(profile.weeklyHolidays);
      } catch {}
    }

    let weeklyCollegeTimings: Record<string, { start: string; end: string }> = {};
    if (profile?.weeklyCollegeTimings) {
      try {
        weeklyCollegeTimings = JSON.parse(profile.weeklyCollegeTimings);
      } catch {}
    }

    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    // 2. Call Gemini Service with user's private context
    const aiResult = await GeminiService.processCommand(prompt, {
      currentTime,
      profile,
      fixedCommitments,
      todayTasks,
      personalGoals,
      upcomingExams,
      upcomingAssignments,
      subjects,
      todayDate: today,
      tomorrowDate: tomorrowStr,
      dayOfWeekName,
    });

    // 3. If morning check-in extracted sleep, auto-log to SleepRecord scoped to user
    let loggedSleep = null;
    if (aiResult.extractedSleep) {
      loggedSleep = await prisma.sleepRecord.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        create: {
          userId,
          date: today,
          bedTimeApprox: aiResult.extractedSleep.bedTimeApprox,
          wakeUpTime: aiResult.extractedSleep.wakeUpTime,
          durationMinutes: aiResult.extractedSleep.sleepDurationMinutes,
          notes: aiResult.extractedSleep.notes || 'Logged via morning check-in',
        },
        update: {
          bedTimeApprox: aiResult.extractedSleep.bedTimeApprox,
          wakeUpTime: aiResult.extractedSleep.wakeUpTime,
          durationMinutes: aiResult.extractedSleep.sleepDurationMinutes,
          notes: aiResult.extractedSleep.notes || 'Updated via morning check-in',
        },
      });
    }

    let proposal = null;
    let overrideRecord = null;

    // 3.5. Handle Data Reset & Workspace Management
    if (
      aiResult.intent === 'CLEAR_MOCK_DATA' ||
      aiResult.intent === 'RESET_WORKSPACE' ||
      aiResult.intent === 'DATA_RESET_REQUEST' ||
      aiResult.resetRequest
    ) {
      if (aiResult.resetRequest?.mode === 'AMBIGUOUS' || aiResult.intent === 'DATA_RESET_REQUEST') {
        return res.json({
          intent: 'DATA_RESET_REQUEST',
          explanation: aiResult.userExplanation,
          isAmbiguousReset: true,
          proposal: null,
        });
      }

      const mode: 'CLEAR_MOCK_DATA' | 'RESET_WORKSPACE' =
        aiResult.resetRequest?.mode === 'RESET_WORKSPACE' || aiResult.intent === 'RESET_WORKSPACE'
          ? 'RESET_WORKSPACE'
          : 'CLEAR_MOCK_DATA';

      const { WorkspaceService } = await import('../services/workspaceService.js');
      const preview = await WorkspaceService.getResetPreview(userId, mode);

      proposal = await prisma.aIProposal.create({
        data: {
          userId,
          proposalType: 'DATA_RESET',
          targetDate: today,
          proposalData: JSON.stringify({
            resetMode: mode,
            preview,
          }),
          explanation: aiResult.userExplanation,
          status: 'PENDING',
        },
      });

      return res.json({
        intent: aiResult.intent,
        explanation: aiResult.userExplanation,
        preview,
        proposal,
      });
    }

    // 4. Handle Holiday Declarations / Schedule Overrides
    if (
      aiResult.intent === 'HOLIDAY_DECLARATION' ||
      aiResult.intent === 'SCHEDULE_OVERRIDE' ||
      aiResult.holidayDeclaration
    ) {
      const targetDate = aiResult.holidayDeclaration?.targetDate || today;
      const targetDayOfWeek = new Date(`${targetDate}T00:00:00`).getDay();

      // Upsert temporary reversible schedule override
      overrideRecord = await prisma.scheduleOverride.upsert({
        where: {
          userId_date: {
            userId,
            date: targetDate,
          },
        },
        create: {
          userId,
          date: targetDate,
          overrideType: aiResult.holidayDeclaration?.type || 'FULL_HOLIDAY',
          originalStartTime: profile?.collegeStartTime || '09:00',
          originalEndTime: profile?.collegeEndTime || '15:00',
          adjustedStartTime: aiResult.holidayDeclaration?.adjustedStartTime || null,
          adjustedEndTime: aiResult.holidayDeclaration?.adjustedEndTime || null,
          reason: aiResult.holidayDeclaration?.reason || prompt,
          isActive: true,
        },
        update: {
          overrideType: aiResult.holidayDeclaration?.type || 'FULL_HOLIDAY',
          originalStartTime: profile?.collegeStartTime || '09:00',
          originalEndTime: profile?.collegeEndTime || '15:00',
          adjustedStartTime: aiResult.holidayDeclaration?.adjustedStartTime || null,
          adjustedEndTime: aiResult.holidayDeclaration?.adjustedEndTime || null,
          reason: aiResult.holidayDeclaration?.reason || prompt,
          isActive: true,
        },
      });

      // Fetch pending tasks to reschedule into freed daytime slots
      const pendingTasks = await prisma.task.findMany({
        where: {
          userId,
          status: 'PENDING',
          OR: [
            { scheduledDate: targetDate },
            { scheduledDate: null },
            { scheduledDate: { lte: targetDate } },
          ],
        },
        orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
      });

      // Completed tasks must be permanently protected
      const completedTasksToday = await prisma.task.findMany({
        where: {
          userId,
          scheduledDate: targetDate,
          status: 'COMPLETED',
        },
      });

      const activeGoals = await prisma.personalGoal.findMany({
        where: { userId, active: true },
        include: {
          goalSessions: {
            where: { scheduledDate: { gte: targetDate } },
          },
        },
      });

      const { AdaptiveScheduler } = await import('../scheduling/adaptiveScheduler.js');

      const schedulingResult = AdaptiveScheduler.scheduleDay({
        date: targetDate,
        currentTime,
        wakeUpTime: '07:30',
        dayOfWeek: targetDayOfWeek,
        weeklyHolidays,
        weeklyCollegeTimings,
        activeOverride: overrideRecord,
        completedTasksToday: completedTasksToday.map((ct) => ({
          id: ct.id,
          title: ct.title,
          startTime: ct.scheduledStartTime,
          endTime: ct.scheduledEndTime,
          durationMinutes: ct.estimatedDuration,
          category: ct.category,
        })),
        fixedCommitments: fixedCommitments.map((c) => ({
          id: c.id,
          title: c.title,
          category: c.category,
          startTime: c.startTime,
          endTime: c.endTime,
        })),
        mealTimes: {
          breakfast: profile?.breakfastTime || '08:00',
          lunch: profile?.lunchTime || '13:00',
          dinner: profile?.dinnerTime || '20:00',
        },
        pendingTasks: pendingTasks.map((t) => ({
          id: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          estimatedDuration: t.estimatedDuration,
          deadline: t.deadline,
          subjectId: t.subjectId,
          timesPostponed: t.timesPostponed,
        })),
        personalGoals: activeGoals.map((g) => ({
          id: g.id,
          name: g.name,
          category: g.category,
          prefSessionsPerWeek: g.prefSessionsPerWeek,
          completedThisWeek: g.goalSessions.filter((s) => s.isCompleted).length,
          sessionDurationMins: g.sessionDurationMins,
        })),
      });

      proposal = await prisma.aIProposal.create({
        data: {
          userId,
          proposalType: 'SCHEDULE_MODIFICATION',
          targetDate,
          proposalData: JSON.stringify(schedulingResult),
          explanation: aiResult.userExplanation || schedulingResult.aiExplanation,
          status: 'PENDING',
        },
      });
    } else if (aiResult.tasksToSchedule.length > 0 || aiResult.intent === 'MORNING_CHECKIN') {
      // 5. Normal morning check-in / task addition
      const wakeUpTime =
        aiResult.extractedSleep?.wakeUpTime ||
        (await prisma.sleepRecord.findUnique({ where: { userId_date: { userId, date: today } } }))?.wakeUpTime ||
        '07:30';

      const existingPending = await prisma.task.findMany({
        where: {
          userId,
          status: 'PENDING',
          OR: [{ scheduledDate: today }, { scheduledDate: null }],
        },
      });

      const completedTasksToday = await prisma.task.findMany({
        where: {
          userId,
          scheduledDate: today,
          status: 'COMPLETED',
        },
      });

      const combinedTasks = [
        ...aiResult.tasksToSchedule.map((t: any) => ({
          id: undefined,
          title: t.title,
          category: t.category || 'DEADLINE',
          priority: t.priority || 'MEDIUM',
          estimatedDuration: t.estimatedDuration || t.durationMinutes || 45,
          deadline: undefined,
          subjectId: null,
          timesPostponed: 0,
        })),
        ...existingPending.map((t) => ({
          id: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          estimatedDuration: t.estimatedDuration,
          deadline: t.deadline,
          subjectId: t.subjectId,
          timesPostponed: t.timesPostponed,
        })),
      ];

      const activeGoals = await prisma.personalGoal.findMany({
        where: { userId, active: true },
        include: {
          goalSessions: {
            where: { scheduledDate: { gte: today } },
          },
        },
      });

      const { AdaptiveScheduler } = await import('../scheduling/adaptiveScheduler.js');

      const schedulingResult = AdaptiveScheduler.scheduleDay({
        date: today,
        currentTime,
        wakeUpTime,
        dayOfWeek,
        weeklyHolidays,
        weeklyCollegeTimings,
        completedTasksToday: completedTasksToday.map((ct) => ({
          id: ct.id,
          title: ct.title,
          startTime: ct.scheduledStartTime,
          endTime: ct.scheduledEndTime,
          durationMinutes: ct.estimatedDuration,
          category: ct.category,
        })),
        fixedCommitments: fixedCommitments.map((c) => ({
          id: c.id,
          title: c.title,
          category: c.category,
          startTime: c.startTime,
          endTime: c.endTime,
        })),
        mealTimes: {
          breakfast: profile?.breakfastTime || '08:00',
          lunch: profile?.lunchTime || '13:00',
          dinner: profile?.dinnerTime || '20:00',
        },
        unavailableWindows: aiResult.unavailableWindow ? [aiResult.unavailableWindow] : [],
        pendingTasks: combinedTasks,
        personalGoals: activeGoals.map((g) => ({
          id: g.id,
          name: g.name,
          category: g.category,
          prefSessionsPerWeek: g.prefSessionsPerWeek,
          completedThisWeek: g.goalSessions.filter((s) => s.isCompleted).length,
          sessionDurationMins: g.sessionDurationMins,
        })),
      });

      proposal = await prisma.aIProposal.create({
        data: {
          userId,
          proposalType: 'DAILY_SCHEDULE',
          targetDate: today,
          proposalData: JSON.stringify(schedulingResult),
          explanation: `${aiResult.userExplanation}\n\n${schedulingResult.aiExplanation}`,
          status: 'PENDING',
        },
      });
    }

    res.json({
      success: true,
      intent: aiResult.intent,
      explanation: aiResult.userExplanation,
      extractedSleep: loggedSleep,
      proposal,
      override: overrideRecord,
      tasksCount: aiResult.tasksToSchedule.length,
    });
  } catch (error: any) {
    next(error);
  }
}

export async function handleBreakdownGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const { goalName, category, targetWeeks } = req.body;
    const breakdown = await GeminiService.breakdownGoal(goalName, category, targetWeeks);
    res.json(breakdown);
  } catch (error: any) {
    next(error);
  }
}

export async function handleCarryForward(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { date = new Date().toISOString().split('T')[0] } = req.body;

    const incomplete = await prisma.task.findMany({
      where: {
        userId,
        scheduledDate: date,
        status: { in: ['POSTPONED', 'PARTIALLY_COMPLETED', 'PENDING'] },
      },
      include: { subject: true, personalGoal: true },
    });

    if (incomplete.length === 0) {
      return res.json({
        message: 'No incomplete tasks to carry forward for this date.',
        recommendations: [],
      });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const tomorrowTasks = await prisma.task.findMany({
      where: { userId, scheduledDate: tomorrowStr },
    });

    const result = await GeminiService.smartCarryForward(incomplete, {
      tomorrowDate: tomorrowStr,
      existingTasksTomorrow: tomorrowTasks.length,
    });

    const proposal = await prisma.aIProposal.create({
      data: {
        userId,
        proposalType: 'CARRY_FORWARD',
        targetDate: tomorrowStr,
        proposalData: JSON.stringify(result),
        explanation: result.analysis,
        status: 'PENDING',
      },
    });

    res.json({
      success: true,
      analysis: result.analysis,
      recommendations: result.recommendations,
      proposal,
    });
  } catch (error: any) {
    next(error);
  }
}
