import OrdersApi from "../../services/api/orders.js";
import {
    createIcons,
    icons,
} from "/node_modules/lucide/dist/esm/lucide.mjs";

let cleanupFns = [];
let state = null;

export async function mount() {
    state = {
        activeStatus: "All",
        addForm: null,
        importFileName: "",
        modal: null,
        orders: [],
        searchTerm: "",
    };

    const tbody = document.getElementById("orders-table-body");
    if (tbody) tbody.innerHTML = `<tr><td colspan="12"><div style="text-align: center; padding: 2rem;">Loading orders from server...</div></td></tr>`;

    state.orders = await OrdersApi.getOrders();

    bindPageEvents();
    renderPage();
}

export function unmount() {
    cleanupFns.forEach((cleanup) => cleanup?.());
    cleanupFns = [];
    state = null;
}

function bindPageEvents() {
    cleanupFns = [];

    const searchInput = document.getElementById("orders-search-input");
    const filters = document.getElementById("orders-filters");
    const tbody = document.getElementById("orders-table-body");
    const importButton = document.getElementById("import-orders-btn");
    const addButton = document.getElementById("add-order-btn");
    const exportButton = document.getElementById("export-orders-btn");
    const modalRoot = document.getElementById("orders-modal-root");

    searchInput?.addEventListener("input", handleSearchInput);
    filters?.addEventListener("click", handleFilterClick);
    tbody?.addEventListener("click", handleTableClick);
    importButton?.addEventListener("click", openImportModal);
    addButton?.addEventListener("click", openAddModal);
    exportButton?.addEventListener("click", handleExport);
    modalRoot?.addEventListener("click", handleModalClick);
    modalRoot?.addEventListener("change", handleModalChange);
    modalRoot?.addEventListener("submit", handleModalSubmit);

    const handleEscape = (event) => {
        if (event.key === "Escape" && state?.modal) {
            closeModal();
        }
    };

    document.addEventListener("keydown", handleEscape);

    cleanupFns.push(
        () => searchInput?.removeEventListener("input", handleSearchInput),
        () => filters?.removeEventListener("click", handleFilterClick),
        () => tbody?.removeEventListener("click", handleTableClick),
        () => importButton?.removeEventListener("click", openImportModal),
        () => addButton?.removeEventListener("click", openAddModal),
        () => exportButton?.removeEventListener("click", handleExport),
        () => modalRoot?.removeEventListener("click", handleModalClick),
        () => modalRoot?.removeEventListener("change", handleModalChange),
        () => modalRoot?.removeEventListener("submit", handleModalSubmit),
        () => document.removeEventListener("keydown", handleEscape),
    );
}

function renderPage() {
    renderSummary();
    renderFilters();
    renderTable();
    renderModal();
    refreshIcons();
}

function renderSummary() {
    const summary = document.getElementById("orders-summary");
    if (!summary) {
        return;
    }

    const total = state.orders.length;
    const liveTrackingEnabled = state.orders.filter(
        (order) => order.notificationsSummary.sent > 0,
    ).length;

    summary.textContent = `${total} total orders - ${liveTrackingEnabled} with live tracking enabled`;
}

function renderFilters() {
    const filters = document.getElementById("orders-filters");
    if (!filters) {
        return;
    }

    const active = state.activeStatus;
    filters.innerHTML = OrdersApi.getStatusOptions()
        .map(
            (status) => `
                <button
                    class="orders-filter-chip ${active === status ? "is-active" : ""}"
                    type="button"
                    data-status-filter="${status}">
                    ${status}
                </button>
            `,
        )
        .join("");
}

function renderTable() {
    const tbody = document.getElementById("orders-table-body");
    const footer = document.getElementById("orders-table-footer");

    if (!tbody || !footer) {
        return;
    }

    const filteredOrders = getFilteredOrders();

    if (!filteredOrders.length) {
        tbody.innerHTML = `
            <tr class="is-empty-row">
                <td colspan="12">
                    <div class="orders-empty">
                        <div class="orders-empty__icon">
                            <i data-lucide="package-search"></i>
                        </div>
                        <strong>No orders match this filter.</strong>
                        <p>Try another status or search term.</p>
                    </div>
                </td>
            </tr>
        `;
        footer.textContent = "Showing 0 orders";
        return;
    }

    tbody.innerHTML = filteredOrders.map(renderOrderRow).join("");
    footer.textContent = `Showing ${filteredOrders.length} of ${state.orders.length} orders`;
}

function renderOrderRow(order) {
    const notificationClass =
        order.notificationsSummary.failed > 0 ? "notify-chip is-danger" : "notify-chip";
    const notificationValue =
        order.notificationsSummary.failed > 0
            ? `0/${order.notificationsSummary.total}`
            : `${order.notificationsSummary.sent}/${order.notificationsSummary.total}`;

    return `
        <tr data-order-id="${order.id}">
            <td class="orders-table__check">
                <input type="checkbox" aria-label="Select ${order.id}" />
            </td>
            <td><span class="order-id">${order.id}</span></td>
            <td>
                <div class="order-cell-stack">
                    <strong>${order.customerName}</strong>
                    <span>${order.customerPhone}</span>
                </div>
            </td>
            <td><span class="order-cell-stack"><span>${order.address}</span></span></td>
            <td><strong>${formatWeight(order.weightKg)}</strong></td>
            <td><strong>${order.paymentType}</strong></td>
            <td>${renderPriorityBadge(order.priority)}</td>
            <td><span>${order.paymentWindow}</span></td>
            <td>${renderStatusBadge(order.status)}</td>
            <td>${renderDriverCell(order)}</td>
            <td>
                <button class="${notificationClass}" type="button" data-action="open-order" data-order-id="${order.id}">
                    <i data-lucide="${order.notificationsSummary.failed > 0 ? "bell-off" : "bell"}"></i>
                    <span>${notificationValue}</span>
                </button>
            </td>
            <td>
                <button class="tracking-link-chip" type="button" data-action="open-order" data-order-id="${order.id}">
                    <i data-lucide="square-arrow-out-up-right"></i>
                    <span>Link</span>
                </button>
            </td>
        </tr>
    `;
}

function renderDriverCell(order) {
    if (!order.driver) {
        return "<span>--</span>";
    }

    return `
        <span class="driver-pill">
            <span class="driver-pill__avatar">${order.driver.initials}</span>
            <span class="driver-pill__meta">
                <strong>${order.driver.name}</strong>
                <span>${order.driver.code}</span>
            </span>
        </span>
    `;
}

function renderModal() {
    const modalRoot = document.getElementById("orders-modal-root");
    if (!modalRoot) {
        return;
    }

    if (!state.modal) {
        modalRoot.innerHTML = "";
        return;
    }

    if (state.modal.type === "details" && state.modal.orderData) {
        modalRoot.innerHTML = renderDetailsModal(state.modal.orderData);
        return;
    }

    if (state.modal.type === "import") {
        modalRoot.innerHTML = renderImportModal();
        return;
    }

    if (state.modal.type === "add") {
        modalRoot.innerHTML = renderAddModal();
    }
}

function renderDetailsModal(order) {
    if (!order) {
        return "";
    }

    const activeTab = state.modal?.tab ?? "live";
    const tabContent = renderOrderTabContent(order, activeTab);

    return `
        <div class="modal-overlay" data-modal-close="overlay">
            <section class="modal-panel" role="dialog" aria-modal="true" aria-label="Order details">
                <header class="modal-header">
                    <div class="modal-order-head">
                        <div class="modal-order-icon">
                            <i data-lucide="package"></i>
                        </div>
                        <div class="modal-order-meta">
                            <div class="modal-order-title-row">
                                <strong class="modal-order-id">${order.id}</strong>
                                <div class="modal-tags">
                                    ${renderStatusBadge(order.status)}
                                    <span class="modal-tag modal-tag--priority">${order.priority}</span>
                                </div>
                            </div>
                            <span class="modal-subtitle">${order.customerName} - ${order.address}</span>
                        </div>
                    </div>
                    <button class="modal-close" type="button" data-modal-close="button" aria-label="Close">
                        <i data-lucide="x"></i>
                    </button>
                </header>
                <div class="modal-body">
                    <section class="order-info-grid">
                        ${renderInfoCard("user-round", "Customer", order.customerName, order.customerPhone)}
                        ${renderInfoCard("send", "Driver", order.driver?.name ?? "Unassigned", order.driver?.code ?? "--")}
                        ${renderInfoCard("truck", "Vehicle", order.vehicleId ?? "--", order.vehicleId ? "Assigned vehicle" : "--")}
                        ${renderInfoCard("package", "Payment", order.paymentType, order.paymentWindow)}
                        ${renderInfoCard("map-pin", "Weight / Volume", `${formatWeight(order.weightKg)} / ${order.volumeM3} m3`, order.createdAt)}
                    </section>

                    <section class="tracking-banner">
                        <div class="tracking-banner__left">
                            <i data-lucide="square-arrow-out-up-right"></i>
                            <div class="tracking-banner__copy">
                                <strong>Live Tracking Link (sent to customer automatically)</strong>
                                <a href="${order.trackingLink}" target="_blank" rel="noreferrer">${order.trackingLink}</a>
                            </div>
                        </div>
                        <button class="button primary" type="button" data-action="copy-link" data-link="${order.trackingLink}">
                            <i data-lucide="copy"></i>
                            <span>Copy</span>
                        </button>
                    </section>

                    <section class="tab-strip">
                        <button class="tab-button ${activeTab === "live" ? "is-active" : ""}" type="button" data-tab="live">Live Tracking</button>
                        <button class="tab-button ${activeTab === "notifications" ? "is-active" : ""}" type="button" data-tab="notifications">Notifications</button>
                        <button class="tab-button ${activeTab === "timeline" ? "is-active" : ""}" type="button" data-tab="timeline">Timeline</button>
                    </section>

                    ${tabContent}
                </div>
            </section>
        </div>
    `;
}

function renderInfoCard(icon, label, value, meta) {
    return `
        <article class="order-info-card">
            <span class="order-info-card__label">
                <i data-lucide="${icon}"></i>
                <span>${label}</span>
            </span>
            <strong class="order-info-card__value">${value}</strong>
            <span class="order-info-card__meta">${meta}</span>
        </article>
    `;
}

function renderOrderTabContent(order, activeTab) {
    if (activeTab === "notifications") {
        return `
            <section class="tab-panel">
                <p class="muted-copy">Notifications are sent automatically when an order is added to the system. Each status change also triggers a notification.</p>
                ${order.notifications
                    .map(
                        (item) => `
                            <article class="notification-card">
                                <div class="notification-card__main">
                                    <div class="notification-card__icon">
                                        <i data-lucide="${item.icon}"></i>
                                    </div>
                                    <div class="notification-card__content">
                                        <strong>${item.channel}</strong>
                                        <span>Sent at: ${item.sentAt}</span>
                                        <p>Content: ${item.content}</p>
                                    </div>
                                </div>
                                <span class="channel-status channel-status--${item.status.toLowerCase()}">${item.status.toUpperCase()}</span>
                            </article>
                        `,
                    )
                    .join("")}
                <div class="modal-note">Each status change in the timeline below was also pushed to successfully connected channels.</div>
            </section>
        `;
    }

    if (activeTab === "timeline") {
        return `
            <section class="tab-panel">
                <p class="muted-copy">Every change is visible to the customer in real-time via their tracking link.</p>
                <div class="timeline-list">
                    ${order.timeline
                        .map(
                            (item) => `
                                <article class="timeline-card">
                                    <div class="timeline-card__main">
                                        <span class="timeline-marker">
                                            <i data-lucide="clock-3"></i>
                                        </span>
                                        <div class="timeline-card__copy">
                                            <strong>${item.title}</strong>
                                            <span>${item.description}</span>
                                        </div>
                                    </div>
                                    <div class="timeline-card__meta">
                                        ${item.notified ? '<i data-lucide="bell"></i><span>Notified</span>' : ""}
                                        <span>${item.at}</span>
                                    </div>
                                </article>
                            `,
                        )
                        .join("")}
                </div>
            </section>
        `;
    }

    return `
        <section class="tab-panel">
            <div class="live-empty-state">
                <div>
                    <div class="live-empty-state__icon">
                        <i data-lucide="map-pinned"></i>
                    </div>
                    <strong>${order.liveTrackingMessage}</strong>
                    <p>${order.liveTrackingHint}</p>
                </div>
            </div>
            <article class="customer-view-card">
                <div class="customer-view-card__title">CUSTOMER VIEW</div>
                <p>The customer sees every status change in real-time at their tracking link. When the order is out for delivery, they see the driver's live position on the map.</p>
                <div class="customer-view-card__footer">
                    <span class="status-dot"></span>
                    <span>${order.timeline[0]?.title ?? "Order Created"}</span>
                </div>
            </article>
        </section>
    `;
}

function renderImportModal() {
    const note = OrdersApi.getImportNote();
    const isFilled = Boolean(state.importFileName);

    return `
        <div class="modal-overlay" data-modal-close="overlay">
            <section class="modal-panel modal-panel--compact" role="dialog" aria-modal="true" aria-label="Import orders">
                <header class="modal-header">
                    <div>
                        <h2 class="heading-md">Import Orders</h2>
                    </div>
                    <button class="modal-close" type="button" data-modal-close="button" aria-label="Close">
                        <i data-lucide="x"></i>
                    </button>
                </header>
                <div class="modal-body import-body">
                    <label class="upload-zone ${isFilled ? "is-filled" : ""}" for="orders-import-file">
                        <span class="upload-zone__icon"><i data-lucide="upload"></i></span>
                        <strong>${isFilled ? state.importFileName : "Drop CSV or XML file here"}</strong>
                        <span>${isFilled ? "File selected and ready to import" : "or click to browse files"}</span>
                    </label>
                    <input class="hidden-input" id="orders-import-file" type="file" accept=".csv,.xml,.xlsx,.xls" />
                    <div class="import-note">
                        <i data-lucide="info"></i>
                        <span>${note}</span>
                    </div>
                    <div class="import-footer">
                        <strong>${isFilled ? "Ready to import" : "Select a file to continue"}</strong>
                        <button class="button primary" type="button" data-action="confirm-import" ${isFilled ? "" : "disabled"}>
                            Confirm Import
                        </button>
                    </div>
                </div>
            </section>
        </div>
    `;
}

function renderAddModal() {
    const form = state.addForm ?? {
        address: "",
        customerEmail: "",
        customerName: "",
        customerPhone: "",
        paymentType: "Prepaid",
        paymentWindow: "09:00-12:00",
        priority: "Normal",
        volumeM3: "0.5",
        weightKg: "10",
    };

    const priorityOptions = OrdersApi.getPriorityOptions()
        .map(
            (option) => `
                <option value="${option}" ${form.priority === option ? "selected" : ""}>${option}</option>
            `,
        )
        .join("");

    const paymentOptions = OrdersApi.getPaymentOptions()
        .map(
            (option) => `
                <option value="${option}" ${form.paymentType === option ? "selected" : ""}>${option}</option>
            `,
        )
        .join("");

    return `
        <div class="modal-overlay" data-modal-close="overlay">
            <section class="modal-panel modal-panel--compact" role="dialog" aria-modal="true" aria-label="Add order">
                <header class="modal-header">
                    <div>
                        <h2 class="heading-md">Add Order</h2>
                        <p class="muted-copy">Create a new order entry and auto-generate customer notifications.</p>
                    </div>
                    <button class="modal-close" type="button" data-modal-close="button" aria-label="Close">
                        <i data-lucide="x"></i>
                    </button>
                </header>
                <div class="modal-body">
                    <form class="add-order-form" id="add-order-form">
                        <div class="form-grid">
                            <label>
                                <span class="label">Customer Name</span>
                                <input name="customerName" value="${form.customerName}" required />
                            </label>
                            <label>
                                <span class="label">Phone Number</span>
                                <input name="customerPhone" value="${form.customerPhone}" required />
                            </label>
                            <label>
                                <span class="label">Email</span>
                                <input name="customerEmail" type="email" value="${form.customerEmail}" required />
                            </label>
                            <label>
                                <span class="label">Payment</span>
                                <select name="paymentType" required>${paymentOptions}</select>
                            </label>
                            <label class="full-span">
                                <span class="label">Address</span>
                                <input name="address" value="${form.address}" required />
                            </label>
                            <label>
                                <span class="label">Delivery Window</span>
                                <input name="paymentWindow" value="${form.paymentWindow}" required />
                            </label>
                            <label>
                                <span class="label">Priority</span>
                                <select name="priority">${priorityOptions}</select>
                            </label>
                            <label>
                                <span class="label">Weight (kg)</span>
                                <input name="weightKg" type="number" min="0" step="0.1" value="${form.weightKg}" required />
                            </label>
                            <label>
                                <span class="label">Volume (m3)</span>
                                <input name="volumeM3" type="number" min="0" step="0.1" value="${form.volumeM3}" required />
                            </label>
                        </div>
                        <div class="modal-actions">
                            <button class="button secondary" type="button" data-modal-close="button">Cancel</button>
                            <button class="button primary" type="submit">Create Order</button>
                        </div>
                    </form>
                </div>
            </section>
        </div>
    `;
}

function handleSearchInput(event) {
    state.searchTerm = event.target.value.trim().toLowerCase();
    renderTable();
    refreshIcons();
}

function handleFilterClick(event) {
    const button = event.target.closest("[data-status-filter]");
    if (!button) {
        return;
    }

    state.activeStatus = button.dataset.statusFilter;
    renderFilters();
    renderTable();
    refreshIcons();
}

async function handleTableClick(event) {
    if (event.target.closest('input[type="checkbox"]')) {
        event.stopPropagation();
        return;
    }

    const row = event.target.closest("[data-order-id]");
    const actionButton = event.target.closest("[data-action='open-order']");
    const orderId = actionButton?.dataset.orderId ?? row?.dataset.orderId;

    if (!orderId) {
        return;
    }

    await openDetailsModal(orderId);
}

function handleModalClick(event) {
    const overlay = event.target.closest("[data-modal-close='overlay']");
    const closeButton = event.target.closest("[data-modal-close='button']");
    const tabButton = event.target.closest("[data-tab]");
    const copyButton = event.target.closest("[data-action='copy-link']");
    const confirmImportButton = event.target.closest(
        "[data-action='confirm-import']",
    );
    if (event.target === overlay || closeButton) {
        closeModal();
        return;
    }

    if (tabButton) {
        state.modal = {
            ...state.modal,
            tab: tabButton.dataset.tab,
        };
        renderModal();
        refreshIcons();
        return;
    }

    if (copyButton) {
        copyTrackingLink(copyButton.dataset.link);
        return;
    }

    if (confirmImportButton) {
        confirmImport();
    }
}

function handleModalChange(event) {
    if (event.target.id === "orders-import-file") {
        handleImportFileChange(event);
    }
}

function handleModalSubmit(event) {
    if (event.target.id === "add-order-form") {
        handleAddOrderSubmit(event);
    }
}

function handleImportFileChange(event) {
    const file = event.target.files?.[0];
    state.importFile = file;
    state.importFileName = file?.name ?? "";
    renderModal();
    refreshIcons();
}

async function handleAddOrderSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating...";
    }

    state.addForm = Object.fromEntries(formData.entries());
    await OrdersApi.createOrder(state.addForm);
    state.orders = await OrdersApi.getOrders();
    state.addForm = null;
    closeModal();
    renderPage();
}

async function openDetailsModal(orderId) {
    const orderData = await OrdersApi.getOrderById(orderId);
    state.modal = {
        orderId,
        orderData,
        tab: "live",
        type: "details",
    };
    renderModal();
    refreshIcons();
}

function openImportModal() {
    state.importFileName = "";
    state.modal = { type: "import" };
    renderModal();
    refreshIcons();
}

function openAddModal() {
    state.modal = { type: "add" };
    renderModal();
    refreshIcons();
}

function closeModal() {
    state.modal = null;
    state.importFileName = "";
    renderModal();
}

async function confirmImport() {
    if (!state.importFile) {
        return;
    }

    const confirmBtn = document.querySelector("[data-action='confirm-import']");
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Importing...";
    }

    try {
        const result = await OrdersApi.importOrders(state.importFile);
        
        if (result.errors && result.errors.length > 0) {
            alert(`Imported ${result.imported} orders with some errors:\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? '\n...' : ''}`);
        } else {
            alert(`Successfully imported ${result.imported} orders.`);
        }

        state.orders = await OrdersApi.getOrders();
        closeModal();
        renderPage();
    } catch (error) {
        alert("Import failed: " + error.message);
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Confirm Import";
        }
    }
}

function handleExport() {
    const rows = getFilteredOrders();
    const header = [
        "Order ID",
        "Customer",
        "Phone",
        "Address",
        "Weight",
        "Payment",
        "Priority",
        "Window",
        "Status",
    ];
    const csv = [
        header.join(","),
        ...rows.map((order) =>
            [
                order.id,
                order.customerName,
                order.customerPhone,
                order.address,
                order.weightKg,
                order.paymentType,
                order.priority,
                order.paymentWindow,
                order.status,
            ]
                .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                .join(","),
        ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orders-export.csv";
    link.click();
    URL.revokeObjectURL(url);
}

function getFilteredOrders() {
    return state.orders.filter((order) => {
        const matchesStatus =
            state.activeStatus === "All" || order.status === state.activeStatus;
        const term = state.searchTerm;
        const matchesSearch =
            !term ||
            order.id.toLowerCase().includes(term) ||
            order.customerName.toLowerCase().includes(term) ||
            order.address.toLowerCase().includes(term);

        return matchesStatus && matchesSearch;
    });
}

function renderPriorityBadge(priority) {
    const key = priority.toLowerCase();
    return `<span class="priority-badge priority-badge--${key}">${priority}</span>`;
}

function renderStatusBadge(status) {
    const key = toKebabCase(status);
    return `<span class="status-badge status-badge--${key}">${status}</span>`;
}

function formatWeight(weight) {
    return `${Number(weight).toFixed(weight % 1 === 0 ? 0 : 1)} kg`;
}

function toKebabCase(value) {
    return value.toLowerCase().replace(/\s+/g, "-");
}

async function copyTrackingLink(link) {
    try {
        await navigator.clipboard.writeText(link);
    } catch (error) {
        console.error("Could not copy tracking link", error);
    }
}

function refreshIcons() {
    createIcons({ icons });
}
