import WorkOrdersApi from "../../services/api/work-orders.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

// ─── State ───────────────────────────────────────────────────────────────────

let state = { search: "", status: "", type: "", page: 1 };

// ─── Pill helpers ─────────────────────────────────────────────────────────────

function pillType(type) {
    const map = { Routine: "routine", Breakdown: "breakdown", Emergency: "emergency" };
    return `<span class="wo-pill wo-pill--${map[type] ?? 'routine'}">${type}</span>`;
}

function pillStatus(status) {
    const map = {
        "Open":        "open",
        "Closed":      "closed",
        "Assigned":    "assigned",
        "In Progress": "inprogress",
        "Resolved":    "resolved",
    };
    return `<span class="wo-pill wo-pill--${map[status] ?? 'open'}">${status}</span>`;
}

function pillPriority(priority) {
    return priority === "Urgent"
        ? `<span class="wo-pill wo-pill--urgent">Urgent</span>`
        : `<span class="wo-pill wo-pill--normal">Normal</span>`;
}

function mechanicCell(mechObj) {
    if (!mechObj || mechObj.name === "Unassigned") {
        return `<div class="wo-mechanic">
            <span class="wo-mechanic__name wo-mechanic__name--unassigned">Unassigned</span>
        </div>`;
    }
    return `<div class="wo-mechanic">
        <span class="wo-avatar ${mechObj.avatarClass}">${mechObj.initials}</span>
        <span class="wo-mechanic__name">${mechObj.name}</span>
    </div>`;
}

function viewEyeIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
        <circle cx="12" cy="12" r="3"/>
    </svg>`;
}

// ─── Filter ───────────────────────────────────────────────────────────────────

function filteredOrders() {
    const allOrders = WorkOrdersApi.getAllOrders();
    const q = state.search.trim().toLowerCase();
    return allOrders.filter(o => {
        const mechanicName = typeof o.mechanic === "object" ? o.mechanic.name : o.mechanic;
        const matchQ      = !q || [o.id, o.vehicle, mechanicName, o.type, o.status]
            .some(v => v && v.toLowerCase().includes(q));
        const matchStatus = !state.status || o.status === state.status;
        const matchType   = !state.type   || o.type   === state.type;
        return matchQ && matchStatus && matchType;
    });
}

// ─── Render ───────────────────────────────────────────────────────────────────

let cleanupFns = [];

function renderTable() {
    const tbody = document.getElementById("wo-tbody");
    const label = document.getElementById("wo-showing-label");
    const total = document.getElementById("wo-total-label");
    if (!tbody) return;

    const allOrders = WorkOrdersApi.getAllOrders();
    const orders    = filteredOrders();
    const totalN    = orders.length;
    const start     = (state.page - 1) * PAGE_SIZE;
    const end       = Math.min(start + PAGE_SIZE, totalN);
    const pageRows  = orders.slice(start, end);

    if (label) label.textContent = totalN === 0
        ? "No results found"
        : `Showing ${start + 1}–${end} of ${totalN}`;

    if (total) total.textContent = `${allOrders.length} total work orders`;

    if (pageRows.length === 0) {
        tbody.innerHTML = `<tr><td class="wo-empty" colspan="12">No work orders match your filters.</td></tr>`;
        renderPagination(0, 0);
        return;
    }

    tbody.innerHTML = pageRows.map((o, idx) => {
        const isNew = o._source === "local" || o._source === "remote";
        return `
        <tr${isNew && o._source === "local" ? ' style="background:rgba(231, 171, 153, 0.04)"' : ''}>
            <td class="wo-td wo-td--check"><input type="checkbox" aria-label="Select ${o.id}" /></td>
            <td class="wo-td wo-td--id">${o.id}</td>
            <td class="wo-td">${o.vehicle}</td>
            <td class="wo-td">${pillType(o.type)}</td>
            <td class="wo-td">${mechanicCell(o.mechanic)}</td>
            <td class="wo-td">${pillStatus(o.status)}</td>
            <td class="wo-td">${pillPriority(o.priority)}</td>
            <td class="wo-td wo-td--desc" title="${o.description}">${o.description}</td>
            <td class="wo-td">${o.cost}</td>
            <td class="wo-td">${o.opened}</td>
            <td class="wo-td">${o.updated}</td>
            <td class="wo-td">
                <a class="wo-action-view" href="/work-orders/details?id=${o.id}" data-link>
                    ${viewEyeIcon()} View
                </a>
            </td>
        </tr>`;
    }).join("");

    renderPagination(totalN, state.page);
}

// Global variable for pagination delegator cleanup
let paginationCleanup = null;

function renderPagination(total, current) {
    const pag = document.getElementById("wo-pagination");
    if (!pag) return;

    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    let html = `<button class="wo-page-btn" id="pg-prev" ${current <= 1 ? "disabled" : ""}>&#8249;</button>`;

    for (let p = 1; p <= totalPages; p++) {
        html += `<button class="wo-page-btn ${p === current ? "wo-page-btn--active" : ""}" data-page="${p}">${p}</button>`;
    }

    html += `<button class="wo-page-btn" id="pg-next" ${current >= totalPages ? "disabled" : ""}>&#8250;</button>`;
    pag.innerHTML = html;

    if (paginationCleanup) {
        paginationCleanup();
        paginationCleanup = null;
    }

    // Use event delegation on the pagination container
    const onClick = e => {
        const btn = e.target.closest("button");
        if (!btn || btn.disabled) return;

        if (btn.id === "pg-prev") {
            state.page--;
            renderTable();
        } else if (btn.id === "pg-next") {
            state.page++;
            renderTable();
        } else if (btn.dataset.page) {
            state.page = parseInt(btn.dataset.page, 10);
            renderTable();
        }
    };

    pag.addEventListener("click", onClick);
    paginationCleanup = () => pag.removeEventListener("click", onClick);
    cleanupFns.push(paginationCleanup);
}

// ─── Mount ────────────────────────────────────────────────────────────────────

let mountedCleanup = []; // Additional cleanup for listeners added in mount()

export function mount() {
    // Reset filters on each mount so returning from the create form starts fresh
    state = { search: "", status: "", type: "", page: 1 };
    cleanupFns = [];
    mountedCleanup = [];

    renderTable();

    const searchInput = document.getElementById("wo-search-input");
    if (searchInput) {
        const handler = e => {
            state.search = e.target.value;
            state.page   = 1;
            renderTable();
        };
        searchInput.addEventListener("input", handler);
        mountedCleanup.push(() => searchInput.removeEventListener("input", handler));
    }

    const statusFilter = document.getElementById("wo-status-filter");
    if (statusFilter) {
        const handler = e => {
            state.status = e.target.value;
            state.page   = 1;
            renderTable();
        };
        statusFilter.addEventListener("change", handler);
        mountedCleanup.push(() => statusFilter.removeEventListener("change", handler));
    }

    const typeFilter = document.getElementById("wo-type-filter");
    if (typeFilter) {
        const handler = e => {
            state.type = e.target.value;
            state.page = 1;
            renderTable();
        };
        typeFilter.addEventListener("change", handler);
        mountedCleanup.push(() => typeFilter.removeEventListener("change", handler));
    }

    const selectAllBtn = document.getElementById("wo-select-all");
    if (selectAllBtn) {
        const handler = e => {
            document.querySelectorAll("#wo-tbody input[type='checkbox']")
                .forEach(cb => { cb.checked = e.target.checked; });
        };
        selectAllBtn.addEventListener("change", handler);
        mountedCleanup.push(() => selectAllBtn.removeEventListener("change", handler));
    }
}

export function unmount() {
    cleanupFns.forEach(fn => fn && fn());
    cleanupFns = [];
    
    mountedCleanup.forEach(fn => fn && fn());
    mountedCleanup = [];
}
