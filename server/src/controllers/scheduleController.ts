import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { AdaptiveScheduler, timeToMinutes, minutesToTime, type SchedulingContext } from '../scheduling/adaptiveScheduler.js';
import { z } from 'zod';

export const generateScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  wakeUpTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  unavailableWindows: z
    .array(
      z
        .object({
          startTime: z.string().regex(/^\d{2}:\d{2}$/),
          endTime: z.string().regex(/^\d{2}:\d{2}$/),
          reason: z.string().optional(),
        })
        .refine((w) => w.endTime > w.startTime, {
          message: 'End time must be after start time',
          path: ['endTime'],
        })
    )
    .optional(),
});

export const modifyScheduleSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    unavailableStart: z.string().regex(/^\d{2}:\d{2}$/),
    unavailableEnd: z.string().regex(/^\d{2}:\d{2}$/),
    reason: z.string().optional(),
  })
  .refine((data) => data.unavailableEnd > data.unavailableStart, {
    message: 'Unavailable end time must be after start time',
    path: ['unavailableEnd'],
  });

export const scheduleOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  overrideType: z.enum(['FULL_HOLIDAY', 'HALF_DAY', 'CUSTOM_HOURS', 'CANCEL_CLASSES']).default('FULL_HOLIDAY'),
  adjustedStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  adjustedEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  reason: z.string().optional().nullable(),
});

export async function getDaySchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    const dateStr = date as string;

    const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();

    // 1. Fetch user profile
    const profile = await prisma.userProfile.findFirst({
      where: { userId },
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

    // 2. Check for active temporary schedule override for this date
    const activeOverride = await prisma.scheduleOverride.findFirst({
      where: {
        userId,
        date: dateStr,
        isActive: true,
      },
    });

    // 3. Fetch fixed commitments for this day (recurring or specific date)
    const rawCommitments = await prisma.fixedCommitment.findMany({
      where: {
        userId,
        OR: [
          { dayOfWeek, isRecurring: true },
          { specificDate: dateStr },
        ],
      },
      orderBy: { startTime: 'asc' },
    });

    // Filter commitments according to weekly holidays and active overrides
    const commitments: any[] = [];
    const isWeeklyHoliday = weeklyHolidays.includes(dayOfWeek);
    const isFullHoliday = activeOverride && (activeOverride.overrideType === 'FULL_HOLIDAY' || activeOverride.overrideType === 'CANCEL_CLASSES');
    const isHalfDay = activeOverride && activeOverride.overrideType === 'HALF_DAY';
    const isCustomHours = activeOverride && activeOverride.overrideType === 'CUSTOM_HOURS';

    for (const c of rawCommitments) {
      if (c.category === 'COLLEGE') {
        if (isFullHoliday || (isWeeklyHoliday && !activeOverride)) {
          // Exclude college commitment!
          continue;
        }
        if (isHalfDay) {
          const start = activeOverride.adjustedStartTime || c.startTime;
          const origDur = timeToMinutes(c.endTime) - timeToMinutes(c.startTime);
          const halfDur = Math.round(origDur / 2 / 15) * 15;
          const end = activeOverride.adjustedEndTime || minutesToTime(timeToMinutes(start) + halfDur);
          commitments.push({
            ...c,
            title: `${c.title} (Half Day)`,
            startTime: start,
            endTime: end,
          });
          continue;
        }
        if (isCustomHours) {
          commitments.push({
            ...c,
            title: `${c.title} (Modified Hours)`,
            startTime: activeOverride.adjustedStartTime || c.startTime,
            endTime: activeOverride.adjustedEndTime || c.endTime,
          });
          continue;
        }
        // Custom weekday timing
        if (weeklyCollegeTimings[String(dayOfWeek)]) {
          const timing = weeklyCollegeTimings[String(dayOfWeek)];
          commitments.push({
            ...c,
            startTime: timing.start,
            endTime: timing.end,
          });
          continue;
        }
      }
      commitments.push(c);
    }

    // 4. Fetch scheduled tasks for this date
    const tasks = await prisma.task.findMany({
      where: { userId, scheduledDate: dateStr },
      include: {
        subject: true,
        unitTopic: true,
        personalGoal: true,
      },
      orderBy: [
        { scheduledStartTime: 'asc' },
        { priority: 'desc' },
      ],
    });

    // 5. Fetch sleep record for this morning if available
    const sleep = await prisma.sleepRecord.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateStr,
        },
      },
    });

    // 6. Fetch daily review if already completed
    const review = await prisma.dailyReview.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateStr,
        },
      },
    });

    // 7. Fetch daily schedule state
    const dailySchedule = await prisma.dailySchedule.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateStr,
        },
      },
    });

    // 8. Fetch pending AI proposals for this date
    const pendingProposals = await prisma.aIProposal.findMany({
      where: {
        userId,
        targetDate: dateStr,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    // 9. Merge items into an integrated chronological timeline
    const timelineItems = [
      ...commitments.map((c) => ({
        id: c.id,
        title: c.title,
        type: 'COMMITMENT',
        category: c.category,
        startTime: c.startTime,
        endTime: c.endTime,
        isFixed: true,
        details: c,
      })),
      ...tasks.map((t) => ({
        id: t.id,
        title: t.title,
        type: 'TASK',
        category: t.category,
        startTime: t.scheduledStartTime || '—',
        endTime: t.scheduledEndTime || '—',
        durationMinutes: t.estimatedDuration,
        status: t.status,
        isFixed: t.isFixed,
        priority: t.priority,
        details: t,
      })),
    ].sort((a, b) => {
      if (a.startTime === '—') return 1;
      if (b.startTime === '—') return -1;
      return a.startTime.localeCompare(b.startTime);
    });

    res.json({
      date: dateStr,
      profile,
      sleep,
      review,
      dailySchedule,
      activeOverride,
      isWeeklyHoliday,
      pendingProposals,
      commitments,
      tasks,
      timeline: timelineItems,
      metrics: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === 'COMPLETED').length,
        pendingTasks: tasks.filter((t) => t.status === 'PENDING').length,
        fixedCommitmentsCount: commitments.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getWeekSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const today = new Date();
    const { startDate } = req.query;

    let baseDate: Date;
    if (startDate) {
      baseDate = new Date(`${startDate}T00:00:00`);
    } else {
      // Find current week's Monday
      baseDate = new Date(today);
      const day = baseDate.getDay();
      const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
      baseDate.setDate(diff);
    }

    const weekDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      weekDays.push(d.toISOString().split('T')[0]);
    }

    const startStr = weekDays[0];
    const endStr = weekDays[6];

    // Fetch user profile
    const profile = await prisma.userProfile.findFirst({ where: { userId } });
    let weeklyHolidays: number[] = [0];
    if (profile?.weeklyHolidays) {
      try {
        weeklyHolidays = JSON.parse(profile.weeklyHolidays);
      } catch {}
    }

    // Fetch active overrides in this week
    const overrides = await prisma.scheduleOverride.findMany({
      where: {
        userId,
        date: { gte: startStr, lte: endStr },
        isActive: true,
      },
    });

    // Fetch all commitments for this user
    const allCommitments = await prisma.fixedCommitment.findMany({
      where: { userId },
      orderBy: { startTime: 'asc' },
    });

    // Fetch all tasks in date range for this user
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        scheduledDate: {
          gte: startStr,
          lte: endStr,
        },
      },
      include: {
        subject: true,
        personalGoal: true,
      },
      orderBy: { scheduledStartTime: 'asc' },
    });

    // Assemble per-day data
    const daysData = weekDays.map((dateStr) => {
      const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
      const isWeeklyHoliday = weeklyHolidays.includes(dayOfWeek);
      const dayOverride = overrides.find((o) => o.date === dateStr);

      const dayCommitments = allCommitments
        .filter((c) => (c.isRecurring && c.dayOfWeek === dayOfWeek) || c.specificDate === dateStr)
        .filter((c) => {
          if (c.category === 'COLLEGE') {
            if (dayOverride && (dayOverride.overrideType === 'FULL_HOLIDAY' || dayOverride.overrideType === 'CANCEL_CLASSES')) {
              return false;
            }
            if (isWeeklyHoliday && !dayOverride) {
              return false;
            }
          }
          return true;
        });

      const dayTasks = tasks.filter((t) => t.scheduledDate === dateStr);

      return {
        date: dateStr,
        dayOfWeek,
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
        isHoliday: isWeeklyHoliday || !!dayOverride,
        override: dayOverride || null,
        commitments: dayCommitments,
        tasks: dayTasks,
        totalItems: dayCommitments.length + dayTasks.length,
      };
    });

    res.json({
      startDate: startStr,
      endDate: endStr,
      days: daysData,
    });
  } catch (error) {
    next(error);
  }
}

export async function generateSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const todayStr = new Date().toISOString().split('T')[0];
    const {
      date = todayStr,
      wakeUpTime: userWakeUp,
      unavailableWindows = [],
    } = req.body;

    const targetDate = date as string;
    const dayOfWeek = new Date(`${targetDate}T00:00:00`).getDay();

    // 1. Fetch user profile for meals, weekly timetable, and preferences
    const profile = await prisma.userProfile.findFirst({
      where: { userId },
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

    // 2. Check for active temporary schedule override
    const activeOverride = await prisma.scheduleOverride.findFirst({
      where: {
        userId,
        date: targetDate,
        isActive: true,
      },
    });

    // 3. Determine wake-up time
    let resolvedWakeUp = userWakeUp;
    if (!resolvedWakeUp) {
      const sleepRecord = await prisma.sleepRecord.findUnique({
        where: {
          userId_date: {
            userId,
            date: targetDate,
          },
        },
      });
      if (sleepRecord?.wakeUpTime) {
        resolvedWakeUp = sleepRecord.wakeUpTime;
      } else {
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        if (targetDate === todayStr && currentMins >= 5 * 60 && currentMins <= 12 * 60) {
          const roundedMins = Math.round(currentMins / 15) * 15;
          resolvedWakeUp = minutesToTime(roundedMins);
        } else {
          resolvedWakeUp = '07:30';
        }
      }
    }

    // 4. Fetch fixed commitments for user
    const fixedCommitments = await prisma.fixedCommitment.findMany({
      where: {
        userId,
        OR: [
          { dayOfWeek, isRecurring: true },
          { specificDate: targetDate },
        ],
      },
      orderBy: { startTime: 'asc' },
    });

    // 5. Permanent protection: Fetch already completed tasks on target date (must never be touched or rescheduled)
    const completedTasksToday = await prisma.task.findMany({
      where: {
        userId,
        scheduledDate: targetDate,
        status: 'COMPLETED',
      },
    });

    // 6. Fetch pending tasks to be scheduled (never touch completed tasks)
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
      orderBy: [
        { priority: 'desc' },
        { deadline: 'asc' },
      ],
    });

    // 7. Fetch personal goals and session counts this week
    const goals = await prisma.personalGoal.findMany({
      where: { userId, active: true },
      include: {
        goalSessions: {
          where: {
            scheduledDate: {
              gte: todayStr,
            },
          },
        },
      },
    });

    const personalGoalsData = goals.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      prefSessionsPerWeek: g.prefSessionsPerWeek,
      completedThisWeek: g.goalSessions.filter((s) => s.isCompleted).length,
      sessionDurationMins: g.sessionDurationMins,
    }));

    // 8. Build context and call AdaptiveScheduler with weekly & holiday awareness
    const context: SchedulingContext = {
      date: targetDate,
      currentTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      wakeUpTime: resolvedWakeUp,
      dayOfWeek,
      weeklyHolidays,
      weeklyCollegeTimings,
      activeOverride: activeOverride
        ? {
            id: activeOverride.id,
            overrideType: activeOverride.overrideType as any,
            originalStartTime: activeOverride.originalStartTime,
            originalEndTime: activeOverride.originalEndTime,
            adjustedStartTime: activeOverride.adjustedStartTime,
            adjustedEndTime: activeOverride.adjustedEndTime,
            reason: activeOverride.reason,
            isActive: activeOverride.isActive,
          }
        : null,
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
      unavailableWindows,
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
      personalGoals: personalGoalsData,
    };

    const schedulingResult = AdaptiveScheduler.scheduleDay(context);

    // 9. Save as an AI Proposal for user approval scoped to userId
    const proposal = await prisma.aIProposal.create({
      data: {
        userId,
        proposalType: activeOverride ? 'SCHEDULE_MODIFICATION' : 'DAILY_SCHEDULE',
        targetDate,
        proposalData: JSON.stringify(schedulingResult),
        explanation: schedulingResult.aiExplanation,
        status: 'PENDING',
      },
    });

    res.json({
      success: true,
      proposalId: proposal.id,
      proposal,
      schedulingResult,
      activeOverride,
    });
  } catch (error) {
    next(error);
  }
}

export async function modifySchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const todayStr = new Date().toISOString().split('T')[0];
    const {
      date = todayStr,
      unavailableStart,
      unavailableEnd,
      reason = 'Unavailable time window',
    } = req.body;

    const targetDate = date as string;
    const dayOfWeek = new Date(`${targetDate}T00:00:00`).getDay();

    // Fetch commitments and scheduled tasks for this date & user
    const commitments = await prisma.fixedCommitment.findMany({
      where: {
        userId,
        OR: [
          { dayOfWeek, isRecurring: true },
          { specificDate: targetDate },
        ],
      },
      orderBy: { startTime: 'asc' },
    });

    const tasks = await prisma.task.findMany({
      where: {
        userId,
        scheduledDate: targetDate,
        status: 'PENDING',
      },
      orderBy: { scheduledStartTime: 'asc' },
    });

    const currentSchedule = [
      ...commitments.map((c) => ({
        id: c.id,
        title: c.title,
        category: 'FIXED' as const,
        priority: 'URGENT' as const,
        startTime: c.startTime,
        endTime: c.endTime,
        durationMinutes: timeToMinutes(c.endTime) - timeToMinutes(c.startTime),
        isFixed: true,
        reason: 'Fixed commitment',
      })),
      ...tasks.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category as any,
        priority: t.priority as any,
        startTime: t.scheduledStartTime || '09:00',
        endTime: t.scheduledEndTime || '09:45',
        durationMinutes: t.estimatedDuration,
        isFixed: false,
        reason: `Existing task (${t.title})`,
        subjectId: t.subjectId,
        personalGoalId: t.personalGoalId,
      })),
    ].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    const rescheduleResult = AdaptiveScheduler.rescheduleAroundUnavailableBlock(
      currentSchedule,
      unavailableStart,
      unavailableEnd,
      reason
    );

    const explanation = `Adjusted schedule around unavailable block (${unavailableStart} – ${unavailableEnd}). Displaced ${rescheduleResult.displacedTasks.length} task(s); safely rescheduled ${rescheduleResult.rescheduledTasks.length} to evening free time with zero conflicts.`;

    const proposal = await prisma.aIProposal.create({
      data: {
        userId,
        proposalType: 'SCHEDULE_MODIFICATION',
        targetDate,
        proposalData: JSON.stringify({
          unavailableStart,
          unavailableEnd,
          ...rescheduleResult,
        }),
        explanation,
        status: 'PENDING',
      },
    });

    res.json({
      success: true,
      proposalId: proposal.id,
      proposal,
      modificationResult: rescheduleResult,
      explanation,
    });
  } catch (error) {
    next(error);
  }
}

// 10. Temporary Holiday / Timetable Override Management
export async function declareOverride(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { date, overrideType, adjustedStartTime, adjustedEndTime, reason } = req.body;

    const profile = await prisma.userProfile.findFirst({ where: { userId } });
    const originalStartTime = profile?.collegeStartTime || '09:00';
    const originalEndTime = profile?.collegeEndTime || '15:00';

    const override = await prisma.scheduleOverride.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      create: {
        userId,
        date,
        overrideType: overrideType || 'FULL_HOLIDAY',
        originalStartTime,
        originalEndTime,
        adjustedStartTime: adjustedStartTime || null,
        adjustedEndTime: adjustedEndTime || null,
        reason: reason || 'User declared temporary schedule override',
        isActive: true,
      },
      update: {
        overrideType: overrideType || 'FULL_HOLIDAY',
        originalStartTime,
        originalEndTime,
        adjustedStartTime: adjustedStartTime || null,
        adjustedEndTime: adjustedEndTime || null,
        reason: reason || 'User declared temporary schedule override',
        isActive: true,
      },
    });

    // Automatically trigger schedule regeneration proposal
    req.body.date = date;
    return generateSchedule(req, res, next);
  } catch (error) {
    next(error);
  }
}

export async function undoOverride(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { date = new Date().toISOString().split('T')[0] } = req.body;

    const existing = await prisma.scheduleOverride.findFirst({
      where: { userId, date },
    });

    if (existing) {
      await prisma.scheduleOverride.delete({
        where: { id: existing.id },
      });
    }

    // Dismiss any pending holiday proposals for this date
    await prisma.aIProposal.updateMany({
      where: {
        userId,
        targetDate: date,
        proposalType: 'SCHEDULE_MODIFICATION',
        status: 'PENDING',
      },
      data: { status: 'REJECTED' },
    });

    // Re-generate schedule with regular timetable restored
    req.body.date = date;
    return generateSchedule(req, res, next);
  } catch (error) {
    next(error);
  }
}

export async function getOverride(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const date = req.params.date as string;

    const override = await prisma.scheduleOverride.findFirst({
      where: {
        userId,
        date,
        isActive: true,
      },
    });

    res.json({ override: override || null });
  } catch (error) {
    next(error);
  }
}
