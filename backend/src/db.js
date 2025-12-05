import mysql from 'mysql2/promise';
import { config } from './config.js';

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function initDb() {
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
      ingredients JSON,
      instructions JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await pool.query(createTableSql);
}

export async function query(sql, params) {
  return pool.query(sql, params);
}

export { pool };
