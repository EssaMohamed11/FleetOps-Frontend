const AUDIT_STORAGE_KEY = 'fleetops_audit';
const initialAuditMockData = [];

const initialMockData = [
    {
        id: "LOG-2026-88",
        userId: "ADM-001",
        entity: "UserRole",
        action: "Updated",
        timestamp: "2026-04-12T11:40:00Z",
        details: "Activated DSP-104 and assigned Dispatcher role",
        oldValue: { role: "None", isActive: false },
        newValue: { role: "Dispatcher", isActive: true }
    },
    {
        id: "LOG-2026-89",
        userId: "MGR-099",
        entity: "Vehicle",
        action: "Created",
        timestamp: "2026-04-13T09:15:00Z",
        details: "Added new vehicle VH-101",
        oldValue: null,
        newValue: { model: "Ford Transit", year: 2024, status: "Active" }
    },
    {
        id: "LOG-2026-90",
        userId: "DSP-104",
        entity: "Route",
        action: "Deleted",
        timestamp: "2026-04-14T14:30:00Z",
        details: "Removed outdated route RT-505",
        oldValue: { routeId: "RT-505", status: "Inactive" },
        newValue: null
    },
    {
        id: "LOG-2026-91",
        userId: "ADM-001",
        entity: "SystemPolicy",
        action: "Updated",
        timestamp: "2026-04-15T08:20:00Z",
        details: "Updated password complexity requirements",
        oldValue: { minLength: 8, requireSpecialChar: false },
        newValue: { minLength: 12, requireSpecialChar: true }
    },
    {
        id: "LOG-2026-92",
        userId: "MEC-002",
        entity: "MaintenanceTask",
        action: "Updated",
        timestamp: "2026-04-16T10:05:00Z",
        details: "Completed oil change for VH-042",
        oldValue: { status: "Pending" },
        newValue: { status: "Completed" }
    },
    {
        id: "LOG-2026-93",
        userId: "DSP-104",
        entity: "Order",
        action: "Created",
        timestamp: "2026-04-16T11:20:00Z",
        details: "Created bulk order import ORD-9092",
        oldValue: null,
        newValue: { orderId: "ORD-9092", items: 450, priority: "High" }
    }
];

// Fallback for older synchronous calls
let auditMockData = [...initialMockData];
export { auditMockData };

const delay = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch all audit logs
 */
async function getAuditLogs() {
    await delay();
    const stored = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!stored) {
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(initialMockData));
        auditMockData = JSON.parse(JSON.stringify(initialMockData));
        return auditMockData;
    }
    auditMockData = JSON.parse(stored);
    return auditMockData;
}
export { AUDIT_STORAGE_KEY, initialAuditMockData, getAuditLogs };