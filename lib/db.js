const fs = require('fs');
const path = require('path');

let pool = null;

function getPg() {
  try {
    return require('pg');
  } catch (err) {
    throw new Error('PostgreSQL support requires the "pg" package. Run: npm install');
  }
}

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL || '';
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for authentication and access control.');
  }
  const { Pool } = getPg();
  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await query(schema);
}

module.exports = {
  getPool,
  query,
  transaction,
  migrate,
};
