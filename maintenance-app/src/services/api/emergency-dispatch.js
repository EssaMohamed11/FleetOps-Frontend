import api from "/shared/api-handler.js";

const BASE_URL = "http://localhost:8000";

function authHeaders() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function get(path) {
    try {
        const { data: res } = await api.get(path, {
            baseURL: BASE_URL,
            headers: authHeaders(),
        });
        if (!res?.success) {
            console.warn(`[EmergencyDispatchApi] GET ${path}: success=false`, res);
            return [];
        }
        return Array.isArray(res.data) ? res.data : (res.data || []);
    } catch (err) {
        console.error(`[EmergencyDispatchApi] GET ${path} failed:`, err?.message ?? err);
        return [];
    }
}

async function post(path, body = {}) {
    try {
        const { data: res } = await api.post(path, body, {
            baseURL: BASE_URL,
            headers: authHeaders(),
        });
        return res ?? null;
    } catch (err) {
        console.error(`[EmergencyDispatchApi] POST ${path} failed:`, err?.message ?? err);
        return null;
    }
}

function shapeIncidents(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(r => ({
        id: r.incident_id || r.id,
        status: r.status || 'Active', // Fallback
        vehicle: {
            plate: r.vehicle?.VehicleLicense || r.vehicle_id || 'Unknown',
            model: r.vehicle?.VehicleModel || 'Unknown',
            type: r.vehicle?.VehicleType || 'Truck',
        },
        driver: {
            name: r.driver?.DriverName || r.driver?.name || 'Unknown Driver',
            phone: r.driver?.phone_no || 'N/A'
        },
        location: {
            address: r.location || 'Unknown Location',
            gps: 'GPS N/A'
        },
        timeAgo: (() => {
            const date = new Date(r.incident_ts || r.created_at);
            const diff = Date.now() - date.getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 60) return `${mins}m ago`;
            return `${Math.floor(mins / 60)}h ago`;
        })(),
        timestamp: r.incident_ts || r.created_at,
        issue: r.description || r.type || 'Breakdown reported'
    }));
}

const emergencyDispatchService = {
    getIncidents: async () => {
        const raw = await get("/api/v1/maintenance/emergency/incidents");
        return shapeIncidents(raw);
    },
    
    getIncidentById: async (id) => {
        const raw = await get(`/api/v1/maintenance/emergency/incident-details/${id}`);
        // `raw` here is an object, so we wrap it in an array to shape, then extract
        if (!raw || Object.keys(raw).length === 0) return null;
        const shaped = shapeIncidents([raw]);
        return shaped.length > 0 ? shaped[0] : null;
    },

    getMechanics: async (incidentId) => {
        return await get(`/api/v1/maintenance/emergency/nearby-mechanics/${incidentId}`);
    },
    
    dispatchMechanic: async (incidentId, mechanicId) => {
        return await post(`/api/v1/maintenance/emergency/dispatch-mechanic/${incidentId}`, { mechanic_id: mechanicId });
    }
};

export default emergencyDispatchService;
