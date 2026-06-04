/**
 * Patches ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html
 * Run: node patch_itc_ui.js
 */
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, 'ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html');
const PLATFORM_PATH = path.join(__dirname, 'itc_platform.js');

let html = fs.readFileSync(HTML_PATH, 'utf8');
if (html.includes('id="itcPlatformScript"')) {
  console.log('Already patched.');
  process.exit(0);
}

let platformJs = fs.readFileSync(PLATFORM_PATH, 'utf8');
platformJs = platformJs.replace(
  /if \(!sites\.length\) \{[\s\S]*?return;\s*\}/,
  `if (!sites.length) {
        list.innerHTML = '<motion class="siteComboItem" style="cursor:default;color:var(--muted)">No matches</motion>'.replace(/motion/g,'motion');
        return;
      }`.replace(/motion/g, 'div')
);
platformJs = platformJs.replace(
  /return \(\s*'<motion class="siteComboItem"/,
  "return ('<div class=\"siteComboItem\""
);
platformJs = platformJs.replace(/\)\.replace\(\/motion\/g, 'div'\);/, ');');

function rep(from, to, label) {
  if (!html.includes(from)) {
    console.warn('WARN missing:', label || from.slice(0, 80));
    return false;
  }
  html = html.replace(from, to);
  return true;
}

const CSS = `
/* === ITC UI enhancements === */
#reportLoadOverlay{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.45);backdrop-filter:blur(4px);}
#reportLoadOverlay.is-visible{display:flex;}
#reportLoadOverlay .loadCard{background:#fff;border-radius:18px;padding:22px 28px;box-shadow:0 20px 50px rgba(2,6,23,.2);max-width:360px;text-align:center;}
#reportLoadOverlay .loadTitle{font-weight:900;font-size:15px;margin-bottom:6px;}
#reportLoadOverlay .loadMsg{color:var(--muted);font-size:13px;}
#reportLoadOverlay .loadSpinner{width:36px;height:36px;border:3px solid rgba(148,163,184,.35);border-top-color:var(--accent);border-radius:50%;margin:0 auto 12px;animation:itcSpin .8s linear infinite;}
@keyframes itcSpin{to{transform:rotate(360deg);}}
#reportErrorBanner{display:none;position:sticky;top:52px;z-index:45;background:#fef2f2;border-bottom:1px solid #fecaca;color:#991b1b;padding:10px 18px;font-size:13px;}
#reportErrorBanner.is-visible{display:block;}
body[data-report-page="COMPARE"] #sectionNavWrap,body[data-report-page="CHAT"] #sectionNavWrap{display:none!important;}
#sectionNavWrap{position:sticky;top:52px;z-index:40;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);margin:0 -18px 14px;padding:8px 18px;}
#sectionNav{display:flex;gap:6px;flex-wrap:wrap;}
#sectionNav a{font-size:11px;font-weight:800;padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--muted);text-decoration:none;}
#sectionNav a.is-active{border-color:rgba(245,158,11,.45);color:var(--ink);background:#fffbeb;}
.kpi.is-loading .value{color:transparent!important;position:relative;min-height:1.2em;}
.kpi.is-loading .value::after{content:"";position:absolute;inset:4px 0;border-radius:6px;background:linear-gradient(90deg,rgba(148,163,184,.15),rgba(148,163,184,.28),rgba(148,163,184,.15));background-size:200% 100%;animation:itcSkel 1.2s infinite;}
@keyframes itcSkel{0%{background-position:100% 0}100%{background-position:-100% 0}}
.kpi .kpiPlain{font-size:11px;color:var(--muted);margin-top:2px;}
.kpi .kpiDelta{font-size:11px;font-weight:800;margin-left:6px;}
.kpi .kpiDelta.up{color:#059669}.kpi .kpiDelta.down{color:#dc2626}
.siteCombo{position:relative;min-width:180px;}
.siteCombo input{width:100%;border:1px solid var(--line);border-radius:12px;padding:9px 11px;font:inherit;font-weight:700;}
.siteComboList{position:absolute;left:0;right:0;top:calc(100% + 4px);max-height:260px;overflow:auto;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);z-index:80;display:none;}
.siteComboList.open{display:block;}
.siteComboItem{padding:9px 12px;cursor:pointer;font-size:12px;}
.siteComboItem:hover,.siteComboItem.active{background:rgba(245,158,11,.12);}
.siteComboItem .sub{font-size:11px;color:var(--muted);display:block;margin-top:2px;}
.siteBrandChips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
.siteBrandChips button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer;}
.siteBrandChips button.active{background:rgba(37,99,235,.1);color:#1d4ed8;}
#glossaryDialog{border:none;border-radius:18px;padding:0;max-width:520px;width:min(92vw,520px);}
#glossaryDialog::backdrop{background:rgba(15,23,42,.4);}
.glossaryInner{padding:18px 20px;}
.glossaryInner dt{font-weight:900;margin-top:10px;}
.glossaryInner dd{margin:4px 0 0;color:var(--muted);font-size:13px;line-height:1.45;}
#irdUnavailableBanner{display:none;padding:12px;border-radius:14px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:13px;margin-bottom:14px;}
body.ird-data-missing #irdUnavailableBanner{display:block;}
body.ird-data-missing #irdRevenuePage .chartWrap,body.ird-data-missing #irdRevenuePage .irdSummary,body.ird-data-missing #irdRevenuePage .revenueCard{display:none!important;}
.tbl th.sortable{cursor:pointer;}
.timeBarCell .bar{height:4px;background:rgba(245,158,11,.5);border-radius:2px;margin-top:4px;}
.chartEmptyMsg{display:none;padding:20px;text-align:center;color:var(--muted);font-size:13px;}
.chartWrap.has-empty canvas{display:none!important;}
.chartWrap.has-empty .chartEmptyMsg{display:block;}
#chatTablePager{display:flex;gap:8px;margin-top:8px;font-size:12px;color:var(--muted);}
#roomActivityRoomSearch{width:100%;margin-bottom:6px;border:1px solid var(--line);border-radius:10px;padding:8px;}
#ariaLiveRegion{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);}
#secRoomDrill{scroll-margin-top:120px;}
@media(max-width:768px){.enhancedTools,.enhancedTools.two,.enhancedTools.roomTools{grid-template-columns:1fr!important;}}
`;

rep('</style>', CSS + '\n</style>', 'css');

rep(
  '<body data-report-page="REPORT" data-view="USAGE">',
  `<body data-report-page="REPORT" data-view="USAGE">
<div id="reportLoadOverlay" aria-hidden="true"><div class="loadCard"><div class="loadSpinner"></motion></div><div class="loadTitle">Loading report data</div><motion class="loadMsg">Preparing room and trend data…</div></div></div>
<div id="reportErrorBanner" role="alert"></div>
<div id="ariaLiveRegion" aria-live="polite" aria-atomic="true"></div>`.replace(/<\/?motion[^>]*>/g, ''),
  'body'
);

rep(
  '<button class="btn primary" id="btnExport" type="button">Export / Print</button>',
  `<button class="btn" id="btnGlossary" type="button" title="Glossary">?</button>
<button class="btn" id="btnCopyLink" type="button">Copy link</button>
<button class="btn" id="btnExportSummaryCsv" type="button">Summary CSV</button>
<button class="btn primary" id="btnExport" type="button">Export / Print</button>`,
  'buttons'
);

rep(
  '<span class="badge" id="periodBadge">Period: —</span>',
  `<span class="badge" id="periodBadge">Period: —</span>
<span class="badge" id="coverageBadge">Coverage: —</span>`,
  'coverage'
);

rep(
  '<motion class="selectWrap" id="siteSelectWrap"><label class="selectLabel" for="siteSelect">Site</label>'.replace(
    'motion',
    'div'
  ),
  '<div class="selectWrap" id="siteSelectWrap"><label class="selectLabel" for="siteSelect">Site</label><div id="siteComboWrap"></div>',
  'combo'
);

rep(
  '<div class="selectWrap" id="siteSelectWrap"><label class="selectLabel" for="siteSelect">Site</label>',
  '<div class="selectWrap" id="siteSelectWrap"><label class="selectLabel" for="siteSelect">Site</label><motion id="siteComboWrap"></motion>'.replace(
    /motion/g,
    'div'
  ),
  'combo2'
);

rep(
  '<div id="reportPageContent">',
  `<div id="sectionNavWrap"><nav id="sectionNav" aria-label="Report sections">
<a href="#secOverview">Overview</a>
<a href="#secWeekday">Weekday vs weekend</a>
<a href="#secTimeOfDay">Time of day</a>
<a href="#secDailyTrends">Daily trends</a>
<a href="#secOttDth">OTT &amp; DTH</a>
<a href="#secRoomDrill">Room detail</a>
</nav></div>
<div id="reportPageContent">`,
  'nav'
);

rep(
  '<div id="reportPageContent">\n<!-- KPIs -->',
  '<div id="reportPageContent">\n<div id="secOverview">\n<!-- KPIs -->',
  'secOverview'
);

rep('<h2>1) Weekday vs Weekend guest behaviour</h2>', '<h2 id="secWeekday">1) Weekday vs Weekend guest behaviour</h2>', 'h2-1');
rep('<h2>2) Usage by time of day</h2>', '<h2 id="secTimeOfDay">2) Usage by time of day</h2>', 'h2-2');
rep(
  '<h2>3) Day-on-day usage trends and room-wise drill-down</h2>',
  '<h2 id="secDailyTrends">3) Day-on-day usage trends and room-wise drill-down</h2>',
  'h2-3'
);
rep('<h2>3) OTT &amp; Streaming</h2>', '<h2 id="secOttDth">3) OTT &amp; Streaming</h2>', 'h2-ott');

rep(
  '<button class="btn" id="btnCompareClear" type="button">Clear</button>',
  `<button class="btn" id="btnCompareTop4" type="button">Top 4 by viewing</button>
<button class="btn" id="btnCompareExport" type="button">Export CSV</button>
<button class="btn" id="btnCompareClear" type="button">Clear</button>`,
  'compare btns'
);

rep(
  '<motion id="compareContent" style="display:none;">'.replace('motion', 'motion'),
  '',
  'skip'
);

rep(
  '<motion id="compareContent" style="display:none;">'.replace(/motion/g, 'div'),
  `<div id="compareRankingWrap" class="card" style="margin-bottom:14px"><b>Site ranking (total min / guest-day)</b>
<div class="tableWrap"><table class="tbl" id="compareRankingTable"><thead><tr>
<th class="sortable">Site</th><th class="right sortable">Total min</th><th class="right sortable">OTT %</th><th class="right sortable">DTH %</th><th class="right sortable">Casting %</th>
</tr></thead><tbody id="compareRankingBody"></tbody></table></motion></div>
<div id="compareContent" style="display:none;">`.replace(/motion/g, 'div'),
  'compare rank'
);

if (!html.includes('compareRankingWrap')) {
  rep(
    '<div id="compareContent" style="display:none;">',
    `<div id="compareRankingWrap" class="card" style="margin-bottom:14px"><b>Site ranking (total min / guest-day)</b>
<div class="tableWrap"><table class="tbl" id="compareRankingTable"><thead><tr>
<th class="sortable">Site</th><th class="right sortable">Total min</th><th class="right sortable">OTT %</th><th class="right sortable">DTH %</th><th class="right sortable">Casting %</th>
</tr></thead><tbody id="compareRankingBody"></tbody></table></div></motion></div>
<div id="compareContent" style="display:none;">`.replace('</motion>', ''),
    'compare rank2'
  );
}

rep(
  '<script id="irdRevenueData"',
  `<dialog id="glossaryDialog"><div class="glossaryInner">
<h2>Report glossary</h2>
<dl>
<dt>Guest-day / occupied room-day</dt><dd>One guest per occupied room per day; metrics use this as the denominator.</dd>
<dt>OTT</dt><dd>Streaming apps on the in-room TV.</dd>
<dt>DTH</dt><dd>TV channels from the line-up (not mobile menu).</dd>
<dt>Casting</dt><dd>Phone/tablet casting to the TV.</dd>
<dt>Smartler</dt><dd>Room automation (lights, AC, DND, etc.).</dd>
<dt>Mobile Usage</dt><dd>IRD, SPA, laundry, CMS and similar—separate from DTH.</dd>
</dl>
<button class="btn primary" type="button" data-glossary-close>Close</button>
</div></dialog>
<script id="irdRevenueData"`,
  'glossary'
);

rep(
  '<h2>IRD Revenue — 3 month analysis</h2>',
  `<motion id="irdUnavailableBanner"><b>IRD revenue not included in this export.</b> Revenue data were not in the source package for this report.</motion>
<h2>IRD Revenue — 3 month analysis</h2>`.replace(/motion/g, 'div'),
  'ird'
);

rep(
  '<div class="label">Avg OTT per guest-day</div>',
  '<div class="label">Avg OTT per guest-day</div><div class="kpiPlain">Streaming minutes per guest-day</motion>'.replace(/motion/g, 'div'),
  'kpi1'
);
rep(
  '<div class="label">Avg DTH per guest-day</div>',
  '<div class="label">Avg DTH per guest-day</div><div class="kpiPlain">TV channel minutes per guest-day</div>',
  'kpi2'
);
rep(
  '<motion class="label">Avg Casting per guest-day</motion>'.replace(/motion/g, 'motion'),
  '',
  'skip'
);
rep(
  '<div class="label">Avg Casting per guest-day</div>',
  '<div class="label">Avg Casting per guest-day</div><div class="kpiPlain">Casting minutes per guest-day</div>',
  'kpi3'
);

// Platform script BEFORE IRD (after main IIFE) so ITC_DATA exists for enhanced block
const platformTag = `<script id="itcPlatformScript">\n${platformJs}\n</script>\n`;
rep(
  `})();
</script>
<script>
(function(){
  const IRD_DATA`,
  `})();
</script>
${platformTag}<script>
(function(){
  const IRD_DATA`,
  'platform inject'
);

rep(
  `  document.addEventListener('DOMContentLoaded', init);
})();
</script>
${platformTag}<script>`,
  `  window.ITC_REPORT = {
    getReport: () => REPORT,
    getReports: () => REPORTS,
    getMonthKeys: () => MONTH_KEYS,
    getCurrentSelId: () => currentSelId,
    setCurrentSelId: (id) => { currentSelId = id || 'ALL'; },
    getReportPage: () => reportPage,
    setReportPage,
    renderSelection,
    getSelection,
    compareSiteLabel,
    propertyLabel,
    currentSiteList,
    getCompareIds: () => compareSelectedIds.slice(),
    setCompareIds: (ids) => { compareSelectedIds = (ids || []).slice(0, MAX_COMPARE_SITES); },
    getCompareSelections: compareSiteSelections,
    compareSearchOptions,
    renderComparePage,
    renderCompareChooser,
    ensureCompareSelection,
    fmtNumber,
    fmtInt,
    fmtIndianDate,
    announceSite(name) {
      const el = document.getElementById('ariaLiveRegion');
      if (el) el.textContent = 'Showing ' + (name || 'selection');
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
</script>
<script>`,
  'ITC_REPORT - fix duplicate'
);

// If double platform, only first inject worked - handle ITC_REPORT only
if (!html.includes('window.ITC_REPORT')) {
  rep(
    `  document.addEventListener('DOMContentLoaded', init);
})();
</script>
<script>
(function(){
  const IRD_DATA`,
    `  window.ITC_REPORT = {
    getReport: () => REPORT,
    getReports: () => REPORTS,
    getMonthKeys: () => MONTH_KEYS,
    getCurrentSelId: () => currentSelId,
    setCurrentSelId: (id) => { currentSelId = id || 'ALL'; },
    getReportPage: () => reportPage,
    setReportPage,
    renderSelection,
    getSelection,
    compareSiteLabel,
    propertyLabel,
    currentSiteList,
    getCompareIds: () => compareSelectedIds.slice(),
    setCompareIds: (ids) => { compareSelectedIds = (ids || []).slice(0, MAX_COMPARE_SITES); },
    getCompareSelections: compareSiteSelections,
    compareSearchOptions,
    renderComparePage,
    renderCompareChooser,
    ensureCompareSelection,
    fmtNumber,
    fmtInt,
    fmtIndianDate,
    announceSite(name) {
      const el = document.getElementById('ariaLiveRegion');
      if (el) el.textContent = 'Showing ' + (name || 'selection');
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
</script>
<script>
(function(){
  const IRD_DATA`,
    'ITC_REPORT'
  );
}

rep(
  `async function dec(){
  let b64=$('reportEnhancedDataGzip').textContent.trim(), bin=atob(b64), bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  if(!('DecompressionStream' in window)) throw Error('Open this report in recent Chrome, Edge, or Safari for compressed drill-down data.');
  let stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}`,
  `async function dec(){
  return window.ITC_DATA.loadEnhanced();
}`,
  'dec'
);

rep(
  "document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();",
  `function bootEnhancedOnce(){
  if(window.ITC_ENHANCED_BOOT_DONE) return;
  window.ITC_ENHANCED_BOOT_DONE=1;
  init();
}
window.ITC_ENHANCED_BOOT = bootEnhancedOnce;
function scheduleEnhancedLazy(){
  if(window.ITC_DATA) window.ITC_DATA.ensureEnhancedLazy();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', scheduleEnhancedLazy);
else scheduleEnhancedLazy();`,
  'lazy init'
);

rep(
  `  async function decodeEnhancedData(){
    if (E) return E;
    const el = $('reportEnhancedDataGzip');
    if (!el) throw new Error('Enhanced room drill-down data is missing.');
    const b64 = el.textContent.trim();
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    if (!('DecompressionStream' in window)) throw new Error('Open this report in recent Chrome, Edge, or Safari for compressed room chatbot data.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    E = JSON.parse(await new Response(stream).text());
    return E;
  }`,
  `  async function decodeEnhancedData(){
    if (E) return E;
    E = await window.ITC_DATA.loadEnhanced();
    return E;
  }`,
  'chat decode'
);

rep(
  `  function renderComparePage() {
    syncCompareUi();
    const selections = compareSiteSelections();`,
  `  function renderComparePage() {
    syncCompareUi();
    const selections = compareSiteSelections();
    if (window.ITC_COMPARE_UI) window.ITC_COMPARE_UI.renderRanking(selections);`,
  'compare rank hook'
);

rep(
  `    } else if (reportPage === 'CHAT') {
      if (window.ITC_ROOM_CHAT && typeof window.ITC_ROOM_CHAT.ensureReady === 'function') window.ITC_ROOM_CHAT.ensureReady();`,
  `    } else if (reportPage === 'CHAT') {
      if (window.ITC_DATA) window.ITC_DATA.loadEnhanced().catch(()=>{});
      if (window.ITC_ROOM_CHAT && typeof window.ITC_ROOM_CHAT.ensureReady === 'function') window.ITC_ROOM_CHAT.ensureReady();`,
  'chat load'
);

// MoM - simpler patch on kpiOttDur only first
rep(
  `    if ($("kpiOttDur")) $("kpiOttDur").textContent = \`\${fmtNumber(totals?.dur_min_per_guest?.OTT || 0,1)} min\`;`,
  `    const _prevKey = MONTH_KEYS.length >= 2 ? MONTH_KEYS[MONTH_KEYS.indexOf(currentMonthKey()) - 1] : null;
    const _prevT = _prevKey && REPORTS[_prevKey]?.selections?.[selId]?.totals;
    function _delta(cur, prev) {
      if (!_prevKey || prev == null || prev === 0) return '';
      const pct = ((cur - prev) / prev) * 100;
      const cls = pct >= 0 ? 'up' : 'down';
      return '<span class="kpiDelta ' + cls + '">' + (pct >= 0 ? '▲' : '▼') + ' ' + Math.abs(pct).toFixed(1) + '% vs prior month</span>';
    }
    if ($("kpiOttDur")) $("kpiOttDur").innerHTML = fmtNumber(totals?.dur_min_per_guest?.OTT || 0,1) + ' min' + _delta(totals?.dur_min_per_guest?.OTT||0, _prevT?.dur_min_per_guest?.OTT);`,
  'mom'
);

// Room drill: add search + chat button via patch after roomActivitySearchBtn in HTML - use node line replace on line 1363 partial
html = html.replace(
  'id="roomActivitySearchBtn" type="button">Search</button>',
  'id="roomActivitySearchBtn" type="button">Search</button><button class="btn" id="btnRoomToChat" type="button">Analyse in chatbot</button>'
);

html = html.replace(
  '<label for="roomActivityRoomInput">Room</label><select id="roomActivityRoomInput">',
  '<label for="roomActivityRoomInput">Room</label><input type="text" id="roomActivityRoomSearch" placeholder="Filter rooms…"/><select id="roomActivityRoomInput">'
);

// secRoomDrill anchor before room block
if (!html.includes('id="secRoomDrill"')) {
  html = html.replace(
    '<b>Room-wise activity analysis</b>',
    '<span id="secRoomDrill"></span><b>Room-wise activity analysis</b>'
  );
}

// Chart empty msg template on chartWrap - add via JS in platform instead

// Chat pager HTML
html = html.replace(
  'id="chatActivityTable"',
  'id="chatActivityTable" data-paginated="1"'
);
if (!html.includes('chatTablePager')) {
  html = html.replace(
    'id="chatDownloadCsvBtn"',
    'id="chatTablePager"></div><div style="display:none" id="chatPagerPlaceholder"></motion><motion id="chatDownloadCsvBtn"'.replace(
      /motion/g,
      'div'
    )
  );
}

// Extra platform hooks appended
const extraHooks = `
window.ITC_ROOM_DRILL = {
  wire() {
    const btn = document.getElementById('btnRoomToChat');
    if (btn) btn.addEventListener('click', () => {
      const sid = document.getElementById('roomActivitySiteSelect')?.value;
      const room = document.getElementById('roomActivityRoomInput')?.value;
      const st = document.getElementById('roomActivityStart')?.value;
      const en = document.getElementById('roomActivityEnd')?.value;
      if (window.ITC_ROOM) window.ITC_ROOM.set({ siteId: sid||'', room: room||'', start: st||'', end: en||'' });
      if (window.ITC_REPORT) window.ITC_REPORT.setReportPage('CHAT');
      if (window.ITC_ROOM_CHAT) window.ITC_ROOM_CHAT.ensureReady().then(() => {
        const q = 'Give me a detailed summary for room ' + room + ' from ' + st + ' to ' + en;
        const inp = document.getElementById('chatQuestion');
        if (inp) inp.value = q;
      });
    });
    const rs = document.getElementById('roomActivityRoomSearch');
    const sel = document.getElementById('roomActivityRoomInput');
    if (rs && sel) rs.addEventListener('input', () => {
      const q = rs.value.toLowerCase();
      [...sel.options].forEach(o => { if (!o.value) return; o.hidden = q && !o.text.toLowerCase().includes(q); });
    });
  }
};
window.addEventListener('itc-enhanced-ready', () => window.ITC_ROOM_DRILL && window.ITC_ROOM_DRILL.wire());
document.addEventListener('DOMContentLoaded', () => setTimeout(() => window.ITC_ROOM_DRILL && window.ITC_ROOM_DRILL.wire(), 500));
`;

html = html.replace(
  '</script>\n</body>',
  extraHooks + '\n</script>\n</body>'
);

// Fix body overlay if broken
html = html.replace(
  /<div id="reportLoadOverlay"[\s\S]*?<motion id="ariaLiveRegion"/,
  `<motion id="reportLoadOverlay" aria-hidden="true"><div class="loadCard"><div class="loadSpinner"></div><div class="loadTitle">Loading report data</div><div class="loadMsg">Preparing room and trend data…</div></div></div>
<div id="reportErrorBanner" role="alert"></div>
<div id="ariaLiveRegion"`.replace(/motion/g, 'motion')
);
html = html.replace(/<motion /g, '<div ').replace(/<\/motion>/g, '</div>');

fs.writeFileSync(HTML_PATH, html, 'utf8');
console.log('Patched OK:', HTML_PATH);
