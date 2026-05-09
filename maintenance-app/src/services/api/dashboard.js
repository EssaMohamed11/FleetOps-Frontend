/**
 * FleetOps Maintenance — Dashboard API Service
 *
 * Connects the dashboard view to the backend maintenance endpoints.
 * All data is fetched live from the API; no static storage fallbacks.
 *
 * Endpoints used:
 *   GET /api/v1/maintenance/dashboard-summary   → KPI, work orders, vehicles attention, upcoming maintenance
 *   GET /api/v1/maintenance/alerts/insurance     → Insurance-expiry alerts
 *   GET /api/v1/maintenance/alerts/inspection    → Overdue-inspection alerts
 *   GET /api/v1/maintenance/alerts/odometer      → Odometer / service-due alerts
 *   GET /api/v1/maintenance/alerts/parts         → Low-stock spare-parts alerts
 *
 * @module services/api/dashboard
 */

import api from "/shared/api-handler.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:8000";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Reads the auth token fresh from localStorage on every call.
 * @returns {{ Authorization?: string }}
 */
function authHeaders() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Generic GET helper — returns `res.data` on success, `null` on failure.
 * @param {string} path
 * @returns {Promise<any|null>}
 */
async function get(path) {
    try {
        const { data: res } = await api.get(path, {
            baseURL: BASE_URL,
            headers: authHeaders(),
        });

        if (!res?.success) {
            console.error(`[DashboardApi] ${path}: success=false`, res);
            return null;
        }

        return res.data ?? null;
    } catch (err) {
        console.error(`[DashboardApi] ${path} failed:`, err?.message ?? err);
        return null;
    }
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

/**
 * Shapes the KPI section from the dashboard-summary response.
 *
 * Backend shape (res.data.KPI_DATA):
 *   { total_vehicles, available_vehicles, in_service_vehicles,
 *     out_of_service_vehicles, open_work_orders, urgent_work_orders }
 *
 * @param {object} kpi  — raw KPI_DATA from the backend
 * @returns {Array}
 */
function shapeKpiData(kpi) {
    if (!kpi || typeof kpi !== "object") return [];

    return [
        {
            id: "total-vehicles",
            value: kpi.total_vehicles ?? "—",
            label: "Total Vehicles",
            sub: null,
            subColor: null,
            iconColor: "blue",
            iconSvg: `<svg viewBox="0 0 24 24" fill="none">
              <path d="M1 17V11L5 4h14l4 7v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="5.5" cy="17.5" r="2.5" stroke="currentColor" stroke-width="1.8"/>
              <circle cx="18.5" cy="17.5" r="2.5" stroke="currentColor" stroke-width="1.8"/>
              <path d="M1 17h3M21 17h1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>`,
        },
        {
            id: "available",
            value: kpi.available_vehicles ?? "—",
            label: "Available",
            sub: "Ready to dispatch",
            subColor: "green",
            iconColor: "green",
            iconSvg: `<svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
              <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`,
        },
        {
            id: "in-service",
            value: kpi.in_service_vehicles ?? "—",
            label: "In Service",
            sub: "On route",
            subColor: "blue",
            iconColor: "teal",
            iconSvg: `<svg viewBox="0 0 24 24" fill="none">
              <path d="M1 17V11L5 4h14l4 7v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="5.5" cy="17.5" r="2.5" stroke="currentColor" stroke-width="1.8"/>
              <circle cx="18.5" cy="17.5" r="2.5" stroke="currentColor" stroke-width="1.8"/>
            </svg>`,
        },
        {
            id: "out-of-service",
            value: kpi.out_of_service_vehicles ?? "—",
            label: "Out of Service",
            sub: "Under repair",
            subColor: "red",
            iconColor: "red",
            iconSvg: `<svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
              <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>`,
        },
        {
            id: "open-work-orders",
            value: kpi.open_work_orders ?? "—",
            label: "Open Work Orders",
            sub: kpi.urgent_work_orders ? `${kpi.urgent_work_orders} urgent` : null,
            subColor: "red",
            iconColor: "orange",
            iconSvg: `<svg viewBox="0 0 24 24" fill="none">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.8"/>
              <path d="M9 12h6M9 16h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>`,
        },
        {
            id: "urgent-overdue",
            value: kpi.urgent_work_orders ?? "—",
            label: "Urgent / Overdue",
            sub: "Needs attention",
            subColor: "red",
            iconColor: "amber",
            iconSvg: `<svg viewBox="0 0 24 24" fill="none">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>`,
        },
    ];
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

/**
 * Fetches and merges all alert categories into a flat list.
 * Each item becomes: { id, text }
 *
 * @returns {Promise<Array<{id:string, text:string}>>}
 */
async function getAlertsData() {
    const [insurance, inspection, odometer, parts] = await Promise.all([
        get("/api/v1/maintenance/alerts/insurance"),
        get("/api/v1/maintenance/alerts/inspection"),
        get("/api/v1/maintenance/alerts/odometer"),
        get("/api/v1/maintenance/alerts/parts"),
    ]);

    const alerts = [];
    let counter = 1;

    const push = (items, buildText) => {
        if (!Array.isArray(items)) return;
        items.forEach((item) => {
            alerts.push({ id: `a${counter++}`, text: buildText(item) });
        });
    };

    push(insurance, (a) => {
        const plate = a.license_plate ?? a.plate_number ?? a.vehicle_id ?? "Vehicle";
        const expiry = a.insurance_expiry ?? a.expiry_date ?? "unknown date";
        const daysLeft = a.days_until_expiry ?? a.days_left ?? null;
        if (daysLeft !== null && daysLeft <= 0) {
            return `${plate} — Insurance EXPIRED (${expiry})`;
        }
        return `${plate} — Insurance expires in ${daysLeft ?? "?"} days (${expiry})`;
    });

    push(inspection, (a) => {
        const plate = a.license_plate ?? a.plate_number ?? a.vehicle_id ?? "Vehicle";
        return `${plate} — Annual inspection EXPIRED`;
    });

    push(odometer, (a) => {
        const plate = a.license_plate ?? a.plate_number ?? a.vehicle_id ?? "Vehicle";
        const threshold = a.service_threshold ?? a.threshold_km ?? "";
        const current = a.current_odometer ?? a.odometer_km ?? "";
        return `${plate} — Service due at ${threshold.toLocaleString()} km (currently ${Number(current).toLocaleString()} km)`;
    });

    push(parts, (a) => {
        const name = a.part_name ?? a.name ?? "Spare part";
        const qty = a.stock_quantity ?? a.quantity ?? 0;
        const min = a.minimum_stock ?? a.min_stock ?? "?";
        return `${name} — Low stock: ${qty} remaining (min: ${min})`;
    });

    return alerts;
}

// ─── Work Orders ──────────────────────────────────────────────────────────────

/**
 * Shapes work-order rows from the dashboard-summary response.
 *
 * Backend shape (res.data.WORK_ORDERS_DATA[]):
 *   { id, vehicle_id, type, priority, status, created_at, updated_at,
 *     vehicle: { LicensePlate, ... },
 *     mechanic_id, mechanic: { name, ... } }
 *
 * @param {Array} rows
 * @returns {Array}
 */
function shapeWorkOrders(rows) {
    if (!Array.isArray(rows)) return [];

    return rows.map((r, i) => {
        const woId = r.id ? `WO-${String(r.id).padStart(4, "0")}` : `WO-?${i}`;

        const vehiclePlate =
            r.vehicle?.LicensePlate ??
            r.vehicle?.license_plate ??
            r.vehicle_id ??
            "Unknown";

        // Normalise type: emergency / routine / breakdown
        const rawType = (r.type ?? r.work_type ?? "routine").toLowerCase();
        const type = ["emergency", "breakdown", "routine"].includes(rawType)
            ? rawType
            : "routine";

        // Mechanic name
        const mechanicName =
            r.mechanic?.name ?? r.assigned_mechanic ?? null;

        // Normalise status: open / in-progress / assigned / resolved / closed
        const rawStatus = (r.status ?? "open").toLowerCase().replace(/_/g, "-");
        const statusMap = {
            "open": "open",
            "assigned": "assigned",
            "in-progress": "in-progress",
            "in_progress": "in-progress",
            "resolved": "resolved",
            "completed": "resolved",
            "closed": "closed",
        };
        const status = statusMap[rawStatus] ?? rawStatus;

        // "Updated" relative label
        const updatedRaw = r.updated_at ?? r.created_at ?? null;
        let updated = "—";
        if (updatedRaw) {
            const diff = Date.now() - new Date(updatedRaw).getTime();
            const days = Math.floor(diff / 86_400_000);
            updated = days === 0 ? "Today" : `${days}d ago`;
        }

        return { id: woId, vehicle: vehiclePlate, type, mechanic: mechanicName, status, updated };
    });
}

// ─── Vehicles Needing Attention ───────────────────────────────────────────────

/**
 * Shapes vehicles-attention items from the dashboard-summary response.
 *
 * Backend shape (res.data.VEHICLES_ATTENTION_DATA[]):
 *   { vehicle_id, LicensePlate, Status, ... }
 *
 * @param {Array} rows
 * @returns {Array}
 */
function shapeVehiclesAttention(rows) {
    if (!Array.isArray(rows)) return [];

    return rows.map((v) => {
        const plate = v.LicensePlate ?? v.license_plate ?? v.vehicle_id ?? "—";

        const rawStatus = (v.Status ?? v.status ?? "").toLowerCase();
        let status = "available";
        let sub = null;

        if (rawStatus === "maintenance" || rawStatus === "in maintenance") {
            status = "out-of-service";
            sub = "Under Maintenance";
        } else if (rawStatus === "inactive" || rawStatus === "out of service") {
            status = "out-of-service";
            sub = "Out of Service";
        } else if (rawStatus === "in service" || rawStatus === "in-service") {
            status = "in-service";
        }

        return { id: plate, status, sub };
    });
}

// ─── Upcoming Maintenance ─────────────────────────────────────────────────────

/**
 * Shapes upcoming maintenance items from the dashboard-summary response.
 *
 * Backend shape (res.data.UPCOMING_MAINTENANCE_DATA.upcoming_inspections[]):
 *   { id, vehicle_id, type, status, next_inspection_date,
 *     vehicle: { LicensePlate } }
 *
 * @param {object} raw  — raw UPCOMING_MAINTENANCE_DATA from the backend
 * @returns {Array}
 */
function shapeUpcomingMaintenance(raw) {
    if (!raw) return [];
    const inspections = raw.upcoming_inspections ?? (Array.isArray(raw) ? raw : []);
    if (!Array.isArray(inspections) || inspections.length === 0) return [];

    return inspections.map((ins) => {
        const vehicleId =
            ins.vehicle?.LicensePlate ??
            ins.vehicle?.license_plate ??
            ins.vehicle_id ??
            "—";

        const woId = ins.id ? `WO-${String(ins.id).padStart(4, "0")}` : "—";

        const rawType = (ins.type ?? "routine").toLowerCase();
        const type = ["emergency", "breakdown", "routine"].includes(rawType)
            ? rawType
            : "routine";

        const rawStatus = (ins.status ?? "open").toLowerCase().replace(/_/g, "-");

        return { type, vehicleId, woId, status: rawStatus };
    });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches the complete dashboard summary from the backend.
 *
 * @returns {Promise<{
 *   kpiData: Array,
 *   alertsData: Array,
 *   workOrdersData: Array,
 *   vehiclesAttentionData: Array,
 *   upcomingMaintenanceData: Array,
 * }>}
 */
async function getDashboardData() {
    // Fetch dashboard-summary and all alert categories in parallel
    const [summary, alertsData] = await Promise.all([
        get("/api/v1/maintenance/dashboard-summary"),
        getAlertsData(),
    ]);

    return {
        kpiData: shapeKpiData(summary?.KPI_DATA),
        alertsData,
        workOrdersData: shapeWorkOrders(summary?.WORK_ORDERS_DATA),
        vehiclesAttentionData: shapeVehiclesAttention(summary?.VEHICLES_ATTENTION_DATA),
        upcomingMaintenanceData: shapeUpcomingMaintenance(summary?.UPCOMING_MAINTENANCE_DATA),
    };
}

const DashboardApi = { getDashboardData };
export default DashboardApi;
