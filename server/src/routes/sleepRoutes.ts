import { Router } from 'express';
import {
  getSleepRecords,
  logSleep,
  getSleepStats,
  logSleepSchema,
} from '../controllers/sleepController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', getSleepRecords);
router.post('/', validate(logSleepSchema), logSleep);
router.get('/stats', getSleepStats);

export default router;
