import { Router } from 'express';
import {
  register,
  login,
  getMe,
  logout,
  registerSchema,
  loginSchema,
} from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authMiddleware, getMe);
router.post('/logout', logout);

export default router;
