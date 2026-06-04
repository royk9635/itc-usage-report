/**
 * Switch index.html from embedded JSON to live Smartler API (via /api/report/load).
 * Run: node scripts/enable-api-mode.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');

function patchScript(html, id, content, type = 'application/json') {
  const re = new RegExp(`(<script id="${id}"[^>]*>)([\\s\\S]*?)(</script>)`);
  if (!re.test(html)) throw new Error(`Script #${id} not found`);
  return html.replace(re, `$1${content}$3`);
}

let html = fs.readFileSync(HTML, 'utf8');

if (!html.includes('itc-api-loader.js')) {
  html = html.replace(
    '</head>',
    `<link rel="stylesheet" href="/public/itc-api-styles.css"/>
<script src="/public/itc-api-loader.js" defer></script>
</head>`
  );
}

if (!html.includes('id="reportLoadOverlay"')) {
  html = html.replace(
    '<body data-report-page="REPORT"',
    `<div id="reportLoadOverlay" aria-hidden="true"><div class="loadCard"><div class="loadSpinner"></div><div class="loadTitle">Loading report data</div><div class="loadMsg">Fetching ITC data from API…</div></div></div>
<div id="reportDataBanner" role="status" aria-live="polite"></div>
<div id="ariaLiveRegion" aria-live="polite" aria-atomic="true" class="sr-only"></div>
<body data-report-page="REPORT"`
  );
}

if (!html.includes('id="dodFilterEnable"')) {
  html = html.replace(
    '<div class="selectWrap" id="monthSelectWrap">',
    `<div class="selectWrap" id="dodFilterWrap"><label class="selectLabel dodToggleLabel" for="dodFilterEnable"><input type="checkbox" id="dodFilterEnable"/> Day-on-Day</label></div>
<div class="selectWrap" id="dodDateWrap" style="display:none"><label class="selectLabel" for="dodFilterStartDate">Start date</label><input class="select" type="date" id="dodFilterStartDate"/><label class="selectLabel" for="dodFilterEndDate">End date</label><input class="select" type="date" id="dodFilterEndDate"/></div>
<div class="selectWrap" id="monthSelectWrap">`
  );
}

html = patchScript(html, 'reportData', '{}');
html = patchScript(html, 'reportRawDaily', '{}');
html = patchScript(html, 'reportEnhancedDataGzip', '', 'text/plain');

const dataInitOld = `  const REPORTS = JSON.parse(document.getElementById('reportData').textContent);

  const RAW_DAILY = JSON.parse(document.getElementById('reportRawDaily').textContent);`;
const dataInitNew = `  let REPORTS = {};
  let RAW_DAILY = {};
  function applyReportBundle(b) {
    if (!b) return;
    REPORTS = b.reports || {};
    RAW_DAILY = b.rawDaily || {};
    MONTH_KEYS = Object.keys(REPORTS).sort();
    DEFAULT_MONTH_KEY = b.monthKey || MONTH_KEYS[MONTH_KEYS.length - 1] || MONTH_KEYS[0] || '';
    REPORT = REPORTS[DEFAULT_MONTH_KEY] || Object.values(REPORTS)[0] || null;
    if (window.ITC_DATA && b.enhanced) window.ITC_DATA.setEnhanced(b.enhanced);
  }
  window.ITC_ON_REPORT_LOADED = applyReportBundle;`;

if (html.includes(dataInitOld)) {
  html = html.replace(dataInitOld, dataInitNew);
} else if (!html.includes('applyReportBundle')) {
  console.warn('WARN: report data init block not found — may already be patched');
}

html = html.replace(
  '  const MONTH_KEYS = Object.keys(REPORTS).sort();\n  const DEFAULT_MONTH_KEY = MONTH_KEYS[MONTH_KEYS.length - 1] || MONTH_KEYS[0];',
  '  let MONTH_KEYS = [];\n  let DEFAULT_MONTH_KEY = "";'
);

const initOld = `  function init() {
    currentSelId = 'ALL';
    reportPage = 'REPORT';
    fillMonthSelect(DEFAULT_MONTH_KEY);`;
const initNew = `  async function init() {
    if (window.ITC_DATA) {
      try {
        const b = await window.ITC_DATA.ready();
        applyReportBundle(b);
        fillMonthSelect(window.ITC_DATA.getActiveMonthKey() || DEFAULT_MONTH_KEY);
      } catch (e) {
        console.error(e);
        return;
      }
    } else {
      REPORTS = JSON.parse(document.getElementById('reportData')?.textContent || '{}');
      RAW_DAILY = JSON.parse(document.getElementById('reportRawDaily')?.textContent || '{}');
      MONTH_KEYS = Object.keys(REPORTS).sort();
      DEFAULT_MONTH_KEY = MONTH_KEYS[MONTH_KEYS.length - 1] || MONTH_KEYS[0] || '';
      REPORT = REPORTS[DEFAULT_MONTH_KEY];
      fillMonthSelect(DEFAULT_MONTH_KEY);
    }
    currentSelId = 'ALL';
    reportPage = 'REPORT';`;

if (html.includes(initOld)) {
  html = html.replace(initOld, initNew);
} else {
  console.warn('WARN: init() block not patched');
}

const monthHandlerOld = `    $('monthSelect')?.addEventListener('change', (e) => {
      REPORT = REPORTS[e.target.value] || REPORTS[DEFAULT_MONTH_KEY];
      fillSiteSelect(currentSelId);
      currentSelId = $('siteSelect')?.value || 'ALL';
      ensureCompareSelection();
      renderCompareChooser();
      if (reportPage === 'COMPARE') renderComparePage();
      else renderSelection(currentSelId);
    });`;
const monthHandlerNew = `    $('monthSelect')?.addEventListener('change', async (e) => {
      if (window.ITC_DATA && !window.ITC_DATA.isDodEnabled()) {
        try {
          const b = await window.ITC_DATA.loadCurrent();
          applyReportBundle(b);
        } catch (err) { return; }
      } else if (!window.ITC_DATA) {
        REPORT = REPORTS[e.target.value] || REPORTS[DEFAULT_MONTH_KEY];
      } else {
        REPORT = REPORTS[DEFAULT_MONTH_KEY] || REPORT;
      }
      fillSiteSelect(currentSelId);
      currentSelId = $('siteSelect')?.value || 'ALL';
      ensureCompareSelection();
      renderCompareChooser();
      if (reportPage === 'COMPARE') renderComparePage();
      else renderSelection(currentSelId);
      if (window.ITC_ENHANCED_RESET) window.ITC_ENHANCED_RESET();
    });`;

if (html.includes(monthHandlerOld)) {
  html = html.replace(monthHandlerOld, monthHandlerNew);
}

const fillMonthOld = `  function fillMonthSelect(monthKey) {
    const monthEl = $("monthSelect");
    if (!monthEl) return;
    monthEl.innerHTML = "";
    MONTH_KEYS.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = REPORTS[k]?.period?.label || k;
      monthEl.appendChild(opt);
    });
    monthEl.value = monthKey;
  }`;
const fillMonthNew = `  function fillMonthSelect(monthKey) {
    const monthEl = $("monthSelect");
    if (!monthEl) return;
    monthEl.innerHTML = "";
    if (window.ITC_DATA) {
      window.ITC_DATA.listMonthOptions().forEach(o => {
        const opt = document.createElement("option");
        opt.value = o.key;
        opt.textContent = o.label;
        monthEl.appendChild(opt);
      });
      monthEl.value = monthKey || window.ITC_DATA.getActiveMonthKey() || monthEl.options[0]?.value || "";
      return;
    }
    monthEl.innerHTML = "";
    MONTH_KEYS.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = REPORTS[k]?.period?.label || k;
      monthEl.appendChild(opt);
    });
    monthEl.value = monthKey;
  }`;

if (html.includes(fillMonthOld)) {
  html = html.replace(fillMonthOld, fillMonthNew);
}

const decOld = `async function dec(){
  let b64=$('reportEnhancedDataGzip').textContent.trim(), bin=atob(b64), bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  if(!('DecompressionStream' in window)) throw Error('Open this report in recent Chrome, Edge, or Safari for compressed drill-down data.');
  let stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}`;
const decNew = `async function dec(){
  if (window.ITC_DATA) {
    const e = window.ITC_DATA.getEnhanced();
    if (e) return e;
    const b = await window.ITC_DATA.loadCurrent();
    return b.enhanced;
  }
  const el = $('reportEnhancedDataGzip');
  if (!el || !el.textContent.trim()) throw Error('Enhanced data unavailable. Start server with API mode.');
  let b64=el.textContent.trim(), bin=atob(b64), bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  if(!('DecompressionStream' in window)) throw Error('Open this report in recent Chrome, Edge, or Safari for compressed drill-down data.');
  let stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}`;

if (html.includes(decOld)) {
  html = html.replace(decOld, decNew);
}

const decodeOld = `  async function decodeEnhancedData(){
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
  }`;
const decodeNew = `  async function decodeEnhancedData(){
    if (E) return E;
    if (window.ITC_DATA) {
      E = window.ITC_DATA.getEnhanced();
      if (E) return E;
      const b = await window.ITC_DATA.loadCurrent();
      E = b.enhanced;
      return E;
    }
    const el = $('reportEnhancedDataGzip');
    if (!el || !el.textContent.trim()) throw new Error('Enhanced data unavailable.');
    const b64 = el.textContent.trim();
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    if (!('DecompressionStream' in window)) throw new Error('Open this report in recent Chrome, Edge, or Safari for compressed room chatbot data.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    E = JSON.parse(await new Response(stream).text());
    return E;
  }`;

if (html.includes(decodeOld)) {
  html = html.replace(decodeOld, decodeNew);
}

if (!html.includes('ITC_ENHANCED_RESET')) {
  html = html.replace(
    'let E=null;',
    `let E=null;
window.ITC_ENHANCED_RESET=function(){
  E=null;
  window.ITC_ENHANCED_BOOT_DONE=0;
  if(typeof bootEnhancedOnce==='function') bootEnhancedOnce();
};
document.addEventListener('itc-report-loaded',()=>window.ITC_ENHANCED_RESET());`
  );
}

fs.writeFileSync(HTML, html);
console.log('API mode enabled in index.html');
console.log('  Embedded reportData / rawDaily / gzip cleared');
console.log('  Run: node server.js');
