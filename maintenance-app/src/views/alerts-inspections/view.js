import AlertsApi from "../../services/api/alerts.js";

// ─── In-memory state (replaces mutable storage import) ───────────────────────
// Holds the live data fetched from the API; mutated locally for optimistic UI.
let _data = { odometer: [], insurance: [], inspection: [], parts: [] };

// ─── Mount / Unmount ──────────────────────────────────────────────────────────

export function mount() {
    initTabs();
    setLoading(true);

    AlertsApi.getAllAlerts()
        .then(function (data) {
            _data = data;
            setLoading(false);
            renderOdometer(_data.odometer);
            renderInsurance(_data.insurance);
            renderInspection(_data.inspection);
            renderParts(_data.parts);
            updateBadges(_data);
        })
        .catch(function (err) {
            console.error("[Alerts view] Failed to load alerts:", err);
            setLoading(false);
        });
}

export function unmount() {
    // All listeners are on local elements and are released with the DOM.
    console.log("Alerts & Inspections view unmounted");
}

// ─── Loading state ────────────────────────────────────────────────────────────

function setLoading(active) {
    // Show/hide a loading indicator inside each table body while the API call is in flight.
    const tbodies = ["odometer-table-body", "insurance-table-body", "inspection-table-body", "parts-table-body"];
    tbodies.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (active) {
            el.innerHTML = `<tr><td colspan="7" class="table-loading">Loading…</td></tr>`;
        }
    });
}

// ─── SPA Navigation helper ────────────────────────────────────────────────────

function navigate(path) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
}

// ─── Render: Odometer ─────────────────────────────────────────────────────────

function renderOdometer(alerts) {
    const tbody = document.getElementById("odometer-table-body");
    if (!tbody) return;

    if (!alerts || alerts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No odometer alerts.</td></tr>`;
        return;
    }

    tbody.innerHTML = alerts.map((alert) => `
        <tr>
            <td>
                <div class="vehicle-cell">
                    <span class="vehicle-plate">${alert.vehiclePlate}</span>
                    <span class="vehicle-model">${alert.vehicleModel}</span>
                </div>
            </td>
            <td>${alert.lastServiceKM} km</td>
            <td>${alert.currentOdometer} km</td>
            <td class="${alert.status === 'warning' ? 'text-danger' : ''}">${alert.kmSinceService} km</td>
            <td>${alert.threshold} km</td>
            <td><span class="chip ${alert.status}">${alert.status === 'warning' ? 'Due Soon' : 'OK'}</span></td>
            <td>
                ${alert.status === 'success' ? '' : `<button class="button primary sm work-order-btn">
                    <i data-lucide="plus"></i> Work Order
                </button>`}
            </td>
        </tr>`).join('');

    tbody.querySelectorAll('.work-order-btn').forEach((btn) => {
        btn.addEventListener('click', () => navigate('/work-orders'));
    });
}

// ─── Render: Insurance ────────────────────────────────────────────────────────

function renderInsurance(alerts) {
    const tbody = document.getElementById('insurance-table-body');
    if (!tbody) return;

    if (!alerts || alerts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No insurance alerts.</td></tr>`;
        return;
    }

    tbody.innerHTML = alerts.map((alert) => `
        <tr>
            <td>
                <div class="vehicle-cell">
                    <span class="vehicle-plate">${alert.vehiclePlate}</span>
                    <span class="vehicle-model">${alert.vehicleModel}</span>
                </div>
            </td>
            <td>${alert.policyNumber}</td>
            <td>${alert.expiryDate}</td>
            <td class="${alert.status === 'warning' ? 'text-danger' : ''}">${alert.daysRemaining} Days</td>
            <td><span class="chip ${alert.status}">${alert.status === 'warning' ? 'Expiring Soon' : 'Renewed'}</span></td>
            <td>
                ${alert.status === 'success' ? '' : `<button class="button primary sm mark-renewed-btn" data-id="${alert.id}">Mark as Renewed</button>`}
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.mark-renewed-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;

            // Optimistic UI: mark locally and re-render immediately
            const item = _data.insurance.find((a) => a.id === id);
            if (item) item.status = "success";
            renderInsurance(_data.insurance);
            updateBadges(_data);

            // Persist to backend
            const result = await AlertsApi.renewInsurance(id);
            if (!result?.success) {
                console.warn("[Alerts] renewInsurance API call failed for id:", id);
            }
        });
    });
}

// ─── Render: Inspection ───────────────────────────────────────────────────────

function renderInspection(alerts) {
    const tbody = document.getElementById('inspection-table-body');
    if (!tbody) return;

    if (!alerts || alerts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No inspection alerts.</td></tr>`;
        return;
    }

    tbody.innerHTML = alerts.map((alert) => `
        <tr class="${alert.status === 'success' ? 'row-completed' : ''}">
            <td>
                <div class="vehicle-cell">
                    <span class="vehicle-plate">${alert.vehiclePlate}</span>
                    <span class="vehicle-model">${alert.vehicleModel}</span>
                </div>
            </td>
            <td>${alert.lastInspection}</td>
            <td>${alert.nextDueDate}</td>
            <td class="${alert.status === 'danger' ? 'text-danger' : ''}">${alert.daysRemaining}</td>
            <td><span class="chip ${alert.status}">${alert.status === 'danger' ? 'Overdue' : 'Completed'}</span></td>
            <td>
                ${alert.status === 'success' ? '' : `<button class="button primary sm mark-complete-btn" data-id="${alert.id}">Mark as complete</button>`}
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.mark-complete-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;

            // Optimistic UI
            const item = _data.inspection.find((a) => a.id === id);
            if (item) item.status = "success";
            renderInspection(_data.inspection);
            updateBadges(_data);

            // Persist to backend
            const result = await AlertsApi.completeInspection(id);
            if (!result?.success) {
                console.warn("[Alerts] completeInspection API call failed for id:", id);
            }
        });
    });
}

// ─── Render: Parts ────────────────────────────────────────────────────────────

function renderParts(alerts) {
    const tbody = document.getElementById('parts-table-body');
    if (!tbody) return;

    if (!alerts || alerts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No parts alerts.</td></tr>`;
        return;
    }

    tbody.innerHTML = alerts.map((alert) => `
        <tr>
            <td>
                <div class="vehicle-cell">
                    <span class="vehicle-plate">${alert.vehiclePlate}</span>
                    <span class="vehicle-model">${alert.vehicleModel}</span>
                </div>
            </td>
            <td>${alert.partName}</td>
            <td>${alert.installDate}</td>
            <td>${alert.usage}</td>
            <td>${alert.lifespan}</td>
            <td><span class="chip ${alert.status}">${alert.status === 'warning' ? 'Low Life' : 'Good'}</span></td>
            <td>
                ${alert.status === 'success' ? '' : `<button class="button primary sm work-order-btn">+ Work Order</button>`}
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.work-order-btn').forEach((btn) => {
        btn.addEventListener('click', () => navigate('/work-orders'));
    });
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function initTabs() {
    const tabs = document.querySelectorAll('.tab-item');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');

            tabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');

            contents.forEach((content) => {
                content.style.display = content.id === `${target}-content` ? 'block' : 'none';
            });
        });
    });
}

// ─── Badge counts ─────────────────────────────────────────────────────────────

function updateBadges(data) {
    const badges = {
        odometer:   data.odometer.filter((a) => a.status !== 'success').length,
        insurance:  data.insurance.filter((a) => a.status !== 'success').length,
        inspection: data.inspection.filter((a) => a.status !== 'success').length,
        parts:      data.parts.filter((a) => a.status !== 'success').length,
    };

    Object.keys(badges).forEach((type) => {
        const tab = document.querySelector(`.tab-item[data-tab="${type}"] .tab-badge`);
        if (tab) tab.textContent = badges[type];
    });
}