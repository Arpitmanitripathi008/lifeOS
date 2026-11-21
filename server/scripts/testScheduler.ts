import { AdaptiveScheduler, timeToMinutes, minutesToTime, type SchedulingContext } from '../src/scheduling/adaptiveScheduler.js';

function runScenario1() {
  console.log('\n--- Scenario 1: Realistic Student Day (Wake up 8:00 AM, College till 14:00, 2h DSA, Goal Deficit) ---');

  const context: SchedulingContext = {
    date: '2026-11-21',
    wakeUpTime: '08:00',
    fixedCommitments: [
      {
        id: 'c1',
        title: 'College Lectures & Labs',
        category: 'COLLEGE',
        startTime: '09:00',
        endTime: '14:00',
      },
    ],
    mealTimes: {
      breakfast: '08:15',
      lunch: '14:15',
      dinner: '20:00',
    },
    pendingTasks: [
      {
        id: 't1',
        title: 'Data Structures & Algorithms - Dynamic Programming',
        category: 'DEADLINE',
        priority: 'HIGH',
        estimatedDuration: 120, // 2 hours -> should split into two 60m blocks
        deadline: '2026-11-22',
      },
      {
        id: 't2',
        title: 'Operating Systems Lab Submission',
        category: 'DEADLINE',
        priority: 'URGENT',
        estimatedDuration: 60,
        deadline: '2026-11-21',
      },
    ],
    personalGoals: [
      {
        id: 'g1',
        name: 'Open Source Contribution',
        category: 'CODING',
        prefSessionsPerWeek: 3,
        completedThisWeek: 0, // Deficit = 3 -> should be protected
        sessionDurationMins: 45,
      },
    ],
  };

  const result = AdaptiveScheduler.scheduleDay(context);

  console.log(`Wake-up: ${result.wakeUpTime} | Planning Horizon End: ${result.planningHorizonEnd}`);
  console.log(`Total Work: ${result.metrics.totalWorkMinutes}m | Buffers: ${result.metrics.totalBufferMinutes}m | Fixed: ${result.metrics.totalFixedMinutes}m`);
  console.log(`Conflict Count: ${result.metrics.conflictCount}`);

  console.log('\nScheduled Chronological Activities:');
  for (const act of result.scheduledActivities) {
    console.log(`  [${act.startTime} – ${act.endTime}] (${act.category}) ${act.title} - ${act.reason}`);
  }

  if (result.overflowTasks.length > 0) {
    console.log('\nOverflow Tasks (moved to prevent burnout):');
    for (const ov of result.overflowTasks) {
      console.log(`  • ${ov.title} -> recommended date: ${ov.recommendedDate} (${ov.reason})`);
    }
  }

  // Invariant verification
  if (result.metrics.conflictCount !== 0) {
    throw new Error(`TEST FAILED: Found ${result.metrics.conflictCount} conflicts!`);
  }

  // Verify fixed commitment unmoved
  const college = result.scheduledActivities.find((a) => a.title === 'College Lectures & Labs');
  if (!college || college.startTime !== '09:00' || college.endTime !== '14:00') {
    throw new Error('TEST FAILED: Fixed commitment was modified or moved!');
  }

  // Verify DSA split
  const dsaPart1 = result.scheduledActivities.find((a) => a.title.includes('Data Structures') && a.title.includes('Part 1'));
  const dsaPart2 = result.scheduledActivities.find((a) => a.title.includes('Data Structures') && a.title.includes('Part 2'));
  if (!dsaPart1 || !dsaPart2) {
    throw new Error('TEST FAILED: 120-minute task was not split into focused sessions!');
  }

  // Verify Personal Growth goal protected
  const goalAct = result.scheduledActivities.find((a) => a.title === 'Open Source Contribution');
  if (!goalAct) {
    throw new Error('TEST FAILED: Personal growth goal with weekly deficit was not scheduled!');
  }

  console.log('✓ Scenario 1 PASSED: Zero overlaps, fixed commitment locked, task split, personal growth protected.');
  return result;
}

function runScenario2(prevResult: any) {
  console.log('\n--- Scenario 2: Reschedule around Ad-Hoc Unavailable Window (16:00 – 18:00) ---');

  const reschedule = AdaptiveScheduler.rescheduleAroundUnavailableBlock(
    prevResult.scheduledActivities,
    '16:00',
    '18:00',
    'Urgent doctor appointment'
  );

  console.log(`Displaced tasks: ${reschedule.displacedTasks.length}`);
  console.log(`Rescheduled tasks: ${reschedule.rescheduledTasks.length}`);

  console.log('\nUpdated Schedule after Unavailability:');
  for (const act of reschedule.updatedSchedule) {
    console.log(`  [${act.startTime} – ${act.endTime}] (${act.category}) ${act.title}`);
  }

  // Invariant check: zero items can overlap 16:00 - 18:00 except if fixed (here no fixed at 16:00)
  for (const act of reschedule.updatedSchedule) {
    if (act.isFixed && act.category === 'FIXED') continue;
    const s = timeToMinutes(act.startTime);
    const e = timeToMinutes(act.endTime);
    if (!(e <= timeToMinutes('16:00') || s >= timeToMinutes('18:00'))) {
      throw new Error(`TEST FAILED: Task ${act.title} [${act.startTime}-${act.endTime}] collides with unavailable window 16:00-18:00!`);
    }
  }

  // Invariant check: zero mutual overlaps
  for (let i = 0; i < reschedule.updatedSchedule.length - 1; i++) {
    const curr = reschedule.updatedSchedule[i];
    const next = reschedule.updatedSchedule[i + 1];
    if (timeToMinutes(curr.endTime) > timeToMinutes(next.startTime)) {
      throw new Error(`TEST FAILED: Overlap detected between ${curr.title} and ${next.title}!`);
    }
  }

  console.log('✓ Scenario 2 PASSED: Successfully rescheduled around unavailable window with zero overlaps.');
}

function runScenario3() {
  console.log('\n--- Scenario 3: Workload Overload Protection (Cap at 6 hours / 360 mins) ---');

  const context: SchedulingContext = {
    date: '2026-11-21',
    wakeUpTime: '07:00',
    fixedCommitments: [],
    pendingTasks: [
      { id: '1', title: 'Task A', category: 'DEADLINE', priority: 'URGENT', estimatedDuration: 90 },
      { id: '2', title: 'Task B', category: 'DEADLINE', priority: 'HIGH', estimatedDuration: 90 },
      { id: '3', title: 'Task C', category: 'DEADLINE', priority: 'HIGH', estimatedDuration: 90 },
      { id: '4', title: 'Task D', category: 'DEADLINE', priority: 'MEDIUM', estimatedDuration: 90 },
      { id: '5', title: 'Task E (Excess)', category: 'DEADLINE', priority: 'LOW', estimatedDuration: 90 },
      { id: '6', title: 'Task F (Excess)', category: 'DEADLINE', priority: 'LOW', estimatedDuration: 90 },
    ],
    personalGoals: [],
  };

  const result = AdaptiveScheduler.scheduleDay(context);
  console.log(`Total Work Slotted: ${result.metrics.totalWorkMinutes} mins (Max limit: 360 mins)`);
  console.log(`Overflow Tasks Count: ${result.overflowTasks.length}`);

  if (result.metrics.totalWorkMinutes > 360) {
    throw new Error(`TEST FAILED: Daily work minutes (${result.metrics.totalWorkMinutes}) exceeded sustainable 360m limit!`);
  }

  if (result.overflowTasks.length === 0) {
    throw new Error('TEST FAILED: Excess tasks were not moved to overflow!');
  }

  console.log('✓ Scenario 3 PASSED: Workload capped sustainably, excess tasks queued to tomorrow without guilt.');
}

try {
  const res1 = runScenario1();
  runScenario2(res1);
  runScenario3();
  console.log('\n========================================');
  console.log('ALL ADAPTIVE SCHEDULER INVARIANT TESTS PASSED SUCCESSFULLY! ✓');
  console.log('========================================\n');
} catch (err: any) {
  console.error('\n❌ SCHEDULER TEST SUITE FAILED:', err.message);
  process.exit(1);
}
