import dotenv from 'dotenv';

dotenv.config();

const {
  PORT,
  DATABASE_URL,
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_USER = 'postgres',
  DB_PASSWORD = '',
  DB_NAME = 'carwash_db',
  JWT_SECRET,
  JWT_EXPIRES_IN,
} = process.env;

// Поддержка двух форматов: единая строка DATABASE_URL или отдельные DB_* переменные
const databaseUrl =
  DATABASE_URL ||
  `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

export const env = {
  port: Number(PORT || 4000),
  databaseUrl,
  jwtSecret: JWT_SECRET || 'change_me',
  jwtExpiresIn: JWT_EXPIRES_IN || '7d',
};
