import type { Request, Response, NextFunction } from 'express';
import { WorkspaceService, type ResetMode } from '../services/workspaceService.js';
import { z } from 'zod';

export const resetRequestSchema = z.object({
  mode: z.enum(['CLEAR_MOCK_DATA', 'RESET_WORKSPACE']),
  confirm: z.boolean().refine((val) => val === true, {
    message: 'Explicit user confirmation is required to execute a data reset.',
  }),
});

export async function getResetPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const mode = (req.query.mode as ResetMode) || 'CLEAR_MOCK_DATA';
    if (mode !== 'CLEAR_MOCK_DATA' && mode !== 'RESET_WORKSPACE') {
      return res.status(400).json({ error: 'Invalid mode. Must be CLEAR_MOCK_DATA or RESET_WORKSPACE' });
    }

    const preview = await WorkspaceService.getResetPreview(userId, mode);
    res.json(preview);
  } catch (error) {
    next(error);
  }
}

export async function executeReset(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { mode, confirm } = resetRequestSchema.parse(req.body);

    const result = await WorkspaceService.executeReset(userId, mode as ResetMode);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
