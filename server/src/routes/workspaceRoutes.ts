import { Router } from 'express';
import { getResetPreview, executeReset } from '../controllers/workspaceController.js';

const router = Router();

router.get('/reset-preview', getResetPreview);
router.post('/reset', executeReset);

export default router;
