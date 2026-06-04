'use strict';

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const { patchScript } = require('./raw-to-report/patch-html');

function patchGzipOnly(html, enhancedGzipB64) {
  return patchScript(html, 'reportEnhancedDataGzip', enhancedGzipB64, 'text/plain');
}

const htmlPath = path.join(__dirname, '..', 'index.html');
const MOBILE_CHART_SKIP = new Set(['HOME', 'GUEST_MESSAGE']);

function skipMobileChartItem(key) {
  return MOBILE_CHART_SKIP.has(String(key || '').trim().toUpperCase());
}

function adjustSiteMobileTotals(site) {
  if (!site) return site;
  let removed = 0;
  site.items = (site.items || []).filter((it) => {
    const key = it.key || it.name;
    if (skipMobileChartItem(key)) {
      removed += it.total_events || 0;
      return false;
    }
    return true;
  });
  if (removed > 0) {
    site.total_events = Math.max(0, (site.total_events || 0) - removed);
    site.events_per_guest_day = site.occupied_room_days
      ? Math.round((site.total_events / site.occupied_room_days) * 1000) / 1000
      : 0;
  }
  return site;
}

function mergeItemRows(bySite) {
  const acc = new Map();
  let occDays = 0;
  let totalEvents = 0;
  for (const site of Object.values(bySite || {})) {
    if (!site || site.site_id === 'ALL') continue;
    occDays += site.occupied_room_days || 0;
    totalEvents += site.total_events || 0;
    for (const it of site.items || []) {
      const key = it.key || it.name;
      if (!key || skipMobileChartItem(key)) continue;
      if (!acc.has(key)) {
        acc.set(key, {
          name: it.name || key,
          key,
          weekday_events: 0,
          weekend_events: 0,
          total_events: 0,
        });
      }
      const row = acc.get(key);
      row.weekday_events += it.weekday_events || 0;
      row.weekend_events += it.weekend_events || 0;
      row.total_events += it.total_events || 0;
    }
  }
  const items = [...acc.values()]
    .map((row) => {
      const events_per_guest_day = occDays ? Math.round((row.total_events / occDays) * 1000) / 1000 : 0;
      return { ...row, events_per_guest: events_per_guest_day, events_per_guest_day };
    })
    .sort((a, b) => b.total_events - a.total_events)
    .slice(0, 15);
  return {
    site_id: 'ALL',
    site_name: 'All Sites (Combined)',
    occupied_room_days: occDays,
    total_events: totalEvents,
    events_per_guest_day: occDays ? Math.round((totalEvents / occDays) * 1000) / 1000 : 0,
    items,
  };
}

function normalizeMobileUsage(E) {
  const mu = E.mobileUsage || { bySite: {}, siteComparison: [] };
  mu.bySite = mu.bySite || {};
  for (const key of Object.keys(mu.bySite)) {
    if (key === 'ALL') continue;
    adjustSiteMobileTotals(mu.bySite[key]);
  }
  mu.siteComparison = (mu.siteComparison || []).map((row) => {
    if (row.site_id === 'ALL') return row;
    const site = mu.bySite[row.site_id];
    if (!site) return row;
    return {
      ...row,
      total_events: site.total_events,
      events_per_guest_day: site.events_per_guest_day,
    };
  });
  for (const site of Object.values(mu.bySite)) {
    for (const it of site.items || []) {
      const rate = it.events_per_guest_day ?? it.events_per_guest ?? 0;
      it.events_per_guest_day = rate;
      it.events_per_guest = rate;
    }
  }
  mu.bySite.ALL = mergeItemRows(mu.bySite);
  const allRow = (mu.siteComparison || []).find((r) => r.site_id === 'ALL');
  if (allRow) {
    allRow.total_events = mu.bySite.ALL.total_events;
    allRow.events_per_guest_day = mu.bySite.ALL.events_per_guest_day;
    allRow.occupied_room_days = mu.bySite.ALL.occupied_room_days;
  }
  E.mobileUsage = mu;
  return E;
}

function main() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/<script id="reportEnhancedDataGzip"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('reportEnhancedDataGzip block not found');
  const E = JSON.parse(zlib.gunzipSync(Buffer.from(m[1].trim(), 'base64')));
  normalizeMobileUsage(E);
  const enhancedGzipB64 = zlib.gzipSync(JSON.stringify(E)).toString('base64');
  const out = patchGzipOnly(html, enhancedGzipB64);
  fs.writeFileSync(htmlPath, out);
  console.log('Patched mobile usage: excluded Home Screen/Guest Message and rebuilt ALL totals');
}

main();
