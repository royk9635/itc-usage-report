const fs = require('fs');
const p = 'e:/usage_report/ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html';
let h = fs.readFileSync(p, 'utf8');
h = h.replace(
  /<script id="itcPlatformScript">\nwindow\.ITC_CHARTS = \{[\s\S]*?\};\n\n\/\*\*/,
  '<script id="itcPlatformScript">\n\n/**'
);
fs.writeFileSync(p, h);
console.log('dup charts removed', (h.match(/window\.ITC_CHARTS/g) || []).length);
