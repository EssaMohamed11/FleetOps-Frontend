import FuelApi from "../../services/api/fuel.js";
import WorkOrdersApi from "../../services/api/work-orders.js";

const RANGE_OPTIONS = [
    { value: "this-month", label: "This Month" },
    { value: "last-month", label: "Last Month" },
    { value: "q1-2026", label: "Q1 2026" },
    { value: "custom", label: "Custom" },
];
const DEFAULT_FUEL_DISCREPANCY_THRESHOLD = 10;

let root = null;
let appState = {
    records: [],
    invoices: [],
    vehicles: [],
    activeTab: "audit",
    activeRange: "this-month",
    customPeriod: "",
};

function formatMonth(period) {
    if (!period) {
        return "";
    }

    const [year, month] = period.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);

    return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    });
}

function formatDistance(value) {
    return `${Number(value).toLocaleString()} km`;
}

function formatLiters(value) {
    return `${Number(value).toLocaleString(undefined, {
        maximumFractionDigits: 1,
    })} L`;
}

function formatEfficiency(value) {
    return `${Number(value).toFixed(1)} km/L`;
}

function getDiscrepancyPct(record) {
    if (!record.expectedFuelLiters) {
        return 0;
    }

    return ((record.actualFuelLiters - record.expectedFuelLiters) / record.expectedFuelLiters) * 100;
}

function getThreshold() {
    return DEFAULT_FUEL_DISCREPANCY_THRESHOLD;
}

function getFlagMeta(discrepancy) {
    const absolute = Math.abs(discrepancy);
    const threshold = getThreshold();

    if (absolute >= threshold * 2) {
        return {
            label: "Investigate",
            className: "is-investigate",
            rowClass: "fuel-row--investigate",
        };
    }

    if (absolute >= threshold) {
        return {
            label: "Review",
            className: "is-review",
            rowClass: "fuel-row--review",
        };
    }

    return {
        label: "None",
        className: "is-none",
        rowClass: "",
    };
}

function getDiscrepancyClass(discrepancy) {
    const absolute = Math.abs(discrepancy);
    const threshold = getThreshold();

    if (absolute >= threshold * 2) {
        return "is-danger";
    }

    if (absolute >= threshold) {
        return "is-warning";
    }

    return "is-neutral";
}

function getSortedPeriods() {
    return [...new Set(appState.records.map((record) => record.period))].sort().reverse();
}

function getLatestPeriod() {
    return getSortedPeriods()[0] || "";
}

function getLastPeriod() {
    const periods = getSortedPeriods();
    return periods[1] || periods[0] || "";
}

function getQuarterPeriods(year, quarter) {
    const quarterMonths = {
        1: ["01", "02", "03"],
        2: ["04", "05", "06"],
        3: ["07", "08", "09"],
        4: ["10", "11", "12"],
    };

    return getSortedPeriods().filter((period) => {
        const [periodYear, periodMonth] = period.split("-");
        return periodYear === String(year) && quarterMonths[quarter].includes(periodMonth);
    });
}

function getActivePeriods() {
    switch (appState.activeRange) {
        case "last-month":
            return getLastPeriod() ? [getLastPeriod()] : [];
        case "q1-2026": {
            const q1Periods = getQuarterPeriods(2026, 1);
            return q1Periods.length ? q1Periods : (getLastPeriod() ? [getLastPeriod()] : []);
        }
        case "custom":
            return appState.customPeriod ? [appState.customPeriod] : (getLatestPeriod() ? [getLatestPeriod()] : []);
        case "this-month":
        default:
            return getLatestPeriod() ? [getLatestPeriod()] : [];
    }
}

function getSelectionLabel() {
    switch (appState.activeRange) {
        case "last-month":
            return "Last Month";
        case "q1-2026":
            return "Q1 2026";
        case "custom":
            return appState.customPeriod ? formatMonth(appState.customPeriod) : "Custom";
        case "this-month":
        default:
            return "This Month";
    }
}

function getSelectionFileSuffix() {
    if (appState.activeRange === "custom") {
        return appState.customPeriod || "custom";
    }

    return appState.activeRange;
}

function aggregateRecords(records) {
    const grouped = new Map();
    const activePeriods = getActivePeriods();
    const displayPeriod =
        activePeriods.length === 1
            ? formatMonth(activePeriods[0])
            : getSelectionLabel();

    records.forEach((record) => {
        const existing = grouped.get(record.vehiclePlate) || {
            vehiclePlate: record.vehiclePlate,
            vehicleType: record.vehicleType,
            gpsDistanceKm: 0,
            expectedFuelLiters: 0,
            actualFuelLiters: 0,
            avgEfficiencyKmL: 0,
            displayPeriod,
            sourcePeriods: [],
        };

        existing.gpsDistanceKm += record.gpsDistanceKm;
        existing.expectedFuelLiters += record.expectedFuelLiters;
        existing.actualFuelLiters += record.actualFuelLiters;
        existing.sourcePeriods.push(record.period);
        existing.avgEfficiencyKmL =
            existing.actualFuelLiters > 0
                ? Number((existing.gpsDistanceKm / existing.actualFuelLiters).toFixed(1))
                : record.avgEfficiencyKmL;

        grouped.set(record.vehiclePlate, existing);
    });

    return [...grouped.values()];
}

function getSelectedRecords() {
    const activePeriods = getActivePeriods();

    return aggregateRecords(
        appState.records.filter((record) => activePeriods.includes(record.period)),
    ).sort((left, right) => getDiscrepancyPct(right) - getDiscrepancyPct(left));
}

function getPreviousRecord(vehiclePlate, period) {
    const records = appState.records
        .filter(
            (record) =>
                record.vehiclePlate === vehiclePlate && record.period < period,
        )
        .sort((left, right) => right.period.localeCompare(left.period));

    return records[0] || null;
}

function getComparatorRows() {
    const comparisonPeriod = getActivePeriods()[0] || "";

    return getSelectedRecords()
        .map((record) => {
            const currentPeriodRecord =
                appState.records.find(
                    (item) =>
                        item.vehiclePlate === record.vehiclePlate &&
                        item.period === comparisonPeriod,
                ) || record;
            const previousRecord = getPreviousRecord(record.vehiclePlate, comparisonPeriod);
            const trend = previousRecord
                ? Number(
                    (
                        currentPeriodRecord.avgEfficiencyKmL -
                        previousRecord.avgEfficiencyKmL
                    ).toFixed(1),
                )
                : 0;

            return {
                ...record,
                trend,
            };
        })
        .sort((left, right) => right.avgEfficiencyKmL - left.avgEfficiencyKmL);
}

function getFleetAverage(rows) {
    if (!rows.length) {
        return 0;
    }

    const total = rows.reduce((sum, row) => sum + row.avgEfficiencyKmL, 0);
    return total / rows.length;
}

function renderPeriodOptions() {
    const rangeSelect = root.querySelector("#fuel-range-filter");
    const customSelect = root.querySelector("#fuel-custom-period-filter");
    const customWrap = root.querySelector("#fuel-custom-period-wrap");

    if (!rangeSelect || !customSelect || !customWrap) {
        return;
    }

    rangeSelect.innerHTML = RANGE_OPTIONS.map(
        (option) => `
                <option value="${option.value}" ${option.value === appState.activeRange ? "selected" : ""}>
                    ${option.label}
                </option>
            `,
    ).join("");

    customSelect.innerHTML = getSortedPeriods()
        .map(
            (period) => `
                <option value="${period}" ${period === appState.customPeriod ? "selected" : ""}>
                    ${formatMonth(period)}
                </option>
            `,
        )
        .join("");

    customWrap.hidden = appState.activeRange !== "custom";
}

function renderAlert(records) {
    const alert = root.querySelector("#fuel-flag-alert");
    if (!alert) {
        return;
    }

    const flaggedCount = records.filter((record) => {
        const discrepancy = Math.abs(getDiscrepancyPct(record));
        return discrepancy >= getThreshold();
    }).length;

    if (!flaggedCount) {
        alert.hidden = true;
        alert.textContent = "";
        return;
    }

    alert.hidden = false;
    alert.textContent = `${flaggedCount} vehicle${flaggedCount > 1 ? "s" : ""} flagged for fuel discrepancy. Review and investigate.`;
}

function renderToolbar(records) {
    const count = root.querySelector("#fuel-record-count");
    if (!count) {
        return;
    }

    count.textContent = `${records.length} vehicles tracked`;
}

function renderAuditTable(records) {
    const body = root.querySelector("#fuel-audit-body");
    const empty = root.querySelector("#fuel-audit-empty");
    const table = root.querySelector("#fuel-audit-table");

    if (!body || !empty || !table) {
        return;
    }

    if (!records.length) {
        body.innerHTML = "";
        empty.hidden = false;
        table.hidden = true;
        return;
    }

    empty.hidden = true;
    table.hidden = false;
    body.innerHTML = records
        .map((record) => {
            const discrepancy = getDiscrepancyPct(record);
            const flagMeta = getFlagMeta(discrepancy);
            const discrepancyClass = getDiscrepancyClass(discrepancy);
            const sign = discrepancy > 0 ? "+" : "";

            return `
                <tr class="${flagMeta.rowClass}">
                    <td class="fuel-table__plate">${record.vehiclePlate}</td>
                    <td class="fuel-table__period">${record.displayPeriod}</td>
                    <td>${formatDistance(record.gpsDistanceKm)}</td>
                    <td>${formatLiters(record.expectedFuelLiters)}</td>
                    <td>${formatLiters(record.actualFuelLiters)}</td>
                    <td class="fuel-table__discrepancy ${discrepancyClass}">${sign}${discrepancy.toFixed(1)}%</td>
                    <td>
                        <span class="fuel-table__flag ${flagMeta.className}">${flagMeta.label}</span>
                    </td>
                </tr>
            `;
        })
        .join("");
}

function renderComparator() {
    const rows = getComparatorRows();
    const body = root.querySelector("#fuel-comparator-body");
    const empty = root.querySelector("#fuel-comparator-empty");
    const table = root.querySelector("#fuel-comparator-table");
    const fleetAverage = getFleetAverage(rows);
    const best = rows[0] || null;
    const worst = rows[rows.length - 1] || null;

    root.querySelector("#fleet-average-value").textContent = formatEfficiency(fleetAverage || 0);
    root.querySelector("#fuel-best-value").textContent = best
        ? `${best.vehiclePlate} — ${formatEfficiency(best.avgEfficiencyKmL)}`
        : "—";
    root.querySelector("#fuel-worst-value").textContent = worst
        ? `${worst.vehiclePlate} — ${formatEfficiency(worst.avgEfficiencyKmL)}`
        : "—";

    if (!body || !empty || !table) {
        return;
    }

    if (!rows.length) {
        body.innerHTML = "";
        empty.hidden = false;
        table.hidden = true;
        renderChart(rows, fleetAverage);
        return;
    }

    empty.hidden = true;
    table.hidden = false;
    body.innerHTML = rows
        .map((record, index) => {
            const vsFleet = fleetAverage
                ? ((record.avgEfficiencyKmL - fleetAverage) / fleetAverage) * 100
                : 0;
            const trendClass =
                record.trend > 0 ? "is-up" : record.trend < 0 ? "is-down" : "is-flat";
            const trendLabel =
                record.trend > 0
                    ? `↗ +${record.trend.toFixed(1)}`
                    : record.trend < 0
                        ? `↘ ${record.trend.toFixed(1)}`
                        : "→ 0.0";

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td class="fuel-table__plate">${record.vehiclePlate}</td>
                    <td>${record.vehicleType}</td>
                    <td>${formatEfficiency(record.avgEfficiencyKmL)}</td>
                    <td class="fuel-table__vs ${vsFleet < 0 ? "is-negative" : ""}">
                        ${vsFleet >= 0 ? "+" : ""}${vsFleet.toFixed(1)}%
                    </td>
                    <td><span class="fuel-table__trend ${trendClass}">${trendLabel}</span></td>
                </tr>
            `;
        })
        .join("");

    renderChart(rows, fleetAverage);
}

function renderChart(rows, fleetAverage) {
    const bars = root.querySelector("#fuel-chart-bars");
    const averageLine = root.querySelector("#fuel-chart-average-line");
    const maxY = 16;

    if (!bars || !averageLine) {
        return;
    }

    if (!rows.length) {
        bars.innerHTML = "";
        averageLine.hidden = true;
        return;
    }

    averageLine.hidden = false;
    bars.style.setProperty("--fuel-bar-count", String(rows.length));
    bars.innerHTML = rows
        .map((row) => {
            const height = `${Math.min((row.avgEfficiencyKmL / maxY) * 100, 100)}%`;

            return `
                <div class="fuel-chart__bar-group" data-vehicle="${row.vehiclePlate}" data-efficiency="${formatEfficiency(row.avgEfficiencyKmL)}">
                    <div class="fuel-chart__bar-bg"></div>
                    <div
                        class="fuel-chart__bar ${row.avgEfficiencyKmL >= fleetAverage ? "is-above-average" : ""}"
                        style="--bar-height: ${height};"
                    ></div>
                    <span class="fuel-chart__label">${row.vehiclePlate}</span>
                </div>
            `;
        })
        .join("");

    averageLine.style.top = `${100 - Math.min((fleetAverage / maxY) * 100, 100)}%`;
}

function renderPanels() {
    const alert = root.querySelector("#fuel-flag-alert");

    root.querySelectorAll(".fuel-tab").forEach((tab) => {
        tab.classList.toggle("is-active", tab.dataset.tab === appState.activeTab);
    });

    root.querySelectorAll(".fuel-panel").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.panel === appState.activeTab);
    });

    if (alert) {
        alert.hidden = appState.activeTab !== "audit" || alert.textContent === "";
    }
}

function render() {
    if (!root) {
        return;
    }

    const periodRecords = getSelectedRecords();
    renderPeriodOptions();
    renderAlert(periodRecords);
    renderToolbar(periodRecords);
    renderAuditTable(periodRecords);
    renderComparator();
    renderPanels();
}

function setFormMessage(message = "") {
    const messageElement = root.querySelector("#fuel-form-message");
    if (!messageElement) {
        return;
    }

    messageElement.hidden = !message;
    messageElement.textContent = message;
}

function openModal() {
    const modal = root.querySelector("#fuel-invoice-modal");
    const form = root.querySelector("#fuel-invoice-form");
    if (!modal || !form) {
        return;
    }

    form.reset();
    setFormMessage("");
    root.querySelector("#fuel-fill-date").value = `${getActivePeriods()[0] || getLatestPeriod()}-22`;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
    const modal = root.querySelector("#fuel-invoice-modal");
    if (!modal) {
        return;
    }

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
}

function downloadCsv(filename, rows) {
    const csvContent = rows
        .map((row) =>
            row
                .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
                .join(","),
        )
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function exportAuditCsv() {
    const rows = getSelectedRecords().map((record) => {
        const discrepancy = getDiscrepancyPct(record);
        const flagMeta = getFlagMeta(discrepancy);

        return [
            record.vehiclePlate,
            record.displayPeriod,
            record.gpsDistanceKm,
            record.expectedFuelLiters,
            record.actualFuelLiters,
            discrepancy.toFixed(1),
            flagMeta.label,
        ];
    });

    downloadCsv(`fuel-audit-${getSelectionFileSuffix()}.csv`, [
        ["Vehicle", "Period", "GPS Distance (km)", "Expected Fuel (L)", "Actual Fuel (L)", "Discrepancy %", "Flag"],
        ...rows,
    ]);
}

function exportComparatorCsv() {
    const rows = getComparatorRows();
    const fleetAverage = getFleetAverage(rows);

    downloadCsv(`fuel-efficiency-${getSelectionFileSuffix()}.csv`, [
        ["Rank", "Vehicle", "Type", "Avg Efficiency (km/L)", "vs Fleet Avg %", "Trend (km/L)"],
        ...rows.map((record, index) => [
            index + 1,
            record.vehiclePlate,
            record.vehicleType,
            record.avgEfficiencyKmL.toFixed(1),
            fleetAverage
                ? (((record.avgEfficiencyKmL - fleetAverage) / fleetAverage) * 100).toFixed(1)
                : "0.0",
            record.trend.toFixed(1),
        ]),
    ]);
}

function handleClick(event) {
    const tab = event.target.closest(".fuel-tab");
    if (tab) {
        appState.activeTab = tab.dataset.tab;
        render();
        return;
    }

    if (event.target.closest("#fuel-add-invoice-btn")) {
        openModal();
        return;
    }

    if (event.target.closest("#fuel-close-modal-btn") || event.target.closest("#fuel-cancel-modal-btn")) {
        closeModal();
        return;
    }

    if (event.target.id === "fuel-invoice-modal") {
        closeModal();
        return;
    }

    if (event.target.closest("#fuel-export-btn")) {
        if (appState.activeTab === "audit") {
            exportAuditCsv();
        } else {
            exportComparatorCsv();
        }
    }
}

function handleChange(event) {
    if (event.target.id === "fuel-range-filter") {
        appState.activeRange = event.target.value;

        if (!appState.customPeriod) {
            appState.customPeriod = getLatestPeriod();
        }

        render();
        return;
    }

    if (event.target.id === "fuel-custom-period-filter") {
        appState.customPeriod = event.target.value;
        render();
    }
}

async function handleSubmit(event) {
    if (event.target.id !== "fuel-invoice-form") {
        return;
    }

    event.preventDefault();
    setFormMessage("");

    const formData = new FormData(event.target);
    const vehiclePlate = String(formData.get("vehiclePlate") || "").trim().toUpperCase();
    const fillDate = String(formData.get("fillDate") || "").trim();
    const litersFilled = Number(formData.get("litersFilled"));
    const totalCostEgp = Number(formData.get("totalCostEgp"));
    const odometerKm = Number(formData.get("odometerKm"));
    const supplier = String(formData.get("supplier") || "").trim();

    if (!/^EGY-\d{4}$/.test(vehiclePlate)) {
        setFormMessage("Vehicle plate must use the format EGY-1234.");
        return;
    }

    if (!fillDate || litersFilled <= 0 || totalCostEgp <= 0 || odometerKm < 0) {
        setFormMessage("Please enter valid fuel invoice details before saving.");
        return;
    }

    const vehicle =
        appState.vehicles.find((item) => item.plate === vehiclePlate) || null;

    if (!vehicle) {
        setFormMessage("Vehicle plate must match an existing vehicle in the fleet.");
        return;
    }

    const saveButton = root.querySelector("#fuel-save-invoice-btn");
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        const result = await FuelApi.createFuelInvoice({
            vehiclePlate,
            vehicleType: vehicle?.category || "Unknown",
            fillDate,
            litersFilled,
            totalCostEgp,
            odometerKm,
            supplier,
        });

        const nextState = await FuelApi.getFuelState();
        appState.records = nextState.records;
        appState.invoices = nextState.invoices;
        appState.activeRange = "custom";
        appState.customPeriod = result.invoice.period;
        closeModal();
        render();
    } catch (error) {
        console.error("Failed to save fuel invoice", error);
        setFormMessage("Could not save this invoice. Please try again.");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Invoice";
    }
}

function handleKeydown(event) {
    if (event.key === "Escape") {
        closeModal();
    }
}

function handleMouseOver(event) {
    const group = event.target.closest(".fuel-chart__bar-group");
    if (group) {
        const tooltip = root.querySelector("#fuel-chart-tooltip");
        if (tooltip) {
            root.querySelector("#fuel-tooltip-vehicle").textContent = group.dataset.vehicle;
            root.querySelector("#fuel-tooltip-efficiency").textContent = `Efficiency: ${group.dataset.efficiency}`;
            tooltip.classList.add("is-visible");
        }
    }
}

function handleMouseMove(event) {
    const tooltip = root.querySelector("#fuel-chart-tooltip");
    if (tooltip && tooltip.classList.contains("is-visible")) {
        const offset = 14;
        tooltip.style.left = `${event.clientX + offset}px`;
        tooltip.style.top = `${event.clientY + offset}px`;
    }
}

function handleMouseOut(event) {
    const group = event.target.closest(".fuel-chart__bar-group");
    if (group) {
        const tooltip = root.querySelector("#fuel-chart-tooltip");
        if (tooltip) {
            tooltip.classList.remove("is-visible");
        }
    }
}

export async function mount(rootElement) {
    root = rootElement;

    try {
        const fuelState = await FuelApi.getFuelState();

        appState.records = fuelState.records;
        appState.invoices = fuelState.invoices;
        appState.vehicles = WorkOrdersApi.getVehicles();
        appState.customPeriod = getLatestPeriod();
        appState.activeTab = "audit";

        render();

        root.addEventListener("click", handleClick);
        root.addEventListener("change", handleChange);
        root.addEventListener("submit", handleSubmit);
        root.addEventListener("mouseover", handleMouseOver);
        root.addEventListener("mousemove", handleMouseMove);
        root.addEventListener("mouseout", handleMouseOut);
        document.addEventListener("keydown", handleKeydown);
    } catch (error) {
        console.error("Failed to load fuel page", error);
        root.innerHTML = `
            <section class="fuel-empty-state">
                <h3>Failed to load fuel data</h3>
                <p>Please refresh the page and try again.</p>
            </section>
        `;
    }
}

export function unmount() {
    if (!root) {
        return;
    }

    root.removeEventListener("click", handleClick);
    root.removeEventListener("change", handleChange);
    root.removeEventListener("submit", handleSubmit);
    root.removeEventListener("mouseover", handleMouseOver);
    root.removeEventListener("mousemove", handleMouseMove);
    root.removeEventListener("mouseout", handleMouseOut);
    document.removeEventListener("keydown", handleKeydown);
    root = null;
    appState = {
        records: [],
        invoices: [],
        vehicles: [],
        activeTab: "audit",
        activeRange: "this-month",
        customPeriod: "",
    };
}
