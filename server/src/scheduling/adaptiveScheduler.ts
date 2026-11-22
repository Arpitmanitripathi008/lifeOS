import { z } from 'zod';

export interface TimeSlot {
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  durationMinutes: number;
}

export interface ScheduledActivity {
  id?: string;
  title: string;
  description?: string;
  category: 'FIXED' | 'DEADLINE' | 'PERSONAL_GROWTH' | 'HEALTH' | 'FLEXIBLE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  durationMinutes: number;
  isFixed: boolean;
  reason: string;
  source?: string;
  subjectId?: string | null;
  personalGoalId?: string | null;
}

export interface SchedulingContext {
  date: string;               // "YYYY-MM-DD"
  todayDate?: string;         // "YYYY-MM-DD" (client-aware local date)
  currentTime?: string;       // "HH:mm" (e.g. "16:20")
  wakeUpTime: string;         // "HH:mm"
  bedTimeApprox?: string | null;
  dayOfWeek?: number;         // 0 = Sunday, 1 = Monday ... 6 = Saturday
  weeklyHolidays?: number[];  // e.g. [0] for Sunday, [0, 6] for Sat+Sun
  weeklyCollegeTimings?: Record<string, { start: string; end: string }>; // e.g. { "1": { start: "09:00", end: "15:00" } }
  activeOverride?: {
    id?: string;
    overrideType: string;
    originalStartTime?: string | null;
    originalEndTime?: string | null;
    adjustedStartTime?: string | null;
    adjustedEndTime?: string | null;
    reason?: string | null;
    isActive?: boolean;
  } | null;
  completedTasksToday?: Array<{
    id: string;
    title: string;
    startTime?: string | null;
    endTime?: string | null;
    durationMinutes: number;
    category?: string;
  }>;
  fixedCommitments: Array<{
    id: string;
    title: string;
    category: string;
    startTime: string;
    endTime: string;
  }>;
  mealTimes?: {
    breakfast?: string | null; // e.g. "08:00"
    lunch?: string | null;     // e.g. "13:00"
    dinner?: string | null;    // e.g. "20:00"
  };
  unavailableWindows?: Array<{
    startTime: string;
    endTime: string;
    reason?: string | null;
  }>;
  pendingTasks: Array<{
    id?: string;
    title: string;
    category: string;
    priority: string;
    estimatedDuration: number;
    deadline?: string | null;
    subjectId?: string | null;
    timesPostponed?: number;
  }>;
  personalGoals: Array<{
    id: string;
    name: string;
    category: string;
    prefSessionsPerWeek: number;
    completedThisWeek: number;
    sessionDurationMins: number;
  }>;
  existingTasksToday?: ScheduledActivity[];
}

export interface SchedulingResult {
  date: string;
  wakeUpTime: string;
  planningHorizonEnd: string;
  scheduledActivities: ScheduledActivity[];
  overflowTasks: Array<{
    title: string;
    estimatedDuration: number;
    priority: string;
    recommendedDate: string;
    reason: string;
  }>;
  metrics: {
    totalWorkMinutes: number;
    totalBufferMinutes: number;
    totalFixedMinutes: number;
    freeTimeRemainingMinutes: number;
    conflictCount: number;
  };
  aiExplanation: string;
  holidayOverrideDetected?: boolean;
}

// Helper utilities for time calculations
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export class AdaptiveScheduler {
  /**
   * Deterministically generates a balanced, conflict-free daily schedule with weekly & holiday awareness
   */
  static scheduleDay(context: SchedulingContext): SchedulingResult {
    const wakeMinutes = timeToMinutes(context.wakeUpTime);
    
    // Future rest assumption: 7 hours rest, so day duration is ~17 hours from wake-up (max 23:30)
    const horizonEndMinutes = Math.min(23 * 60 + 30, wakeMinutes + 16 * 60);
    const horizonEnd = minutesToTime(horizonEndMinutes);

    const scheduled: ScheduledActivity[] = [];
    const blockedIntervals: Array<{ start: number; end: number; title: string }> = [];

    // Resolve day of week
    const targetDate = new Date(`${context.date}T00:00:00`);
    const dayOfWeek = context.dayOfWeek !== undefined ? context.dayOfWeek : targetDate.getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

    // Real-time awareness: if scheduling for today, never place tasks in the past!
    const todayStr = context.todayDate || context.date;
    const isToday = context.date === todayStr;
    let effectiveStartCursor = wakeMinutes;

    if (isToday && context.currentTime) {
      const currentMins = timeToMinutes(context.currentTime);
      // If current time is late night / early morning before wake-up (e.g. 1:00 AM before 07:30 AM wake-up),
      // the user is planning the upcoming day: start at the student's normal wake-up time!
      if (currentMins < wakeMinutes) {
        effectiveStartCursor = wakeMinutes;
      } else {
        // Round up to next 15-minute slot with a buffer
        const futureEarliest = Math.ceil((currentMins + 5) / 15) * 15;
        effectiveStartCursor = Math.max(wakeMinutes, futureEarliest);
      }
    }

    // Weekly holiday check (default Sunday [0])
    const weeklyHolidays = context.weeklyHolidays || [0];
    const isWeeklyHoliday = weeklyHolidays.includes(dayOfWeek);

    // Active temporary schedule override check
    const override = context.activeOverride && context.activeOverride.isActive !== false ? context.activeOverride : null;
    const isFullHolidayOverride = !!(override && (override.overrideType === 'FULL_HOLIDAY' || override.overrideType === 'CANCEL_CLASSES'));
    const isHalfDayOverride = !!(override && override.overrideType === 'HALF_DAY');
    const isCustomHoursOverride = !!(override && override.overrideType === 'CUSTOM_HOURS');

    // 0. Permanent Protection: Lock in Completed Tasks (Never delete or reschedule past achievements)
    if (context.completedTasksToday) {
      for (const ct of context.completedTasksToday) {
        if (ct.startTime && ct.endTime) {
          const cStart = timeToMinutes(ct.startTime);
          const cEnd = timeToMinutes(ct.endTime);
          scheduled.push({
            id: ct.id,
            title: `✓ ${ct.title}`,
            category: (ct.category as any) || 'DEADLINE',
            priority: 'HIGH',
            startTime: ct.startTime,
            endTime: ct.endTime,
            durationMinutes: ct.durationMinutes,
            isFixed: true,
            reason: 'Completed task record (permanently preserved)',
          });
          blockedIntervals.push({
            start: cStart,
            end: cEnd,
            title: `Completed: ${ct.title}`,
          });
        }
      }
    }

    // 1. Process Fixed Commitments with Weekly Timetable and Holiday Awareness
    let collegeCommitmentFound: any = null;

    for (const c of context.fixedCommitments) {
      const isCollege = c.category === 'COLLEGE';
      if (isCollege) {
        collegeCommitmentFound = c;

        // A. Full holiday override active (temporary)
        if (isFullHolidayOverride) {
          // Temporarily exclude college commitment for this date!
          continue;
        }

        // B. Regular weekly holiday (e.g. Sunday)
        if (isWeeklyHoliday && !override) {
          // Exclude college commitment automatically on weekly holidays
          continue;
        }

        // C. Half-day college override
        if (isHalfDayOverride) {
          const hStart = override.adjustedStartTime || c.startTime;
          const originalDuration = timeToMinutes(c.endTime) - timeToMinutes(c.startTime);
          const halfDuration = Math.round(originalDuration / 2 / 15) * 15;
          const hEnd = override.adjustedEndTime || minutesToTime(timeToMinutes(hStart) + halfDuration);
          const cStart = timeToMinutes(hStart);
          const cEnd = timeToMinutes(hEnd);

          scheduled.push({
            id: c.id,
            title: `${c.title} (Half Day)`,
            category: 'FIXED',
            priority: 'URGENT',
            startTime: hStart,
            endTime: hEnd,
            durationMinutes: cEnd - cStart,
            isFixed: true,
            reason: 'Temporary half-day college schedule',
          });
          blockedIntervals.push({
            start: cStart,
            end: cEnd,
            title: `${c.title} (Half Day)`,
          });
          continue;
        }

        // D. Custom hours override
        if (isCustomHoursOverride) {
          const startStr = override.adjustedStartTime || c.startTime;
          const endStr = override.adjustedEndTime || c.endTime;
          const cStart = timeToMinutes(startStr);
          const cEnd = timeToMinutes(endStr);

          scheduled.push({
            id: c.id,
            title: `${c.title} (Modified Hours)`,
            category: 'FIXED',
            priority: 'URGENT',
            startTime: startStr,
            endTime: endStr,
            durationMinutes: cEnd - cStart,
            isFixed: true,
            reason: override.reason || 'Temporary modified college hours',
          });
          blockedIntervals.push({
            start: cStart,
            end: cEnd,
            title: `${c.title} (Modified Hours)`,
          });
          continue;
        }

        // E. Weekday-specific college timings (e.g. Wednesday different from Monday)
        if (context.weeklyCollegeTimings && context.weeklyCollegeTimings[String(dayOfWeek)]) {
          const customTiming = context.weeklyCollegeTimings[String(dayOfWeek)];
          const cStart = timeToMinutes(customTiming.start);
          const cEnd = timeToMinutes(customTiming.end);

          scheduled.push({
            id: c.id,
            title: c.title,
            category: 'FIXED',
            priority: 'URGENT',
            startTime: customTiming.start,
            endTime: customTiming.end,
            durationMinutes: cEnd - cStart,
            isFixed: true,
            reason: `Configured weekly college timetable for ${dayName}`,
          });
          blockedIntervals.push({
            start: cStart,
            end: cEnd,
            title: c.title,
          });
          continue;
        }
      }

      // Default fixed commitment scheduling
      const cStart = timeToMinutes(c.startTime);
      const cEnd = timeToMinutes(c.endTime);

      if (cEnd > effectiveStartCursor) {
        const actualStart = Math.max(effectiveStartCursor, cStart);
        scheduled.push({
          id: c.id,
          title: c.title,
          category: 'FIXED',
          priority: 'URGENT',
          startTime: minutesToTime(actualStart),
          endTime: c.endTime,
          durationMinutes: cEnd - actualStart,
          isFixed: true,
          reason: 'Non-negotiable fixed commitment',
        });

        blockedIntervals.push({
          start: actualStart,
          end: cEnd,
          title: c.title,
        });
      }
    }

    // 2. Lock in User-Specified Unavailable Windows (e.g. "Cannot work 4 PM - 6 PM")
    if (context.unavailableWindows) {
      for (const w of context.unavailableWindows) {
        const wStart = timeToMinutes(w.startTime);
        const wEnd = timeToMinutes(w.endTime);
        if (wEnd > effectiveStartCursor) {
          blockedIntervals.push({
            start: Math.max(effectiveStartCursor, wStart),
            end: wEnd,
            title: w.reason || 'Unavailable window',
          });
        }
      }
    }

    // 3. Lock in Protected Health & Recovery (Meals)
    const mealDefs = [
      { name: 'Breakfast', time: context.mealTimes?.breakfast || '08:00', duration: 30 },
      { name: 'Lunch', time: context.mealTimes?.lunch || '13:00', duration: 45 },
      { name: 'Dinner', time: context.mealTimes?.dinner || '20:00', duration: 45 },
    ];

    for (const meal of mealDefs) {
      const mealStart = timeToMinutes(meal.time);
      const mealEnd = mealStart + meal.duration;

      // Only insert meal if it occurs in the future planning horizon and isn't blocked
      if (mealEnd > effectiveStartCursor && mealStart >= wakeMinutes && mealEnd <= horizonEndMinutes) {
        const isBlocked = blockedIntervals.some(
          (b) => !(mealEnd <= b.start || mealStart >= b.end)
        );

        if (!isBlocked) {
          scheduled.push({
            title: meal.name,
            category: 'HEALTH',
            priority: 'HIGH',
            startTime: meal.time,
            endTime: minutesToTime(mealEnd),
            durationMinutes: meal.duration,
            isFixed: true,
            reason: 'Protected meal and nutritional recovery',
          });
          blockedIntervals.push({
            start: mealStart,
            end: mealEnd,
            title: meal.name,
          });
        }
      }
    }

    // Sort blocked intervals chronologically
    blockedIntervals.sort((a, b) => a.start - b.start);

    // Merge overlapping or contiguous blocked intervals
    const mergedBlocked: Array<{ start: number; end: number }> = [];
    for (const b of blockedIntervals) {
      if (mergedBlocked.length === 0) {
        mergedBlocked.push({ start: b.start, end: b.end });
      } else {
        const last = mergedBlocked[mergedBlocked.length - 1];
        if (b.start <= last.end) {
          last.end = Math.max(last.end, b.end);
        } else {
          mergedBlocked.push({ start: b.start, end: b.end });
        }
      }
    }

    // 4. Calculate Usable Planning Windows between Effective Start (Current Time / Wake) and Horizon End
    const availableWindows: Array<{ start: number; end: number; duration: number }> = [];
    let currentCursor = effectiveStartCursor;

    for (const b of mergedBlocked) {
      if (b.end <= currentCursor) {
        continue;
      }
      if (b.start > currentCursor) {
        const duration = b.start - currentCursor;
        if (duration >= 20) { // minimum 20 minutes to be a viable window
          availableWindows.push({
            start: currentCursor,
            end: b.start,
            duration,
          });
        }
      }
      currentCursor = Math.max(currentCursor, b.end);
    }

    if (currentCursor < horizonEndMinutes) {
      const duration = horizonEndMinutes - currentCursor;
      if (duration >= 20) {
        availableWindows.push({
          start: currentCursor,
          end: horizonEndMinutes,
          duration,
        });
      }
    }

    // 5. Prioritize Tasks
    const queue: Array<{
      id?: string;
      title: string;
      category: 'DEADLINE' | 'PERSONAL_GROWTH' | 'FLEXIBLE';
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      durationMinutes: number;
      reason: string;
      subjectId?: string | null;
      personalGoalId?: string | null;
    }> = [];

    // Prioritize high-urgency deadline tasks
    const sortedTasks = [...context.pendingTasks].sort((a, b) => {
      const pOrder: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const pDiff = (pOrder[b.priority] || 2) - (pOrder[a.priority] || 2);
      if (pDiff !== 0) return pDiff;
      return (b.timesPostponed || 0) - (a.timesPostponed || 0);
    });

    for (const t of sortedTasks) {
      // Rule: Split large tasks (>90 mins) into manageable focused blocks
      if (t.estimatedDuration > 90) {
        const part1 = Math.ceil(t.estimatedDuration / 2 / 15) * 15;
        const part2 = t.estimatedDuration - part1;
        queue.push({
          id: t.id,
          title: `${t.title} (Part 1)`,
          category: t.category as any,
          priority: t.priority as any,
          durationMinutes: part1,
          reason: 'Split into focused session to prevent cognitive fatigue',
          subjectId: t.subjectId,
        });
        queue.push({
          title: `${t.title} (Part 2)`,
          category: t.category as any,
          priority: t.priority as any,
          durationMinutes: part2,
          reason: 'Second focused session',
          subjectId: t.subjectId,
        });
      } else {
        queue.push({
          id: t.id,
          title: t.title,
          category: t.category as any,
          priority: t.priority as any,
          durationMinutes: t.estimatedDuration,
          reason: `Prioritized by urgency (${t.priority})`,
          subjectId: t.subjectId,
        });
      }
    }

    // Rule: Protect Personal Growth Rotation
    const goalsWithDeficit = (context.personalGoals || [])
      .map((g) => ({
        ...g,
        deficit: g.prefSessionsPerWeek - g.completedThisWeek,
      }))
      .filter((g) => g.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit);

    if (goalsWithDeficit.length > 0) {
      const topGoal = goalsWithDeficit[0];
      queue.splice(Math.min(1, queue.length), 0, {
        title: topGoal.name,
        category: 'PERSONAL_GROWTH',
        priority: 'HIGH',
        durationMinutes: topGoal.sessionDurationMins || 45,
        reason: `Personal growth rotation: ${topGoal.deficit} sessions needed to hit weekly target`,
        personalGoalId: topGoal.id,
      });
    }

    // 6. Greedy Interval Slotting with Buffer Preservation
    // Rule: Avoid filling every newly available hour when college is cancelled
    // Cap total study/focus time to 360 mins (6 hours) per day for sustainability
    const overflowTasks: Array<{
      title: string;
      estimatedDuration: number;
      priority: string;
      recommendedDate: string;
      reason: string;
    }> = [];

    const tomorrow = new Date(context.date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    let totalWorkMinutes = 0;
    const remainingDayMins = Math.max(0, horizonEndMinutes - effectiveStartCursor);
    const MAX_DAILY_WORK_MINS = isToday ? Math.min(360, Math.floor(remainingDayMins * 0.75)) : 360;

    for (const item of queue) {
      if (totalWorkMinutes + item.durationMinutes > MAX_DAILY_WORK_MINS) {
        overflowTasks.push({
          title: item.title,
          estimatedDuration: item.durationMinutes,
          priority: item.priority,
          recommendedDate: tomorrowStr,
          reason: `Daily workload limit (${MAX_DAILY_WORK_MINS / 60}h) reached. Moved to preserve balance.`,
        });
        continue;
      }

      let slotted = false;
      for (const win of availableWindows) {
        if (win.duration >= item.durationMinutes) {
          const taskStart = win.start;
          const taskEnd = taskStart + item.durationMinutes;

          scheduled.push({
            id: item.id,
            title: item.title,
            category: item.category,
            priority: item.priority,
            startTime: minutesToTime(taskStart),
            endTime: minutesToTime(taskEnd),
            durationMinutes: item.durationMinutes,
            isFixed: false,
            reason: item.reason,
            subjectId: item.subjectId,
            personalGoalId: item.personalGoalId,
          });

          // Insert 10m health buffer after the task
          const bufferDuration = 10;
          const newStart = taskEnd + bufferDuration;
          win.start = newStart;
          win.duration = win.end - newStart;

          totalWorkMinutes += item.durationMinutes;
          slotted = true;
          break;
        }
      }

      if (!slotted) {
        overflowTasks.push({
          title: item.title,
          estimatedDuration: item.durationMinutes,
          priority: item.priority,
          recommendedDate: tomorrowStr,
          reason: 'No remaining conflict-free time slot today without cutting breaks.',
        });
      }
    }

    // 7. Sort all scheduled activities chronologically
    scheduled.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    // 8. Invariant Verification: Zero Overlaps
    let conflictCount = 0;
    for (let i = 0; i < scheduled.length - 1; i++) {
      const current = scheduled[i];
      const next = scheduled[i + 1];
      if (timeToMinutes(current.endTime) > timeToMinutes(next.startTime)) {
        if (!current.isFixed || !next.isFixed) {
          conflictCount++;
        }
      }
    }

    const totalFixedMinutes = scheduled
      .filter((s) => s.isFixed)
      .reduce((sum, s) => sum + s.durationMinutes, 0);

    const totalBufferMinutes = availableWindows.reduce(
      (sum, w) => sum + Math.max(0, w.duration),
      0
    );

    // 9. Craft precise, transparent human explanation
    let aiExplanation = '';
    const collegeCommitment = collegeCommitmentFound || { startTime: '09:00', endTime: '15:00' };

    if (isFullHolidayOverride) {
      aiExplanation = `Holiday detected for today. Your ${collegeCommitment.startTime}–${collegeCommitment.endTime} college commitment has been temporarily removed. Your regular weekly timetable remains unchanged. Here is your updated schedule.`;
    } else if (isHalfDayOverride) {
      aiExplanation = `Half-day college detected for today. Your college commitment has been shortened to morning hours. Your regular weekly timetable remains unchanged. Here is your updated schedule.`;
    } else if (isCustomHoursOverride) {
      aiExplanation = `Modified college hours applied for today (${override?.adjustedStartTime || collegeCommitment.startTime} – ${override?.adjustedEndTime || collegeCommitment.endTime}). Your regular weekly timetable remains unchanged. Here is your updated schedule.`;
    } else if (isWeeklyHoliday) {
      aiExplanation = `${dayName} is configured as your weekly holiday. Regular college commitments are automatically excluded. Generated a balanced study and personal growth schedule.`;
    } else {
      aiExplanation = `Schedule starts at ${context.wakeUpTime}. Preserved ${totalFixedMinutes}m for fixed commitments and meals, slotted ${totalWorkMinutes}m of focused study, and reserved ${totalBufferMinutes}m flexible buffer. ${overflowTasks.length > 0 ? `${overflowTasks.length} task(s) recommended for tomorrow to avoid overload.` : 'All tasks fit sustainably.'}`;
    }

    return {
      date: context.date,
      wakeUpTime: context.wakeUpTime,
      planningHorizonEnd: horizonEnd,
      scheduledActivities: scheduled,
      overflowTasks,
      metrics: {
        totalWorkMinutes,
        totalBufferMinutes,
        totalFixedMinutes,
        freeTimeRemainingMinutes: totalBufferMinutes,
        conflictCount,
      },
      aiExplanation,
      holidayOverrideDetected: isFullHolidayOverride || isHalfDayOverride || isCustomHoursOverride,
    };
  }

  /**
   * Reschedules around an ad-hoc unavailable time block (e.g. "Cannot work 4 PM - 6 PM")
   */
  static rescheduleAroundUnavailableBlock(
    currentSchedule: ScheduledActivity[],
    unavailableStart: string,
    unavailableEnd: string,
    reason: string = 'Unavailable time block'
  ): {
    updatedSchedule: ScheduledActivity[];
    displacedTasks: ScheduledActivity[];
    rescheduledTasks: ScheduledActivity[];
    overflowTasks: ScheduledActivity[];
  } {
    const unavStart = timeToMinutes(unavailableStart);
    const unavEnd = timeToMinutes(unavailableEnd);

    const fixedItems: ScheduledActivity[] = [];
    const movableTasks: ScheduledActivity[] = [];
    const displacedTasks: ScheduledActivity[] = [];

    // Separate fixed vs movable tasks
    for (const item of currentSchedule) {
      if (item.isFixed) {
        fixedItems.push(item);
      } else {
        const itemStart = timeToMinutes(item.startTime);
        const itemEnd = timeToMinutes(item.endTime);

        // Check if overlaps with unavailable block
        const overlaps = !(itemEnd <= unavStart || itemStart >= unavEnd);
        if (overlaps) {
          displacedTasks.push(item);
        } else {
          movableTasks.push(item);
        }
      }
    }

    // Insert unavailable block into fixed items
    fixedItems.push({
      title: reason,
      category: 'FIXED',
      priority: 'URGENT',
      startTime: unavailableStart,
      endTime: unavailableEnd,
      durationMinutes: unavEnd - unavStart,
      isFixed: true,
      reason: 'User declared unavailable window',
    });

    // Find all free slots
    const allBlocked = [
      ...fixedItems.map((f) => ({
        start: timeToMinutes(f.startTime),
        end: timeToMinutes(f.endTime),
      })),
      ...movableTasks.map((m) => ({
        start: timeToMinutes(m.startTime),
        end: timeToMinutes(m.endTime),
      })),
    ].sort((a, b) => a.start - b.start);

    // Free windows from evening until 23:00
    const availableWindows: Array<{ start: number; end: number; duration: number }> = [];
    let cursor = unavEnd; // Start looking after the unavailable block
    const eveningHorizon = 23 * 60; // 11 PM

    for (const b of allBlocked) {
      if (b.start > cursor && b.start > unavEnd) {
        const winStart = Math.max(cursor, unavEnd);
        const winEnd = Math.min(b.start, eveningHorizon);
        if (winEnd - winStart >= 20) {
          availableWindows.push({
            start: winStart,
            end: winEnd,
            duration: winEnd - winStart,
          });
        }
      }
      cursor = Math.max(cursor, b.end);
    }

    if (cursor < eveningHorizon) {
      availableWindows.push({
        start: cursor,
        end: eveningHorizon,
        duration: eveningHorizon - cursor,
      });
    }

    const rescheduledTasks: ScheduledActivity[] = [];
    const overflowTasks: ScheduledActivity[] = [];

    for (const task of displacedTasks) {
      let slotted = false;
      for (const win of availableWindows) {
        if (win.duration >= task.durationMinutes) {
          const newStart = win.start;
          const newEnd = newStart + task.durationMinutes;

          rescheduledTasks.push({
            ...task,
            startTime: minutesToTime(newStart),
            endTime: minutesToTime(newEnd),
            reason: `Rescheduled to evening slot to accommodate: ${reason}`,
          });

          win.start = newEnd + 10; // buffer
          win.duration = win.end - win.start;
          slotted = true;
          break;
        }
      }

      if (!slotted) {
        overflowTasks.push({
          ...task,
          reason: `Could not fit in evening free time without compromising sleep. Recommended carry-forward.`,
        });
      }
    }

    const updatedSchedule = [...fixedItems, ...movableTasks, ...rescheduledTasks].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

    return {
      updatedSchedule,
      displacedTasks,
      rescheduledTasks,
      overflowTasks,
    };
  }
}
