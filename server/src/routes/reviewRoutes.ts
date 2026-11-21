import { Router } from 'express';
import {
  getReview,
  submitReview,
  submitReviewSchema,
} from '../controllers/reviewController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/:date', getReview);
router.post('/', validate(submitReviewSchema), submitReview);

export default router;
