import { app } from '../src/app.js';
import { prisma } from '../src/db/client.js';
import http from 'http';

// In-process HTTP dispatcher to simulate authenticated client requests safely
function dispatch(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = new (http.IncomingMessage as any)({
      encrypted: false,
      readable: true,
      remoteAddress: '127.0.0.1',
      address: () => ({ address: '127.0.0.1', port: 80 }),
      on: () => {},
      end: () => {},
      destroy: () => {},
      resume: () => {},
      pause: () => {},
    });

    req.method = method;
    req.url = url;
    req.headers = {
      'content-type': 'application/json',
      host: 'localhost',
      ...headers,
    };

    let bodyBuffer = Buffer.from('');
    if (body) {
      const jsonStr = typeof body === 'string' ? body : JSON.stringify(body);
      bodyBuffer = Buffer.from(jsonStr);
      req.headers['content-length'] = bodyBuffer.length.toString();
    }

    const res: any = new http.ServerResponse(req);
    let responseData = '';

    res.write = function (chunk: any) {
      if (chunk) {
        responseData += chunk.toString();
      }
      return true;
    };

    res.end = function (chunk: any) {
      if (chunk) {
        responseData += chunk.toString();
      }
      let parsedBody = responseData;
      try {
        parsedBody = JSON.parse(responseData);
      } catch {}
      resolve({
        status: res.statusCode,
        body: parsedBody,
      });
    };

    app.handle(req, res, (err: any) => {
      if (err) reject(err);
    });

    if (bodyBuffer.length > 0) {
      req.emit('data', bodyBuffer);
    }
    req.emit('end');
  });
}

async function runDataResetTests() {
  console.log('\n================================================================');
  console.log('LIFEOS DATA MANAGEMENT: AI MOCK DATA RESET & WORKSPACE RESET');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // SETUP: Ensure Alex Rivera and User 2 (Sarah Connor) exist
    // -------------------------------------------------------------
    let alex = await prisma.user.findFirst({
      where: { username: 'alex_rivera' },
    });
    if (!alex) {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.default.hash('password123', 10);
      alex = await prisma.user.create({
        data: {
          username: 'alex_rivera',
          email: 'alex@lifeos.edu',
          passwordHash: hash,
          fullName: 'Alex Rivera',
          profile: {
            create: {
              collegeStartTime: '09:00',
              collegeEndTime: '15:00',
              breakfastTime: '08:00',
              lunchTime: '13:00',
              dinnerTime: '20:00',
            },
          },
        },
      });
    }

    // Login Alex Rivera to get JWT
    const alexLoginRes = await dispatch('POST', '/api/auth/login', {}, {
      username: 'alex_rivera',
      password: 'LifeOS2026!',
    });
    assert(alexLoginRes.status === 200, 'Authenticated Alex Rivera successfully');
    const alexToken = alexLoginRes.body.token;
    const alexAuth = { authorization: `Bearer ${alexToken}` };

    // Ensure mock demo records exist for Alex so the test is repeatable
    const demoSubjCount = await prisma.subject.count({
      where: { userId: alex.id, name: 'Operating Systems' },
    });
    if (demoSubjCount === 0) {
      const osSubj = await prisma.subject.create({
        data: {
          userId: alex.id,
          name: 'Operating Systems',
          code: 'CS-301',
          colorTag: '#68754C',
          isDemo: true,
        },
      });
      await prisma.subject.create({
        data: {
          userId: alex.id,
          name: 'Computer Networks',
          code: 'CS-302',
          colorTag: '#BE674D',
          isDemo: true,
        },
      });
      await prisma.task.create({
        data: {
          userId: alex.id,
          title: 'Operating Systems Lab Report (Sample Task)',
          subjectId: osSubj.id,
          estimatedDuration: 45,
          priority: 'MEDIUM',
          isDemo: true,
        },
      });
      await prisma.personalGoal.create({
        data: {
          userId: alex.id,
          name: 'Learn Python for AI',
          category: 'CODING',
          isDemo: true,
        },
      });
    }

    // Create User 2: Sarah Connor (Multi-Tenant Isolation check)
    const sarahUsername = `sarah_${Date.now() % 100000}`;
    const sarahRegisterRes = await dispatch('POST', '/api/auth/register', {}, {
      fullName: 'Sarah Connor',
      username: sarahUsername,
      email: `${sarahUsername}@cyberdyne.io`,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    assert(sarahRegisterRes.status === 201, 'Created secondary user Sarah Connor for multi-tenancy verification');
    const sarahToken = sarahRegisterRes.body.token;
    const sarahAuth = { authorization: `Bearer ${sarahToken}` };
    const sarahUserId = sarahRegisterRes.body.user.id;

    // Create Sarah's personal data
    const sarahSubjectRes = await dispatch('POST', '/api/academics/subjects', sarahAuth, {
      name: 'Cybersecurity & Defensive AI',
      code: 'SEC-900',
      colorTag: '#BE674D',
    });
    assert(sarahSubjectRes.status === 201, 'Created Sarah\'s private academic subject');

    const sarahTaskRes = await dispatch('POST', '/api/tasks', sarahAuth, {
      title: 'Analyze Sentinel Log Data',
      estimatedDuration: 60,
      priority: 'HIGH',
      subjectId: sarahSubjectRes.body.id,
    });
    assert(sarahTaskRes.status === 201, 'Created Sarah\'s private task');

    // -------------------------------------------------------------
    // SCENARIO 1: Natural Language Ambiguous Reset Handling
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1: Ambiguous Reset Request ---');
    const ambiguousCmdRes = await dispatch('POST', '/api/ai/command', alexAuth, {
      prompt: 'Reset data',
    });
    assert(ambiguousCmdRes.status === 200, 'Ambiguous command handled safely');
    assert(
      ambiguousCmdRes.body.intent === 'DATA_RESET_REQUEST' && ambiguousCmdRes.body.isAmbiguousReset === true,
      'AI recognizes ambiguous data request and prompts user to choose Mode A or Mode B'
    );
    assert(
      ambiguousCmdRes.body.explanation.includes('Mode A') && ambiguousCmdRes.body.explanation.includes('Mode B'),
      'AI explains both reset modes and asks for clarification without deleting anything'
    );

    // -------------------------------------------------------------
    // SCENARIO 2: Natural Language Mode A Detection & Safety Preview
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Mode A (Clear Mock Data) Natural Language & Safety Preview ---');
    const mockCmdRes = await dispatch('POST', '/api/ai/command', alexAuth, {
      prompt: 'Erase all previous mock data and sample records',
    });
    assert(mockCmdRes.status === 200, 'Natural language mock data cleanup command processed');
    assert(mockCmdRes.body.intent === 'CLEAR_MOCK_DATA', 'Gemini / heuristic recognizes CLEAR_MOCK_DATA intent');
    assert(mockCmdRes.body.proposal !== null, 'AI created a pending safety proposal of type DATA_RESET');
    assert(mockCmdRes.body.proposal.status === 'PENDING', 'Proposal is PENDING — destructive action NOT executed prematurely');
    assert(mockCmdRes.body.preview !== null, 'Safety preview generated with itemized record counts');
    assert(mockCmdRes.body.preview.toDelete.totalItems > 0, `Preview shows ${mockCmdRes.body.preview.toDelete.totalItems} mock items queued for deletion`);
    assert(mockCmdRes.body.preview.toPreserve.userAccount.includes('Alex Rivera'), 'Preview explicitly guarantees user account preservation');

    // -------------------------------------------------------------
    // SCENARIO 3: Add Real User Data Alongside Mock Data
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Create Real User Records (Quantum Computing) ---');
    const realSubjRes = await dispatch('POST', '/api/academics/subjects', alexAuth, {
      name: 'Quantum Computing Real Subject',
      code: 'QC-401',
      colorTag: '#68754C',
    });
    assert(realSubjRes.status === 201, 'Created real user subject: Quantum Computing Real Subject (isDemo: false)');

    const realTaskRes = await dispatch('POST', '/api/tasks', alexAuth, {
      title: 'Read Quantum Teleportation Paper (Real Task)',
      estimatedDuration: 45,
      priority: 'HIGH',
      subjectId: realSubjRes.body.id,
    });
    assert(realTaskRes.status === 201, 'Created real user task: Read Quantum Teleportation Paper (isDemo: false)');

    const realGoalRes = await dispatch('POST', '/api/goals', alexAuth, {
      name: 'Marathon 10K Training (Real Goal)',
      category: 'FITNESS',
      prefSessionsPerWeek: 3,
      sessionDurationMins: 45,
    });
    assert(realGoalRes.status === 201, 'Created real user goal: Marathon 10K Training (isDemo: false)');

    // -------------------------------------------------------------
    // SCENARIO 4: Execute Mode A (Clear Mock Data) via Confirmation
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Execute Mode A (Clear Mock Data) via Confirmation ---');
    const proposalId = mockCmdRes.body.proposal.id;
    const acceptProposalRes = await dispatch('PATCH', `/api/proposals/${proposalId}/accept`, alexAuth);
    assert(acceptProposalRes.status === 200, 'Accepted DATA_RESET proposal successfully');
    assert(acceptProposalRes.body.resetResult?.success === true, 'Reset transaction executed successfully');
    assert(acceptProposalRes.body.resetResult?.deletedCounts.totalDeleted > 0, `Deleted ${acceptProposalRes.body.resetResult?.deletedCounts.totalDeleted} mock records`);

    // -------------------------------------------------------------
    // SCENARIO 5: Real User Data Survives Mock Cleanup
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: Verify Real Data Survives Mock Cleanup ---');
    const verifySubjsRes = await dispatch('GET', '/api/academics/subjects', alexAuth);
    const remainingSubjNames = verifySubjsRes.body.map((s: any) => s.name);
    assert(
      remainingSubjNames.includes('Quantum Computing Real Subject'),
      'Real user subject "Quantum Computing Real Subject" survived mock cleanup 100%'
    );
    assert(
      !remainingSubjNames.includes('Operating Systems') && !remainingSubjNames.includes('Computer Networks'),
      'Sample subjects ("Operating Systems", "Computer Networks") were permanently deleted'
    );

    const verifyTasksRes = await dispatch('GET', '/api/tasks', alexAuth);
    const remainingTaskTitles = verifyTasksRes.body.map((t: any) => t.title);
    assert(
      remainingTaskTitles.includes('Read Quantum Teleportation Paper (Real Task)'),
      'Real user task survived mock cleanup 100%'
    );

    const verifyGoalsRes = await dispatch('GET', '/api/goals', alexAuth);
    const remainingGoalNames = verifyGoalsRes.body.map((g: any) => g.name);
    assert(
      remainingGoalNames.includes('Marathon 10K Training (Real Goal)'),
      'Real user goal survived mock cleanup 100%'
    );
    assert(
      !remainingGoalNames.includes('Learn Python for AI'),
      'Demo goal "Learn Python for AI" was permanently deleted'
    );

    // -------------------------------------------------------------
    // SCENARIO 6: Multi-Tenant Isolation (Sarah Connor's Data Untouched)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Verify Multi-Tenant Isolation ---');
    const sarahSubjsCheck = await dispatch('GET', '/api/academics/subjects', sarahAuth);
    assert(
      sarahSubjsCheck.body.some((s: any) => s.name === 'Cybersecurity & Defensive AI'),
      'Sarah Connor\'s subject remains 100% untouched'
    );
    const sarahTasksCheck = await dispatch('GET', '/api/tasks', sarahAuth);
    assert(
      sarahTasksCheck.body.some((t: any) => t.title === 'Analyze Sentinel Log Data'),
      'Sarah Connor\'s task remains 100% untouched'
    );

    // -------------------------------------------------------------
    // SCENARIO 7: Natural Language Mode B (Reset Workspace) Safety Preview
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: Mode B (Reset Workspace) Natural Language & Safety Preview ---');
    const workspaceCmdRes = await dispatch('POST', '/api/ai/command', alexAuth, {
      prompt: 'I want to start fresh. Reset my workspace completely.',
    });
    assert(workspaceCmdRes.status === 200, 'Mode B natural language command processed');
    assert(workspaceCmdRes.body.intent === 'RESET_WORKSPACE', 'Gemini / heuristic recognizes RESET_WORKSPACE intent');
    assert(workspaceCmdRes.body.proposal.proposalType === 'DATA_RESET', 'DATA_RESET proposal generated for Mode B');
    assert(
      workspaceCmdRes.body.preview.mode === 'RESET_WORKSPACE',
      'Preview generated for Mode B: Reset Entire Workspace'
    );
    assert(
      workspaceCmdRes.body.preview.toPreserve.userAccount.includes('Alex Rivera'),
      'Account preservation guaranteed in Mode B preview'
    );

    // -------------------------------------------------------------
    // SCENARIO 8: Execute Mode B (Reset Workspace)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 8: Execute Mode B via Workspace API ---');
    const resetWorkspaceRes = await dispatch('POST', '/api/workspace/reset', alexAuth, {
      mode: 'RESET_WORKSPACE',
      confirm: true,
    });
    assert(resetWorkspaceRes.status === 200, 'Workspace reset executed successfully');
    assert(resetWorkspaceRes.body.success === true, 'Response confirms workspace reset success');

    // Verify workspace is clean
    const postResetSubjs = await dispatch('GET', '/api/academics/subjects', alexAuth);
    assert(postResetSubjs.body.length === 0, 'All subjects cleared in clean workspace (count: 0)');

    const postResetTasks = await dispatch('GET', '/api/tasks', alexAuth);
    assert(postResetTasks.body.length === 0, 'All tasks cleared in clean workspace (count: 0)');

    const postResetGoals = await dispatch('GET', '/api/goals', alexAuth);
    assert(postResetGoals.body.length === 0, 'All goals cleared in clean workspace (count: 0)');

    // -------------------------------------------------------------
    // SCENARIO 9: Account & Settings Preservation & Post-Reset Login
    // -------------------------------------------------------------
    console.log('\n--- Scenario 9: User Account & Settings Preservation ---');
    const profileRes = await dispatch('GET', '/api/profile', alexAuth);
    assert(profileRes.status === 200, 'UserProfile retrieved successfully post-reset');
    assert(profileRes.body.collegeStartTime === '09:00', 'College start time preserved (09:00)');
    assert(profileRes.body.collegeEndTime === '15:00', 'College end time preserved (15:00)');

    // Test fresh login
    const reLoginRes = await dispatch('POST', '/api/auth/login', {}, {
      username: 'alex_rivera',
      password: 'LifeOS2026!',
    });
    assert(reLoginRes.status === 200, 'Alex Rivera logs in normally after complete workspace reset');

    // -------------------------------------------------------------
    // SCENARIO 10: Dynamic Analytics & Clean Workspace Functionality
    // -------------------------------------------------------------
    console.log('\n--- Scenario 10: Dynamic Analytics & Clean Workspace Functionality ---');
    const insightsRes = await dispatch('GET', '/api/insights/summary', alexAuth);
    assert(insightsRes.status === 200, 'Insights endpoint returns cleanly');
    assert(insightsRes.body.academic.totalTopics === 0, 'Analytics totalTopics recalculated to 0 (no stale/ghost records)');
    assert(insightsRes.body.academic.overallCompletionPercent === 0, 'Academic progress recalculated to 0%');

    // Create fresh real subject in the clean workspace
    const newSubj = await dispatch('POST', '/api/academics/subjects', alexAuth, {
      name: 'Astrophysics & Cosmology',
      code: 'ASTRO-101',
      colorTag: '#68754C',
    });
    assert(newSubj.status === 201, 'Fresh subject created in clean workspace: Astrophysics & Cosmology');

    const newInsightsRes = await dispatch('GET', '/api/insights/summary', alexAuth);
    assert(
      newInsightsRes.body.academic.subjectsBreakdown.some((s: any) => s.name === 'Astrophysics & Cosmology'),
      'Analytics immediately and dynamically reflect newly added subject'
    );

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed}/${total} PASSED`);
    console.log('================================================================');
    console.log('🎉 ALL DATA RESET & WORKSPACE RESET SCENARIOS PASSED PERFECTLY!\n');
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDataResetTests();
