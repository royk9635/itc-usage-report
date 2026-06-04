const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function main() {
  loadEnvFile(path.join(__dirname, '..', '.env'));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

  const { Client } = require('pg');
  const appUrl = new URL(process.env.DATABASE_URL);
  const databaseName = appUrl.pathname.replace(/^\//, '');
  if (!databaseName) throw new Error('DATABASE_URL must include a database name.');

  const adminUrl = new URL(appUrl);
  adminUrl.pathname = '/postgres';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
      console.log(`Created database: ${databaseName}`);
    } else {
      console.log(`Database already exists: ${databaseName}`);
    }
  } finally {
    await client.end();
  }

  const db = require('../lib/db');
  await db.migrate();
  await db.getPool().end();
  console.log('Schema migration complete.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
