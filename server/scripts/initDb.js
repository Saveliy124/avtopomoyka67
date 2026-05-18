import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, '../src/sql/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

try {
  await pool.query(schema);
  console.log('Database schema initialized successfully');
} catch (error) {
  console.error('Failed to initialize database:', error.message);
} finally {
  await pool.end();
}
