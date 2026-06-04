/**
 * Point the downloadable report at the same app entry as index.html.
 * Run: node scripts/sync-app.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'index.html');
const dest = path.join(root, 'ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html');
if (!fs.existsSync(src)) {
  console.error('index.html missing');
  process.exit(1);
}
fs.copyFileSync(src, dest);
console.log('Synced', path.basename(dest), 'from index.html');
