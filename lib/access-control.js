const { query, transaction } = require('./db');
const { isAdminLike } = require('./auth');

const ALL_SITE_CODE = 'ALL';

function normalizeSiteId(id) {
  return String(id || '').trim();
}

async function upsertSitesFromBundle(bundle) {
  const report = bundle?.reports?.[bundle.monthKey] || Object.values(bundle?.reports || {})[0];
  const sites = Array.isArray(report?.site_list) ? report.site_list : [];
  if (!sites.length) return;
  await transaction(async (client) => {
    for (const site of sites) {
      const code = normalizeSiteId(site.id);
      if (!code) continue;
      await client.query(
        `INSERT INTO sites (site_code, site_name, brand, is_all_sites)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (site_code)
         DO UPDATE SET site_name = EXCLUDED.site_name, brand = EXCLUDED.brand, is_all_sites = EXCLUDED.is_all_sites`,
        [code, site.name || code, site.brand || null, code === ALL_SITE_CODE]
      );
    }
  });
}

async function getAllowedSiteCodes(user) {
  if (!user) return new Set();
  if (isAdminLike(user)) return null; // null means all sites.
  const { rows } = await query(
    `SELECT s.site_code
       FROM user_site_access usa
       JOIN sites s ON s.id = usa.site_id
      WHERE usa.user_id = $1`,
    [user.id]
  );
  return new Set(rows.map((r) => r.site_code));
}

function hasAllSitesAccess(allowed) {
  return allowed === null || allowed.has(ALL_SITE_CODE);
}

function filterMapObject(obj, allowed, includeAll) {
  if (!obj || allowed === null) return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === ALL_SITE_CODE ? includeAll : allowed.has(key)) out[key] = value;
  }
  return out;
}

function filterReport(report, allowed) {
  if (!report || allowed === null) return report;
  const includeAll = hasAllSitesAccess(allowed);
  const next = { ...report };
  next.site_list = (report.site_list || []).filter((s) => (s.id === ALL_SITE_CODE ? includeAll : allowed.has(s.id)));
  next.selections = filterMapObject(report.selections, allowed, includeAll);
  return next;
}

function filterRawDaily(rawDaily, allowed) {
  if (!rawDaily || allowed === null) return rawDaily;
  const includeAll = hasAllSitesAccess(allowed);
  const out = {};
  for (const [monthKey, month] of Object.entries(rawDaily)) {
    out[monthKey] = {
      ...month,
      sites: filterMapObject(month.sites, allowed, includeAll),
      all: includeAll ? month.all : {},
    };
  }
  return out;
}

function filterEnhanced(enhanced, allowed) {
  if (!enhanced || allowed === null) return enhanced;
  const includeAll = hasAllSitesAccess(allowed);
  const keepSite = (id) => (id === ALL_SITE_CODE ? includeAll : allowed.has(id));
  const next = { ...enhanced };
  next.sites = (enhanced.sites || []).filter((s) => keepSite(s.id));
  next.usageDaily = filterMapObject(enhanced.usageDaily, allowed, includeAll);
  next.dthChannelDaily = filterMapObject(enhanced.dthChannelDaily, allowed, includeAll);
  next.roomActivity = filterMapObject(enhanced.roomActivity, allowed, includeAll);
  if (enhanced.mobileUsage) {
    next.mobileUsage = {
      ...enhanced.mobileUsage,
      bySite: filterMapObject(enhanced.mobileUsage.bySite, allowed, includeAll),
      siteComparison: (enhanced.mobileUsage.siteComparison || []).filter((r) => keepSite(r.site_id)),
    };
  }
  return next;
}

async function filterBundleForUser(bundle, user, options = {}) {
  const syncSites = options.syncSites !== false;
  if (syncSites) {
    await upsertSitesFromBundle(bundle).catch((err) => console.error('Site sync failed:', err.message));
  }
  const allowed = await getAllowedSiteCodes(user);
  if (allowed === null) return bundle;
  const reports = {};
  for (const [monthKey, report] of Object.entries(bundle.reports || {})) {
    reports[monthKey] = filterReport(report, allowed);
  }
  return {
    ...bundle,
    reports,
    rawDaily: filterRawDaily(bundle.rawDaily, allowed),
    enhanced: filterEnhanced(bundle.enhanced, allowed),
    access: {
      role: user.role,
      allowedSites: [...allowed],
    },
  };
}

module.exports = {
  ALL_SITE_CODE,
  upsertSitesFromBundle,
  getAllowedSiteCodes,
  filterBundleForUser,
};
