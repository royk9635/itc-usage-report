/**
 * Fix blank Compare Sites view: move comparePage out of reportPageContent,
 * fix CSS and syncCompareUi.
 * Run: node fix_compare_blank.js
 */
const fs = require('fs');
const path = 'e:/usage_report/index.html';
let html = fs.readFileSync(path, 'utf8');

const compareMarker = 'id="comparePage"';
const compareStart = html.indexOf('<motion ', html.indexOf(compareMarker) - 50);
let start = html.lastIndexOf('<div ', html.indexOf(compareMarker));
if (html.indexOf('<div aria-hidden="true" hidden="" id="comparePage">') >= 0) {
  start = html.indexOf('<div aria-hidden="true" hidden="" id="comparePage">');
} else if (html.indexOf('<div id="comparePage">') >= 0 && html.indexOf('<motion id="comparePage">') < 0) {
  start = html.indexOf('<div id="comparePage">');
}

const irdStart = html.indexOf('<div aria-hidden="true" hidden="" id="irdRevenuePage">', start);
if (start < 0 || irdStart < 0) {
  console.error('Could not locate comparePage block', start, irdStart);
  process.exit(1);
}

let compareBlock = html.slice(start, irdStart);
html = html.slice(0, start) + html.slice(irdStart);

compareBlock = compareBlock.replace(
  /<div[^>]*id="comparePage"[^>]*>/,
  '<div id="comparePage">'
);

const insertBefore = '<div aria-hidden="true" hidden id="chatPage">';
const insertAnchor = '<!-- /#reportPageContent -->\n\n\n' + insertBefore;
const insertAnchor2 = '<!-- /#reportPageContent -->\n\n' + insertBefore;

if (html.includes(insertAnchor)) {
  html = html.replace(insertAnchor, '<!-- /#reportPageContent -->\n\n' + compareBlock + '\n' + insertBefore);
} else if (html.includes(insertAnchor2)) {
  html = html.replace(insertAnchor2, '<!-- /#reportPageContent -->\n\n' + compareBlock + '\n' + insertBefore);
} else {
  console.error('Insert anchor not found');
  process.exit(1);
}

// CSS
const oldCompareCss = `    body[data-report-page="REPORT"] #comparePage { display:none; }
    body[data-report-page="REPORT"] #reportPageContent { display:block; }
    body[data-report-page="COMPARE"] #usageView { display:block !important; }
    body[data-report-page="COMPARE"] #usageContainer { display:block !important; }
    body[data-report-page="COMPARE"] #irdRevenuePage { display:none !important; }
    body[data-report-page="COMPARE"][data-ird-view="ON"] #usageView { display:block !important; }
    body[data-report-page="COMPARE"] #reportPageContent { display:block !important; }
    body[data-report-page="COMPARE"] #reportPageContent > *:not(#comparePage) { display:none !important; }
    body[data-report-page="COMPARE"] #usageView > :not(#reportPageContent) { display:none !important; }
    body[data-report-page="COMPARE"] #comparePage { display:block !important; }
    body[data-report-page="COMPARE"] #comparePage[hidden] { display:none !important; }`;

const newCompareCss = `    body[data-report-page="REPORT"] #comparePage { display:none !important; }
    body[data-report-page="REPORT"] #reportPageContent { display:block !important; }
    body[data-report-page="COMPARE"] #usageView { display:block !important; }
    body[data-report-page="COMPARE"] #usageContainer { display:block !important; }
    body[data-report-page="COMPARE"] #irdRevenuePage { display:none !important; }
    body[data-report-page="COMPARE"][data-ird-view="ON"] #usageView { display:block !important; }
    body[data-report-page="COMPARE"] #reportPageContent { display:none !important; }
    body[data-report-page="COMPARE"] #usageExtras { display:none !important; }
    body[data-report-page="COMPARE"] #comparePage { display:block !important; visibility:visible !important; }
    body[data-report-page="COMPARE"] #usageView > :not(#comparePage):not(#sectionNavWrap) { display:none !important; }`;

if (html.includes(oldCompareCss)) {
  html = html.replace(oldCompareCss, newCompareCss);
} else {
  html = html.replace(
    /body\[data-report-page="COMPARE"\] #reportPageContent[^}]+\}/g,
    'body[data-report-page="COMPARE"] #reportPageContent { display:none !important; }'
  );
  html = html.replace(
    /body\[data-report-page="COMPARE"\] #reportPageContent > \*:not\(#comparePage\)[^}]+\}/g,
    ''
  );
  html = html.replace(
    /body\[data-report-page="COMPARE"\] #usageView > :not\(#reportPageContent\)[^}]+\}/g,
    'body[data-report-page="COMPARE"] #usageView > :not(#comparePage):not(#sectionNavWrap) { display:none !important; }'
  );
  html = html.replace(
    /body\[data-report-page="COMPARE"\] #comparePage\[hidden\][^}]+\}/g,
    ''
  );
}

// syncCompareUi
const syncStart = '  function syncCompareUi() {';
const syncEnd = '  function setReportPage(page) {';
const i0 = html.indexOf(syncStart);
const i1 = html.indexOf(syncEnd);

const newSync = `  function syncCompareUi() {
    if ($('reportPageSelect')) $('reportPageSelect').value = reportPage;
    document.body.setAttribute('data-report-page', reportPage);
    document.querySelectorAll('.viewBtn').forEach(btn => {
      const active = String(btn.dataset.page || '').toUpperCase() === reportPage;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const reportContent = $('reportPageContent');
    const comparePage = $('comparePage');
    const chatPage = $('chatPage');
    const usageExtras = $('usageExtras');
    const showReport = reportPage === 'REPORT';
    const showCompare = reportPage === 'COMPARE';
    const showChat = reportPage === 'CHAT';

    if (showCompare) document.body.removeAttribute('data-ird-view');

    if (reportContent) {
      reportContent.hidden = !showReport;
      reportContent.setAttribute('aria-hidden', showReport ? 'false' : 'true');
      if (showReport) {
        reportContent.style.setProperty('display', 'block', 'important');
        Array.from(reportContent.children).forEach((child) => {
          if (!child || child.nodeType !== 1) return;
          child.hidden = false;
          child.style.removeProperty('display');
        });
      } else {
        reportContent.style.setProperty('display', 'none', 'important');
      }
    }

    if (comparePage) {
      comparePage.hidden = !showCompare;
      comparePage.removeAttribute('hidden');
      comparePage.setAttribute('aria-hidden', showCompare ? 'false' : 'true');
      if (showCompare) {
        comparePage.style.setProperty('display', 'block', 'important');
        comparePage.style.setProperty('visibility', 'visible', 'important');
      } else {
        comparePage.style.setProperty('display', 'none', 'important');
      }
    }

    if (chatPage) {
      chatPage.hidden = !showChat;
      if (showChat) chatPage.removeAttribute('hidden');
      chatPage.setAttribute('aria-hidden', showChat ? 'false' : 'true');
      if (showChat) chatPage.style.setProperty('display', 'block', 'important');
      else chatPage.style.setProperty('display', 'none', 'important');
    }

    if (usageExtras) {
      usageExtras.hidden = !showReport;
      if (showReport) usageExtras.style.removeProperty('display');
      else usageExtras.style.setProperty('display', 'none', 'important');
      usageExtras.setAttribute('aria-hidden', showReport ? 'false' : 'true');
    }

    const usageView = $('usageView');
    if (usageView) {
      Array.from(usageView.children).forEach((node) => {
        if (!node || node.nodeType !== 1) return;
        if (node.id === 'sectionNavWrap') return;
        if (node.id === 'reportPageContent') return;
        if (node.id === 'comparePage') {
          node.hidden = !showCompare;
          if (showCompare) {
            node.removeAttribute('hidden');
            node.style.setProperty('display', 'block', 'important');
          } else node.style.setProperty('display', 'none', 'important');
          node.setAttribute('aria-hidden', showCompare ? 'false' : 'true');
          return;
        }
        if (node.id === 'chatPage') {
          node.hidden = !showChat;
          if (showChat) {
            node.removeAttribute('hidden');
            node.style.setProperty('display', 'block', 'important');
          } else node.style.setProperty('display', 'none', 'important');
          node.setAttribute('aria-hidden', showChat ? 'false' : 'true');
          return;
        }
        const showNode = showReport;
        node.hidden = !showNode;
        if (showNode) node.style.removeProperty('display');
        else node.style.setProperty('display', 'none', 'important');
        node.setAttribute('aria-hidden', showNode ? 'false' : 'true');
      });
    }
  }

`;

if (i0 >= 0 && i1 > i0) {
  html = html.slice(0, i0) + newSync + html.slice(i1);
}

fs.writeFileSync(path, html);
const ok = html.indexOf('id="comparePage"') < html.indexOf('id="irdRevenuePage"') &&
  html.lastIndexOf('id="comparePage"') > html.indexOf('<!-- /#reportPageContent -->');
console.log('Done. comparePage after report close:', ok);
