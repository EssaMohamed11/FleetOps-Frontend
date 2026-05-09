import api from "/shared/api-handler.js";

// Explicit base URL to avoid conflicts with other modules
const API_BASE = "http://localhost:8000";

// Cairo bounding box — matches the old iframe bbox
const CAIRO_BBOX = { west: 31.10, east: 31.55, south: 29.85, north: 30.05 };

const LIVE_MONITORING_STATUS_OPTIONS = [
    "All",
    "On-time",
    "At-risk",
    "Delayed",
    "Breakdown",
];

const LIVE_MONITORING_SHIFT_OPTIONS = [
    "All Shifts",
    "Morning",
    "Afternoon",
    "Night",
];

// ─── Static Option Getters ─────────────────────────────────────────────────

function getStatusOptions() {
    return [...LIVE_MONITORING_STATUS_OPTIONS];
}

function getShiftOptions() {
    return [...LIVE_MONITORING_SHIFT_OPTIONS];
}

function getDateOptions() {
    const today = new Date().toISOString().split("T")[0];
    return [today]; // Only today is supported for live tracking
}

function getDefaultDate() {
    return getDateOptions()[0];
}

function getMapMeta() {
    return clone({
        labels: [],
        routes: [],
    });
}

// ─── Synchronous Fallback ─────────────────────────────────────────────

function getSnapshot(date) {
    // Return empty placeholder state while loading
    return clone({
        date: date ?? getDefaultDate(),
        summary: { activeTrips: 0, onTime: 0, atRisk: 0, incidents: 0 },
        operations: [],
        alerts: []
    });
}

function getVehicleById(date, vehicleId) {
    return null;
}

// ─── Normalization Helpers ─────────────────────────────────────────────────

function detectShift() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return "Morning";
    if (hour >= 14 && hour < 22) return "Afternoon";
    return "Night";
}

function mapRouteStatus(routeStatus) {
    const map = {
        active: "On-time",
        in_progress: "On-time",
        started: "On-time",
        delayed: "Delayed",
        at_risk: "At-risk",
        breakdown: "Breakdown",
        completed: "On-time",
        pending: "On-time",
    };
    return map[String(routeStatus ?? "").toLowerCase()] ?? "On-time";
}

function formatTimestamp(ts) {
    if (!ts) return "N/A";
    try {
        return new Date(ts).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    } catch {
        return "N/A";
    }
}

function getStatusAlert(status) {
    return (
        {
            "On-time":  "Route cadence is stable",
            "At-risk":  "Needs dispatcher attention",
            "Delayed":  "Behind schedule",
            "Breakdown":"Vehicle breakdown reported",
        }[status] ?? "Monitoring active"
    );
}

function buildPlaybackPath(route, lat, lng) {
    if (Array.isArray(route?.stops) && route.stops.length > 0) {
        let points = [...route.stops]
            .sort((a, b) => a.stop_no - b.stop_no)
            .map(s => [Number(s.latitude), Number(s.longitude)])
            .filter(p => p[0] && p[1]);
        if (points.length > 1) {
            points.push([lat, lng]);
            return points;
        }
    }

    // Original friend's carefully aligned street coordinates (converted from percentages)
    const friendGeometries = [
        [[10, 20], [18, 31], [30, 27], [36, 40]], // north-corridor
        [[14, 49], [25, 60], [34, 45], [42, 71]], // central-arc
        [[49, 63], [60, 54], [72, 61], [81, 49]], // river-loop
        [[58, 30], [67, 39], [76, 29], [87, 34]]  // east-line
    ];

    // Pick one consistently based on route_id
    const routeIdNum = parseInt(route.route_id || route.id || 0, 10);
    const selectedGeo = friendGeometries[routeIdNum % friendGeometries.length];

    // Convert percentages to Lat/Lng
    return selectedGeo.map(([px, py]) => [
        30.05 - (py / 100) * 0.20,
        31.10 + (px / 100) * 0.45,
    ]);
}

function latLngToPercent(lat, lng) {
    const x = ((lng - CAIRO_BBOX.west)  / (CAIRO_BBOX.east  - CAIRO_BBOX.west))  * 100;
    const y = ((CAIRO_BBOX.north - lat) / (CAIRO_BBOX.north - CAIRO_BBOX.south)) * 100;
    return [Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y))];
}

function normalizeRouteToOperation(route, locationData) {
    const driverName =
        route.driver?.user?.name ||
        route.driver?.name ||
        "Unknown Driver";

    const plate =
        route.vehicle?.VehicleLicense ||
        route.vehicle?.plate ||
        `VH-${route.vehicle_id ?? "N/A"}`;

    const status = mapRouteStatus(route.status);

    const lat = Number(locationData?.lat ?? 30.0);
    const lng = Number(locationData?.lng ?? 31.25);
    const speed = Number(locationData?.speed_kmh ?? 0);

    const pos = latLngToPercent(lat, lng);

    return {
        id:           `TRK-${String(route.vehicle_id || route.route_id || route.id).padStart(3, "0")}`,
        driver:       driverName,
        plate,
        status,
        shift:        detectShift(),
        speed:        Math.round(speed),
        eta:          route.scheduled_end_time ? formatTimestamp(route.scheduled_end_time) : "N/A",
        progress:     Number(route.progress ?? 50),
        pos,
        lat,
        lng,
        routeId:      String(route.route_id || route.id),
        destination:  route.route_name || `Route ${route.route_id || route.id}`,
        orderCount:   Number(route.total_stops ?? route.orders_count ?? 0),
        alert:        getStatusAlert(status),
        lastUpdate:   formatTimestamp(locationData?.recorded_at || locationData?.created_at),
        address:      locationData?.address || "Unknown Location",
        temperature:  "N/A",
        timeline:     [
            {
                time: formatTimestamp(locationData?.recorded_at || locationData?.created_at),
                title: "Latest GPS ping",
                location: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            },
        ],
        playbackPath: [[lat, lng], [lat, lng]],
    };
}

function buildSummary(operations) {
    return {
        activeTrips: operations.length,
        onTime:      operations.filter((o) => o.status === "On-time").length,
        atRisk:      operations.filter((o) => o.status === "At-risk" || o.status === "Delayed").length,
        incidents:   operations.filter((o) => o.status === "Breakdown").length,
    };
}

// ─── Real API Fetch ────────────────────────────────────────────────────────

async function fetchLiveSnapshot() {
    try {
        const { data: snapshotData } = await api.get(`${API_BASE}/api/v1/dispatch/live-snapshot`);
        const routes = snapshotData?.data?.routes ?? [];

        if (routes.length === 0) {
            return getSnapshot();
        }

        const operations = routes.map(route => {
            return normalizeRouteToOperation(route, route.location ?? {});
        });

        const today = new Date().toISOString().split("T")[0];
        const alerts = operations
            .filter((op) => op.status !== "On-time")
            .map((op) => ({
                tone: op.status === "Breakdown" ? "danger" : "warning",
                text: `${op.id}: ${op.alert}`,
            }));

        return { date: today, summary: buildSummary(operations), operations, alerts };
    } catch (error) {
        console.error("[LiveMonitoring] API fetch failed:", error);
        return getSnapshot();
    }
}

// ─── Async Snapshot ───────────────────────────────────────────────────────

async function getSnapshotAsync(date) {
    const liveData = await fetchLiveSnapshot();
    if (liveData) return liveData;
    
    return getSnapshot(date ?? getDefaultDate());
}

// ─── Util ──────────────────────────────────────────────────────────────────

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

// ─── Exports ───────────────────────────────────────────────────────────────

const LiveMonitoringApi = {
    getDateOptions,
    getDefaultDate,
    getMapMeta,
    getShiftOptions,
    getSnapshot,
    getSnapshotAsync,
    getStatusOptions,
    getVehicleById,
};

export default LiveMonitoringApi;
