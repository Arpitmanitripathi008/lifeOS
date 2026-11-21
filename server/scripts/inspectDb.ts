import { prisma } from '../src/db/client.js';

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, fullName: true, createdAt: true },
  });
  console.log('USERS COUNT:', users.length);
  for (const u of users) {
    const subjects = await prisma.subject.count({ where: { userId: u.id } });
    const tasks = await prisma.task.count({ where: { userId: u.id } });
    const goals = await prisma.personalGoal.count({ where: { userId: u.id } });
    const docs = await prisma.uploadedDocument.count({ where: { userId: u.id } });
    const schedules = await prisma.dailySchedule.count({ where: { userId: u.id } });
    const sleep = await prisma.sleepRecord.count({ where: { userId: u.id } });
    const focus = await prisma.focusSession.count({ where: { userId: u.id } });
    const reviews = await prisma.dailyReview.count({ where: { userId: u.id } });
    const overrides = await prisma.scheduleOverride.count({ where: { userId: u.id } });
    console.log(u.username, { id: u.id, subjects, tasks, goals, docs, schedules, sleep, focus, reviews, overrides });
  }

  // Sample tasks and subjects
  const sampleSubjects = await prisma.subject.findMany({ take: 10, select: { id: true, name: true, userId: true, createdAt: true } });
  console.log('Sample subjects:', JSON.stringify(sampleSubjects, null, 2));
  const sampleTasks = await prisma.task.findMany({ take: 10, select: { id: true, title: true, source: true, userId: true, createdAt: true } });
  console.log('Sample tasks:', JSON.stringify(sampleTasks, null, 2));
  const sampleGoals = await prisma.personalGoal.findMany({ take: 10, select: { id: true, name: true, userId: true } });
  console.log('Sample goals:', JSON.stringify(sampleGoals, null, 2));
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
