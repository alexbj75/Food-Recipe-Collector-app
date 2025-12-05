import dotenv from 'dotenv';

dotenv.config();

const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  allowOrigin: process.env.ALLOW_ORIGIN || '*',
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME
  }
};

required.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`Warning: missing environment variable ${key}`);
  }
});
