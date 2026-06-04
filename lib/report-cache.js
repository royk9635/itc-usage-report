'use strict';

const { AGGREGATE_VERSION } = require('./aggregate-version');
const TZ = 'Asia/Kolkata';

function parseEnvInt(name, defaultVal) {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultVal;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : defaultVal;
}

const ENABLED = process.env.REPORT_CACHE_ENABLED !== 'false';
const MAX_ENTRIES = parseEnvInt('REPORT_CACHE_MAX_ENTRIES', 12);
const TTL_PAST_MS = parseEnvInt('REPORT_CACHE_TTL_PAST_MS', 864000000);
const SWEEP_MS = parseEnvInt('REPORT_CACHE_SWEEP_MS', 3600000);

/** @type {Map<string, { bundle: object, cachedAt: number, monthKey: string }>} */
const store = new Map();
let hits = 0;
let misses = 0;

function todayIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function currentMonthKey() {
  return todayIso().slice(0, 7);
}

function cacheKey(startDate, endDate) {
  return `${AGGREGATE_VERSION}|${startDate}|${endDate}`;
}

function isCurrentCalendarMonth(monthKey) {
  return monthKey === currentMonthKey();
}

function isPastMonth(monthKey) {
  return monthKey < currentMonthKey();
}

function isExpired(entry) {
  if (isCurrentCalendarMonth(entry.monthKey)) return false;
  if (!isPastMonth(entry.monthKey)) return false;
  return Date.now() - entry.cachedAt > TTL_PAST_MS;
}

function touch(key, entry) {
  store.delete(key);
  store.set(key, entry);
}

function evictLruIfNeeded() {
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
}

function get(startDate, endDate) {
  if (!ENABLED) {
    misses += 1;
    return null;
  }
  const key = cacheKey(startDate, endDate);
  const entry = store.get(key);
  if (!entry) {
    misses += 1;
    return null;
  }
  if (isExpired(entry)) {
    store.delete(key);
    misses += 1;
    return null;
  }
  hits += 1;
  touch(key, entry);
  return entry.bundle;
}

function set(startDate, endDate, bundle) {
  if (!ENABLED) return;
  const key = cacheKey(startDate, endDate);
  const monthKey = startDate.slice(0, 7);
  const entry = { bundle, cachedAt: Date.now(), monthKey };
  store.set(key, entry);
  touch(key, entry);
  evictLruIfNeeded();
}

function invalidate(startDate, endDate) {
  store.delete(cacheKey(startDate, endDate));
}

function pruneExpired() {
  for (const [key, entry] of store.entries()) {
    if (isCurrentCalendarMonth(entry.monthKey)) continue;
    if (isPastMonth(entry.monthKey) && Date.now() - entry.cachedAt > TTL_PAST_MS) {
      store.delete(key);
    }
  }
}

function clearReportCache() {
  store.clear();
  hits = 0;
  misses = 0;
}

function getStats() {
  return {
    enabled: ENABLED,
    hits,
    misses,
    size: store.size,
    maxEntries: MAX_ENTRIES,
    ttlPastMs: TTL_PAST_MS,
    currentMonthKey: currentMonthKey(),
    keys: [...store.keys()],
  };
}

if (ENABLED && SWEEP_MS > 0) {
  const timer = setInterval(pruneExpired, SWEEP_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = {
  get,
  set,
  invalidate,
  clearReportCache,
  getStats,
  pruneExpired,
  isEnabled: () => ENABLED,
  AGGREGATE_VERSION,
};
