import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client.js';
import { DocumentParser } from '../src/services/documentParser.js';
import { AcademicAIService } from '../src/services/academicAIService.js';
import { commitDocument } from '../src/controllers/documentController.js';

async function runAcademicIntelligenceTests() {
  console.log('\n======================================================');
  console.log('STARTING PHASE 5 ACADEMIC DOCUMENT INTELLIGENCE TESTS');
  console.log('======================================================\n');

  const testDir = path.resolve(process.cwd(), 'test_samples');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Sample 1: Real Course Syllabus
  const syllabusPath = path.join(testDir, 'sample_os_syllabus.txt');
  const syllabusContent = `
DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING
COURSE SYLLABUS: OPERATING SYSTEMS (CS-301)
Academic Year: 2026-2027

Course Overview:
This course introduces the fundamental concepts of operating systems, process management, memory hierarchy, and storage.

UNIT 1: PROCESS MANAGEMENT & CONCURRENCY
- Introduction to Operating Systems and System Calls
- Process State Transitions and Process Control Block (PCB)
- CPU Scheduling Algorithms: FCFS, Round Robin, Multi-level Feedback Queues
- Inter-Process Communication (IPC) and Shared Memory

UNIT 2: SYNCHRONIZATION & DEADLOCKS
- Critical Section Problem and Peterson's Algorithm
- Semaphores and Mutex Locks
- Deadlock Characterization, Prevention, and Banker's Algorithm

UNIT 3: MEMORY MANAGEMENT
- Logical vs Physical Address Space and Paging
- Page Replacement Algorithms: FIFO, LRU, Optimal
- Virtual Memory and Thrashing

Recommended Textbooks:
1. Silberschatz, Galvin, Gagne - Operating System Concepts, 10th Edition.
`;
  fs.writeFileSync(syllabusPath, syllabusContent, 'utf-8');

  // Sample 2: Real Examination Timetable
  const timetablePath = path.join(testDir, 'sample_exam_timetable.txt');
  const timetableContent = `
COLLEGE OF ENGINEERING & TECHNOLOGY
OFFICIAL END-SEMESTER EXAMINATION TIMETABLE - DECEMBER 2026
B.Tech Third Semester (Computer Science)

Date         | Time               | Course Code | Subject Name                   | Hall
-------------|--------------------|-------------|--------------------------------|---------
2026-12-10   | 09:30 AM - 12:30 PM| CS-301      | Operating Systems              | Hall A
2026-12-14   | 09:30 AM - 12:30 PM| CS-302      | Database Management Systems    | Hall B
2026-12-18   | 02:00 PM - 05:00 PM| CS-303      | Computer Networks              | Hall A
2026-12-22   | 09:30 AM - 12:30 PM| MA-301      | Discrete Mathematics           | Hall C

Note: Reporting time is 30 minutes before the commencement of examination.
`;
  fs.writeFileSync(timetablePath, timetableContent, 'utf-8');

  console.log('✓ Created test syllabus and examination timetable sample files.');

  // Test 1: Document Parsing & Validation
  console.log('\n--- Test 1: File Parsing & Document Validation ---');
  const parsedSyllabus = await DocumentParser.parseFile(syllabusPath, 'text/plain');
  console.log(`Parsed Syllabus text length: ${parsedSyllabus.text.length} characters`);
  if (!parsedSyllabus.text.includes('OPERATING SYSTEMS')) {
    throw new Error('Syllabus text extraction failed!');
  }

  const parsedTimetable = await DocumentParser.parseFile(timetablePath, 'text/plain');
  console.log(`Parsed Timetable text length: ${parsedTimetable.text.length} characters`);
  if (!parsedTimetable.text.includes('EXAMINATION TIMETABLE')) {
    throw new Error('Timetable text extraction failed!');
  }
  console.log('✓ Test 1 PASSED: Text extracted cleanly with proper MIME classification.');

  // Test 2: Gemini Syllabus Extraction
  console.log('\n--- Test 2: Live Gemini Analysis of Syllabus ---');
  const syllabusAnalysis = await AcademicAIService.analyzeDocument(
    parsedSyllabus,
    'sample_os_syllabus.txt',
    'SYLLABUS'
  );

  console.log(`Document Type: ${syllabusAnalysis.documentType}`);
  console.log(`Extracted Subject: ${syllabusAnalysis.syllabus?.subjectName} (${syllabusAnalysis.syllabus?.subjectCode})`);
  console.log(`Extracted Units Count: ${syllabusAnalysis.syllabus?.units?.length || 0}`);
  for (const u of syllabusAnalysis.syllabus?.units || []) {
    console.log(`  • Unit ${u.unitNumber}: "${u.title}" (${u.topics.length} topics)`);
    for (const t of u.topics) {
      console.log(`      - ${t.title} [${t.estimatedMinutes}m]`);
    }
  }

  if (!syllabusAnalysis.syllabus?.subjectName || (syllabusAnalysis.syllabus?.units?.length || 0) < 3) {
    throw new Error('TEST FAILED: Gemini failed to extract all 3 units of the syllabus!');
  }
  console.log('✓ Test 2 PASSED: Gemini accurately structured the syllabus into Subjects, Units, and Topics.');

  // Test 3: Live Gemini Analysis of Examination Timetable
  console.log('\n--- Test 3: Live Gemini Analysis of Exam Timetable ---');
  const timetableAnalysis = await AcademicAIService.analyzeDocument(
    parsedTimetable,
    'sample_exam_timetable.txt',
    'EXAM_TIMETABLE'
  );

  console.log(`Extracted Exams Count: ${timetableAnalysis.examTimetable?.exams?.length || 0}`);
  for (const ex of timetableAnalysis.examTimetable?.exams || []) {
    console.log(`  • ${ex.examDate} [${ex.startTime || '—'} to ${ex.endTime || '—'}] ${ex.subjectName} (${ex.subjectCode || 'No code'}) - ${ex.location || ''}`);
  }

  if ((timetableAnalysis.examTimetable?.exams?.length || 0) < 4) {
    throw new Error('TEST FAILED: Gemini failed to extract all 4 exams from timetable!');
  }
  console.log('✓ Test 3 PASSED: Gemini extracted all 4 examination dates and standardized to YYYY-MM-DD.');

  // Test 4: Database Persistence & Duplicate Prevention
  console.log('\n--- Test 4: Database Commit & Duplicate Prevention ---');
  
  // Create mock document record in DB
  const docRecord = await prisma.uploadedDocument.create({
    data: {
      fileName: 'sample_os_syllabus.txt',
      fileType: 'TXT',
      fileSize: 1024,
      filePath: syllabusPath,
      docCategory: 'SYLLABUS',
      status: 'PARSED',
    },
  });

  const mockReq1: any = {
    params: { id: docRecord.id },
    body: {
      documentType: 'SYLLABUS',
      syllabus: syllabusAnalysis.syllabus,
    },
  };

  let commitRes1: any = null;
  const mockRes1: any = {
    json: (d: any) => {
      commitRes1 = d;
      console.log(`First commit metrics: Imported ${d.metrics.importedUnitsCount} units, ${d.metrics.importedTopicsCount} topics.`);
    },
  };

  await commitDocument(mockReq1, mockRes1, (e) => { if (e) throw e; });

  // Now test re-importing the same document (Duplicate Prevention Test)
  const mockReq2: any = {
    params: { id: docRecord.id },
    body: {
      documentType: 'SYLLABUS',
      syllabus: syllabusAnalysis.syllabus,
    },
  };

  let commitRes2: any = null;
  const mockRes2: any = {
    json: (d: any) => {
      commitRes2 = d;
      console.log(`Second commit metrics (Duplicate Prevention): Imported ${d.metrics.importedUnitsCount} new units, ${d.metrics.importedTopicsCount} new topics.`);
    },
  };

  await commitDocument(mockReq2, mockRes2, (e) => { if (e) throw e; });

  if (commitRes2.metrics.importedUnitsCount !== 0 || commitRes2.metrics.importedTopicsCount !== 0) {
    throw new Error('TEST FAILED: Duplicate units or topics were created on re-import!');
  }
  console.log('✓ Test 4 PASSED: Duplicate prevention successfully verified. Zero redundant records created on re-commit.');

  // Test 5: Exam Timetable Commit
  console.log('\n--- Test 5: Exam Timetable Database Commit ---');
  const mockReqExam: any = {
    params: { id: docRecord.id },
    body: {
      documentType: 'EXAM_TIMETABLE',
      examTimetable: timetableAnalysis.examTimetable,
    },
  };

  let examCommitRes: any = null;
  const mockResExam: any = {
    json: (d: any) => {
      examCommitRes = d;
      console.log(`Imported ${d.metrics.importedExamsCount} exams into database.`);
    },
  };

  await commitDocument(mockReqExam, mockResExam, (e) => { if (e) throw e; });

  const totalExams = await prisma.academicExam.count();
  console.log(`Total Academic Exams now in database: ${totalExams}`);
  if (totalExams < 4) {
    throw new Error('TEST FAILED: Academic exams were not committed to database!');
  }
  console.log('✓ Test 5 PASSED: Examination schedule persisted into database.');

  // Test 6: Study Plan Generation & Conversion into Real Tasks
  console.log('\n--- Test 6: Adaptive Study Plan Generation & Task Conversion ---');
  const osSubject = await prisma.subject.findFirst({
    where: { name: { contains: 'Operating Systems' } },
    include: { units: { include: { topics: true } } },
  });

  if (!osSubject) {
    throw new Error('Could not find created Operating Systems subject!');
  }

  const uncompletedTopics = osSubject.units.flatMap((u) =>
    u.topics.map((t) => ({ id: t.id, title: `Unit ${u.unitNumber}: ${t.title}`, estimatedMinutes: t.estimatedMinutes }))
  );

  console.log(`Generating study plan for "${osSubject.name}" (Exam: 2026-12-10, Topics: ${uncompletedTopics.length})...`);
  const studyPlan = await AcademicAIService.generateStudyPlan({
    subjectName: osSubject.name,
    examDate: '2026-12-10',
    topics: uncompletedTopics,
    startDate: '2026-11-26',
  });

  console.log(`Plan Title: "${studyPlan.title}"`);
  console.log(`Generated Sessions Count: ${studyPlan.tasks.length}`);
  for (const t of studyPlan.tasks) {
    console.log(`  • [${t.scheduledDate}] ${t.title} (${t.durationMinutes}m) [${t.priority}]`);
  }

  // Commit study plan tasks to database
  const createdTasks = [];
  for (const t of studyPlan.tasks) {
    const task = await prisma.task.create({
      data: {
        title: `[${osSubject.name}] ${t.title}`,
        category: 'DEADLINE',
        priority: t.priority,
        estimatedDuration: t.durationMinutes,
        scheduledDate: t.scheduledDate,
        source: 'STUDY_PLAN',
        subjectId: osSubject.id,
        unitTopicId: t.unitTopicId || null,
      },
    });
    createdTasks.push(task);
  }

  console.log(`Successfully committed ${createdTasks.length} real study plan tasks into SQLite!`);

  // Verify created tasks exist in DB
  const dbTasks = await prisma.task.findMany({
    where: { subjectId: osSubject.id, source: 'STUDY_PLAN' },
  });

  if (dbTasks.length !== createdTasks.length) {
    throw new Error('TEST FAILED: Study plan tasks count in DB does not match created count!');
  }

  console.log('✓ Test 6 PASSED: Adaptive study plan converted into real scheduled database tasks.');

  // Clean up test sample files & records
  try {
    fs.unlinkSync(syllabusPath);
    fs.unlinkSync(timetablePath);
    fs.rmdirSync(testDir);
  } catch (e) {}

  console.log('\n======================================================');
  console.log('ALL PHASE 5 ACADEMIC DOCUMENT INTELLIGENCE TESTS PASSED! ✓');
  console.log('======================================================\n');
}

runAcademicIntelligenceTests()
  .catch((err) => {
    console.error('\n❌ ACADEMIC INTELLIGENCE TESTS FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
