/**
 * Move comparePage inside usageView (sibling of reportPageContent).
 */
const fs = require('fs');
const path = 'e:/usage_report/index.html';
let html = fs.readFileSync(path, 'utf8');

const compareStart = html.indexOf('<div id="comparePage">');
const chatStart = html.indexOf('<motion aria-hidden="true" hidden id="chatPage">');
const chatStart2 = html.indexOf('<div aria-hidden="true" hidden id="chatPage">');
const chatIdx = chatStart2 >= 0 ? chatStart2 : chatStart;

if (compareStart < 0 || chatIdx < 0) {
  console.error('comparePage or chatPage not found');
  process.exit(1);
}

let compareBlock = html.slice(compareStart, chatIdx);
html = html.slice(0, compareStart) + html.slice(chatIdx);

// Close reportPageContent then insert comparePage inside usageView
const anchor = '<!-- /#reportPageContent -->';
if (!html.includes(anchor)) {
  console.error('anchor missing');
  process.exit(1);
}

html = html.replace(
  anchor,
  anchor + '\n' + compareBlock.trim() + '\n'
);

// CSS: hide report in compare, show usageView + comparePage
const oldCss = `    body[data-report-page="COMPARE"] #reportPageContent { display:none !important; }
    body[data-report-page="COMPARE"] #usageExtras { display:none !important; }
    body[data-report-page="COMPARE"] #comparePage { display:block !important; visibility:visible !important; }
    body[data-report-page="COMPARE"] #usageView > :not(#comparePage):not(#sectionNavWrap) { display:none !important; }`;

const newCss = `    body[data-report-page="COMPARE"] #reportPageContent { display:none !important; }
    body[data-report-page="COMPARE"] #usageExtras { display:none !important; }
    body[data-report-page="COMPARE"] #usageView { display:block !important; }
    body[data-report-page="COMPARE"] #comparePage { display:block !important; visibility:visible !important; }
    body[data-report-page="COMPARE"] #usageView > :not(#comparePage):not(#reportPageContent):not(#sectionNavWrap) { display:none !important; }`;

if (html.includes(oldCss)) {
  html = html.replace(oldCss, newCss);
} else {
  html = html.replace(
    'body[data-report-page="COMPARE"] #usageView > :not(#comparePage):not(#sectionNavWrap)',
    'body[data-report-page="COMPARE"] #usageView > :not(#comparePage):not(#reportPageContent):not(#sectionNavWrap)'
  );
}

fs.writeFileSync(path, html);
console.log('Moved comparePage inside usageView after reportPageContent');
