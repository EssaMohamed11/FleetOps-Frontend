import api from "/shared/api-handler.js";
import {
    IMPORT_NOTE,
    ORDER_PAYMENT_OPTIONS,
    ORDER_PRIORITY_OPTIONS,
    ORDER_STATUS_OPTIONS,
} from "../storage/orders.js";

const API_BASE = "http://localhost:8000/api/v1";

async function getOrders() {
    try {
        const response = await api.get(`${API_BASE}/orders?per_page=100`);
        const dbOrders = response.data?.data?.data || [];
        return dbOrders.map(mapBackendOrderToFrontend);
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return [];
    }
}

async function getOrderById(orderId) {
    try {
        const id = orderId.replace("ORD-", "");
        const response = await api.get(`${API_BASE}/orders/${id}`);
        if (response.data && response.data.success && response.data.data) {
            return mapBackendOrderToFrontend(response.data.data);
        }
        return null;
    } catch (error) {
        console.error(`Failed to fetch order ${orderId}:`, error);
        return null;
    }
}

function getStatusOptions() {
    return [...ORDER_STATUS_OPTIONS];
}

function getPriorityOptions() {
    return [...ORDER_PRIORITY_OPTIONS];
}

function getPaymentOptions() {
    return [...ORDER_PAYMENT_OPTIONS];
}

function getImportNote() {
    return IMPORT_NOTE;
}

async function createOrder(payload) {
    try {
        const backendPayload = {
            CustomerID: 12, // Mock customer ID
            DriverID: null,
            vehicle_id: null,
            Weight: Number(payload.weightKg) || 0,
            Volume: Number(payload.volumeM3) || 0,
            Priority: ORDER_PRIORITY_OPTIONS.includes(payload.priority) ? payload.priority : "Normal",
            Payment_method: ORDER_PAYMENT_OPTIONS.includes(payload.paymentType) ? payload.paymentType : "Prepaid",
            DeliveryTimeWindow: payload.paymentWindow?.trim() || "09:00-12:00",
            Area: payload.address?.trim() || "Cairo",
            Status: "Pending"
        };
        const response = await api.post(`${API_BASE}/orders`, backendPayload);
        if (response.data && response.data.success) {
            return mapBackendOrderToFrontend(response.data.data);
        }
        return null;
    } catch (error) {
        console.error("Failed to create order:", error);
        return null;
    }
}

async function importOrders(file) {
    try {
        const formData = new FormData();
        const extension = file.name.split('.').pop().toLowerCase();
        const formatMap = { 'csv': 'csv', 'xml': 'xml' };
        
        formData.append("file", file);
        formData.append("format", formatMap[extension] || "csv");

        const response = await api.post(`${API_BASE}/orders/import`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        if (response.data && response.data.success) {
            return response.data.data;
        }
        throw new Error(response.data?.message || "Import failed");
    } catch (error) {
        console.error("Failed to import orders:", error);
        throw error;
    }
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function mapBackendOrderToFrontend(dbOrder) {
    const createdAt = dbOrder.Created_at || dbOrder.created_at;
    const dateStr = createdAt ? new Date(createdAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) : "Unknown Date";
    
    // We map backend priority values (e.g. integer 64 to strings) if needed, but if it's already a string, keep it.
    let priorityStr = "Normal";
    if (typeof dbOrder.Priority === 'string') {
        priorityStr = dbOrder.Priority;
    } else if (dbOrder.Priority > 50) {
        priorityStr = "High";
    }

    return {
        id: `ORD-${dbOrder.OrderID || dbOrder.id}`,
        customerName: dbOrder.customer?.user?.name || "Unknown Customer",
        customerPhone: dbOrder.customer?.phone || "+20 000 000 0000",
        customerEmail: dbOrder.customer?.user?.email || "customer@fleetops.eg",
        address: dbOrder.Area || dbOrder.DeliveryAddress || "Cairo",
        weightKg: Number(dbOrder.Weight) || 0,
        volumeM3: Number(dbOrder.Volume) || 0,
        paymentType: dbOrder.Payment_method || "Prepaid",
        paymentWindow: dbOrder.DeliveryTimeWindow || "09:00-12:00",
        priority: priorityStr,
        status: dbOrder.Status || "Pending",
        trackingLink: dbOrder.LiveTrackingLink || `https://track.fleetops.eg/${dbOrder.OrderID}`,
        driver: dbOrder.driver ? {
            name: dbOrder.driver.user?.name || "Unknown",
            initials: (dbOrder.driver.user?.name || "U").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase(),
            code: dbOrder.driver.DriverLicenseNumber || `--`
        } : null,
        vehicleId: dbOrder.vehicle?.VehicleLicense || null,
        createdAt: dateStr,
        liveTrackingMessage: "Order tracking activated.",
        liveTrackingHint: "Customer can view status changes.",
        notificationsSummary: { sent: 1, total: 1, failed: 0 },
        notifications: [
            {
                channel: "System",
                icon: "bell",
                sentAt: dateStr,
                content: `Order imported into system`,
                status: "Sent",
            }
        ],
        timeline: [
            {
                title: "Order Created",
                description: "Order added to the system.",
                at: dateStr,
                notified: false,
            },
        ],
    };
}

const OrdersApi = {
    createOrder,
    getImportNote,
    getOrderById,
    getOrders,
    getPaymentOptions,
    getPriorityOptions,
    getStatusOptions,
    importOrders,
};

export default OrdersApi;
