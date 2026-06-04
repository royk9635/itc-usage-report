(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let currentUser = null;

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  function trackActivity(action, label, details = {}) {
    if (!currentUser) return;
    const body = JSON.stringify({
      action,
      page: window.location.pathname || '/index.html',
      label: cleanText(label),
      details,
    });
    fetch('/api/audit/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function isSiteUser() {
    return currentUser?.role === 'SITE_USER';
  }

  function isSuperAdmin() {
    return currentUser?.role === 'SUPER_ADMIN';
  }

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function applyRoleUi() {
    if (!currentUser) return;
    document.body.dataset.userRole = currentUser.role;
    if (isSiteUser()) {
      document.querySelectorAll('[data-nav="nav-compare"], #viewBtnCompare, #reportPageSelect option[value="COMPARE"]').forEach((el) => {
        el.hidden = true;
        el.style.display = 'none';
      });
      if ($('reportPageSelect')?.value === 'COMPARE') {
        $('reportPageSelect').value = 'REPORT';
        $('reportPageSelect').dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    document.querySelectorAll('[data-super-admin-only]').forEach((el) => {
      el.hidden = !isSuperAdmin();
    });
    if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN') {
      const accountGroup = [...document.querySelectorAll('.dash-nav-group-title')]
        .find((el) => String(el.textContent || '').trim().toLowerCase() === 'account')
        ?.parentElement;
      if (accountGroup && !accountGroup.querySelector('[data-nav="nav-access-management"]')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dash-nav-item';
        btn.dataset.nav = 'nav-access-management';
        btn.innerHTML = '<svg class="dash-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 6v6l4 2"/><path d="M20 12a8 8 0 11-16 0 8 8 0 0116 0z"/></svg><span class="dash-nav-label">Access Management</span>';
        btn.addEventListener('click', () => { window.location.href = '/admin'; });
        accountGroup.insertBefore(btn, accountGroup.firstElementChild?.nextSibling || null);
      }
    }
  }

  function wireLogout() {
    document.querySelectorAll('[data-nav="nav-logout"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await fetchJson('/api/auth/logout', { method: 'POST', body: '{}' });
        } finally {
          window.location.href = '/login';
        }
      });
    });
  }

  function wirePasswordShortcut() {
    document.querySelectorAll('[data-nav="nav-profile"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const currentPassword = window.prompt('Enter current password');
        if (!currentPassword) return;
        const newPassword = window.prompt('Enter new password (minimum 10 characters)');
        if (!newPassword) return;
        try {
          await fetchJson('/api/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
          });
          window.alert('Password changed successfully.');
        } catch (err) {
          window.alert(err.message || 'Could not change password.');
        }
      });
    });
  }

  function optionText(el) {
    return el?.selectedOptions?.[0]?.textContent || el?.value || '';
  }

  function wireActivityTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('button, a');
      if (!target) return;
      if (target.id === 'btnExport') {
        trackActivity('EXPORT_PRINT', 'Export / Print', { id: target.id });
        return;
      }
      if (target.id === 'btnDownloadHtml') {
        trackActivity('EXPORT_PRINT', 'Download HTML', { id: target.id });
        return;
      }
      if (target.id === 'roomActivitySearchBtn') {
        trackActivity('ROOM_SEARCH', 'Room activity search', {
          site: $('roomActivitySiteSelect')?.value || '',
          room: $('roomActivityRoomInput')?.value || '',
          startDate: $('roomActivityStart')?.value || '',
          endDate: $('roomActivityEnd')?.value || '',
        });
        return;
      }
      if (target.id === 'viewBtnChat' || target.dataset.page === 'CHAT') {
        trackActivity('CHAT_OPEN', 'Room chatbot', { page: 'CHAT' });
        return;
      }
      if (target.dataset.page) {
        trackActivity('VIEW_CHANGE', cleanText(target.textContent) || target.dataset.page, { page: target.dataset.page });
        return;
      }
      if (target.dataset.nav) {
        trackActivity('NAVIGATION', cleanText(target.textContent) || target.dataset.nav, {
          nav: target.dataset.nav,
          siteId: target.dataset.siteId || '',
        });
      }
    });

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!target || !target.id) return;
      const tracked = new Set([
        'monthSelect',
        'siteSelect',
        'reportPageSelect',
        'dodFilterStartDate',
        'dodFilterEndDate',
        'dodFilterToggle',
        'dodUsageMetricSelect',
        'roomActivitySiteSelect',
        'roomActivityRoomInput',
        'roomActivityStart',
        'roomActivityEnd',
        'chatSiteSelect',
      ]);
      if (!tracked.has(target.id)) return;
      const action = target.id === 'reportPageSelect' ? 'VIEW_CHANGE' : 'FILTER_CHANGE';
      trackActivity(action, target.labels?.[0]?.textContent || target.id, {
        id: target.id,
        value: target.type === 'checkbox' ? target.checked : target.value,
        text: optionText(target),
      });
    });
  }

  async function init() {
    try {
      const data = await fetchJson('/api/auth/me');
      currentUser = data.user;
      window.ITC_AUTH_USER = currentUser;
      applyRoleUi();
      wireLogout();
      wirePasswordShortcut();
      wireActivityTracking();
    } catch (_) {
      window.location.href = '/login';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
