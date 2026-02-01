import mysql from 'mysql2/promise';
import { config } from './config.js';

const MAX_RETRIES = 10;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

pool.on('connection', () => {
  console.log('Database pool: new connection established');
});

pool.on('release', () => {
  // Connection returned to pool
});

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getRetryDelay(attempt) {
  const exponentialDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS);
}

/**
 * Check if an error is a connection-related error that should trigger a retry
 */
function isRetryableError(err) {
  const retryableCodes = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'PROTOCOL_CONNECTION_LOST',
    'ER_CON_COUNT_ERROR',
    'ER_HOST_IS_BLOCKED'
  ];
  return retryableCodes.includes(err.code) || err.message?.includes('is blocked');
}

/**
 * Execute a database operation with retry logic
 */
async function withRetry(operation, operationName = 'Database operation') {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      if (!isRetryableError(err)) {
        throw err;
      }

      const delay = getRetryDelay(attempt);
      console.warn(
        `${operationName} failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${err.message}. ` +
          `Retrying in ${Math.round(delay / 1000)}s...`
      );

      await sleep(delay);
    }
  }

  console.error(`${operationName} failed after ${MAX_RETRIES} attempts`);
  throw lastError;
}

/**
 * Test database connectivity
 */
export async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
}

/**
 * Check if database is healthy (for health check endpoint)
 */
export async function isHealthy() {
  try {
    await testConnection();
    return true;
  } catch {
    return false;
  }
}

export async function initDb() {
  await withRetry(async () => {
    const createTableSql = `
    CREATE TABLE IF NOT EXISTS recipes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      source_url VARCHAR(2048) NOT NULL UNIQUE,
      description TEXT,
      image_url VARCHAR(2048),
      servings VARCHAR(64),
      prep_time VARCHAR(64),
      cook_time VARCHAR(64),
      total_time VARCHAR(64),
      ingredients LONGTEXT,
      instructions LONGTEXT,
      archived_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

    await pool.query(createTableSql);
    // Ensure archived_at exists even if table was created previously.
    await pool.query(
      'ALTER TABLE recipes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL DEFAULT NULL'
    );
    // Ensure the JSON columns exist for legacy tables.
    await pool.query(
      'ALTER TABLE recipes ADD COLUMN IF NOT EXISTS ingredients LONGTEXT'
    );
    await pool.query(
      'ALTER TABLE recipes ADD COLUMN IF NOT EXISTS instructions LONGTEXT'
    );
    await pool.query('ALTER TABLE recipes MODIFY COLUMN ingredients LONGTEXT');
    await pool.query('ALTER TABLE recipes MODIFY COLUMN instructions LONGTEXT');
  }, 'Database initialization');
}

export async function query(sql, params) {
  return pool.query(sql, params);
}

export { pool };
