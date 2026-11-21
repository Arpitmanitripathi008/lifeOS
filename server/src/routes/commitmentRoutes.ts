import { Router } from 'express';
import {
  getCommitments,
  createCommitment,
  updateCommitment,
  deleteCommitment,
  createCommitmentSchema,
  updateCommitmentSchema,
} from '../controllers/commitmentController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', getCommitments);
router.post('/', validate(createCommitmentSchema), createCommitment);
router.patch('/:id', validate(updateCommitmentSchema), updateCommitment);
router.delete('/:id', deleteCommitment);

export default router;
