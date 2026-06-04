/**
 * ITC Guest Behaviour Report — web app server.
 * Run: node server.js  →  http://127.0.0.1:8000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const { loadReportRange, API_URL, reportCache } = require('./lib/report-api');

loadEnvFile(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT) || 8000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.ITC_OPENAI_API_KEY || '';
const OPENAI_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.ITC_AI_MODEL || 'gpt-4o-mini';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const db = require('./lib/db');
const {
  normalizeEmail,
  hashPassword,
  verifyPassword,
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
} = require('./lib/auth');
const { recordLoginAudit, recordAdminAudit, recordActivityAudit } = require('./lib/audit');
const { filterBundleForUser, getAllowedSiteCodes } = require('./lib/access-control');
const { sendWelcomeEmail } = require('./lib/mailer');

const AUTH_ENABLED = process.env.AUTH_DISABLED !== 'true';

if (process.env.DATABASE_URL) {
  db.migrate().catch((err) => {
    console.error('Database migration failed:', err.message);
  });
} else if (AUTH_ENABLED) {
  console.warn('DATABASE_URL is not set. Auth-protected routes will return setup errors.');
}

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname = url.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    const orig = req.headers['x-vercel-original-url'] || req.headers['x-original-url'];
    if (orig && (pathname === '/api/index' || pathname === '/api')) {
      try {
        const p = orig.includes('://') ? new URL(orig).pathname : String(orig).split('?')[0];
        pathname = (p.replace(/\/$/, '') || '/');
        if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
      } catch (_) { /* keep rewritten pathname */ }
    }

    if (req.method === 'GET' && pathname === '/health') {
      const chatProviders = getConfiguredChatProviders();
      sendJson(res, 200, {
        ok: true,
        ai: chatProviders.length ? 'openai-compatible' : 'local',
        aiProviders: chatProviders.map((p) => p.name),
        port: PORT,
        model: chatProviders[0]?.model || OPENAI_MODEL,
        reportApi: '/api/report/load',
        auth: AUTH_ENABLED ? 'enabled' : 'disabled',
        database: process.env.DATABASE_URL ? 'configured' : 'missing',
        reportCache: reportCache.getStats(),
        version: 2,
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      await handleLogin(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      await handleLogout(req, res);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/auth/me') {
      await handleMe(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/change-password') {
      const user = await requireAuth(req, res);
      if (!user) return;
      await handleChangePassword(req, res, user);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/audit/activity') {
      const user = await requireAuth(req, res);
      if (!user) return;
      await handleActivityAudit(req, res, user);
      return;
    }

    if (pathname.startsWith('/api/admin/')) {
      const user = await requireAuth(req, res);
      if (!user) return;
      await handleAdminApi(req, res, user, pathname, url);
      return;
    }

    if (pathname.startsWith('/api/super-admin/')) {
      const user = await requireAuth(req, res);
      if (!user) return;
      if (!isSuperAdmin(user)) {
        sendJson(res, 403, { error: 'Super Admin access required' });
        return;
      }
      await handleSuperAdminApi(req, res, user, pathname, url);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/chat') {
      const user = await requireAuth(req, res);
      if (!user) return;
      await handleChat(req, res, user);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/report/load') {
      const user = await requireAuth(req, res);
      if (!user) return;
      await handleReportLoad(req, res, user);
      return;
    }

    if (req.method === 'GET' && pathname === '/login') {
      if (!AUTH_ENABLED) {
        redirect(res, '/index.html');
        return;
      }
      serveFile(res, path.join(ROOT, 'public', 'login.html'));
      return;
    }

    if (req.method === 'GET' && pathname === '/admin') {
      const user = await requireAuth(req, res);
      if (!user) return;
      if (!canManageUsers(user)) {
        sendText(res, 403, 'Forbidden');
        return;
      }
      await recordActivityAudit(req, user, { action: 'ADMIN_VIEW', page: '/admin', label: 'Access Management' });
      serveFile(res, path.join(ROOT, 'public', 'admin.html'));
      return;
    }

    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      if (AUTH_ENABLED) {
        const user = await loadUserFromRequest(req).catch(() => null);
        if (!user) {
          redirect(res, '/login');
          return;
        }
      }
      serveFile(res, path.join(ROOT, 'index.html'));
      return;
    }

    if (req.method === 'GET' && (pathname === '/download/report' || pathname === '/download')) {
      const user = await requireAuth(req, res);
      if (!user) return;
      await recordActivityAudit(req, user, { action: 'DOWNLOAD_REPORT', page: pathname, label: 'Download report' });
      const exportName = 'ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html';
      const exportPath = path.join(ROOT, exportName);
      const filePath = fs.existsSync(exportPath) ? exportPath : path.join(ROOT, 'index.html');
      const downloadAs = fs.existsSync(exportPath) ? exportName : 'ITC_usage_report.html';
      serveFileAttachment(res, filePath, downloadAs);
      return;
    }

    if (req.method === 'GET') {
      const rel = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
      const filePath = path.join(ROOT, rel);
      if (!filePath.startsWith(ROOT)) {
        sendText(res, 403, 'Forbidden');
        return;
      }
      const base = path.basename(filePath).toLowerCase();
      if (base.startsWith('.') || base === '.env' || base === 'server.js' || base === 'app.py') {
        sendText(res, 404, 'Not found');
        return;
      }
      if (path.extname(filePath).toLowerCase() === '.html' && pathname !== '/public/login.html') {
        const user = await requireAuth(req, res);
        if (!user) return;
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        serveFile(res, filePath);
        return;
      }
    }

    sendText(res, 404, 'Not found');
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err.message || 'Server error' });
  }
}

module.exports = handleRequest;

if (require.main === module) {
  http.createServer(handleRequest).listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ITC Guest Behaviour Report');
    console.log(`  → http://127.0.0.1:${PORT}`);
    console.log(`  Data: POST ${API_URL}`);
    const providers = getConfiguredChatProviders();
    console.log(`  AI: ${providers.length ? providers.map((p) => `${p.name} (${p.model})`).join(' → ') : 'local insight (set OPENAI_API_KEY for full AI)'}`);
    console.log('');
  });
}

async function requireAuth(req, res) {
  if (!AUTH_ENABLED) return { id: 'auth-disabled', email: 'local', role: 'SUPER_ADMIN', is_active: true };
  if (!process.env.DATABASE_URL) {
    sendJson(res, 503, { error: 'Authentication database is not configured. Set DATABASE_URL and restart.' });
    return null;
  }
  try {
    const user = await loadUserFromRequest(req);
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required' });
      return null;
    }
    return user;
  } catch (err) {
    console.error('Auth check failed:', err.message);
    sendJson(res, 503, { error: 'Authentication service unavailable' });
    return null;
  }
}

async function readJson(req) {
  const body = await readBody(req);
  try {
    return JSON.parse(body || '{}');
  } catch {
    const err = new Error('Invalid JSON body');
    err.statusCode = 400;
    throw err;
  }
}

async function handleLogin(req, res) {
  if (!process.env.DATABASE_URL) {
    sendJson(res, 503, { error: 'Authentication database is not configured. Set DATABASE_URL and restart.' });
    return;
  }
  let payload;
  try {
    payload = await readJson(req);
  } catch (err) {
    sendJson(res, err.statusCode || 400, { error: err.message });
    return;
  }
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  let user = null;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    user = result.rows[0] || null;
    if (!user || !user.is_active) {
      await recordLoginAudit(req, { email, status: 'failed', failureReason: 'invalid_credentials' });
      sendJson(res, 401, { error: 'Invalid email or password' });
      return;
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      await recordLoginAudit(req, { userId: user.id, email, roleAtLogin: user.role, status: 'failed', failureReason: 'invalid_credentials' });
      sendJson(res, 401, { error: 'Invalid email or password' });
      return;
    }
    const session = await createSession(user.id);
    await recordLoginAudit(req, { userId: user.id, email, roleAtLogin: user.role, status: 'success' });
    await recordActivityAudit(req, user, { action: 'LOGIN', page: '/login', label: 'User login' });
    const sites = await sitesForUser(user);
    sendJson(res, 200, { user: publicUser(user, sites) }, { 'Set-Cookie': sessionCookie(session.token, session.expiresAt) });
  } catch (err) {
    console.error('Login failed:', err.message);
    if (email) await recordLoginAudit(req, { userId: user?.id, email, roleAtLogin: user?.role, status: 'failed', failureReason: 'server_error' });
    sendJson(res, 500, { error: 'Login failed' });
  }
}

async function handleLogout(req, res) {
  const user = AUTH_ENABLED ? await loadUserFromRequest(req).catch(() => null) : null;
  if (user) await recordActivityAudit(req, user, { action: 'LOGOUT', page: '/logout', label: 'User logout' });
  await revokeSession(getSessionToken(req)).catch(() => {});
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
}

async function handleMe(req, res) {
  if (!AUTH_ENABLED) {
    sendJson(res, 200, {
      user: {
        id: 'auth-disabled',
        email: 'local',
        role: 'SUPER_ADMIN',
        isActive: true,
        mustChangePassword: false,
        sites: [],
      },
    });
    return;
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  const sites = await sitesForUser(user);
  sendJson(res, 200, { user: publicUser(user, sites) });
}

async function sitesForUser(user) {
  if (isAdminLike(user)) {
    const { rows } = await db.query('SELECT site_code, site_name, brand, is_all_sites FROM sites ORDER BY is_all_sites DESC, site_name');
    return rows.map((s) => ({ id: s.site_code, name: s.site_name, brand: s.brand, isAllSites: s.is_all_sites }));
  }
  const { rows } = await db.query(
    `SELECT s.site_code, s.site_name, s.brand, s.is_all_sites
       FROM user_site_access usa
       JOIN sites s ON s.id = usa.site_id
      WHERE usa.user_id = $1
      ORDER BY s.is_all_sites DESC, s.site_name`,
    [user.id]
  );
  return rows.map((s) => ({ id: s.site_code, name: s.site_name, brand: s.brand, isAllSites: s.is_all_sites }));
}

async function handleChangePassword(req, res, user) {
  let payload;
  try {
    payload = await readJson(req);
  } catch (err) {
    sendJson(res, err.statusCode || 400, { error: err.message });
    return;
  }
  const currentPassword = String(payload.currentPassword || '');
  const newPassword = String(payload.newPassword || '');
  if (newPassword.length < 10) {
    sendJson(res, 400, { error: 'New password must be at least 10 characters.' });
    return;
  }
  const ok = await verifyPassword(currentPassword, user.password_hash);
  if (!ok) {
    sendJson(res, 400, { error: 'Current password is incorrect.' });
    return;
  }
  const nextHash = await hashPassword(newPassword);
  await db.query('UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2', [nextHash, user.id]);
  await recordAdminAudit({ actorUserId: user.id, action: 'CHANGE_OWN_PASSWORD', targetUserId: user.id });
  await recordActivityAudit(req, user, { action: 'CHANGE_PASSWORD', page: '/index.html', label: 'Change password' });
  sendJson(res, 200, { ok: true });
}

async function handleActivityAudit(req, res, user) {
  const payload = await readJson(req).catch((err) => ({ __error: err }));
  if (payload.__error) {
    sendJson(res, 400, { error: payload.__error.message });
    return;
  }
  const allowedActions = new Set([
    'NAVIGATION',
    'VIEW_CHANGE',
    'FILTER_CHANGE',
    'EXPORT_PRINT',
    'ROOM_SEARCH',
    'CHAT_OPEN',
    'ADMIN_VIEW',
  ]);
  const action = String(payload.action || '').trim().toUpperCase();
  if (!allowedActions.has(action)) {
    sendJson(res, 400, { error: 'Unsupported activity action.' });
    return;
  }
  await recordActivityAudit(req, user, {
    action,
    page: payload.page || null,
    label: payload.label || null,
    details: typeof payload.details === 'object' && payload.details ? payload.details : {},
  });
  sendJson(res, 200, { ok: true });
}

async function handleReportLoad(req, res, user) {
  const body = await readBody(req);
  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }
  const startDate = String(payload.startDate || '').trim();
  const endDate = String(payload.endDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    sendJson(res, 400, { error: 'startDate and endDate must be YYYY-MM-DD' });
    return;
  }
  if (startDate > endDate) {
    sendJson(res, 400, { error: 'startDate must be on or before endDate' });
    return;
  }
  try {
    const refresh = payload.refresh === true;
    const { bundle, cacheServer } = await loadReportRange({ startDate, endDate, refresh });
    const filtered = await filterBundleForUser(bundle, user, {
      syncSites: cacheServer !== 'hit',
    });
    await recordActivityAudit(req, user, {
      action: 'REPORT_LOAD',
      page: '/index.html',
      label: 'Report data load',
      details: {
        startDate,
        endDate,
        monthKey: filtered.monthKey,
        rowCount: filtered.rowCount,
        cacheServer,
        refresh,
      },
    });
    sendJson(res, 200, { ...filtered, cache: { server: cacheServer } });
  } catch (err) {
    console.error('Report load failed:', err.message);
    sendJson(res, 502, { error: err.message || 'Report API failed' });
  }
}

async function handleAdminApi(req, res, user, pathname, url) {
  if (!canManageUsers(user)) {
    sendJson(res, 403, { error: 'Admin access required' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/admin/sites') {
    const { rows } = await db.query('SELECT id, site_code, site_name, brand, is_all_sites FROM sites ORDER BY is_all_sites DESC, site_name');
    sendJson(res, 200, { sites: rows });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/admin/users') {
    const { rows } = await db.query(
      `SELECT id, email, role, is_active, must_change_password, created_at, updated_at, disabled_at
         FROM users
        ORDER BY created_at DESC`
    );
    sendJson(res, 200, { users: rows.filter((u) => isSuperAdmin(user) || u.role !== 'SUPER_ADMIN') });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/admin/users') {
    const payload = await readJson(req).catch((err) => ({ __error: err }));
    if (payload.__error) {
      sendJson(res, 400, { error: payload.__error.message });
      return;
    }
    const email = normalizeEmail(payload.email);
    const role = String(payload.role || 'SITE_USER').toUpperCase();
    const password = String(payload.password || '');
    if (!email || !email.includes('@')) {
      sendJson(res, 400, { error: 'Valid email is required.' });
      return;
    }
    if (password.length < 10) {
      sendJson(res, 400, { error: 'Temporary password must be at least 10 characters.' });
      return;
    }
    if (!['SUPER_ADMIN', 'ADMIN', 'SITE_USER'].includes(role)) {
      sendJson(res, 400, { error: 'Invalid role.' });
      return;
    }
    if (!isSuperAdmin(user) && role !== 'SITE_USER') {
      sendJson(res, 403, { error: 'Only Super Admin can create Admin or Super Admin users.' });
      return;
    }
    const existingUser = await db.query('SELECT id, email, role, is_active FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existingUser.rows[0]) {
      sendJson(res, 409, {
        error: 'This email already exists. Enable the existing user or reset the password instead.',
        existingUser: {
          id: existingUser.rows[0].id,
          email: existingUser.rows[0].email,
          role: existingUser.rows[0].role,
          isActive: existingUser.rows[0].is_active,
        },
      });
      return;
    }
    const passwordHash = await hashPassword(password);
    const created = await db.transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO users (email, password_hash, role, must_change_password, created_by)
         VALUES ($1, $2, $3, true, $4)
         RETURNING id, email, role, is_active, must_change_password, created_at`,
        [email, passwordHash, role, user.id]
      );
      const createdUser = result.rows[0];
      for (const siteCode of payload.siteCodes || []) {
        const site = await client.query('SELECT id FROM sites WHERE site_code = $1', [siteCode]);
        if (site.rows[0]) {
          await client.query(
            `INSERT INTO user_site_access (user_id, site_id, granted_by)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [createdUser.id, site.rows[0].id, user.id]
          );
        }
      }
      return createdUser;
    });
    await recordAdminAudit({ actorUserId: user.id, action: 'CREATE_USER', targetUserId: created.id, details: { email, role } });
    await recordActivityAudit(req, user, { action: 'CREATE_USER', page: '/admin', label: 'Create user', details: { email, role } });
    let welcomeEmail = { sent: false };
    try {
      const result = await sendWelcomeEmail({ to: email, password, role, siteCodes: payload.siteCodes || [] });
      welcomeEmail = { sent: true, messageId: result.messageId };
      await recordAdminAudit({ actorUserId: user.id, action: 'SEND_WELCOME_EMAIL', targetUserId: created.id, details: { email } });
    } catch (err) {
      welcomeEmail = { sent: false, error: err.message || 'Welcome email could not be sent.' };
      await recordAdminAudit({
        actorUserId: user.id,
        action: 'WELCOME_EMAIL_FAILED',
        targetUserId: created.id,
        details: { email, error: welcomeEmail.error },
      });
    }
    sendJson(res, 201, { user: created, welcomeEmail });
    return;
  }

  const userSiteMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/sites$/);
  if (userSiteMatch) {
    const targetUserId = userSiteMatch[1];
    const target = await getUserById(targetUserId);
    if (!target) {
      sendJson(res, 404, { error: 'User not found' });
      return;
    }
    if (!isSuperAdmin(user) && target.role === 'SUPER_ADMIN') {
      sendJson(res, 403, { error: 'Admin cannot manage Super Admin access.' });
      return;
    }
    if (req.method === 'GET') {
      const { rows } = await db.query(
        `SELECT s.site_code, s.site_name, s.brand, s.is_all_sites
           FROM user_site_access usa
           JOIN sites s ON s.id = usa.site_id
          WHERE usa.user_id = $1
          ORDER BY s.is_all_sites DESC, s.site_name`,
        [targetUserId]
      );
      sendJson(res, 200, { sites: rows });
      return;
    }
    if (req.method === 'PUT') {
      const payload = await readJson(req).catch((err) => ({ __error: err }));
      if (payload.__error) {
        sendJson(res, 400, { error: payload.__error.message });
        return;
      }
      const siteCodes = Array.isArray(payload.siteCodes) ? payload.siteCodes.map(String) : [];
      await db.transaction(async (client) => {
        await client.query('DELETE FROM user_site_access WHERE user_id = $1', [targetUserId]);
        for (const code of siteCodes) {
          const site = await client.query('SELECT id FROM sites WHERE site_code = $1', [code]);
          if (!site.rows[0]) continue;
          await client.query(
            `INSERT INTO user_site_access (user_id, site_id, granted_by)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [targetUserId, site.rows[0].id, user.id]
          );
        }
      });
      await recordAdminAudit({ actorUserId: user.id, action: 'SET_SITE_ACCESS', targetUserId, details: { siteCodes } });
      await recordActivityAudit(req, user, { action: 'SET_SITE_ACCESS', page: '/admin', label: 'Set site access', details: { targetUserId, siteCodes } });
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  const userMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch) {
    const targetUserId = userMatch[1];
    const target = await getUserById(targetUserId);
    if (!target) {
      sendJson(res, 404, { error: 'User not found' });
      return;
    }
    if (!isSuperAdmin(user) && target.role === 'SUPER_ADMIN') {
      sendJson(res, 403, { error: 'Admin cannot manage Super Admin users.' });
      return;
    }
    if (req.method === 'PATCH') {
      const payload = await readJson(req).catch((err) => ({ __error: err }));
      if (payload.__error) {
        sendJson(res, 400, { error: payload.__error.message });
        return;
      }
      const nextRole = payload.role ? String(payload.role).toUpperCase() : target.role;
      if (!['SUPER_ADMIN', 'ADMIN', 'SITE_USER'].includes(nextRole)) {
        sendJson(res, 400, { error: 'Invalid role.' });
        return;
      }
      if (!isSuperAdmin(user) && nextRole !== target.role) {
        sendJson(res, 403, { error: 'Only Super Admin can change roles.' });
        return;
      }
      if (!isSuperAdmin(user) && payload.isActive === false) {
        sendJson(res, 403, { error: 'Only Super Admin can disable users.' });
        return;
      }
      const nextEmail = payload.email ? normalizeEmail(payload.email) : target.email;
      const nextActive = typeof payload.isActive === 'boolean' ? payload.isActive : target.is_active;
      if (target.role === 'SUPER_ADMIN' && target.is_active && (nextRole !== 'SUPER_ADMIN' || nextActive === false)) {
        const count = await db.query("SELECT count(*)::int AS n FROM users WHERE role = 'SUPER_ADMIN' AND is_active = true");
        if (Number(count.rows[0]?.n || 0) <= 1) {
          sendJson(res, 400, { error: 'Cannot remove the last active Super Admin.' });
          return;
        }
      }
      await db.query(
        `UPDATE users
            SET email = $1, role = $2, is_active = $3, disabled_at = CASE WHEN $3 = false THEN now() ELSE NULL END, updated_at = now()
          WHERE id = $4`,
        [nextEmail, nextRole, nextActive, targetUserId]
      );
      if (payload.password) {
        if (String(payload.password).length < 10) {
          sendJson(res, 400, { error: 'Password must be at least 10 characters.' });
          return;
        }
        await db.query('UPDATE users SET password_hash = $1, must_change_password = true, updated_at = now() WHERE id = $2', [
          await hashPassword(String(payload.password)),
          targetUserId,
        ]);
      }
      await recordAdminAudit({ actorUserId: user.id, action: 'UPDATE_USER', targetUserId, details: { email: nextEmail, role: nextRole, isActive: nextActive } });
      await recordActivityAudit(req, user, {
        action: 'UPDATE_USER',
        page: '/admin',
        label: 'Update user',
        details: { targetUserId, email: nextEmail, role: nextRole, isActive: nextActive },
      });
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === 'DELETE') {
      if (!isSuperAdmin(user)) {
        sendJson(res, 403, { error: 'Only Super Admin can delete users.' });
        return;
      }
      if (target.role === 'SUPER_ADMIN') {
        const count = await db.query("SELECT count(*)::int AS n FROM users WHERE role = 'SUPER_ADMIN' AND is_active = true");
        if (Number(count.rows[0]?.n || 0) <= 1) {
          sendJson(res, 400, { error: 'Cannot delete or disable the last active Super Admin.' });
          return;
        }
      }
      await db.query('DELETE FROM users WHERE id = $1', [targetUserId]);
      await recordAdminAudit({ actorUserId: user.id, action: 'DELETE_USER', targetUserId });
      await recordActivityAudit(req, user, { action: 'DELETE_USER', page: '/admin', label: 'Delete user', details: { targetUserId } });
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  sendJson(res, 404, { error: 'Admin endpoint not found' });
}

async function handleSuperAdminApi(req, res, user, pathname, url) {
  const startDate = url.searchParams.get('startDate') || '1970-01-01';
  const endDate = url.searchParams.get('endDate') || '2999-12-31';
  if (req.method === 'GET' && pathname === '/api/super-admin/login-audit') {
    const { rows } = await db.query(
      `SELECT id, user_id, email, role_at_login, status, failure_reason, ip_address, user_agent, created_at
         FROM login_audit
        WHERE created_at::date BETWEEN $1::date AND $2::date
        ORDER BY created_at DESC
        LIMIT 1000`,
      [startDate, endDate]
    );
    sendJson(res, 200, { rows });
    return;
  }
  if (req.method === 'GET' && pathname === '/api/super-admin/login-summary') {
    const { rows } = await db.query(
      `SELECT coalesce(user_id::text, '') AS user_id, email, role_at_login, count(*)::int AS login_count
         FROM login_audit
        WHERE status = 'success'
          AND created_at::date BETWEEN $1::date AND $2::date
        GROUP BY user_id, email, role_at_login
        ORDER BY login_count DESC, email`,
      [startDate, endDate]
    );
    sendJson(res, 200, { rows });
    return;
  }
  if (req.method === 'GET' && pathname === '/api/super-admin/admin-audit') {
    const { rows } = await db.query(
      `SELECT aa.*, actor.email AS actor_email, target.email AS target_email, s.site_code
         FROM admin_audit aa
         LEFT JOIN users actor ON actor.id = aa.actor_user_id
         LEFT JOIN users target ON target.id = aa.target_user_id
         LEFT JOIN sites s ON s.id = aa.site_id
        WHERE aa.created_at::date BETWEEN $1::date AND $2::date
        ORDER BY aa.created_at DESC
        LIMIT 1000`,
      [startDate, endDate]
    );
    sendJson(res, 200, { rows });
    return;
  }
  if (req.method === 'GET' && pathname === '/api/super-admin/activity-audit') {
    const { rows } = await db.query(
      `SELECT id, user_id, email, role_at_action, action, page, label, details_json, ip_address, created_at
         FROM activity_audit
        WHERE created_at::date BETWEEN $1::date AND $2::date
        ORDER BY created_at DESC
        LIMIT 1000`,
      [startDate, endDate]
    );
    sendJson(res, 200, { rows });
    return;
  }
  if (req.method === 'GET' && pathname === '/api/super-admin/activity-daily-summary') {
    const { rows } = await db.query(
      `SELECT created_at::date AS activity_date,
              coalesce(user_id::text, '') AS user_id,
              email,
              role_at_action,
              count(*)::int AS action_count,
              count(*) FILTER (WHERE action = 'REPORT_LOAD')::int AS report_loads,
              count(*) FILTER (WHERE action = 'DOWNLOAD_REPORT')::int AS downloads,
              count(*) FILTER (WHERE action = 'CHAT_REQUEST')::int AS chat_requests,
              count(*) FILTER (WHERE action LIKE 'ADMIN_%' OR action IN ('CREATE_USER','UPDATE_USER','DELETE_USER','SET_SITE_ACCESS'))::int AS admin_actions,
              string_agg(DISTINCT action, ', ' ORDER BY action) AS actions
         FROM activity_audit
        WHERE created_at::date BETWEEN $1::date AND $2::date
        GROUP BY created_at::date, user_id, email, role_at_action
        ORDER BY activity_date DESC, action_count DESC, email
        LIMIT 1000`,
      [startDate, endDate]
    );
    sendJson(res, 200, { rows });
    return;
  }
  if (req.method === 'GET' && pathname === '/api/super-admin/activity-overall-summary') {
    const totals = await db.query(
      `SELECT count(*)::int AS total_actions,
              count(DISTINCT user_id)::int AS active_users,
              count(*) FILTER (WHERE action = 'LOGIN')::int AS logins,
              count(*) FILTER (WHERE action = 'REPORT_LOAD')::int AS report_loads,
              count(*) FILTER (WHERE action = 'DOWNLOAD_REPORT')::int AS downloads,
              count(*) FILTER (WHERE action = 'CHAT_REQUEST')::int AS chat_requests,
              count(*) FILTER (WHERE action LIKE 'ADMIN_%' OR action IN ('CREATE_USER','UPDATE_USER','DELETE_USER','SET_SITE_ACCESS'))::int AS admin_actions
         FROM activity_audit
        WHERE created_at::date BETWEEN $1::date AND $2::date`,
      [startDate, endDate]
    );
    const byAction = await db.query(
      `SELECT action, count(*)::int AS count
         FROM activity_audit
        WHERE created_at::date BETWEEN $1::date AND $2::date
        GROUP BY action
        ORDER BY count DESC, action
        LIMIT 20`,
      [startDate, endDate]
    );
    sendJson(res, 200, { totals: totals.rows[0] || {}, byAction: byAction.rows });
    return;
  }
  sendJson(res, 404, { error: 'Super Admin endpoint not found' });
}

async function getUserById(id) {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

function resolveUpstreamModel(requested, fallbackModel = OPENAI_MODEL) {
  const m = String(requested || '').trim();
  if (!m || m === 'local-report-insight' || /^local-/i.test(m)) return fallbackModel;
  return m;
}

function getConfiguredChatProviders(requestedModel) {
  const providers = [];
  if (OPENAI_API_KEY) {
    providers.push({
      name: process.env.OPENAI_PROVIDER_NAME || (process.env.GROQ_API_KEY ? 'Groq' : 'Primary AI'),
      baseUrl: OPENAI_BASE,
      apiKey: OPENAI_API_KEY,
      model: resolveUpstreamModel(requestedModel, OPENAI_MODEL),
    });
  }
  if (OPENROUTER_API_KEY) {
    providers.push({
      name: 'OpenRouter',
      baseUrl: OPENROUTER_BASE,
      apiKey: OPENROUTER_API_KEY,
      model: resolveUpstreamModel('', OPENROUTER_MODEL),
      referer: process.env.OPENROUTER_HTTP_REFERER || process.env.PORTAL_PUBLIC_URL || `http://127.0.0.1:${PORT}`,
      title: process.env.OPENROUTER_APP_TITLE || 'ITC Analytics Portal',
    });
  }
  return providers;
}

function shouldTryNextProvider(status) {
  return status === 402 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function callChatProvider(provider, payload) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.apiKey}`,
  };
  if (provider.referer) headers['HTTP-Referer'] = provider.referer;
  if (provider.title) headers['X-Title'] = provider.title;
  return fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.model,
      temperature: payload.temperature ?? 0.2,
      messages: payload.messages || [],
    }),
  });
}

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

async function handleChat(req, res, user) {
  const body = await readBody(req);
  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch {
    sendJson(res, 400, { error: { message: 'Invalid JSON body' } });
    return;
  }

  await recordActivityAudit(req, user, {
    action: 'CHAT_REQUEST',
    page: '/index.html',
    label: 'Room chatbot',
    details: { messageCount: Array.isArray(payload.messages) ? payload.messages.length : 0 },
  });

  const auth = String(req.headers.authorization || '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const providers = getConfiguredChatProviders(payload.model);
  if (bearer) {
    providers.unshift({
      name: 'Request AI',
      baseUrl: OPENAI_BASE,
      apiKey: bearer,
      model: resolveUpstreamModel(payload.model, OPENAI_MODEL),
    });
  }

  if (providers.length) {
    let lastResponse = null;
    let lastError = null;
    for (const provider of providers) {
      try {
        const upstream = await callChatProvider(provider, payload);
        const text = await upstream.text();
        if (upstream.ok || !shouldTryNextProvider(upstream.status)) {
          res.writeHead(upstream.status, {
            'Content-Type': 'application/json; charset=utf-8',
            'X-ITC-AI-Provider': provider.name,
          });
          res.end(text);
          return;
        }
        lastResponse = { status: upstream.status, text, provider: provider.name };
        console.warn(`AI provider ${provider.name} returned ${upstream.status}; trying fallback provider.`);
      } catch (err) {
        lastError = err;
        console.warn(`AI provider ${provider.name} failed: ${err.message}`);
      }
    }
    if (lastResponse) {
      res.writeHead(lastResponse.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(lastResponse.text);
      return;
    }
    if (lastError) {
      sendJson(res, 502, { error: { message: `All AI providers failed: ${lastError.message}` } });
      return;
    }
  }

  const content = buildLocalInsight(payload.messages || []);
  sendJson(res, 200, {
    id: 'local-report-insight',
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
  });
}

function buildLocalInsight(messages) {
  const user = [...messages].reverse().find((m) => m && m.role === 'user');
  const raw = String(user?.content || '').trim();
  const ctx = extractContextJson(raw);
  if (!ctx) {
    return [
      '**Local insight mode** (no OpenAI API key configured).',
      '',
      'Add `OPENAI_API_KEY` to a `.env` file and restart the server for full AI answers.',
      '',
      'Charts, compare, and rule-based room summaries still work.',
    ].join('\n');
  }

  const sel = ctx.selection || {};
  const totals = ctx.totals || {};
  const site = sel.site || sel.siteId || 'the selected site';
  const room = sel.room || 'the selected room';
  const lines = [
    `**Room insight** — ${room} @ ${site}`,
    `Period: ${sel.startDate || '—'} to ${sel.endDate || '—'}`,
    '',
    `- **Total viewing:** ${fmtNum(totals.totalViewingMinutes)} minutes across ${fmtNum(totals.activeDays)} active day(s)`,
    `- **Events / sessions:** ${fmtNum(totals.totalEventsOrSessions)}`,
  ];
  if (totals.peakDate) {
    lines.push(`- **Peak day:** ${totals.peakDate} (${fmtNum(totals.peakCount)} events)`);
  }
  if (Array.isArray(ctx.byCategory) && ctx.byCategory.length) {
    lines.push('', '**By category:**');
    const sorted = [...ctx.byCategory].sort(
      (a, b) => Number(b.durationMinutes || 0) - Number(a.durationMinutes || 0)
    );
    for (const row of sorted.slice(0, 6)) {
      if (!row.count && !row.durationMinutes) continue;
      lines.push(
        `- **${row.category}:** ${fmtNum(row.durationMinutes)} min, ${fmtNum(row.count)} events`
      );
    }
  }
  if (Array.isArray(ctx.topItems) && ctx.topItems.length) {
    lines.push('', '**Top items:**');
    for (const item of ctx.topItems.slice(0, 5)) {
      lines.push(`- ${item.name || item.label}: ${fmtNum(item.minutes || item.count)}`);
    }
  }
  lines.push(
    '',
    '_Generated in local mode. Set `OPENAI_API_KEY` in `.env` for richer natural-language analysis._'
  );
  return lines.join('\n');
}

function extractContextJson(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  return x.toLocaleString('en-IN', { maximumFractionDigits: 1 });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
}

function serveFileAttachment(res, filePath, downloadName) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const safeName = String(downloadName || path.basename(filePath)).replace(/[^\w.\- ]+/g, '_');
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${safeName}"`,
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, code, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(body);
}

function sendText(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}
