const fs = require('fs');
const h = fs.readFileSync('e:/usage_report/index.html', 'utf8');
const markers = [
  'id="secDailyTrends"',
  'Top 5 rooms by site',
  'Room-wise activity analysis',
  'id="secOttDth"',
  'id="topRoomsTable"',
  'id="roomActivityTable"',
];
for (const m of markers) {
  const i = h.indexOf(m);
  console.log(m, 'at', i);
}
