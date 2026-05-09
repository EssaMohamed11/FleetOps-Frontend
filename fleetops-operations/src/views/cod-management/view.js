import CodManagementApi from "../../services/api/cod-management.js";
import {
    createIcons,
    icons,
} from "/node_modules/lucide/dist/esm/lucide.mjs";

let cleanupFns = [];
let state = null;

export async function mount() {
    state = {
        collectionFilter: "All",
        handoverFilter: "All",
        modalRecordId: null,
        records: await CodManagementApi.getRecords(),
        searchTerm: "",
    };

    bindEvents();
    renderPage();
}

export function unmount() {
    cleanupFns.forEach((cleanup) => cleanup?.());
    cleanupFns = [];
    state = null;
}

function bindEvents() {
    cleanupFns = [];

    const searchInput = document.getElementById("cod-search-input");
    const collectionFilters = document.getElementById("cod-collection-filters");
    const handoverFilters = document.getElementById("cod-handover-filters");
    const driverGrid = document.getElementById("cod-driver-grid");
    const tableBody = document.getElementById("cod-table-body");
    const modalRoot = document.getElementById("cod-modal-root");
    const exportButton = document.getElementById("cod-export-btn");

    searchInput?.addEventListener("input", handleSearchInput);
    collectionFilters?.addEventListener("click", handleCollectionFilterClick);
    handoverFilters?.addEventListener("click", handleHandoverFilterClick);
    driverGrid?.addEventListener("click", handleActionClick);
    tableBody?.addEventListener("click", handleActionClick);
    modalRoot?.addEventListener("click", handleModalClick);
    exportButton?.addEventListener("click", handleExport);

    const handleEscape = (event) => {
        if (event.key === "Escape" && state?.modalRecordId) {
            closeModal();
        }
    };

    document.addEventListener("keydown", handleEscape);

    cleanupFns.push(
        () => searchInput?.removeEventListener("input", handleSearchInput),
        () =>
            collectionFilters?.removeEventListener(
                "click",
                handleCollectionFilterClick,
            ),
        () =>
            handoverFilters?.removeEventListener("click", handleHandoverFilterClick),
        () => driverGrid?.removeEventListener("click", handleActionClick),
        () => tableBody?.removeEventListener("click", handleActionClick),
        () => modalRoot?.removeEventListener("click", handleModalClick),
        () => exportButton?.removeEventListener("click", handleExport),
        () => document.removeEventListener("keydown", handleEscape),
    );
}

function renderPage() {
    renderSummary();
    renderMoneyFlow();
    renderDriverSummary();
    renderFilters();
    renderTable();
    renderModal();
    refreshIcons();
}

function renderSummary() {
    const summaryGrid = document.getElementById("cod-summary-grid");
    if (!summaryGrid) {
        return;
    }

    const overview = getOverview();
    const cards = [
        {
            label: "Total Expected",
            value: formatCurrency(overview.totalExpected),
            icon: "wallet",
            tone: "blue",
        },
        {
            label: "Collected From Customers",
            value: formatCurrency(overview.totalCollected),
            icon: "banknote",
            tone: "green",
        },
        {
            label: "Handed Over To Company",
            value: formatCurrency(overview.totalHandedOver),
            icon: "hand-coins",
            tone: "mint",
        },
        {
            label: "Not Handed Over Yet",
            value: formatCurrency(overview.stillWithDrivers),
            icon: "alert-circle",
            tone: "red",
        },
        {
            label: "Failed Collections",
            value: String(overview.failedCollections),
            icon: "ban",
            tone: "slate",
        },
    ];

    summaryGrid.innerHTML = cards
        .map(
            (card) => `
                <article class="cod-summary-card">
                    <div class="cod-summary-card__top">
                        <span class="cod-summary-card__label">${card.label}</span>
                        <span class="cod-summary-card__icon cod-summary-card__icon--${card.tone}">
                            <i data-lucide="${card.icon}"></i>
                        </span>
                    </div>
                    <strong class="cod-summary-card__value">${card.value}</strong>
                </article>
            `,
        )
        .join("");
}

function renderMoneyFlow() {
    const flowCard = document.getElementById("cod-flow-card");
    if (!flowCard) {
        return;
    }

    const overview = getOverview();
    const total = overview.totalExpected || 1;
    const segments = [
        {
            label: `Handed over to company (${formatCurrency(overview.totalHandedOver)})`,
            width: (overview.totalHandedOver / total) * 100,
            className: "is-green",
        },
        {
            label: `Still with driver (${formatCurrency(overview.stillWithDrivers)})`,
            width: (overview.stillWithDrivers / total) * 100,
            className: "is-red",
        },
        {
            label: `Not collected yet (${formatCurrency(overview.notCollectedYet)})`,
            width: (overview.notCollectedYet / total) * 100,
            className: "is-slate",
        },
    ];

    flowCard.innerHTML = `
        <div class="cod-flow-card__header">
            <div>
                <h2 class="cod-section-title">Money Flow Tracker</h2>
            </div>
            <span class="cod-flow-card__meta">
                ${Math.round((overview.totalHandedOver / total) * 100)}% fully settled
            </span>
        </div>

        <div class="cod-flow-bar">
            ${segments
                .map(
                    (segment) => `
                        <span
                            class="cod-flow-segment ${segment.className}"
                            style="width: ${segment.width}%">
                            ${segment.width > 10 ? escapeHtml(segment.label.split(" (")[0]) : ""}
                        </span>
                    `,
                )
                .join("")}
        </div>

        <div class="cod-flow-legend">
            ${segments
                .map(
                    (segment) => `
                        <span class="cod-flow-legend__item">
                            <span class="cod-flow-legend__dot ${segment.className}"></span>
                            <span>${segment.label}</span>
                        </span>
                    `,
                )
                .join("")}
        </div>
    `;
}

function renderDriverSummary() {
    const summary = document.getElementById("cod-driver-summary");
    const grid = document.getElementById("cod-driver-grid");
    if (!summary || !grid) {
        return;
    }

    const driverCards = getDriverSummaries();
    const driversWithCash = driverCards.filter((driver) => driver.stillWithDriver > 0).length;

    summary.textContent =
        driversWithCash > 0
            ? `${driversWithCash} drivers still hold COD cash not yet handed over`
            : "All drivers are fully settled";

    grid.innerHTML = driverCards.map(renderDriverCard).join("");
}

function renderDriverCard(driver) {
    const owesCompany = driver.stillWithDriver > 0;

    return `
        <article class="cod-driver-item ${owesCompany ? "is-alert" : "is-settled"}">
            <div class="cod-driver-item__header">
                <div class="cod-driver-pill">
                    <span class="cod-driver-pill__avatar">${driver.initials}</span>
                    <div class="cod-driver-pill__meta">
                        <strong>${driver.name}</strong>
                        <span>${driver.orderCount} COD orders today</span>
                    </div>
                </div>
                <span class="cod-mini-badge ${owesCompany ? "is-danger" : "is-success"}">
                    ${owesCompany ? "Owes Company" : "All Settled"}
                </span>
            </div>

            <div class="cod-driver-stats">
                <article class="cod-driver-stat">
                    <span>Collected</span>
                    <strong>${formatCurrency(driver.collectedAmount)}</strong>
                </article>
                <article class="cod-driver-stat">
                    <span>Handed Over</span>
                    <strong>${formatCurrency(driver.handedOverAmount)}</strong>
                </article>
                <article class="cod-driver-stat ${owesCompany ? "is-danger" : ""}">
                    <span>Still With Driver</span>
                    <strong>${formatCurrency(driver.stillWithDriver)}</strong>
                </article>
            </div>

            ${
                owesCompany
                    ? `<button class="button primary cod-driver-item__action" type="button" data-action="bulk-handover" data-driver-name="${escapeAttribute(driver.name)}">
                        <i data-lucide="hand-coins"></i>
                        <span>Record Handover for this Driver</span>
                    </button>`
                    : `<div class="cod-driver-item__note">No pending COD cash for this driver.</div>`
            }
        </article>
    `;
}

function renderFilters() {
    renderFilterGroup(
        document.getElementById("cod-collection-filters"),
        CodManagementApi.getCollectionFilters(),
        state.collectionFilter,
        "collection",
    );
    renderFilterGroup(
        document.getElementById("cod-handover-filters"),
        CodManagementApi.getHandoverFilters(),
        state.handoverFilter,
        "handover",
    );
}

function renderFilterGroup(root, options, activeValue, type) {
    if (!root) {
        return;
    }

    root.innerHTML = options
        .map(
            (option) => `
                <button
                    class="cod-filter-chip ${activeValue === option ? "is-active" : ""}"
                    type="button"
                    data-filter-type="${type}"
                    data-filter-value="${option}">
                    ${option}
                </button>
            `,
        )
        .join("");
}

function renderTable() {
    const tbody = document.getElementById("cod-table-body");
    if (!tbody) {
        return;
    }

    const records = getFilteredRecords();

    if (!records.length) {
        tbody.innerHTML = `
            <tr class="is-empty-row">
                <td colspan="10">
                    <div class="cod-empty-state">
                        <div class="cod-empty-state__icon">
                            <i data-lucide="wallet-cards"></i>
                        </div>
                        <strong>No COD records match the current filters.</strong>
                        <p>Try another search term or reset the selected filters.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = records.map(renderTableRow).join("");
}

function renderTableRow(record) {
    return `
        <tr data-record-id="${record.id}">
            <td><span class="cod-id">${record.id}</span></td>
            <td><span class="cod-order-id">${record.orderId}</span></td>
            <td>
                <div class="cod-cell-stack">
                    <strong>${record.customer}</strong>
                    <span>${record.address}</span>
                </div>
            </td>
            <td>
                <span class="cod-driver-pill cod-driver-pill--table">
                    <span class="cod-driver-pill__avatar">${record.driverInitials}</span>
                    <span class="cod-driver-pill__meta">
                        <strong>${record.driver}</strong>
                        <span>${record.vehicleId}</span>
                    </span>
                </span>
            </td>
            <td><strong>${formatCurrency(record.expectedAmount)}</strong></td>
            <td><strong class="${record.collectedAmount > 0 ? "is-money-positive" : "is-money-negative"}">${formatCurrency(record.collectedAmount)}</strong></td>
            <td><span class="${getBalance(record) > 0 ? "is-money-warning" : ""}">${getBalance(record) > 0 ? formatCurrency(getBalance(record)) : "--"}</span></td>
            <td>${renderStatusPill(record.collectionStatus)}</td>
            <td>${renderHandoverPill(record)}</td>
            <td>
                ${
                    canMarkHandedOver(record)
                        ? `<button class="button primary cod-table-action" type="button" data-action="mark-handover" data-record-id="${record.id}">
                            <i data-lucide="hand-coins"></i>
                            <span>Mark Handed Over</span>
                        </button>`
                        : `<button class="cod-icon-button" type="button" data-action="open-details" data-record-id="${record.id}" aria-label="Open details">
                            <i data-lucide="eye"></i>
                        </button>`
                }
            </td>
        </tr>
    `;
}

function renderStatusPill(status) {
    return `<span class="cod-status-pill cod-status-pill--${toKebabCase(status)}">${status}</span>`;
}

function renderHandoverPill(record) {
    if (record.handoverStatus === "Handed Over") {
        return `
            <span class="cod-status-pill cod-status-pill--handed-over">
                <i data-lucide="check-circle-2"></i>
                <span>Handed Over</span>
            </span>
            <div class="cod-pill-meta">${record.handedOverAt}</div>
        `;
    }

    return `<span class="cod-status-pill cod-status-pill--not-handed-over">Not Handed Over</span>`;
}

async function renderModal() {
    const modalRoot = document.getElementById("cod-modal-root");
    if (!modalRoot) {
        return;
    }

    if (!state.modalRecordId) {
        modalRoot.innerHTML = "";
        return;
    }

    const record = await CodManagementApi.getRecordById(state.modalRecordId);
    if (!record) {
        modalRoot.innerHTML = "";
        return;
    }

    modalRoot.innerHTML = `
        <div class="cod-modal-overlay" data-modal-close="overlay">
            <section class="cod-modal-panel" role="dialog" aria-modal="true" aria-label="COD Details">
                <header class="cod-modal-header">
                    <div class="cod-modal-head">
                        <div class="cod-modal-head__icon">
                            <i data-lucide="banknote"></i>
                        </div>
                        <div class="cod-modal-head__copy">
                            <div class="cod-modal-title-row">
                                <strong class="cod-modal-id">${record.id}</strong>
                                ${renderCollectionTag(record.collectionStatus)}
                            </div>
                            <span class="cod-modal-subtitle">
                                Order: ${record.orderId} - ${record.customer}
                            </span>
                        </div>
                    </div>
                    <button class="cod-modal-close" type="button" data-modal-close="button" aria-label="Close">
                        <i data-lucide="x"></i>
                    </button>
                </header>

                <div class="cod-modal-body">
                    <section class="cod-modal-summary">
                        ${renderMetricCard("Expected from Customer", formatCurrency(record.expectedAmount))}
                        ${renderMetricCard("Collected from Customer", formatCurrency(record.collectedAmount), "is-highlight")}
                        ${renderMetricCard("Balance Still Owed", getBalance(record) > 0 ? formatCurrency(getBalance(record)) : "--")}
                    </section>

                    <section class="cod-detail-banner ${record.handoverStatus === "Handed Over" ? "is-success" : "is-warning"}">
                        <div class="cod-detail-banner__title">
                            <i data-lucide="${record.handoverStatus === "Handed Over" ? "hand-coins" : "alert-triangle"}"></i>
                            <strong>${
                                record.handoverStatus === "Handed Over"
                                    ? "Did the Driver Hand Over the Money?"
                                    : "Cash Still Needs to Be Handed Over"
                            }</strong>
                        </div>
                        <span class="cod-mini-badge ${record.handoverStatus === "Handed Over" ? "is-success" : "is-danger"}">
                            ${record.handoverStatus}
                        </span>

                        <div class="cod-detail-banner__grid">
                            ${renderDetailRow("Amount Handed Over", formatCurrency(record.handoverStatus === "Handed Over" ? record.collectedAmount : 0))}
                            ${renderDetailRow("Collected At", record.collectedAt || "--")}
                            ${renderDetailRow("Handed Over At", record.handedOverAt || "--")}
                            ${renderDetailRow("Received By", record.receivedBy || "--")}
                            ${renderDetailRow("Payment Method", record.paymentMethod)}
                            ${renderDetailRow("Receipt No.", record.receiptNumber || "--")}
                        </div>

                        <div class="cod-banner-note ${record.handoverStatus === "Handed Over" ? "is-success" : "is-warning"}">
                            <i data-lucide="${record.handoverStatus === "Handed Over" ? "check-circle-2" : "clock-3"}"></i>
                            <span>${
                                record.handoverStatus === "Handed Over"
                                    ? "Money fully settled - no pending action required."
                                    : record.balanceReason
                            }</span>
                        </div>
                    </section>

                    <section class="cod-info-grid">
                        ${renderInfoTile("Customer", record.customer)}
                        ${renderInfoTile("Phone", record.customerPhone)}
                        ${renderInfoTile("Address", record.address)}
                        ${renderInfoTile("Driver", record.driver)}
                        ${renderInfoTile("Vehicle", record.vehicleId)}
                        ${renderInfoTile("Route", record.routeId)}
                        ${renderInfoTile("Payment Method", record.paymentMethod)}
                        ${renderInfoTile("Collected At", record.collectedAt || "--")}
                    </section>

                    <section class="cod-denomination-section">
                        <h3 class="cod-denomination-title">Cash Denomination Breakdown</h3>
                        <div class="cod-denomination-grid">
                            ${
                                record.denominationBreakdown.length
                                    ? record.denominationBreakdown
                                          .map(
                                              (item) => `
                                                <article class="cod-denomination-card">
                                                    <span>${item.label}</span>
                                                    <strong>x ${item.count}</strong>
                                                </article>
                                            `,
                                          )
                                          .join("")
                                    : `<article class="cod-denomination-card cod-denomination-card--empty">
                                            <span>No cash counted yet</span>
                                       </article>`
                            }
                        </div>
                    </section>
                </div>
            </section>
        </div>
    `;
}

function renderCollectionTag(status) {
    return `<span class="cod-status-pill cod-status-pill--${toKebabCase(status)}">${status}</span>`;
}

function renderMetricCard(label, value, className = "") {
    return `
        <article class="cod-metric-card ${className}">
            <span>${label}</span>
            <strong>${value}</strong>
        </article>
    `;
}

function renderDetailRow(label, value) {
    return `
        <div class="cod-detail-row">
            <span>${label}</span>
            <strong>${value}</strong>
        </div>
    `;
}

function renderInfoTile(label, value) {
    return `
        <article class="cod-info-tile">
            <span>${label}</span>
            <strong>${value}</strong>
        </article>
    `;
}

function handleSearchInput(event) {
    state.searchTerm = event.target.value.trim().toLowerCase();
    renderTable();
    refreshIcons();
}

function handleCollectionFilterClick(event) {
    const button = event.target.closest("[data-filter-type='collection']");
    if (!button) {
        return;
    }

    state.collectionFilter = button.dataset.filterValue;
    renderFilters();
    renderTable();
}

function handleHandoverFilterClick(event) {
    const button = event.target.closest("[data-filter-type='handover']");
    if (!button) {
        return;
    }

    state.handoverFilter = button.dataset.filterValue;
    renderFilters();
    renderTable();
}

function handleActionClick(event) {
    const bulkButton = event.target.closest("[data-action='bulk-handover']");
    const markButton = event.target.closest("[data-action='mark-handover']");
    const openButton = event.target.closest("[data-action='open-details']");
    const row = event.target.closest("[data-record-id]");

    if (bulkButton) {
        bulkMarkForDriver(bulkButton.dataset.driverName);
        return;
    }

    if (markButton) {
        event.stopPropagation();
        markHandedOver(markButton.dataset.recordId);
        return;
    }

    if (openButton) {
        event.stopPropagation();
        openModal(openButton.dataset.recordId);
        return;
    }

    if (row?.dataset.recordId) {
        openModal(row.dataset.recordId);
    }
}

function handleModalClick(event) {
    const overlay = event.target.closest("[data-modal-close='overlay']");
    const closeButton = event.target.closest("[data-modal-close='button']");

    if (event.target === overlay || closeButton) {
        closeModal();
    }
}

async function openModal(recordId) {
    state.modalRecordId = recordId;
    await renderModal();
    refreshIcons();
}

function closeModal() {
    state.modalRecordId = null;
    renderModal();
}

async function markHandedOver(recordId) {
    await CodManagementApi.markHandedOver(recordId);
    state.records = await CodManagementApi.getRecords();
    renderPage();
}

async function bulkMarkForDriver(driverName) {
    const recordsToMark = state.records
        .filter(
            (record) =>
                record.driver === driverName &&
                record.handoverStatus !== "Handed Over" &&
                record.collectedAmount > 0,
        );
        
    await Promise.all(recordsToMark.map((record) => CodManagementApi.markHandedOver(record.id)));

    state.records = await CodManagementApi.getRecords();
    renderPage();
}

function handleExport() {
    const rows = getFilteredRecords();
    const header = [
        "COD ID",
        "Order",
        "Customer",
        "Driver",
        "Expected",
        "Collected",
        "Balance",
        "Collection Status",
        "Handover Status",
    ];

    const csv = [
        header.join(","),
        ...rows.map((record) =>
            [
                record.id,
                record.orderId,
                record.customer,
                record.driver,
                record.expectedAmount,
                record.collectedAmount,
                getBalance(record),
                record.collectionStatus,
                record.handoverStatus,
            ]
                .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                .join(","),
        ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cod-management-egp.csv";
    link.click();
    URL.revokeObjectURL(url);
}

function getFilteredRecords() {
    return state.records.filter((record) => {
        const matchesCollection =
            state.collectionFilter === "All" ||
            record.collectionStatus === state.collectionFilter;
        const matchesHandover =
            state.handoverFilter === "All" ||
            record.handoverStatus === state.handoverFilter;
        const term = state.searchTerm;
        const matchesSearch =
            !term ||
            [
                record.id,
                record.orderId,
                record.customer,
                record.driver,
                record.address,
            ]
                .join(" ")
                .toLowerCase()
                .includes(term);

        return matchesCollection && matchesHandover && matchesSearch;
    });
}

function getOverview() {
    return state.records.reduce(
        (acc, record) => {
            const balance = getBalance(record);
            acc.totalExpected += record.expectedAmount;
            acc.totalCollected += record.collectedAmount;
            acc.totalHandedOver +=
                record.handoverStatus === "Handed Over" ? record.collectedAmount : 0;
            acc.stillWithDrivers +=
                record.handoverStatus !== "Handed Over" ? record.collectedAmount : 0;
            acc.notCollectedYet += balance;
            acc.failedCollections += record.collectionStatus === "Failed" ? 1 : 0;
            return acc;
        },
        {
            totalExpected: 0,
            totalCollected: 0,
            totalHandedOver: 0,
            stillWithDrivers: 0,
            notCollectedYet: 0,
            failedCollections: 0,
        },
    );
}

function getDriverSummaries() {
    const summaryMap = new Map();

    state.records.forEach((record) => {
        if (!summaryMap.has(record.driver)) {
            summaryMap.set(record.driver, {
                name: record.driver,
                initials: record.driverInitials,
                orderCount: 0,
                collectedAmount: 0,
                handedOverAmount: 0,
                stillWithDriver: 0,
            });
        }

        const driver = summaryMap.get(record.driver);
        driver.orderCount += 1;
        driver.collectedAmount += record.collectedAmount;
        if (record.handoverStatus === "Handed Over") {
            driver.handedOverAmount += record.collectedAmount;
        } else {
            driver.stillWithDriver += record.collectedAmount;
        }
    });

    return [...summaryMap.values()];
}

function getBalance(record) {
    return Math.max(record.expectedAmount - record.collectedAmount, 0);
}

function canMarkHandedOver(record) {
    return record.collectedAmount > 0 && record.handoverStatus !== "Handed Over";
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-EG", {
        style: "currency",
        currency: "EGP",
        maximumFractionDigits: 0,
    }).format(value || 0);
}

function toKebabCase(value) {
    return value.toLowerCase().replace(/\s+/g, "-");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

function refreshIcons() {
    createIcons({ icons });
}
