'use strict';
/**
 * Create a Render web service for this repo.
 *
 * Usage:
 *   export RENDER_API_KEY=rnd_...
 *   node scripts/deploy-to-render.js
 *
 * Optional:
 *   GITHUB_REPO=https://github.com/OWNER/repo   (default: origin remote)
 *   RENDER_SERVICE_NAME=itc-usage-report
 *   RENDER_REGION=singapore
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const API = 'https://api.render.com/v1';
const ROOT = path.join(__dirname, '..');

const token = process.env.RENDER_API_KEY || process.env.RENDER;
const serviceName = process.env.RENDER_SERVICE_NAME || 'itc-usage-report';
const region = process.env.RENDER_REGION || 'singapore';

function detectRepo() {
  if (process.env.GITHUB_REPO || process.env.RENDER_REPO) {
    return process.env.GITHUB_REPO || process.env.RENDER_REPO;
  }
  try {
    const url = execSync('git remote get-url origin', { cwd: ROOT, encoding: 'utf8' }).trim();
    if (url.startsWith('git@github.com:')) {
      const slug = url.slice('git@github.com:'.length).replace(/\.git$/, '');
      return `https://github.com/${slug}`;
    }
    if (url.includes('github.com')) {
      return url.replace(/\.git$/, '');
    }
    return url;
  } catch {
    return '';
  }
}

async function api(method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
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

function baseEnvVars() {
  return [
    { key: 'NODE_VERSION', value: '20' },
    { key: 'COOKIE_SECURE', value: 'true' },
    { key: 'DATABASE_SSL', value: 'true' },
    { key: 'AUTH_DISABLED', value: 'true' },
    { key: 'REPORT_CACHE_ENABLED', value: 'true' },
    { key: 'REPORT_CACHE_MAX_ENTRIES', value: '12' },
    { key: 'REPORT_CACHE_TTL_PAST_MS', value: '864000000' },
    { key: 'SMARTLER_GROUP', value: 'itc' },
    { key: 'OPENAI_BASE_URL', value: 'https://api.groq.com/openai/v1' },
    { key: 'OPENAI_MODEL', value: 'llama-3.3-70b-versatile' },
  ];
}

async function main() {
  if (!token) {
    console.error('Missing RENDER_API_KEY.');
    console.error('Create one at: https://dashboard.render.com/u/settings#api-keys');
    process.exit(1);
  }

  const repo = detectRepo();
  if (!repo) {
    console.error('Could not detect GitHub repo. Set GITHUB_REPO=https://github.com/OWNER/repo');
    process.exit(1);
  }

  const owners = await api('GET', '/owners?limit=20');
  const ownerList = Array.isArray(owners) ? owners : owners?.items || [];
  const owner = ownerList[0]?.owner || ownerList[0];
  const ownerId = owner?.id;
  if (!ownerId) {
    throw new Error('Could not determine Render workspace ownerId');
  }
  console.log(`Workspace: ${owner?.name || owner?.email || ownerId}`);

  const existing = await api('GET', '/services?limit=100');
  const services = (Array.isArray(existing) ? existing : existing?.items || []).map((x) => x.service || x);
  const found = services.find((s) => s?.name === serviceName);
  if (found) {
    console.log(`Service "${serviceName}" already exists.`);
    if (found.serviceDetails?.url) console.log('URL:', found.serviceDetails.url);
    else if (found.url) console.log('URL:', found.url);
    console.log('Dashboard: https://dashboard.render.com/');
    return;
  }

  const payload = {
    type: 'web_service',
    name: serviceName,
    ownerId,
    repo,
    branch: process.env.RENDER_BRANCH || 'main',
    autoDeploy: 'yes',
    envVars: baseEnvVars(),
    serviceDetails: {
      runtime: 'node',
      plan: 'free',
      region,
      healthCheckPath: '/health',
      maxShutdownDelaySeconds: 120,
      envSpecificDetails: {
        buildCommand: 'npm install',
        startCommand: 'node server.js',
      },
    },
  };

  console.log(`Creating web service "${serviceName}" from ${repo} ...`);
  const created = await api('POST', '/services', payload);
  const svc = created?.service || created;
  console.log('\nService created.');
  if (svc?.id) console.log('  Service ID:', svc.id);
  const url = svc?.serviceDetails?.url || svc?.url;
  if (url) console.log('  URL:', url);
  console.log('\nAdd optional secrets in Render Dashboard → Environment:');
  console.log('  GROQ_API_KEY, DATABASE_URL, PORTAL_PUBLIC_URL, SMTP_*');
  console.log('\nWhen DATABASE_URL is set, change AUTH_DISABLED to false.');
  console.log('First deploy may take 3–5 minutes.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
