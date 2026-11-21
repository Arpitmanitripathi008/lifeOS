import { Router } from 'express';
import {
  getDaySchedule,
  getWeekSchedule,
  generateSchedule,
  modifySchedule,
  declareOverride,
  undoOverride,
  getOverride,
  generateScheduleSchema,
  modifyScheduleSchema,
  scheduleOverrideSchema,
} from '../controllers/scheduleController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/day', getDaySchedule);
router.get('/week', getWeekSchedule);
router.post('/generate', validate(generateScheduleSchema), generateSchedule);
router.post('/modify', validate(modifyScheduleSchema), modifySchedule);

// Holiday & Temporary Timetable Overrides
router.post('/override', validate(scheduleOverrideSchema), declareOverride);
router.post('/override/undo', undoOverride);
router.get('/override/:date', getOverride);

export default router;
