const fs = require('fs');
const path = require('path');
const htmlPath = process.argv[2] || path.join(__dirname, 'index.html');
const h = fs.readFileSync(htmlPath, 'utf8');
const issues = [];
if (h.includes('<motion')) issues.push('motion tags remain');
const dOpen = (h.match(/<details/g) || []).length;
const dClose = (h.match(/<\/details>/g) || []).length;
if (dOpen !== dClose) issues.push(`details: ${dOpen} open, ${dClose} close`);

const parts = h.split(/<script/i);
let idx = 0;
for (const part of parts.slice(1)) {
  idx++;
  const end = part.indexOf('</script>');
  if (end < 0) {
    issues.push('unclosed script ' + idx);
    continue;
  }
  const header = part.slice(0, part.indexOf('>'));
  const code = part.slice(part.indexOf('>') + 1, end);
  if (/type\s*=\s*["']application\/json/i.test(header)) continue;
  if (/id\s*=\s*["']reportEnhancedDataGzip/i.test(header)) continue;
  if (code.trim().startsWith('H4sI')) continue;
  if (/src\s*=/.test(header)) continue;
  try {
    new Function(code);
  } catch (e) {
    const id = (header.match(/id\s*=\s*["']([^"']+)["']/i) || [])[1] || 'script' + idx;
    issues.push(id + ': ' + e.message);
  }
}
console.log(htmlPath);
console.log(issues.join('\n') || 'OK');
process.exit(issues.length ? 1 : 0);
