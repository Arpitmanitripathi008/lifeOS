import { prisma } from '../src/db/client.js';
import bcrypt from 'bcryptjs';

async function backfillExistingData() {
  console.log('\n======================================================');
  console.log('STARTING SAFE DATA MIGRATION & BACKFILL FOR MULTI-TENANCY');
  console.log('======================================================\n');

  // 1. Find or create default student user: Alex Rivera
  let defaultUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'alex_rivera' },
        { email: 'alex@lifeos.edu' },
      ],
    },
  });

  if (!defaultUser) {
    const passwordHash = await bcrypt.hash('LifeOS2026!', 10);
    defaultUser = await prisma.user.create({
      data: {
        username: 'alex_rivera',
        fullName: 'Alex Rivera',
        email: 'alex@lifeos.edu',
        passwordHash,
      },
    });
    console.log(`✓ Created default student account: "${defaultUser.fullName}" (@${defaultUser.username}) [ID: ${defaultUser.id}]`);
  } else {
    console.log(`✓ Existing default student account found: "${defaultUser.fullName}" (@${defaultUser.username}) [ID: ${defaultUser.id}]`);
  }

  // 2. Link existing UserProfile
  const existingProfile = await prisma.userProfile.findFirst({
    where: { userId: null },
  });
  if (existingProfile) {
    await prisma.userProfile.update({
      where: { id: existingProfile.id },
      data: { userId: defaultUser.id },
    });
    console.log(`✓ Linked existing UserProfile to @${defaultUser.username}`);
  } else {
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: defaultUser.id },
    });
    if (!userProfile) {
      await prisma.userProfile.create({
        data: {
          userId: defaultUser.id,
          displayName: defaultUser.fullName,
          collegeStartTime: '09:00',
          collegeEndTime: '15:00',
          breakfastTime: '08:00',
          lunchTime: '13:00',
          dinnerTime: '20:00',
          defaultTaskDuration: 45,
        },
      });
      console.log(`✓ Created new default UserProfile for @${defaultUser.username}`);
    }
  }

  // 3. Backfill all unassociated records
  const backfillOps = await Promise.all([
    prisma.fixedCommitment.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
    prisma.task.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
    prisma.subject.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
    prisma.personalGoal.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
    prisma.dailySchedule.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
    prisma.sleepRecord.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
    prisma.focusSession.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
    prisma.dailyReview.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
    prisma.uploadedDocument.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
    prisma.aIProposal.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
  ]);

  console.log(`✓ Backfill complete:`);
  console.log(`   - Fixed Commitments backfilled: ${backfillOps[0].count}`);
  console.log(`   - Tasks backfilled: ${backfillOps[1].count}`);
  console.log(`   - Subjects backfilled: ${backfillOps[2].count}`);
  console.log(`   - Personal Goals backfilled: ${backfillOps[3].count}`);
  console.log(`   - Daily Schedules backfilled: ${backfillOps[4].count}`);
  console.log(`   - Sleep Records backfilled: ${backfillOps[5].count}`);
  console.log(`   - Focus Sessions backfilled: ${backfillOps[6].count}`);
  console.log(`   - Daily Reviews backfilled: ${backfillOps[7].count}`);
  console.log(`   - Uploaded Documents backfilled: ${backfillOps[8].count}`);
  console.log(`   - AI Proposals backfilled: ${backfillOps[9].count}`);

  console.log('\n======================================================');
  console.log('✅ SAFE MIGRATION COMPLETED: ZERO DATA LOSS');
  console.log('======================================================\n');
}

backfillExistingData()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
