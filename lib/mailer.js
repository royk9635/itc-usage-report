function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransporter() {
  if (!smtpConfigured()) {
    throw new Error('SMTP is not configured. Set SMTP_HOST and SMTP_FROM in .env.');
  }
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true';
  const auth = process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || '',
      }
    : undefined;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth,
  });
}

function siteLabel(siteCodes) {
  const codes = Array.isArray(siteCodes) ? siteCodes.filter(Boolean) : [];
  return codes.length ? codes.join(', ') : 'No site access assigned yet';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function accessRow(icon, label, value) {
  return `
    <tr>
      <td style="width:70px;padding:16px 16px 16px 0;border-bottom:1px solid #e7edf1;">
        <div style="width:44px;height:44px;border-radius:50%;background:#e9f7f8;color:#007184;text-align:center;line-height:44px;font-size:22px;">${icon}</div>
      </td>
      <td style="padding:16px 0;border-bottom:1px solid #e7edf1;">
        <div style="color:#071638;font-size:14px;font-weight:800;line-height:1.3;">${escapeHtml(label)}</div>
        <div style="color:#007184;font-size:14px;font-weight:800;line-height:1.5;margin-top:3px;">${escapeHtml(value)}</div>
      </td>
    </tr>
  `;
}

async function sendWelcomeEmail({ to, password, role, siteCodes }) {
  const portalUrl = process.env.PORTAL_PUBLIC_URL || `http://127.0.0.1:${Number(process.env.PORT) || 8000}/login`;
  const from = process.env.SMTP_FROM;
  const subject = 'Your ITC Analytics portal access';
  const safePortalUrl = escapeHtml(portalUrl);
  const safeSiteLabel = siteLabel(siteCodes);
  const text = [
    'Hello,',
    '',
    'Your access to the ITC Analytics / MSR Guest Behaviour Portal has been created.',
    '',
    `Portal: ${portalUrl}`,
    `Login email: ${to}`,
    `Temporary password: ${password}`,
    `Role: ${role}`,
    `Site access: ${siteLabel(siteCodes)}`,
    '',
    'Please sign in and change your password from the profile option.',
    '',
    'Regards,',
    'ITC Analytics Portal',
  ].join('\n');

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;padding:26px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:620px;max-width:100%;background:#ffffff;color:#071638;">
                <tr>
                  <td style="padding:0 28px 28px;">
                    <h1 style="margin:0 0 24px;text-align:center;color:#071638;font-size:30px;line-height:1.2;font-weight:900;">Your portal access is ready</h1>
                    <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 26px;">
                      <tr>
                        <td style="width:46px;height:1px;background:#168796;font-size:0;line-height:0;"></td>
                        <td style="width:18px;text-align:center;color:#168796;font-size:20px;line-height:1;">&bull;</td>
                        <td style="width:46px;height:1px;background:#168796;font-size:0;line-height:0;"></td>
                      </tr>
                    </table>

                    <p style="margin:0 0 18px;color:#071638;font-size:14px;line-height:1.6;">Hello,</p>
                    <p style="margin:0 0 28px;color:#071638;font-size:14px;line-height:1.7;">Your access to the <strong style="color:#007184;">ITC Analytics / MSR Guest Behaviour Portal</strong> has been created.</p>

                    <div style="text-align:center;color:#071638;font-size:15px;font-weight:900;margin-bottom:10px;">Login to your portal</div>
                    <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 22px;">
                      <tr>
                        <td style="background:#04123a;border-radius:8px;box-shadow:0 7px 16px rgba(4,18,58,.22);">
                          <a href="${safePortalUrl}" style="display:inline-block;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:13px 22px;border-radius:8px;">
                            <span style="font-size:20px;vertical-align:middle;">&#9678;</span>
                            <span style="vertical-align:middle;margin-left:10px;">${safePortalUrl}</span>
                          </a>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e3e8ed;border-radius:12px;background:#ffffff;box-shadow:0 7px 22px rgba(7,22,56,.08);padding:14px 30px;margin-bottom:16px;">
                      <tr>
                        <td>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            ${accessRow('&#9993;', 'Login email', to)}
                            ${accessRow('&#128274;', 'Temporary password', password)}
                            ${accessRow('&#9675;', 'Role', role)}
                            ${accessRow('&#9638;', 'Site access', safeSiteLabel)}
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e3e8ed;border-radius:12px;background:#ffffff;box-shadow:0 7px 22px rgba(7,22,56,.08);padding:14px 24px;">
                      <tr>
                        <td style="width:64px;padding:10px 14px 10px 0;">
                          <div style="width:48px;height:48px;border-radius:50%;background:#e9f7f8;color:#007184;text-align:center;line-height:48px;font-size:24px;">&#10003;</div>
                        </td>
                        <td style="width:1px;background:#c9d4da;font-size:0;line-height:0;"></td>
                        <td style="padding:10px 0 10px 18px;">
                          <div style="color:#071638;font-size:14px;font-weight:900;line-height:1.4;">Security note</div>
                          <div style="color:#071638;font-size:14px;line-height:1.5;">Please change your password after first login.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const info = await getTransporter().sendMail({ from, to, subject, text, html });
  return { messageId: info.messageId || '' };
}

module.exports = {
  smtpConfigured,
  sendWelcomeEmail,
};
