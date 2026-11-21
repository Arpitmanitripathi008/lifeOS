import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { z } from 'zod';

export const createGoalSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['CODING', 'FINANCE', 'HOBBY', 'FITNESS', 'ACADEMIC_EXTRA', 'OTHER']).default('CODING'),
  description: z.string().optional().nullable(),
  minSessionsPerWeek: z.number().int().positive().default(2),
  prefSessionsPerWeek: z.number().int().positive().default(3),
  maxSessionsPerWeek: z.number().int().positive().default(5),
  sessionDurationMins: z.number().int().positive().default(45),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const updateGoalSchema = createGoalSchema.partial();

export async function getGoals(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const goals = await prisma.personalGoal.findMany({
      where: { userId },
      include: {
        goalSessions: {
          orderBy: { scheduledDate: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(goals);
  } catch (error) {
    next(error);
  }
}

export async function createGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const goal = await prisma.personalGoal.create({
      data: {
        ...req.body,
        userId,
      },
    });
    res.status(201).json(goal);
  } catch (error) {
    next(error);
  }
}

export async function updateGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;

    const existing = await prisma.personalGoal.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = await prisma.personalGoal.update({
      where: { id },
      data: req.body,
    });
    res.json(goal);
  } catch (error) {
    next(error);
  }
}

export async function deleteGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;

    const existing = await prisma.personalGoal.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    await prisma.personalGoal.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function logGoalSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;

    const goal = await prisma.personalGoal.findFirst({
      where: { id, userId },
    });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const { scheduledDate, durationMins, isCompleted } = req.body;
    const session = await prisma.goalSession.create({
      data: {
        personalGoalId: id,
        scheduledDate: scheduledDate || new Date().toISOString().split('T')[0],
        durationMins: durationMins || 45,
        isCompleted: isCompleted !== undefined ? isCompleted : true,
        completedAt: isCompleted ? new Date() : null,
      },
    });
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
}
