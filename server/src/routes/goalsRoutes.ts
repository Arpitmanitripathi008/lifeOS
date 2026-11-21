import { Router } from 'express';
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  logGoalSession,
  createGoalSchema,
  updateGoalSchema,
} from '../controllers/goalsController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', getGoals);
router.post('/', validate(createGoalSchema), createGoal);
router.patch('/:id', validate(updateGoalSchema), updateGoal);
router.delete('/:id', deleteGoal);
router.post('/:id/log-session', logGoalSession);

export default router;
