/**
 * ITC Report UI platform — loaded by patch into the HTML report.
 * Depends on window.ITC_REPORT (exported from main IIFE).
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  /* ========== ITC_DATA ========== */
  window.ITC_DATA = (function () {
    let cache = null;
    let promise = null;
    let state = 'idle';
    const listeners = new Set();

    function setState(s, msg) {
      state = s;
      listeners.forEach((fn) => {
        try {
          fn(s, msg);
        } catch (e) {}
      });
      const ov = $('reportLoadOverlay');
      if (ov) {
        ov.classList.toggle('is-visible', s === 'decoding');
        const m = ov.querySelector('.loadMsg');
        if (m && msg) m.textContent = msg;
      }
      const err = $('reportErrorBanner');
      if (err) {
        err.classList.toggle('is-visible', s === 'error');
        if (msg && s === 'error') err.textContent = msg;
      }
    }

    async function loadEnhanced() {
      if (cache) return cache;
      if (promise) return promise;
      const el = $('reportEnhancedDataGzip');
      if (!el) throw new Error('Enhanced data is missing from this report file.');
      if (!('DecompressionStream' in window)) {
        throw new Error(
          'Open this report in recent Chrome, Edge, or Safari for room and trend data.'
        );
      }
      setState('decoding', 'Preparing room and trend data…');
      promise = (async () => {
        const b64 = el.textContent.trim();
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const stream = new Blob([bytes])
          .stream()
          .pipeThrough(new DecompressionStream('gzip'));
        cache = JSON.parse(await new Response(stream).text());
        setState('ready');
        window.dispatchEvent(new CustomEvent('itc-enhanced-ready', { detail: cache }));
        return cache;
      })().catch((e) => {
        setState('error', e.message || String(e));
        promise = null;
        throw e;
      });
      return promise;
    }

    function onLoadState(cb) {
      listeners.add(cb);
      cb(state);
      return () => listeners.delete(cb);
    }

    function ensureEnhancedLazy() {
      const target = $('mainSharedCharts') || document.querySelector('.enhancedBlock');
      if (!target || !('IntersectionObserver' in window)) return;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            obs.disconnect();
            loadEnhanced()
              .then(() => {
                if (typeof window.ITC_ENHANCED_BOOT === 'function') window.ITC_ENHANCED_BOOT();
              })
              .catch(() => {});
          }
        },
        { rootMargin: '160px' }
      );
      obs.observe(target);
    }

    return { loadEnhanced, onLoadState, getCached: () => cache, ensureEnhancedLazy };
  })();

  /* ========== ITC_ROOM ========== */
  window.ITC_ROOM = (function () {
    let sel = { siteId: '', room: '', start: '', end: '' };
    const listeners = new Set();
    function emit() {
      listeners.forEach((fn) => {
        try {
          fn({ ...sel });
        } catch (e) {}
      });
    }
    return {
      get: () => ({ ...sel }),
      set(partial) {
        Object.assign(sel, partial || {});
        emit();
      },
      onChange(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };
  })();

  const REC_KEY = 'itc_report_recent_sites';

  function readRecents() {
    try {
      return JSON.parse(localStorage.getItem(REC_KEY) || '[]')
        .filter(Boolean)
        .slice(0, 3);
    } catch (e) {
      return [];
    }
  }

  function pushRecent(id) {
    if (!id || id === 'ALL') return;
    const r = [id, ...readRecents().filter((x) => x !== id)].slice(0, 3);
    try {
      localStorage.setItem(REC_KEY, JSON.stringify(r));
    } catch (e) {}
  }

  /* ========== Site combobox ========== */
  function mountSiteCombo(wrapEl, hiddenSelect, options) {
    if (!wrapEl || !hiddenSelect || wrapEl.dataset.comboMounted) return;
    options = options || {};
    wrapEl.dataset.comboMounted = '1';
    const getSites = options.getSites || (() => []);
    const labelFn = options.labelFn || ((o) => o.name || o.id);
    const subFn = options.subFn || (() => '');
    const onPick = options.onPick || (() => {});

    wrapEl.innerHTML = '';
    let brandBar = null;
    if (options.brands !== false) {
      brandBar = document.createElement('div');
      brandBar.className = 'siteBrandChips';
      brandBar.dataset.brandChips = '1';
      wrapEl.appendChild(brandBar);
    }

    const comboRoot = document.createElement('div');
    comboRoot.className = 'siteCombo';
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.placeholder = options.placeholder || 'Search site…';
    input.setAttribute('aria-label', 'Search site');
    const list = document.createElement('div');
    list.className = 'siteComboList';
    list.dataset.comboList = '1';
    list.setAttribute('role', 'listbox');
    comboRoot.appendChild(input);
    comboRoot.appendChild(list);
    wrapEl.appendChild(comboRoot);

    let brandFilter = '';
    let activeIdx = -1;

    function brands() {
      return [...new Set(getSites().map((s) => s.brand).filter(Boolean))].sort();
    }

    function renderBrandChips() {
      if (!brandBar) return;
      const bs = brands();
      brandBar.innerHTML =
        '<button type="button" data-brand="" class="' +
        (!brandFilter ? 'active' : '') +
        '">All</button>' +
        bs
          .map(
            (b) =>
              '<button type="button" data-brand="' +
              escAttr(b) +
              '" class="' +
              (brandFilter === b ? 'active' : '') +
              '">' +
              escHtml(b) +
              '</button>'
          )
          .join('');
      brandBar.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          brandFilter = btn.dataset.brand || '';
          renderBrandChips();
          renderList();
        });
      });
    }

    function escHtml(s) {
      return String(s ?? '').replace(/[&<>"']/g, (ch) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
      );
    }
    function escAttr(s) {
      return escHtml(s).replace(/"/g, '&quot;');
    }

    function filteredSites() {
      const q = input.value.trim().toLowerCase();
      const sites = getSites();
      const rec = readRecents();
      let out = sites.filter((s) => {
        if (brandFilter && s.brand !== brandFilter) return false;
        if (!q) return true;
        const hay = (labelFn(s) + ' ' + (s.name || '') + ' ' + (s.id || '')).toLowerCase();
        return hay.includes(q);
      });
      if (!q && rec.length) {
        const recSet = new Set(rec);
        const recSites = sites.filter((s) => recSet.has(s.id));
        const rest = out.filter((s) => !recSet.has(s.id));
        out = [...recSites, ...rest];
      }
      return out;
    }

    function renderList() {
      const sites = filteredSites();
      activeIdx = -1;
      if (!sites.length) {
        list.innerHTML =
          '<div class="siteComboItem" style="cursor:default;color:var(--muted)">No matches</div>';
        return;
      }
      list.innerHTML = sites
        .map((s, i) => {
          const sub = subFn(s);
          return (
            '<div class="siteComboItem" data-idx="' +
            i +
            '" data-id="' +
            escAttr(s.id) +
            '" role="option"><span>' +
            escHtml(labelFn(s)) +
            '</span>' +
            (sub ? '<span class="sub">' + escHtml(sub) + '</span>' : '') +
            '</div>'
          );
        })
        .join('');
      list.querySelectorAll('.siteComboItem[data-id]').forEach((row) => {
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          pick(row.dataset.id);
        });
      });
    }

    function pick(id) {
      const sites = getSites();
      const site = sites.find((s) => s.id === id);
      if (!site) return;
      hiddenSelect.value = id;
      input.value = labelFn(site);
      list.classList.remove('open');
      pushRecent(id);
      onPick(id, site);
    }

    function openList() {
      renderList();
      list.classList.add('open');
    }

    input.addEventListener('focus', openList);
    input.addEventListener('input', () => {
      openList();
      if (!input.value.trim()) {
        hiddenSelect.value = options.allowAll ? 'ALL' : hiddenSelect.value;
      }
    });
    input.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll('.siteComboItem[data-id]')];
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
      } else if (e.key === 'Enter' && activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault();
        pick(items[activeIdx].dataset.id);
      } else if (e.key === 'Escape') {
        list.classList.remove('open');
      }
    });
    document.addEventListener('click', (e) => {
      if (!wrapEl.contains(e.target)) list.classList.remove('open');
    });

    hiddenSelect.addEventListener('change', () => {
      const site = getSites().find((s) => s.id === hiddenSelect.value);
      if (site) input.value = labelFn(site);
    });

    return {
      refresh() {
        if (brandBar) renderBrandChips();
        const site = getSites().find((s) => s.id === hiddenSelect.value);
        if (site) input.value = labelFn(site);
      },
      setValue(id) {
        hiddenSelect.value = id;
        const site = getSites().find((s) => s.id === id);
        input.value = site ? labelFn(site) : '';
      },
    };
  }

  window.ITC_SITE_COMBO = { mountSiteCombo, readRecents, pushRecent };

  /* ========== Hash routing ========== */
  function parseHash() {
    const h = (location.hash || '').replace(/^#/, '');
    if (!h) return {};
    const out = {};
    h.split('&').forEach((part) => {
      const [k, v] = part.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return out;
  }

  function writeHash() {
    const R = window.ITC_REPORT;
    if (!R) return;
    const p = new URLSearchParams();
    p.set('view', R.getReportPage ? R.getReportPage() : 'REPORT');
    const sid = R.getCurrentSelId ? R.getCurrentSelId() : '';
    if (sid) p.set('site', sid);
    const room = window.ITC_ROOM.get();
    if (room.siteId) p.set('roomSite', room.siteId);
    if (room.room) p.set('room', room.room);
    if (room.start) p.set('start', room.start);
    if (room.end) p.set('end', room.end);
    const cids = R.getCompareIds ? R.getCompareIds() : [];
    if (cids.length) p.set('compare', cids.join(','));
    const next = '#' + p.toString();
    if (location.hash !== next) history.replaceState(null, '', next);
  }

  let hashTimer;
  function scheduleHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(writeHash, 300);
  }

  function applyHash() {
    const R = window.ITC_REPORT;
    if (!R) return;
    const q = parseHash();
    if (q.view && R.setReportPage) R.setReportPage(q.view);
    if (q.site && R.setCurrentSelId) {
      R.setCurrentSelId(q.site);
      const sel = $('siteSelect');
      if (sel) sel.value = q.site;
      if (window.ITC_MAIN_COMBO) window.ITC_MAIN_COMBO.setValue(q.site);
      if (R.renderSelection) R.renderSelection(q.site);
    }
    if (q.compare && R.setCompareIds) {
      R.setCompareIds(
        q.compare
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 4)
      );
      if (R.renderCompareChooser) R.renderCompareChooser();
      if (R.renderComparePage) R.renderComparePage();
    }
    const room = {};
    if (q.roomSite) room.siteId = q.roomSite;
    if (q.room) room.room = q.room;
    if (q.start) room.start = q.start;
    if (q.end) room.end = q.end;
    if (Object.keys(room).length) window.ITC_ROOM.set(room);
  }

  /* ========== Glossary ========== */
  function wireGlossary() {
    const dlg = $('glossaryDialog');
    const btn = $('btnGlossary');
    if (!dlg || !btn) return;
    btn.addEventListener('click', () => {
      if (dlg.showModal) dlg.showModal();
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
    dlg.querySelector('[data-glossary-close]')?.addEventListener('click', () => dlg.close());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dlg.open) dlg.close();
    });
  }

  /* ========== Section nav ========== */
  function wireSectionNav() {
    const nav = $('sectionNav');
    if (!nav) return;
    const links = [...nav.querySelectorAll('a[href^="#"]')];
    const targets = links
      .map((a) => {
        const id = a.getAttribute('href').slice(1);
        return $(id);
      })
      .filter(Boolean);
    if (!targets.length || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = visible.target.id;
        links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.2, 0.5] }
    );
    targets.forEach((t) => obs.observe(t));
  }

  /* ========== Sortable tables ========== */
  function makeSortable(table) {
    if (!table || table.dataset.sortable) return;
    table.dataset.sortable = '1';
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;
    thead.querySelectorAll('th').forEach((th, colIdx) => {
      th.classList.add('sortable');
      let dir = 1;
      th.addEventListener('click', () => {
        dir *= -1;
        const rows = [...tbody.querySelectorAll('tr')];
        rows.sort((a, b) => {
          const av = (a.children[colIdx]?.textContent || '').trim();
          const bv = (b.children[colIdx]?.textContent || '').trim();
          const an = parseFloat(av.replace(/[^0-9.-]/g, ''));
          const bn = parseFloat(bv.replace(/[^0-9.-]/g, ''));
          if (!isNaN(an) && !isNaN(bn)) return (an - bn) * dir;
          return av.localeCompare(bv) * dir;
        });
        rows.forEach((r) => tbody.appendChild(r));
      });
    });
  }

  window.ITC_TABLE = { makeSortable };

  /* ========== MoM delta helper ========== */
  function momDelta(current, previous) {
    if (previous == null || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  }
  window.ITC_MOM = { momDelta };

  /* ========== Coverage chip ========== */
  function updateCoverage() {
    const R = window.ITC_REPORT;
    const el = $('coverageBadge');
    if (!el || !R) return;
    const rep = R.getReport();
    const sites = (rep.site_list || []).filter((s) => s.id !== 'ALL');
    const p = rep.period || {};
    el.textContent =
      'Coverage: ' +
      sites.length +
      ' sites • ' +
      (p.start || '') +
      ' to ' +
      (p.end || '');
  }

  /* ========== Copy link ========== */
  function wireCopyLink() {
    $('btnCopyLink')?.addEventListener('click', async () => {
      writeHash();
      const url = location.href;
      try {
        await navigator.clipboard.writeText(url);
        const btn = $('btnCopyLink');
        const old = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = old;
        }, 2000);
      } catch (e) {
        prompt('Copy this link:', url);
      }
    });
  }

  /* ========== Summary CSV ========== */
  function exportSummaryCsv() {
    const R = window.ITC_REPORT;
    if (!R) return;
    const sel = R.getSelection(R.getCurrentSelId());
    const totals = sel.totals || {};
    const lines = [
      ['Metric', 'Value'],
      ['Site', R.getCurrentSelId()],
      ['OTT min/guest-day', totals.dur_min_per_guest?.OTT],
      ['DTH min/guest-day', totals.dur_min_per_guest?.DTH],
      ['Casting min/guest-day', totals.dur_min_per_guest?.Casting],
      ['Total min/guest-day', totals.dur_min_per_guest?.Total],
    ];
    const csv = lines.map((r) => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'itc_summary_' + R.getCurrentSelId() + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ========== Compare export / ranking (hooks for main IIFE) ========== */
  window.ITC_COMPARE_UI = {
    renderRanking(selections) {
      const wrap = $('compareRankingBody');
      if (!wrap) return;
      const R = window.ITC_REPORT;
      wrap.innerHTML = selections
        .map((sel) => {
          const t = sel.totals || {};
          const mix = t.mix || {};
          const total = t.dur_min_per_guest?.Total || 0;
          return (
            '<tr><td>' +
            esc(
              R.compareSiteLabel(sel.brand, sel.name)
            ) +
            '</td><td class="right">' +
            fmt(total, 1) +
            '</td><td class="right">' +
            Math.round((mix.OTT || 0) * 100) +
            '%</td><td class="right">' +
            Math.round((mix.DTH || 0) * 100) +
            '%</td><td class="right">' +
            Math.round((mix.Casting || 0) * 100) +
            '%</td></tr>'
          );
        })
        .join('');
      window.ITC_TABLE.makeSortable($('compareRankingTable'));
    },
  };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
    );
  }
  function fmt(n, d) {
    return Number(n || 0).toLocaleString('en-IN', {
      maximumFractionDigits: d,
      minimumFractionDigits: d,
    });
  }

  /* ========== IRD guard ========== */
  function checkIrdData() {
    const el = $('irdRevenueData');
    if (!el) return;
    let data;
    try {
      data = JSON.parse(el.textContent || '{}');
    } catch (e) {
      return;
    }
    const hasSites = Object.keys(data.sites || {}).length > 0;
    const rev = Number(data.combined?.total_revenue || 0);
    if (!hasSites && !rev) {
      document.body.classList.add('ird-data-missing');
      const btn = document.querySelector('[data-ird-toggle],.viewBtnAlt');
      if (btn) {
        btn.disabled = true;
        btn.title = 'IRD revenue not included in this export';
      }
    }
  }

  /* ========== Accordion persistence ========== */
  function wireAccordions() {
    document.querySelectorAll('.reportSection').forEach((det) => {
      const key = det.dataset.sectionKey;
      if (key) {
        const saved = sessionStorage.getItem('itc_sec_' + key);
        if (saved === '0') det.open = false;
        if (saved === '1') det.open = true;
      }
      det.addEventListener('toggle', () => {
        if (key) sessionStorage.setItem('itc_sec_' + key, det.open ? '1' : '0');
      });
    });
  }

  /* ========== KPI skeleton clear ========== */
  function clearKpiSkeleton() {
    document.querySelectorAll('.kpi.is-loading').forEach((el) => el.classList.remove('is-loading'));
    document.querySelectorAll('.chartWrap.is-loading').forEach((el) => el.classList.remove('is-loading'));
  }

  function setKpiSkeleton() {
    document.querySelectorAll('#reportPageContent .kpi').forEach((el) => el.classList.add('is-loading'));
    document.querySelectorAll('#reportPageContent .chartWrap').forEach((el) => el.classList.add('is-loading'));
  }

  /* ========== Boot ========== */
  function boot() {
    wireGlossary();
    wireSectionNav();
    wireCopyLink();
    wireAccordions();
    checkIrdData();
    window.ITC_DATA.ensureEnhancedLazy();

    $('btnExportSummaryCsv')?.addEventListener('click', exportSummaryCsv);

    $('btnCompareTop4')?.addEventListener('click', () => {
      const R = window.ITC_REPORT;
      if (!R || !R.compareSearchOptions) return;
      const ranked = R.compareSearchOptions()
        .filter((o) => o.id !== 'ALL')
        .map((o) => ({
          id: o.id,
          v: Number(R.getSelection(o.id)?.totals?.dur_min_per_guest?.Total || 0),
        }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 4)
        .map((x) => x.id);
      R.setCompareIds(ranked);
      R.renderCompareChooser();
      R.renderComparePage();
      scheduleHash();
    });

    $('btnCompareExport')?.addEventListener('click', () => {
      const R = window.ITC_REPORT;
      if (!R) return;
      const sels = R.getCompareSelections ? R.getCompareSelections() : [];
      const lines = [['Site', 'TotalMin', 'OTT%', 'DTH%', 'Casting%']];
      sels.forEach((sel) => {
        const t = sel.totals || {};
        const mix = t.mix || {};
        lines.push([
          R.compareSiteLabel(sel.brand, sel.name),
          t.dur_min_per_guest?.Total,
          Math.round((mix.OTT || 0) * 100),
          Math.round((mix.DTH || 0) * 100),
          Math.round((mix.Casting || 0) * 100),
        ]);
      });
      const csv = lines.map((r) => r.join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'itc_compare.csv';
      a.click();
    });

    window.ITC_ROOM.onChange(() => scheduleHash());

    const waitReport = setInterval(() => {
      if (!window.ITC_REPORT) return;
      clearInterval(waitReport);
      updateCoverage();
      applyHash();

      const wrap = $('siteComboWrap');
      const sel = $('siteSelect');
      if (wrap && sel) {
        window.ITC_MAIN_COMBO = mountSiteCombo(wrap, sel, {
          getSites: () => window.ITC_REPORT.currentSiteList(),
          labelFn: (o) =>
            o.id === 'ALL' ? o.name : window.ITC_REPORT.compareSiteLabel(o.brand, o.name),
          subFn: (o) => (o.id === 'ALL' ? '' : o.name),
          onPick: (id) => {
            window.ITC_REPORT.setCurrentSelId(id);
            if (window.ITC_REPORT.getReportPage() === 'REPORT') {
              window.ITC_REPORT.renderSelection(id);
              if (window.ITC_REFRESH_ENHANCED_CHARTS) window.ITC_REFRESH_ENHANCED_CHARTS();
            }
            scheduleHash();
          },
        });
      }

      const origRender = window.ITC_REPORT.renderSelection;
      if (origRender) {
        window.ITC_REPORT.renderSelection = function (id) {
          clearKpiSkeleton();
          origRender(id);
          updateCoverage();
          scheduleHash();
        };
      }

      const origPage = window.ITC_REPORT.setReportPage;
      if (origPage) {
        window.ITC_REPORT.setReportPage = function (p) {
          origPage(p);
          if (p === 'CHAT') window.ITC_DATA.loadEnhanced().catch(() => {});
          scheduleHash();
        };
      }

      setKpiSkeleton();
      if (window.ITC_MAIN_COMBO) window.ITC_MAIN_COMBO.refresh();
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

window.ITC_CHARTS = {
  markEmpty(canvasId, isEmpty) {
    const wrap = document.getElementById(canvasId)?.closest('.chartWrap');
    if (!wrap) return;
    let msg = wrap.querySelector('.chartEmptyMsg');
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'chartEmptyMsg';
      msg.textContent = 'No data for this selection.';
      wrap.appendChild(msg);
    }
    wrap.classList.toggle('has-empty', !!isEmpty);
  },
};

window.ITC_TIME_BARS = function initTimeBars() {
  document.querySelectorAll('.usageTimeTable tbody tr').forEach((tr) => {
    const cells = [...tr.querySelectorAll('td.right')];
    if (cells.length < 4) return;
    const vals = cells.slice(0, 4).map((td) => parseFloat(String(td.textContent).replace(/[^0-9.]/g, '')) || 0);
    const max = Math.max(...vals, 1);
    cells.forEach((td, i) => {
      td.classList.add('timeBarCell');
      let bar = td.querySelector('.bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'bar';
        td.appendChild(bar);
      }
      bar.style.width = Math.round((vals[i] / max) * 100) + '%';
    });
  });
};

window.ITC_ENHANCED_COMBOS = function () {
  if (!window.ITC_SITE_COMBO || !window.ITC_REPORT) return;
  const E = window.ITC_DATA?.getCached?.();
  if (!E) return;
  const sites = () => (E.sites || []).map((s) => ({ id: s.id, name: s.name, brand: '' }));
  const label = (o) => o.name || o.id;
  ['roomActivitySiteSelect'].forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel || sel.dataset.comboDone) return;
    sel.dataset.comboDone = '1';
    const wrap = document.createElement('div');
    sel.parentElement.insertBefore(wrap, sel);
    window.ITC_SITE_COMBO.mountSiteCombo(wrap, sel, { getSites: sites, labelFn: label, brands: false });
  });
};

document.addEventListener('DOMContentLoaded', () => setTimeout(() => window.ITC_TIME_BARS && window.ITC_TIME_BARS(), 800));
window.addEventListener('itc-enhanced-ready', () => window.ITC_ENHANCED_COMBOS && window.ITC_ENHANCED_COMBOS());
