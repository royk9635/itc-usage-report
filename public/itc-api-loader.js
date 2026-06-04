/**
 * Live ITC report data — month / day-on-day filters → POST /api/report/load
 */
(function () {
  'use strict';

  const TZ = 'Asia/Kolkata';
  /** Must match lib/aggregate-version.js — bump invalidates in-tab + persisted month cache. */
  const AGGREGATE_VERSION = 2;

  function resolveLoadUrl() {
    const attr = document.body?.dataset?.reportApi || '/api/report/load';
    const path = attr.startsWith('/') ? attr : `/${attr}`;
    const origin = window.location.origin;
    if (origin && origin !== 'null' && !origin.startsWith('file:')) {
      return `${origin.replace(/\/$/, '')}${path}`;
    }
    return `http://127.0.0.1:${window.location.port || '8000'}${path}`;
  }

  const LOAD_URL = resolveLoadUrl();

  let bundle = null;
  let enhanced = null;
  let dodEnabled = false;
  let activeMonthKey = '';
  let loadState = 'idle';
  let inflightLoad = null;
  let inflightKey = '';
  /** In-tab cache of processed API bundles (reports + enhanced + rawDaily). */
  const SESSION_CACHE_MAX = 7;
  const PROCESSED_STORE_KEY = 'itc_processed_months_v1';
  /** Full bundles exceed sessionStorage quota (~5MB); in-tab sessionCache + server cache are used instead. */
  let persistProcessedStoreEnabled = false;
  /** @type {Map<string, object>} */
  const sessionCache = new Map();
  let prefetchPromise = null;

  function currentCalendarMonthKey() {
    return todayIso().slice(0, 7);
  }

  function isPastMonthKey(monthKey) {
    return !!monthKey && monthKey < currentCalendarMonthKey();
  }

  function allowedMonthRangeKeys() {
    return new Set(
      listMonthOptions().map((o) => rangeCacheKey(o.startDate, o.endDate))
    );
  }

  function storedBundleLooksValid(b) {
    return !!(
      b &&
      b.monthKey &&
      b.startDate &&
      b.endDate &&
      (b.reports || b.enhanced) &&
      Number(b.aggregateVersion) === AGGREGATE_VERSION
    );
  }

  function readProcessedMonthStore() {
    try {
      const raw = sessionStorage.getItem(PROCESSED_STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeProcessedMonthStore(store) {
    if (!persistProcessedStoreEnabled) return false;
    try {
      const json = JSON.stringify(store);
      if (json.length > 4_000_000) return false;
      sessionStorage.setItem(PROCESSED_STORE_KEY, json);
      return true;
    } catch (e) {
      persistProcessedStoreEnabled = false;
      try {
        sessionStorage.removeItem(PROCESSED_STORE_KEY);
      } catch (_) { /* ignore */ }
      console.warn(
        '[ITC_DATA] Processed month browser storage disabled (data too large for sessionStorage). ' +
          'In-tab cache and server cache still apply for this session.'
      );
      return false;
    }
  }

  function persistProcessedMonthBundle(b) {
    if (!persistProcessedStoreEnabled || !storedBundleLooksValid(b) || !isPastMonthKey(b.monthKey)) return;
    const allowed = new Set(listMonthOptions().map((o) => o.key));
    const store = readProcessedMonthStore();
    for (const k of Object.keys(store)) {
      if (!allowed.has(k)) delete store[k];
    }
    store[b.monthKey] = {
      savedAt: Date.now(),
      rangeKey: rangeCacheKey(b.startDate, b.endDate),
      bundle: {
        monthKey: b.monthKey,
        startDate: b.startDate,
        endDate: b.endDate,
        empty: b.empty,
        rowCount: b.rowCount,
        aggregateVersion: b.aggregateVersion ?? AGGREGATE_VERSION,
        reports: b.reports,
        enhanced: b.enhanced,
      },
    };
    writeProcessedMonthStore(store);
  }

  function hydrateSessionCacheFromProcessedStore() {
    if (!persistProcessedStoreEnabled) return;
    const allowed = listMonthOptions();
    const store = readProcessedMonthStore();
    for (const opt of allowed) {
      if (!isPastMonthKey(opt.key)) continue;
      const entry = store[opt.key];
      const b = entry?.bundle;
      if (!storedBundleLooksValid(b)) continue;
      const rk = rangeCacheKey(opt.startDate, opt.endDate);
      if (!sessionCache.has(rk)) {
        sessionCache.set(rk, b);
      }
    }
  }

  function clearProcessedMonthStore() {
    persistProcessedStoreEnabled = false;
    try {
      sessionStorage.removeItem(PROCESSED_STORE_KEY);
    } catch (_) { /* ignore */ }
  }

  function $(id) {
    return document.getElementById(id);
  }

  function todayIso() {
    return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  }

  function lastDayOfMonth(year, month) {
    return new Date(year, month, 0).toLocaleDateString('en-CA', { timeZone: TZ });
  }

  function monthLabel(year, month) {
    const names = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${names[month - 1]} ${year}`;
  }

  function listMonthOptions() {
    const today = todayIso();
    const [y, m] = today.split('-').map(Number);
    const out = [];
    for (let i = 0; i < 7; i++) {
      let mm = m - i;
      let yy = y;
      while (mm < 1) {
        mm += 12;
        yy -= 1;
      }
      const key = `${yy}-${String(mm).padStart(2, '0')}`;
      const startDate = `${key}-01`;
      const endDate = i === 0 ? today : lastDayOfMonth(yy, mm);
      out.push({ key, label: monthLabel(yy, mm), startDate, endDate });
    }
    return out;
  }

  function errorText(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      if (typeof value.message === 'string') return value.message;
      if (typeof value.error === 'string') return value.error;
      try { return JSON.stringify(value); } catch (_) { /* fall through */ }
    }
    return String(value);
  }

  function friendlyError(err) {
    const msg = errorText(err?.message || err);
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return (
        'Could not reach the report server at ' +
        LOAD_URL +
        '. Double-click start.bat or run "node server.js", then open http://127.0.0.1:8000 ' +
        '(do not open index.html directly or use Live Server).'
      );
    }
    return msg;
  }

  function setBodyLoadState(state) {
    document.body.dataset.reportLoad = state;
    loadState = state;
  }

  function setDataState(kind, message, options = {}) {
    const stateEl = $('reportDataState');
    const title =
      kind === 'error'
        ? 'Could not load report data'
        : kind === 'empty'
          ? 'No data for this period'
          : kind === 'loading'
            ? 'Loading report data'
            : '';
    setBodyLoadState(kind === 'ok' ? 'ok' : kind);

    if (stateEl) {
      if (kind === 'ok') {
        stateEl.hidden = true;
        stateEl.classList.remove('is-visible', 'is-error', 'is-empty', 'is-loading');
        stateEl.innerHTML = '';
      } else {
        stateEl.hidden = false;
        stateEl.classList.add('is-visible');
        stateEl.classList.remove('is-error', 'is-empty', 'is-loading');
        if (kind === 'error') stateEl.classList.add('is-error');
        if (kind === 'empty') stateEl.classList.add('is-empty');
        if (kind === 'loading') stateEl.classList.add('is-loading');
        const showRetry = kind === 'error' || kind === 'empty' || options.showRetry;
        stateEl.innerHTML = `
          <div class="rdsTitle">${title}</div>
          <p class="rdsMsg">${message || ''}</p>
          <div class="rdsActions">
            ${showRetry ? '<button type="button" class="btn primary" id="reportDataRetryBtn">Retry loading data</button>' : ''}
          </div>
          ${kind === 'error' ? '<p class="rdsHint">Charts and KPIs stay hidden until data loads successfully.</p>' : ''}
        `;
        const retryBtn = $('reportDataRetryBtn');
        if (retryBtn && !retryBtn.dataset.wired) {
          retryBtn.dataset.wired = '1';
          retryBtn.addEventListener('click', () => retryLoad());
        }
      }
    }

    const banner = $('reportDataBanner');
    if (banner) {
      if (kind === 'ok') {
        banner.classList.remove('is-visible', 'is-error', 'is-empty');
        banner.textContent = '';
      } else if (kind === 'error') {
        banner.textContent = message || '';
        banner.classList.add('is-visible', 'is-error');
        banner.classList.remove('is-empty');
      } else if (kind === 'empty') {
        banner.textContent = message || '';
        banner.classList.add('is-visible', 'is-empty');
        banner.classList.remove('is-error');
      }
    }
    const live = $('ariaLiveRegion');
    if (live && message) live.textContent = `${title}. ${message}`;
  }

  function monthLabelForKey(monthKey) {
    const opt = listMonthOptions().find((o) => o.key === monthKey);
    return opt?.label || monthKey || 'month';
  }

  function setMonthCacheLoading(on, opts = {}) {
    if (dodEnabled && on) return;
    const btn = $('monthCacheLoadingBtn');
    const wrap = $('monthSelectWrap');
    const monthEl = $('monthSelect');
    if (!btn) return;
    if (on) {
      const monthKey = opts.monthKey || $('monthSelect')?.value || activeMonthKey || '';
      const label = opts.label || monthLabelForKey(monthKey);
      btn.hidden = false;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.classList.add('is-visible');
      btn.innerHTML =
        '<span class="monthCacheLoadSpinner" aria-hidden="true"></span> Loading ' +
        label +
        '…';
      if (wrap) wrap.classList.add('is-loading-month');
      if (monthEl) monthEl.disabled = true;
    } else {
      btn.hidden = true;
      btn.disabled = false;
      btn.setAttribute('aria-busy', 'false');
      btn.classList.remove('is-visible');
      btn.textContent = 'Loading month…';
      if (wrap) wrap.classList.remove('is-loading-month');
      if (monthEl && !inflightLoad) monthEl.disabled = dodEnabled;
    }
  }

  function setLoading(on, msg) {
    const overlay = $('reportLoadOverlay');
    if (overlay) {
      overlay.classList.toggle('is-visible', !!on);
      overlay.setAttribute('aria-hidden', on ? 'false' : 'true');
      const m = overlay.querySelector('.loadMsg');
      if (m && msg) m.textContent = msg;
    }
    if (on) {
      setDataState('loading', msg || 'Fetching ITC data from API…', { showRetry: false });
      document.dispatchEvent(new CustomEvent('itc-report-load-started'));
    } else {
      setMonthCacheLoading(false);
    }
    const monthEl = $('monthSelect');
    const dodEl = $('dodFilterEnable');
    const dodStartDate = $('dodFilterStartDate');
    const dodEndDate = $('dodFilterEndDate');
    if (monthEl) monthEl.disabled = !!on;
    if (dodEl) dodEl.disabled = !!on;
    if (dodStartDate) dodStartDate.disabled = !!on || !dodEnabled;
    if (dodEndDate) dodEndDate.disabled = !!on || !dodEnabled;
  }

  function requestBody() {
    if (dodEnabled) {
      const startDate = $('dodFilterStartDate')?.value || $('dodFilterDate')?.value || todayIso();
      const endDate = $('dodFilterEndDate')?.value || startDate;
      if (startDate > endDate) {
        throw new Error('Start date must be before or equal to end date.');
      }
      return { startDate, endDate, monthKey: startDate.slice(0, 7) };
    }
    const key = $('monthSelect')?.value || activeMonthKey || listMonthOptions()[0]?.key;
    const opt = listMonthOptions().find((o) => o.key === key) || listMonthOptions()[0];
    return {
      startDate: opt.startDate,
      endDate: opt.endDate,
      monthKey: opt.key,
    };
  }

  function rangeCacheKey(startDate, endDate) {
    return `${AGGREGATE_VERSION}|${startDate}|${endDate}`;
  }

  function sessionCacheGet(key) {
    if (!sessionCache.has(key)) return null;
    const val = sessionCache.get(key);
    if (!storedBundleLooksValid(val)) {
      sessionCache.delete(key);
      return null;
    }
    sessionCache.delete(key);
    sessionCache.set(key, val);
    return val;
  }

  function sessionCacheSet(key, data) {
    if (sessionCache.has(key)) sessionCache.delete(key);
    sessionCache.set(key, data);
    if (storedBundleLooksValid(data)) {
      persistProcessedMonthBundle(data);
    }
    const keep = allowedMonthRangeKeys();
    while (sessionCache.size > SESSION_CACHE_MAX) {
      let removed = false;
      for (const k of sessionCache.keys()) {
        if (!keep.has(k)) {
          sessionCache.delete(k);
          removed = true;
          break;
        }
      }
      if (!removed) break;
    }
  }

  function isRangeCached(startDate, endDate) {
    return sessionCache.has(rangeCacheKey(startDate, endDate));
  }

  function isMonthCached(monthKey) {
    const opt = listMonthOptions().find((o) => o.key === monthKey);
    if (!opt) return false;
    return isRangeCached(opt.startDate, opt.endDate);
  }

  async function fetchBundle(startDate, endDate, refresh = false) {
    const body = { startDate, endDate };
    if (refresh) body.refresh = true;
    const res = await fetch(LOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          'Report API not found (HTTP 404). Start the app with start.bat or "node server.js", ' +
            'then open http://127.0.0.1:8000 — do not open index.html directly or use Live Server.'
        );
      }
      if (res.status === 504 || /timeout|timed out|FUNCTION_INVOCATION_TIMEOUT/i.test(errorText(data.error || data.message))) {
        throw new Error(
          'Report load timed out (Vercel Hobby limit: 10 seconds). Try a shorter date range, retry, ' +
            'or upgrade Vercel to Pro and set maxDuration to 60 in vercel.json.'
        );
      }
      throw new Error(errorText(data.error || data.message) || `Failed to load report (HTTP ${res.status})`);
    }
    return data;
  }

  function bundleHasReport(b) {
    const reports = b?.reports || {};
    const keys = Object.keys(reports);
    if (!keys.length) return false;
    const report = reports[b.monthKey] || reports[keys[0]];
    return !!(report && report.selections && Object.keys(report.selections).length);
  }

  function applyBundle(b) {
    bundle = b;
    if (b?.monthKey) activeMonthKey = b.monthKey;
    enhanced = b?.enhanced || null;
    window.ITC_ENHANCED_PAYLOAD = enhanced;
    if (typeof window.ITC_ON_REPORT_LOADED === 'function') {
      window.ITC_ON_REPORT_LOADED(b);
    }
  }

  async function deliverBundle(b) {
    const hasReport = bundleHasReport(b);
    applyBundle(b);
    if (!hasReport || b.empty) {
      const msg = `No records returned for ${b.startDate || ''} to ${b.endDate || ''}. Try another month or date.`;
      setDataState('empty', msg, { showRetry: true });
    } else {
      setDataState('ok');
    }
    document.dispatchEvent(new CustomEvent('itc-report-loaded', { detail: b }));
    if (typeof window.ITC_REFRESH_REPORT_UI === 'function') {
      await window.ITC_REFRESH_REPORT_UI(b);
    }
    return b;
  }

  async function prefetchBundle(startDate, endDate) {
    const key = rangeCacheKey(startDate, endDate);
    if (sessionCache.has(key)) return;
    const b = await fetchBundle(startDate, endDate);
    sessionCacheSet(key, b);
  }

  async function prefetchPreviousMonths() {
    if (dodEnabled) return;
    const months = listMonthOptions().slice(1);
    for (const opt of months) {
      if (dodEnabled) break;
      const key = rangeCacheKey(opt.startDate, opt.endDate);
      if (sessionCache.has(key)) continue;
      try {
        await prefetchBundle(opt.startDate, opt.endDate);
      } catch (e) {
        console.warn('[ITC_DATA] Prefetch failed for', opt.key, e);
      }
    }
  }

  function isPrefetchEnabled() {
    const flag = document.body?.dataset?.reportPrefetch;
    if (flag === 'false') return false;
    if (flag === 'true') return true;
    const host = window.location.hostname;
    return host === '127.0.0.1' || host === 'localhost';
  }

  function startPrefetchPreviousMonths() {
    if (!isPrefetchEnabled() || dodEnabled || prefetchPromise) return;
    prefetchPromise = prefetchPreviousMonths().finally(() => {
      prefetchPromise = null;
    });
  }

  async function loadCurrent(options = {}) {
    const { startDate, endDate, monthKey } = requestBody();
    const requestedKey = rangeCacheKey(startDate, endDate);
    const refresh = options.refresh === true;

    if (!refresh) {
      if (sessionCache.has(requestedKey)) {
        setMonthCacheLoading(false);
        const cached = sessionCacheGet(requestedKey);
        if (cached) {
          try {
            return await deliverBundle(cached);
          } catch (e) {
            const msg = friendlyError(e);
            setDataState('error', msg, { showRetry: true });
            throw e;
          }
        }
      }
    } else {
      sessionCache.delete(requestedKey);
      if (isPastMonthKey(monthKey)) {
        const store = readProcessedMonthStore();
        delete store[monthKey];
        writeProcessedMonthStore(store);
      }
    }

    if (inflightLoad) {
      if (inflightKey === requestedKey) return inflightLoad;
      try { await inflightLoad; } catch (_) { /* a newer request will replace this state */ }
      return loadCurrent(options);
    }

    if (!dodEnabled) {
      setMonthCacheLoading(true, { monthKey, label: monthLabelForKey(monthKey) });
    }

    inflightLoad = (async () => {
      inflightKey = requestedKey;
      setLoading(true, `Loading ITC data ${startDate} → ${endDate}…`);
      try {
        const b = await fetchBundle(startDate, endDate, refresh);
        sessionCacheSet(requestedKey, b);
        return await deliverBundle(b);
      } catch (e) {
        if (bundle?.monthKey) {
          activeMonthKey = bundle.monthKey;
          const monthEl = $('monthSelect');
          if (monthEl) monthEl.value = bundle.monthKey;
        }
        const msg = friendlyError(e);
        setDataState('error', msg, { showRetry: true });
        throw e;
      } finally {
        setLoading(false);
        setMonthCacheLoading(false);
        inflightLoad = null;
        inflightKey = '';
        document.dispatchEvent(new CustomEvent('itc-report-load-finished'));
      }
    })();

    return inflightLoad;
  }

  async function retryLoad() {
    try {
      return await loadCurrent({ refresh: true });
    } catch (_) {
      return null;
    }
  }

  function fillMonthSelect(selectedKey) {
    const el = $('monthSelect');
    if (!el) return;
    const opts = listMonthOptions();
    el.innerHTML = '';
    opts.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.key;
      opt.textContent = o.label;
      el.appendChild(opt);
    });
    el.value = selectedKey || opts[0]?.key || '';
    activeMonthKey = el.value;
  }

  function syncDodUi() {
    const wrap = $('dodDateWrap');
    const monthWrap = $('monthSelectWrap');
    const startEl = $('dodFilterStartDate') || $('dodFilterDate');
    const endEl = $('dodFilterEndDate');
    if (wrap) wrap.style.display = dodEnabled ? '' : 'none';
    if (monthWrap) monthWrap.style.opacity = dodEnabled ? '0.55' : '1';
    if ($('monthSelect')) $('monthSelect').disabled = dodEnabled || !!inflightLoad;
    const opt = listMonthOptions().find((o) => o.key === ($('monthSelect')?.value || activeMonthKey));
    if (startEl) {
      if (opt) {
        startEl.min = opt.startDate;
        startEl.max = opt.endDate;
        if (!startEl.value || startEl.value < opt.startDate || startEl.value > opt.endDate) startEl.value = opt.startDate;
      } else if (!startEl.value) {
        startEl.value = todayIso();
      }
      startEl.disabled = !!inflightLoad || !dodEnabled;
    }
    if (endEl) {
      if (opt) {
        endEl.min = opt.startDate;
        endEl.max = opt.endDate;
        if (!endEl.value || endEl.value < opt.startDate || endEl.value > opt.endDate) endEl.value = opt.endDate;
      } else if (!endEl.value) {
        endEl.value = startEl?.value || todayIso();
      }
      endEl.disabled = !!inflightLoad || !dodEnabled;
    }
  }

  function wireUi() {
    fillMonthSelect(activeMonthKey || listMonthOptions()[0]?.key);
    const dodChk = $('dodFilterEnable');
    const dodStartDate = $('dodFilterStartDate') || $('dodFilterDate');
    const dodEndDate = $('dodFilterEndDate');
    if (dodChk) {
      dodChk.addEventListener('change', async () => {
        dodEnabled = !!dodChk.checked;
        syncDodUi();
        try {
          await loadCurrent();
        } catch (_) { /* state panel shown */ }
      });
    }
    const onDodDateChange = async () => {
      if (!dodEnabled) return;
      syncDodUi();
      try {
        await loadCurrent();
      } catch (e) {
        setDataState('error', friendlyError(e), { showRetry: true });
      }
    };
    if (dodStartDate) {
      dodStartDate.addEventListener('change', onDodDateChange);
    }
    if (dodEndDate) {
      dodEndDate.addEventListener('change', onDodDateChange);
    } else if ($('dodFilterDate')) {
      $('dodFilterDate').addEventListener('change', async () => {
        if (!dodEnabled) return;
        try {
          await loadCurrent();
        } catch (_) { /* state panel shown */ }
      });
    }
    syncDodUi();
  }

  function getProcessedCacheStatus() {
    const opts = listMonthOptions();
    const store = readProcessedMonthStore();
    return opts.map((o) => {
      const rk = rangeCacheKey(o.startDate, o.endDate);
      return {
        monthKey: o.key,
        label: o.label,
        inSession: sessionCache.has(rk),
        inPersistedStore: !!store[o.key]?.bundle,
        isPast: isPastMonthKey(o.key),
      };
    });
  }

  async function ready() {
    wireUi();
    try {
      sessionStorage.removeItem(PROCESSED_STORE_KEY);
    } catch (_) { /* ignore */ }
    hydrateSessionCacheFromProcessedStore();
    const result = await loadCurrent();
    startPrefetchPreviousMonths();
    return result;
  }

  window.ITC_DATA = {
    TZ,
    todayIso,
    listMonthOptions,
    requestBody,
    ready,
    loadCurrent,
    retryLoad,
    getBundle: () => bundle,
    getEnhanced: () => enhanced,
    getLoadState: () => loadState,
    hasValidData: () => loadState === 'ok' && bundleHasReport(bundle),
    setEnhanced: (e) => {
      enhanced = e || null;
      window.ITC_ENHANCED_PAYLOAD = enhanced;
    },
    isRangeCached,
    isMonthCached,
    getProcessedCacheStatus,
    clearProcessedMonthStore,
    setMonthCacheLoading,
    isMonthLoading: () => !!inflightLoad,
    setDataState,
    isDodEnabled: () => dodEnabled,
    getActiveMonthKey: () => activeMonthKey,
    syncDodUi,
    debugEnhanced: () =>
      typeof window.ITC_DEBUG_ENHANCED?.status === 'function'
        ? window.ITC_DEBUG_ENHANCED.status('ITC_DATA.debugEnhanced()')
        : console.warn('[ITC] Open the report page first, then run ITC_DEBUG_ENHANCED.status()'),
  };
})();
