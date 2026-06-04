'use strict';

const { aggregateRawRows, mergeAggregates, compactAggRoomData } = require('../scripts/raw-to-report/aggregate');
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

function daySpan(startDate, endDate) {
  const s = new Date(`${startDate}T00:00:00Z`);
  const e = new Date(`${endDate}T00:00:00Z`);
  return Math.round((e - s) / 86400000) + 1;
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function splitDateRange(startDate, endDate, chunkDays) {
  const chunks = [];
  let cur = startDate;
  while (cur <= endDate) {
    const end = addDays(cur, chunkDays - 1);
    chunks.push({
      startDate: cur,
      endDate: end > endDate ? endDate : end,
    });
    cur = addDays(chunks[chunks.length - 1].endDate, 1);
  }
  return chunks;
}

function getFetchChunkDays(startDate, endDate) {
  const configured = process.env.REPORT_FETCH_CHUNK_DAYS;
  if (configured === '0') return 0;
  if (configured && Number(configured) > 0) return Number(configured);
  const lowMemory = process.env.REPORT_LOW_MEMORY === 'true' || !!process.env.RENDER;
  if (!lowMemory) return 0;
  return daySpan(startDate, endDate) > 7 ? 7 : 0;
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

async function fetchAndAggregate({ startDate, endDate }) {
  const chunkDays = getFetchChunkDays(startDate, endDate);
  if (chunkDays <= 0) {
    const rows = await fetchRawRows({ startDate, endDate });
    return { agg: aggregateRawRows(rows), rowCount: rows.length };
  }

  let agg = null;
  let rowCount = 0;
  const chunks = splitDateRange(startDate, endDate, chunkDays);
  for (const chunk of chunks) {
    const rows = await fetchRawRows(chunk);
    rowCount += rows.length;
    const part = aggregateRawRows(rows);
    agg = agg ? mergeAggregates(agg, part) : part;
    compactAggRoomData(agg);
  }
  return { agg, rowCount };
}

function buildBundleFromAgg(agg, startDate, endDate, rowCount) {
  agg = filterAggToRange(agg, startDate, endDate);
  const monthKey = startDate.slice(0, 7);
  const monthLabel =
    startDate === endDate
      ? `${monthLabelFromKey(monthKey)} (${startDate})`
      : monthLabelFromKey(monthKey);
  const lowMemory = process.env.REPORT_LOW_MEMORY === 'true' || !!process.env.RENDER;
  const compactRoomActivity = lowMemory && daySpan(startDate, endDate) > 14;
  const reportData = buildReportData(agg, monthKey, monthLabel);
  const rawDaily = buildRawDaily(agg, monthKey);
  const enhanced = buildEnhanced(agg, monthKey, { compactRoomActivity });
  return {
    monthKey,
    startDate,
    endDate,
    rowCount,
    empty: rowCount === 0 || !agg.dates.length,
    aggregateVersion: AGGREGATE_VERSION,
    compactRoomActivity,
    reports: reportData,
    rawDaily,
    enhanced,
  };
}

function buildBundleFromRows(rows, startDate, endDate) {
  const agg = aggregateRawRows(rows);
  return buildBundleFromAgg(agg, startDate, endDate, rows.length);
}

async function loadReportRange({ startDate, endDate, refresh = false }) {
  if (refresh) reportCache.invalidate(startDate, endDate);
  const cached = reportCache.get(startDate, endDate);
  if (cached) {
    return { bundle: cached, cacheServer: 'hit' };
  }
  const { agg, rowCount } = await fetchAndAggregate({ startDate, endDate });
  const bundle = buildBundleFromAgg(agg, startDate, endDate, rowCount);
  reportCache.set(startDate, endDate, bundle);
  return { bundle, cacheServer: 'miss' };
}

module.exports = {
  loadReportRange,
  fetchRawRows,
  fetchAndAggregate,
  buildBundleFromRows,
  buildBundleFromAgg,
  API_URL,
  GROUP,
  reportCache,
};
