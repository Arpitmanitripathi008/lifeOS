import type { Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';

export const createCommitmentSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    category: z.enum(['COLLEGE', 'MEAL', 'APPOINTMENT', 'COMMUTE', 'OTHER']).default('COLLEGE'),
    dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
    specificDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm'),
    isRecurring: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.endTime > data.startTime;
      }
      return true;
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  );

export const updateCommitmentSchema = z
  .object({
    title: z.string().min(1, 'Title is required').optional(),
    category: z.enum(['COLLEGE', 'MEAL', 'APPOINTMENT', 'COMMUTE', 'OTHER']).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
    specificDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm').optional(),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm').optional(),
    isRecurring: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.endTime > data.startTime;
      }
      return true;
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  );

export async function getCommitments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const commitments = await prisma.fixedCommitment.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json(commitments);
  } catch (error) {
    next(error);
  }
}

export async function createCommitment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { dayOfWeek, specificDate, startTime, endTime, isRecurring } = req.body;

    // Check for overlapping fixed commitments for the same day (scoped to this user)
    const conditions: any[] = [];
    if (isRecurring && dayOfWeek !== null && dayOfWeek !== undefined) {
      conditions.push({ dayOfWeek, isRecurring: true });
    }
    if (specificDate) {
      conditions.push({ specificDate });
    }

    if (conditions.length > 0) {
      const existing = await prisma.fixedCommitment.findMany({
        where: {
          userId,
          OR: conditions,
        },
      });

      const overlapping = existing.filter(
        (c) => startTime < c.endTime && endTime > c.startTime
      );

      if (overlapping.length > 0) {
        return res.status(409).json({
          error: 'A fixed commitment already exists during this time slot.',
          conflicts: overlapping.map((c) => ({
            id: c.id,
            title: c.title,
            time: `${c.startTime} - ${c.endTime}`,
          })),
        });
      }
    }

    const commitment = await prisma.fixedCommitment.create({
      data: {
        ...req.body,
        userId,
      },
    });
    res.status(201).json(commitment);
  } catch (error) {
    next(error);
  }
}

export async function updateCommitment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const existing = await prisma.fixedCommitment.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Commitment not found.' });
    }

    const commitment = await prisma.fixedCommitment.update({
      where: { id },
      data: req.body,
    });
    res.json(commitment);
  } catch (error) {
    next(error);
  }
}

export async function deleteCommitment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const existing = await prisma.fixedCommitment.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Commitment not found.' });
    }

    await prisma.fixedCommitment.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
