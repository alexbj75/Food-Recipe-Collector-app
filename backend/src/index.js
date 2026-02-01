import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import recipesRouter from './routes/recipes.js';
import { config } from './config.js';
import { initDb, isHealthy } from './db.js';
import { i18nMiddleware } from './i18n.js';

const app = express();

const corsOptions = {
  origin: config.allowOrigin === '*' ? true : config.allowOrigin,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(i18nMiddleware);

app.get('/api/health', async (req, res) => {
  const dbHealthy = await isHealthy();
  const status = dbHealthy ? 'ok' : 'degraded';
  const statusCode = dbHealthy ? 200 : 503;
  res.status(statusCode).json({ status, database: dbHealthy ? 'connected' : 'disconnected' });
});

app.use('/api/recipes', recipesRouter);

// Serve frontend for convenience
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error(err);
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Recipe already exists' });
  }
  return res.status(500).json({ message: err.message || 'Unexpected error' });
});

async function start() {
  try {
    await initDb();
    app.listen(config.port, () => {
      console.log(`API ready on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
