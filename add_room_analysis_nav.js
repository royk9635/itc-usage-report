/**
 * Add Room-wise activity analysis sidebar nav + section anchor + API hook.
 * Run: node add_room_analysis_nav.js
 */
const fs = require('fs');
const path = 'e:/usage_report/index.html';
let html = fs.readFileSync(path, 'utf8');

if (html.includes('data-nav="nav-roomanalysis"')) {
  console.log('Room analysis nav already present.');
  process.exit(0);
}

// 1) Section anchor before Top 5 rooms + heading for room activity block
const topRoomsNeedle = '<motion class="card enhancedBlock"><motion class="row space"><motion><b>Top 5 rooms by site</b>';
const topRoomsRepl =
  '<section id="secRoomAnalysis" class="room-analysis-section" aria-label="Room-wise activity analysis">' +
  '<h2 class="room-analysis-section-title">Room-wise activity analysis</h2>' +
  '<div id="secTopRooms" class="room-analysis-block">' +
  '<div class="card enhancedBlock"><div class="row space"><motion><b>Top 5 rooms by site</b>';

if (html.includes('<b>Top 5 rooms by site</b>') && !html.includes('id="secRoomAnalysis"')) {
  const needle2 = '<motion class="card enhancedBlock"><div class="row space"><div><b>Top 5 rooms by site</b>';
  const repl2 =
    '<section id="secRoomAnalysis" class="room-analysis-section" aria-label="Room-wise activity analysis">' +
    '<h2 class="room-analysis-section-title">Room-wise activity analysis</h2>' +
    '<div id="secTopRooms" class="room-analysis-block">' +
    '<div class="card enhancedBlock"><div class="row space"><div><b>Top 5 rooms by site</b>';
  if (html.includes(needle2)) html = html.replace(needle2, repl2);
  else if (html.includes(topRoomsNeedle)) html = html.replace(topRoomsNeedle, topRoomsRepl);
  else {
    html = html.replace(
      '<b>Top 5 rooms by site</b>',
      '</div><!--secTopRooms placeholder--><b>Top 5 rooms by site</b>'
    );
    console.warn('Partial anchor — check secTopRooms');
  }
}

// Close section before OTT h2
if (html.includes('id="secRoomAnalysis"') && !html.includes('</section><!--secRoomAnalysis-->')) {
  html = html.replace(
    '<h2 id="secOttDth">4) OTT &amp; Streaming</h2>',
    '</div></section><!--secRoomAnalysis-->\n<h2 id="secOttDth">4) OTT &amp; Streaming</h2>'
  );
  // Wrap room activity card with id
  if (!html.includes('id="secRoomActivity"')) {
    html = html.replace(
      '<b>Room-wise activity analysis</b>',
      '<motion id="secRoomActivity" class="room-analysis-block"><b>Room-wise activity analysis</b>'
    );
    html = html.replace(
      '</section><!--secRoomAnalysis-->',
      '</motion></section><!--secRoomAnalysis-->'
    );
    html = html.split('<motion id="secRoomActivity"').join('<div id="secRoomActivity"');
    html = html.split('</motion></section><!--secRoomAnalysis-->').join('</motion></section><!--secRoomAnalysis-->'.replace('motion', 'div'));
  }
}

// Fix motion typos if any from above
html = html.split('<motion ').join('<div ').split('</motion>').join('</div>');

// 2) Sidebar button (before Smartler)
const navBtn =
  '<button type="button" class="dash-nav-item" data-nav="nav-roomanalysis">' +
  '<svg class="dash-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
  '<path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>' +
  '<path d="M9 13h6M9 17h4"/>' +
  '</svg><span class="dash-nav-label">Room-wise activity analysis</span></button>';

if (html.includes('data-nav="nav-smartler"')) {
  html = html.replace('data-nav="nav-smartler"', navBtn + 'data-nav="nav-smartler"');
}

// 3) CSS for section
const roomCss = `
.room-analysis-section{margin-top:18px;padding-top:8px;border-top:2px solid rgba(0,113,168,.15);}
.room-analysis-section-title{font-size:1.25rem;font-weight:900;color:#0071a8;margin:0 0 14px;scroll-margin-top:100px;}
.room-analysis-block{margin-bottom:18px;scroll-margin-top:96px;}
#secRoomAnalysis .room-analysis-block .card{scroll-margin-top:88px;}
`;

if (!html.includes('.room-analysis-section')) {
  html = html.replace('</style>', roomCss + '\n</style>');
}

// 4) SECTION_MAP entry
html = html.replace(
  "smartler: { page: 'REPORT', scroll: 'secSmartler', title: 'Smartler Usage' },",
  "roomanalysis: { page: 'REPORT', scroll: 'secRoomAnalysis', title: 'Room-wise Activity Analysis', roomAnalysis: true },\n    smartler: { page: 'REPORT', scroll: 'secSmartler', title: 'Smartler Usage' },"
);

// 5) scrollToReportSection — load room analysis
const scrollPatch = `    if (cfg.page) setReportPage(cfg.page);
    if (cfg.roomAnalysis) {
      const runRoom = () => {
        const sid = $('siteSelect')?.value || 'ALL';
        if (window.ITC_ROOM_ANALYSIS) {
          if (typeof window.ITC_ROOM_ANALYSIS.ensureReady === 'function') {
            window.ITC_ROOM_ANALYSIS.ensureReady().then(() => {
              window.ITC_ROOM_ANALYSIS.setSite(sid);
            }).catch(() => {});
          } else if (typeof window.ITC_ROOM_ANALYSIS.setSite === 'function') {
            window.ITC_ROOM_ANALYSIS.setSite(sid);
          }
        }
      };
      runRoom();
    }
    if (cfg.ird && typeof window.enterIrdView === 'function') {`;

if (html.includes('if (cfg.page) setReportPage(cfg.page);') && !html.includes('cfg.roomAnalysis')) {
  html = html.replace(
    '    if (cfg.page) setReportPage(cfg.page);\n    if (cfg.ird && typeof window.enterIrdView',
    scrollPatch + '\n    if (cfg.ird && typeof window.enterIrdView'
  );
}

// 6) Export ITC_ROOM_ANALYSIS from enhanced block
const exportHook = `
window.ITC_ROOM_ANALYSIS = {
  _ready: false,
  async ensureReady() {
    if (this._ready && E) return E;
    if (!E) {
      if (typeof dec === 'function') E = await dec();
      else throw new Error('Enhanced data decoder unavailable');
    }
    if (typeof sites === 'function') {
      sites('topRoomsSiteSelect', true);
      sites('roomActivitySiteSelect', false);
    }
    if ($('roomActivityStart') && E?.period) $('roomActivityStart').value = E.period.start;
    if ($('roomActivityEnd') && E?.period) $('roomActivityEnd').value = E.period.end;
    this._ready = true;
    return E;
  },
  setSite(siteId) {
    const sid = siteId || 'ALL';
    const tr = $('topRoomsSiteSelect');
    if (tr) {
      if ([...tr.options].some((o) => o.value === sid)) tr.value = sid;
      else if (sid === 'ALL' && [...tr.options].some((o) => o.value === 'ALL')) tr.value = 'ALL';
      if (typeof topRooms === 'function') topRooms();
    }
    const ra = $('roomActivitySiteSelect');
    if (ra) {
      if (sid !== 'ALL' && [...ra.options].some((o) => o.value === sid)) ra.value = sid;
      else if (ra.options.length > 1) ra.value = ra.options[1].value;
      if (typeof rooms === 'function') rooms();
      const inp = $('roomActivityRoomInput');
      if (inp) inp.value = '';
    }
  },
  refresh() {
    if (typeof topRooms === 'function') topRooms();
    if (typeof rooms === 'function') rooms();
  }
};
`;

if (!html.includes('window.ITC_ROOM_ANALYSIS')) {
  html = html.replace(
    'document.readyState===\'loading\'?document.addEventListener(\'DOMContentLoaded\',init):init();',
    exportHook + '\ndocument.readyState===\'loading\'?document.addEventListener(\'DOMContentLoaded\',init):init();'
  );
}

// scroll-margin
if (!html.includes('#secRoomAnalysis')) {
  console.warn('secRoomAnalysis missing');
}
html = html.replace(
  '#secWeekday, #secTimeOfDay, #secDailyTrends, #secOttDth, #secDth, #secSmartler,',
  '#secWeekday, #secTimeOfDay, #secDailyTrends, #secRoomAnalysis, #secOttDth, #secDth, #secSmartler,'
);

fs.writeFileSync(path, html);
console.log('Added Room-wise activity analysis navigation to index.html');
