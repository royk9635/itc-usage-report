/**
 * MSR-style admin dashboard — sidebar navigation, brand/site filtering.
 * Requires window.ITC_REPORT_API from main report script.
 */
(function () {
  'use strict';

  const BRANDS = ['All', 'ITC', 'Sheraton', 'Storii', 'Welcomhotel'];
  const SECTION_MAP = {
    overview: { page: 'REPORT', scroll: null, title: 'Overview' },
    weekday: { page: 'REPORT', scroll: 'secWeekday', title: 'Weekday vs Weekend' },
    compare: { page: 'COMPARE', scroll: 'comparePage', title: 'Compare Sites' },
    ird: { page: 'REPORT', scroll: 'irdRevenuePage', title: 'IRD Revenue', ird: true },
    timeofday: { page: 'REPORT', scroll: 'secTimeOfDay', title: 'Time of Day Usage' },
    daily: { page: 'REPORT', scroll: 'secDailyTrends', title: 'Daily Trends' },
    roomanalysis: {
      page: 'REPORT',
      scroll: 'secRoomAnalysis',
      title: 'Room-wise Activity Analysis',
      roomAnalysis: true,
    },
    ott: { page: 'REPORT', scroll: 'secOttDth', title: 'OTT & Streaming' },
    dth: { page: 'REPORT', scroll: 'secDth', title: 'DTH Channel Usage' },
    smartler: { page: 'REPORT', scroll: 'secSmartler', title: 'Smartler Usage' },
    chatbot: { page: 'CHAT', scroll: 'chatPage', title: 'Room Chatbot' },
  };

  let dashBrand = 'ALL';
  let activeNavId = 'nav-overview';

  function $(id) {
    return document.getElementById(id);
  }

  function getReports() {
    const el = $('reportData');
    if (!el) return {};
    try {
      return JSON.parse(el.textContent);
    } catch {
      return {};
    }
  }

  function getCurrentMonthKey() {
    return $('monthSelect')?.value || Object.keys(getReports()).sort().pop() || '';
  }

  function getCurrentReport() {
    const reports = getReports();
    const key = getCurrentMonthKey();
    return reports[key] || reports[Object.keys(reports)[0]] || {};
  }

  function getSitesByBrand(brandName) {
    const list = getCurrentReport().site_list || [];
    const b = String(brandName || 'ALL').trim();
    if (!b || b.toLowerCase() === 'all') {
      return list.filter((s) => s.id !== 'ALL');
    }
    return list.filter(
      (s) => s.id !== 'ALL' && String(s.brand || '').toLowerCase() === b.toLowerCase()
    );
  }

  function api() {
    return window.ITC_REPORT_API;
  }

  function setReportPage(page) {
    const sel = $('reportPageSelect');
    if (sel) {
      sel.value = page;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.querySelectorAll('.viewBtn').forEach((btn) => {
      const p = String(btn.dataset.page || '').toUpperCase();
      btn.classList.toggle('is-active', p === page);
      btn.setAttribute('aria-pressed', p === page ? 'true' : 'false');
    });
  }

  function selectSiteFromSidebar(siteId) {
    const siteSelect = $('siteSelect');
    if (!siteSelect) return;
    const val = siteId || 'ALL';
    if (![...siteSelect.options].some((o) => o.value === val)) return;
    siteSelect.value = val;
    siteSelect.dispatchEvent(new Event('change', { bubbles: true }));
    updateDashSummary();
    updateHeaderContext();
  }

  function selectBrandFromSidebar(brandName) {
    const b = String(brandName || 'All');
    dashBrand = b.toLowerCase() === 'all' ? 'ALL' : b;
    window.ITC_DASH_BRAND = dashBrand;
    const A = api();
    if (A && A.fillSiteSelect) {
      A.fillSiteSelect(dashBrand === 'ALL' ? 'ALL' : A.getCurrentSelId?.() || 'ALL');
    }
    renderSidebarSites(dashBrand);
    if (dashBrand === 'ALL') {
      selectSiteFromSidebar('ALL');
    } else {
      const sites = getSitesByBrand(dashBrand);
      selectSiteFromSidebar(sites[0]?.id || 'ALL');
    }
    updateBrandSummaryCard();
    updateDashSummary();
    setActiveSidebarItem('brand-' + (dashBrand === 'ALL' ? 'all' : dashBrand.toLowerCase()));
  }

  function renderSidebarSites(brandName) {
    const wrap = $('dashSiteList');
    if (!wrap) return;
    const sites =
      String(brandName || 'ALL').toUpperCase() === 'ALL'
        ? getSitesByBrand('ALL')
        : getSitesByBrand(brandName);
    const cur = $('siteSelect')?.value || 'ALL';
    wrap.innerHTML = sites
      .map((s) => {
        const active = s.id === cur ? ' is-active' : '';
        const badge = esc(s.brand || '—');
        return `<button type="button" class="dash-nav-item dash-site-item${active}" data-nav="site-${escAttr(s.id)}" data-site-id="${escAttr(s.id)}" title="${esc(s.name)}">
          <span class="dash-site-row"><span class="dash-site-name">${esc(s.name)}</span><span class="dash-brand-badge">${badge}</span></span>
        </button>`;
      })
      .join('');
    bindNavItems(wrap);
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
  }

  function setActiveSidebarItem(itemId) {
    activeNavId = itemId;
    document.querySelectorAll('#dashSidebar .dash-nav-item').forEach((el) => {
      const id = el.getAttribute('data-nav');
      el.classList.toggle('is-active', id === itemId);
    });
    const siteId = $('siteSelect')?.value;
    if (siteId) {
      document.querySelectorAll('#dashSiteList .dash-nav-item').forEach((el) => {
        el.classList.toggle('is-active', el.getAttribute('data-site-id') === siteId);
      });
    }
  }

  function scrollToReportSection(sectionKey) {
    const cfg = SECTION_MAP[sectionKey];
    if (!cfg) return;
    if (cfg.page === 'COMPARE' || cfg.page === 'CHAT' || cfg.page === 'REPORT') {
      document.body.removeAttribute('data-ird-view');
    }
    if (cfg.page) setReportPage(cfg.page);
    if (cfg.roomAnalysis) {
      const runRoom = () => {
        const sid = $('siteSelect')?.value || 'ALL';
        if (window.ITC_ROOM_ANALYSIS) {
          if (typeof window.ITC_ROOM_ANALYSIS.ensureReady === 'function') {
            window.ITC_ROOM_ANALYSIS.ensureReady()
              .then(() => {
                window.ITC_ROOM_ANALYSIS.setSite(sid);
              })
              .catch(() => {});
          } else if (typeof window.ITC_ROOM_ANALYSIS.setSite === 'function') {
            window.ITC_ROOM_ANALYSIS.setSite(sid);
          }
        }
      };
      runRoom();
    }
    if (cfg.ird && typeof window.enterIrdView === 'function') {
      window.enterIrdView();
    } else if (cfg.ird) {
      document.body.setAttribute('data-ird-view', 'ON');
      const pg = $('irdRevenuePage');
      if (pg) {
        pg.hidden = false;
        pg.style.setProperty('display', 'block', 'important');
      }
    }
    window.setTimeout(() => {
      let el = null;
      if (cfg.scroll) el = $(cfg.scroll);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (sectionKey === 'overview') window.scrollTo({ top: 0, behavior: 'smooth' });
    }, cfg.page === 'COMPARE' || cfg.page === 'CHAT' ? 120 : 60);
    if ($('dashHeaderTitle')) $('dashHeaderTitle').textContent = cfg.title;
    setActiveSidebarItem('nav-' + sectionKey);
    if (window.innerWidth < 1024) closeSidebarMobile();
  }

  function toggleSidebar() {
    document.body.classList.toggle('dash-collapsed');
    try {
      localStorage.setItem(
        'itcDashCollapsed',
        document.body.classList.contains('dash-collapsed') ? '1' : '0'
      );
    } catch (_) {}
  }

  function closeSidebarMobile() {
    document.body.classList.remove('dash-sidebar-open');
  }

  function openSidebarMobile() {
    document.body.classList.add('dash-sidebar-open');
  }

  function updateHeaderContext() {
    const report = getCurrentReport();
    const period = report.period || {};
    const siteOpt = $('siteSelect');
    const siteName =
      siteOpt?.selectedOptions?.[0]?.textContent?.trim() || 'All Sites (Combined)';
    const brandLabel = dashBrand === 'ALL' ? 'All brands' : dashBrand;
    if ($('dashHeaderSub'))
      $('dashHeaderSub').textContent = `${period.label || '—'} · ${brandLabel} · ${siteName}`;
    if ($('dashSummaryMonth')) $('dashSummaryMonth').textContent = period.label || '—';
    if ($('dashSummaryBrand')) $('dashSummaryBrand').textContent = brandLabel;
    if ($('dashSummarySite')) $('dashSummarySite').textContent = siteName;
    if ($('dashSummarySiteCount'))
      $('dashSummarySiteCount').textContent = String(getSitesByBrand(dashBrand === 'ALL' ? 'ALL' : dashBrand).length);
    const viewLabel =
      { REPORT: 'Summary report', COMPARE: 'Compare sites', CHAT: 'Room chatbot' }[
        $('reportPageSelect')?.value || 'REPORT'
      ] || 'Summary report';
    if ($('dashSummaryView')) $('dashSummaryView').textContent = viewLabel;
  }

  function updateDashSummary() {
    updateHeaderContext();
    const siteId = $('siteSelect')?.value || 'ALL';
    document.querySelectorAll('#dashSiteList .dash-nav-item').forEach((el) => {
      el.classList.toggle('is-active', el.getAttribute('data-site-id') === siteId);
    });
  }

  function aggregateBrandMetrics(brandName) {
    const report = getCurrentReport();
    const sels = report.selections || {};
    const sites = getSitesByBrand(brandName);
    let guestDays = 0;
    let ott = 0;
    let dth = 0;
    let cast = 0;
    let total = 0;
    let n = 0;
    sites.forEach((site) => {
      const sel = sels[site.id];
      if (!sel || !sel.totals) return;
      n++;
      const t = sel.totals;
      const dg = t.dur_min_per_guest || {};
      ott += Number(dg.OTT || 0);
      dth += Number(dg.DTH || 0);
      cast += Number(dg.Casting || 0);
      total += Number(dg.Total || 0);
      const wd = sel.day_type?.Weekday?.guest_days || 0;
      const we = sel.day_type?.Weekend?.guest_days || 0;
      guestDays += wd + we;
    });
    if (!n && brandName !== 'ALL') return null;
    if (brandName === 'ALL' || String(brandName).toLowerCase() === 'all') {
      const allSel = sels.ALL;
      if (allSel?.totals) {
        const dg = allSel.totals.dur_min_per_guest || {};
        return {
          sites: getSitesByBrand('ALL').length,
          guestDays:
            (allSel.day_type?.Weekday?.guest_days || 0) + (allSel.day_type?.Weekend?.guest_days || 0),
          ott: dg.OTT,
          dth: dg.DTH,
          cast: dg.Casting,
          total: dg.Total,
        };
      }
    }
    return {
      sites: sites.length,
      guestDays,
      ott: n ? ott / n : 0,
      dth: n ? dth / n : 0,
      cast: n ? cast / n : 0,
      total: n ? total / n : 0,
    };
  }

  function fmt(n, d) {
    return Number(n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  }

  function updateBrandSummaryCard() {
    const card = $('dashBrandSummary');
    if (!card) return;
    if (dashBrand === 'ALL') {
      card.classList.remove('is-visible');
      return;
    }
    const m = aggregateBrandMetrics(dashBrand);
    if (!m) {
      card.classList.remove('is-visible');
      return;
    }
    card.classList.add('is-visible');
    const cells = [
      ['Sites', String(m.sites)],
      ['Guest-days', fmt(m.guestDays, 0)],
      ['Avg total min/guest', fmt(m.total, 1)],
      ['Avg OTT min/guest', fmt(m.ott, 1)],
      ['Avg DTH min/guest', fmt(m.dth, 1)],
      ['Avg casting min/guest', fmt(m.cast, 1)],
    ];
    const grid = cells
      .map(([lbl, val]) => '<div><div class="lbl">' + lbl + '</div><div class="val">' + val + '</div></div>')
      .join('');
    card.innerHTML =
      '<div class="lbl">' + esc(dashBrand) + ' segment summary</div><div class="brand-grid">' + grid + '</div>';
  }

  function bindNavItems(root) {
    (root || document).querySelectorAll('.dash-nav-item[data-nav]').forEach((btn) => {
      if (btn._dashBound) return;
      btn._dashBound = true;
      btn.addEventListener('click', onNavClick);
    });
  }

  function onNavClick(e) {
    const btn = e.currentTarget;
    const nav = btn.getAttribute('data-nav');
    if (!nav) return;
    if (nav === 'nav-overview') {
      dashBrand = 'ALL';
      window.ITC_DASH_BRAND = 'ALL';
      const A = api();
      if (A?.fillSiteSelect) A.fillSiteSelect('ALL');
      renderSidebarSites('ALL');
      selectSiteFromSidebar('ALL');
      setReportPage('REPORT');
      scrollToReportSection('overview');
      updateBrandSummaryCard();
      return;
    }
    if (nav === 'nav-all-sites') {
      dashBrand = 'ALL';
      window.ITC_DASH_BRAND = 'ALL';
      api()?.fillSiteSelect?.('ALL');
      renderSidebarSites('ALL');
      selectSiteFromSidebar('ALL');
      setActiveSidebarItem(nav);
      updateBrandSummaryCard();
      return;
    }
    if (nav.startsWith('brand-')) {
      const brand = nav.replace('brand-', '');
      const name = brand === 'all' ? 'All' : brand.charAt(0).toUpperCase() + brand.slice(1);
      if (brand === 'all') selectBrandFromSidebar('All');
      else if (brand === 'welcomhotel') selectBrandFromSidebar('Welcomhotel');
      else selectBrandFromSidebar(name);
      return;
    }
    if (nav.startsWith('site-')) {
      const siteId = btn.getAttribute('data-site-id');
      selectSiteFromSidebar(siteId);
      setActiveSidebarItem(nav);
      return;
    }
    if (nav === 'nav-export') {
      $('btnExport')?.click();
      return;
    }
    if (nav === 'nav-labels') {
      $('valueSwitch')?.click();
      return;
    }
    if (nav.startsWith('nav-')) {
      const key = nav.replace('nav-', '');
      if (SECTION_MAP[key]) scrollToReportSection(key);
    }
  }

  function moveToolbarControls() {
    const toolbar = $('dashToolbar');
    const actions = document.querySelector('.topbar .actions');
    if (!toolbar || !actions) return;
    while (actions.firstChild) toolbar.appendChild(actions.firstChild);
  }

  function initDashboard() {
    window.ITC_DASH_BRAND = 'ALL';
    try {
      if (localStorage.getItem('itcDashCollapsed') === '1') document.body.classList.add('dash-collapsed');
    } catch (_) {}

    moveToolbarControls();
    renderSidebarSites('ALL');
    bindNavItems($('dashSidebar'));
    updateDashSummary();
    updateBrandSummaryCard();

    $('dashMenuBtn')?.addEventListener('click', () => {
      if (window.innerWidth < 1024) {
        if (document.body.classList.contains('dash-sidebar-open')) closeSidebarMobile();
        else openSidebarMobile();
      } else toggleSidebar();
    });
    $('dashOverlay')?.addEventListener('click', closeSidebarMobile);

    $('monthSelect')?.addEventListener('change', () => {
      renderSidebarSites(dashBrand);
      updateDashSummary();
      updateBrandSummaryCard();
    });
    $('siteSelect')?.addEventListener('change', updateDashSummary);
    $('reportPageSelect')?.addEventListener('change', updateDashSummary);

    setActiveSidebarItem('nav-overview');
  }

  window.ITC_DASHBOARD = {
    getCurrentReport,
    getSitesByBrand,
    renderSidebarSites,
    selectSiteFromSidebar,
    selectBrandFromSidebar,
    scrollToReportSection,
    setActiveSidebarItem,
    toggleSidebar,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initDashboard, 50));
  } else {
    setTimeout(initDashboard, 50);
  }
})();
