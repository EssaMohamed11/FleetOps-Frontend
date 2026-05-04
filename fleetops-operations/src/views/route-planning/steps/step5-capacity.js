/**
 * Step 5: Capacity Check
 */

import RoutePlanningAPI from "../../../services/api/route-planning.js";
import { routePlanningState } from "../utils/state-manager.js";
import { createElement } from "../utils/helpers.js";

export async function renderStep5(container) {
    const state = routePlanningState.getState();

    const wrapper = createElement("div", { classes: "step-5-container" });

    // Auto-check if not done yet
    if (!state.stepComplete[5] && !state.isProcessing) {
        renderLoading(wrapper);
        container.appendChild(wrapper);
        // Run check after render to avoid infinite loop
        setTimeout(() => autoCheckCapacity(), 0);
        return;
    }

    if (state.isProcessing) {
        renderLoading(wrapper);
    } else {
        renderCapacityResults(wrapper);
    }

    container.appendChild(wrapper);
}

let capacityRenderToken = 0;

async function autoCheckCapacity() {
    routePlanningState.setState({ isProcessing: true });

    const state = routePlanningState.getState();
    const vehicles = state.vehicles || [];
    const newConfigs = { ...state.routeConfigs };

    for (const cluster of state.clusters) {
        const rc = newConfigs[cluster.zone];
        const vehicle =
            vehicles.find((v) => v.plate === rc.vehicle) || vehicles[0];
        const result = await RoutePlanningAPI.checkVehicleCapacity(
            vehicle,
            cluster.orders,
            { zone: cluster.zone, color: cluster.color },
        );

        newConfigs[cluster.zone] = {
            ...rc,
            capacityResult: result,
        };
    }

    routePlanningState.setState({
        routeConfigs: newConfigs,
        isProcessing: false,
        stepComplete: { ...state.stepComplete, 5: true },
    });
}

function renderLoading(container) {
    container.innerHTML = `
        <div class="rp-loading">
            <div class="rp-loading__spinner"></div>
            <div class="rp-loading__text">
                <p class="rp-loading__title">Checking Load Capacity...</p>
                <p class="rp-loading__subtitle">Validating all routes</p>
            </div>
        </div>
    `;
}

function renderCapacityResults(container) {
    const token = ++capacityRenderToken;
    const state = routePlanningState.getState();
    const vehicles = state.vehicles || [];

    container.innerHTML = `
        <h4 style="margin: 0 0 4px 0;">Load Capacity Validation — All Routes</h4>
        <p style="font-size: 0.75rem; color: var(--color-text-muted); margin: 0 0 20px 0;">
            Each cluster's load checked against its assigned vehicle
        </p>
        <div id="capacity-results" style="display: flex; flex-direction: column; gap: 12px; overflow-y: auto; "></div>
    `;

    setTimeout(() => {
        if (token !== capacityRenderToken) {
            return;
        }

        const resultsContainer = document.getElementById("capacity-results");
        if (resultsContainer) {
            resultsContainer.innerHTML = "";
            state.clusters.forEach((cluster, index) => {
                const rc = state.routeConfigs[cluster.zone];
                const result = rc.capacityResult;

                if (!result) return;

                const card = createElement("div", {
                    html: `
                        <div style="padding: 16px; border: 2px solid ${result.ok ? "#d1fae5" : "#fecaca"}; background: ${result.ok ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)"}; border-radius: var(--radius-lg);">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${cluster.color};"></div>
                                <span style="font-size: 0.875rem; font-weight: 600;">${cluster.zone}</span>
                                <span style="font-size: 0.625rem; color: var(--color-text-muted);">→ ${rc.vehicle || "No vehicle"}</span>
                                <span style="font-size: 0.625rem; color: var(--color-text-muted);">${cluster.orders.length} orders</span>
                                <span style="margin-left: auto; font-size: 0.625rem; padding: 4px 10px; border-radius: 999px; font-weight: 700; background: ${result.ok ? "#d1fae5" : "#fecaca"}; color: ${result.ok ? "#065f46" : "#991b1b"};">
                                    ${result.ok ? "PASS" : "FAIL"}
                                </span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div>
                                    <div style="display: flex; justify-content: space-between; font-size: 0.625rem; color: var(--color-text-muted); margin-bottom: 4px;">
                                        <span>Weight: ${result.totalWeight} / ${vehicles.find((v) => v.plate === rc.vehicle)?.maxWeight || 0} kg</span>
                                        <span>${result.weightPct}%</span>
                                    </div>
                                    <div style="height: 8px; background: white; border-radius: 999px; overflow: hidden;">
                                        <div style="height: 100%; width: ${Math.min(result.weightPct, 100)}%; background: ${result.weightPct > 100 ? "#ef4444" : "#10b981"}; border-radius: 999px;"></div>
                                    </div>
                                </div>
                                <div>
                                    <div style="display: flex; justify-content: space-between; font-size: 0.625rem; color: var(--color-text-muted); margin-bottom: 4px;">
                                        <span>Volume: ${result.totalVolume} / ${vehicles.find((v) => v.plate === rc.vehicle)?.maxVolume || 0} m³</span>
                                        <span>${result.volPct}%</span>
                                    </div>
                                    <div style="height: 8px; background: white; border-radius: 999px; overflow: hidden;">
                                        <div style="height: 100%; width: ${Math.min(result.volPct, 100)}%; background: ${result.volPct > 100 ? "#ef4444" : "#10b981"}; border-radius: 999px;"></div>
                                    </div>
                                </div>
                            </div>
                            ${
                                !result.ok
                                    ? `
                                <p style="font-size: 0.625rem; color: #991b1b; margin: 12px 0 0 0; display: flex; align-items: center; gap: 6px;">
                                    <i data-lucide="alert-triangle" style="width: 12px; height: 12px;"></i>
                                    Over capacity — reassign vehicle or remove orders
                                    <button type="button" class="change-vehicle-btn" data-cluster-index="${index}" style="margin-left: auto; background: none; border: none; color: #991b1b; text-decoration: underline; font-size: 0.625rem; cursor: pointer;">
                                        Change Vehicle
                                    </button>
                                </p>
                            `
                                    : ""
                            }
                        </div>
                    `,
                });

                resultsContainer.appendChild(card);
            });

            // Add change vehicle handlers
            document.querySelectorAll(".change-vehicle-btn").forEach((btn) => {
                btn.addEventListener("click", (e) => {
                    const index = parseInt(e.target.dataset.clusterIndex);
                    routePlanningState.setState({
                        activeClusterIndex: index,
                        currentStep: 4,
                    });
                });
            });
        }
    }, 0);
}
