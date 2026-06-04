  function stdDev(nums) {
    const arr = (nums || []).filter((n) => Number.isFinite(n));
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const v = arr.reduce((s, n) => s + (n - mean) ** 2, 0) / arr.length;
    return Math.sqrt(v);
  }

  function compareSiteMetrics(sel) {
    const t = sel.totals || {};
    const dg = t.dur_min_per_guest || {};
    const sg = t.sess_per_guest || {};
    const mix = t.mix || {};
    const wd = sel.day_type?.Weekday?.guest_days || 0;
    const we = sel.day_type?.Weekend?.guest_days || 0;
    const guestDays = Number(t.guest_days || wd + we || 0);
    return {
      sel,
      label: compareSiteLabel(sel.brand, sel.name),
      brand: sel.brand || 'Property',
      guestDays,
      totalMin: Number(dg.Total || 0),
      ottMin: Number(dg.OTT || 0),
      dthMin: Number(dg.DTH || 0),
      castMin: Number(dg.Casting || 0),
      totalSess: totalFromParts(sg),
      ottSess: Number(sg.OTT || 0),
      dthSess: Number(sg.DTH || 0),
      castSess: Number(sg.Casting || 0),
      mixOtt: Number(mix.OTT || 0) * 100,
      mixDth: Number(mix.DTH || 0) * 100,
      mixCast: Number(mix.Casting || 0) * 100,
      wdDur: dayTypeTotalDuration(sel, 'Weekday'),
      weDur: dayTypeTotalDuration(sel, 'Weekend'),
      wdSess: dayTypeTotalSessions(sel, 'Weekday'),
      weSess: dayTypeTotalSessions(sel, 'Weekend'),
    };
  }

  function topMediaRows(sel, kind, limit) {
    const src =
      kind === 'ott'
        ? sel.ott_apps || []
        : kind === 'casting'
          ? sel.casting_apps || []
          : sel.dth_channels || [];
    return filterNamedRows(src, kind)
      .map((r) => ({
        name: String(r.name || '').trim(),
        minPerGuest: safeDiv(Number(r.total_hr || 0) * 60, sel?.totals?.guest_days || 0),
      }))
      .filter((r) => r.name && r.minPerGuest > 0)
      .sort((a, b) => b.minPerGuest - a.minPerGuest)
      .slice(0, limit || 5);
  }

  function topCmsRows(sel, limit) {
    const rows = sel.cms_videos || sel.tv_modules || [];
    return (rows || [])
      .map((r) => ({
        name: String(r.name || r.key || 'CMS content').trim(),
        evt: Number(r.events_per_guest || 0),
      }))
      .filter((r) => r.name && r.evt > 0)
      .sort((a, b) => b.evt - a.evt)
      .slice(0, limit || 5);
  }

  function smartlerTotalPerGuest(sel) {
    const arr = Array.isArray(sel.smartler?.events_per_guest_day) ? sel.smartler.events_per_guest_day : [];
    return arr.reduce((a, b) => a + Number(b || 0), 0);
  }

  function smartlerTopCategories(sel, limit) {
    const s = sel.smartler || {};
    const cats = Array.isArray(s.categories) ? s.categories : [];
    const vals = Array.isArray(s.events_per_guest_day) ? s.events_per_guest_day : [];
    return cats
      .map((key, i) => ({ label: smartlerLabel(key), value: Number(vals[i] || 0) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit || 5);
  }

  function dailyStats(sel) {
    const series = adjustedDailySeries(sel, 'TOTAL');
    const vals = series.map((r) => Number(r.value || 0));
    if (!vals.length) return { avg: 0, min: 0, max: 0, cv: 0, peakDate: '', lowDate: '' };
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const sd = stdDev(vals);
    const peakIdx = vals.indexOf(max);
    const lowIdx = vals.indexOf(min);
    return {
      avg,
      min,
      max,
      cv: avg > 0 ? sd / avg : 0,
      peakDate: series[peakIdx]?.date || '',
      lowDate: series[lowIdx]?.date || '',
    };
  }

  function escMgmt(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildCompareManagementReport(selections) {
    const wrap = $('compareMgmtReportWrap');
    const el = $('compareMgmtReport');
    const meta = $('compareMgmtReportMeta');
    if (!el) return;
    if (!selections || !selections.length) {
      if (wrap) wrap.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    if (wrap) wrap.style.display = 'block';
    const period = REPORT.period || {};
    if (meta) {
      meta.textContent =
        (period.label || 'Selected month') +
        ' · ' +
        selections.length +
        ' site' +
        (selections.length === 1 ? '' : 's') +
        ' compared · values per guest-day (occupied room-day basis)';
    }

    const sites = selections.map(compareSiteMetrics);
    const byTotal = [...sites].sort((a, b) => b.totalMin - a.totalMin);
    const best = byTotal[0];
    const worst = byTotal[byTotal.length - 1];
    const gap = best.totalMin - worst.totalMin;

    const siteList = sites
      .map((s, i) => '<li><b>' + (i + 1) + '. ' + escMgmt(s.label) + '</b> (' + escMgmt(s.brand) + ')</li>')
      .join('');

    const kpiHead = [
      'Site',
      'Guest-days',
      'Total min / guest-day',
      'OTT min / guest-day',
      'DTH min / guest-day',
      'Casting min / guest-day',
      'Total sessions / guest-day',
      'OTT sessions / guest-day',
      'DTH sessions / guest-day',
      'Casting sessions / guest-day',
    ];
    const kpiRows = sites
      .map(function (s) {
        return (
          '<tr><td><b>' +
          escMgmt(s.label) +
          '</b></td><td class="right">' +
          fmtInt(s.guestDays) +
          '</td><td class="right">' +
          fmtNumber(s.totalMin, 1) +
          '</td><td class="right">' +
          fmtNumber(s.ottMin, 1) +
          '</td><td class="right">' +
          fmtNumber(s.dthMin, 1) +
          '</td><td class="right">' +
          fmtNumber(s.castMin, 1) +
          '</td><td class="right">' +
          fmtNumber(s.totalSess, 2) +
          '</td><td class="right">' +
          fmtNumber(s.ottSess, 2) +
          '</td><td class="right">' +
          fmtNumber(s.dthSess, 2) +
          '</td><td class="right">' +
          fmtNumber(s.castSess, 2) +
          '</td></tr>'
        );
      })
      .join('');

    const weekdayRows = sites.map(function (s) {
      const stronger = s.weDur > s.wdDur ? 'Weekend' : s.weDur < s.wdDur ? 'Weekday' : 'Similar';
      const uplift = s.wdDur > 0 ? ((s.weDur - s.wdDur) / s.wdDur) * 100 : 0;
      return { label: s.label, wdDur: s.wdDur, weDur: s.weDur, wdSess: s.wdSess, weSess: s.weSess, stronger, uplift };
    });
    const weekendUpliftLead = [...weekdayRows].sort((a, b) => b.uplift - a.uplift)[0];
    const stabilityLead = [...sites]
      .map((s) => ({ label: s.label, cv: dailyStats(s.sel).cv }))
      .sort((a, b) => a.cv - b.cv)[0];

    const mixOttLead = [...sites].sort((a, b) => b.mixOtt - a.mixOtt)[0];
    const mixDthLead = [...sites].sort((a, b) => b.mixDth - a.mixDth)[0];
    const mixCastLead = [...sites].sort((a, b) => b.mixCast - a.mixCast)[0];

    const dailyLead = [...sites]
      .map((s) => ({ label: s.label, avg: dailyStats(s.sel).avg }))
      .sort((a, b) => b.avg - a.avg)[0];

    const ottEngagement = sites.map((s) => ({
      label: s.label,
      total: s.ottMin,
      top: topMediaRows(s.sel, 'ott', 3),
    }));
    const ottLead = [...ottEngagement].sort((a, b) => b.total - a.total)[0];
    const ottLow = [...ottEngagement].sort((a, b) => a.total - b.total)[0];

    const dthEngagement = sites.map((s) => ({
      label: s.label,
      total: s.dthMin,
      mix: s.mixDth,
      top: topMediaRows(s.sel, 'dth', 3),
    }));
    const dthLead = [...dthEngagement].sort((a, b) => b.total - a.total)[0];

    const castEngagement = sites.map((s) => ({
      label: s.label,
      total: s.castMin,
      top: topMediaRows(s.sel, 'casting', 3),
    }));
    const castLead = [...castEngagement].sort((a, b) => b.total - a.total)[0];
    const castLow = [...castEngagement].sort((a, b) => a.total - b.total)[0];

    const cmsRows = sites.map((s) => ({
      label: s.label,
      top: topCmsRows(s.sel, 3),
      total: topCmsRows(s.sel, 10).reduce((a, r) => a + r.evt, 0),
    }));
    const cmsLead = cmsRows.some((r) => r.total > 0) ? [...cmsRows].sort((a, b) => b.total - a.total)[0] : null;

    const smartlerRows = sites.map((s) => ({
      label: s.label,
      total: smartlerTotalPerGuest(s.sel),
      top: smartlerTopCategories(s.sel, 3),
    }));
    const smartlerLead = smartlerRows.some((r) => r.total > 0)
      ? [...smartlerRows].sort((a, b) => b.total - a.total)[0]
      : null;

    function balanceScore(site) {
      const shares = [site.mixOtt, site.mixDth, site.mixCast].filter((v) => v > 0);
      if (shares.length < 2) return 0;
      const ideal = 100 / shares.length;
      return -shares.reduce((s, v) => s + Math.abs(v - ideal), 0);
    }

    const overallRank = [...sites]
      .map((s) => ({
        label: s.label,
        score:
          s.totalMin * 0.45 +
          s.totalSess * 10 * 0.2 +
          balanceScore(s) * 0.15 +
          (s.wdDur + s.weDur) * 0.1 +
          (1 / (1 + dailyStats(s.sel).cv)) * 5 * 0.1,
        s,
      }))
      .sort((a, b) => b.score - a.score);
    const bestOverall = overallRank[0];
    const lowOverall = overallRank[overallRank.length - 1];

    const insights = [];
    insights.push(
      '<b>' +
        escMgmt(best.label) +
        '</b> recorded the highest total in-room entertainment usage at <b>' +
        fmtNumber(best.totalMin, 1) +
        ' min/guest-day</b>, while <b>' +
        escMgmt(worst.label) +
        '</b> was lowest at <b>' +
        fmtNumber(worst.totalMin, 1) +
        ' min/guest-day</b> (gap: <b>' +
        fmtNumber(gap, 1) +
        ' min</b>).'
    );
    insights.push(
      'Usage mix differs: <b>' +
        escMgmt(mixOttLead.label) +
        '</b> is most OTT-led (' +
        fmtNumber(mixOttLead.mixOtt, 1) +
        '% of duration), <b>' +
        escMgmt(mixDthLead.label) +
        '</b> relies most on DTH (' +
        fmtNumber(mixDthLead.mixDth, 1) +
        '%), and <b>' +
        escMgmt(mixCastLead.label) +
        '</b> has the strongest Casting share (' +
        fmtNumber(mixCastLead.mixCast, 1) +
        '%).'
    );
    insights.push(
      'Weekend uplift is strongest at <b>' +
        escMgmt(weekendUpliftLead.label) +
        '</b> (' +
        fmtNumber(weekendUpliftLead.uplift, 1) +
        '% higher weekend vs weekday duration). <b>' +
        escMgmt(stabilityLead.label) +
        '</b> shows the most stable day-to-day pattern.'
    );
    insights.push(
      'OTT engagement leader: <b>' +
        escMgmt(ottLead.label) +
        '</b> (' +
        fmtNumber(ottLead.total, 1) +
        ' min/guest-day). Lowest among selected sites: <b>' +
        escMgmt(ottLow.label) +
        '</b> (' +
        fmtNumber(ottLow.total, 1) +
        ' min/guest-day).'
    );
    insights.push(
      'Casting adoption is highest at <b>' +
        escMgmt(castLead.label) +
        '</b> and lowest at <b>' +
        escMgmt(castLow.label) +
        '</b>.'
    );
    if (cmsLead) {
      insights.push(
        'In-room CMS / TV module engagement is strongest at <b>' + escMgmt(cmsLead.label) + '</b> based on events per guest-day.'
      );
    } else {
      insights.push('CMS video / TV module comparison: data not available for the selected sites in this view.');
    }
    if (smartlerLead) {
      insights.push(
        'Smart room / automation interaction is highest at <b>' +
          escMgmt(smartlerLead.label) +
          '</b> (' +
          fmtNumber(smartlerLead.total, 2) +
          ' events/guest-day).'
      );
    } else {
      insights.push('Smartler / room automation comparison: data not available for the selected sites in this view.');
    }

    const siteRecommendations = sites
      .map(function (s) {
        const strengths = [];
        const improvements = [];
        const actions = [];
        if (s.totalMin >= best.totalMin * 0.95) strengths.push('Strong overall guest entertainment usage.');
        if (s.ottMin === Math.max(...sites.map((x) => x.ottMin))) strengths.push('Leading OTT engagement.');
        if (s.dthMin === Math.max(...sites.map((x) => x.dthMin))) strengths.push('Strong linear TV (DTH) usage.');
        if (s.castMin === Math.max(...sites.map((x) => x.castMin))) strengths.push('Strong Casting adoption.');
        if (s.totalMin <= worst.totalMin * 1.05) improvements.push('Overall in-room entertainment minutes are below peers.');
        if (s.ottMin < ottLead.total * 0.6) improvements.push('OTT minutes per guest-day are comparatively low.');
        if (s.dthMin < dthLead.total * 0.6) improvements.push('DTH viewing is below peer average.');
        if (s.castMin < castLead.total * 0.6) improvements.push('Casting usage is below peer average.');
        if (dailyStats(s.sel).cv > 0.35) improvements.push('Daily usage fluctuates more than other selected sites.');
        if (!strengths.length) strengths.push('Stable base usage with room to grow engagement.');
        if (!improvements.length) improvements.push('Maintain current mix; focus on sustaining weekend uplift.');
        actions.push('Review top guest apps/channels and promote them on the welcome screen.');
        if (s.ottMin < ottLead.total * 0.75) actions.push('Refresh OTT app visibility and login guidance in-room.');
        if (s.castMin < castLead.total * 0.75) actions.push('Add Casting instructions at check-in and on the TV home page.');
        if (s.dthMin < dthLead.total * 0.75) actions.push('Audit DTH channel map relevance for the guest profile.');
        return (
          '<div class="mgmt-site-rec"><b>' +
          escMgmt(s.label) +
          '</b><p><b>Working well:</b> ' +
          escMgmt(strengths.join(' ')) +
          '</p><p><b>Needs improvement:</b> ' +
          escMgmt(improvements.join(' ')) +
          '</p><p><b>Suggested action:</b> ' +
          escMgmt(actions.slice(0, 2).join(' ')) +
          '</p></div>'
        );
      })
      .join('');
    const siteRecHtml = siteRecommendations.replace(/<div /g, '<div ').replace(/<\/motion>/g, '</div>');

    const weekdayTable = weekdayRows
      .map(function (s) {
        return (
          '<tr><td><b>' +
          escMgmt(s.label) +
          '</b></td><td class="right">' +
          fmtNumber(s.wdDur, 1) +
          '</td><td class="right">' +
          fmtNumber(s.weDur, 1) +
          '</td><td class="right">' +
          fmtNumber(s.wdSess, 2) +
          '</td><td class="right">' +
          fmtNumber(s.weSess, 2) +
          '</td><td>' +
          escMgmt(s.stronger) +
          '</td><td class="right">' +
          fmtNumber(s.uplift, 1) +
          '%</td></tr>'
        );
      })
      .join('');

    const mixTable = sites
      .map(function (s) {
        const style =
          s.mixOtt >= s.mixDth && s.mixOtt >= s.mixCast
            ? 'Streaming-focused'
            : s.mixDth >= s.mixOtt && s.mixDth >= s.mixCast
              ? 'TV-focused'
              : 'Casting-focused';
        return (
          '<tr><td><b>' +
          escMgmt(s.label) +
          '</b></td><td class="right">' +
          fmtNumber(s.mixOtt, 1) +
          '%</td><td class="right">' +
          fmtNumber(s.mixDth, 1) +
          '%</td><td class="right">' +
          fmtNumber(s.mixCast, 1) +
          '%</td><td>' +
          escMgmt(style) +
          '</td></tr>'
        );
      })
      .join('');

    const dailyTable = sites
      .map(function (s) {
        const st = dailyStats(s.sel);
        const pattern = st.cv < 0.2 ? 'Consistent' : st.cv < 0.35 ? 'Moderate variation' : 'Fluctuating';
        return (
          '<tr><td><b>' +
          escMgmt(s.label) +
          '</b></td><td class="right">' +
          fmtNumber(st.avg, 1) +
          '</td><td class="right">' +
          fmtNumber(st.min, 1) +
          '</td><td class="right">' +
          fmtNumber(st.max, 1) +
          '</td><td>' +
          escMgmt(pattern) +
          '</td><td>' +
          (st.peakDate ? escMgmt(st.peakDate) : '—') +
          '</td></tr>'
        );
      })
      .join('');

    const ottTable = ottEngagement
      .map(function (s) {
        const tops = s.top.length
          ? s.top.map((r) => escMgmt(r.name) + ' (' + fmtNumber(r.minPerGuest, 1) + ' min)').join(', ')
          : 'Data not available';
        return (
          '<tr><td><b>' +
          escMgmt(s.label) +
          '</b></td><td class="right">' +
          fmtNumber(s.total, 1) +
          '</td><td>' +
          tops +
          '</td></tr>'
        );
      })
      .join('');

    const dthTable = dthEngagement
      .map(function (s) {
        const tops = s.top.length
          ? s.top.map((r) => escMgmt(r.name) + ' (' + fmtNumber(r.minPerGuest, 1) + ' min)').join(', ')
          : 'Data not available';
        return (
          '<tr><td><b>' +
          escMgmt(s.label) +
          '</b></td><td class="right">' +
          fmtNumber(s.total, 1) +
          '</td><td class="right">' +
          fmtNumber(s.mix, 1) +
          '%</td><td>' +
          tops +
          '</td></tr>'
        );
      })
      .join('');

    const castTable = castEngagement
      .map(function (s) {
        const tops = s.top.length
          ? s.top.map((r) => escMgmt(r.name) + ' (' + fmtNumber(r.minPerGuest, 1) + ' min)').join(', ')
          : 'Data not available';
        return (
          '<tr><td><b>' +
          escMgmt(s.label) +
          '</b></td><td class="right">' +
          fmtNumber(s.total, 1) +
          '</td><td>' +
          tops +
          '</td></tr>'
        );
      })
      .join('');

    const cmsTable = cmsRows
      .map(function (s) {
        const tops = s.top.length
          ? s.top.map((r) => escMgmt(r.name) + ' (' + fmtNumber(r.evt, 3) + ' evt/guest-day)').join(', ')
          : 'Data not available';
        return (
          '<tr><td><b>' +
          escMgmt(s.label) +
          '</b></td><td class="right">' +
          (s.total > 0 ? fmtNumber(s.total, 3) : '—') +
          '</td><td>' +
          tops +
          '</td></tr>'
        );
      })
      .join('');

    const smartlerTable = smartlerRows
      .map(function (s) {
        const tops = s.top.length
          ? s.top.map((r) => escMgmt(r.label) + ' (' + fmtNumber(r.value, 2) + ')').join(', ')
          : 'Data not available';
        return (
          '<tr><td><b>' +
          escMgmt(s.label) +
          '</b></td><td class="right">' +
          (s.total > 0 ? fmtNumber(s.total, 2) : '—') +
          '</td><td>' +
          tops +
          '</td></tr>'
        );
      })
      .join('');

    const mixSpread = Math.max(...sites.map((x) => x.mixOtt)) - Math.min(...sites.map((x) => x.mixOtt));
    const keyDiff =
      mixSpread > 15
        ? 'OTT share differs by up to ' + fmtNumber(mixSpread, 1) + ' percentage points across sites.'
        : 'Total usage gap of ' + fmtNumber(gap, 1) + ' min/guest-day is the main difference between the highest and lowest site.';

    const lowGap =
      lowOverall.s.ottMin <= lowOverall.s.dthMin && lowOverall.s.ottMin <= lowOverall.s.castMin
        ? 'OTT adoption'
        : lowOverall.s.dthMin <= lowOverall.s.castMin
          ? 'DTH viewing'
          : 'Casting adoption';

    const kpiHeader = kpiHead
      .map(function (h) {
        return '<th class="' + (h === 'Site' ? '' : 'right') + '">' + escMgmt(h) + '</th>';
      })
      .join('');

    el.innerHTML =
      '<div class="mgmt-section"><h3>1. Executive Summary</h3>' +
      '<p>This report compares the selected properties for <b>' +
      escMgmt(period.label || 'the month') +
      '</b>. All figures use the same guest-day basis as the Compare Sites dashboard (one guest per occupied room-day).</p>' +
      '<ul>' +
      siteList +
      '</ul>' +
      '<div class="mgmt-callout"><p><b>Highest total entertainment usage:</b> ' +
      escMgmt(best.label) +
      ' (' +
      fmtNumber(best.totalMin, 1) +
      ' min/guest-day).</p><p><b>Lowest usage:</b> ' +
      escMgmt(worst.label) +
      ' (' +
      fmtNumber(worst.totalMin, 1) +
      ' min/guest-day).</p><p><b>Key difference:</b> ' +
      escMgmt(keyDiff) +
      '</p></div></div>' +
      '<div class="mgmt-section"><h3>2. Site-wise KPI Comparison</h3>' +
      '<table class="mgmt-table"><thead><tr>' +
      kpiHeader +
      '</tr></thead><tbody>' +
      kpiRows +
      '</tbody></table></div>' +
      '<div class="mgmt-section"><h3>3. Weekday vs Weekend Comparison</h3>' +
      '<table class="mgmt-table"><thead><tr><th>Site</th><th class="right">Weekday duration (min/guest-day)</th><th class="right">Weekend duration (min/guest-day)</th><th class="right">Weekday sessions</th><th class="right">Weekend sessions</th><th>More active on</th><th class="right">Weekend uplift</th></tr></thead><tbody>' +
      weekdayTable +
      '</tbody></table><p class="mgmt-muted">Weekend uplift = (weekend duration − weekday duration) ÷ weekday duration. Strongest weekend uplift: <b>' +
      escMgmt(weekendUpliftLead.label) +
      '</b>. Most stable day-to-day usage: <b>' +
      escMgmt(stabilityLead.label) +
      '</b>.</p></div>' +
      '<div class="mgmt-section"><h3>4. Usage Mix Analysis</h3>' +
      '<table class="mgmt-table"><thead><tr><th>Site</th><th class="right">OTT share</th><th class="right">DTH share</th><th class="right">Casting share</th><th>Guest behaviour style</th></tr></thead><tbody>' +
      mixTable +
      '</tbody></table><p>Most OTT-led: <b>' +
      escMgmt(mixOttLead.label) +
      '</b>. Highest DTH dependency: <b>' +
      escMgmt(mixDthLead.label) +
      '</b>. Strongest Casting adoption: <b>' +
      escMgmt(mixCastLead.label) +
      '</b>.</p></div>' +
      '<div class="mgmt-section"><h3>5. Daily Trend Comparison</h3>' +
      '<table class="mgmt-table"><thead><tr><th>Site</th><th class="right">Avg daily total (min/guest-day)</th><th class="right">Lowest day</th><th class="right">Highest day</th><th>Pattern</th><th>Peak date</th></tr></thead><tbody>' +
      dailyTable +
      '</tbody></table><p>Average daily leader: <b>' +
      escMgmt(dailyLead.label) +
      '</b> (' +
      fmtNumber(dailyLead.avg, 1) +
      ' min/guest-day).</p></div>' +
      '<div class="mgmt-section"><h3>6. OTT App Comparison</h3>' +
      '<table class="mgmt-table"><thead><tr><th>Site</th><th class="right">OTT min/guest-day</th><th>Top OTT apps (min/guest-day)</th></tr></thead><tbody>' +
      ottTable +
      '</tbody></table><p>Strongest OTT engagement: <b>' +
      escMgmt(ottLead.label) +
      '</b>. Lowest among selection: <b>' +
      escMgmt(ottLow.label) +
      '</b>.</p></div>' +
      '<div class="mgmt-section"><h3>7. DTH Channel Comparison</h3>' +
      '<table class="mgmt-table"><thead><tr><th>Site</th><th class="right">DTH min/guest-day</th><th class="right">DTH share</th><th>Top DTH channels (min/guest-day)</th></tr></thead><tbody>' +
      dthTable +
      '</tbody></table><p>Highest DTH usage: <b>' +
      escMgmt(dthLead.label) +
      '</b>.</p></div>' +
      '<div class="mgmt-section"><h3>8. Casting App Comparison</h3>' +
      '<table class="mgmt-table"><thead><tr><th>Site</th><th class="right">Casting min/guest-day</th><th>Top Casting apps (min/guest-day)</th></tr></thead><tbody>' +
      castTable +
      '</tbody></table><p>Highest Casting adoption: <b>' +
      escMgmt(castLead.label) +
      '</b>. Lowest: <b>' +
      escMgmt(castLow.label) +
      '</b>.</p></div>' +
      '<div class="mgmt-section"><h3>9. CMS Video / TV Module Comparison</h3>' +
      (cmsRows.some((r) => r.total > 0)
        ? '<table class="mgmt-table"><thead><tr><th>Site</th><th class="right">CMS events/guest-day (top items)</th><th>Top CMS videos / modules</th></tr></thead><tbody>' +
          cmsTable +
          '</tbody></table><p>Strongest in-room content engagement: <b>' +
          escMgmt(cmsLead.label) +
          '</b>.</p>'
        : '<p>Data not available for CMS video / TV modules for the selected sites in this comparison.</p>') +
      '</div>' +
      '<div class="mgmt-section"><h3>10. Smart Room / Automation Comparison</h3>' +
      (smartlerRows.some((r) => r.total > 0)
        ? '<table class="mgmt-table"><thead><tr><th>Site</th><th class="right">Automation events/guest-day</th><th>Top categories</th></tr></thead><tbody>' +
          smartlerTable +
          '</tbody></table><p>Strongest automation interaction: <b>' +
          escMgmt(smartlerLead.label) +
          '</b>.</p>'
        : '<p>Data not available for Smartler / room automation for the selected sites in this comparison.</p>') +
      '</div>' +
      '<div class="mgmt-section"><h3>11. Best Performing Site</h3>' +
      '<p><b>' +
      escMgmt(bestOverall.label) +
      '</b> ranks best overall among the selected sites based on total minutes per guest-day, session intensity, balanced OTT/DTH/Casting mix, weekday/weekend performance, and day-to-day consistency.</p>' +
      '<ul><li>Total usage: ' +
      fmtNumber(bestOverall.s.totalMin, 1) +
      ' min/guest-day</li><li>Sessions: ' +
      fmtNumber(bestOverall.s.totalSess, 2) +
      ' per guest-day</li><li>Mix — OTT ' +
      fmtNumber(bestOverall.s.mixOtt, 1) +
      '% · DTH ' +
      fmtNumber(bestOverall.s.mixDth, 1) +
      '% · Casting ' +
      fmtNumber(bestOverall.s.mixCast, 1) +
      '%</li></ul></div>' +
      '<div class="mgmt-section"><h3>12. Lowest Performing Site</h3>' +
      '<p><b>' +
      escMgmt(lowOverall.label) +
      '</b> is lowest overall among the selected sites.</p><ul><li>Total usage: ' +
      fmtNumber(lowOverall.s.totalMin, 1) +
      ' min/guest-day vs leader ' +
      fmtNumber(bestOverall.s.totalMin, 1) +
      '</li><li>OTT: ' +
      fmtNumber(lowOverall.s.ottMin, 1) +
      ' min/guest-day · DTH: ' +
      fmtNumber(lowOverall.s.dthMin, 1) +
      ' · Casting: ' +
      fmtNumber(lowOverall.s.castMin, 1) +
      '</li><li>Primary gap: ' +
      lowGap +
      ' and overall guest engagement.</li></ul></div>' +
      '<div class="mgmt-section"><h3>13. Key Insights</h3><ul>' +
      insights.map((t) => '<li>' + t + '</li>').join('') +
      '</ul></div>' +
      '<div class="mgmt-section"><h3>14. Recommendations</h3>' +
      siteRecHtml +
      '</div>' +
      '<div class="mgmt-section"><h3>15. Final Conclusion</h3>' +
      '<p><b>' +
      escMgmt(bestOverall.label) +
      '</b> is leading among the sites compared. <b>' +
      escMgmt(lowOverall.label) +
      '</b> needs the most attention next month—focus on lifting overall guest-day usage and the weakest entertainment category. Hotel teams should align in-room promotion, channel/app visibility, and Casting guidance with the patterns shown in sections 4–8.</p>' +
      '<p class="mgmt-muted">IRD revenue is excluded from this report. Source: Compare Sites dashboard data only.</p></div>';

    
  }
