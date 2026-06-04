/**
 * Add 15-section management comparison report to Compare Sites view only.
 * Run: node add_compare_management_report.js
 */
const fs = require('fs');
const path = 'e:/usage_report/index.html';
let html = fs.readFileSync(path, 'utf8');

if (html.includes('buildCompareManagementReport')) {
  console.log('Compare management report already present.');
  process.exit(0);
}

const CSS = `
.compareMgmtReportCard{margin-top:20px;border:2px solid rgba(0,113,168,.12);}
.compareMgmtReportHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px;}
.compareMgmtReportHead h2{margin:8px 0 4px;font-size:1.35rem;color:#0071a8;}
.compareMgmtReport{background:#fff;border-radius:14px;padding:4px 2px 8px;}
.compareMgmtReport .mgmt-section{margin:0 0 22px;padding-bottom:18px;border-bottom:1px solid rgba(148,163,184,.22);}
.compareMgmtReport .mgmt-section:last-child{border-bottom:0;margin-bottom:0;}
.compareMgmtReport h3{margin:0 0 8px;font-size:1.05rem;color:#0f172a;}
.compareMgmtReport p,.compareMgmtReport li{font-size:13px;line-height:1.55;color:#334155;}
.compareMgmtReport ul{margin:8px 0 0;padding-left:18px;}
.compareMgmtReport .mgmt-muted{color:var(--muted);font-size:12px;margin-top:4px;}
.compareMgmtReport .mgmt-table{width:100%;border-collapse:collapse;font-size:12px;margin:10px 0 4px;}
.compareMgmtReport .mgmt-table th,.compareMgmtReport .mgmt-table td{border:1px solid rgba(148,163,184,.28);padding:8px 10px;text-align:left;vertical-align:top;}
.compareMgmtReport .mgmt-table th{background:rgba(0,113,168,.08);font-weight:800;}
.compareMgmtReport .mgmt-table td.right,.compareMgmtReport .mgmt-table th.right{text-align:right;}
.compareMgmtReport .mgmt-callout{background:rgba(0,113,168,.06);border-left:4px solid #0071a8;padding:10px 12px;border-radius:0 10px 10px 0;margin:10px 0;}
.compareMgmtReport .mgmt-site-rec{margin:10px 0;padding:10px 12px;border:1px solid rgba(148,163,184,.25);border-radius:12px;background:rgba(248,250,252,.9);}
.compareMgmtReport .mgmt-site-rec b{display:block;margin-bottom:4px;color:#0f172a;}
body[data-report-page="COMPARE"] #compareMgmtReportWrap{display:block;}
body[data-report-page="REPORT"] #compareMgmtReportWrap,
body[data-report-page="CHAT"] #compareMgmtReportWrap{display:none!important;}
`;

html = html.replace(
  '    .compareEmpty{ text-align:center; padding:18px; margin-bottom:14px; }',
  '    .compareEmpty{ text-align:center; padding:18px; margin-bottom:14px; }\n' + CSS
);

const HTML_FINAL = `<div class="card compareMgmtReportCard" id="compareMgmtReportWrap" style="display:none;">
<div class="compareMgmtReportHead">
<div>
<span class="badge">Management report</span>
<h2>Site comparison — executive briefing</h2>
<div class="muted" id="compareMgmtReportMeta">Generated from selected sites for the reporting month.</div>
</div>
<button class="btn" id="btnCompareMgmtPrint" type="button">Print report</button>
</div>
<div id="compareMgmtReport" class="compareMgmtReport" aria-live="polite"></motion></motion>`;

const HTML_BLOCK = `<div class="card compareMgmtReportCard" id="compareMgmtReportWrap" style="display:none;">
<div class="compareMgmtReportHead">
<div>
<span class="badge">Management report</span>
<h2>Site comparison — executive briefing</h2>
<div class="muted" id="compareMgmtReportMeta">Generated from selected sites for the reporting month.</div>
</div>
<button class="btn" id="btnCompareMgmtPrint" type="button">Print report</button>
</div>
<div id="compareMgmtReport" class="compareMgmtReport" aria-live="polite"></div>
</div>`;

const needle =
  '<div class="note" id="compareMixInsight"></div>\n</div>\n</motion>\n</div>\n</div>\n</div>\n<div aria-hidden="true" hidden="" id="irdRevenuePage">';
const altNeedle =
  '<div class="note" id="compareMixInsight"></div>\n</div>\n</div>\n</div>\n</div>\n<div aria-hidden="true" hidden="" id="irdRevenuePage">';

if (!html.includes('id="compareMgmtReport"')) {
  if (html.includes(needle)) {
    html = html.replace(needle, '<div class="note" id="compareMixInsight"></div>\n</div>\n</div>\n' + HTML_BLOCK + '\n</div>\n</motion>\n<div aria-hidden="true" hidden="" id="irdRevenuePage">');
    html = html.replace('\n</motion>\n<div aria-hidden="true" hidden="" id="irdRevenuePage">', '\n</div>\n<div aria-hidden="true" hidden="" id="irdRevenuePage">');
  } else if (html.includes(altNeedle)) {
    html = html.replace(altNeedle, '<div class="note" id="compareMixInsight"></div>\n</div>\n</div>\n' + HTML_BLOCK + '\n</div>\n</div>\n<div aria-hidden="true" hidden="" id="irdRevenuePage">');
  } else {
    console.warn('Could not find compare HTML anchor');
  }
}

const reportJs = fs.readFileSync('e:/usage_report/compare_management_report_fn.js', 'utf8');
html = html.replace('  function renderComparePage() {', reportJs + '\n  function renderComparePage() {');

const smartlerEnd = `      if ($('compareSmartlerInsight')) $('compareSmartlerInsight').innerHTML = \`<b>Compare insight:</b> Room automation comparison is shown only for the selected sites that have automation activity.\`;
    }
  }`;

if (html.includes(smartlerEnd)) {
  html = html.replace(
    smartlerEnd,
    `      if ($('compareSmartlerInsight')) $('compareSmartlerInsight').innerHTML = \`<b>Compare insight:</b> Room automation comparison is shown only for the selected sites that have automation activity.\`;
    }

    buildCompareManagementReport(selections);
  }`
  );
} else {
  html = html.replace(
    '    compareSummaryCards(selections);\n\n    const labels = selections.map',
    '    compareSummaryCards(selections);\n    buildCompareManagementReport(selections);\n\n    const labels = selections.map'
  );
}

html = html.replace(
  `    if (reportPage === 'COMPARE') {
      renderCompareChooser();
      renderComparePage();`,
  `    if (reportPage === 'COMPARE') {
      if (!compareSelectedIds.length) compareSelectedIds = defaultCompareSiteIds();
      ensureCompareSelection();
      renderCompareChooser();
      renderComparePage();`
);

if (!html.includes('btnCompareMgmtPrint')) {
  html = html.replace(
    `$('btnExport')?.addEventListener('click', () => window.print());`,
    `$('btnExport')?.addEventListener('click', () => window.print());
    $('btnCompareMgmtPrint')?.addEventListener('click', () => {
      const card = $('compareMgmtReportWrap');
      if (!card || card.style.display === 'none') return;
      window.print();
    });`
  );
}

fs.writeFileSync(path, html);
console.log('compareMgmtReport:', html.includes('id="compareMgmtReport"'));
console.log('buildCompareManagementReport:', html.includes('buildCompareManagementReport'));
