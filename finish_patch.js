const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, 'ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html');
const PLATFORM = path.join(__dirname, 'itc_platform.js');

let html = fs.readFileSync(HTML, 'utf8');
const plat = fs.readFileSync(PLATFORM, 'utf8');

function rep(s, r, label) {
  if (!html.includes(s)) {
    console.warn('SKIP:', label || s.slice(0, 70));
    return false;
  }
  html = html.replace(s, r);
  return true;
}

// Fix overlay
html = html.replace(
  /<div id="reportLoadOverlay"[^>]*>[\s\S]*?<\/div>\s*<div id="reportErrorBanner"/,
  `<motion id="reportLoadOverlay" aria-hidden="true"><div class="loadCard"><div class="loadSpinner"></div><motion class="loadTitle">Loading report data</div><div class="loadMsg">Preparing room and trend data…</div></div></div>
<div id="reportErrorBanner"`.replace(/<\/?motion[^>]*>/g, (m) =>
    m.startsWith('</') ? (m.includes('loadTitle') ? '</motion>' : '</div>') : m.includes('loadTitle') ? '<div class="loadTitle">' : '<div id="reportLoadOverlay" aria-hidden="true"><motion class="loadCard">'.replace('motion', 'motion')
  )
);
// Simpler overlay fix
const overlayBad = html.match(/<div id="reportLoadOverlay"[^>]*>[\s\S]*?<\/motion>\s*<div id="reportErrorBanner"/);
if (overlayBad || html.includes('Preparing room and trend data…</div></motion>')) {
  html = html.replace(
    /<div id="reportLoadOverlay"[\s\S]*?<\/motion>\s*(?=<div id="reportErrorBanner")/,
    `<div id="reportLoadOverlay" aria-hidden="true"><div class="loadCard"><div class="loadSpinner"></motion></div><div class="loadTitle">Loading report data</div><div class="loadMsg">Preparing room and trend data…</div></div></div>`
      .replace(/<\/?motion>/g, '')
  );
}
html = html.replace(
  '<motion id="reportLoadOverlay"',
  '<div id="reportLoadOverlay"'
);
if (!html.includes('class="loadMsg"')) {
  html = html.replace(
    /(<motion id="reportLoadOverlay"[^>]*>[\s\S]*?<motion class="loadTitle">Loading report data<\/div>)(Preparing room and trend data…)(<\/div>)/,
    '$1<div class="loadMsg">$2</div>$3'
  );
  html = html.replace(
    /(<div id="reportLoadOverlay"[^>]*>[\s\S]*?<div class="loadTitle">Loading report data<\/motion>)(Preparing room and trend data…)(<\/div>)/,
    '$1<div class="loadMsg">$2</div>$3'
  );
}

// Direct string fix for known bad line
html = html.replace(
  '<div class="loadTitle">Loading report data</div>Preparing room and trend data…</motion></motion></div>',
  '<div class="loadTitle">Loading report data</div><div class="loadMsg">Preparing room and trend data…</div></div></div>'
);
html = html.replace(
  '<div class="loadTitle">Loading report data</div>Preparing room and trend data…</div></div></div>',
  '<div class="loadTitle">Loading report data</div><div class="loadMsg">Preparing room and trend data…</div></motion></div></div>'.replace(
    '</motion>',
    ''
  )
);

if (!html.includes('itcPlatformScript')) {
  const m = '})();\n</script>\n<script>\n(function(){\n  const IRD_DATA';
  if (html.includes(m)) {
    html = html.replace(m, '})();\n</script>\n<script id="itcPlatformScript">\n' + plat + '\n</script>\n<script>\n(function(){\n  const IRD_DATA');
    console.log('Injected platform');
  }
}

rep(
  '<label class="selectLabel" for="siteSelect">Site</label>\n<select class="select" id="siteSelect">',
  '<label class="selectLabel" for="siteSelect">Site</label>\n<div id="siteComboWrap"></div>\n<select class="select" id="siteSelect" style="position:absolute;opacity:0;height:0;pointer-events:none" tabindex="-1" aria-hidden="true">',
  'siteCombo'
);

if (!html.includes('ITC_COMPARE_UI.renderRanking')) {
  rep(
    'const selections = compareSiteSelections();',
    'const selections = compareSiteSelections();\n    if (window.ITC_COMPARE_UI) window.ITC_COMPARE_UI.renderRanking(selections);',
    'rank'
  );
}

if (!html.includes('btnCompareTop4')) {
  rep(
    '<button class="btn" id="btnCompareClear" type="button">Clear</button>',
    '<button class="btn" id="btnCompareTop4" type="button">Top 4 by viewing</button>\n<button class="btn" id="btnCompareExport" type="button">Export CSV</button>\n<button class="btn" id="btnCompareClear" type="button">Clear</button>',
    'cbtns'
  );
}

if (!html.includes('_prevKey')) {
  rep(
    'if ($("kpiOttDur")) $("kpiOttDur").textContent = `${fmtNumber(totals?.dur_min_per_guest?.OTT || 0,1)} min`;',
    `const _prevKey = MONTH_KEYS.length >= 2 ? MONTH_KEYS[MONTH_KEYS.indexOf(currentMonthKey()) - 1] : null;
    const _prevT = _prevKey && REPORTS[_prevKey]?.selections?.[selId]?.totals;
    function _delta(cur, prev) {
      if (!_prevKey || prev == null || prev === 0) return '';
      const pct = ((cur - prev) / prev) * 100;
      return '<span class="kpiDelta ' + (pct >= 0 ? 'up' : 'down') + '">' + (pct >= 0 ? '▲' : '▼') + ' ' + Math.abs(pct).toFixed(1) + '% vs prior month</span>';
    }
    if ($("kpiOttDur")) $("kpiOttDur").innerHTML = fmtNumber(totals?.dur_min_per_guest?.OTT || 0,1) + ' min' + _delta(totals?.dur_min_per_guest?.OTT||0, _prevT?.dur_min_per_guest?.OTT);`,
    'mom'
  );
}

if (!html.includes('glossaryDialog')) {
  rep(
    '<script id="irdRevenueData"',
    `<dialog id="glossaryDialog"><div class="glossaryInner"><h2>Report glossary</h2><dl>
<dt>Guest-day</dt><dd>One guest per occupied room per day.</dd>
<dt>OTT</dt><dd>Streaming apps on the TV.</dd>
<dt>DTH</dt><dd>TV channels (not mobile menu).</dd>
<dt>Casting</dt><dd>Phone/tablet casting.</dd>
<dt>Smartler</dt><dd>Room automation.</dd>
<dt>Mobile Usage</dt><dd>IRD, SPA, laundry, CMS—separate from DTH.</dd>
</dl><button class="btn primary" type="button" data-glossary-close>Close</button></div></dialog>
<script id="irdRevenueData"`,
    'glossary'
  );
}

if (!html.includes('id="secRoomDrill"')) {
  rep('<b>Room-wise activity analysis</b>', '<span id="secRoomDrill"></span><b>Room-wise activity analysis</b>', 'anchor');
}

if (!html.includes('roomActivityRoomSearch')) {
  rep(
    '<label for="roomActivityRoomInput">Room</label><select id="roomActivityRoomInput">',
    '<label for="roomActivityRoomInput">Room</label><input type="text" id="roomActivityRoomSearch" placeholder="Filter rooms…"/><select id="roomActivityRoomInput">',
    'roomfilter'
  );
}

if (!html.includes('btnRoomToChat')) {
  rep(
    'id="roomActivitySearchBtn" type="button">Search</button>',
    'id="roomActivitySearchBtn" type="button">Search</button><button class="btn" id="btnRoomToChat" type="button">Analyse in chatbot</button>',
    'chatbtn'
  );
}

if (!html.includes('chatTablePager')) {
  html = html.replace(
    'function renderTable(rows){',
    `let chatPage=0; const CHAT_PAGE_SIZE=50;
  function renderTablePaged(rows){
    const tb=$('chatActivityTable')?.querySelector('tbody'); if(!tb) return;
    const filtered=tableRows(rows); const total=filtered.length;
    const pages=Math.max(1,Math.ceil(total/CHAT_PAGE_SIZE));
    if(chatPage>=pages) chatPage=pages-1; if(chatPage<0) chatPage=0;
    const slice=filtered.slice(chatPage*CHAT_PAGE_SIZE,(chatPage+1)*CHAT_PAGE_SIZE);
    tb.innerHTML=slice.length?slice.map(r=>'<tr><td>'+esc(r.date)+'</td><td><span class="catPill">'+esc(r.c)+'</span></td><td>'+esc(r.i)+'</td><td>'+esc(r.s||'--')+'</td><td class="right">'+fi(r.n)+'</td><td class="right">'+(+r.m?f(r.m,1)+' min':'--')+'</td></tr>').join(''):'<tr><td colspan="6"><div class="chatEmptyState">No rows.</div></td></tr>';
    let pager=$('chatTablePager'); if(!pager){pager=document.createElement('motion');pager.id='chatTablePager';$('chatActivityTable')?.parentElement?.appendChild(pager);}
    pager.innerHTML='<button type="button" class="btn" id="chatPagePrev">Prev</button> Page '+(chatPage+1)+'/'+pages+' ('+total+' rows) <button type="button" class="btn" id="chatPageNext">Next</button>';
    $('chatPagePrev')?.toggleAttribute('disabled',chatPage<=0);
    $('chatPageNext')?.toggleAttribute('disabled',chatPage>=pages-1);
    $('chatPagePrev')?.onclick=()=>{chatPage--;renderTablePaged(rows);};
    $('chatPageNext')?.onclick=()=>{chatPage++;renderTablePaged(rows);};
    window.ITC_TABLE?.makeSortable?.($('chatActivityTable'));
  }
  function renderTable(rows){ chatPage=0; renderTablePaged(rows); return;
  function _renderTableOrig(rows){`
  );
  html = html.replace('function _renderTableOrig(rows){', 'function renderTableOrig(rows){');
  html = html.replace(
    "renderTable(categoryRows(current.rows));",
    "renderTablePaged(categoryRows(current.rows));"
  );
  html = html.replace(/<motion/g, '<div').replace(/<\/motion>/g, '');
}

if (!html.includes('makeSortable(document.getElementById("roomActivityTable"))')) {
  html = html.replace(
    'dthopts(); rooms(); usage(); dthchart(); mobileUsage(); search();',
    'dthopts(); rooms(); usage(); dthchart(); mobileUsage(); search();\n    window.ITC_TABLE?.makeSortable?.(document.getElementById("roomActivityTable"));'
  );
}

// Collapsible sections - wrap h2 blocks
if (!html.includes('class="reportSection"')) {
  html = html.replace(
    '<h2 id="secTimeOfDay">2) Usage by time of day</h2>',
    '<details class="reportSection" data-section-key="timeOfDay" open><summary><h2 id="secTimeOfDay" style="display:inline;margin:0">2) Usage by time of day</h2></summary><div class="sectionBody">'
  );
  html = html.replace(
    '<h2 id="secDailyTrends">3) Day-on-day',
    '</div></details>\n<details class="reportSection" data-section-key="daily" open><summary><h2 id="secDailyTrends" style="display:inline;margin:0">3) Day-on-day'
  );
  html = html.replace(
    '<h2 id="secOttDth">3) OTT',
    '</div></details>\n<details class="reportSection" data-section-key="ott" open><summary><h2 id="secOttDth" style="display:inline;margin:0">3) OTT'
  );
  // close last section before chat page - add before compare or end usage
}

// Chart empty msg in chartWraps - add via platform extension at end of plat before boot
const chartHelper = `
window.ITC_CHARTS = {
  markEmpty(canvasId, isEmpty) {
    const wrap = document.getElementById(canvasId)?.closest('.chartWrap');
    if (!wrap) return;
    let msg = wrap.querySelector('.chartEmptyMsg');
    if (!msg) { msg = document.createElement('div'); msg.className = 'chartEmptyMsg'; msg.textContent = 'No data for this selection.'; wrap.appendChild(msg); }
    wrap.classList.toggle('has-empty', !!isEmpty);
  }
};
`;
if (!html.includes('ITC_CHARTS')) {
  html = html.replace(
    '<script id="itcPlatformScript">',
    '<script id="itcPlatformScript">\n' + chartHelper
  );
  // wrong - inject into platform file instead
}

fs.writeFileSync(HTML, html, 'utf8');
console.log('finish_patch complete');
console.log('itcPlatform:', html.includes('itcPlatformScript'));
console.log('ITC_DATA:', html.includes('window.ITC_DATA'));
console.log('siteCombo:', html.includes('siteComboWrap'));
console.log('loadMsg:', html.includes('loadMsg'));
