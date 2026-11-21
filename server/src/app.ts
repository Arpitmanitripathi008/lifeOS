import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

export const app = express();

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);
app.use(express.json());

// Health Check
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    system: 'LifeOS API Server',
    message: 'LifeOS Backend API is active. Open the web app at http://localhost:5173',
    health: '/api/health',
  });
});

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

// Error Handler
app.use(errorHandler);

export default app;
