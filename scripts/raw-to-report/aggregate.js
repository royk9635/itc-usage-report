'use strict';

const { brandFromGroup, isWeekend, isMobileMenu, castingDateToISO, round, mobileActivityItemLabel } = require('./utils');

function initDay() {
  return {
    guest_days: 0,
    available_room_days: 0,
    ott_sec: 0,
    dth_sec: 0,
    casting_sec: 0,
    ott_sess: 0,
    dth_sess: 0,
    casting_sess: 0,
    smartler_events: 0,
    mobile_events: 0,
    ott_apps: new Map(),
    dth_channels: new Map(),
    casting_apps: new Map(),
    tv_modules: new Map(),
    cms_videos: new Map(),
    mobile_items: new Map(),
    smartler_components: new Map(),
    time_of_day: {
      watch_sec: [0, 0, 0, 0],
      session_starts: [0, 0, 0, 0],
    },
  };
}

function initSite(id, brand, name) {
  return {
    id, brand, name,
    days: new Map(),
    rooms: new Set(),
    roomData: new Map(),
    dthSeries: new Map(),
  };
}

function bumpMap(map, key, field, amount, weekend) {
  if (!key) return;
  let row = map.get(key);
  if (!row) {
    row = { weekday_hr: 0, weekend_hr: 0, total_hr: 0, weekday_events: 0, weekend_events: 0, total_events: 0, weekday_sess: 0, weekend_sess: 0, total_sess: 0 };
    map.set(key, row);
  }
  const wk = weekend ? 'weekend' : 'weekday';
  if (field === 'hr') {
    row[`${wk}_hr`] += amount;
    row.total_hr += amount;
  } else if (field === 'events') {
    row[`${wk}_events`] += amount;
    row.total_events += amount;
  } else if (field === 'sess') {
    row[`${wk}_sess`] += amount;
    row.total_sess += amount;
  }
}

function addRoomActivity(site, room, date, category, detail, source, count, minutes) {
  const r = String(room);
  if (!r) return;
  site.rooms.add(r);
  if (!site.roomData.has(r)) site.roomData.set(r, new Map());
  const byDate = site.roomData.get(r);
  if (!byDate.has(date)) byDate.set(date, []);
  byDate.get(date).push({
    c: category,
    i: detail,
    s: source,
    n: Number(count || 0),
    m: Number(minutes || 0),
  });
}

function timeBucketIndex(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h) || h < 0 || h > 23) return -1;
  if (h < 6) return 0;
  if (h < 12) return 1;
  if (h < 18) return 2;
  return 3;
}

function parseStreamHours(value) {
  const text = String(value || '');
  const out = [];
  const re = /\b([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?/g;
  let m;
  while ((m = re.exec(text))) out.push(Number(m[1]));
  return out;
}

function addTimeOfDay(day, seconds, sessions, timeValue, fallbackHour) {
  if (!day || !day.time_of_day) return;
  let hours = parseStreamHours(timeValue);
  if (!hours.length && fallbackHour != null) hours = [Number(fallbackHour)];
  if (!hours.length) return;
  const secEach = Number(seconds || 0) / hours.length;
  const sessEach = Number(sessions || hours.length || 0) / hours.length;
  hours.forEach(hour => {
    const idx = timeBucketIndex(hour);
    if (idx < 0) return;
    day.time_of_day.watch_sec[idx] += secEach;
    day.time_of_day.session_starts[idx] += sessEach;
  });
}

function mergeMetricRow(into, from) {
  for (const k of [
    'weekday_hr', 'weekend_hr', 'total_hr',
    'weekday_events', 'weekend_events', 'total_events',
    'weekday_sess', 'weekend_sess', 'total_sess',
  ]) {
    into[k] = (into[k] || 0) + (from[k] || 0);
  }
}

function mergeNamedMaps(intoMap, fromMap) {
  for (const [key, fromRow] of fromMap) {
    if (!intoMap.has(key)) {
      intoMap.set(key, { ...fromRow });
      continue;
    }
    mergeMetricRow(intoMap.get(key), fromRow);
  }
}

function mergeDay(into, from) {
  into.guest_days += from.guest_days || 0;
  into.available_room_days += from.available_room_days || 0;
  into.ott_sec += from.ott_sec || 0;
  into.dth_sec += from.dth_sec || 0;
  into.casting_sec += from.casting_sec || 0;
  into.ott_sess += from.ott_sess || 0;
  into.dth_sess += from.dth_sess || 0;
  into.casting_sess += from.casting_sess || 0;
  into.smartler_events += from.smartler_events || 0;
  into.mobile_events += from.mobile_events || 0;
  mergeNamedMaps(into.ott_apps, from.ott_apps);
  mergeNamedMaps(into.dth_channels, from.dth_channels);
  mergeNamedMaps(into.casting_apps, from.casting_apps);
  mergeNamedMaps(into.tv_modules, from.tv_modules);
  mergeNamedMaps(into.cms_videos, from.cms_videos);
  mergeNamedMaps(into.mobile_items, from.mobile_items);
  mergeNamedMaps(into.smartler_components, from.smartler_components);
  for (let i = 0; i < 4; i++) {
    into.time_of_day.watch_sec[i] += from.time_of_day.watch_sec[i] || 0;
    into.time_of_day.session_starts[i] += from.time_of_day.session_starts[i] || 0;
  }
}

function mergeSite(into, from) {
  for (const [date, day] of from.days) {
    if (!into.days.has(date)) into.days.set(date, initDay());
    mergeDay(into.days.get(date), day);
  }
  for (const room of from.rooms) into.rooms.add(room);
  for (const [room, byDate] of from.roomData) {
    if (!into.roomData.has(room)) into.roomData.set(room, new Map());
    const intoByDate = into.roomData.get(room);
    for (const [date, rows] of byDate) {
      if (!intoByDate.has(date)) intoByDate.set(date, []);
      intoByDate.get(date).push(...rows);
    }
  }
  for (const [name, byDate] of from.dthSeries) {
    if (!into.dthSeries.has(name)) into.dthSeries.set(name, new Map());
    const intoSeries = into.dthSeries.get(name);
    for (const [date, pt] of byDate) {
      if (!intoSeries.has(date)) {
        intoSeries.set(date, { min: 0, hr: 0, sessions: 0 });
      }
      const intoPt = intoSeries.get(date);
      intoPt.min += pt.min || 0;
      intoPt.hr += pt.hr || 0;
      intoPt.sessions += pt.sessions || 0;
    }
  }
}

function mergeAggregates(a, b) {
  for (const [id, siteB] of b.sites) {
    let siteA = a.sites.get(id);
    if (!siteA) {
      siteA = initSite(id, siteB.brand, siteB.name);
      a.sites.set(id, siteA);
    }
    mergeSite(siteA, siteB);
  }
  const dateSet = new Set([...(a.dates || []), ...(b.dates || [])]);
  a.dates = [...dateSet].sort();
  a.meta = a.meta || { processed_rows: 0 };
  b.meta = b.meta || { processed_rows: 0 };
  a.meta.processed_rows = (a.meta.processed_rows || 0) + (b.meta.processed_rows || 0);
  a.period = a.dates.length
    ? { start: a.dates[0], end: a.dates[a.dates.length - 1] }
    : { start: null, end: null };
  return a;
}

function aggregateRawRows(rows) {
  const sites = new Map();
  const dates = new Set();
  let processed_rows = 0;

  function getSite(row) {
    const id = row.hotelName;
    if (!sites.has(id)) {
      sites.set(id, initSite(id, brandFromGroup(row.hotelGroup, row.hotelName), row.hotelName));
    }
    return sites.get(id);
  }

  function dayBucket(site, date) {
    dates.add(date);
    if (!site.days.has(date)) site.days.set(date, initDay());
    return site.days.get(date);
  }

  for (const row of rows) {
    processed_rows++;
    const site = getSite(row);
    const date = row.reportDate;
    const weekend = isWeekend(date);
    const ld = row.logData;

    if (row.reportName === 'ROOM_OCCUPANCY_SUMMARY' && ld && typeof ld === 'object' && !Array.isArray(ld)) {
      const dm = ld.dataMap || {};
      for (const v of Object.values(dm)) {
        const d = dayBucket(site, date);
        d.guest_days += Number(v.totalOccupancyDays || 0);
        d.available_room_days += Number(v.totalRoomDays || 0);
      }
      continue;
    }

    if (row.reportName === 'TV_APP_STREAM' && Array.isArray(ld)) {
      const d = dayBucket(site, date);
      for (const e of ld) {
        const sec = Number(e.duration || 0);
        const sess = Number(e.count || 0) || 1;
        const name = String(e.item || 'Unknown').trim();
        d.ott_sec += sec;
        d.ott_sess += sess;
        addTimeOfDay(d, sec, sess, e.time);
        bumpMap(d.ott_apps, name, 'hr', sec / 3600, weekend);
        bumpMap(d.ott_apps, name, 'sess', sess, weekend);
        addRoomActivity(site, e.room, date, 'OTT', `${name} (${sess})`, 'Top apps', sess, sec / 60);
      }
      continue;
    }

    if (row.reportName === 'TV_CHANNEL_STREAM' && Array.isArray(ld)) {
      const d = dayBucket(site, date);
      for (const e of ld) {
        const sec = Number(e.duration || 0);
        const sess = Number(e.count || 0) || 1;
        const name = String(e.item || 'Unknown').trim();
        d.dth_sec += sec;
        d.dth_sess += sess;
        addTimeOfDay(d, sec, sess, e.time);
        bumpMap(d.dth_channels, name, 'hr', sec / 3600, weekend);
        bumpMap(d.dth_channels, name, 'sess', sess, weekend);
        if (!site.dthSeries.has(name)) site.dthSeries.set(name, new Map());
        const ser = site.dthSeries.get(name);
        if (!ser.has(date)) ser.set(date, { min: 0, hr: 0, sessions: 0 });
        const pt = ser.get(date);
        pt.min += sec / 60;
        pt.hr += sec / 3600;
        pt.sessions += sess;
        addRoomActivity(site, e.room, date, 'DTH', name, 'Top channels', sess, sec / 60);
      }
      continue;
    }

    if (row.reportName === 'CASTING_DETAILS' && Array.isArray(ld)) {
      const d = dayBucket(site, date);
      for (const e of ld) {
        const sec = Number(e.duration || 0);
        const app = String(e.appName || 'Unknown').trim();
        const room = e.roomNumber;
        const castDate = castingDateToISO(e.castingDate) || date;
        const dCast = dayBucket(site, castDate);
        dCast.casting_sec += sec;
        dCast.casting_sess += 1;
        addTimeOfDay(dCast, sec, 1, null, new Date(Number(e.castingDate || 0)).getHours());
        bumpMap(dCast.casting_apps, app, 'hr', sec / 3600, isWeekend(castDate));
        bumpMap(dCast.casting_apps, app, 'sess', 1, isWeekend(castDate));
        addRoomActivity(site, room, castDate, 'Casting', `${app} (1)`, 'Top apps', 1, sec / 60);
      }
      continue;
    }

    if (row.reportName === 'SMARTLER_ACTIVITIES' && Array.isArray(ld)) {
      const d = dayBucket(site, date);
      for (const e of ld) {
        const cnt = Number(e.count || 0) || 1;
        d.smartler_events += cnt;
        const comp = `${e.component || 'ITEM'}-${e.operation || 'OP'}`;
        bumpMap(d.smartler_components, comp, 'events', cnt, weekend);
        const detail = `${e.component}-${e.operation} (${cnt})`;
        addRoomActivity(site, e.room, date, 'Smartler', detail, 'Smartler ItemSPEC counts', cnt, 0);
      }
      continue;
    }

    if (row.reportName === 'TV_ACTIVITIES' && Array.isArray(ld)) {
      const d = dayBucket(site, date);
      for (const e of ld) {
        const menu = String(e.menu || '').toUpperCase();
        const cnt = Number(e.count || 0) || 1;
        if (menu === 'GUEST_MESSAGE' || menu === 'HOME') continue;
        if (!isMobileMenu(menu)) continue;
        d.mobile_events += cnt;
        const label = menu;
        bumpMap(d.mobile_items, label, 'events', cnt, weekend);
        const item = mobileActivityItemLabel(e);
        addRoomActivity(site, e.room, date, 'Mobile Usage', item, menu, cnt, 0);
        if (menu === 'CMS') bumpMap(d.tv_modules, 'CMS', 'events', cnt, weekend);
        if (menu === 'VIDEO') bumpMap(d.cms_videos, item || 'Video', 'events', cnt, weekend);
      }
      continue;
    }
  }

  const sortedDates = [...dates].sort();
  const period = sortedDates.length
    ? { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] }
    : { start: null, end: null };

  return { sites, dates: sortedDates, period, meta: { processed_rows } };
}

module.exports = { aggregateRawRows, mergeAggregates, initDay };
