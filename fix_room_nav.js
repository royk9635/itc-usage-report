const fs = require('fs');
const path = 'e:/usage_report/index.html';
let html = fs.readFileSync(path, 'utf8');

html = html.replace(
  `    if (cfg.ird && typeof window.enterIrdView === 'function') {
    if (cfg.ird && typeof window.enterIrdView === 'function') {`,
  `    if (cfg.ird && typeof window.enterIrdView === 'function') {`
);

if (!html.includes('id="secRoomAnalysis"')) {
  html = html.replace(
    '</div>\n</div><motion class="card enhancedBlock"><div class="row space"><div></div><!--secTopRooms placeholder--><b>Top 5 rooms by site</b>',
    '</div>\n</div>\n<section id="secRoomAnalysis" class="room-analysis-section" aria-label="Room-wise activity analysis">\n<h2 class="room-analysis-section-title">Room-wise activity analysis</h2>\n<div id="secTopRooms" class="room-analysis-block">\n<div class="card enhancedBlock"><div class="row space"><div><b>Top 5 rooms by site</b>'
  );
  html = html.replace(
    '</div>\n</div><div class="card enhancedBlock"><div class="row space"><div></div><!--secTopRooms placeholder--><b>Top 5 rooms by site</b>',
    '</div>\n</div>\n<section id="secRoomAnalysis" class="room-analysis-section" aria-label="Room-wise activity analysis">\n<h2 class="room-analysis-section-title">Room-wise activity analysis</h2>\n<div id="secTopRooms" class="room-analysis-block">\n<div class="card enhancedBlock"><div class="row space"><motion><b>Top 5 rooms by site</b>'
  );
  html = html.split('<motion><b>Top 5 rooms').join('<div><b>Top 5 rooms');
}

if (!html.includes('id="secRoomActivity"')) {
  html = html.replace(
    '</tbody></table></div></div><div class="card enhancedBlock"><div class="row space"><div><b>Room-wise activity analysis</b>',
    '</tbody></table></div></div></div>\n<div id="secRoomActivity" class="room-analysis-block">\n<div class="card enhancedBlock"><div class="row space"><div><b>Room-wise activity analysis</b>'
  );
}

if (!html.includes('</section><!--secRoomAnalysis-->')) {
  html = html.replace(
    '\n<!-- OTT -->\n<h2 id="secOttDth">4) OTT &amp; Streaming</h2>',
    '\n</motion></section><!--secRoomAnalysis-->\n<!-- OTT -->\n<h2 id="secOttDth">4) OTT &amp; Streaming</h2>'
  );
  html = html.replace('\n</motion></section><!--secRoomAnalysis-->', '\n</div></section><!--secRoomAnalysis-->');
}

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

if (!html.includes('window.ITC_ROOM_ANALYSIS =')) {
  html = html.replace(
    "document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();",
    exportHook + "\ndocument.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();"
  );
}

fs.writeFileSync(path, html);
console.log({
  secRoomAnalysis: html.includes('id="secRoomAnalysis"'),
  secTopRooms: html.includes('id="secTopRooms"'),
  secRoomActivity: html.includes('id="secRoomActivity"'),
  ITC_ROOM_ANALYSIS: html.includes('window.ITC_ROOM_ANALYSIS'),
});
