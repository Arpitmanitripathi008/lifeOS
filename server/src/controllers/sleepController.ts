import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { z } from 'zod';

export const logSleepSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bedTimeApprox: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  wakeUpTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  durationMinutes: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function calculateDuration(bedTime?: string | null, wakeTime?: string | null): number | null {
  if (!bedTime || !wakeTime) return null;
  const [bH, bM] = bedTime.split(':').map(Number);
  const [wH, wM] = wakeTime.split(':').map(Number);
  let totalBed = bH * 60 + bM;
  let totalWake = wH * 60 + wM;
  if (totalWake < totalBed) {
    totalWake += 24 * 60; // Slept past midnight
  }
  return totalWake - totalBed;
}

export async function getSleepRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { limit = '7' } = req.query;
    const records = await prisma.sleepRecord.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: parseInt(limit as string, 10),
    });
    res.json(records);
  } catch (error) {
    next(error);
  }
}

export async function logSleep(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const data = { ...req.body };
    if (!data.durationMinutes && data.bedTimeApprox && data.wakeUpTime) {
      data.durationMinutes = calculateDuration(data.bedTimeApprox, data.wakeUpTime);
    }

    const record = await prisma.sleepRecord.upsert({
      where: {
        userId_date: {
          userId,
          date: data.date,
        },
      },
      create: {
        ...data,
        userId,
      },
      update: data,
    });
    res.json(record);
  } catch (error) {
    next(error);
  }
}

export async function getSleepStats(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const records = await prisma.sleepRecord.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 7,
    });

    if (records.length === 0) {
      return res.json({
        lastReported: null,
        weeklyAverageMinutes: null,
        weeklyAverageFormatted: '—',
        trend: 'No data yet',
        records: [],
      });
    }

    const validDurations = records
      .map((r) => r.durationMinutes)
      .filter((d): d is number => typeof d === 'number' && d > 0);

    const avgMinutes =
      validDurations.length > 0
        ? Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length)
        : null;

    const avgH = avgMinutes ? Math.floor(avgMinutes / 60) : 0;
    const avgM = avgMinutes ? avgMinutes % 60 : 0;

    res.json({
      lastReported: records[0],
      weeklyAverageMinutes: avgMinutes,
      weeklyAverageFormatted: avgMinutes ? `${avgH}h ${avgM}m` : '—',
      trend: validDurations.length >= 3 ? 'Stable' : 'Needs more data',
      records,
    });
  } catch (error) {
    next(error);
  }
}
