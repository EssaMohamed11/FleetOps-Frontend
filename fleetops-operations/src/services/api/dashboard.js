import api from "/shared/api-handler.js";

// ─── Base URL ──────────────────────────────────────────────────────────────────
// Backend runs on http://localhost:8000 (Docker Nginx → Laravel)

const BASE_URL = "http://localhost:8000";

/**
 * Returns Authorization headers with the token read fresh from localStorage.
 * This avoids the stale-token problem where api-handler.js reads localStorage
 * once at module-load time before the user has logged in.
 */
function authHeaders() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Summary Cards ─────────────────────────────────────────────────────────────
// GET /api/v1/analytics/reports/daily-dashboard
// Response shape:
//   data.active_routes   : { count, change, positive }
//   data.orders_today    : { count, change, positive }
//   data.open_alerts     : { count, change, positive }
//   data.fuel_efficiency : { count, change, positive }
//   data.delivery_rate   : { count, change, positive }

/**
 * Fetches live summary KPIs from the backend.
 * Returns an empty array on failure (no static fallback).
 *
 * @returns {Promise<Array>}
 */
async function getSummaryData() {
    try {
        const { data: res } = await api.get(
            "/api/v1/analytics/reports/daily-dashboard",
            { baseURL: BASE_URL, headers: authHeaders() }
        );

        if (!res?.success || !res?.data) {
            console.error("[Dashboard] daily-dashboard: unexpected response shape.", res);
            return [];
        }

        const d = res.data;

        return [
            {
                selector: ".active-routes",
                count:    d.active_routes?.count    ?? "—",
                change:   d.active_routes?.change   ?? "N/A",
                positive: d.active_routes?.positive ?? null,
            },
            {
                selector: ".orders-today",
                count:    d.orders_today?.count    ?? "—",
                change:   d.orders_today?.change   ?? "N/A",
                positive: d.orders_today?.positive ?? null,
            },
            {
                selector: ".open-alerts",
                count:    d.open_alerts?.count    ?? "—",
                change:   d.open_alerts?.change   ?? "N/A",
                positive: d.open_alerts?.positive ?? null,
            },
            {
                selector: ".fuel-efficency",         // matches the CSS class in HTML
                count:    d.fuel_efficiency?.count    ?? "—",
                change:   d.fuel_efficiency?.change   ?? "N/A",
                positive: d.fuel_efficiency?.positive ?? null,
            },
            {
                selector: ".delivery-rate",
                count:    d.delivery_rate?.count    ?? "—",
                change:   d.delivery_rate?.change   ?? "N/A",
                positive: d.delivery_rate?.positive ?? null,
            },
        ];
    } catch (err) {
        console.error("[Dashboard] getSummaryData() failed:", err?.message ?? err);
        return [];
    }
}

// ─── Active Fleet Table ────────────────────────────────────────────────────────
// GET /api/v1/dispatch/routes
// Expected response: { success, data: [ { route_id, origin, destination,
//   driver_name, progress, scheduled_end_time, status, ... } ] }

/**
 * Fetches in-progress routes from the dispatch backend.
 * Returns an empty array on failure (no static fallback).
 *
 * @returns {Promise<Array>}
 */
async function getFleetData() {
    try {
        const { data: res } = await api.get(
            "/api/v1/dispatch/routes",
            { baseURL: BASE_URL, headers: authHeaders() }
        );

        if (!res?.success) {
            console.error("[Dashboard] dispatch/routes: request not successful.", res);
            return [];
        }

        // Backend may return { data: [...] } or { data: { data: [...] } } (paginated)
        const rows = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
                ? res.data.data
                : null;

        if (!rows) {
            console.error("[Dashboard] dispatch/routes: could not find rows array in response.", res);
            return [];
        }

        // Map backend route fields → view fields
        return rows.map((r) => {
            const location = [r.origin, r.destination]
                .filter(Boolean)
                .join(" → ") || r.zone || "—";

            const rawEta = r.scheduled_end_time ?? r.actual_end_time ?? null;
            const eta = rawEta
                ? new Date(rawEta).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                : "—";

            const progress = r.progress ?? r.completion_percentage ?? 0;
            const driver   = r.driver_name ?? r.driver?.name ?? "Unassigned";
            const routeId  = r.route_id
                ? `RT-${String(r.route_id).padStart(4, "0")}`
                : (r.id ?? "—");

            return { routeId, location, driver, progress, eta };
        });
    } catch (err) {
        console.error("[Dashboard] getFleetData() failed:", err?.message ?? err);
        return [];
    }
}

// ─── Alerts ────────────────────────────────────────────────────────────────────
// GET /api/v1/notifications
// The NotificationController.index() endpoint returns paginated notifications
// for the authenticated user. We filter client-side for alert-type items.

/**
 * Fetches recent alerts from the notifications endpoint.
 * Returns an empty array on failure (no static fallback).
 *
 * @returns {Promise<Array>}
 */
async function getAlertsData() {
    try {
        const { data: res } = await api.get(
            "/api/v1/notifications",
            { baseURL: BASE_URL, headers: authHeaders() }
        );

        if (!res?.success) {
            console.error("[Dashboard] notifications: request not successful.", res);
            return [];
        }

        const items = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
                ? res.data.data
                : [];

        // Map notification fields → alert card shape
        return items
            .filter((n) => n.type !== "window_violation") // exclude violations
            .map((n) => ({
                type:     n.title    ?? n.type    ?? "ALERT",
                time:     n.time     ?? (n.created_at ? new Date(n.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""),
                severity: n.severity ?? n.priority ?? "warning",
                message:  n.body     ?? n.message  ?? "",
            }));
    } catch (err) {
        console.error("[Dashboard] getAlertsData() failed:", err?.message ?? err);
        return [];
    }
}

// ─── Violations ────────────────────────────────────────────────────────────────
// GET /api/v1/notifications
// Window violations are notifications with type === 'window_violation'.

/**
 * Fetches window-violation notifications from the notifications endpoint.
 * Returns an empty array on failure (no static fallback).
 *
 * @returns {Promise<Array>}
 */
async function getViolationsData() {
    try {
        const { data: res } = await api.get(
            "/api/v1/notifications",
            { baseURL: BASE_URL, headers: authHeaders() }
        );

        if (!res?.success) {
            console.error("[Dashboard] notifications (violations): request not successful.", res);
            return [];
        }

        const items = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
                ? res.data.data
                : [];

        // Filter only window-violation type notifications
        return items
            .filter((n) => n.type === "window_violation")
            .map((n) => ({
                type:     n.title    ?? "WINDOW VIOLATION",
                time:     n.time     ?? (n.created_at ? new Date(n.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""),
                severity: n.severity ?? n.priority ?? "warning",
                message:  n.body     ?? n.message  ?? "",
            }));
    } catch (err) {
        console.error("[Dashboard] getViolationsData() failed:", err?.message ?? err);
        return [];
    }
}

// ─── Public API object ─────────────────────────────────────────────────────────

const DashboardApi = {
    getSummaryData,
    getFleetData,
    getAlertsData,
    getViolationsData,
};

export default DashboardApi;
