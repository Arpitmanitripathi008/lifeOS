import { Router } from 'express';
import { getInsightsSummary } from '../controllers/insightsController.js';

const router = Router();

router.get('/summary', getInsightsSummary);

export default router;
