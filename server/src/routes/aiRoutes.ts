import { Router } from 'express';
import {
  getAIStatus,
  handleCommand,
  handleBreakdownGoal,
  handleCarryForward,
  handleTranscribeAudio,
  commandRequestSchema,
  breakdownRequestSchema,
  transcribeAudioSchema,
} from '../controllers/aiController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/status', getAIStatus);
router.post('/command', validate(commandRequestSchema), handleCommand);
router.post('/breakdown-goal', validate(breakdownRequestSchema), handleBreakdownGoal);
router.post('/carry-forward', handleCarryForward);
router.post('/transcribe-audio', validate(transcribeAudioSchema), handleTranscribeAudio);

export default router;
