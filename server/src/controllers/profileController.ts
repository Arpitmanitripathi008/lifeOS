import type { Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  collegeStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  collegeEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  breakfastTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  lunchTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  dinnerTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  defaultTaskDuration: z.number().int().positive().optional(),
  weeklyHolidays: z.string().optional().nullable(),
  weeklyCollegeTimings: z.string().optional().nullable(),
});

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    let profile = await prisma.userProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId,
          displayName: req.user!.username || 'Student',
          collegeStartTime: '09:00',
          collegeEndTime: '15:00',
          breakfastTime: '08:00',
          lunchTime: '13:00',
          dinnerTime: '20:00',
          defaultTaskDuration: 45,
        },
      });
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      create: {
        ...req.body,
        userId,
      },
      update: req.body,
    });
    res.json(profile);
  } catch (error) {
    next(error);
  }
}
