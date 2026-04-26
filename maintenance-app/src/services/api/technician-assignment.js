import WorkOrdersApi from "./work-orders.js";

const ASSIGNMENT_ENDPOINTS = [
    "/assignments",
    "/work-orders/assign",
    "/work-orders/assignments",
];

let cachedApiClient;

async function getApiClient() {
    if (cachedApiClient !== undefined) {
        return cachedApiClient;
    }

    const candidatePaths = [
        "/shared/api-handler.js",
        "/Server/scripts/api-handler.js",
    ];

    for (const path of candidatePaths) {
        try {
            const module = await import(path);
            const apiClient = module.default;
            apiClient.setBaseURL("http://localhost:3000");
            cachedApiClient = apiClient;
            return cachedApiClient;
        } catch (error) {
            // Continue to the next candidate path and fall back to local data if needed.
        }
    }

    cachedApiClient = null;
    return cachedApiClient;
}

function formatDateLabel(value) {
    if (!value) {
        return "—";
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        return value;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-GB");
}

function getInitials(name) {
    const parts = String(name ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (!parts.length) {
        return "NA";
    }

    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function normalizeType(value) {
    const normalized = String(value ?? "").toLowerCase();

    if (normalized.includes("emerg")) {
        return "Emergency";
    }

    if (normalized.includes("break")) {
        return "Breakdown";
    }

    return "Routine";
}

function normalizePriority(value, type) {
    const normalized = String(value ?? "").toLowerCase();

    if (normalized.includes("urgent")) {
        return "Urgent";
    }

    if (normalized.includes("emergency")) {
        return "Urgent";
    }

    if (type === "Emergency") {
        return "Urgent";
    }

    return "Normal";
}

function normalizeMechanicStatus(value) {
    const normalized = String(value ?? "").trim().toLowerCase();

    if (normalized.includes("off")) {
        return "Off Duty";
    }

    if (normalized.includes("busy")) {
        return "Busy";
    }

    return "Available";
}

function normalizeWorkOrder(rawOrder) {
    const type = normalizeType(
        rawOrder.type ?? rawOrder.orderType ?? rawOrder.category,
    );

    return {
        id: rawOrder.id ?? rawOrder.workOrderId ?? rawOrder.work_order_id ?? "WO-0000",
        vehicle:
            rawOrder.vehicle ??
            rawOrder.vehiclePlate ??
            rawOrder.plate ??
            rawOrder.vehicleId ??
            rawOrder.vehicle_id ??
            "Unknown Vehicle",
        date: formatDateLabel(
            rawOrder.date ??
                rawOrder.opened ??
                rawOrder.createdAt ??
                rawOrder.created_at ??
                rawOrder.scheduledDate,
        ),
        type,
        priority: normalizePriority(rawOrder.priority, type),
        description:
            rawOrder.description ??
            rawOrder.summary ??
            rawOrder.notes ??
            "No description provided.",
    };
}

function normalizeMechanic(rawMechanic, index = 0) {
    const fallbackId = `MC-${String(index + 1).padStart(3, "0")}`;
    const name =
        rawMechanic.name ??
        rawMechanic.fullName ??
        rawMechanic.full_name ??
        "Unknown Mechanic";
    const activeJobsValue =
        rawMechanic.activeJobs ??
        rawMechanic.currentJobs ??
        rawMechanic.jobCount ??
        rawMechanic.active_jobs ??
        0;

    return {
        id:
            rawMechanic.id ??
            rawMechanic.mechanicId ??
            rawMechanic.mechanic_id ??
            rawMechanic.code ??
            fallbackId,
        name,
        initials: rawMechanic.initials ?? getInitials(name),
        specialty:
            rawMechanic.specialty ??
            rawMechanic.skill ??
            rawMechanic.department ??
            "General",
        activeJobs: Number.isFinite(Number(activeJobsValue))
            ? Number(activeJobsValue)
            : 0,
        status: normalizeMechanicStatus(
            rawMechanic.status ??
                rawMechanic.availability ??
                rawMechanic.rosterStatus ??
                rawMechanic.shiftStatus,
        ),
    };
}

function isUnassignedOrder(order) {
    const mechanicName =
        typeof order.mechanic === "string" ? order.mechanic : order.mechanic?.name;

    return (
        String(order.status ?? "").toLowerCase() === "open" &&
        (!mechanicName || mechanicName === "Unassigned")
    );
}

async function getUnassignedWorkOrders() {
    try {
        const apiClient = await getApiClient();

        if (!apiClient) {
            throw new Error("API handler unavailable.");
        }

        const response = await apiClient.get("/work-orders/unassigned");
        const items = Array.isArray(response.data)
            ? response.data
            : response.data?.items ?? [];

        return items.map(normalizeWorkOrder);
    } catch (error) {
        return WorkOrdersApi.getAllOrders()
            .filter(isUnassignedOrder)
            .map(normalizeWorkOrder);
    }
}

async function getMechanicRoster() {
    try {
        const apiClient = await getApiClient();

        if (!apiClient) {
            throw new Error("API handler unavailable.");
        }

        const response = await apiClient.get("/mechanics/roster");
        const items = Array.isArray(response.data)
            ? response.data
            : response.data?.items ?? [];

        return items.map(normalizeMechanic);
    } catch (error) {
        return [
            normalizeMechanic({ name: "Karim Hassan", id: "MC-007", initials: "KH", specialty: "Engine", status: "Busy", activeJobs: 1 }),
            normalizeMechanic({ name: "Omar Yusuf", id: "MC-012", initials: "OY", specialty: "Electrical", status: "Busy", activeJobs: 2 }),
            normalizeMechanic({ name: "Ahmed Saleh", id: "MC-019", initials: "AS", specialty: "General", status: "Available", activeJobs: 0 }),
            normalizeMechanic({ name: "Sara Ahmed", id: "MC-023", initials: "SA", specialty: "Brakes & Suspension", status: "Off Duty", activeJobs: 0 })
        ];
    }
}

async function assignWorkOrder(workOrderId, mechanicId) {
    const payload = { workOrderId, mechanicId };
    let lastError = null;
    const apiClient = await getApiClient();

    if (apiClient) {
        for (const endpoint of ASSIGNMENT_ENDPOINTS) {
            try {
                const response = await apiClient.post(endpoint, payload);
                return response.data;
            } catch (error) {
                lastError = error;

                if (error?.status && ![404, 405].includes(error.status)) {
                    throw error;
                }
            }
        }
    }

    const mechanic = (await getMechanicRoster()).find((item) => item.id === mechanicId);

    if (mechanic) {
        if (mechanic.status === "Off Duty") {
            throw new Error("Cannot assign to an off-duty mechanic.");
        }
        WorkOrdersApi.updateOrderMechanic(workOrderId, mechanic.name);
        return { ok: true, fallback: true };
    }

    throw lastError ?? new Error("Unable to save assignment.");
}

const TechnicianAssignmentApi = {
    getUnassignedWorkOrders,
    getMechanicRoster,
    assignWorkOrder,
};

export default TechnicianAssignmentApi;
