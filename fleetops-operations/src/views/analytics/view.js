import { KPI_DATA, MONTHLY_CHART_DATA, FLEET_STATUS, DRIVER_PERF, TABLE_DATA, CO2_REPORT_DATA, FUEL_AUDIT_DATA, MAINTENANCE_COST_DATA, MAINTENANCE_SUMMARY_DATA } from "../../services/storage/analyticsData.js";
import { createIcons, icons } from "../../../../node_modules/lucide/dist/esm/lucide.mjs";
import { settingsMockData } from "../../services/storage/settings.js";

export function mount(root) {
  renderKPIs(root, "30d");
  renderMonthlyChart(root);
  renderFleetStatus(root);
  renderDriverPerf(root);
  renderTable(root);
  renderCO2Report(root);
  renderFuelAudit(root);
  renderMaintenanceCost(root);

  // Setup Date Shortcuts
  const dateBtns = root.querySelectorAll('.date-btn');
  dateBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      dateBtns.forEach(b => b.classList.remove('is-active'));
      const target = e.currentTarget;
      target.classList.add('is-active');
      renderKPIs(root, target.dataset.range);
    });
  });

  // Setup Tab Navigation
  const tabBtns = root.querySelectorAll('.tab-btn');
  const tabContents = root.querySelectorAll('.tab-content');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Remove active from all tabs
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active to current
      const target = e.currentTarget;
      target.classList.add('active');
      const tabId = target.dataset.tab;
      const content = root.querySelector(`#tab-${tabId}`);
      if (content) content.classList.add('active');
      
      // Refresh icons in case new icons were revealed
      refreshIcons();
    });
  });
}

export function unmount() {
  // Any necessary cleanup
}

window.__refreshIcons = () => createIcons({ icons });

function refreshIcons() {
  window.__refreshIcons?.();
}

function renderKPIs(root, range) {
  const container = root.querySelector('#analytics-kpi-grid');
  if (!container) return;
  const data = KPI_DATA[range] || KPI_DATA["30d"];

  container.innerHTML = data.map(kpi => `
    <div class="kpi-card">
      <div class="kpi-header">
        <span>${kpi.label}</span>
        <div class="kpi-icon" style="background: ${kpi.bg}; color: ${kpi.color}">
          <i data-lucide="${kpi.icon}"></i>
        </div>
      </div>
      <div class="kpi-value">${kpi.value}</div>
      <div class="kpi-change ${kpi.change >= 0 ? 'positive' : 'negative'}">
        <i data-lucide="${kpi.change >= 0 ? 'trending-up' : 'trending-down'}"></i>
        ${Math.abs(kpi.change)}% vs last period
      </div>
    </div>
  `).join('');

  refreshIcons()
}

function renderMonthlyChart(root) {
  const container = root.querySelector('#monthly-chart');
  if (!container) return;

  const maxVal = Math.max(...MONTHLY_CHART_DATA.revenue);

  container.innerHTML = MONTHLY_CHART_DATA.labels.map((label, i) => {
    const revenue = MONTHLY_CHART_DATA.revenue[i];
    const cost = MONTHLY_CHART_DATA.costs[i];
    const revHeight = (revenue / maxVal) * 100;
    const costHeight = (cost / maxVal) * 100;
    
    const profit = revenue - cost;
    const profitPercentage = ((profit / revenue) * 100).toFixed(1);
    const isProfit = profit >= 0;
    const colorClass = isProfit ? 'profit-green' : 'loss-red';
    const sign = isProfit ? '+' : '';
    
    return `
      <div class="bar-group">
        <div class="bars">
          <div class="bar bar-revenue" style="height: ${revHeight}%;" title="Revenue: $${revenue.toLocaleString()}"></div>
          <div class="bar bar-cost" style="height: ${costHeight}%;" title="Cost: $${cost.toLocaleString()}"></div>
        </div>
        <span class="bar-label">${label}</span>
        <span class="bar-profit ${colorClass}">${sign}${profitPercentage}%</span>
      </div>
    `;
  }).join('');
  
  refreshIcons();
}

function renderFleetStatus(root) {
  const donut = root.querySelector('#fleet-donut');
  const legend = root.querySelector('#fleet-legend');
  if (!donut || !legend) return;

  const total = FLEET_STATUS.reduce((sum, s) => sum + s.count, 0);
  let conicGradient = [];
  let currentPercent = 0;

  const legendHTML = FLEET_STATUS.map(status => {
    const percent = (status.count / total) * 100;
    conicGradient.push(`${status.color} ${currentPercent}% ${currentPercent + percent}%`);
    currentPercent += percent;
    return `
      <div class="fleet-legend-item">
        <span class="legend-dot" style="background: ${status.color}"></span>
        <span>${status.label}</span>
        <span class="fleet-legend-count">${status.count}</span>
      </div>
    `;
  }).join('');

  donut.style.background = `conic-gradient(${conicGradient.join(', ')})`;
  legend.innerHTML = legendHTML;

  refreshIcons();
}

function renderDriverPerf(root) {
  const tbody = root.querySelector('#driver-perf-tbody');
  if (!tbody) return;

  const weights = settingsMockData.kpiWeights;
  const speedW = weights.deliverySpeed / 100;
  const fuelW = weights.fuelEfficiency / 100;
  const ratingW = weights.customerRating / 100;

  const formulaCard = root.querySelector('.formula-card');
  if (formulaCard) {
    formulaCard.textContent = `Score Formula: Speed (${weights.deliverySpeed}%) + Fuel Efficiency (${weights.fuelEfficiency}%) + Customer Rating (${weights.customerRating}%)`;
  }

  const driversData = DRIVER_PERF.labels.map((name, i) => {
    const fuel = DRIVER_PERF.efficiency[i];
    const speed = DRIVER_PERF.safety[i]; 
    const rating = parseFloat(((fuel + speed) / 40).toFixed(1)); // Mock rating out of 5
    const score = Math.round((speed * speedW) + (fuel * fuelW) + ((rating / 5 * 100) * ratingW));
    return { name, speed, fuel, rating, score };
  });

  driversData.sort((a, b) => b.score - a.score);

  tbody.innerHTML = driversData.map((d, index) => {
    return `
      <tr>
        <td><span class="rank-pill">#${index + 1}</span></td>
        <td><strong>${d.name}</strong></td>
        <td>${d.speed}%</td>
        <td>${d.fuel}%</td>
        <td><i data-lucide="star" class="star-icon"></i> ${d.rating}</td>
        <td><span class="score-pill">${d.score}</span></td>
      </tr>
    `;
  }).join('');

  refreshIcons();
}

function renderTable(root) {
  const tbody = root.querySelector('#analytics-table-body');
  if (!tbody) return;

  tbody.innerHTML = TABLE_DATA.slice(0, 10).map(row => {
    const statusClass = `status-${row.status.replace(/\s+/g, '')}`;
    return `
      <tr>
        <td>${row.date}</td>
        <td><strong>${row.vehicle}</strong></td>
        <td>${row.driver}</td>
        <td>${row.distance}</td>
        <td>${row.fuel}</td>
        <td>${row.eff}%</td>
        <td><span class="status-badge ${statusClass}">${row.status}</span></td>
      </tr>
    `;
  }).join('');

  refreshIcons();
}

function renderCO2Report(root) {
  const tbody = root.querySelector('#co2-tbody');
  if (!tbody) return;

  tbody.innerHTML = CO2_REPORT_DATA.map(row => {
    const statusClass = row.status === 'Excellent' || row.status === 'Good' ? 'status-Optimal' : (row.status === 'Poor' ? 'status-NeedsReview' : 'status-HighUsage');
    const reductionClass = row.reduction >= 0 ? 'profit-green' : 'loss-red';
    const reductionSign = row.reduction > 0 ? '+' : '';
    return `
      <tr>
        <td><strong>${row.vehicle}</strong></td>
        <td>${row.type}</td>
        <td>${row.emissions}</td>
        <td><span class="${reductionClass}">${reductionSign}${row.reduction}%</span></td>
        <td><span class="status-badge ${statusClass}">${row.status}</span></td>
      </tr>
    `;
  }).join('');
}

function renderFuelAudit(root) {
  const tbody = root.querySelector('#fuel-tbody');
  if (!tbody) return;

  tbody.innerHTML = FUEL_AUDIT_DATA.map(row => {
    const isFlagged = row.status === 'Flagged';
    const rowClass = isFlagged ? 'row-flagged' : '';
    const discrepancyClass = isFlagged ? 'text-red' : '';
    const statusClass = isFlagged ? 'status-NeedsReview' : 'status-Optimal';
    const subtextHtml = isFlagged && row.subtext ? `<div class="status-subtext">${row.subtext}</div>` : '';

    return `
      <tr class="${rowClass}">
        <td><strong>${row.vehicle}</strong></td>
        <td>${row.gpsDistance}</td>
        <td>${row.expected}</td>
        <td>${row.actual}</td>
        <td><span class="${discrepancyClass}">${row.discrepancy}</span></td>
        <td>
           <span class="status-badge ${statusClass}">${row.status}</span>
           ${subtextHtml}
        </td>
      </tr>
    `;
  }).join('');
}

function renderMaintenanceCost(root) {
  // Render Summary Cards
  const totalEl = root.querySelector('#maintenance-total');
  const preventiveEl = root.querySelector('#maintenance-preventive');
  const reactiveEl = root.querySelector('#maintenance-reactive');

  if (totalEl && preventiveEl && reactiveEl) {
    const { total, preventive, reactive, currency } = MAINTENANCE_SUMMARY_DATA;
    const prevPct = Math.round((preventive / total) * 100);
    const reactPct = Math.round((reactive / total) * 100);

    totalEl.textContent = `${currency} ${total.toLocaleString()}`;
    preventiveEl.textContent = `${currency} ${preventive.toLocaleString()} (${prevPct}%)`;
    reactiveEl.textContent = `${currency} ${reactive.toLocaleString()} (${reactPct}%)`;
  }

  // Render Table
  const tbody = root.querySelector('#maintenance-tbody');
  if (!tbody) return;

  tbody.innerHTML = MAINTENANCE_COST_DATA.map(row => {
    const statusClass = row.status === 'Completed' ? 'status-Optimal' : 'status-HighUsage';
    return `
      <tr>
        <td><strong>${row.vehicle}</strong></td>
        <td>${row.service}</td>
        <td>${row.date}</td>
        <td>$${row.parts}</td>
        <td>$${row.labor}</td>
        <td><strong>$${row.total}</strong></td>
        <td><span class="status-badge ${statusClass}">${row.status}</span></td>
      </tr>
    `;
  }).join('');
    }