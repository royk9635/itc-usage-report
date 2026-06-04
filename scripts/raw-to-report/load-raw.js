const fs = require('fs');

function loadAll(paths) {
  const rows = [];
  for (const p of paths) {
    console.error('Loading', p, '...');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    rows.push(...(data.rawReport || []));
  }
  return rows;
}

module.exports = { loadAll };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: node load-raw.js file1.json [file2.json ...]');
    process.exit(1);
  }
  const rows = loadAll(files);
  const types = new Set(rows.map(r => r.reportName));
  console.log('rows', rows.length, 'types', [...types].sort());
  const occ = rows.find(r => r.reportName === 'ROOM_OCCUPANCY_SUMMARY' && r.hotelName.includes('Gardenia'));
  console.log('sample occ keys', occ && Object.keys(occ.logData || {}));
  console.log('sample occ dataMap', JSON.stringify(occ?.logData?.dataMap, null, 2).slice(0, 1200));
}
