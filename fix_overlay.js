const fs = require('fs');
const p = 'e:/usage_report/ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html';
let h = fs.readFileSync(p, 'utf8');
h = h.replace(
  /<div class="loadMsg">Preparing room and trend data…<\/div>\s*\n<div id="reportErrorBanner"/,
  '<div class="loadMsg">Preparing room and trend data…</div></motion></div></div>\n<div id="reportErrorBanner"'.replace(
    '</motion>',
    ''
  )
);
fs.writeFileSync(p, h);
console.log('done', h.includes('</div></motion></motion></div>\n<div id="reportErrorBanner"') || h.match(/loadMsg[\s\S]{0,80}reportErrorBanner/));
