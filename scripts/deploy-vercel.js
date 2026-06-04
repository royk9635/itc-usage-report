'use strict';
/**
 * Deploy to Vercel via REST API + CLI.
 *
 *   export VERCEL_TOKEN=...
 *   export DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
 *   node scripts/deploy-vercel.js
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API = 'https://api.vercel.com';
const token = process.env.VERCEL_TOKEN;
const projectName = process.env.VERCEL_PROJECT || 'itc-usage-report';
const teamId = process.env.VERCEL_TEAM_ID || null;
const databaseUrl = process.env.DATABASE_URL || '';

async function vercelApi(method, route, body) {
  const url = `${API}${route}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
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
    throw new Error(`Vercel API ${method} ${route} → ${res.status}: ${data.error?.message || data.message || text.slice(0, 300)}`);
  }
  return data;
}

function run(cmd) {
  console.log(`> ${cmd.replace(token, '***')}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

async function getOrCreateProject() {
  const qs = teamId ? `?teamId=${teamId}` : '';
  try {
    const project = await vercelApi('GET', `/v9/projects/${projectName}${qs}`);
    console.log('Using project:', project.name, project.id);
    return project;
  } catch {
    console.log(`Creating project "${projectName}"...`);
    const project = await vercelApi('POST', `/v11/projects${qs}`, {
      name: projectName,
      framework: null,
    });
    console.log('Created project:', project.id);
    return project;
  }
}

async function upsertEnv(projectId, key, value, type = 'encrypted') {
  const qs = teamId ? `?teamId=${teamId}` : '';
  const existing = await vercelApi('GET', `/v9/projects/${projectId}/env${qs}`);
  const found = (existing.envs || []).find((e) => e.key === key && e.target?.includes('production'));
  if (found) {
    await vercelApi('DELETE', `/v9/projects/${projectId}/env/${found.id}${qs}`);
  }
  await vercelApi('POST', `/v10/projects/${projectId}/env${qs}`, {
    key,
    value,
    type,
    target: ['production', 'preview', 'development'],
  });
}

async function main() {
  if (!token) {
    throw new Error('VERCEL_TOKEN required → https://vercel.com/account/tokens');
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL required (Neon connection string).');
  }

  const project = await getOrCreateProject();
  const appUrl = `https://${projectName}.vercel.app`;

  const envVars = {
    DATABASE_URL: databaseUrl,
    DATABASE_SSL: 'true',
    COOKIE_SECURE: 'true',
    PORTAL_PUBLIC_URL: `${appUrl}/login`,
    REPORT_LOW_MEMORY: 'true',
    REPORT_FETCH_CHUNK_DAYS: '7',
    REPORT_CACHE_ENABLED: 'true',
    REPORT_CACHE_MAX_ENTRIES: '2',
    SMARTLER_GROUP: 'itc',
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1',
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'llama-3.3-70b-versatile',
  };
  if (process.env.GROQ_API_KEY) envVars.GROQ_API_KEY = process.env.GROQ_API_KEY;

  console.log(`Setting ${Object.keys(envVars).length} env vars...`);
  for (const [key, value] of Object.entries(envVars)) {
    await upsertEnv(project.id, key, value);
  }

  const scopeFlag = teamId ? ` --scope ${teamId}` : '';
  run(`npx vercel link --yes --project ${projectName} --token ${token}${scopeFlag}`);
  run(`npx vercel deploy --prod --yes --token ${token}${scopeFlag}`);

  console.log('\n=== Deployed ===');
  console.log('URL:   ', appUrl);
  console.log('Login: ', `${appUrl}/login`);
  console.log('Health:', `${appUrl}/health`);
  console.log('\nNote: Hobby plan limits functions to 10s. Report loads need Pro (maxDuration 60 in vercel.json).');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
