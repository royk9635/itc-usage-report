/**
 * Fix Compare / Chat views showing main report content.
 */
const fs = require('fs');
const path = process.argv[2] || 'e:/usage_report/index.html';
let lines = fs.readFileSync(path, 'utf8').split(/\n/);

let irdIdx = lines.findIndex((l) => l.includes('id="irdRevenuePage"'));
if (irdIdx > 0) {
  let removed = 0;
  for (let i = irdIdx - 1; i >= 0 && removed < 2; i--) {
    if (lines[i].trim() === '</div>') {
      lines.splice(i, 1);
      irdIdx--;
      removed++;
    } else if (lines[i].trim() !== '') break;
  }
  console.log('Removed', removed, 'extra </motion></motion> before irdRevenuePage');
}

let html = lines.join('\n');

const oldCss = `    body[data-report-page="COMPARE"] #reportPageContent,
    body[data-report-page="COMPARE"] #reportPageContent * { display:none !important; }
    body[data-report-page="COMPARE"] #usageView > :not(#comparePage):not(#reportPageContent) { display:none !important; }
    body[data-report-page="COMPARE"] #comparePage,
    body[data-report-page="COMPARE"] #comparePage * { visibility:visible; }
    body[data-report-page="COMPARE"] #comparePage { display:block !important; }`;

const newCss = `    body[data-report-page="COMPARE"] #reportPageContent { display:block !important; }
    body[data-report-page="COMPARE"] #reportPageContent > *:not(#comparePage) { display:none !important; }
    body[data-report-page="COMPARE"] #usageView > :not(#reportPageContent) { display:none !important; }
    body[data-report-page="COMPARE"] #comparePage { display:block !important; }
    body[data-report-page="COMPARE"] #comparePage[hidden] { display:none !important; }`;

if (html.includes(oldCss)) html = html.replace(oldCss, newCss);
else if (!html.includes('reportPageContent > *:not(#comparePage)')) {
  console.warn('COMPARE CSS already updated or layout differs — skipping CSS patch');
}

const syncStart = '  function syncCompareUi() {';
const syncEnd = '  function setReportPage(page) {';
const i0 = html.indexOf(syncStart);
const i1 = html.indexOf(syncEnd);
if (i0 < 0 || i1 < 0) throw new Error('syncCompareUi not found');

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

    if (reportContent) {
      if (showCompare) {
        reportContent.hidden = false;
        reportContent.style.setProperty('display', 'block', 'important');
        reportContent.setAttribute('aria-hidden', 'false');
        Array.from(reportContent.children).forEach((child) => {
          if (!child || child.nodeType !== 1) return;
          const isCompare = child.id === 'comparePage';
          child.hidden = !isCompare;
          if (isCompare) child.style.setProperty('display', 'block', 'important');
          else child.style.setProperty('display', 'none', 'important');
        });
      } else if (showReport) {
        reportContent.hidden = false;
        reportContent.style.removeProperty('display');
        reportContent.setAttribute('aria-hidden', 'false');
        Array.from(reportContent.children).forEach((child) => {
          if (!child || child.nodeType !== 1) return;
          if (child.id === 'comparePage') {
            child.hidden = true;
            child.style.setProperty('display', 'none', 'important');
          } else {
            child.hidden = false;
            child.style.removeProperty('display');
          }
        });
      } else {
        reportContent.hidden = true;
        reportContent.style.setProperty('display', 'none', 'important');
        reportContent.setAttribute('aria-hidden', 'true');
      }
    }

    if (comparePage) {
      comparePage.hidden = !showCompare;
      comparePage.setAttribute('aria-hidden', showCompare ? 'false' : 'true');
      if (showCompare) comparePage.style.setProperty('display', 'block', 'important');
      else comparePage.style.setProperty('display', 'none', 'important');
    }

    if (chatPage) {
      chatPage.hidden = !showChat;
      if (showChat) chatPage.style.setProperty('display', 'block', 'important');
      else chatPage.style.setProperty('display', 'none', 'important');
      chatPage.setAttribute('aria-hidden', showChat ? 'false' : 'true');
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
        if (node.id === 'reportPageContent' || node.id === 'sectionNavWrap') return;
        if (node.id === 'chatPage') {
          node.hidden = !showChat;
          if (showChat) node.style.setProperty('display', 'block', 'important');
          else node.style.setProperty('display', 'none', 'important');
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

html = html.slice(0, i0) + newSync + html.slice(i1);
fs.writeFileSync(path, html);
console.log('Fixed', path);
