import CostToValueApi from "../../../services/api/cost-to-value.js";

// ─── State ────────────────────────────────────────────────────────────────────
let root = null;
let vehicle = null;
let cleanupFns = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtEgp(v) {
    return `EGP ${Number(v).toLocaleString()}`;
}

function fmtDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtKm(v) {
    return `${Number(v).toLocaleString()} km`;
}

function isExpired(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr, days = 30) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (d - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= days;
}

function riskClass(riskLevel) {
    if (riskLevel === "Retire") return "retire";
    if (riskLevel === "Monitor") return "monitor";
    return "safe";
}

function partStatus(usedPct) {
    if (usedPct >= 90) return "overdue";
    if (usedPct >= 70) return "due-soon";
    return "ok";
}

function partStatusLabel(usedPct) {
    if (usedPct >= 90) return "Overdue";
    if (usedPct >= 70) return "Due Soon";
    return "OK";
}

function navigate(path) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
    const v = vehicle;
    const cls = riskClass(v.riskLevel);

    // Show content
    root.querySelector("#ctvd-loading").hidden = true;
    const content = root.querySelector("#ctvd-content");
    content.hidden = false;

    // Header
    root.querySelector("#ctvd-plate").textContent = v.plate;
    root.querySelector("#ctvd-type-badge").textContent = v.type;
    root.querySelector("#ctvd-meta").textContent = `${v.model} · ${v.year} · ${fmtEgp(v.marketValueEgp)}`;

    // Status badge
    const statusBadge = root.querySelector("#ctvd-status-badge");
    const statusKey = v.status.toLowerCase().replace(/\s+/g, "-");
    statusBadge.textContent = v.status;
    statusBadge.className = `ctvd-status-badge ctvd-status-badge--${statusKey}`;

    // Stats
    root.querySelector("#ctvd-odometer").textContent = fmtKm(v.odometer);

    const nextServiceEl = root.querySelector("#ctvd-next-service");
    const nextServiceSub = root.querySelector("#ctvd-next-service-sub");
    const remaining = v.nextServiceKm - v.odometer;
    nextServiceEl.textContent = `${remaining.toLocaleString()} km remaining`;
    nextServiceSub.textContent = `At ${v.nextServiceKm.toLocaleString()} km`;

    // Insurance
    const insEl  = root.querySelector("#ctvd-insurance");
    const insSub = root.querySelector("#ctvd-insurance-sub");
    const insCard = root.querySelector("#ctvd-stat-insurance");
    insEl.textContent = v.insuranceExpiry || "—";
    if (isExpired(v.insuranceExpiry)) {
        insSub.textContent = "EXPIRED";
        insCard.classList.add("ctvd-stat-card--danger");
    } else if (isExpiringSoon(v.insuranceExpiry)) {
        insSub.textContent = "Expiring soon";
        insCard.classList.add("ctvd-stat-card--warning");
    } else {
        insSub.textContent = "";
    }

    // Inspection
    const inspEl  = root.querySelector("#ctvd-inspection");
    const inspSub = root.querySelector("#ctvd-inspection-sub");
    const inspCard = root.querySelector("#ctvd-stat-inspection");
    inspEl.textContent = v.inspectionExpiry || "—";
    if (isExpired(v.inspectionExpiry)) {
        inspSub.textContent = "EXPIRED";
        inspCard.classList.add("ctvd-stat-card--danger");
    } else if (isExpiringSoon(v.inspectionExpiry)) {
        inspSub.textContent = "Expiring soon";
        inspCard.classList.add("ctvd-stat-card--warning");
    } else {
        inspSub.textContent = "";
    }

    root.querySelector("#ctvd-capacity").textContent = `${Number(v.maxCapacityKg).toLocaleString()} kg`;
    root.querySelector("#ctvd-repair-cost").textContent = fmtEgp(v.totalRepairCostEgp);

    // ── CTV Analysis ──────────────────────────────────────────────────────────
    const ratioEl = root.querySelector("#ctvd-ctv-ratio");
    ratioEl.textContent = `${v.ctvRatio}%`;
    ratioEl.className = `ctvd-ctv-ratio ctvd-ctv-ratio--${cls}`;

    const statusEl = root.querySelector("#ctvd-ctv-status");
    if (v.riskLevel === "Retire") {
        statusEl.textContent = "⚠ Retirement Recommended";
    } else if (v.riskLevel === "Monitor") {
        statusEl.textContent = "⚠ Monitor";
    } else {
        statusEl.textContent = "✓ Safe";
    }
    statusEl.className = `ctvd-ctv-status ctvd-ctv-status--${cls}`;

    // Progress bar — show ratio capped at 100%
    const fillEl = root.querySelector("#ctvd-ctv-bar-fill");
    fillEl.style.width = `${Math.min(v.ctvRatio, 100)}%`;
    fillEl.className = `ctvd-ctv-bar__fill ctvd-ctv-bar__fill--${cls}`;

    // Threshold markers (40% and 25% of 100% bar width)
    root.querySelector("#ctvd-ctv-marker-retire").style.left  = "40%";
    root.querySelector("#ctvd-ctv-marker-monitor").style.left = "25%";

    // Threshold label
    const thresholdLabel = root.querySelector("#ctvd-ctv-threshold-label");
    if (v.riskLevel === "Retire") {
        thresholdLabel.textContent = "40% threshold";
    } else if (v.riskLevel === "Monitor") {
        thresholdLabel.textContent = "25% threshold";
    } else {
        thresholdLabel.textContent = "25% threshold";
    }

    // Alert
    const alertEl = root.querySelector("#ctvd-ctv-alert");
    const alertText = root.querySelector("#ctvd-ctv-alert-text");
    alertEl.hidden = false;
    alertEl.className = `ctvd-ctv-alert ctvd-ctv-alert--${cls}`;
    if (v.riskLevel === "Retire") {
        alertText.textContent = "Repair cost exceeds 40% of market value. Consider vehicle retirement.";
    } else if (v.riskLevel === "Monitor") {
        alertText.textContent = "Repair cost is between 25–40% of market value. Monitor closely.";
    } else {
        alertText.textContent = "Vehicle is within safe cost-to-value range.";
    }

    // ── Parts ─────────────────────────────────────────────────────────────────
    const partsList = root.querySelector("#ctvd-parts-list");
    if (v.parts && v.parts.length) {
        partsList.innerHTML = v.parts.map(p => {
            const pStatus = partStatus(p.usedPct);
            const pLabel  = partStatusLabel(p.usedPct);
            return `
                <div class="ctvd-part-item">
                    <div class="ctvd-part-item__header">
                        <div>
                            <span class="ctvd-part-item__name">${p.name}</span>
                            <span class="ctvd-part-item__category"> · ${p.category}</span>
                        </div>
                        <span class="ctvd-part-item__status ctvd-part-item__status--${pStatus}">${pLabel}</span>
                    </div>
                    <div class="ctvd-part-bar-wrap">
                        <span class="ctvd-part-bar-label">${p.usedPct}% used</span>
                        <div class="ctvd-part-bar">
                            <div class="ctvd-part-bar__fill ctvd-part-bar__fill--${pStatus}"
                                 style="width: ${p.usedPct}%;"></div>
                        </div>
                    </div>
                    <div class="ctvd-part-item__meta">
                        <span>Installed ${p.installedDate}</span>
                        <span>${p.lifespanKm.toLocaleString()} km lifespan</span>
                    </div>
                </div>
            `;
        }).join("");
    } else {
        partsList.innerHTML = `<p style="color:var(--color-text-muted);font-size:var(--font-size-sm)">No part data available.</p>`;
    }

    // ── Maintenance History ───────────────────────────────────────────────────
    const histBody = root.querySelector("#ctvd-history-body");
    if (v.maintenanceHistory && v.maintenanceHistory.length) {
        histBody.innerHTML = v.maintenanceHistory.map(h => {
            const typeKey   = h.type.toLowerCase();
            const statusKey = h.status.toLowerCase().replace(/\s+/g, "-");
            return `
                <tr>
                    <td class="ctvd-wo-id">${h.id}</td>
                    <td><span class="ctvd-wo-type ctvd-wo-type--${typeKey}">${h.type}</span></td>
                    <td>${h.mechanic}</td>
                    <td><span class="ctvd-wo-status ctvd-wo-status--${statusKey}">${h.status}</span></td>
                    <td>${h.repairCostEgp ? fmtEgp(h.repairCostEgp) : "—"}</td>
                    <td>${fmtDate(h.opened)}</td>
                    <td>${fmtDate(h.closed)}</td>
                </tr>
            `;
        }).join("");
    } else {
        histBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:20px">No maintenance history.</td></tr>`;
    }

    // ── Fuel Logs ─────────────────────────────────────────────────────────────
    const fuelList = root.querySelector("#ctvd-fuel-list");
    if (v.fuelLogs && v.fuelLogs.length) {
        fuelList.innerHTML = v.fuelLogs.map(f => `
            <div class="ctvd-fuel-item">
                <div class="ctvd-fuel-item__row">
                    <span class="ctvd-fuel-item__date">${f.date}</span>
                    <span class="ctvd-fuel-item__cost">${fmtEgp(f.costEgp)}</span>
                </div>
                <div class="ctvd-fuel-item__row">
                    <span class="ctvd-fuel-item__liters">${f.liters}L</span>
                    <span class="ctvd-fuel-item__liters">${f.odometer.toLocaleString()} km</span>
                </div>
                <span class="ctvd-fuel-item__supplier">${f.supplier}</span>
            </div>
        `).join("");
    } else {
        fuelList.innerHTML = `<p style="color:var(--color-text-muted);font-size:var(--font-size-sm)">No fuel logs available.</p>`;
    }
}

// ─── Event Handlers ───────────────────────────────────────────────────────────
function handleClick(e) {
    if (e.target.closest("#ctvd-create-wo-btn")) {
        navigate(`/work-orders/create?vehicle=${encodeURIComponent(vehicle.plate)}`);
    }
}

// ─── Mount / Unmount ─────────────────────────────────────────────────────────
export function mount(rootElement) {
    root = rootElement;
    cleanupFns = [];

    const params = new URLSearchParams(window.location.search);
    const plate  = params.get("plate");

    if (!plate) {
        root.querySelector("#ctvd-loading").textContent = "No vehicle specified.";
        return;
    }

    try {
        vehicle = CostToValueApi.getVehicleByPlate(plate);

        if (!vehicle) {
            root.querySelector("#ctvd-loading").textContent = `Vehicle "${plate}" not found.`;
            return;
        }

        render();

        const onClick = (e) => handleClick(e);
        root.addEventListener("click", onClick);
        cleanupFns.push(() => root.removeEventListener("click", onClick));
    } catch (err) {
        console.error("Failed to load vehicle details", err);
        root.querySelector("#ctvd-loading").textContent = "Failed to load vehicle data. Please try again.";
    }
}

export function unmount() {
    cleanupFns.forEach(fn => fn && fn());
    cleanupFns = [];
    root = null;
    vehicle = null;
}
