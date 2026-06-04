const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const start = html.indexOf('const ROOM_ACTIVITY_ICONS = {');
const end = html.indexOf('};', start) + 2;
if (start < 0 || end <= start) {
  console.error('ROOM_ACTIVITY_ICONS block not found');
  process.exit(1);
}

const replacement = `const ROOM_ACTIVITY_ICONS = {
  'Smartler': 'public/assets/room-activity/smartler.png',
  'Casting': 'public/assets/room-activity/casting.png',
  'Mobile Usage': 'public/assets/room-activity/mobile-usage.png',
  'DTH Channels': 'public/assets/room-activity/dth-channels.png',
  'OTT': 'public/assets/room-activity/ott.png'
};`;

html = html.slice(0, start) + replacement + html.slice(end);

const oldItems = `  const items = [
    ['Casting',s.cc,s.cm,'mins'],
    ['OTT',s.oc,s.om,'mins'],
    ['DTH Channels',s.dc,s.dm,'mins'],
    ['Mobile Usage',s.mc,0,'activity count'],
    ['Smartler',s.sc,0,'activity count']
  ];`;

const newItems = `  const items = [
    ['Smartler',s.sc,0,'activity count'],
    ['Casting',s.cc,s.cm,'mins'],
    ['Mobile Usage',s.mc,0,'activity count'],
    ['DTH Channels',s.dc,s.dm,'mins'],
    ['OTT',s.oc,s.om,'mins']
  ];`;

if (!html.includes(oldItems)) {
  console.error('cards() items block not found');
  process.exit(1);
}
html = html.replace(oldItems, newItems);

if (!html.includes('.roomSummaryIcon{')) {
  html = html.replace(
    '.roomSummaryGrid{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:10px;margin:12px 0}',
    '.roomSummaryGrid{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:10px;margin:12px 0}.roomSummaryIcon{width:52px;height:52px;object-fit:contain;display:block;margin:0 auto 6px}'
  );
}

fs.writeFileSync(indexPath, html);
console.log('Updated ROOM_ACTIVITY_ICONS and cards order in index.html');
