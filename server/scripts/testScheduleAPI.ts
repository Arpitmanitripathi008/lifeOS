import { prisma } from '../src/db/client.js';
import { generateSchedule, modifySchedule, getDaySchedule } from '../src/controllers/scheduleController.js';
import { acceptProposal } from '../src/controllers/proposalController.js';

async function testDatabaseScheduleFlow() {
  console.log('\n--- Testing End-to-End Schedule Generation & Persistence in dev.db ---');

  const testDate = '2026-11-25';

  // 1. Create a sample fixed commitment for testDate
  await prisma.fixedCommitment.deleteMany({ where: { specificDate: testDate } });
  await prisma.task.deleteMany({ where: { scheduledDate: testDate } });
  await prisma.aIProposal.deleteMany({ where: { targetDate: testDate } });

  const commitment = await prisma.fixedCommitment.create({
    data: {
      title: 'Database Systems Lecture & Lab',
      category: 'COLLEGE',
      startTime: '10:00',
      endTime: '13:00',
      isRecurring: false,
      specificDate: testDate,
    },
  });
  console.log(`Created test commitment: ${commitment.title} (${commitment.startTime}–${commitment.endTime})`);

  // 2. Create sample pending tasks
  const task1 = await prisma.task.create({
    data: {
      title: 'DBMS ER-Diagram Assignment',
      category: 'DEADLINE',
      priority: 'URGENT',
      estimatedDuration: 60,
      scheduledDate: testDate,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: 'Competitive Programming Practice',
      category: 'PERSONAL_GROWTH',
      priority: 'HIGH',
      estimatedDuration: 45,
      scheduledDate: testDate,
    },
  });

  console.log(`Created test tasks: "${task1.title}" (60m, URGENT) and "${task2.title}" (45m, HIGH)`);

  // 3. Test generateSchedule
  let generatedProposal: any = null;
  const mockReqGen: any = {
    body: {
      date: testDate,
      wakeUpTime: '08:30',
      unavailableWindows: [],
    },
  };
  const mockResGen: any = {
    json: (data: any) => {
      generatedProposal = data.proposal;
      console.log(`\nGenerated proposal successfully: ${data.proposalId}`);
      console.log(`AI Explanation: ${data.schedulingResult.aiExplanation}`);
      console.log(`Total Work Mins: ${data.schedulingResult.metrics.totalWorkMinutes}`);
      console.log(`Conflict Count: ${data.schedulingResult.metrics.conflictCount}`);
      
      const acts = data.schedulingResult.scheduledActivities;
      for (let i = 0; i < acts.length - 1; i++) {
        const c = acts[i];
        const n = acts[i + 1];
        if (c.endTime > n.startTime) {
          console.log(`CONFLICT DETECTED: [${c.startTime}–${c.endTime}] ${c.title} (${c.category}) overlaps with [${n.startTime}–${n.endTime}] ${n.title} (${n.category})`);
        }
      }
    },
  };

  await generateSchedule(mockReqGen, mockResGen, (err) => {
    if (err) throw err;
  });

  if (!generatedProposal) {
    throw new Error('TEST FAILED: Proposal was not generated!');
  }

  // 4. Test acceptProposal (committing the proposed schedule to SQLite)
  const mockReqAccept: any = {
    params: { id: generatedProposal.id },
  };
  let acceptResult: any = null;
  const mockResAccept: any = {
    json: (data: any) => {
      acceptResult = data;
      console.log(`\nAccepted proposal: ${data.message}`);
    },
  };

  await acceptProposal(mockReqAccept, mockResAccept, (err) => {
    if (err) throw err;
  });

  // 5. Verify database records are updated
  const updatedTasks = await prisma.task.findMany({
    where: { scheduledDate: testDate },
    orderBy: { scheduledStartTime: 'asc' },
  });

  console.log('\nCommitted Tasks in Database:');
  for (const t of updatedTasks) {
    console.log(`  • "${t.title}" scheduled at [${t.scheduledStartTime} – ${t.scheduledEndTime}] (Priority: ${t.priority})`);
    if (!t.scheduledStartTime || !t.scheduledEndTime) {
      throw new Error(`Task ${t.title} does not have start/end time set!`);
    }
  }

  // Verify daily schedule record
  const dailySched = await prisma.dailySchedule.findUnique({
    where: { date: testDate },
  });
  console.log(`\nDailySchedule Table Entry: WakeUp = ${dailySched?.wakeUpTime}, Finalized = ${dailySched?.isFinalized}`);
  if (!dailySched?.isFinalized) {
    throw new Error('Daily schedule isFinalized should be true!');
  }

  // Clean up test records
  await prisma.fixedCommitment.deleteMany({ where: { specificDate: testDate } });
  await prisma.task.deleteMany({ where: { scheduledDate: testDate } });
  await prisma.aIProposal.deleteMany({ where: { targetDate: testDate } });
  await prisma.dailySchedule.deleteMany({ where: { date: testDate } });

  console.log('\n✓ END-TO-END DATABASE PERSISTENCE & SCHEDULING FLOW VERIFIED SUCCESSFULLY!');
}

testDatabaseScheduleFlow()
  .catch((e) => {
    console.error('Test error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
