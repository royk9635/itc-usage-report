const { query } = require('./db');

function requestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || '';
}

function userAgent(req) {
  return String(req.headers['user-agent'] || '');
}

async function recordLoginAudit(req, { userId = null, email, roleAtLogin = null, status, failureReason = null }) {
  await query(
    `INSERT INTO login_audit (user_id, email, role_at_login, status, failure_reason, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, email || '', roleAtLogin, status, failureReason, requestIp(req), userAgent(req)]
  ).catch((err) => {
    console.error('Login audit failed:', err.message);
  });
}

async function recordAdminAudit({ actorUserId, action, targetUserId = null, siteId = null, details = {} }) {
  await query(
    `INSERT INTO admin_audit (actor_user_id, action, target_user_id, site_id, details_json)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actorUserId || null, action, targetUserId, siteId, JSON.stringify(details || {})]
  ).catch((err) => {
    console.error('Admin audit failed:', err.message);
  });
}

async function recordActivityAudit(req, user, { action, page = null, label = null, details = {} }) {
  if (!user || !action) return;
  const userId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(user.id || ''))
    ? user.id
    : null;
  await query(
    `INSERT INTO activity_audit (user_id, email, role_at_action, action, page, label, details_json, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
    [
      userId,
      user.email || '',
      user.role || null,
      String(action).slice(0, 80),
      page ? String(page).slice(0, 120) : null,
      label ? String(label).slice(0, 160) : null,
      JSON.stringify(details || {}),
      requestIp(req),
      userAgent(req),
    ]
  ).catch((err) => {
    console.error('Activity audit failed:', err.message);
  });
}

module.exports = {
  recordLoginAudit,
  recordAdminAudit,
  recordActivityAudit,
};
