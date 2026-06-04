/**
 * Apply MSR admin dashboard layout to index.html
 * Run: node apply_dashboard.js
 */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, 'index.html');
const CSS = fs.readFileSync(path.join(__dirname, 'itc_dashboard.css'), 'utf8');
const DASH_JS = fs.readFileSync(path.join(__dirname, 'itc_dashboard.js'), 'utf8');

let html = fs.readFileSync(HTML, 'utf8');
if (html.includes('id="dashSidebar"')) {
  console.log('Dashboard already applied.');
  process.exit(0);
}

html = html.replace('</style>', CSS + '\n</style>');

const sectionIds = [
  ['<h2>1) Weekday vs Weekend guest behaviour</h2>', '<h2 id="secWeekday">1) Weekday vs Weekend guest behaviour</h2>'],
  ['<h2>2) Usage by time of day</h2>', '<h2 id="secTimeOfDay">2) Usage by time of day</h2>'],
  [
    '<h2>3) Daily usage trends and room-wise drill-down</h2>',
    '<h2 id="secDailyTrends">3) Daily usage trends and room-wise drill-down</h2>',
  ],
  ['<h2>4) OTT &amp; Streaming</h2>', '<h2 id="secOttDth">4) OTT &amp; Streaming</h2>'],
  [
    '<h2>5) DTH channel usage — one guest per occupied room-day</h2>',
    '<h2 id="secDth">5) DTH channel usage — one guest per occupied room-day</h2>',
  ],
  [
    '<h2>6) Smartler usage — one guest per occupied room-day</h2>',
    '<h2 id="secSmartler">6) Smartler usage — one guest per occupied room-day</h2>',
  ],
];
for (const [from, to] of sectionIds) {
  if (html.includes(from)) html = html.replace(from, to);
}

function svg(pathD) {
  return `<svg class="dash-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${pathD}"/></svg>`;
}

const sidebar = [
  '<motion id="dashOverlay" aria-hidden="true"></motion>',
  '<div id="dashApp" class="dash-app">',
  '<aside id="dashSidebar" aria-label="Report navigation">',
  '<div class="dash-logo"><div class="dash-logo-mark">MSR</div><div class="dash-logo-text"><div class="t1">ITC Analytics</div><div class="t2">MSR Guest Behaviour Portal</div></div></div>',
  '<div class="dash-sidebar-scroll">',
  '<div class="dash-nav-group"><motion class="dash-nav-group-title">Dashboard</motion>',
  `<button type="button" class="dash-nav-item is-active" data-nav="nav-overview">${svg('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a6')}<span class="dash-nav-label">Overview</span></button></div>`,
  '<div class="dash-nav-group"><div class="dash-nav-group-title">Report Sections</div>',
  `<button type="button" class="dash-nav-item" data-nav="nav-weekday">${svg('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z')}<span class="dash-nav-label">Weekday vs Weekend</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="nav-compare">${svg('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z')}<span class="dash-nav-label">Compare Sites</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="nav-ird">${svg('M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z')}<span class="dash-nav-label">IRD Revenue</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="nav-timeofday">${svg('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z')}<span class="dash-nav-label">Time of Day Usage</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="nav-daily">${svg('M4 6h16M4 12h16M4 18h16')}<span class="dash-nav-label">Daily Trends</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="nav-ott">${svg('M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z')}<span class="dash-nav-label">OTT &amp; Streaming</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="nav-dth">${svg('M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z')}<span class="dash-nav-label">DTH Channel Usage</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="nav-smartler">${svg('M13 10V3L4 14h7v7l9-11h-7z')}<span class="dash-nav-label">Smartler Usage</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="nav-chatbot">${svg('M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z')}<span class="dash-nav-label">Room Chatbot</span></button></div>`,
  '<div class="dash-nav-group"><div class="dash-nav-group-title">Brand Segments</div>',
  `<button type="button" class="dash-nav-item" data-nav="brand-all">${svg('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5')}<span class="dash-nav-label">All Sites</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="brand-itc">${svg('M3 21h18')}<span class="dash-nav-label">ITC</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="brand-sheraton">${svg('M3 21h18')}<span class="dash-nav-label">Sheraton</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="brand-storii">${svg('M3 21h18')}<span class="dash-nav-label">Storii</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="brand-welcomhotel">${svg('M3 21h18')}<span class="dash-nav-label">Welcomhotel</span></button></motion>`,
  '<div class="dash-nav-group"><div class="dash-nav-group-title">Site Management</div>',
  `<button type="button" class="dash-nav-item" data-nav="nav-all-sites">${svg('M4 6h16M4 10h16M4 14h16M4 18h16')}<span class="dash-nav-label">All Sites (Combined)</span></button>`,
  '<div id="dashSiteList"></div></div>',
  '<div class="dash-nav-group"><div class="dash-nav-group-title">Report Tools</div>',
  `<button type="button" class="dash-nav-item" data-nav="nav-export">${svg('M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z')}<span class="dash-nav-label">Export / Print</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="nav-labels">${svg('M7 7h.01M7 3h5c.512 0 .953.386 1.007.867l.007.117V7h3a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h3V5.126')}<span class="dash-nav-label">Data Labels On/Off</span></button></div>`,
  '<div class="dash-nav-group"><div class="dash-nav-group-title">Account</div>',
  `<button type="button" class="dash-nav-item" data-nav="nav-profile">${svg('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z')}<span class="dash-nav-label">User Profile</span></button>`,
  `<button type="button" class="dash-nav-item" data-nav="nav-logout">${svg('M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1')}<span class="dash-nav-label">Logout</span></button></div>`,
  '</div></aside>',
  '<div class="dash-main">',
  '<header id="dashHeader">',
  '<button type="button" id="dashMenuBtn" aria-label="Toggle sidebar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>',
  '<div class="dash-header-title"><h1 id="dashHeaderTitle">Overview</h1><div class="dash-header-sub" id="dashHeaderSub">MSR Analytics Portal</div></div>',
  '<div class="dash-header-user"><div><div class="dash-user-name">Rakesh Mondal</div><div class="dash-user-role">MSR Analytics</motion></motion><div class="dash-user-avatar">RM</div></motion>',
  '<div id="dashToolbar"></div></header>',
  '<div id="dashSummaryStrip">',
  '<div class="dash-summary-card"><div class="lbl">Month</div><div class="val" id="dashSummaryMonth">—</div></div>',
  '<motion class="dash-summary-card"><div class="lbl">Brand</div><div class="val" id="dashSummaryBrand">All</div></motion>',
  '<div class="dash-summary-card"><div class="lbl">Site</div><div class="val" id="dashSummarySite">—</div></div>',
  '<div class="dash-summary-card"><motion class="lbl">Sites in list</div><div class="val" id="dashSummarySiteCount">0</div></div>',
  '<div class="dash-summary-card"><div class="lbl">Report view</div><div class="val" id="dashSummaryView">Summary</div></div>',
  '<div class="dash-summary-card" id="dashBrandSummary"></div></div>',
  '<div id="dashContent">',
]
  .join('')
  .replace(/<\/?motion>/g, (t) => (t === '</motion>' ? '</div>' : '<div>'));

html = html.replace(
  '<body data-report-page="REPORT" data-view="USAGE">',
  '<body data-report-page="REPORT" data-view="USAGE" class="dash-portal">' + sidebar
);

html = html.replace(
  '\n<script id="irdRevenueData"',
  '\n</div></div></div>\n<script id="irdRevenueData"'
);

const oldFill = `  function fillSiteSelect(selId='ALL') {
    const selEl = $("siteSelect");
    if (!selEl) return;
    selEl.innerHTML = "";
    currentSiteList().forEach(o => {`;

const newFill = `  function fillSiteSelect(selId='ALL') {
    const selEl = $("siteSelect");
    if (!selEl) return;
    const brandFilter = String(window.ITC_DASH_BRAND || 'ALL').trim();
    const sites = currentSiteList().filter(o => {
      if (brandFilter === 'ALL' || brandFilter === 'All') return true;
      if (o.id === 'ALL') return false;
      return String(o.brand || '').toLowerCase() === brandFilter.toLowerCase();
    });
    selEl.innerHTML = "";
    sites.forEach(o => {`;

if (html.includes(oldFill)) html = html.replace(oldFill, newFill);

html = html.replace(
  "selEl.value = currentSiteList().some(x => x.id === selId) ? selId : 'ALL';",
  "selEl.value = sites.some(x => x.id === selId) ? selId : (sites.some(x => x.id === 'ALL') ? 'ALL' : (sites[0]?.id || 'ALL'));"
);

html = html.replace(
  "  document.addEventListener('DOMContentLoaded', init);",
  `  window.ITC_REPORT_API = {
    getReports: () => REPORTS,
    getReport: () => REPORT,
    getCurrentSelId: () => currentSelId,
    getReportPage: () => reportPage,
    setReportPage,
    fillSiteSelect,
    renderSelection,
    setCurrentSelId: (id) => { currentSelId = id; },
  };

  document.addEventListener('DOMContentLoaded', init);`
);

html = html.replace('</body>', `<script>\n${DASH_JS}\n</script>\n</body>`);

fs.writeFileSync(HTML, html);
console.log('Dashboard applied to index.html');
