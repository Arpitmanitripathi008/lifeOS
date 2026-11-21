import { Router } from 'express';
import {
  getSubjects,
  createSubject,
  deleteSubject,
  addUnit,
  addTopic,
  toggleTopic,
  getExams,
  createExam,
  deleteExam,
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  createSubjectSchema,
  createUnitSchema,
  createTopicSchema,
  createExamSchema,
  createAssignmentSchema,
  generateExamStudyPlan,
} from '../controllers/academicsController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Subjects
router.get('/subjects', getSubjects);
router.post('/subjects', validate(createSubjectSchema), createSubject);
router.delete('/subjects/:id', deleteSubject);

// Units & Topics
router.post('/subjects/:subjectId/units', validate(createUnitSchema), addUnit);
router.post('/units/:unitId/topics', validate(createTopicSchema), addTopic);
router.patch('/topics/:id/toggle', toggleTopic);

// Exams
router.get('/exams', getExams);
router.post('/exams', validate(createExamSchema), createExam);
router.delete('/exams/:id', deleteExam);

// Assignments
router.get('/assignments', getAssignments);
router.post('/assignments', validate(createAssignmentSchema), createAssignment);
router.patch('/assignments/:id', updateAssignment);
router.delete('/assignments/:id', deleteAssignment);

// Exam Study Plan Generator
router.post('/study-plan', generateExamStudyPlan);

export default router;
