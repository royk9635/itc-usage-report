'use strict';
/**
 * CLI: node scripts/load-report-cli.js '{"startDate":"2026-04-01","endDate":"2026-04-30"}'
 */
const { loadReportRange } = require('../lib/report-api');

const args = JSON.parse(process.argv[2] || '{}');
loadReportRange(args)
  .then(({ bundle }) => process.stdout.write(JSON.stringify(bundle)))
  .catch((e) => {
    process.stderr.write(String(e.message || e));
    process.exit(1);
  });
