import api from "/shared/api-handler.js";

// ─── Global Setup ─────────────────────────────────────────────────────────────

api.setBaseURL("http://localhost:8000/api/v1/");

// normalize functions to handle different API response formats and ensure consistent data structure across the app.
function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWindow(order) {
    return new Date(order?.PromisedWindow).toLocaleString();
}

function normalizeOrder(rawOrder) {
    const orderId = rawOrder?.OrderID ?? rawOrder?.id;
    const customerName =
        rawOrder?.customer?.user?.name ||
        rawOrder?.customer?.name ||
        rawOrder?.customer ||
        "Unknown Customer";

    const type = rawOrder?.Type || "Normal";
    const isPerishable = Boolean(rawOrder?.Perishable || type === "Perishable");
    const isExpress = type === "Express";
    const area = rawOrder?.Area || rawOrder?.address || "Unknown Area";

    const normalized = {
        ...rawOrder,
        id: String(orderId),
        OrderID: orderId,
        customer: customerName,
        address: area,
        Area: area,
        weight: toNumber(rawOrder?.Weight ?? rawOrder?.weight),
        Weight: toNumber(rawOrder?.Weight ?? rawOrder?.weight),
        volume: toNumber(rawOrder?.Volume ?? rawOrder?.volume),
        Volume: toNumber(rawOrder?.Volume ?? rawOrder?.volume),
        window: normalizeWindow(rawOrder),
        DeliveryTimeWindow: normalizeWindow(rawOrder),
        perishable: isPerishable,
        express: isExpress,
        Type: type,
        priority: toNumber(
            rawOrder?.priority_score ??
                rawOrder?.Priority ??
                rawOrder?.priority,
            50,
        ),
        selected: Boolean(rawOrder?.selected),
        lat: toNumber(rawOrder?.Latitude ?? rawOrder?.lat, 24.7136),
        lng: toNumber(rawOrder?.Longitude ?? rawOrder?.lng, 46.6753),
    };

    return normalized;
}

function normalizeVehicle(rawVehicle) {
    return {
        ...rawVehicle,
        vehicleId: rawVehicle?.vehicle_id,
        plate:
            rawVehicle?.VehicleLicense ||
            rawVehicle?.plate ||
            `VH-${rawVehicle?.vehicle_id ?? "N/A"}`,
        type: rawVehicle?.VehicleType || rawVehicle?.type || "Light",
        maxWeight: toNumber(
            rawVehicle?.MaxWeightCapacity ?? rawVehicle?.maxWeight,
            0,
        ),
        maxVolume: toNumber(rawVehicle?.MaxVolume ?? rawVehicle?.maxVolume, 0),
        status: rawVehicle?.Status || rawVehicle?.status || "Available",
    };
}

function normalizeDriver(rawDriver) {
    return {
        ...rawDriver,
        id: rawDriver?.driver_id,
        name: rawDriver?.user?.name || rawDriver?.name || "Unknown Driver",
        license: rawDriver?.license_type,
        score: toNumber(rawDriver?.score),
        status: rawDriver?.status,
    };
}

function parseWindowEndHour(windowValue) {
    const fallback = 18;
    if (!windowValue || typeof windowValue !== "string") {
        return fallback;
    }

    const endPart = windowValue.split("-")[1];
    if (!endPart) {
        return fallback;
    }

    const endHour = Number.parseInt(endPart.split(":")[0], 10);
    return Number.isFinite(endHour) ? endHour : fallback;
}

// ============================================================================
// API METHODS
// ============================================================================

/**
 * Get all available areas from existing orders
 * @param {Array} orders - Orders to extract areas from (optional, for performance)
 * @returns {Promise<Array>} List of areas
 */
async function getAreas(orders = null) {
    try {
        const ordersToUse = orders !== null ? orders : await getOrders();
        const uniqueAreas = Array.from(
            new Set(ordersToUse.map((order) => order.Area).filter(Boolean)),
        );
        return uniqueAreas.length > 0 ? uniqueAreas : [...AREAS];
    } catch {
        return [...AREAS];
    }
}

/**
 * Get all vehicles
 * @returns {Promise<Array>} List of vehicles
 */
async function getVehicles() {
    try {
        const { data } = await api.get("dispatch/vehicles/available");
        const vehicles = Array.isArray(data?.data)
            ? data.data.map(normalizeVehicle)
            : [];
        // console.log(vehicles);

        if (vehicles.length > 0) {
            return vehicles;
        }
    } catch (error) {
        console.warn(
            "Failed to fetch vehicles from API, using mock data",
            error,
        );
    }

    return VEHICLES.map((vehicle) => ({ ...vehicle }));
}

/**
 * Get all drivers
 * @returns {Promise<Array>} List of drivers
 */
async function getDrivers() {
    try {
        const { data } = await api.get("users/drivers/Available");
        const drivers = Array.isArray(data?.data)
            ? data.data.map(normalizeDriver)
            : [];

        if (drivers.length > 0) {
            return drivers;
        }
    } catch (error) {
        console.warn(
            "Failed to fetch drivers from API, using mock data",
            error,
        );
    }

    return DRIVERS.map((driver) => ({ ...driver }));
}

/**
 * Get all orders
 * @returns {Promise<Array>} List of pending orders
 */
async function getOrders(filters = {}) {
    let orders = [];

    try {
        const { data } = await api.get("orders/Pending");
        const rawOrders = Array.isArray(data?.data) ? data.data : [];
        orders = rawOrders.map(normalizeOrder);
    } catch (error) {
        console.error(
            "Failed to fetch pending orders from API, using mock orders",
            error,
        );
        orders = MOCK_ORDERS.map(normalizeOrder);
    }

    if (!filters || Object.keys(filters).length === 0) {
        return orders;
    }

    return orders.filter((order) => {
        const search = (filters.search || "").toLowerCase().trim();
        const area = filters.area || "All";
        const type = filters.type || "all";

        const matchesSearch =
            search.length === 0 ||
            order.id.toLowerCase().includes(search) ||
            order.customer.toLowerCase().includes(search) ||
            order.address.toLowerCase().includes(search);

        const matchesArea = area === "All" || order.Area === area;

        const matchesType =
            type === "all" ||
            (type === "perish" && order.perishable) ||
            (type === "express" && order.express) ||
            (type === "normal" && !order.perishable && !order.express);

        return matchesSearch && matchesArea && matchesType;
    });
}

/**
 * Get paginated orders
 * @param {number} page - Page number (0-indexed)
 * @param {number} pageSize - Number of items per page
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} Paginated result with data and metadata
 */
async function getOrdersPaginated(page = 0, pageSize = 25, filters = {}) {
    const allOrders = await getOrders(filters);
    const start = page * pageSize;
    const end = start + pageSize;
    const data = allOrders.slice(start, end);

    return {
        data,
        pagination: {
            page,
            pageSize,
            total: allOrders.length,
            totalPages: Math.max(1, Math.ceil(allOrders.length / pageSize)),
            hasNext: end < allOrders.length,
            hasPrev: page > 0,
        },
    };
}

/**
 * Get order by ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object|null>} Order object or null
 */
async function getOrderById(orderId) {
    const orders = await getOrders();
    return orders.find((order) => String(order.id) === String(orderId)) || null;
}

/**
 * Sort orders by priority
 * @param {Array} orders - Orders to sort
 * @returns {Promise<Array>} Sorted orders
 */
async function sortOrdersByPriority(orders) {
    const orderIds = orders
        .map((order) => Number(order.OrderID ?? order.id))
        .filter((id) => Number.isFinite(id));

    if (orderIds.length === 0) {
        return [];
    }

    try {
        const { data } = await api.post("dispatch/priority-score", {
            order_ids: orderIds,
        });

        const scoredOrders = Array.isArray(data?.data) ? data.data : [];
        const scoreByOrderId = new Map(
            scoredOrders.map((item) => [
                String(item.OrderID),
                toNumber(item.priority_score, 50),
            ]),
        );

        return [...orders]
            .map((order) => ({
                ...order,
                priority:
                    scoreByOrderId.get(String(order.OrderID ?? order.id)) ??
                    order.priority,
            }))
            .sort((a, b) => b.priority - a.priority);
    } catch (error) {
        console.warn(
            "Priority score endpoint failed, falling back to local sorting",
            error,
        );

        return [...orders].sort((a, b) => {
            if (a.perishable !== b.perishable) {
                return a.perishable ? -1 : 1;
            }
            if (a.express !== b.express) {
                return a.express ? -1 : 1;
            }
            return b.priority - a.priority;
        });
    }
}

/**
 * Create geographic clusters from orders
 * @param {Array} orders - Orders to cluster
 * @returns {Promise<Array>} Array of clusters
 */
async function createGeoClusters(orders) {
    const orderIds = orders
        .map((order) => Number(order.OrderID ?? order.id))
        .filter((id) => Number.isFinite(id));

    try {
        const { data } = await api.post("dispatch/cluster-orders", {
            order_ids: orderIds,
        });

        const clusters = Array.isArray(data?.data) ? data.data : [];

        return clusters.map((cluster) => ({
            zone: cluster.zone || "unknown",
            color: cluster.color || "#14b8a6",
            orders: Array.isArray(cluster.orders)
                ? cluster.orders.map(normalizeOrder)
                : [],
        }));
    } catch (error) {
        console.warn(
            "Cluster orders endpoint failed, using local grouping",
            error,
        );
        alert("Cluster orders endpoint failed, using local grouping");
        const groups = {};
        orders.forEach((order) => {
            if (!groups[order.address]) {
                groups[order.address] = [];
            }
            groups[order.address].push(order);
        });

        const clusterColors = [
            "#14b8a6",
            "#6366f1",
            "#f59e0b",
            "#f43f5e",
            "#8b5cf6",
            "#06b6d4",
            "#10b981",
            "#ec4899",
            "#f97316",
            "#84cc16",
        ];

        return Object.entries(groups).map(([area, groupedOrders], index) => ({
            zone: area,
            color: clusterColors[index % clusterColors.length],
            orders: groupedOrders,
        }));
    }
}

/**
 * Check vehicle capacity
 * @param {Object} vehicle - Vehicle object
 * @param {Array} orders - Orders to check
 * @returns {Promise<Object>} Capacity check result
 */
async function checkVehicleCapacity(vehicle, orders, clusterMeta = {}) {
    const totalWeight = orders.reduce(
        (sum, order) => sum + toNumber(order.Weight ?? order.weight),
        0,
    );
    const totalVolume = orders.reduce(
        (sum, order) => sum + toNumber(order.Volume ?? order.volume),
        0,
    );

    const maxWeight = Math.max(toNumber(vehicle.maxWeight), 1);
    const maxVolume = Math.max(toNumber(vehicle.maxVolume), 1);
    const weightPct = Math.round((totalWeight / maxWeight) * 100);
    const volPct = Math.round((totalVolume / maxVolume) * 100);

    return {
        ok: weightPct <= 100 && volPct <= 100,
        weightPct,
        volPct,
        totalWeight: Math.round(totalWeight),
        totalVolume: Math.round(totalVolume * 10) / 10,
    };
}

function formatEtaFromValue(etaValue, startDate) {
    const parsedEta = parseApiDateTime(etaValue);
    if (!parsedEta) {
        return "—";
    }

    const baseDate = parseApiDateTime(startDate) || new Date();
    const etaAsDate =
        parsedEta.getTime() < 1e12
            ? new Date(baseDate.getTime() + parsedEta.getTime() * 1000)
            : parsedEta;

    const pad = (value) => String(value).padStart(2, "0");

    return `${etaAsDate.getFullYear()}/${pad(etaAsDate.getMonth() + 1)}/${pad(etaAsDate.getDate())} ${pad(etaAsDate.getHours())}:${pad(etaAsDate.getMinutes())}:${pad(etaAsDate.getSeconds())}`;
}

function parseApiDateTime(value) {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        const asDate =
            value > 1e12
                ? new Date(value)
                : value > 1e10
                  ? new Date(value * 1000)
                  : new Date(value * 1000);
        return Number.isNaN(asDate.getTime()) ? null : asDate;
    }

    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const normalized = trimmed.includes("T")
        ? trimmed
        : trimmed.replace(" ", "T");

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }

    const match = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
    );
    if (!match) {
        return null;
    }

    const [, year, month, day, hour, minute, second = "0"] = match;
    const fallbackDate = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
    );

    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

function buildOrderLookup(clusters) {
    const lookup = new Map();

    (Array.isArray(clusters) ? clusters : []).forEach((cluster) => {
        (Array.isArray(cluster?.orders) ? cluster.orders : []).forEach(
            (order) => {
                lookup.set(String(order.OrderID ?? order.id), order);
            },
        );
    });

    return lookup;
}

function mapOptimizedStops(orderedStops, orderLookup, startDate) {
    return (Array.isArray(orderedStops) ? orderedStops : []).map((stop) => {
        const orderId = String(stop?.order_id ?? stop?.orderId ?? "");
        const sourceOrder = orderLookup.get(orderId) || {};
        const etaLabel = formatEtaFromValue(stop?.eta_datetime, startDate);
        const etaDate = parseApiDateTime(stop?.eta_datetime);
        const etaHour = etaDate ? etaDate.getHours() : null;
        const windowEnd = parseWindowEndHour(sourceOrder.window);

        return {
            num: toNumber(stop?.stop_no, 0),
            customer: sourceOrder.customer || `Order ${orderId || "—"}`,
            address: sourceOrder.address || sourceOrder.Area || "Unknown Area",
            orderId,
            eta: etaLabel,
            travel: "—",
            withinWindow:
                etaHour === null
                    ? true
                    : Number.isFinite(windowEnd)
                      ? etaHour < windowEnd
                      : true,
            latitude: toNumber(stop?.latitude ?? sourceOrder.lat),
            longitude: toNumber(stop?.longitude ?? sourceOrder.lng),
        };
    });
}

/**
 * Optimize all route clusters using the real API.
 * @param {Array} clusters - Clusters with orders to optimize
 * @param {string} startDate - Route start date/time in ISO format
 * @returns {Promise<Array>} Optimized cluster results
 */
async function optimizeRouteSequence(
    clusters,
    startDate = new Date().toISOString(),
) {
    const normalizedClusters = (Array.isArray(clusters) ? clusters : [])
        .map((cluster) => {
            const orderIds = Array.isArray(cluster?.orders)
                ? cluster.orders
                      .map((order) => Number(order.OrderID ?? order.id))
                      .filter((id) => Number.isFinite(id))
                : [];

            return {
                zone: cluster?.zone || "unknown",
                orders_ids: orderIds,
            };
        })
        .filter((cluster) => cluster.orders_ids.length > 0);

    if (normalizedClusters.length === 0) {
        return [];
    }

    const orderLookup = buildOrderLookup(clusters);

    try {
        const { data } = await api.post("dispatch/routes/optimize", {
            clusters: normalizedClusters,
            start_date: startDate,
        });

        const optimizedClusters = Array.isArray(data?.data?.clusters)
            ? data.data.clusters
            : [];

        if (optimizedClusters.length === 0) {
            throw new Error("Invalid optimize response payload");
        }

        return optimizedClusters.map((cluster) => ({
            zone: cluster?.zone || "unknown",
            color:
                (Array.isArray(clusters)
                    ? clusters.find((item) => item.zone === cluster?.zone)
                    : null
                )?.color || "#14b8a6",
            optimizedStops: mapOptimizedStops(
                cluster?.ordered_stops,
                orderLookup,
                startDate,
            ),
            estimatedDistanceM: toNumber(cluster?.estimated_distance_m),
            estimatedDurationS: toNumber(cluster?.estimated_duration_s),
        }));
    } catch (error) {
        console.warn(
            "Optimize routes endpoint failed, using local sequencing fallback",
            error,
        );

        return (Array.isArray(clusters) ? clusters : []).map((cluster) => ({
            zone: cluster?.zone || "unknown",
            color: cluster?.color || "#14b8a6",
            optimizedStops: (Array.isArray(cluster?.orders)
                ? cluster.orders
                : []
            ).map((order, index) => {
                const baseTime = 9 * 60 + index * 18;
                const hours = Math.floor(baseTime / 60);
                const minutes = baseTime % 60;
                const windowEnd = parseWindowEndHour(order.window);

                return {
                    num: index + 1,
                    customer: order.customer,
                    address: order.address,
                    orderId: String(order.OrderID ?? order.id),
                    eta: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
                    travel:
                        index === 0
                            ? "—"
                            : `${12 + Math.floor(Math.random() * 15)} min`,
                    withinWindow: hours < windowEnd,
                    latitude: toNumber(order.lat),
                    longitude: toNumber(order.lng),
                };
            }),
            estimatedDistanceM: Math.round(
                (Array.isArray(cluster?.orders) ? cluster.orders.length : 0) *
                    4200,
            ),
            estimatedDurationS: Math.round(
                (Array.isArray(cluster?.orders) ? cluster.orders.length : 0) *
                    18 *
                    60,
            ),
        }));
    }
}

/**
 * Create a route in backend.
 * @param {Object} payload - Route payload
 * @returns {Promise<Object>} Backend response
 */
async function createRoute(payload) {
    const { data } = await api.post("dispatch/routes", payload);
    return data;
}

/**
 * Create an emergency order payload
 * @param {Object} payload - Raw emergency order data
 * @returns {Promise<Object>} Emergency order object
 */
async function createEmergencyOrder(payload) {
    await delay(50);

    return {
        id: `ORD-E${Date.now().toString().slice(-6)}`,
        customer: payload.customer,
        address: payload.address,
        weight: Number(payload.weight) || 5,
        volume: Number(payload.volume) || 0.3,
        priority: 99,
        window: payload.window || "ASAP",
        perishable: false,
        express: true,
        selected: true,
        lat: 24.65 + Math.random() * 0.15,
        lng: 46.6 + Math.random() * 0.2,
    };
}

/**
 * Insert emergency stop in route stops list.
 * @param {Array} currentStops - Existing route stops
 * @param {Object} emergencyOrder - Emergency order
 * @param {string} position - start|end|optimal
 * @returns {Promise<Array>} Updated and renumbered stops
 */
async function insertEmergencyStop(
    currentStops,
    emergencyOrder,
    position = "optimal",
) {
    await delay(20);

    const emergencyStop = {
        num: 0,
        customer: emergencyOrder.customer,
        address: emergencyOrder.address,
        orderId: emergencyOrder.id,
        eta: "ASAP",
        travel: "—",
        withinWindow: true,
    };

    let updatedStops = [];
    if (position === "end") {
        updatedStops = [...currentStops, emergencyStop];
    } else {
        // start and optimal are front-loaded for now.
        updatedStops = [emergencyStop, ...currentStops];
    }

    return updatedStops.map((stop, index) => ({
        ...stop,
        num: index + 1,
    }));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Simulate API delay
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// EXPORTS
// ============================================================================

const RoutePlanningAPI = {
    getAreas,
    getVehicles,
    getDrivers,
    getOrders,
    getOrdersPaginated,
    getOrderById,
    sortOrdersByPriority,
    createGeoClusters,
    optimizeRouteSequence,
    createRoute,
    checkVehicleCapacity,
    createEmergencyOrder,
    insertEmergencyStop,
};

export default RoutePlanningAPI;
