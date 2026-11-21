import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { prisma } from '../db/client.js';

dotenv.config();

export const JWT_SECRET =
  process.env.JWT_SECRET || 'lifeos_super_secret_jwt_key_2026_academic_edition';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function signToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required. Please log in to continue.',
      });
    }

    const token = authHeader.split(' ')[1]?.trim();
    if (!token) {
      return res.status(401).json({
        error: 'Authentication token is missing. Please log in.',
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr: any) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Your session has expired. Please log in again.',
          expired: true,
        });
      }
      return res.status(401).json({
        error: 'Invalid authentication token. Please log in again.',
      });
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        error: 'Malformed session token.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, email: true },
    });

    if (!user) {
      return res.status(401).json({
        error: 'User account no longer exists. Please register or log in again.',
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
    };

    next();
  } catch (error) {
    next(error);
  }
}
