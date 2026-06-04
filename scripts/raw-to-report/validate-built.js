'use strict';

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function getScript(id) {
  const m = html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`));
  return m ? JSON.parse(m[1].trim()) : null;
}

const REPORTS = getScript('reportData');
const E = JSON.parse(zlib.gunzipSync(Buffer.from(html.match(/<script id="reportEnhancedDataGzip"[^>]*>([\s\S]*?)<\/script>/)[1].trim(), 'base64')));

const REF = {
  guest_days: 67255,
  ott_hr: 175472.62,
  dth_hr: 349689.29,
  casting_hr: 53082.52,
};

const ALL = REPORTS['2026-04'].selections.ALL.totals;
const built = {
  guest_days: ALL.guest_days,
  ott_hr: ALL.raw_totals.ott_hr,
  dth_hr: ALL.raw_totals.dth_hr,
  casting_hr: ALL.raw_totals.casting_hr,
};

function pct(a, b) { return b ? Math.abs((a - b) / b * 100) : 0; }

console.log('Validation vs reference (Apr 2026 embedded):');
for (const k of Object.keys(REF)) {
  const p = pct(built[k], REF[k]);
  const ok = p < 5 ? 'OK' : 'DRIFT';
  console.log(`  ${ok} ${k}: built=${built[k]} ref=${REF[k]} (${p.toFixed(1)}%)`);
}
console.log('Enhanced sites:', E.sites.length, 'room sites:', Object.keys(E.roomActivity).length);
