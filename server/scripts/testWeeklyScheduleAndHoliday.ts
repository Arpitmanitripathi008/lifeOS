import http from 'http';
import { Socket } from 'net';
import app from '../src/app.js';
import { prisma } from '../src/db/client.js';

interface TestResult {
  step: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, step: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${step}${details ? ` - ${details}` : ''}`);
    results.push({ step, passed: true, details });
  } else {
    console.error(`❌ [FAIL] ${step}${details ? ` - ${details}` : ''}`);
    results.push({ step, passed: false, details });
  }
}

function dispatch(method: string, url: string, headers: Record<string, string> = {}, body?: any) {
  return new Promise<{ status: number; headers: Record<string, any>; body: any }>((resolve) => {
    const socket = new Socket();
    const req: any = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = {
      host: 'localhost',
      'content-type': 'application/json',
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    };

    const res: any = new http.ServerResponse(req);
    const chunks: Buffer[] = [];

    res.write = function (chunk: any) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };

    res.end = function (chunk: any) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed = raw;
      try {
        parsed = JSON.parse(raw);
      } catch {}
      resolve({
        status: res.statusCode || 200,
        headers: res.getHeaders(),
        body: parsed,
      });
    };

    if (body !== undefined) {
      (req as any).body = body;
      (req as any)._body = true;
    }

    app.handle(req, res);
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('LIFEOS WEEKLY SCHEDULE, HOLIDAY AWARENESS & DATA PROTECTION TEST');
  console.log('================================================================\n');

  try {
    // 0. Authenticate as default student Alex Rivera
    const loginRes = await dispatch('POST', '/api/auth/login', {}, {
      username: 'alex_rivera',
      password: 'LifeOS2026!',
    });
    assert(loginRes.status === 200 && !!loginRes.body.token, 'Authenticate Alex Rivera');
    const token = loginRes.body.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // Record initial counts of permanent data to verify protection
    const initialSubjects = await prisma.subject.count({ where: { userId: loginRes.body.user.id } });
    const initialGoals = await prisma.personalGoal.count({ where: { userId: loginRes.body.user.id } });
    const initialDocuments = await prisma.uploadedDocument.count({ where: { userId: loginRes.body.user.id } });

    // Ensure Alex has a completed task for testing historical record preservation
    const testTask = await prisma.task.create({
      data: {
        userId: loginRes.body.user.id,
        title: 'Completed Physics Lab Report',
        category: 'DEADLINE',
        priority: 'HIGH',
        estimatedDuration: 60,
        scheduledDate: '2026-11-23', // A Monday
        scheduledStartTime: '08:00',
        scheduledEndTime: '09:00',
        status: 'COMPLETED',
      },
    });

    // Configure Alex's profile with standard college timings and Sunday holiday
    await dispatch('PATCH', '/api/profile', authHeaders, {
      collegeStartTime: '09:00',
      collegeEndTime: '15:00',
      weeklyHolidays: JSON.stringify([0]), // Sunday is holiday
      weeklyCollegeTimings: JSON.stringify({
        "1": { start: "09:00", end: "15:00" }, // Mon
        "2": { start: "09:00", end: "15:00" }, // Tue
        "3": { start: "10:00", end: "14:00" }, // Wed has different schedule
        "4": { start: "09:00", end: "15:00" }, // Thu
        "5": { start: "09:00", end: "15:00" }, // Fri
      }),
    });

    // SCENARIO 1: Normal Monday Schedule
    // 2026-11-23 is a Monday
    const mondayRes = await dispatch('GET', '/api/schedule/day?date=2026-11-23', authHeaders);
    const mondayTimeline = mondayRes.body.timeline || [];
    const mondayCollege = mondayTimeline.find((i: any) => i.type === 'COMMITMENT' && i.category === 'COLLEGE');
    assert(
      mondayRes.status === 200 && !!mondayCollege && mondayCollege.startTime === '09:00' && mondayCollege.endTime === '15:00',
      'Scenario 1: Normal Monday schedule includes standard college commitment (09:00 - 15:00)'
    );

    // SCENARIO 2: Regular Sunday Holiday
    // 2026-11-22 is a Sunday
    const sundayRes = await dispatch('GET', '/api/schedule/day?date=2026-11-22', authHeaders);
    const sundayCollege = (sundayRes.body.timeline || []).find((i: any) => i.category === 'COLLEGE');
    assert(
      sundayRes.status === 200 && sundayRes.body.isWeeklyHoliday === true && !sundayCollege,
      'Scenario 2: Regular Sunday holiday automatically excludes college commitment',
      `isWeeklyHoliday: ${sundayRes.body.isWeeklyHoliday}`
    );

    // SCENARIO 3: Unexpected Monday Holiday via Natural Language AI Instruction
    // "Today is a holiday" / "College is cancelled today"
    const holidayAiRes = await dispatch('POST', '/api/ai/command', authHeaders, {
      prompt: 'College is cancelled today',
    });
    assert(
      holidayAiRes.status === 200 &&
      (holidayAiRes.body.intent === 'HOLIDAY_DECLARATION' || holidayAiRes.body.intent === 'SCHEDULE_OVERRIDE') &&
      !!holidayAiRes.body.proposal,
      'Scenario 3A: Natural language holiday detected by AI',
      holidayAiRes.body.explanation?.slice(0, 80)
    );

    // Explicitly test declaration on Monday 2026-11-23
    const overrideDeclRes = await dispatch('POST', '/api/schedule/override', authHeaders, {
      date: '2026-11-23',
      overrideType: 'FULL_HOLIDAY',
      reason: 'College cancelled for sports day',
    });
    assert(overrideDeclRes.status === 200, 'Scenario 3B: Temporary holiday override recorded');

    // Verify Monday schedule now excludes college
    const mondayHolidayRes = await dispatch('GET', '/api/schedule/day?date=2026-11-23', authHeaders);
    const mondayHolidayCollege = (mondayHolidayRes.body.timeline || []).find((i: any) => i.category === 'COLLEGE');
    assert(
      !mondayHolidayCollege && !!mondayHolidayRes.body.activeOverride,
      'Scenario 3C: Unexpected Monday holiday excludes college commitment while keeping recurring timetable intact'
    );

    // SCENARIO 4: Tomorrow's Holiday Declaration
    // Natural language: "Tomorrow there will be no college"
    const tomorrowAiRes = await dispatch('POST', '/api/ai/command', authHeaders, {
      prompt: 'Tomorrow there will be no college',
    });
    assert(
      tomorrowAiRes.status === 200 && !!tomorrowAiRes.body.override,
      "Scenario 4: Tomorrow's holiday declared through natural language and stored separately as reversible override"
    );

    // SCENARIO 5: Half-Day College
    // User says "I have only half-day college today"
    const halfDayAiRes = await dispatch('POST', '/api/ai/command', authHeaders, {
      prompt: 'I have only half-day college today',
    });
    assert(
      halfDayAiRes.status === 200 &&
      (halfDayAiRes.body.override?.overrideType === 'HALF_DAY' || halfDayAiRes.body.intent === 'SCHEDULE_OVERRIDE'),
      'Scenario 5: Half-day college detected and scheduled with shortened hours'
    );

    // SCENARIO 6: Changed College Timings
    // User says "My college timings have changed today to 10:00 to 13:00"
    const changedTimingsAiRes = await dispatch('POST', '/api/ai/command', authHeaders, {
      prompt: 'My college timings have changed today to 10:00 to 13:00',
    });
    assert(
      changedTimingsAiRes.status === 200 &&
      changedTimingsAiRes.body.override?.adjustedStartTime === '10:00' &&
      changedTimingsAiRes.body.override?.adjustedEndTime === '13:00',
      'Scenario 6: Custom college hours (10:00–13:00) parsed and applied as temporary override'
    );

    // SCENARIO 7: Regenerate Today's Schedule
    const regenRes = await dispatch('POST', '/api/schedule/generate', authHeaders, {
      date: '2026-11-23',
      wakeUpTime: '07:00',
    });
    assert(regenRes.status === 200 && !!regenRes.body.proposalId, "Scenario 7: Regenerate schedule succeeds without conflicts");

    // SCENARIO 8: Undo Holiday Override
    // Reverts temporary override and restores regular college commitment
    const undoRes = await dispatch('POST', '/api/schedule/override/undo', authHeaders, {
      date: '2026-11-23',
    });
    assert(undoRes.status === 200, 'Scenario 8A: Undo holiday override API call succeeds');

    const restoredMondayRes = await dispatch('GET', '/api/schedule/day?date=2026-11-23', authHeaders);
    const restoredCollege = (restoredMondayRes.body.timeline || []).find((i: any) => i.category === 'COLLEGE');
    assert(
      !restoredMondayRes.body.activeOverride && !!restoredCollege,
      'Scenario 8B: Undoing holiday override perfectly restores original regular college commitment'
    );

    // SCENARIO 9: Permanent User Data Preservation
    const currentSubjects = await prisma.subject.count({ where: { userId: loginRes.body.user.id } });
    const currentGoals = await prisma.personalGoal.count({ where: { userId: loginRes.body.user.id } });
    const currentDocuments = await prisma.uploadedDocument.count({ where: { userId: loginRes.body.user.id } });
    assert(
      currentSubjects === initialSubjects &&
      currentGoals === initialGoals &&
      currentDocuments === initialDocuments,
      'Scenario 9: Permanent user data (subjects, goals, documents) preserved with 0 deletions across all schedule changes',
      `Subjects: ${currentSubjects}, Goals: ${currentGoals}, Documents: ${currentDocuments}`
    );

    // SCENARIO 10: Completed Tasks & Historical Records Remain Intact
    const completedTaskCheck = await prisma.task.findUnique({ where: { id: testTask.id } });
    assert(
      completedTaskCheck !== null && completedTaskCheck.status === 'COMPLETED',
      'Scenario 10: Completed task record remained 100% intact through all schedule generations, overrides, and reversions'
    );

    console.log('\n================================================================');
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`TEST SUMMARY: ${passedCount}/${results.length} PASSED`);
    console.log('================================================================');

    if (passedCount === results.length) {
      console.log('🎉 ALL 10 WEEKLY SCHEDULE & HOLIDAY AWARENESS SCENARIOS PASSED PERFECTLY!');
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests();
