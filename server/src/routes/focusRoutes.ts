import { Router } from 'express';
import {
  getFocusSessions,
  logFocus,
  logFocusSchema,
} from '../controllers/focusController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', getFocusSessions);
router.post('/', validate(logFocusSchema), logFocus);

export default router;
