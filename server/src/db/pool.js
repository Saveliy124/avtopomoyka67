import pg from 'pg';
import { env } from '../config/env.js';

// Parse numeric/decimal (OID 1700) as floats instead of strings
pg.types.setTypeParser(1700, (val) => parseFloat(val));
// Parse bigint (OID 20) as integers
pg.types.setTypeParser(20, (val) => parseInt(val, 10));

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL error:', error);
});
