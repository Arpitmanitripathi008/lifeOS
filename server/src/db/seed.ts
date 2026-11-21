import { prisma } from './client.js';

async function main() {
  console.log('[Seed] Seeding LifeOS database...');

  // 1. Ensure User Profile
  const profile = await prisma.userProfile.upsert({
    where: { id: 'default-student' },
    update: {},
    create: {
      id: 'default-student',
      displayName: 'Student',
      collegeStartTime: '09:00',
      collegeEndTime: '15:00',
      breakfastTime: '08:00',
      lunchTime: '13:00',
      dinnerTime: '20:00',
      defaultTaskDuration: 45,
    },
  });

  // 2. Fixed Commitments
  const collegeCommitments = [1, 2, 3, 4, 5]; // Mon - Fri
  for (const day of collegeCommitments) {
    const existing = await prisma.fixedCommitment.findFirst({
      where: { title: 'College Classes', dayOfWeek: day },
    });
    if (!existing) {
      await prisma.fixedCommitment.create({
        data: {
          title: 'College Classes',
          category: 'COLLEGE',
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '15:00',
          isRecurring: true,
        },
      });
    }
  }

  // 3. Sample Subject
  let dsaSubject = await prisma.subject.findFirst({
    where: { name: 'Data Structures & Algorithms' },
  });
  if (!dsaSubject) {
    dsaSubject = await prisma.subject.create({
      data: {
        name: 'Data Structures & Algorithms',
        code: 'CS301',
        colorTag: '#68754C',
        units: {
          create: [
            {
              unitNumber: 1,
              title: 'Arrays & Linked Lists',
              topics: {
                create: [
                  { title: 'Dynamic Arrays & Amortized Analysis', estimatedMinutes: 60, isCompleted: true },
                  { title: 'Singly and Doubly Linked Lists', estimatedMinutes: 45, isCompleted: false },
                ],
              },
            },
            {
              unitNumber: 2,
              title: 'Stacks, Queues & Heaps',
              topics: {
                create: [
                  { title: 'Monotonic Stacks & Applications', estimatedMinutes: 60, isCompleted: false },
                  { title: 'Priority Queues & Binary Heaps', estimatedMinutes: 60, isCompleted: false },
                ],
              },
            },
          ],
        },
      },
    });
  }

  // 4. Sample Personal Goal
  let pythonGoal = await prisma.personalGoal.findFirst({
    where: { name: 'Learn Python for AI' },
  });
  if (!pythonGoal) {
    pythonGoal = await prisma.personalGoal.create({
      data: {
        name: 'Learn Python for AI',
        category: 'CODING',
        description: 'Master Python libraries for data processing and AI development',
        minSessionsPerWeek: 2,
        prefSessionsPerWeek: 3,
        maxSessionsPerWeek: 5,
        sessionDurationMins: 45,
        priority: 'HIGH',
      },
    });
  }

  // 5. Sample Task for Today
  const today = new Date().toISOString().split('T')[0];
  const existingTask = await prisma.task.findFirst({
    where: { title: 'DSA: Solve Monotonic Stack Problems', scheduledDate: today },
  });
  if (!existingTask) {
    await prisma.task.create({
      data: {
        title: 'DSA: Solve Monotonic Stack Problems',
        description: 'Complete 3 medium LeetCode stack problems',
        category: 'DEADLINE',
        priority: 'HIGH',
        estimatedDuration: 60,
        scheduledDate: today,
        scheduledStartTime: '16:30',
        scheduledEndTime: '17:30',
        status: 'PENDING',
        subjectId: dsaSubject.id,
      },
    });
  }

  console.log('[Seed] Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
