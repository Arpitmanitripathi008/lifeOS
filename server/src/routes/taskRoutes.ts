import { Router } from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  createTaskSchema,
  updateTaskSchema,
} from '../controllers/taskController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', getTasks);
router.post('/', validate(createTaskSchema), createTask);
router.patch('/:id', validate(updateTaskSchema), updateTask);
router.delete('/:id', deleteTask);

export default router;
