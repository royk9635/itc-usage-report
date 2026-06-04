const path = require('path');

function loadEnvFile(filePath) {
  const fs = require('fs');
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

loadEnvFile(path.join(__dirname, '..', '.env'));

const db = require('../lib/db');
const { normalizeEmail, hashPassword } = require('../lib/auth');

async function main() {
  const email = normalizeEmail(process.argv[2] || process.env.SUPER_ADMIN_EMAIL);
  const password = String(process.argv[3] || process.env.SUPER_ADMIN_PASSWORD || '');
  if (!email || !email.includes('@') || password.length < 10) {
    console.error('Usage: node scripts/create-super-admin.js admin@example.com "StrongPassword123"');
    console.error('Password must be at least 10 characters.');
    process.exit(1);
  }
  await db.migrate();
  const existing = await db.query("SELECT count(*)::int AS n FROM users WHERE role = 'SUPER_ADMIN'");
  if (Number(existing.rows[0]?.n || 0) > 0) {
    console.error('A Super Admin already exists. Refusing to create another bootstrap account.');
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  const result = await db.query(
    `INSERT INTO users (email, password_hash, role, must_change_password)
     VALUES ($1, $2, 'SUPER_ADMIN', false)
     RETURNING id, email, role`,
    [email, passwordHash]
  );
  console.log('Created Super Admin:', result.rows[0].email);
  await db.getPool().end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
