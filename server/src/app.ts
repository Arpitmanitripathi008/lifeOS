import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const clientDistPath = path.resolve(__dirname, '../../client/dist');

export const app = express();

// Security Headers (Defense-in-depth against XSS, clickjacking, MIME sniffing)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Middleware
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL.replace(/\/$/, ''), 'http://localhost:5173', 'http://127.0.0.1:5173']
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files if built with caching
if (fs.existsSync(clientDistPath)) {
  app.use(
    express.static(clientDistPath, {
      maxAge: '1d',
      etag: true,
    })
  );
}

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    system: 'LifeOS API Server',
    database: 'SQLite (Prisma)',
    time: new Date().toISOString(),
  });
});

// API Routes
app.use('/api', apiRouter);

// Fallback: Serve React SPA index.html for any frontend navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.json({
    status: 'ok',
    system: 'LifeOS API Server',
    message: 'LifeOS Backend API is active. Frontend build not found.',
    health: '/api/health',
  });
});

// Error Handler
app.use(errorHandler);

export default app;
