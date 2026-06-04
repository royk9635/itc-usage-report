/**
 * Apply vibrant pie / bar / line chart theme (reference design).
 * Run: node apply_chart_theme.js
 */
const fs = require('fs');
const path = 'e:/usage_report/index.html';
let html = fs.readFileSync(path, 'utf8');

if (html.includes('ITC_CHART_BAR_COLORS')) {
  console.log('Chart theme already applied.');
  process.exit(0);
}

const themeBlock = `
  /* Vibrant chart palette (pie / bar / line) */
  const ITC_CHART_BAR_COLORS = ['#5B8DEF', '#4DB6AC', '#FFB74D', '#F06292', '#9B7EDE', '#64B5F6'];
  const ITC_CHART_PIE_COLORS = ['#5B8DEF', '#9B7EDE', '#F06292', '#FFB74D', '#4DB6AC'];
  const ITC_CHART_LINE_TEAL = '#4DB6AC';
  const ITC_SERIES_COLORS = {
    OTT: { bg: '#5B8DEF', border: '#5B8DEF' },
    DTH: { bg: '#9B7EDE', border: '#9B7EDE' },
    Casting: { bg: '#4DB6AC', border: '#4DB6AC' },
    Weekday: { bg: '#5B8DEF', border: '#5B8DEF' },
    Weekend: { bg: '#F06292', border: '#F06292' }
  };
  function _lineFillGradient(ctx, hex) {
    const h = (ctx && ctx.canvas && ctx.canvas.height) ? ctx.canvas.height : 320;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(77, 182, 172, 0.38)');
    g.addColorStop(0.55, 'rgba(77, 182, 172, 0.12)');
    g.addColorStop(1, 'rgba(77, 182, 172, 0.02)');
    return g;
  }
`;

html = html.replace(
  '  function _hsla(h, s, l, a){ return `hsla(${h}, ${s}%, ${l}%, ${a})`; }',
  '  function _hsla(h, s, l, a){ return `hsla(${h}, ${s}%, ${l}%, ${a})`; }\n' + themeBlock
);

html = html.replace(
  `  function _genBarColors(n, alpha=0.55, startHue=205){
    const out = [];
    const count = Math.max(1, n || 0);
    for (let i=0; i<count; i++){
      const h = (startHue + (360 / count) * i) % 360;
      out.push(_hsla(h, 78, 62, alpha));
    }
    return out;
  }
  function _genSeriesColor(i, alpha=0.55, startHue=210){
    const h = (startHue + (i * 46)) % 360;
    return _hsla(h, 82, 60, alpha);
  }`,
  `  function _genBarColors(n, alpha=1, startHue=205){
    const count = Math.max(1, n || 0);
    const out = [];
    for (let i = 0; i < count; i++) {
      const hex = ITC_CHART_BAR_COLORS[i % ITC_CHART_BAR_COLORS.length];
      if (alpha >= 0.99) out.push(hex);
      else out.push(hex + Math.round(alpha * 255).toString(16).padStart(2, '0').replace(/^/, alpha < 1 ? '' : ''));
    }
    if (alpha < 0.99) {
      return ITC_CHART_BAR_COLORS.slice(0, count).map(hex => {
        const a = Math.round(alpha * 255);
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return \`rgba(\${r},\${g},\${b},\${alpha})\`;
      });
    }
    return out;
  }
  function _genSeriesColor(i, alpha=1, startHue=210){
    const hex = ITC_CHART_BAR_COLORS[i % ITC_CHART_BAR_COLORS.length];
    if (alpha >= 0.99) return hex;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return \`rgba(\${r},\${g},\${b},\${alpha})\`;
  }`
);

// Fix botched _genBarColors - use simpler version
html = html.replace(
  /function _genBarColors\(n, alpha=1, startHue=205\)\{[\s\S]*?return out;\s*\}/,
  `function _genBarColors(n, alpha=1){
    const count = Math.max(1, n || 0);
    return Array.from({ length: count }, (_, i) => {
      const hex = ITC_CHART_BAR_COLORS[i % ITC_CHART_BAR_COLORS.length];
      if (alpha >= 0.99) return hex;
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return \`rgba(\${r},\${g},\${b},\${alpha})\`;
    });
  }`
);

html = html.replace(
  /function _genSeriesColor\(i, alpha=1, startHue=210\)\{[\s\S]*?\}/,
  `function _genSeriesColor(i, alpha=1){
    const hex = ITC_CHART_BAR_COLORS[i % ITC_CHART_BAR_COLORS.length];
    if (alpha >= 0.99) return hex;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return \`rgba(\${r},\${g},\${b},\${alpha})\`;
  }`
);

html = html.replace(
  `    datasets.forEach((ds, i) => {
      if (!ds) return;
      if (!ds.backgroundColor) ds.backgroundColor = _genSeriesColor(i, 0.55, 210);
      if (!ds.borderColor) ds.borderColor = _genSeriesColor(i, 0.92, 210);
      if (ds.borderWidth === undefined) ds.borderWidth = 0;
      if (ds.hoverBorderWidth === undefined) ds.hoverBorderWidth = 1;
    });`,
  `    datasets.forEach((ds, i) => {
      if (!ds) return;
      const named = ds.label && ITC_SERIES_COLORS[ds.label];
      if (named) {
        if (!ds.backgroundColor) ds.backgroundColor = named.bg;
        if (!ds.borderColor) ds.borderColor = named.border;
      } else {
        if (!ds.backgroundColor) ds.backgroundColor = _genSeriesColor(i, 1);
        if (!ds.borderColor) ds.borderColor = _genSeriesColor(i, 1);
      }
      if (ds.borderRadius === undefined) ds.borderRadius = 14;
      if (ds.borderSkipped === undefined) ds.borderSkipped = false;
      if (ds.borderWidth === undefined) ds.borderWidth = 0;
      if (ds.hoverBorderWidth === undefined) ds.hoverBorderWidth = 2;
    });`
);

html = html.replace(
  `      if (!ds.backgroundColor || (Array.isArray(ds.backgroundColor) && ds.backgroundColor.length < n)){
        ds.backgroundColor = _genBarColors(n, 0.55, 205);
      }
      if (!ds.borderColor || (Array.isArray(ds.borderColor) && ds.borderColor.length < n)){
        ds.borderColor = _genBarColors(n, 0.92, 205);
      }
      if (ds.borderWidth === undefined) ds.borderWidth = 0;`,
  `      if (!ds.backgroundColor || (Array.isArray(ds.backgroundColor) && ds.backgroundColor.length < n)){
        ds.backgroundColor = _genBarColors(n, 1);
      }
      if (!ds.borderColor || (Array.isArray(ds.borderColor) && ds.borderColor.length < n)){
        ds.borderColor = _genBarColors(n, 1);
      }
      if (ds.borderRadius === undefined) ds.borderRadius = 14;
      if (ds.borderSkipped === undefined) ds.borderSkipped = false;
      if (ds.borderWidth === undefined) ds.borderWidth = 0;`
);

html = html.replace(
  `    const xScale = { stacked, grid: { color: "rgba(2,6,23,.06)" }, ticks: { color: "rgba(2,6,23,.75)" } };
    const yScale = { stacked, grid: { color: "rgba(2,6,23,.06)" }, ticks: { color: "rgba(2,6,23,.75)" } };`,
  `    const gridStyle = { color: "rgba(148,163,184,0.45)", borderDash: [5, 5], drawBorder: false, lineWidth: 1 };
    const tickStyle = { color: "rgba(51,65,85,0.85)", font: { size: 11, weight: "600" } };
    const xScale = { stacked, grid: gridStyle, ticks: tickStyle };
    const yScale = { stacked, grid: gridStyle, ticks: tickStyle };`
);

// Pie labels white on slice
html = html.replace(
  `              drawPill(pos.x, pos.y, \`\${Math.round(pct * 100)}%\`);`,
  `              ctx.save();
              ctx.font = '800 13px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial, sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.shadowColor = 'rgba(15,23,42,0.25)';
              ctx.shadowBlur = 4;
              ctx.fillText(\`\${Math.round(pct * 100)}%\`, pos.x, pos.y);
              ctx.restore();`
);

html = html.replace(
  `    datasets = (datasets || []).map((ds, i) => {
      const border = ds.borderColor || _genSeriesColor(i, 0.85, 210);
      const bg = ds.backgroundColor || _genSeriesColor(i, 0.25, 210);
      return {
        type: 'line',
        borderColor: border,
        backgroundColor: bg,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointHitRadius: 18,
        pointBorderWidth: 2,
        tension: 0.35,
        fill: false,
        borderWidth: 3,
        ...ds
      };
    });`,
  `    datasets = (datasets || []).map((ds, i) => {
      const border = ds.borderColor || (i === 0 && !ds.borderColor ? ITC_CHART_LINE_TEAL : _genSeriesColor(i, 1));
      const useFill = ds.fill !== false && (ds.fill === true || (datasets.length === 1 && i === 0));
      let bg = ds.backgroundColor;
      if (useFill && !bg) {
        try { bg = _lineFillGradient(ctx, border); } catch (_) { bg = 'rgba(77,182,172,0.15)'; }
      } else if (!bg) {
        bg = _genSeriesColor(i, 0.12);
      }
      return {
        type: 'line',
        borderColor: border,
        backgroundColor: bg,
        pointRadius: ds.pointRadius ?? 5,
        pointHoverRadius: ds.pointHoverRadius ?? 7,
        pointHitRadius: 18,
        pointBorderWidth: ds.pointBorderWidth ?? 2,
        pointBackgroundColor: ds.pointBackgroundColor ?? '#ffffff',
        pointBorderColor: ds.pointBorderColor ?? border,
        tension: ds.tension ?? 0.35,
        fill: useFill,
        borderWidth: ds.borderWidth ?? 3,
        ...ds
      };
    });`
);

html = html.replace(
  `      data: { labels, datasets: [{ label: 'Share', data: values, borderWidth: 0, backgroundColor: ['#1E88E5', '#43A047', '#FB8C00'], hoverBackgroundColor: ['#1E88E5', '#43A047', '#FB8C00'] }]},`,
  `      data: { labels, datasets: [{ label: 'Share', data: values, borderWidth: 3, borderColor: '#ffffff', spacing: 2, backgroundColor: ['#5B8DEF', '#9B7EDE', '#4DB6AC'], hoverBackgroundColor: ['#4A7ED8', '#8A6ED0', '#3DA89E'] }]},`
);

html = html.replace(
  `      OTT: { label: "OTT", key: "ott_min_per_guest", color: "rgba(59,130,246,.88)", fill: "rgba(59,130,246,.20)", noun: "OTT viewing" },
      DTH: { label: "DTH", key: "dth_min_per_guest", color: "rgba(139,92,246,.88)", fill: "rgba(139,92,246,.20)", noun: "DTH viewing" },
      CASTING: { label: "Casting", key: "casting_min_per_guest", color: "rgba(217,70,239,.88)", fill: "rgba(217,70,239,.18)", noun: "Casting viewing" },
      TOTAL: { label: "Total", key: "total_min_per_guest", color: "rgba(244,63,94,.82)", fill: "rgba(244,63,94,.18)", noun: "total viewing" }`,
  `      OTT: { label: "OTT", key: "ott_min_per_guest", color: "#5B8DEF", fill: "rgba(91,141,239,0.22)", noun: "OTT viewing" },
      DTH: { label: "DTH", key: "dth_min_per_guest", color: "#9B7EDE", fill: "rgba(155,126,222,0.22)", noun: "DTH viewing" },
      CASTING: { label: "Casting", key: "casting_min_per_guest", color: "#4DB6AC", fill: "rgba(77,182,172,0.28)", noun: "Casting viewing" },
      TOTAL: { label: "Total", key: "total_min_per_guest", color: "#4DB6AC", fill: "rgba(77,182,172,0.28)", noun: "total viewing" }`
);

html = html.replace(
  `  const palette = ['#1d4ed8', '#0ea5e9', '#f59e0b', '#22c55e'];`,
  `  const palette = ['#5B8DEF', '#9B7EDE', '#FFB74D', '#4DB6AC'];`
);

html = html.replace(
  `            color: '#0f172a',
            backgroundColor: 'rgba(255,255,255,0.94)',
            borderColor: 'rgba(148,163,184,0.55)',
            borderWidth: 1,`,
  `            color: '#ffffff',
            font: { weight: '800', size: 13 },
            backgroundColor: 'transparent',
            borderWidth: 0,
            textShadowBlur: 4,
            textShadowColor: 'rgba(15,23,42,0.35)',`
);

html = html.replace(
  `          borderWidth: 2,
          hoverOffset: 10`,
  `          borderWidth: 3,
          borderColor: '#ffffff',
          hoverOffset: 12`
);

html = html.replace(
  `  const palette=['#2563eb','#f97316','#16a34a','#dc2626','#7c3aed','#0891b2','#db2777','#65a30d','#ea580c','#4f46e5'];`,
  `  const palette=['#5B8DEF','#4DB6AC','#FFB74D','#F06292','#9B7EDE','#64B5F6','#5B8DEF','#4DB6AC','#FFB74D','#F06292'];`
);

// Bar value labels: dark bold above bar (reference style)
html = html.replace(
  `          ctx.fillStyle = "rgba(255,255,255,.78)";
          roundRect(left, top, w, h, radius);
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(255,255,255,.95)";
          ctx.fillStyle = "rgba(2,6,23,.92)";
          ctx.strokeText(text, x, y);
          ctx.fillText(text, x, y);`,
  `          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = "rgba(30,41,59,0.92)";
          ctx.font = \`800 \${fontSize + 1}px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial, sans-serif\`;
          if (!horizontal && !stacked) {
            ctx.fillText(text, x, y);
            ctx.restore();
            return;
          }
          ctx.fillStyle = "rgba(255,255,255,.88)";
          roundRect(left, top, w, h, radius);
          ctx.fill();
          ctx.textBaseline = 'middle';
          ctx.fillStyle = "rgba(30,41,59,0.92)";
          ctx.fillText(text, x, y);`
);

// Chart card polish
if (!html.includes('.chartWrap canvas')) {
  html = html.replace(
    '    .chartWrap{height:360px; margin-top:6px; flex:1; min-height:260px; display:flex; align-items:stretch;}',
    `    .chartWrap{height:360px; margin-top:6px; flex:1; min-height:260px; display:flex; align-items:stretch; background:linear-gradient(180deg,#fafbff 0%,#ffffff 100%); border-radius:16px; padding:8px;}
    .card .chartWrap{box-shadow:0 8px 24px rgba(91,141,239,0.06);}`
  );
}

fs.writeFileSync(path, html);
console.log('Chart theme applied');
