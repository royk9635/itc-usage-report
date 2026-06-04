'use strict';

function parseISODate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWeekend(iso) {
  const day = parseISODate(iso).getDay();
  return day === 0 || day === 6;
}

function brandFromGroup(group, name) {
  const g = String(group || '').toLowerCase();
  if (g.includes('sheraton')) return 'Sheraton';
  if (g.includes('storii')) return 'Storii';
  if (g.includes('welcom') || g === 'wh') return 'Welcomhotel';
  return 'ITC';
}

function round(n, d = 2) {
  const f = Math.pow(10, d);
  return Math.round(Number(n || 0) * f) / f;
}

function sumMapValues(map, fn) {
  let t = 0;
  for (const v of map.values()) t += fn(v);
  return t;
}

const MOBILE_MENUS = new Set([
  'MOBILE_DTH_CHANNEL', 'MOBILE_DTH_LISTING', 'MOBILE_WEATHER', 'MOBILE_IPTV',
  'SPA_MENU', 'LAUNDRY_MENU', 'CMS', 'VIEWBILL', 'WEBRADIO', 'VIDEO', 'IRD',
  'MOBILE_DTH', 'IPTV'
]);

function isMobileMenu(menu) {
  const m = String(menu || '').toUpperCase();
  if (!m || m === 'GUEST_MESSAGE') return false;
  if (MOBILE_MENUS.has(m)) return true;
  if (m.startsWith('MOBILE_')) return true;
  if (['SPA_MENU', 'LAUNDRY_MENU', 'CMS', 'VIEWBILL', 'WEBRADIO', 'VIDEO', 'IRD'].includes(m)) return true;
  return false;
}

function castingDateToISO(ms) {
  const n = Number(ms);
  if (!n) return null;
  return isoDate(new Date(n));
}

const MOBILE_ITEM_LABELS = {
  HOME: 'Home Screen',
  CMS: 'Hotel Content Pages',
  VIEWBILL: 'View Bill',
  WEBRADIO: 'Web Radio',
  VIDEO: 'Video',
  MOBILE_DTH: 'Mobile DTH',
  MOBILE_DTH_LISTING: 'Mobile DTH Listing',
  MOBILE_DTH_CHANNEL: 'Mobile DTH Channel',
  MOBILE_WEATHER: 'Mobile Weather',
  SPA_MENU: 'Spa Menu',
  LAUNDRY_MENU: 'Laundry Menu',
  GUEST_MESSAGE: 'Guest Message',
  IRD: 'In-Room Dining',
  MOBILE_IPTV: 'Mobile IPTV',
  IPTV: 'IPTV',
  CONTENT_SHARING: 'Content Sharing',
  DEVICEPAIRING: 'Device Pairing',
};

function isPlaceholderActivityItem(value) {
  const s = String(value ?? '').trim();
  if (!s) return true;
  if (/^n\.?\s*\/?\s*a\.?$/i.test(s)) return true;
  if (/^not\s+available$/i.test(s)) return true;
  if (s === '--' || s.toLowerCase() === 'null' || s.toLowerCase() === 'unknown') return true;
  return false;
}

function formatMobileItemLabel(key) {
  const k = String(key || '').trim().toUpperCase();
  if (!k) return 'Unknown';
  if (MOBILE_ITEM_LABELS[k]) return MOBILE_ITEM_LABELS[k];
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** TV_ACTIVITIES row → display label for room activity table (Activity / item summary). */
function mobileActivityItemLabel(e) {
  const menu = String(e.menu || '').toUpperCase().trim();
  const raw = String(e.item ?? '').trim();
  if (isPlaceholderActivityItem(raw)) return formatMobileItemLabel(menu);
  const rawUpper = raw.toUpperCase();
  if (MOBILE_ITEM_LABELS[rawUpper]) return MOBILE_ITEM_LABELS[rawUpper];
  return raw;
}

module.exports = {
  parseISODate, isoDate, isWeekend, brandFromGroup, round, sumMapValues,
  isMobileMenu, castingDateToISO,
  isPlaceholderActivityItem, formatMobileItemLabel, mobileActivityItemLabel,
};
