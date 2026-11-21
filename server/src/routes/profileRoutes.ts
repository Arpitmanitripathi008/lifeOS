import { Router } from 'express';
import { getProfile, updateProfile, updateProfileSchema } from '../controllers/profileController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', getProfile);
router.patch('/', validate(updateProfileSchema), updateProfile);

export default router;
