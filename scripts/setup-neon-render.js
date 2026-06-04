'use strict';
/**
 * Provision Neon Postgres, migrate schema, create Super Admin, update Render env.
 *
 * Usage:
 *   export NEON_API_KEY=neon_api_...
 *   export RENDER_API_KEY=rnd_...
 *   node scripts/setup-neon-render.js
 *
 * Optional:
 *   SUPER_ADMIN_EMAIL=admin@example.com
 *   SUPER_ADMIN_PASSWORD=YourStrongPassword10+
 *   RENDER_SERVICE_ID=srv-d8gphieq1p3s73amc3mg
 *   NEON_PROJECT_NAME=itc-usage-report
 *   NEON_REGION=aws-ap-southeast-1
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const NEON_API = 'https://console.neon.tech/api/v2';
const RENDER_API = 'https://api.render.com/v1';
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID || 'srv-d8gphieq1p3s73amc3mg';
const RENDER_APP_URL = process.env.RENDER_APP_URL || 'https://itc-usage-report.onrender.com';
const NEON_PROJECT_NAME = process.env.NEON_PROJECT_NAME || 'itc-usage-report';
const NEON_REGION = process.env.NEON_REGION || 'aws-ap-southeast-1';
const DB_NAME = process.env.NEON_DATABASE || 'usage_report';

const neonKey = process.env.NEON_API_KEY || process.env.NEON;
const renderKey = process.env.RENDER_API_KEY || process.env.RENDER;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function neonApi(method, route, body) {
  const res = await fetch(`${NEON_API}${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${neonKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text.slice(0, 400);
    throw new Error(`Neon API ${method} ${route} → HTTP ${res.status}: ${msg}`);
  }
  return data;
}

async function renderApi(method, route, body) {
  const res = await fetch(`${RENDER_API}${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${renderKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text.slice(0, 400);
    throw new Error(`Render API ${method} ${route} → HTTP ${res.status}: ${msg}`);
  }
  return data;
}

async function waitForNeonOperations(projectId, maxMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const ops = await neonApi('GET', `/projects/${projectId}/operations`);
    const list = ops.operations || [];
    const pending = list.filter((o) => o.status !== 'finished' && o.status !== 'failed');
    if (!pending.length) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Timed out waiting for Neon project operations');
}

async function findOrCreateNeonProject() {
  const listed = await neonApi('GET', '/projects');
  const projects = listed.projects || [];
  const existing = projects.find((p) => p.name === NEON_PROJECT_NAME);
  if (existing) {
    console.log(`Using existing Neon project: ${existing.name} (${existing.id})`);
    return existing;
  }
  console.log(`Creating Neon project "${NEON_PROJECT_NAME}" in ${NEON_REGION} ...`);
  const created = await neonApi('POST', '/projects', {
    project: {
      name: NEON_PROJECT_NAME,
      region_id: NEON_REGION,
      pg_version: 16,
    },
  });
  const project = created.project;
  await waitForNeonOperations(project.id);
  console.log(`Created Neon project: ${project.id}`);
  return project;
}

async function getConnectionUri(projectId) {
  const branches = await neonApi('GET', `/projects/${projectId}/branches`);
  const branch = (branches.branches || []).find((b) => b.primary) || branches.branches?.[0];
  if (!branch) throw new Error('No Neon branch found');

  const uriRes = await neonApi('GET', `/projects/${projectId}/connection_uri?database_name=neondb&role_name=neondb_owner&branch_id=${branch.id}&pooled=false`);
  let uri = uriRes.uri || uriRes.connection_uri;
  if (!uri) throw new Error('Could not fetch Neon connection URI');

  if (!uri.includes('sslmode=')) {
    uri += uri.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }
  return uri;
}

function withDatabaseName(connectionUri, dbName) {
  const url = new URL(connectionUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function ensureDatabase(adminUri, dbName) {
  const { Client } = require('pg');
  const adminUrl = new URL(adminUri);
  adminUrl.pathname = '/postgres';
  const client = new Client({
    connectionString: adminUrl.toString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Created database: ${dbName}`);
    } else {
      console.log(`Database already exists: ${dbName}`);
    }
  } finally {
    await client.end();
  }
}

async function migrateSchema(databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_SSL = 'true';
  const db = require('../lib/db');
  await db.migrate();
  console.log('Schema migration complete.');
  return db;
}

async function createSuperAdmin(db) {
  const { normalizeEmail, hashPassword } = require('../lib/auth');
  const email = normalizeEmail(process.env.SUPER_ADMIN_EMAIL || 'admin@itc-analytics.com');
  let password = String(process.env.SUPER_ADMIN_PASSWORD || '');
  if (password.length < 10) {
    password = crypto.randomBytes(12).toString('base64url');
    console.log('\nGenerated Super Admin password (save this):', password);
  }
  const existing = await db.query("SELECT count(*)::int AS n FROM users WHERE role = 'SUPER_ADMIN'");
  if (Number(existing.rows[0]?.n || 0) > 0) {
    console.log('Super Admin already exists — skipping bootstrap user creation.');
    return { email: null, password: null, skipped: true };
  }
  const passwordHash = await hashPassword(password);
  await db.query(
    `INSERT INTO users (email, password_hash, role, must_change_password)
     VALUES ($1, $2, 'SUPER_ADMIN', false)
     RETURNING id, email, role`,
    [email, passwordHash]
  );
  console.log(`Created Super Admin: ${email}`);
  return { email, password, skipped: false };
}

async function getRenderEnvVars() {
  const rows = await renderApi('GET', `/services/${RENDER_SERVICE_ID}/env-vars?limit=50`);
  const map = new Map();
  for (const row of rows) {
    const ev = row.envVar || row;
    if (ev?.key) map.set(ev.key, ev.value);
  }
  return map;
}

async function updateRenderEnv(databaseUrl) {
  const existing = await getRenderEnvVars();
  const merged = [
    { key: 'NODE_VERSION', value: existing.get('NODE_VERSION') || '20' },
    { key: 'COOKIE_SECURE', value: 'true' },
    { key: 'DATABASE_SSL', value: 'true' },
    { key: 'DATABASE_URL', value: databaseUrl },
    { key: 'AUTH_DISABLED', value: 'false' },
    { key: 'REPORT_CACHE_ENABLED', value: existing.get('REPORT_CACHE_ENABLED') || 'true' },
    { key: 'REPORT_CACHE_MAX_ENTRIES', value: existing.get('REPORT_CACHE_MAX_ENTRIES') || '12' },
    { key: 'REPORT_CACHE_TTL_PAST_MS', value: existing.get('REPORT_CACHE_TTL_PAST_MS') || '864000000' },
    { key: 'SMARTLER_GROUP', value: existing.get('SMARTLER_GROUP') || 'itc' },
    { key: 'OPENAI_BASE_URL', value: existing.get('OPENAI_BASE_URL') || 'https://api.groq.com/openai/v1' },
    { key: 'OPENAI_MODEL', value: existing.get('OPENAI_MODEL') || 'llama-3.3-70b-versatile' },
    { key: 'PORTAL_PUBLIC_URL', value: `${RENDER_APP_URL}/login` },
  ];
  if (existing.get('GROQ_API_KEY')) {
    merged.push({ key: 'GROQ_API_KEY', value: existing.get('GROQ_API_KEY') });
  }
  if (existing.get('OPENAI_API_KEY')) {
    merged.push({ key: 'OPENAI_API_KEY', value: existing.get('OPENAI_API_KEY') });
  }
  if (existing.get('OPENROUTER_API_KEY')) {
    merged.push({ key: 'OPENROUTER_API_KEY', value: existing.get('OPENROUTER_API_KEY') });
  }

  console.log(`Updating ${merged.length} Render env vars (AUTH enabled, DATABASE_URL set) ...`);
  await renderApi('PUT', `/services/${RENDER_SERVICE_ID}/env-vars`, merged);

  console.log('Triggering Render redeploy ...');
  await renderApi('POST', `/services/${RENDER_SERVICE_ID}/deploys`, { clearCache: 'clear' });
}

async function waitForRenderAuthEnabled(maxMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${RENDER_APP_URL}/health`);
      const data = await res.json();
      if (data.auth === 'enabled' && data.database === 'configured') {
        return data;
      }
      process.stdout.write('.');
    } catch {
      process.stdout.write('x');
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  throw new Error('Timed out waiting for Render to enable auth with database');
}

async function main() {
  loadEnvFile(path.join(__dirname, '..', '.env'));

  let databaseUrl = process.env.DATABASE_URL || '';
  let project = { name: NEON_PROJECT_NAME, id: '(existing)' };

  if (databaseUrl) {
    console.log('Using DATABASE_URL from environment (skipping Neon project creation).');
    if (!databaseUrl.includes('sslmode=')) {
      databaseUrl += databaseUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
    }
    const dbName = new URL(databaseUrl).pathname.replace(/^\//, '') || DB_NAME;
    if (dbName !== DB_NAME) {
      console.log(`Note: database in URL is "${dbName}"`);
    }
  } else {
    if (!neonKey) {
      throw new Error(
        'Set NEON_API_KEY (https://console.neon.tech/app/settings/api-keys) or paste DATABASE_URL from Neon Console.'
      );
    }
    if (!renderKey) {
      throw new Error('RENDER_API_KEY is required.');
    }
    project = await findOrCreateNeonProject();
    const adminUri = await getConnectionUri(project.id);
    await ensureDatabase(adminUri, DB_NAME);
    databaseUrl = withDatabaseName(adminUri, DB_NAME);
  }

  if (!renderKey) {
    throw new Error('RENDER_API_KEY is required.');
  }

  const db = await migrateSchema(databaseUrl);
  const admin = await createSuperAdmin(db);
  await db.getPool().end();
  await updateRenderEnv(databaseUrl);

  console.log('\nWaiting for Render redeploy');
  const health = await waitForRenderAuthEnabled();
  console.log('\nRender health:', JSON.stringify({ auth: health.auth, database: health.database, ok: health.ok }));

  console.log('\n=== Integration complete ===');
  console.log('App URL:     ', RENDER_APP_URL);
  console.log('Login URL:   ', `${RENDER_APP_URL}/login`);
  console.log('Neon project:', project.name, `(${project.id})`);
  if (!admin.skipped) {
    console.log('Super Admin: ', admin.email);
    console.log('Password:    ', admin.password);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
