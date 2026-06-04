'use strict';
/**
 * Create or sync a Render Blueprint for this repo.
 *
 * Usage:
 *   export RENDER_API_KEY=rnd_...
 *   export GITHUB_REPO=https://github.com/OWNER/itc-usage-report
 *   node scripts/deploy-to-render.js
 */
const fs = require('fs');
const path = require('path');

const API = 'https://api.render.com/v1';
const ROOT = path.join(__dirname, '..');
const RENDER_YAML = path.join(ROOT, 'render.yaml');

const token = process.env.RENDER_API_KEY || process.env.RENDER;
const repo =
  process.env.GITHUB_REPO ||
  process.env.RENDER_REPO ||
  process.argv[2] ||
  '';

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

async function main() {
  if (!token) {
    console.error('Missing RENDER_API_KEY. Create one at https://dashboard.render.com/u/settings#api-keys');
    process.exit(1);
  }
  if (!repo) {
    console.error('Missing GITHUB_REPO (e.g. https://github.com/you/itc-usage-report)');
    process.exit(1);
  }
  if (!fs.existsSync(RENDER_YAML)) {
    console.error('render.yaml not found at project root');
    process.exit(1);
  }

  const owners = await api('GET', '/owners?limit=20');
  const ownerList = Array.isArray(owners) ? owners : owners?.items || [];
  const owner = ownerList[0]?.owner || ownerList[0];
  const ownerId = owner?.id;
  if (!ownerId) {
    throw new Error('Could not determine Render workspace ownerId');
  }
  console.log(`Using workspace: ${owner?.name || owner?.email || ownerId}`);

  const blueprintYaml = fs.readFileSync(RENDER_YAML, 'utf8');

  const payload = {
    name: 'itc-usage-report',
    ownerId,
    repo,
    branch: process.env.RENDER_BRANCH || 'main',
    autoSync: true,
    path: 'render.yaml',
    blueprintYaml,
  };

  console.log(`Creating Blueprint for ${repo} ...`);
  const created = await api('POST', '/blueprints', payload);
  const bp = created?.blueprint || created;
  console.log('\nBlueprint created.');
  if (bp?.id) console.log('  Blueprint ID:', bp.id);
  if (bp?.dashboardUrl) console.log('  Dashboard:', bp.dashboardUrl);
  console.log('\nNext: open the Render dashboard, set secret env vars (GROQ_API_KEY, DATABASE_URL), and wait for deploy.');
  console.log('Health check: https://YOUR-SERVICE.onrender.com/health');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
