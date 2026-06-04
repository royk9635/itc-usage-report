'use strict';

const { round, isWeekend } = require('./utils');

const TIME_OF_DAY_LABELS = ['Midnight', 'Morning', 'Afternoon', 'Night'];

function mapAppsToRows(map, guestDays, field = 'hr') {
  return [...map.entries()]
    .map(([name, v]) => {
      const total_hr = field === 'hr' ? v.total_hr : 0;
      const total_events = v.total_events || 0;
      return {
        name,
        weekday_hr: round(v.weekday_hr, 2),
        weekend_hr: round(v.weekend_hr, 2),
        total_hr: round(total_hr, 2),
        min_per_guest: guestDays ? round((total_hr * 60) / guestDays, 2) : 0,
        total_events,
        events_per_guest: guestDays ? round(total_events / guestDays, 3) : 0,
      };
    })
    .sort((a, b) => (b.total_hr || b.total_events) - (a.total_hr || a.total_events));
}

function buildTotalsFromDays(daysMap, dates) {
  let guest_days = 0, available_room_days = 0;
  let ott_hr = 0, dth_hr = 0, casting_hr = 0;
  let ott_sess = 0, dth_sess = 0, casting_sess = 0;
  let wd = { gd: 0, ott: 0, dth: 0, cast: 0, os: 0, ds: 0, cs: 0 };
  let we = { gd: 0, ott: 0, dth: 0, cast: 0, os: 0, ds: 0, cs: 0 };

  const daily = dates.map(date => {
    const d = daysMap.get(date) || {};
    const gd = Number(d.guest_days || 0);
    const av = Number(d.available_room_days || 0);
    const ohr = (d.ott_sec || 0) / 3600;
    const dhr = (d.dth_sec || 0) / 3600;
    const chr = (d.casting_sec || 0) / 3600;
    const os = Number(d.ott_sess || 0);
    const ds = Number(d.dth_sess || 0);
    const cs = Number(d.casting_sess || 0);
    guest_days += gd;
    available_room_days += av;
    ott_hr += ohr;
    dth_hr += dhr;
    casting_hr += chr;
    ott_sess += os;
    dth_sess += ds;
    casting_sess += cs;
    const bucket = isWeekend(date) ? we : wd;
    bucket.gd += gd;
    bucket.ott += ohr;
    bucket.dth += dhr;
    bucket.cast += chr;
    bucket.os += os;
    bucket.ds += ds;
    bucket.cs += cs;
    const ott_min = gd ? (ohr * 60) / gd : 0;
    const dth_min = gd ? (dhr * 60) / gd : 0;
    const cast_min = gd ? (chr * 60) / gd : 0;
    return {
      date,
      guest_days: gd,
      available_room_days: av,
      ott_min_per_guest: round(ott_min, 2),
      dth_min_per_guest: round(dth_min, 2),
      casting_min_per_guest: round(cast_min, 2),
      total_min_per_guest: round(ott_min + dth_min + cast_min, 2),
      ott_sess_per_guest: gd ? round(os / gd, 3) : 0,
      dth_sess_per_guest: gd ? round(ds / gd, 3) : 0,
      casting_sess_per_guest: gd ? round(cs / gd, 3) : 0,
      total_sess_per_guest: gd ? round((os + ds + cs) / gd, 3) : 0,
    };
  });

  const total_hr = ott_hr + dth_hr + casting_hr;
  const mix = {
    OTT: total_hr ? ott_hr / total_hr : 0,
    DTH: total_hr ? dth_hr / total_hr : 0,
    Casting: total_hr ? casting_hr / total_hr : 0,
  };

  function dayTypeBlock(b) {
    const th = b.ott + b.dth + b.cast;
    const m = {
      OTT: th ? b.ott / th : 0,
      DTH: th ? b.dth / th : 0,
      Casting: th ? b.cast / th : 0,
    };
    return {
      guest_days: b.gd,
      available_room_days: 0,
      occupied_share: available_room_days ? b.gd / available_room_days : 0,
      dur_min_per_guest: {
        OTT: b.gd ? round((b.ott * 60) / b.gd, 2) : 0,
        DTH: b.gd ? round((b.dth * 60) / b.gd, 2) : 0,
        Casting: b.gd ? round((b.cast * 60) / b.gd, 2) : 0,
        Total: b.gd ? round((th * 60) / b.gd, 2) : 0,
      },
      sess_per_guest: {
        OTT: b.gd ? round(b.os / b.gd, 3) : 0,
        DTH: b.gd ? round(b.ds / b.gd, 3) : 0,
        Casting: b.gd ? round(b.cs / b.gd, 3) : 0,
        Total: b.gd ? round((b.os + b.ds + b.cs) / b.gd, 3) : 0,
      },
      mix: m,
      raw_totals: {
        ott_hr: round(b.ott, 2),
        dth_hr: round(b.dth, 2),
        casting_hr: round(b.cast, 2),
        ott_sess: b.os,
        dth_sess: b.ds,
        casting_sess: b.cs,
        total_hr: round(th, 2),
        total_sess: b.os + b.ds + b.cs,
      },
    };
  }

  const totals = {
    guest_days,
    available_room_days,
    occupied_share: available_room_days ? guest_days / available_room_days : 0,
    dur_min_per_guest: {
      OTT: guest_days ? round((ott_hr * 60) / guest_days, 2) : 0,
      DTH: guest_days ? round((dth_hr * 60) / guest_days, 2) : 0,
      Casting: guest_days ? round((casting_hr * 60) / guest_days, 2) : 0,
      Total: guest_days ? round((total_hr * 60) / guest_days, 2) : 0,
    },
    sess_per_guest: {
      OTT: guest_days ? round(ott_sess / guest_days, 3) : 0,
      DTH: guest_days ? round(dth_sess / guest_days, 3) : 0,
      Casting: guest_days ? round(casting_sess / guest_days, 3) : 0,
      Total: guest_days ? round((ott_sess + dth_sess + casting_sess) / guest_days, 3) : 0,
    },
    mix,
    avg_min_per_session: (ott_sess + dth_sess + casting_sess)
      ? round((total_hr * 60) / (ott_sess + dth_sess + casting_sess), 2) : 0,
    raw_totals: {
      ott_hr: round(ott_hr, 2),
      dth_hr: round(dth_hr, 2),
      casting_hr: round(casting_hr, 2),
      ott_sess,
      dth_sess,
      casting_sess,
      total_hr: round(total_hr, 2),
      total_sess: ott_sess + dth_sess + casting_sess,
    },
  };

  return { daily, totals, day_type: { Weekday: dayTypeBlock(wd), Weekend: dayTypeBlock(we) } };
}

function buildTimeOfDay(daysMap) {
  const watchSec = [0, 0, 0, 0];
  const sessions = [0, 0, 0, 0];
  for (const d of daysMap.values()) {
    const tod = d.time_of_day || {};
    (tod.watch_sec || []).forEach((v, i) => { watchSec[i] += Number(v || 0); });
    (tod.session_starts || []).forEach((v, i) => { sessions[i] += Number(v || 0); });
  }
  return {
    labels: TIME_OF_DAY_LABELS,
    watch_hours: watchSec.map(v => round(v / 3600, 2)),
    session_starts: sessions.map(v => Math.round(Number(v || 0))),
  };
}

function mergeDayMaps(maps, dates) {
  const merged = new Map();
  for (const date of dates) {
    const acc = {
      guest_days: 0, available_room_days: 0,
      ott_sec: 0, dth_sec: 0, casting_sec: 0,
      ott_sess: 0, dth_sess: 0, casting_sess: 0,
      smartler_events: 0, mobile_events: 0,
      ott_apps: new Map(), dth_channels: new Map(), casting_apps: new Map(),
      tv_modules: new Map(), cms_videos: new Map(), mobile_items: new Map(),
      smartler_components: new Map(),
      time_of_day: {
        watch_sec: [0, 0, 0, 0],
        session_starts: [0, 0, 0, 0],
      },
    };
    for (const dm of maps) {
      const d = dm.get(date);
      if (!d) continue;
      acc.guest_days += d.guest_days || 0;
      acc.available_room_days += d.available_room_days || 0;
      acc.ott_sec += d.ott_sec || 0;
      acc.dth_sec += d.dth_sec || 0;
      acc.casting_sec += d.casting_sec || 0;
      acc.ott_sess += d.ott_sess || 0;
      acc.dth_sess += d.dth_sess || 0;
      acc.casting_sess += d.casting_sess || 0;
      acc.smartler_events += d.smartler_events || 0;
      acc.mobile_events += d.mobile_events || 0;
      const tod = d.time_of_day || {};
      (tod.watch_sec || []).forEach((v, i) => { acc.time_of_day.watch_sec[i] += Number(v || 0); });
      (tod.session_starts || []).forEach((v, i) => { acc.time_of_day.session_starts[i] += Number(v || 0); });
      mergeMapInto(acc.ott_apps, d.ott_apps);
      mergeMapInto(acc.dth_channels, d.dth_channels);
      mergeMapInto(acc.casting_apps, d.casting_apps);
      mergeMapInto(acc.tv_modules, d.tv_modules);
      mergeMapInto(acc.cms_videos, d.cms_videos);
      mergeMapInto(acc.mobile_items, d.mobile_items);
      mergeMapInto(acc.smartler_components, d.smartler_components);
    }
    merged.set(date, acc);
  }
  return merged;
}

function mergeMapInto(target, source) {
  if (!source) return;
  for (const [k, v] of source.entries()) {
    if (!target.has(k)) target.set(k, { weekday_hr: 0, weekend_hr: 0, total_hr: 0, weekday_events: 0, weekend_events: 0, total_events: 0, weekday_sess: 0, weekend_sess: 0, total_sess: 0 });
    const t = target.get(k);
    t.weekday_hr += v.weekday_hr || 0;
    t.weekend_hr += v.weekend_hr || 0;
    t.total_hr += v.total_hr || 0;
    t.weekday_events += v.weekday_events || 0;
    t.weekend_events += v.weekend_events || 0;
    t.total_events += v.total_events || 0;
    t.weekday_sess += v.weekday_sess || 0;
    t.weekend_sess += v.weekend_sess || 0;
    t.total_sess += v.total_sess || 0;
  }
}

function buildSelection(site, dates) {
  const { daily, totals, day_type } = buildTotalsFromDays(site.days, dates);
  const gd = totals.guest_days || 0;
  const smartlerItems = mapAppsToRows(mergeMaps(site.days, 'smartler_components'), gd, 'events')
    .slice(0, 20)
    .map(r => ({ name: r.name, total_events: r.total_events, events_per_guest_day: r.events_per_guest, occupied_room_days: gd }));

  return {
    id: site.id,
    brand: site.brand,
    name: site.name,
    totals,
    daily,
    day_type,
    time_of_day: buildTimeOfDay(site.days),
    ott_apps: mapAppsToRows(mergeMaps(site.days, 'ott_apps'), gd).slice(0, 20),
    dth_channels: mapAppsToRows(mergeMaps(site.days, 'dth_channels'), gd).slice(0, 20),
    casting_apps: mapAppsToRows(mergeMaps(site.days, 'casting_apps'), gd).slice(0, 20),
    tv_modules: mapModules(mergeMaps(site.days, 'tv_modules'), gd).slice(0, 20),
    cms_videos: mapModules(mergeMaps(site.days, 'cms_videos'), gd).slice(0, 20),
    mobile_interactions: mapModules(mergeMaps(site.days, 'mobile_items'), gd).slice(0, 20),
    smartler: buildSmartlerSummary(site, gd),
    smartler_items: smartlerItems,
    smartler_items_meta: {
      basis: 'Smartler events ÷ occupied room-days',
      occupied_room_days: gd,
      total_smartler_events: smartlerItems.reduce((a, x) => a + (x.total_events || 0), 0),
    },
  };
}

function mergeMaps(days, key) {
  const out = new Map();
  for (const d of days.values()) {
    for (const [k, v] of (d[key] || new Map()).entries()) {
      if (!out.has(k)) out.set(k, { weekday_hr: 0, weekend_hr: 0, total_hr: 0, weekday_events: 0, weekend_events: 0, total_events: 0, weekday_sess: 0, weekend_sess: 0, total_sess: 0 });
      const t = out.get(k);
      t.weekday_hr += v.weekday_hr || 0;
      t.weekend_hr += v.weekend_hr || 0;
      t.total_hr += v.total_hr || 0;
      t.weekday_events += v.weekday_events || 0;
      t.weekend_events += v.weekend_events || 0;
      t.total_events += v.total_events || 0;
      t.weekday_sess += v.weekday_sess || 0;
      t.weekend_sess += v.weekend_sess || 0;
      t.total_sess += v.total_sess || 0;
    }
  }
  return out;
}

function mapModules(map, guestDays) {
  return [...map.entries()]
    .map(([name, v]) => {
      const events_per_guest_day = guestDays ? round(v.total_events / guestDays, 3) : 0;
      return {
        name,
        key: name,
        weekday_events: v.weekday_events || 0,
        weekend_events: v.weekend_events || 0,
        total_events: v.total_events || 0,
        events_per_guest: events_per_guest_day,
        events_per_guest_day,
      };
    })
    .sort((a, b) => b.total_events - a.total_events);
}

function buildSmartlerSummary(site, gd) {
  const comps = mergeMaps(site.days, 'smartler_components');
  const categories = [...comps.keys()].slice(0, 8);
  const events_per_guest_day = categories.map(k => gd ? round((comps.get(k).total_events || 0) / gd, 3) : 0);
  const total_events = categories.map(k => comps.get(k).total_events || 0);
  const top = [...comps.entries()]
    .map(([name, v]) => ({ name, total_events: v.total_events, events_per_guest_day: gd ? round(v.total_events / gd, 3) : 0 }))
    .sort((a, b) => b.total_events - a.total_events)
    .slice(0, 5);
  return { categories, events_per_guest_day, total_events, top };
}

function buildReportData(agg, monthKey, monthLabel) {
  const { sites, dates, period } = agg;
  const siteList = [{ id: 'ALL', brand: 'All', name: 'All Sites (Combined)' }];
  const selections = {};
  const siteArr = [...sites.values()].sort((a, b) => a.name.localeCompare(b.name));

  for (const s of siteArr) {
    siteList.push({ id: s.id, brand: s.brand, name: s.name });
    selections[s.id] = buildSelection(s, dates);
  }

  const allDays = mergeDayMaps(siteArr.map(s => s.days), dates);
  const allSite = { id: 'ALL', brand: 'All', name: 'All Sites (Combined)', days: allDays };
  selections.ALL = buildSelection(allSite, dates);

  const top_sites = siteArr.map(s => {
    const t = selections[s.id].totals;
    return {
      name: s.name,
      brand: s.brand,
      avg_total_min_per_guest: t.dur_min_per_guest.Total,
      avg_ott_min_per_guest: t.dur_min_per_guest.OTT,
      avg_dth_min_per_guest: t.dur_min_per_guest.DTH,
      avg_casting_min_per_guest: t.dur_min_per_guest.Casting,
      avg_sessions_per_guest: t.sess_per_guest.Total,
      occupied_share: t.occupied_share,
      guest_days: t.guest_days,
    };
  }).sort((a, b) => b.avg_total_min_per_guest - a.avg_total_min_per_guest);

  return {
    [monthKey]: {
      period: { label: monthLabel, start: period.start, end: period.end },
      site_list: siteList,
      top_sites,
      selections,
    },
  };
}

function buildRawDaily(agg, monthKey) {
  const { sites, dates } = agg;
  const all = {};
  const siteOut = {};
  const brandOut = {};

  for (const date of dates) {
    let a = { guest_days: 0, ott_hr: 0, dth_hr: 0, casting_hr: 0 };
    for (const site of sites.values()) {
      const d = site.days.get(date);
      if (!d) continue;
      const row = {
        guest_days: d.guest_days,
        ott_hr: round(d.ott_sec / 3600, 4),
        dth_hr: round(d.dth_sec / 3600, 4),
        casting_hr: round(d.casting_sec / 3600, 4),
      };
      if (!siteOut[site.id]) siteOut[site.id] = { dates: {} };
      siteOut[site.id].dates[date] = row;
      a.guest_days += row.guest_days;
      a.ott_hr += row.ott_hr;
      a.dth_hr += row.dth_hr;
      a.casting_hr += row.casting_hr;
      if (!brandOut[site.brand]) brandOut[site.brand] = {};
      if (!brandOut[site.brand][date]) brandOut[site.brand][date] = { guest_days: 0, ott_hr: 0, dth_hr: 0, casting_hr: 0 };
      const br = brandOut[site.brand][date];
      br.guest_days += row.guest_days;
      br.ott_hr += row.ott_hr;
      br.dth_hr += row.dth_hr;
      br.casting_hr += row.casting_hr;
    }
    all[date] = {
      guest_days: a.guest_days,
      ott_hr: round(a.ott_hr, 4),
      dth_hr: round(a.dth_hr, 4),
      casting_hr: round(a.casting_hr, 4),
    };
  }

  return { [monthKey]: { all, sites: siteOut, brands: brandOut } };
}

function buildEnhanced(agg, monthKey, options = {}) {
  const compactRoomActivity = options.compactRoomActivity === true;
  const { sites, dates, period, meta } = agg;
  const siteArr = [...sites.values()].sort((a, b) => a.name.localeCompare(b.name));
  const usageDaily = {};
  const dthChannelDaily = {};
  const roomActivity = {};
  const mobileBySite = {};
  const siteComparison = [];

  for (const site of siteArr) {
    usageDaily[site.id] = dates.map(date => {
      const d = site.days.get(date) || {};
      const gd = d.guest_days || 0;
      const ott = gd ? round(((d.ott_sec || 0) / 60) / gd, 2) : 0;
      const dth = gd ? round(((d.dth_sec || 0) / 60) / gd, 2) : 0;
      const casting = gd ? round(((d.casting_sec || 0) / 60) / gd, 2) : 0;
      return { date, ott, dth, casting, total: round(ott + dth + casting, 2) };
    });

    const chTotals = mergeMaps(site.days, 'dth_channels');
    const siteGuestDays = dates.reduce((a, d) => a + (site.days.get(d)?.guest_days || 0), 0);
    const channels = [...chTotals.entries()]
      .map(([name, v]) => {
        const totalMin = (v.total_hr || 0) * 60;
        return {
          name,
          total_hr: round(v.total_hr, 2),
          total_min: round(totalMin, 2),
          min_per_occupied_room_day: siteGuestDays ? round(totalMin / siteGuestDays, 2) : 0,
          sessions: v.total_sess || 0,
        };
      })
      .sort((a, b) => b.min_per_occupied_room_day - a.min_per_occupied_room_day)
      .slice(0, 30);
    const series = {};
    for (const [name, byDate] of site.dthSeries.entries()) {
      series[name] = dates.map(date => {
        const pt = byDate.get(date) || { min: 0, hr: 0, sessions: 0 };
        const gd = site.days.get(date)?.guest_days || 0;
        const minTotal = Number(pt.min || 0);
        return {
          date,
          guest_days: gd,
          min_total: round(minTotal, 2),
          min: gd ? round(minTotal / gd, 2) : 0,
          hr: round(pt.hr, 2),
          sessions: pt.sessions || 0,
        };
      });
    }
    dthChannelDaily[site.id] = { channels, series };

    const data = {};
    const summary = {};
    for (const [room, byDate] of site.roomData.entries()) {
      if (compactRoomActivity) {
        let events = 0;
        let minutes = 0;
        const categories = {};
        for (const rows of byDate.values()) {
          for (const row of rows) {
            events += Number(row.n || 0);
            minutes += Number(row.m || 0);
            const cat = row.c || 'Other';
            categories[cat] = (categories[cat] || 0) + Number(row.n || 0);
          }
        }
        summary[room] = { events, minutes: round(minutes, 2), categories };
        continue;
      }
      data[room] = {};
      for (const [date, rows] of byDate.entries()) data[room][date] = rows;
    }
    roomActivity[site.id] = compactRoomActivity
      ? {
          rooms: [...site.rooms].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })),
          compact: true,
          summary,
        }
      : {
          rooms: [...site.rooms].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })),
          data,
        };

    let totalMobile = 0;
    let occDays = 0;
    const itemMap = mergeMaps(site.days, 'mobile_items');
    for (const d of site.days.values()) {
      totalMobile += d.mobile_events || 0;
      occDays += d.guest_days || 0;
    }
    mobileBySite[site.id] = {
      site_id: site.id,
      site_name: site.name,
      occupied_room_days: occDays,
      total_events: totalMobile,
      events_per_guest_day: occDays ? round(totalMobile / occDays, 3) : 0,
      items: mapModules(itemMap, occDays).slice(0, 15),
    };
    siteComparison.push({
      site_id: site.id,
      site_name: site.name,
      occupied_room_days: occDays,
      total_events: totalMobile,
      events_per_guest_day: occDays ? round(totalMobile / occDays, 3) : 0,
    });
  }

  // ALL usageDaily
  const allDays = mergeDayMaps(siteArr.map(s => s.days), dates);
  const allFake = { days: allDays, id: 'ALL' };
  usageDaily.ALL = dates.map(date => {
    const d = allDays.get(date) || {};
    const gd = d.guest_days || 0;
    const ott = gd ? round(((d.ott_sec || 0) / 60) / gd, 2) : 0;
    const dth = gd ? round(((d.dth_sec || 0) / 60) / gd, 2) : 0;
    const casting = gd ? round(((d.casting_sec || 0) / 60) / gd, 2) : 0;
    return { date, ott, dth, casting, total: round(ott + dth + casting, 2) };
  });

  // ALL DTH channels — sum minutes per channel, divide by combined occupied room-days per day
  const allCh = new Map();
  const allSeriesAcc = new Map();
  for (const site of siteArr) {
    for (const [name, v] of mergeMaps(site.days, 'dth_channels').entries()) {
      if (!allCh.has(name)) allCh.set(name, { total_hr: 0, total_sess: 0 });
      const t = allCh.get(name);
      t.total_hr += v.total_hr;
      t.total_sess += v.total_sess;
    }
    for (const [name, byDate] of site.dthSeries.entries()) {
      if (!allSeriesAcc.has(name)) allSeriesAcc.set(name, new Map());
      const dm = allSeriesAcc.get(name);
      for (const [date, pt] of byDate.entries()) {
        if (!dm.has(date)) dm.set(date, { min: 0, hr: 0, sessions: 0 });
        const acc = dm.get(date);
        acc.min += Number(pt.min || 0);
        acc.hr += Number(pt.hr || 0);
        acc.sessions += Number(pt.sessions || 0);
      }
    }
  }
  const allGuestDays = dates.reduce((a, d) => a + (allDays.get(d)?.guest_days || 0), 0);
  const allChannels = [...allCh.entries()]
    .map(([name, v]) => {
      const totalMin = (v.total_hr || 0) * 60;
      return {
        name,
        total_hr: round(v.total_hr, 2),
        total_min: round(totalMin, 2),
        min_per_occupied_room_day: allGuestDays ? round(totalMin / allGuestDays, 2) : 0,
        sessions: v.total_sess || 0,
      };
    })
    .sort((a, b) => b.min_per_occupied_room_day - a.min_per_occupied_room_day)
    .slice(0, 30);
  const allSeries = {};
  for (const [name, byDate] of allSeriesAcc.entries()) {
    allSeries[name] = dates.map(date => {
      const pt = byDate.get(date) || { min: 0, hr: 0, sessions: 0 };
      const gd = allDays.get(date)?.guest_days || 0;
      const minTotal = Number(pt.min || 0);
      return {
        date,
        guest_days: gd,
        min_total: round(minTotal, 2),
        min: gd ? round(minTotal / gd, 2) : 0,
        hr: round(pt.hr, 2),
        sessions: pt.sessions || 0,
      };
    });
  }
  dthChannelDaily.ALL = { channels: allChannels, series: allSeries };

  siteComparison.sort((a, b) => b.events_per_guest_day - a.events_per_guest_day);
  const allOcc = siteComparison.reduce((a, x) => a + x.occupied_room_days, 0);
  const allEv = siteComparison.reduce((a, x) => a + x.total_events, 0);
  siteComparison.unshift({
    site_id: 'ALL',
    site_name: 'All Sites (Combined)',
    occupied_room_days: allOcc,
    total_events: allEv,
    events_per_guest_day: allOcc ? round(allEv / allOcc, 3) : 0,
  });

  const allItemMap = mergeMaps(allDays, 'mobile_items');
  let allMobileEv = 0;
  let allMobileOcc = 0;
  for (const d of allDays.values()) {
    allMobileEv += d.mobile_events || 0;
    allMobileOcc += d.guest_days || 0;
  }
  mobileBySite.ALL = {
    site_id: 'ALL',
    site_name: 'All Sites (Combined)',
    occupied_room_days: allMobileOcc,
    total_events: allMobileEv,
    events_per_guest_day: allMobileOcc ? round(allMobileEv / allMobileOcc, 3) : 0,
    items: mapModules(allItemMap, allMobileOcc).slice(0, 15),
  };

  return {
    period: { key: monthKey, start: period.start, end: period.end, dates },
    sites: siteArr.map(s => ({ id: s.id, brand: s.brand, name: s.name })),
    usageDaily,
    dthChannelDaily,
    roomActivity,
    mobileUsage: {
      metric_note: 'Mobile Usage Data excludes Home Screen and Guest Message. Events are divided by occupied room-days (one guest per occupied room per day).',
      siteComparison,
      bySite: mobileBySite,
    },
    meta: {
      processed_rows: meta.processed_rows,
      room_activity_grouping: 'DTH is only TV_CHANNEL_STREAM channel watch data. MOBILE_DTH/IPTV, IRD, SPA, LAUNDRY, CMS, VIEWBILL, WEBRADIO, VIDEO and GUEST_MESSAGE are grouped separately as Mobile Usage Data. Mobile rows store menu code in itemSpec (s) and a friendly activity label in item summary (i).',
      mobile_usage_metric: 'Mobile Usage Data is calculated as total Mobile Usage Data events divided by occupied room-days, assuming one guest per occupied room per day.',
    },
  };
}

module.exports = { buildReportData, buildRawDaily, buildEnhanced };
