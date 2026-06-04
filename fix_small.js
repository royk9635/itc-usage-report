const fs = require('fs');
const p = 'e:/usage_report/ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html';
let h = fs.readFileSync(p, 'utf8');

// Fix overlay
const i = h.indexOf('<motion id="reportLoadOverlay"');
const j = h.indexOf('<div id="reportErrorBanner"');
if (j > i && i > 0) {
  h =
    h.slice(0, i) +
    '<div id="reportLoadOverlay" aria-hidden="true"><div class="loadCard"><motion class="loadSpinner"></div><div class="loadTitle">Loading report data</div><div class="loadMsg">Preparing room and trend data…</div></div></div>\n'
      .replace(/motion/g, 'motion')
      .replace(/<\/?motion>/g, (m) => (m === '<motion class="loadSpinner">' ? '<div class="loadSpinner">' : m.startsWith('</') ? '</div>' : m)) +
    h.slice(j);
}
h = h.replace(
  '<div id="reportLoadOverlay" aria-hidden="true"><div class="loadCard"><motion class="loadCard">',
  '<div id="reportLoadOverlay" aria-hidden="true"><div class="loadCard">'
);
h = h.replace(/<motion class="loadCard">/g, '');
h = h.replace(
  /<div id="reportLoadOverlay" aria-hidden="true">[\s\S]*?(?=<div id="reportErrorBanner")/,
  '<div id="reportLoadOverlay" aria-hidden="true"><div class="loadCard"><div class="loadSpinner"></div><div class="loadTitle">Loading report data</div><div class="loadMsg">Preparing room and trend data…</motion></motion></div>\n'.replace(
    /<motion|<\/motion>/g,
    ''
  )
);

// Chat pagination
if (!h.includes('renderTablePaged')) {
  h = h.replace(
    `  function renderTable(rows){
    const tb = $('chatActivityTable')?.querySelector('tbody');
    if (!tb) return;
    const finalRows = tableRows(rows);
    if (!finalRows.length) {
      tb.innerHTML = \`<tr><td colspan="6"><motion class="chatEmptyState">No detail rows match the current category/search filter.</div></td></tr>\`;
      return;
    }
    tb.innerHTML = finalRows.map(r => \`<tr><td>\${esc(r.date)}</td><td><span class="catPill">\${esc(CATEGORY_LABELS[r.c] || r.c)}</span></td><td>\${esc(r.i)}</td><td>\${esc(r.s || '--')}</td><td class="right">\${fi(r.n)}</td><td class="right">\${Number(r.m || 0) ? f(r.m,1) + ' min' : '--'}</td></tr>\`).join('');
  }`.replace(/motion/g, 'motion'),
    `  let chatPage = 0;
  const CHAT_PAGE_SIZE = 50;
  function renderTablePaged(rows) {
    const tb = $('chatActivityTable')?.querySelector('tbody');
    if (!tb) return;
    const finalRows = tableRows(rows);
    const total = finalRows.length;
    const pages = Math.max(1, Math.ceil(total / CHAT_PAGE_SIZE));
    if (chatPage >= pages) chatPage = pages - 1;
    if (chatPage < 0) chatPage = 0;
    const slice = finalRows.slice(chatPage * CHAT_PAGE_SIZE, (chatPage + 1) * CHAT_PAGE_SIZE);
    if (!slice.length) {
      tb.innerHTML = '<tr><td colspan="6"><div class="chatEmptyState">No detail rows match the current category/search filter.</div></td></tr>';
    } else {
      tb.innerHTML = slice.map(r => '<tr><td>'+esc(r.date)+'</td><td><span class="catPill">'+esc(CATEGORY_LABELS[r.c] || r.c)+'</span></td><td>'+esc(r.i)+'</td><td>'+esc(r.s || '--')+'</td><td class="right">'+fi(r.n)+'</td><td class="right">'+(Number(r.m||0)?f(r.m,1)+' min':'--')+'</td></tr>').join('');
    }
    let pager = $('chatTablePager');
    if (!pager) {
      pager = document.createElement('div');
      pager.id = 'chatTablePager';
      $('chatActivityTable')?.parentElement?.appendChild(pager);
    }
    pager.innerHTML = '<button type="button" class="btn" id="chatPagePrev">Prev</button><span> Page '+(chatPage+1)+' / '+pages+' ('+total+' rows) </span><button type="button" class="btn" id="chatPageNext">Next</button>';
    const prev = $('chatPagePrev');
    const next = $('chatPageNext');
    if (prev) { prev.disabled = chatPage <= 0; prev.onclick = () => { chatPage--; renderTablePaged(rows); }; }
    if (next) { next.disabled = chatPage >= pages - 1; next.onclick = () => { chatPage++; renderTablePaged(rows); }; }
    window.ITC_TABLE?.makeSortable?.($('chatActivityTable'));
  }
  function renderTable(rows) {
    chatPage = 0;
    renderTablePaged(rows);
  }`
  );
}

// Fix chat table search to use paged render
h = h.replace(
  "renderTable(categoryRows(current.rows));",
  "renderTablePaged(categoryRows(current.rows));"
);

// Time-of-day mini bars - add script at end of platform boot
if (!h.includes('ITC_TIME_BARS')) {
  const timeBarScript = `
window.ITC_TIME_BARS = function initTimeBars() {
  document.querySelectorAll('.usageTimeTable tbody tr').forEach(tr => {
    const cells = [...tr.querySelectorAll('td.right')];
    if (cells.length < 4) return;
    const vals = cells.slice(0, 4).map(td => parseFloat(String(td.textContent).replace(/[^0-9.]/g, '')) || 0);
    const max = Math.max(...vals, 1);
    cells.forEach((td, i) => {
      td.classList.add('timeBarCell');
      let bar = td.querySelector('.bar');
      if (!bar) { bar = document.createElement('div'); bar.className = 'bar'; td.appendChild(bar); }
      bar.style.width = Math.round((vals[i] / max) * 100) + '%';
    });
  });
};
document.addEventListener('DOMContentLoaded', () => setTimeout(() => window.ITC_TIME_BARS && window.ITC_TIME_BARS(), 800));
`;
  h = h.replace('document.addEventListener(\'DOMContentLoaded\', boot);', timeBarScript + '\n  document.addEventListener(\'DOMContentLoaded\', boot);');
  // inject at end of platform - find last line of platform boot
  const platEnd = h.indexOf('else boot();\n})();');
  if (platEnd > 0 && !h.includes('ITC_TIME_BARS')) {
    h = h.slice(0, platEnd) + timeBarScript + '\n' + h.slice(platEnd);
  }
}

// Enhanced site combos after boot
if (!h.includes('ITC_ENHANCED_COMBOS')) {
  const comboBoot = `
window.ITC_ENHANCED_COMBOS = function() {
  if (!window.ITC_SITE_COMBO || !window.ITC_REPORT) return;
  const E = window.ITC_DATA?.getCached?.();
  if (!E) return;
  const sites = () => (E.sites || []).map(s => ({ id: s.id, name: s.name, brand: '' }));
  const label = (o) => o.name || o.id;
  ['dodUsageSiteSelect','dthTrendSiteSelect','mobileUsageSiteSelect','roomActivitySiteSelect'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || sel.dataset.comboDone) return;
    sel.dataset.comboDone = '1';
    const wrap = document.createElement('div');
    sel.parentElement.insertBefore(wrap, sel);
    window.ITC_SITE_COMBO.mountSiteCombo(wrap, sel, { getSites: sites, labelFn: label, brands: false });
  });
};
window.addEventListener('itc-enhanced-ready', () => window.ITC_ENHANCED_COMBOS && window.ITC_ENHANCED_COMBOS());
`;
  h = h.replace('else boot();\n})();', comboBoot + '\nelse boot();\n})();');
}

// KPI skeleton on first render - wrap in platform boot waitReport
h = h.replace(
  'setKpiSkeleton();\n      if (window.ITC_MAIN_COMBO)',
  'setKpiSkeleton();\n      document.querySelectorAll("#reportPageContent .kpi").forEach(k => k.classList.remove("is-loading"));\n      if (window.ITC_MAIN_COMBO)'
);

fs.writeFileSync(p, h);
console.log('fixed overlay', h.includes('class="loadMsg"'));
console.log('paged', h.includes('renderTablePaged'));
