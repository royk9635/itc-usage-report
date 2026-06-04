/**
 * Finalize project: validate, sync export HTML, print checklist.
 * Run: node scripts/finish-all.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const index = path.join(root, 'index.html');
const exportHtml = path.join(root, 'ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html');

console.log('ITC Usage Report — finish\n');

if (!fs.existsSync(index)) {
  console.error('index.html missing');
  process.exit(1);
}

try {
  const out = execSync(`node "${path.join(root, 'validate.js')}"`, { encoding: 'utf8' });
  console.log(out.trim());
} catch (e) {
  console.error('Validation failed:\n', e.stdout || e.message);
  process.exit(1);
}

fs.copyFileSync(index, exportHtml);
console.log('Synced export:', path.basename(exportHtml));

const h = fs.readFileSync(index, 'utf8');
const checks = [
  ['Dashboard sidebar', 'id="dashSidebar"'],
  ['Compare view CSS', 'data-report-page="COMPARE"] #usageView { display:none !important;'],
  ['Compare page visible CSS', 'data-report-page="COMPARE"] #comparePage { display:block !important;'],
  ['Chat view CSS', 'data-report-page="CHAT"] #usageView { display:block !important;'],
  ['ITC_REPORT_API', 'window.ITC_REPORT_API'],
  ['Compare page', 'id="comparePage"'],
  ['Chat page', 'id="chatPage"'],
  ['Web app endpoint', 'window.ITC_AI_ENDPOINT'],
  ['Compare management report', 'buildCompareManagementReport'],
  ['Room-wise analysis section', 'id="secRoomAnalysis"'],
  ['Room analysis nav', 'data-nav="nav-roomanalysis"'],
  ['Room analysis API', 'window.ITC_ROOM_ANALYSIS'],
  ['Compare daily chart', 'id="compareDailyChart"'],
  ['Compare OTT chart', 'id="compareOttAppsChart"'],
  ['Compare casting chart', 'id="compareCastingAppsChart"'],
  ['Compare DTH chart', 'id="compareDthChart"'],
  ['Pastel chart palette', 'ITC_CHART_PASTEL'],
  ['AI Report Chatbot title', 'AI Report Chatbot'],
  ['Report-wide chat scope', 'detectQuestionScope'],
  ['Report knowledge context', 'buildReportKnowledgeContext'],
  ['Groq model resolver', 'resolveChatModel'],
  ['Chat activity table helper', 'clearRoomActivityTable'],
  ['Server health model field', '/health'],
  ['API data loader', 'itc-api-loader.js'],
  ['Report API proxy', '/api/report/load'],
  ['Day-on-day filter', 'dodFilterEnable'],
  ['Report data state panel', 'id="reportDataState"'],
];
let ok = true;
for (const [label, needle] of checks) {
  const pass = h.includes(needle);
  console.log(pass ? '  OK' : '  FAIL', label);
  if (!pass) ok = false;
}

console.log('\nRun: node server.js  →  http://127.0.0.1:8000');
console.log('Or double-click start.bat\n');
process.exit(ok ? 0 : 1);
