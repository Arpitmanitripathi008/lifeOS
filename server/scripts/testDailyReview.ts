import { prisma } from '../src/db/client.js';
import { submitReview } from '../src/controllers/reviewController.js';
import { acceptProposal } from '../src/controllers/proposalController.js';

async function runDailyReviewTests() {
  console.log('\n======================================================');
  console.log('STARTING PHASE 6 DAILY REVIEW & SMART CARRY-FORWARD TESTS');
  console.log('======================================================\n');

  const testDate = '2026-11-20';

  // Clean up any test records for testDate
  await prisma.task.deleteMany({ where: { scheduledDate: testDate } });
  await prisma.dailyReview.deleteMany({ where: { date: testDate } });
  await prisma.aIProposal.deleteMany({ where: { targetDate: { startsWith: '2026-11' } } });

  // 1. Setup prerequisite Subject, Unit, UnitTopic, and PersonalGoal
  let testSubject = await prisma.subject.findFirst({ where: { name: 'Algorithms' } });
  if (!testSubject) {
    testSubject = await prisma.subject.create({
      data: { name: 'Algorithms', code: 'CS201', colorTag: '#68754C' },
    });
  }

  let testUnit = await prisma.unit.findFirst({ where: { subjectId: testSubject.id } });
  if (!testUnit) {
    testUnit = await prisma.unit.create({
      data: { subjectId: testSubject.id, unitNumber: 1, title: 'Sorting & Divide and Conquer' },
    });
  }

  let testTopic = await prisma.unitTopic.findFirst({ where: { unitId: testUnit.id } });
  if (!testTopic) {
    testTopic = await prisma.unitTopic.create({
      data: { unitId: testUnit.id, title: 'MergeSort Analysis', estimatedMinutes: 45, isCompleted: false },
    });
  } else {
    await prisma.unitTopic.update({ where: { id: testTopic.id }, data: { isCompleted: false } });
  }

  let testGoal = await prisma.personalGoal.findFirst({ where: { name: 'Open Source' } });
  if (!testGoal) {
    testGoal = await prisma.personalGoal.create({
      data: { name: 'Open Source', category: 'CODING', prefSessionsPerWeek: 3, sessionDurationMins: 45 },
    });
  }

  console.log('✓ Setup test subject, topic, and personal goal.');

  // 2. Create 4 distinct tasks for today to test EVERY status separately
  // Task 1: Will be marked COMPLETED (linked to topic & goal)
  const taskCompleted = await prisma.task.create({
    data: {
      title: 'Study MergeSort Analysis',
      category: 'DEADLINE',
      priority: 'HIGH',
      estimatedDuration: 45,
      scheduledDate: testDate,
      subjectId: testSubject.id,
      unitTopicId: testTopic.id,
      personalGoalId: testGoal.id,
      status: 'PENDING',
    },
  });

  // Task 2: Will be marked PARTIALLY_COMPLETED
  const taskPartial = await prisma.task.create({
    data: {
      title: 'Write Compiler Frontend AST Parser',
      category: 'DEADLINE',
      priority: 'HIGH',
      estimatedDuration: 90,
      scheduledDate: testDate,
      status: 'PENDING',
    },
  });

  // Task 3: Will be marked POSTPONED (simulating repeated postponement: timesPostponed = 1 -> 2)
  const taskPostponed = await prisma.task.create({
    data: {
      title: 'Review Discrete Probability Lecture Notes',
      category: 'FLEXIBLE',
      priority: 'MEDIUM',
      estimatedDuration: 45,
      scheduledDate: testDate,
      timesPostponed: 1, // Already postponed once
      status: 'PENDING',
    },
  });

  // Task 4: Will be marked CANCELLED
  const taskCancelled = await prisma.task.create({
    data: {
      title: 'Optional Club Poster Design',
      category: 'FLEXIBLE',
      priority: 'LOW',
      estimatedDuration: 30,
      scheduledDate: testDate,
      status: 'PENDING',
    },
  });

  console.log('✓ Created 4 tasks for today to test all 4 statuses separately.');

  // 3. Submit Daily Review with all 4 statuses
  console.log('\n--- Test 1: Submitting Daily Review with 4 Statuses ---');
  const mockReqReview: any = {
    body: {
      date: testDate,
      summaryNotes: 'Productive morning, but ran out of steam in the late afternoon.',
      taskUpdates: [
        {
          id: taskCompleted.id,
          status: 'COMPLETED',
        },
        {
          id: taskPartial.id,
          status: 'PARTIALLY_COMPLETED',
          remainingDuration: 40, // 40 mins remaining out of 90
        },
        {
          id: taskPostponed.id,
          status: 'POSTPONED',
          postponedReason: 'Task was more difficult than expected',
        },
        {
          id: taskCancelled.id,
          status: 'CANCELLED',
          postponedReason: 'Decided not to participate in poster design',
        },
      ],
    },
  };

  let reviewResponse: any = null;
  const mockResReview: any = {
    json: (data: any) => {
      reviewResponse = data;
      console.log('Review Response received:');
      console.log(`  Completed: ${data.metrics.completedCount}`);
      console.log(`  Partially Completed: ${data.metrics.partialCount}`);
      console.log(`  Postponed: ${data.metrics.postponedCount}`);
      console.log(`  Cancelled: ${data.metrics.cancelledCount}`);
      console.log(`  Follow-Through Score: ${data.metrics.followThroughScore}%`);
      console.log(`  Incomplete tasks queued for carry-forward: ${data.incompleteCount}`);
      console.log(`  Repeatedly postponed tasks flagged: ${data.repeatedlyPostponedCount}`);
    },
  };

  await submitReview(mockReqReview, mockResReview, (err) => {
    if (err) throw err;
  });

  if (!reviewResponse || !reviewResponse.success) {
    throw new Error('TEST FAILED: Review submission failed!');
  }

  // 4. Verify Database Updates for all 4 statuses
  console.log('\n--- Test 2: Verifying Status Effects in Database ---');

  // Verify Task 1 (COMPLETED): Academic topic & Goal session updated
  const updatedTask1 = await prisma.task.findUnique({ where: { id: taskCompleted.id } });
  if (updatedTask1?.status !== 'COMPLETED') throw new Error('Task 1 status not COMPLETED');

  const updatedTopic = await prisma.unitTopic.findUnique({ where: { id: testTopic.id } });
  if (!updatedTopic?.isCompleted) {
    throw new Error('Academic UnitTopic isCompleted should be true after review!');
  }
  console.log('✓ Status 1 (COMPLETED) verified: Task completed, Academic UnitTopic marked completed.');

  const createdGoalSession = await prisma.goalSession.findFirst({
    where: { taskId: taskCompleted.id },
  });
  if (!createdGoalSession || !createdGoalSession.isCompleted) {
    throw new Error('GoalSession was not recorded for completed personal goal task!');
  }
  console.log('✓ Status 1 (COMPLETED) verified: GoalSession logged for personal growth.');

  // Verify Task 2 (PARTIALLY_COMPLETED): Remaining duration saved
  const updatedTask2 = await prisma.task.findUnique({ where: { id: taskPartial.id } });
  if (updatedTask2?.status !== 'PARTIALLY_COMPLETED' || updatedTask2.remainingDuration !== 40) {
    throw new Error(`Task 2 remainingDuration should be 40, got ${updatedTask2?.remainingDuration}`);
  }
  console.log(`✓ Status 2 (PARTIALLY_COMPLETED) verified: Saved remaining work (${updatedTask2.remainingDuration}m).`);

  // Verify Task 3 (POSTPONED): Reason recorded & timesPostponed incremented (1 -> 2)
  const updatedTask3 = await prisma.task.findUnique({ where: { id: taskPostponed.id } });
  if (updatedTask3?.status !== 'POSTPONED' || updatedTask3.timesPostponed !== 2) {
    throw new Error(`Task 3 timesPostponed should be 2, got ${updatedTask3?.timesPostponed}`);
  }
  if (!updatedTask3.postponedReason?.includes('more difficult')) {
    throw new Error('Task 3 postponedReason was not recorded properly!');
  }
  console.log(`✓ Status 3 (POSTPONED) verified: Postponed reason saved, timesPostponed incremented to ${updatedTask3.timesPostponed}.`);

  // Verify Task 4 (CANCELLED): Cancelled reason saved
  const updatedTask4 = await prisma.task.findUnique({ where: { id: taskCancelled.id } });
  if (updatedTask4?.status !== 'CANCELLED') {
    throw new Error('Task 4 status should be CANCELLED');
  }
  console.log('✓ Status 4 (CANCELLED) verified: Task marked cancelled.');

  // 5. Verify Smart Carry-Forward Proposal Generation
  console.log('\n--- Test 3: Verifying Smart Carry-Forward Proposal ---');
  const proposal = reviewResponse.proposal;
  if (!proposal) {
    throw new Error('TEST FAILED: No carry-forward proposal was generated for unfinished work!');
  }

  const proposalData = JSON.parse(proposal.proposalData);
  console.log(`Proposal Type: ${proposal.proposalType}`);
  console.log(`Analysis: ${proposalData.analysis}`);
  console.log(`Target Date: ${proposal.targetDate}`);
  console.log(`Recommendations Count: ${proposalData.recommendations?.length || 0}`);

  for (const rec of proposalData.recommendations || []) {
    console.log(`  • Task "${rec.taskTitle}" -> ${rec.recommendedAction} (Target: ${rec.targetDate}) [${rec.reason}]`);
  }

  // Ensure CANCELLED task was strictly excluded from carry-forward recommendations
  const cancelledRec = proposalData.recommendations?.find((r: any) => r.taskId === taskCancelled.id);
  if (cancelledRec) {
    throw new Error('TEST FAILED: Cancelled task was illegally included in carry-forward proposal!');
  }
  console.log('✓ Invariant verified: Cancelled task was NOT rescheduled or carried forward.');

  // 6. Test User Approval Gate
  console.log('\n--- Test 4: Accepting Carry-Forward Proposal & Verifying Planner Update ---');
  const mockReqAccept: any = { params: { id: proposal.id } };
  let acceptResult: any = null;
  const mockResAccept: any = {
    json: (d: any) => {
      acceptResult = d;
      console.log(`Proposal accepted message: ${d.message}`);
    },
  };

  await acceptProposal(mockReqAccept, mockResAccept, (err) => {
    if (err) throw err;
  });

  // Verify task 2 (partial) and task 3 (postponed) are now rescheduled into the future
  const carriedTask2 = await prisma.task.findUnique({ where: { id: taskPartial.id } });
  const carriedTask3 = await prisma.task.findUnique({ where: { id: taskPostponed.id } });

  console.log(`Carried Task 2 ("${carriedTask2?.title}") -> Scheduled for: ${carriedTask2?.scheduledDate}, Status: ${carriedTask2?.status}`);
  console.log(`Carried Task 3 ("${carriedTask3?.title}") -> Scheduled for: ${carriedTask3?.scheduledDate}, Status: ${carriedTask3?.status}`);

  if (carriedTask2?.scheduledDate === testDate || carriedTask3?.scheduledDate === testDate) {
    throw new Error('TEST FAILED: Carried forward tasks were not moved to future dates!');
  }

  // Verify task 4 (cancelled) remained CANCELLED on original date
  const finalTask4 = await prisma.task.findUnique({ where: { id: taskCancelled.id } });
  if (finalTask4?.status !== 'CANCELLED' || finalTask4.scheduledDate !== testDate) {
    throw new Error('TEST FAILED: Cancelled task was modified during carry-forward acceptance!');
  }
  console.log(`Final Task 4 ("${finalTask4.title}") -> Remains CANCELLED on ${finalTask4.scheduledDate} (Unmoved).`);

  // Clean up test tasks & proposal
  await prisma.task.deleteMany({
    where: {
      id: { in: [taskCompleted.id, taskPartial.id, taskPostponed.id, taskCancelled.id] },
    },
  });
  await prisma.aIProposal.deleteMany({ where: { id: proposal.id } });
  await prisma.dailyReview.deleteMany({ where: { date: testDate } });

  console.log('\n======================================================');
  console.log('ALL PHASE 6 DAILY REVIEW & CARRY-FORWARD TESTS PASSED! ✓');
  console.log('======================================================\n');
}

runDailyReviewTests()
  .catch((e) => {
    console.error('\n❌ DAILY REVIEW TESTS FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
