import { Router } from 'express';
import authRoutes from './authRoutes.js';
import profileRoutes from './profileRoutes.js';
import commitmentRoutes from './commitmentRoutes.js';
import taskRoutes from './taskRoutes.js';
import academicsRoutes from './academicsRoutes.js';
import goalsRoutes from './goalsRoutes.js';
import sleepRoutes from './sleepRoutes.js';
import focusRoutes from './focusRoutes.js';
import reviewRoutes from './reviewRoutes.js';
import scheduleRoutes from './scheduleRoutes.js';
import proposalRoutes from './proposalRoutes.js';
import insightsRoutes from './insightsRoutes.js';
import aiRoutes from './aiRoutes.js';
import documentRoutes from './documentRoutes.js';
import workspaceRoutes from './workspaceRoutes.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Public Authentication Endpoints
router.use('/auth', authRoutes);

// Protected LifeOS Workspaces (Requires Authentication)
router.use(authMiddleware);

router.use('/profile', profileRoutes);
router.use('/commitments', commitmentRoutes);
router.use('/tasks', taskRoutes);
router.use('/academics', academicsRoutes);
router.use('/documents', documentRoutes);
router.use('/goals', goalsRoutes);
router.use('/sleep', sleepRoutes);
router.use('/focus', focusRoutes);
router.use('/reviews', reviewRoutes);
router.use('/schedule', scheduleRoutes);
router.use('/proposals', proposalRoutes);
router.use('/insights', insightsRoutes);
router.use('/ai', aiRoutes);
router.use('/workspace', workspaceRoutes);

export default router;
