import api from "/shared/api-handler.js";
import { CTV_THRESHOLDS, ctvMockVehicles } from "../storage/cost-to-value.js";

// api is available for future real backend calls.
void api;

function enrichVehicle(v) {
    const ratio = v.marketValueEgp > 0
        ? (v.totalRepairCostEgp / v.marketValueEgp) * 100
        : 0;

    let riskLevel;
    if (ratio >= CTV_THRESHOLDS.monitor) {
        riskLevel = "Retire";
    } else if (ratio >= CTV_THRESHOLDS.safe) {
        riskLevel = "Monitor";
    } else {
        riskLevel = "Safe";
    }

    return { ...v, ctvRatio: parseFloat(ratio.toFixed(1)), riskLevel };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAllVehicles() {
    return ctvMockVehicles.map(enrichVehicle).sort((a, b) => b.ctvRatio - a.ctvRatio);
}

export function getVehicleByPlate(plate) {
    const vehicle = ctvMockVehicles.find((v) => v.plate === plate);
    return vehicle ? enrichVehicle(vehicle) : null;
}

export function getThresholds() {
    return { ...CTV_THRESHOLDS };
}

const CostToValueApi = {
    getAllVehicles,
    getVehicleByPlate,
    getThresholds,
};

export default CostToValueApi;
