import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[API Error]:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Multer errors (e.g. file size exceeded)
  if (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Maximum allowed size is 10MB.' : err.message,
      code: err.code,
    });
  }

  // Handle Gemini API key or authentication errors cleanly
  const msg = err.message || '';
  if (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('PERMISSION_DENIED')
  ) {
    return res.status(401).json({
      error: 'Gemini API authentication failed. Please verify that your GEMINI_API_KEY in server/.env is valid.',
      details: msg,
    });
  }

  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
