import api from "/shared/api-handler.js";
import {
    ROUTE_DATE_OPTIONS,
    ROUTE_SHIFT_OPTIONS,
    ROUTE_STATUS_OPTIONS,
} from "../storage/routes.js";

const API_BASE = "http://localhost:8000";

async function getRoutes() {
    try {
        const response = await api.get(`${API_BASE}/api/v1/dispatch/routes?per_page=100`);
        // api-handler wraps in response.data. Laravel wraps in .data. Paginator wraps in .data.
        const dbRoutes = response.data?.data?.data || [];
        return dbRoutes.map(mapBackendRouteToFrontend);
    } catch (error) {
        console.error("Failed to fetch routes:", error);
        return [];
    }
}

async function getRouteById(routeId) {
    try {
        // routeId is like "R-1", we need the numeric ID
        const id = routeId.replace("R-", "");
        const [routeResponse, trail] = await Promise.all([
            api.get(`${API_BASE}/api/v1/dispatch/routes/${id}`),
            getRouteTrail(routeId),
        ]);

        if (routeResponse.data && routeResponse.data.success && routeResponse.data.data) {
            const route = mapBackendRouteToFrontend(routeResponse.data.data);
            const routeWithDbOrders = await attachOrderCoordinates(route);
            const routeWithTrail = attachRouteTrail(routeWithDbOrders, trail);
            return attachRoadPath(routeWithTrail, await getRoadPath(routeWithTrail));
        }
        return null;
    } catch (error) {
        console.error(`Failed to fetch route ${routeId}:`, error);
        return null;
    }
}

async function getRoadPath(route) {
    const sourcePoints = route.gpsTrail?.length > 1
        ? route.gpsTrail
        : route.stops;

    const coordinates = (sourcePoints || [])
        .map((point) => ({
            lat: Number(point.lat),
            lng: Number(point.lng),
        }))
        .filter((point) =>
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lng),
        );

    if (coordinates.length < 2) {
        return [];
    }

    const waypointText = coordinates
        .map((point) => `${point.lng},${point.lat}`)
        .join(";");

    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${waypointText}?overview=full&geometries=geojson`,
        );

        if (!response.ok) {
            throw new Error(`OSRM ${response.status}`);
        }

        const data = await response.json();
        const geometry = data.routes?.[0]?.geometry?.coordinates || [];
        return geometry
            .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
            .filter((point) =>
                Number.isFinite(point.lat) &&
                Number.isFinite(point.lng),
            );
    } catch (error) {
        console.error(`Failed to fetch road path for ${route.id}:`, error);
        return [];
    }
}

async function getRouteTrail(routeId) {
    try {
        const id = String(routeId).replace("R-", "");
        const response = await api.get(`${API_BASE}/api/v1/tracking/routes/${id}/trail`);
        const trail = response.data?.data || [];
        return trail.map(mapGpsPingToPoint).filter(Boolean);
    } catch (error) {
        console.error(`Failed to fetch route trail ${routeId}:`, error);
        return [];
    }
}

async function getOrdersForRoute(route) {
    if (!route?.driverId || !route?.vehicleNumericId) {
        return [];
    }

    try {
        const response = await api.get(`${API_BASE}/api/v1/orders?per_page=200`);
        const orders = response.data?.data?.data || [];
        return orders
            .filter((order) =>
                String(order["DriverID(FK)"]) === String(route.driverId) &&
                String(order["vehicle_id(FK)"]) === String(route.vehicleNumericId) &&
                Number.isFinite(Number(order.Latitude)) &&
                Number.isFinite(Number(order.Longitude)),
            )
            .slice(0, route.totalStops);
    } catch (error) {
        console.error(`Failed to fetch orders for route ${route.id}:`, error);
        return [];
    }
}

function getStatusOptions() {
    return [...ROUTE_STATUS_OPTIONS];
}

function getShiftOptions() {
    return [...ROUTE_SHIFT_OPTIONS];
}

function getDateOptions() {
    return [...ROUTE_DATE_OPTIONS];
}

function getOverviewStats(routes) {
    
    const activeRoutes = routes.filter((route) =>
        ["Active", "In Transit", "InProgress"].includes(route.status),
    ).length;
    
    // For today, we just take the first date option as a proxy, or check real date
    const todayStr = new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
    const completedToday = routes.filter(
        (route) => route.status === "Completed" && route.date === todayStr,
    ).length;
    
    const totalDistanceKm = routes.reduce((sum, route) => sum + route.distanceKm, 0);
    const avgStops = routes.length > 0 ? Math.round(
        routes.reduce((sum, route) => sum + route.totalStops, 0) / routes.length,
    ) : 0;

    return {
        activeRoutes,
        avgStops,
        completedToday,
        totalDistanceKm,
    };
}

async function createRoute(payload) {
    try {
        const backendPayload = {
            route_name: `Route ${new Date().toLocaleTimeString()}`,
            driver_id: 5, // Mock driver ID for now, since UI doesn't have ID dropdown
            vehicle_id: 1, // Mock vehicle ID
            scheduled_start_time: new Date().toISOString(),
            status: "Planned",
            stops: [
                {
                    order_id: 1, // Need real order ID
                    scheduled_arrival_time: new Date().toISOString()
                }
            ]
        };
        const response = await api.post(`${API_BASE}/api/v1/dispatch/routes`, backendPayload);
        if (response.data && response.data.success) {
            return mapBackendRouteToFrontend(response.data.data);
        }
        return null;
    } catch (error) {
        console.error("Failed to create route:", error);
        return null;
    }
}

// Cairo center + spread stops around it in a deterministic pattern
const CAIRO_LAT = 30.0444;
const CAIRO_LNG = 31.2357;

// Generates a stable lat/lng for a stop when the DB has no GPS data.
// Uses sine/cosine spread around Cairo so stops form a visible circuit.
function stubStopCoords(routeId, stopIndex) {
    const angle = (stopIndex / 8) * 2 * Math.PI; // spread over 360°
    const radius = 0.025 + (routeId % 5) * 0.005; // 2.5–5km spread
    return {
        lat: CAIRO_LAT + Math.sin(angle) * radius,
        lng: CAIRO_LNG + Math.cos(angle) * radius,
    };
}

function createInitials(name) {
    const tokens = (name || "UR")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2);
    return tokens.map((token) => token[0]?.toUpperCase() ?? "").join("") || "UR";
}

function createFallbackStops(routeId, count, status) {
    const stopCount = Math.max(Number(count) || 0, 1);

    return Array.from({ length: stopCount }, (_, index) => {
        const coords = stubStopCoords(routeId, index);
        return {
            index: index + 1,
            customer: `Route point ${index + 1}`,
            address: "Greater Cairo route area",
            orderId: "--",
            planned: "--",
            actual: "--",
            delivered: status === "Completed",
            lat: coords.lat,
            lng: coords.lng,
        };
    });
}

function mapBackendRouteToFrontend(dbRoute) {
    const totalStops = Number(dbRoute.total_stops) || 0;
    
    const routeNumericId = Number(dbRoute.route_id) || 1;
    const mappedStops = (dbRoute.stops || []).map((stop, index) => {
        const dbLat = stop.latitude != null ? Number(stop.latitude) : null;
        const dbLng = stop.longitude != null ? Number(stop.longitude) : null;
        const stub  = (!dbLat || !dbLng) ? stubStopCoords(routeNumericId, index) : null;
        return {
            index: stop.stop_no || index + 1,
            customer: stop.order?.customer?.user?.name || "Unknown Customer",
            address: stop.order?.Area || "Unknown Address",
            orderId: stop.order?.OrderID || stop.order_id || "Unknown",
            planned: stop.eta ? new Date(stop.eta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--",
            actual: stop.actual_arrival_time ? new Date(stop.actual_arrival_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--",
            delivered: stop.status === "Completed",
            lat: dbLat || stub.lat,
            lng: dbLng || stub.lng,
        };
    });

    const stops = mappedStops.length > 0
        ? mappedStops
        : createFallbackStops(routeNumericId, totalStops, dbRoute.status);
    const displayTotalStops = Math.max(totalStops, stops.length);
    const completedStops = dbRoute.status === "Completed"
        ? displayTotalStops
        : stops.filter(s => s.delivered).length;
    let progress = displayTotalStops > 0 ? Math.round((completedStops / displayTotalStops) * 100) : 0;
    if (dbRoute.status === "Completed") progress = 100;

    const dateStr = dbRoute.created_at ? new Date(dbRoute.created_at).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) : "Unknown Date";

    const totalWeightKg = (dbRoute.stops || []).reduce((sum, stop) => sum + (Number(stop.order?.Weight) || 0), 0);
    const totalVolumeM3 = (dbRoute.stops || []).reduce((sum, stop) => sum + (Number(stop.order?.Volume) || 0), 0);

    return {
        id: `R-${dbRoute.route_id}`,
        routeNumericId,
        driverId: dbRoute.driver_id,
        driverName: dbRoute.driver?.user?.name || "Unassigned Driver",
        driverInitials: createInitials(dbRoute.driver?.user?.name),
        vehicleNumericId: dbRoute.vehicle_id,
        vehicleId: dbRoute.vehicle?.VehicleLicense || `TRK-${dbRoute.vehicle_id || "000"}`,
        vehicleType: dbRoute.vehicle?.VehicleType || "Unknown",
        status: dbRoute.status || "Pending",
        shift: "All Shifts",
        completedStops,
        totalStops: displayTotalStops,
        progress,
        distanceKm: Number(dbRoute.total_distance) || 0,
        startTime: dbRoute.actual_start_time ? new Date(dbRoute.actual_start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--",
        eta: dbRoute.scheduled_end_time ? new Date(dbRoute.scheduled_end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--",
        etaStatus: dbRoute.status === "Completed" ? "" : "On Time",
        date: dateStr,
        version: 1,
        totalWeightKg,
        totalVolumeM3,
        eventTime: "08:00 AM",
        playbackFrames: Math.max(1, displayTotalStops * 10),
        playbackStopsDelivered: completedStops,
        playbackStopsRemaining: displayTotalStops - completedStops,
        currentLocation: null,
        gpsTrail: [],
        eventLog: [{ title: `Route ${dbRoute.status}`, time: dbRoute.created_at ? new Date(dbRoute.created_at).toLocaleTimeString() : "--" }],
        stops,
        stopsSource: mappedStops.length > 0 ? "route_stops" : "fallback",
    };
}

async function attachOrderCoordinates(route) {
    if (!route || route.stopsSource !== "fallback") {
        return route;
    }

    const orders = await getOrdersForRoute(route);
    if (!orders.length) {
        return route;
    }

    const orderStops = orders.map((order, index) => ({
        index: index + 1,
        customer: order.customer?.user?.name || order.customer?.name || `Order ${order.OrderID}`,
        address: order.Area || "Order delivery location",
        orderId: order.OrderID ? `ORD-${order.OrderID}` : "--",
        planned: order.ETA ? String(order.ETA).trim() : "--",
        actual: order.DeliveredAt
            ? new Date(order.DeliveredAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
              })
            : "--",
        delivered: order.Status === "Delivered",
        lat: Number(order.Latitude),
        lng: Number(order.Longitude),
    }));

    const completedStops = route.status === "Completed"
        ? orderStops.length
        : orderStops.filter((stop) => stop.delivered).length;

    return {
        ...route,
        completedStops,
        playbackFrames: Math.max(1, orderStops.length * 10),
        playbackStopsDelivered: completedStops,
        playbackStopsRemaining: Math.max(orderStops.length - completedStops, 0),
        progress: route.status === "Completed"
            ? 100
            : Math.round((completedStops / orderStops.length) * 100),
        stops: orderStops,
        stopsSource: "orders",
        totalStops: orderStops.length,
    };
}

function mapGpsPingToPoint(ping) {
    const lat = Number(ping.lat);
    const lng = Number(ping.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return {
        lat,
        lng,
        speedKmh: Number(ping.speed_kmh) || 0,
        heading: Number(ping.heading) || 0,
        recordedAt: ping.recorded_at || ping.created_at || "",
    };
}

function attachRouteTrail(route, trail) {
    if (!route || !trail.length) {
        return route;
    }

    const currentLocation = trail[trail.length - 1];

    return {
        ...route,
        currentLocation,
        gpsTrail: trail,
        eventTime: currentLocation.recordedAt
            ? new Date(currentLocation.recordedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
              })
            : route.eventTime,
        playbackFrames: Math.max(route.playbackFrames, trail.length),
        eventLog: [
            ...route.eventLog,
            {
                title: `${route.vehicleId} GPS ping received`,
                time: currentLocation.recordedAt
                    ? new Date(currentLocation.recordedAt).toLocaleTimeString()
                    : "--",
            },
        ],
    };
}

function attachRoadPath(route, roadPath) {
    if (!route || !roadPath.length) {
        return route;
    }

    return {
        ...route,
        roadPath,
        playbackFrames: Math.max(route.playbackFrames, roadPath.length),
    };
}

const RoutesApi = {
    createRoute,
    getDateOptions,
    getOverviewStats,
    getRouteById,
    getRoutes,
    getRouteTrail,
    getShiftOptions,
    getStatusOptions,
};

export default RoutesApi;
