const fs = require('fs');
const htmlPath = 'e:/usage_report/ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html';
const platPath = 'e:/usage_report/itc_platform.js';

let html = fs.readFileSync(htmlPath, 'utf8');
const plat = fs.readFileSync(platPath, 'utf8');

// 1) Replace entire itcPlatformScript block with clean platform + charts prefix
const chartsPrefix = `window.ITC_CHARTS = {
  markEmpty(canvasId, isEmpty) {
    const wrap = document.getElementById(canvasId)?.closest('.chartWrap');
    if (!wrap) return;
    let msg = wrap.querySelector('.chartEmptyMsg');
    if (!msg) {
      msg = document.createElement('motion');
      msg.className = 'chartEmptyMsg';
      msg.textContent = 'No data for this selection.';
      wrap.appendChild(msg);
    }
    wrap.classList.toggle('has-empty', !!isEmpty);
  },
};
`.replace(/motion/g, 'div');

html = html.replace(
  /<script id="itcPlatformScript">[\s\S]*?<\/script>\s*<script>\s*\(function\(\)\{\s*const IRD_DATA/,
  '<script id="itcPlatformScript">\n' + chartsPrefix + '\n' + plat + '\n</script>\n<script>\n(function(){\n  const IRD_DATA'
);

// 2) Fix broken accordion - remove reportSection details wrappers
html = html.replace(
  /<details class="reportSection" data-section-key="timeOfDay" open><summary><h2 id="secTimeOfDay" style="display:inline;margin:0">2\) Usage by time of day<\/h2><\/summary><div class="sectionBody">/,
  '<h2 id="secTimeOfDay">2) Usage by time of day</h2>'
);

html = html.replace(
  /<details class="reportSection" data-section-key="daily" open><summary><h2 id="secDailyTrends" style="display:inline;margin:0">3\) Day-on-day usage trends and room-wise drill-down<\/h2>/,
  '<h2 id="secDailyTrends">3) Day-on-day usage trends and room-wise drill-down</h2>'
);

html = html.replace(
  /<details class="reportSection" data-section-key="ott" open><summary><h2 id="secOttDth" style="display:inline;margin:0">3\) OTT &amp; Streaming<\/h2>\s*/,
  '<h2 id="secOttDth">3) OTT &amp; Streaming</h2>\n'
);

// Remove orphan closing tags from accordion (not inner smartler details)
html = html.replace(/\n<\/motion>\s*<\/details>\s*\n<\/motion>\s*<\/details>/g, '\n');
html = html.replace(/\n<\/div><\/details>\s*\n<!-- OTT -->/g, '\n<!-- OTT -->');
html = html.replace(/\n<\/div><\/details>\s*\n<h2 id="secOttDth">/g, '\n<h2 id="secOttDth">');
html = html.replace(/<\/div><\/details>\s*(?=<h2 id="secOttDth">)/g, '');

// Remove duplicate ITC_CHARTS at start of platform if doubled
html = html.replace(
  /(<script id="itcPlatformScript">\s*)window\.ITC_CHARTS[\s\S]*?};\s*window\.ITC_CHARTS/g,
  '$1window.ITC_CHARTS'
);

// 3) Remove duplicate ITC_TIME_BARS / broken else boot if still present inside platform script
html = html.replace(
  /if \(document\.readyState === 'loading'\)\s*window\.ITC_TIME_BARS[\s\S]*?else boot\(\);\s*\}\)\(\);/,
  '' 
);

// 4) Move ITC_ROOM_DRILL inside last script before closing - ensure not outside IIFE wrongly
// ITC_ROOM_DRILL at end is fine

// 5) Fix setFilters if duplicate ITC_ROOM
const setFiltersCount = (html.match(/window\.ITC_ROOM\.set/g) || []).length;

// 6) Ensure compare ranking hook exists
if (!html.includes('ITC_COMPARE_UI.renderRanking')) {
  html = html.replace(
    'const selections = compareSiteSelections();',
    'const selections = compareSiteSelections();\n    if (window.ITC_COMPARE_UI) window.ITC_COMPARE_UI.renderRanking(selections);'
  );
}

fs.writeFileSync(htmlPath, html);

// validate
const issues = [];
const parts = html.split(/<script/i);
let idx = 0;
for (const part of parts.slice(1)) {
  idx++;
  const end = part.indexOf('</script>');
  if (end < 0) continue;
  const header = part.slice(0, part.indexOf('>'));
  const code = part.slice(part.indexOf('>') + 1, end);
  if (/application\/json|reportEnhancedDataGzip|src\s*=/i.test(header)) continue;
  if (code.trim().startsWith('H4sI')) continue;
  try {
    new Function(code);
  } catch (e) {
    const id = (header.match(/id="([^"]+)"/) || [])[1] || 's' + idx;
    issues.push(id + ': ' + e.message);
  }
}
const dO = (html.match(/<details/g) || []).length;
const dC = (html.match(/<\/details>/g) || []).length;
console.log('details', dO, dC);
console.log(issues.length ? issues.join('\n') : 'All scripts OK');
