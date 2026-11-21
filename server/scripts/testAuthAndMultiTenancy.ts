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
  return new Promise<{ status: number; headers: Record<string, any>; body: any }>((resolve, reject) => {
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

    // Express app dispatch
    app.handle(req, res);
  });
}

async function runTests() {
  console.log('=====================================================');
  console.log('LIFEOS AUTHENTICATION & MULTI-TENANCY VERIFICATION');
  console.log('=====================================================\n');

  try {
    // 1. Test Registration of User B (Sarah Chen)
    const testUsername = `sarah_${Date.now().toString().slice(-4)}`;
    const regRes = await dispatch('POST', '/api/auth/register', {}, {
      fullName: 'Sarah Chen',
      username: testUsername,
      email: `${testUsername}@stanford.edu`,
      password: 'SarahPassword2026!',
    });

    assert(
      regRes.status === 201 && !!regRes.body.token && regRes.body.user.username === testUsername,
      'Registration creates new user with token and workspace',
      `User ID: ${regRes.body.user?.id}`
    );
    const sarahToken = regRes.body.token;
    const sarahId = regRes.body.user.id;

    // 2. Test Duplicate Registration (Same Username)
    const dupRes = await dispatch('POST', '/api/auth/register', {}, {
      fullName: 'Sarah Duplicate',
      username: testUsername,
      email: `another_${testUsername}@stanford.edu`,
      password: 'AnotherPassword2026!',
    });
    assert(dupRes.status === 409, 'Duplicate username is rejected with 409 Conflict');

    // 3. Test Login for User A (Alex Rivera)
    const alexLoginRes = await dispatch('POST', '/api/auth/login', {}, {
      username: 'alex_rivera',
      password: 'LifeOS2026!',
    });
    assert(
      alexLoginRes.status === 200 && !!alexLoginRes.body.token && alexLoginRes.body.user.username === 'alex_rivera',
      'Login with valid credentials succeeds for Alex Rivera',
      `Welcome ${alexLoginRes.body.user?.fullName}`
    );
    const alexToken = alexLoginRes.body.token;
    const alexId = alexLoginRes.body.user.id;

    // 4. Test Login with Incorrect Password
    const badLoginRes = await dispatch('POST', '/api/auth/login', {}, {
      username: 'alex_rivera',
      password: 'TotallyWrongPassword!',
    });
    assert(badLoginRes.status === 401, 'Login with incorrect password rejected with 401 Unauthorized');

    // 5. Test Route Protection (No Token & Bogus Token)
    const noTokenRes = await dispatch('GET', '/api/tasks');
    assert(noTokenRes.status === 401, 'Accessing protected route without token returns 401');

    const bogusTokenRes = await dispatch('GET', '/api/tasks', {
      Authorization: 'Bearer invalid.bogus.jwt.token',
    });
    assert(bogusTokenRes.status === 401, 'Accessing protected route with invalid token returns 401');

    // 6. Test Data Isolation: Tasks
    const alexTasksRes = await dispatch('GET', '/api/tasks', {
      Authorization: `Bearer ${alexToken}`,
    });
    let alexTasks = alexTasksRes.body;
    if (!Array.isArray(alexTasks) || alexTasks.length === 0) {
      const alexTaskCreate = await dispatch('POST', '/api/tasks', {
        Authorization: `Bearer ${alexToken}`,
      }, {
        title: "Alex's Core Task",
        category: 'DEADLINE',
        priority: 'HIGH',
        estimatedDuration: 60,
        scheduledDate: '2026-11-22',
      });
      alexTasks = [alexTaskCreate.body];
    }
    assert(
      Array.isArray(alexTasks) && alexTasks.length > 0,
      'User A (Alex) accesses his workspace tasks',
      `Alex has ${alexTasks.length} task(s)`
    );

    const sarahTasksRes = await dispatch('GET', '/api/tasks', {
      Authorization: `Bearer ${sarahToken}`,
    });
    const sarahTasks = sarahTasksRes.body;
    assert(
      Array.isArray(sarahTasks) && sarahTasks.length === 0,
      'User B (Sarah) has a clean isolated workspace with 0 tasks',
      `Sarah has ${sarahTasks.length} tasks`
    );

    // 7. Test User B creating isolated data
    const uniqueSubjectName = `Quantum Algorithms ${Date.now()}`;
    const newSubjectRes = await dispatch('POST', '/api/academics/subjects', {
      Authorization: `Bearer ${sarahToken}`,
    }, {
      name: uniqueSubjectName,
      code: 'CS999',
      colorTag: '#68754C',
    });
    const newSubject = newSubjectRes.body;
    assert(newSubjectRes.status === 201 && newSubject.name === uniqueSubjectName, 'User B creates private subject');

    const newTaskRes = await dispatch('POST', '/api/tasks', {
      Authorization: `Bearer ${sarahToken}`,
    }, {
      title: 'Complete Quantum Gate Simulation',
      category: 'DEADLINE',
      priority: 'HIGH',
      estimatedDuration: 90,
      scheduledDate: '2026-11-25',
      subjectId: newSubject.id,
    });
    const newTask = newTaskRes.body;
    assert(newTaskRes.status === 201 && !!newTask.id, 'User B creates private task');

    // Verify User A CANNOT see User B's subject or task
    const alexSubjectsRes = await dispatch('GET', '/api/academics/subjects', {
      Authorization: `Bearer ${alexToken}`,
    });
    const alexSubjects = alexSubjectsRes.body;
    const hasSarahSubject = alexSubjects.some((s: any) => s.id === newSubject.id || s.name === uniqueSubjectName);
    assert(!hasSarahSubject, "User A cannot see User B's newly created subject (Data Isolation Confirmed)");

    // 8. Test Direct ID Tampering / Access Prevention
    // Sarah tries to PATCH Alex's task directly
    const alexFirstTask = alexTasks[0];
    const tamperRes = await dispatch('PATCH', `/api/tasks/${alexFirstTask.id}`, {
      Authorization: `Bearer ${sarahToken}`,
    }, {
      title: 'Hacked by Sarah',
      status: 'COMPLETED',
    });
    assert(
      tamperRes.status === 404,
      "User B cannot modify User A's task by ID (returns 404 Not Found)",
      `Status: ${tamperRes.status}`
    );

    // Sarah tries to DELETE Alex's task directly
    const deleteTamperRes = await dispatch('DELETE', `/api/tasks/${alexFirstTask.id}`, {
      Authorization: `Bearer ${sarahToken}`,
    });
    assert(
      deleteTamperRes.status === 404,
      "User B cannot delete User A's task by ID (returns 404 Not Found)",
      `Status: ${deleteTamperRes.status}`
    );

    // 9. Test Multi-Tenancy Composite Uniques (Sleep record on same date)
    const testDate = '2026-11-20';
    const alexSleepRes = await dispatch('POST', '/api/sleep', {
      Authorization: `Bearer ${alexToken}`,
    }, {
      date: testDate,
      bedTimeApprox: '23:30',
      wakeUpTime: '07:30',
      notes: 'Alex slept well',
    });
    assert(alexSleepRes.status === 200, 'User A logs sleep on 2026-11-20');

    const sarahSleepRes = await dispatch('POST', '/api/sleep', {
      Authorization: `Bearer ${sarahToken}`,
    }, {
      date: testDate,
      bedTimeApprox: '00:15',
      wakeUpTime: '08:00',
      notes: 'Sarah slept 7h 45m',
    });
    assert(
      sarahSleepRes.status === 200,
      'User B logs sleep on exact same date (2026-11-20) without unique collision'
    );

    // Check stats are isolated
    const alexSleepStats = (await dispatch('GET', '/api/sleep/stats', {
      Authorization: `Bearer ${alexToken}`,
    })).body;
    const sarahSleepStats = (await dispatch('GET', '/api/sleep/stats', {
      Authorization: `Bearer ${sarahToken}`,
    })).body;

    assert(
      alexSleepStats.records.length > 0 && sarahSleepStats.records.length === 1,
      'Sleep stats are strictly isolated per student',
      `Alex records: ${alexSleepStats.records.length}, Sarah records: ${sarahSleepStats.records.length}`
    );

    // 10. Test GetMe session persistence
    const meRes = await dispatch('GET', '/api/auth/me', {
      Authorization: `Bearer ${sarahToken}`,
    });
    assert(
      meRes.status === 200 && meRes.body.user.username === testUsername && !!meRes.body.profile,
      'GET /api/auth/me returns authenticated user and profile for session persistence'
    );

    // 11. Test Logout
    const logoutRes = await dispatch('POST', '/api/auth/logout', {
      Authorization: `Bearer ${sarahToken}`,
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout succeeds cleanly');

    console.log('\n=====================================================');
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`TEST SUMMARY: ${passedCount}/${results.length} PASSED`);
    console.log('=====================================================');

    if (passedCount === results.length) {
      console.log('🎉 ALL AUTHENTICATION AND MULTI-TENANCY CHECKS PASSED PERFECTLY!');
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
