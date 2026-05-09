/**
 * FleetOps Maintenance — Alerts & Inspections API Service
 *
 * Fetches all alert data live from the backend API.
 * No static storage fallbacks.
 *
 * Endpoints:
 *   GET  /api/v1/maintenance/alerts/odometer          → odometer alerts
 *   GET  /api/v1/maintenance/alerts/insurance         → insurance-expiry alerts
 *   GET  /api/v1/maintenance/alerts/inspection        → overdue inspection alerts
 *   GET  /api/v1/maintenance/alerts/parts             → low-stock parts alerts
 *   PATCH /api/v1/maintenance/alerts/insurance-renew/{id}
 *   PATCH /api/v1/maintenance/alerts/inspection-complete/{id}
 *
 * @module services/api/alerts
 */

import api from "/shared/api-handler.js";

const BASE_URL = "http://localhost:8000";

// ─── Auth helper ─────────────────────────────────────────────────────────────

function authHeaders() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

async function get(path) {
    try {
        const { data: res } = await api.get(path, {
            baseURL: BASE_URL,
            headers: authHeaders(),
        });
        if (!res?.success) {
            console.warn(`[AlertsApi] GET ${path}: success=false`, res);
            return [];
        }
        return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
        console.error(`[AlertsApi] GET ${path} failed:`, err?.message ?? err);
        return [];
    }
}

async function patch(path, body = {}) {
    try {
        const { data: res } = await api.patch(path, body, {
            baseURL: BASE_URL,
            headers: authHeaders(),
        });
        return res ?? null;
    } catch (err) {
        console.error(`[AlertsApi] PATCH ${path} failed:`, err?.message ?? err);
        return null;
    }
}

// ─── Data-shaping helpers ─────────────────────────────────────────────────────

/**
 * Maps raw backend odometer record → view shape.
 *
 * Backend fields (from AlertsService.getOdometerAlerts):
 *   id, vehiclePlate, vehicleModel, lastServiceKM, currentOdometer,
 *   kmSinceService, threshold, status
 */
function shapeOdometer(raw) {
    return raw.map((r) => ({
        id:              String(r.id             ?? r.vehicle_id ?? Math.random()),
        vehiclePlate:    r.vehiclePlate    ?? r.license_plate ?? r.VehicleLicense ?? "—",
        vehicleModel:    r.vehicleModel    ?? r.VehicleModel   ?? "—",
        lastServiceKM:   r.lastServiceKM   ?? "0",
        currentOdometer: r.currentOdometer ?? r.Current_odometer ?? "0",
        kmSinceService:  r.kmSinceService  ?? "0",
        threshold:       r.threshold       ?? "10,000",
        status:          r.status          ?? "success",
    }));
}

/**
 * Maps raw backend insurance record → view shape.
 *
 * Backend fields (from AlertsService.getInsuranceAlerts):
 *   id, vehiclePlate, vehicleModel, policyNumber, expiryDate,
 *   daysRemaining, status
 */
function shapeInsurance(raw) {
    return raw.map((r) => ({
        id:            String(r.id ?? r.inspection_id ?? Math.random()),
        vehiclePlate:  r.vehiclePlate  ?? r.VehicleLicense ?? "—",
        vehicleModel:  r.vehicleModel  ?? r.VehicleModel   ?? "—",
        policyNumber:  r.policyNumber  ?? r.certificate_number ?? "—",
        expiryDate:    r.expiryDate    ?? "—",
        daysRemaining: String(r.daysRemaining ?? "?"),
        // Backend returns 'danger' for expired, 'warning' for expiring-soon
        // View uses 'warning' for expiring-soon; map 'danger' → 'warning' too
        status:        r.status === "success" ? "success" : "warning",
    }));
}

/**
 * Maps raw backend inspection record → view shape.
 *
 * Backend fields (from AlertsService.getInspectionAlerts):
 *   id, vehiclePlate, vehicleModel, lastInspection, nextDueDate,
 *   daysRemaining, status
 */
function shapeInspection(raw) {
    return raw.map((r) => ({
        id:            String(r.id ?? r.inspection_id ?? Math.random()),
        vehiclePlate:  r.vehiclePlate  ?? r.VehicleLicense ?? "—",
        vehicleModel:  r.vehicleModel  ?? r.VehicleModel   ?? "—",
        lastInspection: r.lastInspection ?? "—",
        nextDueDate:   r.nextDueDate   ?? "—",
        daysRemaining: String(r.daysRemaining ?? "Overdue"),
        status:        r.status === "success" ? "success" : "danger",
    }));
}

/**
 * Maps raw backend parts record → view shape.
 *
 * Backend fields (from AlertsService.getPartsAlerts):
 *   id, vehiclePlate, vehicleModel, partName, installDate,
 *   usage, lifespan, stockQty, status
 */
function shapeParts(raw) {
    return raw.map((r) => ({
        id:           String(r.id ?? r.part_id ?? Math.random()),
        vehiclePlate: r.vehiclePlate ?? "—",
        vehicleModel: r.vehicleModel ?? "—",
        partName:     r.partName     ?? r.part_name    ?? "—",
        installDate:  r.installDate  ?? r.created_at   ?? "—",
        usage:        r.usage        ?? (r.stockQty != null ? `${r.stockQty} in stock` : "—"),
        lifespan:     r.lifespan     ?? "—",
        status:       r.status       ?? "warning",
    }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches all four alert categories in parallel.
 *
 * @returns {Promise<{ odometer, insurance, inspection, parts }>}
 */
async function getAllAlerts() {
    const [odometer, insurance, inspection, parts] = await Promise.all([
        get("/api/v1/maintenance/alerts/odometer"),
        get("/api/v1/maintenance/alerts/insurance"),
        get("/api/v1/maintenance/alerts/inspection"),
        get("/api/v1/maintenance/alerts/parts"),
    ]);

    return {
        odometer:   shapeOdometer(odometer),
        insurance:  shapeInsurance(insurance),
        inspection: shapeInspection(inspection),
        parts:      shapeParts(parts),
    };
}

/**
 * Marks an insurance record as renewed.
 * @param {string|number} id  — inspection_id on the backend
 * @returns {Promise<object|null>}
 */
async function renewInsurance(id) {
    return patch(`/api/v1/maintenance/alerts/insurance-renew/${id}`);
}

/**
 * Marks an inspection as complete.
 * @param {string|number} id  — inspection_id on the backend
 * @returns {Promise<object|null>}
 */
async function completeInspection(id) {
    return patch(`/api/v1/maintenance/alerts/inspection-complete/${id}`);
}

const AlertsApi = {
    getAllAlerts,
    renewInsurance,
    completeInspection,
};

export default AlertsApi;
