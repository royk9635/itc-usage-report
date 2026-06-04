const fs = require('fs');
const p = 'e:/usage_report/ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html';
let h = fs.readFileSync(p, 'utf8');
h = h.replace('</div></details>', '</div>');
fs.writeFileSync(p, h);
const o = (h.match(/<details/g) || []).length;
const c = (h.match(/<\/details>/g) || []).length;
console.log('details open/close', o, c);
