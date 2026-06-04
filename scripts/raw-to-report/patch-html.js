'use strict';

const fs = require('fs');
const path = require('path');

function patchScript(html, id, content, type = 'application/json') {
  const re = new RegExp(`(<script id="${id}"[^>]*>)([\\s\\S]*?)(</script>)`);
  if (!re.test(html)) throw new Error(`Script #${id} not found in HTML`);
  return html.replace(re, `$1${content}$3`);
}

function patchHtml(htmlPath, { reportData, rawDaily, enhancedGzipB64 }) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = patchScript(html, 'reportData', JSON.stringify(reportData));
  html = patchScript(html, 'reportRawDaily', JSON.stringify(rawDaily));
  html = patchScript(html, 'reportEnhancedDataGzip', enhancedGzipB64, 'text/plain');
  fs.writeFileSync(htmlPath, html);
  return html;
}

module.exports = { patchHtml, patchScript };
