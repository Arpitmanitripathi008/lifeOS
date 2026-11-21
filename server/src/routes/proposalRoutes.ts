import { Router } from 'express';
import {
  getProposals,
  createProposal,
  acceptProposal,
  rejectProposal,
  createProposalSchema,
} from '../controllers/proposalController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', getProposals);
router.post('/', validate(createProposalSchema), createProposal);
router.patch('/:id/accept', acceptProposal);
router.patch('/:id/reject', rejectProposal);

export default router;
