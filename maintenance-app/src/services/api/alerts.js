/**
 * FleetOps Maintenance — Alerts API Service
 * 
 * Fetches and manages fleet-wide alerts for odometer, insurance,
 * annual inspections, and part lifecycle.
 */

import api from "/shared/api-handler.js";

const BASE_URL = "http://localhost:8000";

/**
 * Reads the auth token from localStorage.
 */
function authHeaders() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Generic GET helper.
 */
async function get(path) {
    try {
        const { data: res } = await api.get(path, {
            baseURL: BASE_URL,
            headers: authHeaders(),
        });

        if (!res?.success) {
            console.error(`[AlertsApi] ${path}: success=false`, res);
            return null;
        }

        return res.data ?? null;
    } catch (err) {
        console.error(`[AlertsApi] ${path} failed:`, err?.message ?? err);
        return null;
    }
}

/**
 * Generic POST helper.
 */
async function post(path, body = {}) {
    try {
        const { data: res } = await api.post(path, body, {
            baseURL: BASE_URL,
            headers: authHeaders(),
        });
        return res;
    } catch (err) {
        console.error(`[AlertsApi] POST ${path} failed:`, err?.message ?? err);
        return { success: false, message: "Network error" };
    }
}

const AlertsApi = {
    /**
     * Fetches all 4 categories of alerts and shapes them for the view.
     */
    async getAllAlerts() {
        const [insurance, inspection, odometer, parts] = await Promise.all([
            get("/api/v1/maintenance/alerts/insurance"),
            get("/api/v1/maintenance/alerts/inspection"),
            get("/api/v1/maintenance/alerts/odometer"),
            get("/api/v1/maintenance/alerts/parts"),
        ]);

        return {
            insurance: (insurance || []).map(a => ({
                id: a.id,
                vehiclePlate: a.license_plate ?? a.plate_number ?? a.vehicle_id ?? "—",
                vehicleModel: a.vehicle_model ?? a.model ?? "—",
                policyNumber: a.policy_number ?? "—",
                expiryDate: a.expiry_date ?? a.insurance_expiry ?? "—",
                daysRemaining: a.days_left ?? a.days_until_expiry ?? 0,
                status: a.status ?? (Number(a.days_left ?? a.days_until_expiry) < 30 ? "warning" : "success")
            })),
            inspection: (inspection || []).map(a => ({
                id: a.id,
                vehiclePlate: a.license_plate ?? a.plate_number ?? a.vehicle_id ?? "—",
                vehicleModel: a.vehicle_model ?? a.model ?? "—",
                lastInspection: a.last_inspection_date ?? a.last_inspection ?? "—",
                nextDueDate: a.expiry_date ?? a.next_due_date ?? "—",
                daysRemaining: a.days_left ?? a.days_until_expiry ?? 0,
                status: a.status ?? (Number(a.days_left ?? a.days_until_expiry) < 0 ? "danger" : "success")
            })),
            odometer: (odometer || []).map(a => ({
                vehiclePlate: a.license_plate ?? a.plate_number ?? a.vehicle_id ?? "—",
                vehicleModel: a.vehicle_model ?? a.model ?? "—",
                lastServiceKM: a.last_service_km ?? 0,
                currentOdometer: a.current_km ?? a.current_odometer ?? a.odometer_km ?? 0,
                kmSinceService: a.km_since_last_service ?? 0,
                threshold: a.service_threshold ?? a.threshold_km ?? 10000,
                status: a.status ?? (Number(a.km_since_last_service) > (Number(a.service_threshold ?? 10000) - 500) ? "warning" : "success")
            })),
            parts: (parts || []).map(a => ({
                vehiclePlate: a.license_plate ?? a.plate_number ?? a.vehicle_id ?? "Stock",
                vehicleModel: a.vehicle_model ?? a.model ?? "—",
                partName: a.part_name ?? a.name ?? "—",
                installDate: a.install_date ?? "—",
                usage: a.usage_hours ?? a.usage ?? "—",
                lifespan: a.expected_lifespan ?? a.lifespan ?? "—",
                status: a.status ?? (a.stock_level < a.min_stock ? "warning" : "success")
            }))
        };
    },

    /**
     * Marks an insurance policy as renewed.
     */
    async renewInsurance(id) {
        return post(`/api/v1/maintenance/alerts/insurance/${id}/renew`);
    },

    /**
     * Marks an annual inspection as complete.
     */
    async completeInspection(id) {
        return post(`/api/v1/maintenance/alerts/inspection/${id}/complete`);
    }
};

export default AlertsApi;