const fs = require('fs');
const p = 'e:/usage_report/ITC_HL_usage_Report_april_user_friendly_detailed_chatbot.html';
let h = fs.readFileSync(p, 'utf8');

const oldFn = `  function renderTable(rows){
    const tb = $('chatActivityTable')?.querySelector('tbody');
    if (!tb) return;
    const finalRows = tableRows(rows);
    if (!finalRows.length) {
      tb.innerHTML = \`<tr><td colspan="6"><div class="chatEmptyState">No detail rows match the current category/search filter.</div></td></tr>\`;
      return;
    }
    tb.innerHTML = finalRows.map(r => \`<tr><td>\${esc(r.date)}</td><td><span class="catPill">\${esc(CATEGORY_LABELS[r.c] || r.c)}</span></td><td>\${esc(r.i)}</td><td>\${esc(r.s || '--')}</td><td class="right">\${fi(r.n)}</td><td class="right">\${Number(r.m || 0) ? f(r.m,1) + ' min' : '--'}</td></tr>\`).join('');
  }`;

const newFn = `  let chatPage = 0;
  const CHAT_PAGE_SIZE = 50;
  function renderTablePaged(rows) {
    const tb = $('chatActivityTable')?.querySelector('tbody');
    if (!tb) return;
    const finalRows = tableRows(rows);
    const total = finalRows.length;
    const pages = Math.max(1, Math.ceil(total / CHAT_PAGE_SIZE));
    if (chatPage >= pages) chatPage = pages - 1;
    if (chatPage < 0) chatPage = 0;
    const slice = finalRows.slice(chatPage * CHAT_PAGE_SIZE, (chatPage + 1) * CHAT_PAGE_SIZE);
    if (!slice.length) {
      tb.innerHTML = '<tr><td colspan="6"><div class="chatEmptyState">No detail rows match the current category/search filter.</div></td></tr>';
    } else {
      tb.innerHTML = slice.map(r => '<tr><td>'+esc(r.date)+'</td><td><span class="catPill">'+esc(CATEGORY_LABELS[r.c] || r.c)+'</span></td><td>'+esc(r.i)+'</td><td>'+esc(r.s || '--')+'</td><td class="right">'+fi(r.n)+'</td><td class="right">'+(Number(r.m||0)?f(r.m,1)+' min':'--')+'</td></tr>').join('');
    }
    let pager = $('chatTablePager');
    if (!pager) {
      pager = document.createElement('div');
      pager.id = 'chatTablePager';
      $('chatActivityTable')?.parentElement?.appendChild(pager);
    }
    pager.innerHTML = '<button type="button" class="btn" id="chatPagePrev">Prev</button><span> Page '+(chatPage+1)+' / '+pages+' ('+total+' rows) </span><button type="button" class="btn" id="chatPageNext">Next</button>';
    const prev = $('chatPagePrev');
    const next = $('chatPageNext');
    if (prev) { prev.disabled = chatPage <= 0; prev.onclick = () => { chatPage--; renderTablePaged(rows); }; }
    if (next) { next.disabled = chatPage >= pages - 1; next.onclick = () => { chatPage++; renderTablePaged(rows); }; }
    window.ITC_TABLE?.makeSortable?.($('chatActivityTable'));
  }
  function renderTable(rows) {
    chatPage = 0;
    renderTablePaged(rows);
  }`;

if (h.includes(oldFn)) {
  h = h.replace(oldFn, newFn);
  console.log('chat pager added');
} else {
  console.log('chat pager already or pattern mismatch');
}

if (!h.includes('ITC_ROOM.set')) {
  h = h.replace(
    `  function setFilters({sid,room,start,end}){
    if (sid && $('chatSiteSelect')) { $('chatSiteSelect').value = sid; if ($('chatRoomSearch')) $('chatRoomSearch').value = ''; fillRoomSelect(); }
    if (room && $('chatRoomSelect')) $('chatRoomSelect').value = room;
    if (start && $('chatStartDate')) $('chatStartDate').value = start;
    if (end && $('chatEndDate')) $('chatEndDate').value = end;
    updateSelectionSummary();
  }`,
    `  function setFilters({sid,room,start,end}){
    if (sid && $('chatSiteSelect')) { $('chatSiteSelect').value = sid; if ($('chatRoomSearch')) $('chatRoomSearch').value = ''; fillRoomSelect(); }
    if (room && $('chatRoomSelect')) $('chatRoomSelect').value = room;
    if (start && $('chatStartDate')) $('chatStartDate').value = start;
    if (end && $('chatEndDate')) $('chatEndDate').value = end;
    if (window.ITC_ROOM) window.ITC_ROOM.set({ siteId: sid || $('chatSiteSelect')?.value || '', room: room || $('chatRoomSelect')?.value || '', start: start || $('chatStartDate')?.value || '', end: end || $('chatEndDate')?.value || '' });
    updateSelectionSummary();
  }`
  );
}

if (!h.includes('ITC_MAIN_COMBO.refresh')) {
  h = h.replace(
    '    selEl.value = currentSiteList().some(x => x.id === selId) ? selId : \'ALL\';\n  }',
    `    selEl.value = currentSiteList().some(x => x.id === selId) ? selId : 'ALL';
    if (window.ITC_MAIN_COMBO) window.ITC_MAIN_COMBO.setValue(selEl.value);
  }`
  );
}

h = h.replace(
  "renderTable(categoryRows(current.rows));",
  "renderTablePaged(categoryRows(current.rows));"
);

fs.writeFileSync(p, h);
