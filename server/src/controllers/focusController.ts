import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { z } from 'zod';

export const logFocusSchema = z.object({
  taskId: z.string().uuid().optional().nullable(),
  durationMinutes: z.number().int().positive().default(25),
  sessionType: z.enum(['FOCUS', 'SHORT_BREAK', 'LONG_BREAK']).default('FOCUS'),
});

export async function getFocusSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { date } = req.query;
    let where: any = { userId };

    if (date && typeof date === 'string') {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      where.completedAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const sessions = await prisma.focusSession.findMany({
      where,
      include: { task: true },
      orderBy: { completedAt: 'desc' },
    });
    res.json(sessions);
  } catch (error) {
    next(error);
  }
}

export async function logFocus(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { taskId, durationMinutes, sessionType } = req.body;

    if (taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, userId },
      });
      if (!task) {
        return res.status(404).json({ error: 'Linked task not found' });
      }
    }

    const session = await prisma.focusSession.create({
      data: {
        taskId: taskId || null,
        durationMinutes: durationMinutes || 25,
        sessionType: sessionType || 'FOCUS',
        userId,
      },
      include: { task: true },
    });
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
}
