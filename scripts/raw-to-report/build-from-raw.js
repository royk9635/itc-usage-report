'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { loadAll } = require('./load-raw');
const { aggregateRawRows } = require('./aggregate');
const { buildReportData, buildRawDaily, buildEnhanced } = require('./build-output');
const { patchHtml } = require('./patch-html');

const ROOT = path.join(__dirname, '..', '..');

function monthKeyFromDates(dates) {
  if (!dates.length) return 'unknown';
  return dates[0].slice(0, 7);
}

function monthLabelFromKey(key) {
  const [y, m] = key.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m - 1]} ${y}`;
}

function findRawFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => /^raw_report_.*\.json$/i.test(f))
    .map(f => path.join(dir, f))
    .sort();
}

function main() {
  const args = process.argv.slice(2);
  const outHtml = args.includes('--html')
    ? args[args.indexOf('--html') + 1]
    : path.join(ROOT, 'index.html');
  const rawDir = args.includes('--raw-dir')
    ? args[args.indexOf('--raw-dir') + 1]
    : ROOT;
  const rawFiles = args.filter(a => a.endsWith('.json'));
  const files = rawFiles.length ? rawFiles : findRawFiles(rawDir);

  if (!files.length) {
    console.error('No raw_report_*.json files found. Place exports in project root or pass paths.');
    process.exit(1);
  }

  console.log('ITC raw → report pipeline\n');
  console.log('Input files:');
  files.forEach(f => console.log('  ', f));

  const rows = loadAll(files);
  console.log('\nAggregating', rows.length, 'raw rows...');
  let agg = aggregateRawRows(rows);
  const monthKey = monthKeyFromDates(agg.dates);
  // Drop stray dates outside the primary month (e.g. 2026-05-01 in April exports)
  const inMonth = agg.dates.filter(d => d.startsWith(monthKey + '-'));
  if (inMonth.length && inMonth.length !== agg.dates.length) {
    const keep = new Set(inMonth);
    for (const site of agg.sites.values()) {
      for (const d of [...site.days.keys()]) {
        if (!keep.has(d)) site.days.delete(d);
      }
      for (const ser of site.dthSeries.values()) {
        for (const d of [...ser.keys()]) {
          if (!keep.has(d)) ser.delete(d);
        }
      }
      for (const [, byDate] of site.roomData) {
        for (const d of [...byDate.keys()]) {
          if (!keep.has(d)) byDate.delete(d);
        }
      }
    }
    agg.dates = inMonth;
    agg.period = { start: inMonth[0], end: inMonth[inMonth.length - 1] };
  }
  const monthLabel = monthLabelFromKey(monthKey);

  console.log('Period:', agg.period.start, '→', agg.period.end);
  console.log('Month key:', monthKey);
  console.log('Sites:', agg.sites.size);

  const reportData = buildReportData(agg, monthKey, monthLabel);
  const rawDaily = buildRawDaily(agg, monthKey);
  const enhanced = buildEnhanced(agg, monthKey);
  const enhancedGzipB64 = zlib.gzipSync(Buffer.from(JSON.stringify(enhanced))).toString('base64');

  console.log('\nPatching', outHtml);
  patchHtml(outHtml, { reportData, rawDaily, enhancedGzipB64 });

  const all = reportData[monthKey].selections.ALL.totals;
  console.log('\nCombined totals:');
  console.log('  guest_days:', all.guest_days);
  console.log('  OTT min/guest:', all.dur_min_per_guest.OTT);
  console.log('  DTH min/guest:', all.dur_min_per_guest.DTH);
  console.log('  Casting min/guest:', all.dur_min_per_guest.Casting);
  console.log('\nDone. Run: node validate.js && node scripts/finish-all.js');
}

if (require.main === module) main();
