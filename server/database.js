const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool = null;

function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!isDatabaseConfigured()) {
    const error = new Error('Database is not configured. Set DATABASE_URL on the server.');
    error.status = 503;
    throw error;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'false'
        ? { rejectUnauthorized: false }
        : undefined,
      max: Number(process.env.DATABASE_POOL_SIZE || 10),
    });
  }
  return pool;
}

async function initializeDatabase() {
  if (!isDatabaseConfigured()) return false;
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await getPool().query(schema);
  await getPool().query('DELETE FROM sessions WHERE expires_at <= NOW()');
  return true;
}

async function closeDatabase() {
  if (pool) await pool.end();
  pool = null;
}

module.exports = { getPool, initializeDatabase, closeDatabase, isDatabaseConfigured };
