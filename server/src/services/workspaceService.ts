import { prisma } from '../db/client.js';

export type ResetMode = 'CLEAR_MOCK_DATA' | 'RESET_WORKSPACE';

export interface ResetPreview {
  mode: ResetMode;
  modeTitle: string;
  summary: string;
  toDelete: {
    subjects: number;
    tasks: number;
    personalGoals: number;
    documents: number;
    sleepRecords: number;
    focusSessions: number;
    dailyReviews: number;
    dailySchedules: number;
    scheduleOverrides: number;
    totalItems: number;
    sampleSubjects: string[];
    sampleTasks: string[];
    sampleGoals: string[];
  };
  toPreserve: {
    userAccount: string;
    settings: string;
    realSubjectsCount: number;
    realTasksCount: number;
    realGoalsCount: number;
    realDocumentsCount: number;
    explanation: string;
  };
  requiresConfirmation: boolean;
}

export class WorkspaceService {
  /**
   * Backfills / tags existing mock and demonstration records for a user with isDemo = true
   */
  static async tagExistingDemoRecords(userId: string): Promise<void> {
    const demoSubjectNames = [
      'Operating Systems',
      'OPERATING SYSTEMS',
      'Computer Networks',
      'Database Management Systems',
      'Discrete Mathematics',
      'Algorithms',
      'Data Structures & Algorithms',
    ];

    const demoGoalNames = ['Learn Python for AI', 'Open Source'];

    // 1. Tag demo subjects
    await prisma.subject.updateMany({
      where: {
        userId,
        name: { in: demoSubjectNames },
      },
      data: { isDemo: true },
    });

    // 2. Tag demo goals
    await prisma.personalGoal.updateMany({
      where: {
        userId,
        name: { in: demoGoalNames },
      },
      data: { isDemo: true },
    });

    // 3. Tag demo documents
    await prisma.uploadedDocument.updateMany({
      where: {
        userId,
        OR: [
          { fileName: { startsWith: 'sample_' } },
          { fileName: { contains: 'syllabus' } },
          { fileName: { contains: 'timetable' } },
        ],
      },
      data: { isDemo: true },
    });

    // 4. Tag tasks that belong to demo subjects or demo goals, or have demo sources
    const demoSubjects = await prisma.subject.findMany({
      where: { userId, isDemo: true },
      select: { id: true },
    });
    const demoSubjectIds = demoSubjects.map((s) => s.id);

    const demoGoals = await prisma.personalGoal.findMany({
      where: { userId, isDemo: true },
      select: { id: true },
    });
    const demoGoalIds = demoGoals.map((g) => g.id);

    await prisma.task.updateMany({
      where: {
        userId,
        OR: [
          { subjectId: { in: demoSubjectIds } },
          { personalGoalId: { in: demoGoalIds } },
          { source: 'STUDY_PLAN' },
          { source: 'AI_PROPOSAL' },
        ],
      },
      data: { isDemo: true },
    });

    // 5. Tag demo sleep, focus, and review records created during demo check-ins
    await prisma.sleepRecord.updateMany({
      where: {
        userId,
        notes: { contains: 'check-in' },
      },
      data: { isDemo: true },
    });

    await prisma.dailyReview.updateMany({
      where: { userId },
      data: { isDemo: true },
    });

    await prisma.focusSession.updateMany({
      where: { userId },
      data: { isDemo: true },
    });
  }

  /**
   * Generates a detailed preview of what will be deleted vs preserved for the user
   */
  static async getResetPreview(userId: string, mode: ResetMode): Promise<ResetPreview> {
    // Ensure demo records are identified first
    await this.tagExistingDemoRecords(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (mode === 'CLEAR_MOCK_DATA') {
      // Find all demo records
      const demoSubjects = await prisma.subject.findMany({
        where: { userId, isDemo: true },
        select: { id: true, name: true },
      });
      const demoSubjectIds = demoSubjects.map((s) => s.id);

      const demoGoals = await prisma.personalGoal.findMany({
        where: { userId, isDemo: true },
        select: { id: true, name: true },
      });
      const demoGoalIds = demoGoals.map((g) => g.id);

      const demoTasks = await prisma.task.findMany({
        where: {
          userId,
          OR: [
            { isDemo: true },
            { subjectId: { in: demoSubjectIds } },
            { personalGoalId: { in: demoGoalIds } },
          ],
        },
        select: { id: true, title: true },
      });

      const demoDocsCount = await prisma.uploadedDocument.count({
        where: { userId, isDemo: true },
      });
      const demoSleepCount = await prisma.sleepRecord.count({
        where: { userId, isDemo: true },
      });
      const demoFocusCount = await prisma.focusSession.count({
        where: { userId, isDemo: true },
      });
      const demoReviewsCount = await prisma.dailyReview.count({
        where: { userId, isDemo: true },
      });
      const demoSchedulesCount = await prisma.dailySchedule.count({
        where: { userId, isDemo: true },
      });
      const demoOverridesCount = await prisma.scheduleOverride.count({
        where: { userId, isDemo: true },
      });

      // Real user records to preserve
      const realSubjectsCount = await prisma.subject.count({
        where: { userId, isDemo: false },
      });
      const realGoalsCount = await prisma.personalGoal.count({
        where: { userId, isDemo: false },
      });
      const realTasksCount = await prisma.task.count({
        where: {
          userId,
          isDemo: false,
          NOT: [
            { subjectId: { in: demoSubjectIds } },
            { personalGoalId: { in: demoGoalIds } },
          ],
        },
      });
      const realDocsCount = await prisma.uploadedDocument.count({
        where: { userId, isDemo: false },
      });

      const totalItems =
        demoSubjects.length +
        demoTasks.length +
        demoGoals.length +
        demoDocsCount +
        demoSleepCount +
        demoFocusCount +
        demoReviewsCount +
        demoSchedulesCount +
        demoOverridesCount;

      return {
        mode: 'CLEAR_MOCK_DATA',
        modeTitle: 'Clear Demonstration & Mock Data',
        summary: `Remove ${totalItems} sample demonstration records while preserving all your real user data, account credentials, and settings.`,
        toDelete: {
          subjects: demoSubjects.length,
          tasks: demoTasks.length,
          personalGoals: demoGoals.length,
          documents: demoDocsCount,
          sleepRecords: demoSleepCount,
          focusSessions: demoFocusCount,
          dailyReviews: demoReviewsCount,
          dailySchedules: demoSchedulesCount,
          scheduleOverrides: demoOverridesCount,
          totalItems,
          sampleSubjects: demoSubjects.map((s) => s.name).slice(0, 5),
          sampleTasks: demoTasks.map((t) => t.title).slice(0, 5),
          sampleGoals: demoGoals.map((g) => g.name).slice(0, 5),
        },
        toPreserve: {
          userAccount: `${user.fullName} (${user.email}, @${user.username})`,
          settings: `Routine meals (${user.profile?.breakfastTime || '08:00'}, ${user.profile?.lunchTime || '13:00'}, ${user.profile?.dinnerTime || '20:00'}), weekly college timetable, and user preferences preserved`,
          realSubjectsCount,
          realTasksCount,
          realGoalsCount,
          realDocumentsCount: realDocsCount,
          explanation: 'All real user-created subjects, personal tasks, and documents will remain 100% untouched.',
        },
        requiresConfirmation: true,
      };
    } else {
      // RESET_WORKSPACE: Delete everything except the user account & profile settings
      const subjects = await prisma.subject.findMany({
        where: { userId },
        select: { id: true, name: true },
      });
      const tasks = await prisma.task.findMany({
        where: { userId },
        select: { id: true, title: true },
      });
      const goals = await prisma.personalGoal.findMany({
        where: { userId },
        select: { id: true, name: true },
      });
      const docsCount = await prisma.uploadedDocument.count({ where: { userId } });
      const sleepCount = await prisma.sleepRecord.count({ where: { userId } });
      const focusCount = await prisma.focusSession.count({ where: { userId } });
      const reviewsCount = await prisma.dailyReview.count({ where: { userId } });
      const schedulesCount = await prisma.dailySchedule.count({ where: { userId } });
      const overridesCount = await prisma.scheduleOverride.count({ where: { userId } });

      const totalItems =
        subjects.length +
        tasks.length +
        goals.length +
        docsCount +
        sleepCount +
        focusCount +
        reviewsCount +
        schedulesCount +
        overridesCount;

      return {
        mode: 'RESET_WORKSPACE',
        modeTitle: 'Reset Entire Workspace',
        summary: `Reset your workspace to a clean slate (${totalItems} total records removed). Your user login account and configuration settings are safely preserved.`,
        toDelete: {
          subjects: subjects.length,
          tasks: tasks.length,
          personalGoals: goals.length,
          documents: docsCount,
          sleepRecords: sleepCount,
          focusSessions: focusCount,
          dailyReviews: reviewsCount,
          dailySchedules: schedulesCount,
          scheduleOverrides: overridesCount,
          totalItems,
          sampleSubjects: subjects.map((s) => s.name).slice(0, 5),
          sampleTasks: tasks.map((t) => t.title).slice(0, 5),
          sampleGoals: goals.map((g) => g.name).slice(0, 5),
        },
        toPreserve: {
          userAccount: `${user.fullName} (${user.email}, @${user.username})`,
          settings: `Account credentials, routine meal timings, weekly college hours, and user preferences preserved`,
          realSubjectsCount: 0,
          realTasksCount: 0,
          realGoalsCount: 0,
          realDocumentsCount: 0,
          explanation: 'Your login credentials and account preferences are preserved. A fresh, clean workspace is initialized.',
        },
        requiresConfirmation: true,
      };
    }
  }

  /**
   * Executes the deletion inside a safe Prisma transaction scoped strictly to the authenticated user
   */
  static async executeReset(
    userId: string,
    mode: ResetMode,
    keepProposalId?: string
  ): Promise<{
    success: boolean;
    mode: ResetMode;
    deletedCounts: {
      subjects: number;
      tasks: number;
      personalGoals: number;
      documents: number;
      sleepRecords: number;
      focusSessions: number;
      dailyReviews: number;
      dailySchedules: number;
      scheduleOverrides: number;
      totalDeleted: number;
    };
    message: string;
  }> {
    // Tag existing demo records before running
    await this.tagExistingDemoRecords(userId);

    return await prisma.$transaction(async (tx) => {
      if (mode === 'CLEAR_MOCK_DATA') {
        // 1. Identify demo subject and goal IDs
        const demoSubjects = await tx.subject.findMany({
          where: { userId, isDemo: true },
          select: { id: true },
        });
        const demoSubjectIds = demoSubjects.map((s) => s.id);

        const demoGoals = await tx.personalGoal.findMany({
          where: { userId, isDemo: true },
          select: { id: true },
        });
        const demoGoalIds = demoGoals.map((g) => g.id);

        // 2. Delete demo tasks
        const tasksDel = await tx.task.deleteMany({
          where: {
            userId,
            OR: [
              { isDemo: true },
              { subjectId: { in: demoSubjectIds } },
              { personalGoalId: { in: demoGoalIds } },
            ],
          },
        });

        // 3. Delete demo subjects (cascades to Unit, UnitTopic, AcademicExam, Assignment)
        const subjectsDel = await tx.subject.deleteMany({
          where: { userId, isDemo: true },
        });

        // 4. Delete demo personal goals (cascades to GoalSession)
        const goalsDel = await tx.personalGoal.deleteMany({
          where: { userId, isDemo: true },
        });

        // 5. Delete demo uploaded documents
        const docsDel = await tx.uploadedDocument.deleteMany({
          where: { userId, isDemo: true },
        });

        // 6. Delete demo sleep records
        const sleepDel = await tx.sleepRecord.deleteMany({
          where: { userId, isDemo: true },
        });

        // 7. Delete demo focus sessions
        const focusDel = await tx.focusSession.deleteMany({
          where: { userId, isDemo: true },
        });

        // 8. Delete demo daily reviews
        const reviewsDel = await tx.dailyReview.deleteMany({
          where: { userId, isDemo: true },
        });

        // 9. Delete demo daily schedules
        const schedulesDel = await tx.dailySchedule.deleteMany({
          where: { userId, isDemo: true },
        });

        // 10. Delete demo schedule overrides
        const overridesDel = await tx.scheduleOverride.deleteMany({
          where: { userId, isDemo: true },
        });

        // Delete other pending data reset proposals if any
        if (keepProposalId) {
          await tx.aIProposal.deleteMany({
            where: { userId, proposalType: 'DATA_RESET', id: { not: keepProposalId } },
          });
        } else {
          await tx.aIProposal.deleteMany({
            where: { userId, proposalType: 'DATA_RESET' },
          });
        }

        const totalDeleted =
          subjectsDel.count +
          tasksDel.count +
          goalsDel.count +
          docsDel.count +
          sleepDel.count +
          focusDel.count +
          reviewsDel.count +
          schedulesDel.count +
          overridesDel.count;

        return {
          success: true,
          mode: 'CLEAR_MOCK_DATA' as const,
          deletedCounts: {
            subjects: subjectsDel.count,
            tasks: tasksDel.count,
            personalGoals: goalsDel.count,
            documents: docsDel.count,
            sleepRecords: sleepDel.count,
            focusSessions: focusDel.count,
            dailyReviews: reviewsDel.count,
            dailySchedules: schedulesDel.count,
            scheduleOverrides: overridesDel.count,
            totalDeleted,
          },
          message: `Successfully cleared ${totalDeleted} demonstration records. All your real user-created data, account credentials, and settings have been safely preserved.`,
        };
      } else {
        // RESET_WORKSPACE: Delete all user workspace records, preserve User and UserProfile
        const tasksDel = await tx.task.deleteMany({ where: { userId } });
        const subjectsDel = await tx.subject.deleteMany({ where: { userId } });
        const goalsDel = await tx.personalGoal.deleteMany({ where: { userId } });
        const docsDel = await tx.uploadedDocument.deleteMany({ where: { userId } });
        const sleepDel = await tx.sleepRecord.deleteMany({ where: { userId } });
        const focusDel = await tx.focusSession.deleteMany({ where: { userId } });
        const reviewsDel = await tx.dailyReview.deleteMany({ where: { userId } });
        const schedulesDel = await tx.dailySchedule.deleteMany({ where: { userId } });
        const overridesDel = await tx.scheduleOverride.deleteMany({ where: { userId } });
        if (keepProposalId) {
          await tx.aIProposal.deleteMany({
            where: { userId, id: { not: keepProposalId } },
          });
        } else {
          await tx.aIProposal.deleteMany({ where: { userId } });
        }

        const totalDeleted =
          subjectsDel.count +
          tasksDel.count +
          goalsDel.count +
          docsDel.count +
          sleepDel.count +
          focusDel.count +
          reviewsDel.count +
          schedulesDel.count +
          overridesDel.count;

        return {
          success: true,
          mode: 'RESET_WORKSPACE' as const,
          deletedCounts: {
            subjects: subjectsDel.count,
            tasks: tasksDel.count,
            personalGoals: goalsDel.count,
            documents: docsDel.count,
            sleepRecords: sleepDel.count,
            focusSessions: focusDel.count,
            dailyReviews: reviewsDel.count,
            dailySchedules: schedulesDel.count,
            scheduleOverrides: overridesDel.count,
            totalDeleted,
          },
          message: `Workspace reset successfully. Removed ${totalDeleted} records. Your account credentials and preferences are preserved. Your clean workspace is ready!`,
        };
      }
    });
  }
}
