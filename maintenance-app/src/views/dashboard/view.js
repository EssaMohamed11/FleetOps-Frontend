/**
 * FleetOps — Dashboard View JS
 * Handles all dynamic rendering of the Dashboard section.
 * Uses ES6 modules. All data is fetched live from the backend API.
 *
 * @module views/dashboard/view
 */

import { showNotificationPanel } from '../../utils/notification-ui.js';
import DashboardApi from '../../services/api/dashboard.js';

// ─────────────────────────────────────────────────────────────────
// 1. SVG HELPERS
// ─────────────────────────────────────────────────────────────────

const WARN_ICON_SVG = `
  <svg class="alert-icon" viewBox="0 0 24 24" fill="none">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;

const CLOSE_ICON_SVG = `
  <svg viewBox="0 0 14 14" fill="none">
    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;

const TRUCK_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M1 17V11L5 4h14l4 7v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="5.5" cy="17.5" r="2.5" stroke="currentColor" stroke-width="1.8"/>
    <circle cx="18.5" cy="17.5" r="2.5" stroke="currentColor" stroke-width="1.8"/>
  </svg>`;

// ─────────────────────────────────────────────────────────────────
// 2. LOADING / ERROR HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Renders a loading skeleton placeholder into a container.
 * @param {HTMLElement} el
 * @param {string} [message]
 */
function showLoading(el, message = 'Loading…') {
  if (!el) return;
  el.innerHTML = `<div class="dashboard-loading" aria-live="polite" aria-busy="true">${message}</div>`;
}

/**
 * Renders an error notice into a container.
 * @param {HTMLElement} el
 * @param {string} [message]
 */
function showError(el, message = 'Failed to load data.') {
  if (!el) return;
  el.innerHTML = `<div class="dashboard-error">${message}</div>`;
}

// ─────────────────────────────────────────────────────────────────
// 3. RENDER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Renders KPI cards into #kpi-grid.
 * @param {Array} kpiData
 */
function renderKPICards(kpiData) {
  const grid = document.getElementById('kpi-grid');
  if (!grid) return;

  if (!kpiData || kpiData.length === 0) {
    showError(grid, 'No KPI data available.');
    return;
  }

  grid.innerHTML = kpiData.map(({ value, label, sub, subColor, iconColor, iconSvg }) => `
    <div class="kpi-card">
      <div class="kpi-icon ${iconColor}">${iconSvg}</div>
      <div class="kpi-body">
        <div class="kpi-value">${value}</div>
        <div class="kpi-label">${label}</div>
        ${sub ? `<div class="kpi-sub ${subColor}">${sub}</div>` : ''}
      </div>
    </div>
  `).join('');
}

/**
 * Renders alert banners into #alerts-section.
 * Dismissed alerts are tracked in a local Set (session-only).
 * @param {Array<{id:string, text:string}>} alertsData
 */
function renderAlerts(alertsData) {
  const section = document.getElementById('alerts-section');
  if (!section) return;

  if (!alertsData || alertsData.length === 0) {
    section.innerHTML = '';
    return;
  }

  /** @type {Set<string>} */
  const dismissed = new Set();

  const redraw = () => {
    section.innerHTML = alertsData
      .filter(a => !dismissed.has(a.id))
      .map(({ id, text }) => `
        <div class="alert-banner" data-alert-id="${id}">
          ${WARN_ICON_SVG}
          <span class="alert-text">${text}</span>
          <div class="alert-actions">
            <button class="alert-view-btn" data-alert-view="${id}">View Details →</button>
            <button class="alert-dismiss-btn" data-alert-dismiss="${id}" aria-label="Dismiss">
              ${CLOSE_ICON_SVG}
            </button>
          </div>
        </div>
      `).join('');

    // Re-attach dismiss handlers after each redraw
    section.querySelectorAll('[data-alert-dismiss]').forEach(btn => {
      btn.addEventListener('click', () => {
        dismissed.add(btn.dataset.alertDismiss);
        redraw();
      });
    });
  };

  redraw();
}

/**
 * Maps a work-order type string to a badge HTML string.
 * @param {string} type
 * @returns {string}
 */
function typeBadge(type) {
  const labels = { emergency: 'Emergency', routine: 'Routine', breakdown: 'Breakdown' };
  return `<span class="type-badge ${type}">${labels[type] ?? type}</span>`;
}

/**
 * Maps a work-order status string to a badge HTML string.
 * @param {string} status
 * @returns {string}
 */
function statusBadge(status) {
  const labels = {
    open:          'Open',
    'in-progress': 'In Progress',
    resolved:      'Resolved',
    closed:        'Closed',
    assigned:      'Assigned',
  };
  return `<span class="status-badge ${status}">${labels[status] ?? status}</span>`;
}

/**
 * Renders work orders table rows into #wo-tbody.
 * @param {Array} workOrdersData
 */
function renderWorkOrdersTable(workOrdersData) {
  const tbody = document.getElementById('wo-tbody');
  if (!tbody) return;

  if (!workOrdersData || workOrdersData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="wo-empty">No work orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = workOrdersData.map(({ id, vehicle, type, mechanic, status, updated }) => `
    <tr>
      <td><span class="wo-id">${id}</span></td>
      <td>${vehicle}</td>
      <td>${typeBadge(type)}</td>
      <td>${mechanic
        ? `<span>${mechanic}</span>`
        : `<span class="mechanic-unassigned">Unassigned</span>`
      }</td>
      <td>${statusBadge(status)}</td>
      <td><span class="updated-text">${updated}</span></td>
    </tr>
  `).join('');
}

/**
 * Maps a vehicle status to badge CSS class.
 * @param {string} status
 * @returns {string}
 */
function vehicleStatusBadge(status) {
  const labels = {
    'available':      'Available',
    'out-of-service': 'Out of Service',
    'in-service':     'In Service',
  };
  return `<span class="vstatus-badge ${status}">${labels[status] ?? status}</span>`;
}

/**
 * Renders vehicles needing attention list into #vehicles-attention-list.
 * @param {Array} vehiclesAttentionData
 */
function renderVehiclesAttention(vehiclesAttentionData) {
  const list = document.getElementById('vehicles-attention-list');
  if (!list) return;

  if (!vehiclesAttentionData || vehiclesAttentionData.length === 0) {
    list.innerHTML = `<li class="vehicle-empty">No vehicles needing attention.</li>`;
    const countEl = document.getElementById('vehicles-count');
    if (countEl) countEl.textContent = '0';
    return;
  }

  list.innerHTML = vehiclesAttentionData.map(({ id, status, sub }) => `
    <li class="vehicle-item">
      <div class="vehicle-item-icon">${TRUCK_ICON_SVG}</div>
      <div class="vehicle-item-body">
        <span class="vehicle-item-id">${id}</span>
        ${sub ? `<span class="vehicle-item-sub">${sub}</span>` : ''}
      </div>
      ${vehicleStatusBadge(status)}
    </li>
  `).join('');

  // Update count badge
  const countEl = document.getElementById('vehicles-count');
  if (countEl) countEl.textContent = vehiclesAttentionData.length;
}

/**
 * Renders upcoming maintenance list into #upcoming-maintenance-list.
 * @param {Array} upcomingMaintenanceData
 */
function renderUpcomingMaintenance(upcomingMaintenanceData) {
  const list = document.getElementById('upcoming-maintenance-list');
  if (!list) return;

  if (!upcomingMaintenanceData || upcomingMaintenanceData.length === 0) {
    list.innerHTML = `<li class="maint-empty">No upcoming maintenance scheduled.</li>`;
    return;
  }

  list.innerHTML = upcomingMaintenanceData.map(({ type, vehicleId, woId, status }) => `
    <li class="maint-item">
      <span class="maint-type-badge ${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
      <div class="maint-item-body">
        <span class="maint-vehicle-id">${vehicleId}</span>
        <span class="maint-wo-id">${woId}</span>
      </div>
      <span class="maint-status-badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
    </li>
  `).join('');
}

/**
 * Wires up the notification bell button.
 */
function initNotificationBell() {
  document.addEventListener('click', (e) => {
    const bellButton = e.target.closest('.notif-bell-btn, button:has(.notif-badge), button:has([class*="badge"])');
    if (bellButton) {
      e.preventDefault();
      showNotificationPanel();
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// 4. INIT — called when this view is mounted
// ─────────────────────────────────────────────────────────────────

/**
 * Entry point. Fetches live data from the backend API and renders the dashboard.
 * Call this after inserting view.html into the DOM.
 */
export function initDashboard() {
  // Show loading skeletons while we wait for the API
  const kpiGrid    = document.getElementById('kpi-grid');
  const alertsSec  = document.getElementById('alerts-section');
  const wTbody     = document.getElementById('wo-tbody');
  const vList      = document.getElementById('vehicles-attention-list');
  const mList      = document.getElementById('upcoming-maintenance-list');

  showLoading(kpiGrid,   'Loading KPIs…');
  showLoading(alertsSec, 'Loading alerts…');
  if (wTbody) wTbody.innerHTML = `<tr><td colspan="6" class="dashboard-loading">Loading work orders…</td></tr>`;
  showLoading(vList, 'Loading vehicles…');
  showLoading(mList, 'Loading schedule…');

  // Wire up notification bell immediately (no API dependency)
  initNotificationBell();

  DashboardApi.getDashboardData()
    .then(({
      kpiData,
      alertsData,
      workOrdersData,
      vehiclesAttentionData,
      upcomingMaintenanceData,
    }) => {
      renderKPICards(kpiData);
      renderAlerts(alertsData);
      renderWorkOrdersTable(workOrdersData);
      renderVehiclesAttention(vehiclesAttentionData);
      renderUpcomingMaintenance(upcomingMaintenanceData);
    })
    .catch((err) => {
      console.error('[Dashboard] initDashboard() failed:', err);
      showError(kpiGrid,   'Failed to load dashboard data.');
      showError(alertsSec, '');
      if (wTbody) wTbody.innerHTML = `<tr><td colspan="6" class="dashboard-error">Failed to load work orders.</td></tr>`;
      showError(vList, 'Failed to load vehicles.');
      showError(mList, 'Failed to load schedule.');
    });
}

setTimeout(initDashboard, 100);