const crypto = require('crypto');
const { query } = require('./db');

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'itc_session';
const SESSION_TTL_DAYS = Math.max(1, Number(process.env.SESSION_TTL_DAYS || 7));
const IS_PROD_SECURE = process.env.COOKIE_SECURE === 'true';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password || ''), salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const key = await scrypt(password, salt);
  return `scrypt$16384$8$1$${salt}$${key.toString('base64url')}`;
}

async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, expected] = parts;
  const key = await new Promise((resolve, reject) => {
    crypto.scrypt(String(password || ''), salt, 64, { N: Number(n), r: Number(r), p: Number(p) }, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
  const expectedBuf = Buffer.from(expected, 'base64url');
  return expectedBuf.length === key.length && crypto.timingSafeEqual(expectedBuf, key);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function parseCookies(req) {
  const out = {};
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function getSessionToken(req) {
  return parseCookies(req)[COOKIE_NAME] || '';
}

function sessionCookie(token, expiresAt) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (IS_PROD_SECURE) attrs.push('Secure');
  return attrs.join('; ');
}

function clearSessionCookie() {
  const attrs = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT'];
  if (IS_PROD_SECURE) attrs.push('Secure');
  return attrs.join('; ');
}

function publicUser(row, sites = []) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    sites,
  };
}

async function createSession(userId) {
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );
  return { token, expiresAt };
}

async function revokeSession(token) {
  if (!token) return;
  await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [hashToken(token)]);
}

async function loadUserFromRequest(req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const { rows } = await query(
    `SELECT u.*, s.id AS session_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.is_active = true
      LIMIT 1`,
    [hashToken(token)]
  );
  const user = rows[0] || null;
  if (user?.session_id) {
    await query('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [user.session_id]).catch(() => {});
  }
  return user;
}

function canManageUsers(user) {
  return user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN');
}

function isSuperAdmin(user) {
  return user?.role === 'SUPER_ADMIN';
}

function isAdminLike(user) {
  return user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
}

module.exports = {
  COOKIE_NAME,
  normalizeEmail,
  hashPassword,
  verifyPassword,
  hashToken,
  createSession,
  revokeSession,
  loadUserFromRequest,
  getSessionToken,
  sessionCookie,
  clearSessionCookie,
  publicUser,
  canManageUsers,
  isSuperAdmin,
  isAdminLike,
};
