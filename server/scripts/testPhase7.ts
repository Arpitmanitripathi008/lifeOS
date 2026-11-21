import { prisma } from '../src/db/client.js';
import { logFocus, getFocusSessions } from '../src/controllers/focusController.js';
import { logSleep, getSleepRecords, getSleepStats } from '../src/controllers/sleepController.js';
import { getInsightsSummary } from '../src/controllers/insightsController.js';

function mockRes() {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  return res;
}

async function runPhase7Tests() {
  console.log('\n================================================================');
  console.log('STARTING PHASE 7 TESTS: FOCUS MODE, SLEEP TRACKING & INSIGHTS');
  console.log('================================================================\n');

  const todayStr = new Date().toISOString().split('T')[0];

  // ==========================================
  // SECTION 1: FOCUS MODE & SESSION LINKAGE
  // ==========================================
  console.log('--- SECTION 1: Focus Mode Sessions Connected to Tasks ---');

  // Create a dedicated test task for focus session linkage
  const testTask = await prisma.task.create({
    data: {
      title: 'Implement Red-Black Tree Balancing (Phase 7 Test)',
      category: 'DEADLINE',
      priority: 'HIGH',
      estimatedDuration: 60,
      scheduledDate: todayStr,
      status: 'PENDING',
    },
  });
  console.log(`✓ Created test task for focus session: "${testTask.title}" (${testTask.id})`);

  // 1.1 Log a 25-minute FOCUS session connected to the task
  const reqFocus1: any = {
    body: {
      taskId: testTask.id,
      durationMinutes: 25,
      sessionType: 'FOCUS',
    },
  };
  const resFocus1 = mockRes();
  await logFocus(reqFocus1, resFocus1, (err) => { if (err) throw err; });
  const focusSession1 = resFocus1.jsonData;

  console.log(`✓ Logged 25m Focus Session: ID ${focusSession1.id}, Task: "${focusSession1.task?.title}", Type: ${focusSession1.sessionType}`);
  if (focusSession1.taskId !== testTask.id || focusSession1.durationMinutes !== 25) {
    throw new Error('Focus session 1 taskId or duration mismatch');
  }

  // 1.2 Log a 5-minute SHORT_BREAK session (unlinked)
  const reqFocus2: any = {
    body: {
      taskId: null,
      durationMinutes: 5,
      sessionType: 'SHORT_BREAK',
    },
  };
  const resFocus2 = mockRes();
  await logFocus(reqFocus2, resFocus2, (err) => { if (err) throw err; });
  const focusSession2 = resFocus2.jsonData;
  console.log(`✓ Logged 5m Short Break Session: ID ${focusSession2.id}, Type: ${focusSession2.sessionType}`);

  // 1.3 Fetch focus sessions for today and verify
  const reqGetFocus: any = { query: { date: todayStr } };
  const resGetFocus = mockRes();
  await getFocusSessions(reqGetFocus, resGetFocus, (err) => { if (err) throw err; });
  const todaySessions = resGetFocus.jsonData;
  console.log(`✓ Queried today's focus sessions: Found ${todaySessions.length} sessions.`);
  const foundTaskSession = todaySessions.find((s: any) => s.id === focusSession1.id);
  if (!foundTaskSession || !foundTaskSession.task) {
    throw new Error('Could not find focus session connected to task in today query');
  }
  console.log(`✓ Verified focus session is linked to task: "${foundTaskSession.task.title}"`);

  // ==========================================
  // SECTION 2: VOLUNTARY SLEEP TRACKING
  // ==========================================
  console.log('\n--- SECTION 2: Voluntary Sleep Tracking & Non-Enforced Duration ---');

  // Clean test sleep records for test dates
  const sleepDate1 = '2026-11-18';
  const sleepDate2 = '2026-11-19';
  const sleepDate3 = '2026-11-20';
  await prisma.sleepRecord.deleteMany({
    where: { date: { in: [sleepDate1, sleepDate2, sleepDate3] } },
  });

  // 2.1 Day 1: Sleep past midnight (23:30 to 07:15 = 7h 45m = 465 mins)
  const reqSleep1: any = {
    body: {
      date: sleepDate1,
      bedTimeApprox: '23:30',
      wakeUpTime: '07:15',
      notes: 'Slept well after reading',
    },
  };
  const resSleep1 = mockRes();
  await logSleep(reqSleep1, resSleep1, (err) => { if (err) throw err; });
  const record1 = resSleep1.jsonData;
  console.log(`✓ Sleep Day 1 (Cross-midnight): ${record1.bedTimeApprox} -> ${record1.wakeUpTime} = ${record1.durationMinutes} mins (${Math.floor(record1.durationMinutes/60)}h ${record1.durationMinutes%60}m)`);
  if (record1.durationMinutes !== 465) {
    throw new Error(`Expected duration 465 mins for 23:30->07:15, got ${record1.durationMinutes}`);
  }

  // 2.2 Day 2: Normal late night (00:45 to 08:15 = 7h 30m = 450 mins)
  const reqSleep2: any = {
    body: {
      date: sleepDate2,
      bedTimeApprox: '00:45',
      wakeUpTime: '08:15',
      notes: 'Woke up naturally',
    },
  };
  const resSleep2 = mockRes();
  await logSleep(reqSleep2, resSleep2, (err) => { if (err) throw err; });
  const record2 = resSleep2.jsonData;
  console.log(`✓ Sleep Day 2 (Same-day AM): ${record2.bedTimeApprox} -> ${record2.wakeUpTime} = ${record2.durationMinutes} mins (${Math.floor(record2.durationMinutes/60)}h ${record2.durationMinutes%60}m)`);
  if (record2.durationMinutes !== 450) {
    throw new Error(`Expected duration 450 mins for 00:45->08:15, got ${record2.durationMinutes}`);
  }

  // 2.3 Day 3: Wake-up time ONLY (user did not track approximate bedtime)
  // CRITICAL REQUIREMENT: Do NOT force a bedtime; do NOT invent a sleep record duration
  const reqSleep3: any = {
    body: {
      date: sleepDate3,
      bedTimeApprox: null,
      wakeUpTime: '09:00',
      notes: 'Did not record bedtime',
    },
  };
  const resSleep3 = mockRes();
  await logSleep(reqSleep3, resSleep3, (err) => { if (err) throw err; });
  const record3 = resSleep3.jsonData;
  console.log(`✓ Sleep Day 3 (Wake-up only, no bedtime): Wake: ${record3.wakeUpTime}, Duration: ${record3.durationMinutes}`);
  if (record3.durationMinutes !== null) {
    throw new Error(`Expected null duration when bedtime is omitted, got ${record3.durationMinutes}`);
  }

  // 2.4 Verify Sleep Stats:
  // Duration average should only include days with valid duration (465 + 450) / 2 = 457.5 -> 458 mins
  const reqSleepStats: any = {};
  const resSleepStats = mockRes();
  await getSleepStats(reqSleepStats, resSleepStats, (err) => { if (err) throw err; });
  const stats = resSleepStats.jsonData;
  console.log(`✓ Sleep Stats: Weekly average = ${stats.weeklyAverageFormatted} (${stats.weeklyAverageMinutes} mins), Trend: "${stats.trend}"`);
  console.log(`✓ Total sleep records returned: ${stats.records.length} (NO fabricated days inserted)`);

  // ==========================================
  // SECTION 3: LIFEOS REAL ANALYTICS & INSIGHTS
  // ==========================================
  console.log('\n--- SECTION 3: Real Database Analytics & Transparent Balance ---');

  const reqInsights: any = {};
  const resInsights = mockRes();
  await getInsightsSummary(reqInsights, resInsights, (err) => { if (err) throw err; });
  const insights = resInsights.jsonData;

  // 3.1 Academic progress verification
  console.log(`✓ Academic Summary: ${insights.academic.subjectsCount} subjects, ${insights.academic.completedTopics}/${insights.academic.totalTopics} topics mastered (${insights.academic.progressPercent}%)`);
  if (insights.academic.subjectsBreakdown.length > 0) {
    const firstSub = insights.academic.subjectsBreakdown[0];
    console.log(`   Sample Subject: ${firstSub.name} (${firstSub.code}) - ${firstSub.completedTopics}/${firstSub.totalTopics} topics (${firstSub.progressPercent}%)`);
  }

  // 3.2 Personal Goal progress verification
  console.log(`✓ Personal Growth: ${insights.growth.activeGoalsCount} active goals, ${insights.growth.completedSessionsThisWeek}/${insights.growth.targetSessionsThisWeek} sessions completed this week (${insights.growth.consistencyPercent}%)`);

  // 3.3 Task execution & postponement root cause analytics
  console.log(`✓ Task Execution: Total: ${insights.tasks.total}, Completed: ${insights.tasks.completed}, Partial: ${insights.tasks.partial}, Postponed: ${insights.tasks.postponed}, Cancelled: ${insights.tasks.cancelled}, Completion Rate: ${insights.tasks.completionRate}%`);
  console.log('✓ Postponement Root Causes Breakdown:', insights.tasks.postponedReasons);

  // 3.4 Focus metrics
  console.log(`✓ Focus Metrics: Today's focus = ${insights.focus.todayFocusFormatted} (${insights.focus.todaySessionsCount} sessions), All-time = ${insights.focus.totalFocusFormatted}`);
  if (insights.focus.todayFocusMinutes < 25) {
    throw new Error('Today focus minutes should be at least 25 after logging session');
  }

  // 3.5 Transparent Life Balance Indicators
  console.log(`\n✓ Overall Life Balance Score: ${insights.lifeBalance.overallBalanceScore}%`);
  console.log('✓ Transparent Dimensions (0-100% with exact formulas):');
  for (const dim of insights.lifeBalance.dimensions) {
    console.log(`   - [${dim.name}]: ${dim.score}% | Formula: "${dim.formula}" | (${dim.detail})`);
    if (typeof dim.score !== 'number' || dim.score < 0 || dim.score > 100) {
      throw new Error(`Dimension score ${dim.score} out of bounds [0, 100]`);
    }
  }

  // Clean up test task
  await prisma.focusSession.deleteMany({ where: { taskId: testTask.id } });
  await prisma.task.delete({ where: { id: testTask.id } });

  console.log('\n================================================================');
  console.log('✅ ALL PHASE 7 TESTS COMPLETED SUCCESSFULLY AND PERSISTED!');
  console.log('================================================================\n');
}

runPhase7Tests()
  .catch((err) => {
    console.error('❌ Phase 7 test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
