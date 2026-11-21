import type { Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  category: z.enum(['FIXED', 'DEADLINE', 'PERSONAL_GROWTH', 'HEALTH', 'FLEXIBLE']).default('DEADLINE'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  estimatedDuration: z.number().int().positive().default(45),
  remainingDuration: z.number().int().nonnegative().optional().nullable(),
  deadline: z.string().optional().nullable(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  scheduledStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  scheduledEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  status: z.enum(['PENDING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'POSTPONED', 'CANCELLED']).default('PENDING'),
  postponedReason: z.string().optional().nullable(),
  source: z.string().default('MANUAL'),
  isFixed: z.boolean().default(false),
  subjectId: z.string().uuid().optional().nullable(),
  unitTopicId: z.string().uuid().optional().nullable(),
  personalGoalId: z.string().uuid().optional().nullable(),
  assignmentId: z.string().uuid().optional().nullable(),
});

export const updateTaskSchema = createTaskSchema.partial();

export async function getTasks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { date, status, category } = req.query;
    const where: any = { userId };

    if (date && typeof date === 'string') {
      where.scheduledDate = date;
    }
    if (status && typeof status === 'string') {
      where.status = status;
    }
    if (category && typeof category === 'string') {
      where.category = category;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        subject: true,
        unitTopic: true,
        personalGoal: true,
        assignment: true,
      },
      orderBy: [
        { scheduledStartTime: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const task = await prisma.task.create({
      data: {
        ...req.body,
        userId,
      },
      include: {
        subject: true,
        unitTopic: true,
        personalGoal: true,
      },
    });
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;

    const existing = await prisma.task.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    const data = { ...req.body };

    // If status changed to POSTPONED, increment timesPostponed
    if (data.status === 'POSTPONED') {
      data.timesPostponed = (existing.timesPostponed || 0) + 1;
    }

    const task = await prisma.task.update({
      where: { id },
      data,
      include: {
        subject: true,
        unitTopic: true,
        personalGoal: true,
      },
    });
    res.json(task);
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;

    const existing = await prisma.task.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    await prisma.task.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
