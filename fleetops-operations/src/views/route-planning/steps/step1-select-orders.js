/**
 * Step 1: Select Orders
 */

import RoutePlanningAPI from "../../../services/api/route-planning.js";
import { routePlanningState } from "../utils/state-manager.js";
import {
    createElement,
    calculateTotalWeight,
    calculateTotalVolume,
    formatNumber,
    debounce,
} from "../utils/helpers.js";
import { createIcons, icons } from "/node_modules/lucide/dist/esm/lucide.mjs";

const PAGE_SIZE = 25;
let currentContainer = null;
let unsubscribe = null;
let renderToken = 0;
let paginationMeta = {
    page: 0,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
};

/**
 * Render Step 1
 * @param {HTMLElement} container - Container element
 */
export async function renderStep1(container) {
    currentContainer = container;

    // Unsubscribe from previous subscription
    if (unsubscribe) {
        unsubscribe();
    }

    // Subscribe to state changes
    unsubscribe = routePlanningState.subscribe(async (state, prevState) => {
        // Only re-render if filters, search, or page changed
        if (
            state.searchTerm !== prevState.searchTerm ||
            state.filterType !== prevState.filterType ||
            state.filterArea !== prevState.filterArea ||
            state.currentPage !== prevState.currentPage ||
            state.orders !== prevState.orders
        ) {
            await reRender();
        }
    });

    await reRender();
}

async function reRender() {
    if (!currentContainer) return;
    const token = ++renderToken;

    const state = routePlanningState.getState();

    // Clear container
    currentContainer.innerHTML = "";

    // Create wrapper
    const wrapper = createElement("div", { classes: "step-1-container" });

    // Render stats
    renderStats(wrapper);

    // Render filters
    renderFilters(wrapper);

    // Render selected info
    renderSelectedInfo(wrapper);

    // Render table
    await renderTable(wrapper);

    // Ignore stale async render completions.
    if (token !== renderToken) {
        return;
    }

    // Render pagination
    renderPagination(wrapper);

    currentContainer.appendChild(wrapper);

    // Initialize icons
    setTimeout(() => {
        createIcons({ icons });
    }, 0);
}

/**
 * Render stats cards
 */
function renderStats(container) {
    const state = routePlanningState.getState();
    const selectedOrders = state.orders.filter((o) => o.selected);
    const totalWeight = calculateTotalWeight(selectedOrders);
    const totalVolume = calculateTotalVolume(selectedOrders);

    const stats = createElement("div", { classes: "rp-stats" });
    const grid = createElement("div", { classes: "rp-stats__grid" });

    const statsData = [
        {
            label: "Total Orders",
            value: formatNumber(state.orders.length),
            primary: false,
        },
        {
            label: "Selected",
            value: selectedOrders.length || "0",
            primary: true,
        },
        {
            label: "Total Weight",
            value: `${Math.round(totalWeight).toLocaleString()}<span class="unit"> kg</span>`,
            primary: false,
        },
        {
            label: "Total Volume",
            value: `${Math.round(totalVolume * 10) / 10}<span class="unit"> m³</span>`,
            primary: false,
        },
    ];

    statsData.forEach((stat) => {
        const statEl = createElement("div", { classes: "rp-stat" });
        const valueClasses = ["rp-stat__value"];
        if (stat.primary) {
            valueClasses.push("primary");
        }
        const value = createElement("p", {
            classes: valueClasses,
            html: stat.value,
        });
        const label = createElement("p", {
            classes: "rp-stat__label",
            text: stat.label,
        });

        statEl.appendChild(value);
        statEl.appendChild(label);
        grid.appendChild(statEl);
    });

    stats.appendChild(grid);
    container.appendChild(stats);
}

/**
 * Render filters
 */
function renderFilters(container) {
    const state = routePlanningState.getState();

    const filters = createElement("div", { classes: "rp-filters" });

    // Search
    const searchWrapper = createElement("div", {
        classes: ["search-field", "rp-search"],
    });

    const searchInput = createElement("input", {
        attrs: {
            type: "text",
            placeholder:
                "Search by order ID, customer, address... (Press Enter)",
            value: state.searchTerm,
        },
    });

    const onSearchChange = debounce((value) => {
        routePlanningState.setState({
            searchTerm: value,
            currentPage: 0,
        });
    }, 300);

    searchInput.addEventListener("input", (e) => {
        onSearchChange(e.target.value);
    });

    searchWrapper.appendChild(searchInput);
    filters.appendChild(searchWrapper);

    // Type filters
    const typeGroup = createElement("div", { classes: "rp-filter-group" });
    const types = [
        { value: "all", label: "All Types" },
        { value: "perish", label: "Perishable" },
        { value: "express", label: "Express" },
        { value: "normal", label: "Normal" },
    ];

    types.forEach((type) => {
        const btn = createElement("button", {
            classes: [
                "rp-filter-btn",
                state.filterType === type.value ? "active" : "",
            ],
            attrs: { type: "button" },
            text: type.label,
        });

        btn.addEventListener("click", () => {
            routePlanningState.setState({
                filterType: type.value,
                currentPage: 0,
            });
        });

        typeGroup.appendChild(btn);
    });

    filters.appendChild(typeGroup);

    // Area filter
    const areaSelect = createElement("select", {
        classes: "rp-area-select",
    });
    const allOption = createElement("option", {
        attrs: { value: "All" },
        text: "All Areas",
    });
    areaSelect.appendChild(allOption);

    (state.areas || []).forEach((area) => {
        const option = createElement("option", {
            attrs: { value: area },
            text: area,
        });
        if (state.filterArea === area) {
            option.selected = true;
        }
        areaSelect.appendChild(option);
    });

    areaSelect.addEventListener("change", (e) => {
        routePlanningState.setState({
            filterArea: e.target.value,
            currentPage: 0,
        });
    });

    filters.appendChild(areaSelect);
    container.appendChild(filters);
}

function getOrderKey(order) {
    return String(order?.OrderID ?? order?.id ?? "");
}

function getOrderCustomerName(order) {
    if (typeof order?.customer === "string") {
        return order.customer;
    }

    return order?.customer?.user?.name || order?.customer?.name || "Unknown";
}

function setOrdersAndInvalidatePipeline(orders) {
    const state = routePlanningState.getState();
    const nextStepComplete = { ...state.stepComplete };

    // Any selection change in step 1 invalidates all derived pipeline outputs.
    [2, 3, 4, 5, 6, 7, 8, 9].forEach((step) => {
        delete nextStepComplete[step];
    });

    routePlanningState.setState({
        orders,
        prioritizedOrders: [],
        clusters: [],
        routeConfigs: {},
        activeClusterIndex: 0,
        manualEditMode2: false,
        editPriorityId: null,
        editPriorityValue: "",
        manualEditMode6: false,
        emergencyInserted: false,
        stepComplete: nextStepComplete,
    });
}

/**
 * Render selected info banner
 */
function renderSelectedInfo(container) {
    const state = routePlanningState.getState();
    const selectedOrders = state.orders.filter((o) => o.selected);

    if (selectedOrders.length === 0) return;

    const totalWeight = calculateTotalWeight(selectedOrders);
    const totalVolume = calculateTotalVolume(selectedOrders);

    const info = createElement("div", {
        classes: "rp-selected-info",
    });

    const banner = createElement("div", {
        classes: "rp-selected-banner",
    });

    const icon = createElement("i", {
        attrs: { "data-lucide": "check-circle" },
    });

    const text = createElement("span", {
        classes: "rp-selected-text",
        text: `${selectedOrders.length} orders selected`,
    });

    const details = createElement("span", {
        classes: "rp-selected-details",
        text: `(${Math.round(totalWeight)} kg / ${Math.round(totalVolume * 10) / 10} m³)`,
    });

    const clearBtn = createElement("button", {
        classes: "rp-clear-btn",
        attrs: { type: "button" },
        text: "Clear all",
    });

    clearBtn.addEventListener("click", () => {
        const orders = routePlanningState
            .getState()
            .orders.map((o) => ({ ...o, selected: false }));
        setOrdersAndInvalidatePipeline(orders);
    });

    banner.appendChild(icon);
    banner.appendChild(text);
    banner.appendChild(details);
    banner.appendChild(clearBtn);
    info.appendChild(banner);
    container.appendChild(info);
}

/**
 * Render table
 */
async function renderTable(container) {
    const state = routePlanningState.getState();

    // Get filtered and paginated orders
    const result = await RoutePlanningAPI.getOrdersPaginated(
        state.currentPage,
        PAGE_SIZE,
        {
            search: state.searchTerm,
            area: state.filterArea,
            type: state.filterType,
        },
    );

    paginationMeta = result.pagination;

    // Merge selected status from current state into result data
    result.data = result.data.map((order) => {
        const stateOrder = state.orders.find(
            (o) => getOrderKey(o) === getOrderKey(order),
        );
        return { ...order, selected: stateOrder ? stateOrder.selected : false };
    });

    const tableContainer = createElement("div", {
        classes: "rp-table-container",
    });
    const table = createElement("table", { classes: "rp-table" });

    // Header
    const thead = createElement("thead");
    const headerRow = createElement("tr");

    const headers = [
        { label: "", width: "40px", checkbox: true },
        { label: "Order ID" },
        { label: "Customer" },
        { label: "Area" },
        { label: "Weight" },
        { label: "Volume" },
        { label: "Window" },
        { label: "Type" },
        // { label: "Priority" },
    ];

    headers.forEach((header) => {
        const th = createElement("th", { text: header.label });
        if (header.width) {
            th.style.width = header.width;
        }

        if (header.checkbox) {
            const checkbox = createElement("input", {
                attrs: {
                    type: "checkbox",
                    id: "select-all-checkbox",
                },
            });

            checkbox.checked =
                result.data.length > 0 && result.data.every((o) => o.selected);

            checkbox.addEventListener("change", (e) => {
                const ids = new Set(result.data.map((o) => getOrderKey(o)));
                const orders = state.orders.map((o) => {
                    if (ids.has(getOrderKey(o))) {
                        return { ...o, selected: e.target.checked };
                    }
                    return o;
                });
                setOrdersAndInvalidatePipeline(orders);
            });

            th.innerHTML = "";
            th.appendChild(checkbox);
        }

        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = createElement("tbody");

    result.data.forEach((order) => {
        const rowClasses = [];
        if (order.selected) {
            rowClasses.push("selected");
        }
        const row = createElement("tr", {
            classes: rowClasses.length > 0 ? rowClasses : undefined,
        });
        row.style.cursor = "pointer";

        row.addEventListener("click", (e) => {
            if (e.target.type !== "checkbox") {
                toggleOrder(getOrderKey(order));
            }
        });

        // Checkbox
        const checkboxTd = createElement("td");
        const checkbox = createElement("input", {
            attrs: { type: "checkbox" },
        });
        checkbox.checked = order.selected;
        checkbox.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleOrder(getOrderKey(order));
        });
        checkboxTd.appendChild(checkbox);
        row.appendChild(checkboxTd);

        // Order ID
        row.appendChild(
            createElement("td", {
                html: `<span style="font-weight: 600;">${order.OrderID ?? order.id}</span>`,
            }),
        );

        // Customer
        row.appendChild(
            createElement("td", { text: getOrderCustomerName(order) }),
        );

        // Area
        row.appendChild(
            createElement("td", {
                html: `<span style="color: var(--color-text-muted);">${order.Area || order.address || "Unknown"}</span>`,
            }),
        );

        // Weight
        row.appendChild(
            createElement("td", {
                text: `${order.Weight ?? order.weight ?? 0} kg`,
            }),
        );

        // Volume
        row.appendChild(
            createElement("td", {
                text: `${order.Volume ?? order.volume ?? 0} m³`,
            }),
        );

        // Window
        row.appendChild(
            createElement("td", {
                html: `<span style="font-size: 0.75rem; color: var(--color-text-muted);" dir="rtl">${order.DeliveryTimeWindow || order.window || "09:00-18:00"}</span>`,
            }),
        );

        // Type
        const typeTd = createElement("td");
        if (order.Type === "Perishable" || order.perishable) {
            typeTd.innerHTML =
                '<span class="rp-badge perishable">Perish</span>';
        } else if (order.Type === "Express" || order.express) {
            typeTd.innerHTML = '<span class="rp-badge express">Express</span>';
        } else {
            typeTd.innerHTML = '<span class="rp-badge normal">Normal</span>';
        }
        row.appendChild(typeTd);

        // // Priority
        // const priorityTd = createElement("td");
        // const priorityDiv = createElement("div", { classes: "rp-priority" });

        // const bar = createElement("div", { classes: "rp-priority__bar" });
        // const fill = createElement("div", {
        //     classes: [
        //         "rp-priority__fill",
        //         order.priority > 80
        //             ? "high"
        //             : order.priority > 60
        //               ? "medium"
        //               : "low",
        //     ],
        // });
        // fill.style.width = `${order.priority}%`;
        // bar.appendChild(fill);

        // const value = createElement("span", {
        //     classes: "rp-priority__value",
        //     text: order.priority,
        // });

        // priorityDiv.appendChild(bar);
        // priorityDiv.appendChild(value);
        // priorityTd.appendChild(priorityDiv);
        // row.appendChild(priorityTd);

        tbody.appendChild(row);
    });

    table.appendChild(tbody);

    // Create wrapper for scrolling
    const tableWrapper = createElement("div", { classes: "rp-table-wrapper" });
    tableWrapper.appendChild(table);
    tableContainer.appendChild(tableWrapper);

    container.appendChild(tableContainer);
}

/**
 * Render pagination
 */
function renderPagination(container) {
    const pagination = createElement("div", { classes: "rp-pagination" });

    const page = paginationMeta.page ?? 0;
    const totalPages = Math.max(1, paginationMeta.totalPages ?? 1);
    const total = paginationMeta.total ?? 0;
    const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
    const end = Math.min((page + 1) * PAGE_SIZE, total);

    const info = createElement("div", {
        classes: "rp-pagination__info",
        html: `Showing ${start}-${end} of ${formatNumber(total)} orders`,
    });

    const controls = createElement("div", {
        classes: "rp-pagination__controls",
    });

    // First button
    const firstBtn = createPaginationButton(
        "First",
        () => {
            routePlanningState.setState({ currentPage: 0 });
        },
        page === 0,
    );
    controls.appendChild(firstBtn);

    // Previous button
    const prevBtn = createPaginationButton(
        '<i data-lucide="chevron-left"></i>',
        () => {
            routePlanningState.setState({
                currentPage: Math.max(0, page - 1),
            });
        },
        page === 0,
    );
    controls.appendChild(prevBtn);

    // Page numbers (simplified - show current page)
    const pageBtn = createElement("button", {
        classes: ["rp-pagination__btn", "active"],
        attrs: { type: "button" },
        text: page + 1,
    });
    controls.appendChild(pageBtn);

    // Next button
    const nextBtn = createPaginationButton(
        '<i data-lucide="chevron-right"></i>',
        () => {
            routePlanningState.setState({
                currentPage: Math.min(totalPages - 1, page + 1),
            });
        },
        page >= totalPages - 1,
    );
    controls.appendChild(nextBtn);

    // Last button
    const lastBtn = createPaginationButton(
        "Last",
        () => {
            routePlanningState.setState({ currentPage: totalPages - 1 });
        },
        page >= totalPages - 1,
    );
    controls.appendChild(lastBtn);

    pagination.appendChild(info);
    pagination.appendChild(controls);
    container.appendChild(pagination);
}

/**
 * Create pagination button
 */
function createPaginationButton(content, onClick, disabled = false) {
    const btn = createElement("button", {
        classes: "rp-pagination__btn",
        attrs: { type: "button" },
        html: content,
    });

    if (disabled) {
        btn.disabled = true;
    }

    btn.addEventListener("click", onClick);
    return btn;
}

/**
 * Toggle order selection
 */
function toggleOrder(orderId) {
    const state = routePlanningState.getState();
    const target = String(orderId);

    const orders = state.orders.map((o) => {
        if (getOrderKey(o) === target) {
            return { ...o, selected: !o.selected };
        }
        return o;
    });
    setOrdersAndInvalidatePipeline(orders);
}
