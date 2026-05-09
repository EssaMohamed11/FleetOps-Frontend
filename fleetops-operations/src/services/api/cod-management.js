import api from "/shared/api-handler.js";
import {
    COD_COLLECTION_FILTERS,
    COD_HANDOVER_FILTERS,
} from "../storage/cod-management.js";

const API_BASE = "http://localhost:8000/api/v1";

async function getRecords() {
    try {
        const response = await api.get(`${API_BASE}/cod`);
        return response.data?.data || [];
    } catch (error) {
        console.error("Failed to fetch COD records:", error);
        return [];
    }
}

async function getRecordById(recordId) {
    try {
        const response = await api.get(`${API_BASE}/cod/${recordId}`);
        return response.data?.data || null;
    } catch (error) {
        console.error(`Failed to fetch COD record ${recordId}:`, error);
        return null;
    }
}

function getCollectionFilters() {
    return [...COD_COLLECTION_FILTERS];
}

function getHandoverFilters() {
    return [...COD_HANDOVER_FILTERS];
}

async function markHandedOver(recordId) {
    try {
        const response = await api.patch(`${API_BASE}/cod/${recordId}/handover`);
        return response.data?.data || null;
    } catch (error) {
        console.error(`Failed to mark handover for ${recordId}:`, error);
        return null;
    }
}

const CodManagementApi = {
    getCollectionFilters,
    getHandoverFilters,
    getRecordById,
    getRecords,
    markHandedOver,
};

export default CodManagementApi;
