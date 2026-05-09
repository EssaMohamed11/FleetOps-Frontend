/* ════════════════════════════════════════════════
   Fleet Management — view.js
   FleetOps Operations · Vanilla JS Logic (SPA-ready)
════════════════════════════════════════════════ */

import { showNotificationPanel } from '../../utils/notification-ui.js';
import api from '/shared/api-handler.js'; // ← Real API handler (absolute path served by dev server)

// تعديل البورت لـ 8000 عشان يكلم لارفيل
api.setBaseURL('http://localhost:8000');


// ─── 1. Data ──────────────────────────────────────────────────────────────

/* // ── Hardcoded mock data — commented out; replaced by fetchFleetData() below ──
const FLEET_DATA_MOCK = [
  {
    id: 'V-001', plate: 'TRK-042', type: 'Heavy',
    maxWeight: '500 kg', maxVolume: '12 m³', odometer: '124,500 km',
    status: 'In Service', mechanic: null,
    marketValue: 'SAR 85,000', lastService: '2026-03-20',
    damageReport: null,
    insurance: 'Sep 10, 2026', inspection: 'Jun 30, 2026',
  },
  {
    id: 'V-002', plate: 'TRK-015', type: 'Light',
    maxWeight: '200 kg', maxVolume: '6 m³', odometer: '89,200 km',
    status: 'Available', mechanic: null,
    marketValue: 'SAR 42,000', lastService: '2026-04-01',
    damageReport: null,
    insurance: 'Dec 01, 2026', inspection: 'Aug 15, 2026',
  },
  {
    id: 'V-003', plate: 'TRK-023', type: 'Heavy',
    maxWeight: '500 kg', maxVolume: '12 m³', odometer: '210,300 km',
    status: 'Available', mechanic: null,
    marketValue: 'SAR 65,000', lastService: '2026-03-15',
    damageReport: null,
    insurance: 'Oct 20, 2026', inspection: 'Jul 01, 2026',
  },
  {
    id: 'V-004', plate: 'TRK-007', type: 'Refrigerated',
    maxWeight: '350 kg', maxVolume: '8 m³', odometer: '156,800 km',
    status: 'Damaged', mechanic: null,
    marketValue: 'SAR 95,000', lastService: '2026-02-28',
    damageReport: 'Engine overheating — coolant leak detected',
    insurance: 'Nov 05, 2026', inspection: 'Apr 30, 2026',
  },
  {
    id: 'V-005', plate: 'TRK-031', type: 'Light',
    maxWeight: '200 kg', maxVolume: '6 m³', odometer: '67,400 km',
    status: 'Available', mechanic: null,
    marketValue: 'SAR 48,000', lastService: '2026-04-05',
    damageReport: null,
    insurance: 'Jan 12, 2027', inspection: 'Sep 01, 2026',
  },
  {
    id: 'V-006', plate: 'TRK-019', type: 'Heavy',
    maxWeight: '500 kg', maxVolume: '12 m³', odometer: '185,000 km',
    status: 'In Service', mechanic: null,
    marketValue: 'SAR 72,000', lastService: '2026-03-10',
    damageReport: null,
    insurance: 'Aug 22, 2026', inspection: 'May 20, 2026',
  },
  {
    id: 'V-007', plate: 'TRK-050', type: 'Refrigerated',
    maxWeight: '350 kg', maxVolume: '8 m³', odometer: '45,000 km',
    status: 'Damaged', mechanic: null,
    marketValue: 'SAR 110,000', lastService: '2026-03-25',
    damageReport: 'Electrical system failure — AC unit and refrigeration not working',
    insurance: 'Jul 15, 2026', inspection: 'May 01, 2026',
  },
  {
    id: 'V-008', plate: 'TRK-028', type: 'Light',
    maxWeight: '200 kg', maxVolume: '6 m³', odometer: '132,000 km',
    status: 'In Maintenance', mechanic: 'Ali Mechanic',
    marketValue: 'SAR 38,000', lastService: '2026-04-10',
    damageReport: null,
    insurance: 'Jul 15, 2026', inspection: 'May 01, 2026',
  },
];
*/

// ── Live data array — populated asynchronously by fetchFleetData() ──
let FLEET_DATA = [];

/**
 * Fetches vehicles from the backend API and maps the response to the
 * UI-expected shape, then updates the module-level FLEET_DATA array.
 *
 * Backend shape: { vehicle_id, VehicleLicense, VehicleType, Current_odometer, Status, ... }
 * UI shape:      { id, plate, type, odometer, status, maxWeight, maxVolume, ... }
 */
async function fetchFleetData() {
  try {
    const response = await api.get('http://localhost:8000/api/v1/dispatch/fleet/vehicles');
    if (response.ok && response.data?.success) {
      FLEET_DATA = response.data.data.map(v => ({
        // ── Identity & Classification ────────────────────────────────────
        id: v.vehicle_id ?? v.id ?? 'N/A',
        plate: v.VehicleLicense ?? 'N/A',
        type: v.VehicleType ?? 'N/A',

        // ── Operational fields ────────────────────────────────────────────
        odometer: v.Current_odometer
          ? `${Number(v.Current_odometer).toLocaleString()} km`
          : 'N/A',
        status: v.Status ?? v.status ?? 'Unknown',
        mechanic: v.mechanic ?? null,
        damageReport: v.damage_report ?? null,

        // ── Capacity (backend may not provide these; fall back gracefully) ─
        maxWeight: v.max_weight ? `${v.max_weight} kg` : 'N/A',
        maxVolume: v.max_volume ? `${v.max_volume} m³` : 'N/A',

        // ── Financial & compliance ────────────────────────────────────────
        marketValue: v.market_value
          ? `SAR ${Number(v.market_value).toLocaleString()}`
          : 'N/A',
        lastService: v.last_service ?? v.updated_at?.split('T')[0] ?? 'N/A',
        insurance: v.insurance_expiry ?? 'N/A',
        inspection: v.inspection_expiry ?? 'N/A',
      }));
    } else {
      console.warn('[FleetOps] fetchFleetData: API returned non-success response.');
    }
  } catch (error) {
    console.error('[FleetOps] fetchFleetData error:', error);
  }
}

const MECHANICS = [
  { id: 'M-01', name: 'Ali Mechanic', specialty: 'Engine & Transmission', jobs: '1 active job(s)', available: true },
  { id: 'M-02', name: 'Yousef Tech', specialty: 'Electrical & Electronics', jobs: '0 active job(s)', available: true },
  { id: 'M-03', name: 'Faisal Heavy', specialty: 'Heavy Vehicle Specialist', jobs: '3 active job(s)', available: false },
  { id: 'M-04', name: 'Saeed Body', specialty: 'Body & Paint', jobs: '2 active job(s)', available: true },
  { id: 'M-05', name: 'Nasser General', specialty: 'General Maintenance', jobs: '1 active job(s)', available: true },
];

// ── Module State ──────────────────────────────────────────────────────────
let currentFilter = 'All';
let selectedMechanic = null;
let currentVehicleId = null;
// ─── Charts Logic ───
let odoChartInstance = null;
let fuelChartInstance = null;

function renderVehicleCharts() {
  const odoCtx = document.getElementById('odoChart'); //
  const fuelCtx = document.getElementById('fuelChart'); //

  if (!odoCtx || !fuelCtx) return;

  // تدمير الرسومات القديمة لمنع التداخل
  if (odoChartInstance) odoChartInstance.destroy();
  if (fuelChartInstance) fuelChartInstance.destroy();

  // 1. رسمة عداد الكيلومترات (Line Chart)
  odoChartInstance = new Chart(odoCtx.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
      datasets: [{
        label: 'Odometer (km)',
        data: [120000, 125000, 128000, 130000, 131500, 132000],
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // بيخلي الرسمة تملى الكونتينر
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: false } }
    }
  });

  // 2. رسمة استهلاك الوقود (Bar Chart)
  fuelChartInstance = new Chart(fuelCtx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
      datasets: [{
        label: 'km/L',
        data: [8.5, 7.8, 8.2, 9.1, 8.0, 8.8],
        backgroundColor: '#0d9488',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}
// ─── 2. SVG Icons ─────────────────────────────────────────────────────────
const ICONS = {
  edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  eye: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  wrench: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  user: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
};

// ─── 3. Helpers ───────────────────────────────────────────────────────────
function getStatusBadge(status) {
  const cls = `status-${status.toLowerCase().replace(/ /g, '-')}`;
  return `<span class="status-badge ${cls}">${status}</span>`;
}

function getMechanicCell(vehicle) {
  if (vehicle.status === 'Damaged') {
    return `<button class="assign-btn" data-id="${vehicle.id}">${ICONS.wrench} Assign Mechanic</button>`;
  }
  if (vehicle.mechanic) {
    return `<span class="mechanic-pill">${ICONS.user} ${vehicle.mechanic}</span>`;
  }
  return `<span class="cell-dash">—</span>`;
}

// ─── 4. Table Rendering ───────────────────────────────────────────────────
function renderTable(data = FLEET_DATA) {
  const tbody = document.getElementById('fleetTableBody');
  if (!tbody) return;

  const filtered = currentFilter === 'All'
    ? data
    : data.filter(v => v.status === currentFilter);

  tbody.innerHTML = filtered.map(v => `
    <tr data-id="${v.id}">
      <td class="cell-id">${v.id}</td>
      <td class="cell-plate">${v.plate}</td>
      <td>${v.type}</td>
      <td>${v.maxWeight}</td>
      <td>${v.maxVolume}</td>
      <td>${v.odometer}</td>
      <td>${getStatusBadge(v.status)}</td>
      <td>${getMechanicCell(v)}</td>
      <td class="cell-value">${v.marketValue}</td>
      <td class="cell-date">${v.lastService}</td>
      <td>
        <div class="actions-cell">
          <button class="icon-btn btn-edit" data-id="${v.id}" title="Edit">${ICONS.edit}</button>
          <button class="icon-btn btn-view" data-id="${v.id}" title="View details">${ICONS.eye}</button>
          ${v.status === 'Damaged'
      ? `<button class="icon-btn danger assign-btn" data-id="${v.id}" title="Repair">${ICONS.wrench}</button>`
      : ''}
        </div>
      </td>
    </tr>
  `).join('');

  updatePageStats();
}

// ─── 5. Stats & Filters ───────────────────────────────────────────────────
function updatePageStats() {
  const damaged = FLEET_DATA.filter(v => v.status === 'Damaged').length;
  const inMaint = FLEET_DATA.filter(v => v.status === 'In Maintenance').length;

  const el = id => document.getElementById(id);
  if (el('vehicleCount')) el('vehicleCount').textContent = `${FLEET_DATA.length} vehicles in fleet`;
  if (el('alertTitle')) el('alertTitle').textContent = `${damaged} vehicle(s) damaged — needs mechanic assignment`;
  if (el('alertTag')) el('alertTag').textContent = `${inMaint} in maintenance`;
  if (el('damagedCount')) el('damagedCount').textContent = damaged;
}

function initFilters() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = (e) => {
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      e.currentTarget.classList.add('active');
      e.currentTarget.setAttribute('aria-selected', 'true');
      currentFilter = e.currentTarget.dataset.tab;
      renderTable();
    };
  });
}

// ─── 6. Plate Search ─────────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('plateSearch');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    renderTable(q ? FLEET_DATA.filter(v => v.plate.toLowerCase().includes(q)) : FLEET_DATA);
  });
}

// ─── 7. Add Vehicle Modal ─────────────────────────────────────────────────
function initAddVehicleModal() {
  const modal = document.getElementById('modalOverlay');
  const openBtn = document.getElementById('openModalBtn');
  const closeBtn = document.getElementById('closeModalBtn');
  const cancelBtn = document.getElementById('cancelModalBtn');
  const saveBtn = document.getElementById('saveVehicleBtn');
  if (!modal || !openBtn) return;

  const clearForm = () => {
    modal.querySelectorAll('.form-input').forEach(i => (i.value = ''));
    const typeSelect = document.getElementById('fieldType');
    if (typeSelect) typeSelect.selectedIndex = 0;
  };

  const open = () => { modal.removeAttribute('hidden'); requestAnimationFrame(() => modal.classList.add('is-open')); };
  const close = () => { modal.classList.remove('is-open'); setTimeout(() => { modal.setAttribute('hidden', ''); clearForm(); }, 200); };

  openBtn.onclick = open;
  if (closeBtn) closeBtn.onclick = close;
  if (cancelBtn) cancelBtn.onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
  if (saveBtn) {
    saveBtn.onclick = () => {
      // 1. تجميع البيانات من الفورم
      const plate = document.getElementById('fieldPlate')?.value?.trim();
      const weight = document.getElementById('fieldMaxWeight')?.value?.trim();
      const volume = document.getElementById('fieldMaxVolume')?.value?.trim();
      const type = document.getElementById('fieldType')?.value;

      // سحب قيم الحقول الجديدة
      const odometer = document.getElementById('fieldOdometer')?.value?.trim();
      const marketValue = document.getElementById('fieldMarketValue')?.value?.trim();

      if (!plate) { alert('Please enter a Plate Number.'); return; }

      // 2. عمل ID جديد
      const newIdNum = FLEET_DATA.length + 1;
      const newId = `V-${String(newIdNum).padStart(3, '0')}`;
      const today = new Date().toISOString().split('T')[0];

      // 3. بناء هيكل بيانات العربية الجديدة مع القيم الجديدة
      const newVehicle = {
        id: newId,
        plate: plate,
        type: type || 'Light',
        maxWeight: weight ? `${weight} kg` : '-',
        maxVolume: volume ? `${volume} m³` : '-',
        // لو دخل رقم هنحطله فواصل وكلمة km، لو مدخلش هيبقى 0
        odometer: odometer ? `${Number(odometer).toLocaleString()} km` : '0 km',
        status: 'Available',
        mechanic: null,
        // لو دخل رقم هنحطله SAR، لو مدخلش هيبقى SAR —
        marketValue: marketValue ? `SAR ${Number(marketValue).toLocaleString()}` : 'SAR —',
        lastService: today,
        damageReport: null,
        insurance: 'N/A',
        inspection: 'N/A'
      };

      // 4. إضافة العربية في أول الجدول وتحديث الـ UI
      FLEET_DATA.unshift(newVehicle);
      renderTable();

      // 5. قفل المودال (close سيقوم بتفريغ الحقول تلقائيًا)
      close();
    };
  }
}

// ─── 8. Assign Mechanic Modal ─────────────────────────────────────────────
function renderMechanicList() {
  const list = document.getElementById('mechanicList');
  if (!list) return;

  list.innerHTML = MECHANICS.map(m => `
    <div class="mechanic-item ${m.available ? '' : 'busy'}"
         data-mechanic-id="${m.id}"
         role="button" tabindex="${m.available ? '0' : '-1'}"
         aria-disabled="${!m.available}">
      <div class="custom-radio"><div class="custom-radio-dot"></div></div>
      <div class="mechanic-icon-box">🔧</div>
      <div class="mechanic-info">
        <div class="mechanic-name">
          ${m.name}
          ${!m.available ? '<span class="busy-tag">BUSY</span>' : ''}
        </div>
        <div class="mechanic-sub">${m.specialty} · ${m.jobs}</div>
      </div>
      <span class="mechanic-status-badge ${m.available ? 'status-avail' : 'status-busy'}">
        ${m.available ? 'Available' : 'Unavailable'}
      </span>
    </div>
  `).join('');

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.mechanic-item');
    if (!item || item.classList.contains('busy')) return;
    list.querySelectorAll('.mechanic-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    selectedMechanic = item.dataset.mechanicId;
  });

  list.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.mechanic-item');
    if (item && !item.classList.contains('busy')) item.click();
  });
}

function initAssignMechanicModal() {
  const modal = document.getElementById('assignMechanicModal');
  const closeBtn = document.getElementById('closeAssignModal');
  const cancelBtn = document.getElementById('cancelAssignModal');
  const confirmBtn = document.getElementById('confirmAssignBtn');
  if (!modal) return null;

  renderMechanicList();

  const close = () => {
    modal.classList.remove('is-open');
    setTimeout(() => modal.setAttribute('hidden', ''), 200);
    selectedMechanic = null;
    currentVehicleId = null;
  };

  const open = (vehicleId) => {
    const vehicle = FLEET_DATA.find(v => v.id === vehicleId);
    if (!vehicle) return;
    currentVehicleId = vehicleId;
    selectedMechanic = null;

    const info = document.getElementById('assignVehicleInfo');
    const reportText = document.getElementById('damageReportText');
    if (info) info.textContent = `${vehicle.plate} — ${vehicle.type}`;
    if (reportText) reportText.textContent = vehicle.damageReport || 'No damage details provided.';

    modal.querySelectorAll('.mechanic-item').forEach(el => el.classList.remove('selected'));
    const notes = document.getElementById('repairNotes');
    const date = document.getElementById('completionDate');
    if (notes) notes.value = '';
    if (date) date.value = '';

    modal.removeAttribute('hidden');
    requestAnimationFrame(() => modal.classList.add('is-open'));
  };

  if (closeBtn) closeBtn.onclick = close;
  if (cancelBtn) cancelBtn.onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      if (!selectedMechanic) { alert('Please select a mechanic before assigning.'); return; }
      const mechanic = MECHANICS.find(m => m.id === selectedMechanic);
      const vehicle = FLEET_DATA.find(v => v.id === currentVehicleId);
      if (vehicle && mechanic) {
        vehicle.status = 'In Maintenance';
        vehicle.mechanic = mechanic.name;
        renderTable();
      }
      close();
    };
  }

  return open;
}

// ─── 9. Vehicle Details Modal ─────────────────────────────────────────────

/**
 * Generates plausible 6-month odometer readings based on the raw odometer string.
 */
function buildOdometerHistory(odoStr) {
  const current = parseInt(odoStr.replace(/[^0-9]/g, ''), 10) || 100000;
  const monthlyGain = Math.round(current * 0.04); // ~4% per month
  return Array.from({ length: 6 }, (_, i) => current - (5 - i) * monthlyGain);
}

/**
 * Generates plausible fuel efficiency values (7–11 km/L range with small variance).
 */
function buildFuelHistory(type) {
  const base = type === 'Heavy' ? 7.5 : type === 'Refrigerated' ? 8.2 : 9.8;
  return Array.from({ length: 6 }, () => +(base + (Math.random() * 1.6 - 0.8)).toFixed(1));
}

const CHART_MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const CHART_DEFAULTS = {
  teal: '#0d9488',
  tealLight: 'rgba(13,148,136,.12)',
  gridColor: 'rgba(0,0,0,.06)',
  font: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
  tickColor: '#94a3b8',
};

/**
 * Dynamically loads Chart.js once from the CDN and fires `callback` when ready.
 * Safe to call multiple times — subsequent calls reuse the already-loaded library.
 */
function loadChartJS(callback) {
  if (typeof Chart !== 'undefined') {
    // Already available — fire immediately.
    callback();
    return;
  }

  // Check if a pending script tag already exists (avoids double-injection).
  if (document.querySelector('script[data-chartjs-loader]')) {
    // Piggy-back onto the existing load event via a one-time listener.
    const existing = document.querySelector('script[data-chartjs-loader]');
    existing.addEventListener('load', callback, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  script.setAttribute('data-chartjs-loader', '');
  script.onload = callback;
  script.onerror = () => console.error('[FleetOps] Failed to load Chart.js from CDN.');
  document.head.appendChild(script);
}
function destroyCharts() {
  if (odoChartInstance) { odoChartInstance.destroy(); odoChartInstance = null; }
  if (fuelChartInstance) { fuelChartInstance.destroy(); fuelChartInstance = null; }
}
function buildCharts(vehicle) {
  destroyCharts();

  const commonScales = {
    x: {
      grid: { color: CHART_DEFAULTS.gridColor, drawBorder: false },
      ticks: { color: CHART_DEFAULTS.tickColor, font: { size: 11, family: CHART_DEFAULTS.font } },
    },
    y: {
      grid: { color: CHART_DEFAULTS.gridColor, drawBorder: false },
      ticks: { color: CHART_DEFAULTS.tickColor, font: { size: 11, family: CHART_DEFAULTS.font } },
    },
  };

  const commonPlugins = {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      titleFont: { size: 12, family: CHART_DEFAULTS.font },
      bodyFont: { size: 12, family: CHART_DEFAULTS.font },
      padding: 10, cornerRadius: 8,
    },
  };

  // ── Odometer Line Chart ──
  const odoCtx = document.getElementById('odoChart');
  if (odoCtx) {
    const odoData = buildOdometerHistory(vehicle.odometer);
    odoChartInstance = new Chart(odoCtx, {
      type: 'line',
      data: {
        labels: CHART_MONTHS,
        datasets: [{
          data: odoData,
          borderColor: CHART_DEFAULTS.teal,
          backgroundColor: CHART_DEFAULTS.tealLight,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: CHART_DEFAULTS.teal,
          tension: 0.35,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: commonPlugins,
        scales: {
          ...commonScales,
          y: {
            ...commonScales.y,
            ticks: {
              ...commonScales.y.ticks,
              callback: v => v.toLocaleString(),
            },
          },
        },
      },
    });
  }

  // ── Fuel Efficiency Bar Chart ──
  const fuelCtx = document.getElementById('fuelChart');
  if (fuelCtx) {
    const fuelData = buildFuelHistory(vehicle.type);
    fuelChartInstance = new Chart(fuelCtx, {
      type: 'bar',
      data: {
        labels: CHART_MONTHS,
        datasets: [{
          data: fuelData,
          backgroundColor: CHART_DEFAULTS.teal,
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: commonPlugins,
        scales: {
          ...commonScales,
          y: {
            ...commonScales.y,
            min: 0,
            max: 13,
            ticks: {
              ...commonScales.y.ticks,
              stepSize: 3,
            },
          },
        },
      },
    });
  }
}

/** Maps a status string to a CSS modifier class for the header badge. */
function statusToBadgeClass(status) {
  return `ds-${status.toLowerCase().replace(/ /g, '-')}`;
}

function initVehicleDetailsModal(openAssignModalFn) {
  const modal = document.getElementById('vehicleDetailsModal');
  const closeBtn = document.getElementById('closeDetailsModal');
  if (!modal) return null;

  const close = () => {
    modal.classList.remove('is-open');
    setTimeout(() => {
      modal.setAttribute('hidden', '');
      destroyCharts();
    }, 200);
  };

  // Wire the "Assign Mechanic Now" button inside the details modal
  const assignNowBtn = document.getElementById('detailsAssignNowBtn');
  if (assignNowBtn) {
    assignNowBtn.onclick = () => {
      const vehicleId = assignNowBtn.dataset.vehicleId;
      close();
      // Short delay so the details modal finishes closing before the assign modal opens
      setTimeout(() => openAssignModalFn?.(vehicleId), 220);
    };
  }

  const open = (vehicleId) => {
    const v = FLEET_DATA.find(x => x.id === vehicleId);
    if (!v) return;

    // ── Populate header
    const plateEl = document.getElementById('detailsPlate');
    const badgeEl = document.getElementById('detailsStatusBadge');
    const subtitleEl = document.getElementById('detailsSubtitle');
    if (plateEl) plateEl.textContent = v.plate;
    if (badgeEl) {
      badgeEl.textContent = v.status;
      badgeEl.className = `details-status-badge ${statusToBadgeClass(v.status)}`;
    }
    if (subtitleEl) subtitleEl.textContent = `${v.type} · ${v.id}`;

    // ── Damage Report Banner (conditional)
    const banner = document.getElementById('detailsDamageBanner');
    const damageText = document.getElementById('detailsDamageText');
    if (banner) {
      if (v.status === 'Damaged' && v.damageReport) {
        if (damageText) damageText.textContent = v.damageReport;
        // Store the vehicleId on the button so the click handler can use it
        if (assignNowBtn) assignNowBtn.dataset.vehicleId = v.id;
        banner.removeAttribute('hidden');
      } else {
        banner.setAttribute('hidden', '');
      }
    }

    // ── Populate stats
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('detailsStatStatus', v.status);
    setText('detailsStatOdometer', v.odometer);
    setText('detailsStatValue', v.marketValue);
    setText('detailsStatService', v.lastService);

    // ── Populate documents
    setText('detailsInsurance', v.insurance || 'N/A');
    setText('detailsInspection', v.inspection || 'N/A');

    // ── Open modal, then load Chart.js (if needed) and render charts
    modal.removeAttribute('hidden');
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      // Slight delay so canvas has layout dimensions, then ensure Chart.js is loaded
      setTimeout(() => loadChartJS(() => buildCharts(v)), 80);
    });
  };

  if (closeBtn) closeBtn.onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) close();
  });

  return open;
}

// ─── 10. Global Table Delegation ──────────────────────────────────────────
function initTableDelegation(openDetailsModal, openAssignModal) {
  const tbody = document.getElementById('fleetTableBody');
  if (!tbody) return;

  tbody.addEventListener('click', (e) => {
    // Eye (view) button — highest priority
    const viewBtn = e.target.closest('.btn-view');
    if (viewBtn) {
      e.stopPropagation();
      openDetailsModal?.(viewBtn.dataset.id);
      return;
    }

    // Assign mechanic button — don't open details
    if (e.target.closest('.assign-btn')) return;

    // Edit button — don't open details
    if (e.target.closest('.btn-edit')) return;

    // Click anywhere else on the row → open details
    const row = e.target.closest('tr[data-id]');
    if (row) openDetailsModal?.(row.dataset.id);
  });
}

// ─── 11. Notification Bell ────────────────────────────────────────────────
function handleGlobalClicks(e) {
  const bell = e.target.closest('.notif-bell-btn, button[aria-label="Notifications"], .bell-btn, #bellBtn');
  if (bell) { e.preventDefault(); showNotificationPanel(); }
}

// ─── 12. Entry Point ─────────────────────────────────────────────────────

/**
 * Main initialiser — now async so it can await the fleet data fetch
 * before rendering the table.
 */
export async function initFleetManagement() {
  console.log('[FleetOps] Initializing Fleet Management module…');

  document.removeEventListener('click', handleGlobalClicks);
  document.addEventListener('click', handleGlobalClicks);

  // ── Fetch real data from the API before first render ──
  await fetchFleetData();

  renderTable();
  initFilters();
  initSearch();
  initAddVehicleModal();

  const openAssignModal = initAssignMechanicModal();
  const openDetailsModal = initVehicleDetailsModal(openAssignModal);

  initTableDelegation(openDetailsModal, openAssignModal);

  // Assign-btn delegation for table rows (wrench icon / "Assign Mechanic" buttons)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.assign-btn');
    if (btn && btn.dataset.id) openAssignModal?.(btn.dataset.id);
  });
}

// SPA-aware boot — uses .then() so the async Promise is properly handled
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initFleetManagement());
} else {
  initFleetManagement();
}

export function unmount() {
    // Remove all document-level listeners added during mount
    _docListeners.forEach(({ type, fn, opts }) => {
        document.removeEventListener(type, fn, opts);
    });
    _docListeners.length = 0;
    destroyCharts();
}