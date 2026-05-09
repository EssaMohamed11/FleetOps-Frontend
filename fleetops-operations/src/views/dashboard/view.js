import DashboardApi from "../../services/api/dashboard.js";

// ─── Pagination state ──────────────────────────────────────────────────────────

const PAGE_SIZE = 5;
let currentPage  = 1;
let cachedFleet  = [];      // holds the last-fetched fleet rows for pagination
let prevHandler  = null;
let nextHandler  = null;

// ─── Mount / Unmount ───────────────────────────────────────────────────────────

export async function mount(root) {
    currentPage = 1;

    // Show loading skeletons while data arrives
    showLoadingState(root);

    // Fetch all dashboard data concurrently
    const [summaryData, fleetData, alertsData, violationsData] = await Promise.all([
        DashboardApi.getSummaryData(),
        DashboardApi.getFleetData(),
        DashboardApi.getAlertsData(),
        DashboardApi.getViolationsData(),
    ]);

    cachedFleet = fleetData;

    renderSummaryCards(root, summaryData);
    renderFleetTable(root, currentPage);
    renderAlerts(root, alertsData);
    renderViolations(root, violationsData);
    initPagination(root);
}

export function unmount(root) {
    const prevBtn = root.querySelector("#fleet-operations-prev");
    const nextBtn = root.querySelector("#fleet-operations-next");

    if (prevBtn && prevHandler) prevBtn.removeEventListener("click", prevHandler);
    if (nextBtn && nextHandler) nextBtn.removeEventListener("click", nextHandler);

    prevHandler = null;
    nextHandler = null;
    cachedFleet = [];
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function showLoadingState(root) {
    // Pulse the summary counts while we wait
    root.querySelectorAll(".report-count").forEach((el) => {
        el.textContent = "—";
        el.style.opacity = "0.4";
    });
    root.querySelectorAll(".report-change").forEach((el) => {
        el.textContent = "…";
        el.style.opacity = "0.4";
    });
}

// ─── Summary Cards ─────────────────────────────────────────────────────────────

function renderSummaryCards(root, summaryData) {
    summaryData.forEach(({ selector, count, change, positive }) => {
        const card = root.querySelector(selector);
        if (!card) return;

        const countEl  = card.querySelector(".report-count");
        const changeEl = card.querySelector(".report-change");

        if (countEl) {
            countEl.textContent  = count;
            countEl.style.opacity = "1";
        }

        if (changeEl) {
            changeEl.textContent  = change;
            changeEl.style.opacity = "1";
            changeEl.style.color   = "";

            if (positive === true)       changeEl.style.color = "var(--color-primary)";
            else if (positive === false) changeEl.style.color = "var(--color-danger)";
            else                         changeEl.style.color = "var(--color-text-muted)";
        }
    });
}

// ─── Fleet Table ───────────────────────────────────────────────────────────────

function renderFleetTable(root, page) {
    const tbody = root.querySelector(".fleet-operations-tbody");
    if (!tbody) return;

    const totalResults = cachedFleet.length;
    const totalPages   = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
    const safePage     = Math.max(1, Math.min(page, totalPages));
    const start        = (safePage - 1) * PAGE_SIZE;
    const pageRows     = cachedFleet.slice(start, start + PAGE_SIZE);

    if (pageRows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:2rem; color:var(--color-text-muted);">
                    No active routes at this time.
                </td>
            </tr>`;
    } else {
        tbody.innerHTML = pageRows
            .map(
                (row) => `
                <tr>
                    <td><strong style="color:var(--color-primary);">${row.routeId}</strong></td>
                    <td>${row.location}</td>
                    <td>${row.driver}</td>
                    <td>${buildProgressCell(row.progress)}</td>
                    <td><span style="font-weight:600;color:var(--color-text-title)">${row.eta}</span></td>
                </tr>`,
            )
            .join("");
    }

    // Results label
    const results = root.querySelector(".fleet-operations-results");
    if (results) {
        const displayStart = totalResults === 0 ? 0 : start + 1;
        const displayEnd   = Math.min(start + PAGE_SIZE, totalResults);
        results.textContent = `Showing ${displayStart}–${displayEnd} of ${totalResults} results`;
    }

    // Pagination buttons
    const prevBtn = root.querySelector("#fleet-operations-prev");
    const nextBtn = root.querySelector("#fleet-operations-next");
    if (prevBtn) prevBtn.disabled = safePage <= 1;
    if (nextBtn) nextBtn.disabled = safePage >= totalPages;
}

// ─── Pagination ────────────────────────────────────────────────────────────────

function initPagination(root) {
    const prevBtn = root.querySelector("#fleet-operations-prev");
    const nextBtn = root.querySelector("#fleet-operations-next");

    prevHandler = () => {
        currentPage = Math.max(1, currentPage - 1);
        renderFleetTable(root, currentPage);
    };

    nextHandler = () => {
        const totalPages = Math.max(1, Math.ceil(cachedFleet.length / PAGE_SIZE));
        currentPage = Math.min(totalPages, currentPage + 1);
        renderFleetTable(root, currentPage);
    };

    prevBtn?.addEventListener("click", prevHandler);
    nextBtn?.addEventListener("click", nextHandler);
}

// ─── Progress Bar Cell ─────────────────────────────────────────────────────────

function buildProgressCell(progress) {
    const pct = Math.max(0, Math.min(100, progress ?? 0));

    const color =
        pct >= 75
            ? "var(--color-primary)"
            : pct >= 40
                ? "var(--color-tertiary)"
                : "var(--color-text-muted)";

    return `
        <div style="display:flex; flex-direction:column; gap:4px; min-width:90px;">
            <div style="
                height: 6px;
                border-radius: 999px;
                background: var(--color-border, #2a2a3a);
                overflow: hidden;">
                <div style="
                    width: ${pct}%;
                    height: 100%;
                    border-radius: 999px;
                    background: ${color};
                    transition: width 0.4s ease;">
                </div>
            </div>
            <span style="font-size:0.72rem; color:${color}; font-weight:600;">${pct}%</span>
        </div>`;
}

// ─── Alerts ────────────────────────────────────────────────────────────────────

function renderAlerts(root, alertsData) {
    const container = root.querySelector(".recent-alerts-content");
    if (!container) return;

    if (!alertsData || alertsData.length === 0) {
        container.innerHTML = `<p style="color:var(--color-text-muted); padding:1rem;">No recent alerts.</p>`;
        return;
    }

    container.innerHTML = alertsData.map(buildAlertCard).join("");
}

function buildAlertCard({ type, time, severity, message }) {
    const severityClass =
        severity === "critical" ? "alert-critical" : "alert-warning";

    const safeMessage = (message ?? "").replace(
        /(V-\d+|ORD-\d+)/g,
        "<strong>$1</strong>",
    );

    return `
        <div class="alert-item ${severityClass}">
            <div class="alert-meta">
                <span class="alert-type">${type ?? "ALERT"}</span>
                <span class="alert-time">${time ?? ""}</span>
            </div>
            <div class="alert-message">${safeMessage}</div>
        </div>`;
}

// ─── Violations ────────────────────────────────────────────────────────────────

function renderViolations(root, violationsData) {
    const container = root.querySelector(".window-violation-content");
    if (!container) return;

    if (!violationsData || violationsData.length === 0) {
        container.innerHTML = `<p style="color:var(--color-text-muted); padding:1rem;">No window violations.</p>`;
        return;
    }

    container.innerHTML = violationsData.map(buildViolationCard).join("");
}

function buildViolationCard({ type, time, severity, message }) {
    const severityClass =
        severity === "critical" ? "alert-critical" : "alert-warning";

    const safeMessage = (message ?? "").replace(
        /(V-\d+|ORD-\d+)/g,
        "<strong>$1</strong>",
    );

    return `
        <div class="alert-item ${severityClass}">
            <div class="alert-meta">
                <span class="alert-type">${type ?? "VIOLATION"}</span>
                <span class="alert-time">${time ?? ""}</span>
            </div>
            <div class="alert-message">${safeMessage}</div>
        </div>`;
}
