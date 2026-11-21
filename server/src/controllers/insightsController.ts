import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';

export async function getInsightsSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Academic Metrics (Subject & Topic Progress) strictly for this user
    const subjects = await prisma.subject.findMany({
      where: { userId },
      include: {
        units: {
          include: { topics: true },
        },
        exams: {
          orderBy: { examDate: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    let totalTopics = 0;
    let completedTopics = 0;

    const subjectsBreakdown = subjects.map((sub) => {
      const allTopics = sub.units.flatMap((u) => u.topics);
      const subTotal = allTopics.length;
      const subCompleted = allTopics.filter((t) => t.isCompleted).length;
      totalTopics += subTotal;
      completedTopics += subCompleted;

      return {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        colorTag: sub.colorTag,
        totalTopics: subTotal,
        completedTopics: subCompleted,
        progressPercent: subTotal > 0 ? Math.round((subCompleted / subTotal) * 100) : 0,
        nextExam: sub.exams.find((e) => e.examDate >= todayStr) || null,
      };
    });

    const upcomingExamsCount = await prisma.academicExam.count({
      where: {
        subject: { userId },
        examDate: { gte: todayStr },
      },
    });

    // 2. Personal Goals Progress
    const goals = await prisma.personalGoal.findMany({
      where: { userId, active: true },
      include: { goalSessions: true },
      orderBy: { name: 'asc' },
    });

    // Calculate start of current week (last 7 days window)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr7DaysAgo = sevenDaysAgo.toISOString().split('T')[0];

    let totalGoalSessionsThisWeek = 0;
    let targetGoalSessionsThisWeek = 0;

    const goalsBreakdown = goals.map((g) => {
      targetGoalSessionsThisWeek += g.prefSessionsPerWeek;
      const sessionsThisWeek = g.goalSessions.filter(
        (s) => s.scheduledDate >= dateStr7DaysAgo && s.isCompleted
      ).length;
      totalGoalSessionsThisWeek += sessionsThisWeek;

      return {
        id: g.id,
        name: g.name,
        category: g.category,
        prefSessionsPerWeek: g.prefSessionsPerWeek,
        completedThisWeek: sessionsThisWeek,
        consistencyPercent:
          g.prefSessionsPerWeek > 0
            ? Math.min(Math.round((sessionsThisWeek / g.prefSessionsPerWeek) * 100), 100)
            : 0,
      };
    });

    // 3. Task Execution & Postponement Analytics
    const allTasks = await prisma.task.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        priority: true,
        timesPostponed: true,
        postponedReason: true,
        estimatedDuration: true,
      },
    });

    const completedTasksCount = allTasks.filter((t) => t.status === 'COMPLETED').length;
    const partialTasksCount = allTasks.filter((t) => t.status === 'PARTIALLY_COMPLETED').length;
    const postponedTasksCount = allTasks.filter((t) => t.status === 'POSTPONED').length;
    const cancelledTasksCount = allTasks.filter((t) => t.status === 'CANCELLED').length;
    const pendingTasksCount = allTasks.filter((t) => t.status === 'PENDING').length;

    // Reason frequency breakdown for postponed tasks
    const postponedReasonsMap: Record<string, number> = {};
    for (const t of allTasks) {
      if (t.postponedReason && (t.status === 'POSTPONED' || t.timesPostponed > 0)) {
        postponedReasonsMap[t.postponedReason] = (postponedReasonsMap[t.postponedReason] || 0) + 1;
      }
    }

    // 4. Focus Sessions & Productivity
    const allFocusSessions = await prisma.focusSession.findMany({
      where: { userId },
      include: { task: true },
      orderBy: { completedAt: 'desc' },
    });

    const todayFocusSessions = allFocusSessions.filter(
      (s) => new Date(s.completedAt).toISOString().split('T')[0] === todayStr
    );

    const todayFocusMinutes = todayFocusSessions
      .filter((s) => s.sessionType === 'FOCUS')
      .reduce((sum, s) => sum + s.durationMinutes, 0);

    const totalFocusMinutesAllTime = allFocusSessions
      .filter((s) => s.sessionType === 'FOCUS')
      .reduce((sum, s) => sum + s.durationMinutes, 0);

    // 5. Sleep Insights (Voluntary real stored records ONLY — no fake data)
    const recentSleep = await prisma.sleepRecord.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 7,
    });

    const validDurations = recentSleep
      .map((s) => s.durationMinutes)
      .filter((d): d is number => typeof d === 'number' && d > 0);

    const avgSleepMinutes =
      validDurations.length > 0
        ? Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length)
        : null;

    // 6. Transparent Mathematical Life Balance Indicators (0 - 100%)
    const academicScore = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 100;
    const growthScore =
      targetGoalSessionsThisWeek > 0
        ? Math.min(Math.round((totalGoalSessionsThisWeek / targetGoalSessionsThisWeek) * 100), 100)
        : 100;
    // Recovery: optimal reference is 7 hours (420 mins)
    const recoveryScore = avgSleepMinutes
      ? Math.min(Math.round((avgSleepMinutes / 420) * 100), 100)
      : 100;

    res.json({
      academic: {
        totalSubjects: subjects.length,
        totalTopics,
        completedTopics,
        overallCompletionPercent: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
        upcomingExamsCount,
        subjectsBreakdown,
      },
      goals: {
        activeGoalsCount: goals.length,
        targetSessionsWeekly: targetGoalSessionsThisWeek,
        completedSessionsWeekly: totalGoalSessionsThisWeek,
        overallConsistencyPercent:
          targetGoalSessionsThisWeek > 0
            ? Math.min(Math.round((totalGoalSessionsThisWeek / targetGoalSessionsThisWeek) * 100), 100)
            : 0,
        goalsBreakdown,
      },
      tasks: {
        totalTasks: allTasks.length,
        completed: completedTasksCount,
        partiallyCompleted: partialTasksCount,
        postponed: postponedTasksCount,
        cancelled: cancelledTasksCount,
        pending: pendingTasksCount,
        completionRatePercent:
          allTasks.length > 0
            ? Math.round(((completedTasksCount + partialTasksCount * 0.5) / allTasks.length) * 100)
            : 0,
        repeatedlyPostponedCount: allTasks.filter((t) => t.timesPostponed >= 2).length,
        postponedReasons: Object.entries(postponedReasonsMap)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count),
      },
      focus: {
        todayFocusMinutes,
        todayFocusHours: (todayFocusMinutes / 60).toFixed(1),
        totalFocusMinutesAllTime,
        totalFocusHoursAllTime: (totalFocusMinutesAllTime / 60).toFixed(1),
        totalSessionsCompleted: allFocusSessions.length,
        recentSessions: allFocusSessions.slice(0, 5),
      },
      sleep: {
        loggedDaysInLastWeek: validDurations.length,
        weeklyAverageMinutes: avgSleepMinutes,
        weeklyAverageFormatted: avgSleepMinutes
          ? `${Math.floor(avgSleepMinutes / 60)}h ${avgSleepMinutes % 60}m`
          : '—',
        recentLogs: recentSleep,
      },
      lifeBalance: {
        academicScore,
        growthScore,
        recoveryScore,
        overallBalanceScore: Math.round((academicScore + growthScore + recoveryScore) / 3),
        formulas: {
          academic: 'completedTopics / totalTopics',
          growth: 'min(completedSessionsThisWeek / targetWeeklySessions, 1.0)',
          recovery: 'min(avgWeeklySleepMinutes / 420 mins (7h baseline), 1.0)',
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
