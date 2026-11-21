import app from './app.js';
import dotenv from 'dotenv';
import { seedDatabase } from './db/seed.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[LifeOS Server] Listening on http://0.0.0.0:${PORT}`);
  try {
    await seedDatabase();
  } catch (err) {
    console.warn('[LifeOS Seed Warning]', err);
  }
});

export default app;
