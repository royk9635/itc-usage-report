const fs = require('fs');
const p = 'e:/usage_report/index.html';
let h = fs.readFileSync(p, 'utf8');
const before = h.includes('const siteRecHtml = siteRecommendations.replace');
h = h.replace(
  /const siteRecHtml = siteRecommendations\.replace\([^;]+;/,
  'const siteRecHtml = siteRecommendations;'
);
fs.writeFileSync(p, h);
console.log('before', before, 'after', h.includes('const siteRecHtml = siteRecommendations;'));
