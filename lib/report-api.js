'use strict';

const { aggregateRawRows } = require('../scripts/raw-to-report/aggregate');
const { buildReportData, buildRawDaily, buildEnhanced } = require('../scripts/raw-to-report/build-output');
const reportCache = require('./report-cache');
const { AGGREGATE_VERSION } = require('./aggregate-version');

const API_URL = process.env.SMARTLER_REPORT_API_URL || 'https://anlyeng.smartler.in/report/raw/download-fast';
const GROUP = process.env.SMARTLER_GROUP || 'itc';

function monthLabelFromKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m - 1]} ${y}`;
}

function filterAggToRange(agg, startDate, endDate) {
  const keep = new Set(agg.dates.filter((d) => d >= startDate && d <= endDate));
  if (!keep.size) {
    agg.dates = [];
    agg.period = { start: startDate, end: endDate };
    return agg;
  }
  for (const site of agg.sites.values()) {
    for (const d of [...site.days.keys()]) {
      if (!keep.has(d)) site.days.delete(d);
    }
    for (const ser of site.dthSeries.values()) {
      for (const d of [...ser.keys()]) {
        if (!keep.has(d)) ser.delete(d);
      }
    }
    for (const [, byDate] of site.roomData) {
      for (const d of [...byDate.keys()]) {
        if (!keep.has(d)) byDate.delete(d);
      }
    }
  }
  const dates = [...keep].sort();
  agg.dates = dates;
  agg.period = { start: dates[0], end: dates[dates.length - 1] };
  return agg;
}

async function fetchRawRows({ startDate, endDate }) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      group: GROUP,
      hubRegistrationId: [],
      startDate,
      endDate,
    }),
  });
  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from report API (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const msg = payload?.status?.message || payload?.message || text.slice(0, 200);
    throw new Error(`Report API error ${res.status}: ${msg}`);
  }
  if (payload?.status?.code && payload.status.code !== 200 && payload.status.code !== 0) {
    throw new Error(payload.status.message || `Report API status ${payload.status.code}`);
  }
  const rows = payload.rawReport || payload.data?.rawReport || payload.data;
  if (!Array.isArray(rows)) {
    throw new Error('Report API response missing rawReport array');
  }
  return rows;
}

function buildBundleFromRows(rows, startDate, endDate) {
  let agg = aggregateRawRows(rows);
  agg = filterAggToRange(agg, startDate, endDate);
  const monthKey = startDate.slice(0, 7);
  const monthLabel =
    startDate === endDate
      ? `${monthLabelFromKey(monthKey)} (${startDate})`
      : monthLabelFromKey(monthKey);
  const reportData = buildReportData(agg, monthKey, monthLabel);
  const rawDaily = buildRawDaily(agg, monthKey);
  const enhanced = buildEnhanced(agg, monthKey);
  return {
    monthKey,
    startDate,
    endDate,
    rowCount: rows.length,
    empty: rows.length === 0 || !agg.dates.length,
    aggregateVersion: AGGREGATE_VERSION,
    reports: reportData,
    rawDaily,
    enhanced,
  };
}

async function loadReportRange({ startDate, endDate, refresh = false }) {
  if (refresh) reportCache.invalidate(startDate, endDate);
  const cached = reportCache.get(startDate, endDate);
  if (cached) {
    return { bundle: cached, cacheServer: 'hit' };
  }
  const rows = await fetchRawRows({ startDate, endDate });
  const bundle = buildBundleFromRows(rows, startDate, endDate);
  reportCache.set(startDate, endDate, bundle);
  return { bundle, cacheServer: 'miss' };
}

module.exports = {
  loadReportRange,
  fetchRawRows,
  buildBundleFromRows,
  API_URL,
  GROUP,
  reportCache,
};
