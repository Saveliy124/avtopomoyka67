import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function reset() {
  try {
    console.log('Dropping public schema...');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

    console.log('Running schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '../src/sql/schema.sql'), 'utf-8');
    await pool.query(schemaSql);

    console.log('Running missing migrations from server.js...');
    const migrations = [
      `ALTER TABLE schedule ADD COLUMN IF NOT EXISTS is_maintenance BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT`,
      `ALTER TABLE extra_services ADD COLUMN IF NOT EXISTS description TEXT`,
      `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_service_id_fkey`,
      `ALTER TABLE bookings ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE`,
      `ALTER TABLE users ALTER COLUMN email DROP NOT NULL`,
    ];
    for (const sql of migrations) {
      await pool.query(sql);
    }

    console.log('Running seed...');
    await import('./seed.js');
    console.log('Database reset complete.');
  } catch (error) {
    console.error('Failed to reset database:', error.message);
  } finally {
    process.exit(0);
  }
}

reset();
