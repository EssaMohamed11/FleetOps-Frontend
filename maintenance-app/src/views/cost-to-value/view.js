import CostToValueApi from "../../services/api/cost-to-value.js";

// ─── State ────────────────────────────────────────────────────────────────────
let root = null;
let vehicles = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MAX_CHART_Y = 60; // chart Y-axis max %

function fmtEgp(value) {
    return `EGP ${Number(value).toLocaleString()}`;
}

function fmtDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "/");
}

function riskClass(riskLevel) {
    if (riskLevel === "Retire") return "retire";
    if (riskLevel === "Monitor") return "monitor";
    return "safe";
}

function riskLabel(riskLevel) {
    if (riskLevel === "Retire") return "⚠ Retire";
    if (riskLevel === "Monitor") return "Monitor";
    return "Safe";
}

// ─── Render Summary ───────────────────────────────────────────────────────────
function renderSummary() {
    const safe    = vehicles.filter(v => v.riskLevel === "Safe").length;
    const monitor = vehicles.filter(v => v.riskLevel === "Monitor").length;
    const retire  = vehicles.filter(v => v.riskLevel === "Retire").length;

    root.querySelector("#ctv-count-safe").textContent    = safe;
    root.querySelector("#ctv-count-monitor").textContent = monitor;
    root.querySelector("#ctv-count-retire").textContent  = retire;
}

// ─── Render Chart ─────────────────────────────────────────────────────────────
function renderChart() {
    const bars      = root.querySelector("#ctv-chart-bars");
    const grid      = root.querySelector("#ctv-chart-grid");
    const linRetire = root.querySelector("#ctv-line-retire");
    const linMonitor= root.querySelector("#ctv-line-monitor");
    const plot      = root.querySelector("#ctv-chart-plot");

    if (!bars || !grid) return;

    // Y-axis grid labels (60, 50, 40, 30, 20, 10, 0)
    const steps = [60, 50, 40, 30, 20, 10, 0];
    grid.innerHTML = steps.map(s => `<span>${s}</span>`).join("");

    // Threshold lines — positioned from bottom of plot area
    // The plot has padding-top:18px and padding-bottom:40px
    // We position as % from top of the plot element
    const retirePct  = 40 / MAX_CHART_Y * 100;
    const monitorPct = 25 / MAX_CHART_Y * 100;

    // top% = 100 - valuePct (since bars grow from bottom)
    // But we need to account for the padding. Use CSS calc approach:
    linRetire.style.top  = `calc(${100 - retirePct}% - 0px)`;
    linMonitor.style.top = `calc(${100 - monitorPct}% - 0px)`;

    bars.style.setProperty("--ctv-bar-count", String(vehicles.length));
    bars.innerHTML = vehicles.map(v => {
        const cls    = riskClass(v.riskLevel);
        const height = `${Math.min((v.ctvRatio / MAX_CHART_Y) * 100, 100)}%`;
        return `
            <div class="ctv-chart__bar-group"
                 data-plate="${v.plate}"
                 data-ratio="${v.ctvRatio}"
                 data-risk="${v.riskLevel}">
                <div class="ctv-chart__bar-bg"></div>
                <div class="ctv-chart__bar ctv-chart__bar--${cls}"
                     style="--bar-height: ${height};"></div>
                <span class="ctv-chart__label">${v.plate}</span>
            </div>
        `;
    }).join("");
}

// ─── Render Table ─────────────────────────────────────────────────────────────
function renderTable() {
    const body = root.querySelector("#ctv-table-body");
    if (!body) return;

    body.innerHTML = vehicles.map(v => {
        const cls   = riskClass(v.riskLevel);
        const barW  = Math.min(v.ctvRatio, 100);
        return `
            <tr class="ctv-row--${cls}">
                <td class="ctv-table__plate">${v.plate}</td>
                <td>${v.type}</td>
                <td>${fmtEgp(v.marketValueEgp)}</td>
                <td>${fmtEgp(v.totalRepairCostEgp)}</td>
                <td>
                    <div class="ctv-ratio-wrap">
                        <div class="ctv-ratio-bar">
                            <div class="ctv-ratio-bar__fill ctv-ratio-bar__fill--${cls}"
                                 style="width: ${barW}%;"></div>
                        </div>
                        <span class="ctv-ratio-value ctv-ratio-value--${cls}">${v.ctvRatio}%</span>
                    </div>
                </td>
                <td>
                    <span class="ctv-risk-badge ctv-risk-badge--${cls}">${riskLabel(v.riskLevel)}</span>
                </td>
                <td>${fmtDate(v.lastMajorRepair)}</td>
                <td>
                    <button class="ctv-details-btn" data-nav="/cost-to-value/details?plate=${encodeURIComponent(v.plate)}">
                        ⊕ Details
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function handleMouseOver(e) {
    const group = e.target.closest(".ctv-chart__bar-group");
    if (!group) return;
    const tooltip = root.querySelector("#ctv-chart-tooltip");
    if (!tooltip) return;
    const cls = riskClass(group.dataset.risk);
    root.querySelector("#ctv-tooltip-vehicle").textContent = group.dataset.plate;
    root.querySelector("#ctv-tooltip-ratio").textContent   = `CTV Ratio: ${group.dataset.ratio}%`;
    const riskEl = root.querySelector("#ctv-tooltip-risk");
    riskEl.textContent  = group.dataset.risk;
    riskEl.className    = `ctv-chart-tooltip__risk is-${cls}`;
    tooltip.classList.add("is-visible");
}

function handleMouseMove(e) {
    const tooltip = root.querySelector("#ctv-chart-tooltip");
    if (tooltip?.classList.contains("is-visible")) {
        tooltip.style.left = `${e.clientX + 14}px`;
        tooltip.style.top  = `${e.clientY + 14}px`;
    }
}

function handleMouseOut(e) {
    if (e.target.closest(".ctv-chart__bar-group")) {
        root.querySelector("#ctv-chart-tooltip")?.classList.remove("is-visible");
    }
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function navigate(path) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
}

function handleClick(e) {
    const btn = e.target.closest("[data-nav]");
    if (btn) {
        e.preventDefault();
        navigate(btn.dataset.nav);
    }
}

// ─── Mount / Unmount ─────────────────────────────────────────────────────────
export function mount(rootElement) {
    root = rootElement;

    try {
        vehicles = CostToValueApi.getAllVehicles();
        renderSummary();
        renderChart();
        renderTable();

        root.addEventListener("click", handleClick);
        root.addEventListener("mouseover", handleMouseOver);
        root.addEventListener("mousemove", handleMouseMove);
        root.addEventListener("mouseout", handleMouseOut);
    } catch (err) {
        console.error("Failed to load cost-to-value data", err);
        root.innerHTML = `
            <section style="padding:32px;text-align:center;color:var(--color-text-body)">
                <h3>Failed to load data</h3>
                <p>Please refresh the page and try again.</p>
            </section>
        `;
    }
}

export function unmount() {
    if (!root) return;
    root.removeEventListener("click", handleClick);
    root.removeEventListener("mouseover", handleMouseOver);
    root.removeEventListener("mousemove", handleMouseMove);
    root.removeEventListener("mouseout", handleMouseOut);
    root = null;
    vehicles = [];
}
