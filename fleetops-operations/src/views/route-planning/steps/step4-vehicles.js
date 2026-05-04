/**
 * Step 4: Assign Vehicles
 */

import { routePlanningState } from "../utils/state-manager.js";
import {
    createElement,
    calculateTotalWeight,
    calculateTotalVolume,
} from "../utils/helpers.js";

function clearStepCompletionFrom(state, startStep) {
    const next = { ...state.stepComplete };
    for (let step = startStep; step <= 9; step += 1) {
        delete next[step];
    }
    return next;
}

export function renderStep4(container) {
    const state = routePlanningState.getState();
    const activeCluster = state.clusters[state.activeClusterIndex];

    if (!activeCluster) {
        container.innerHTML =
            '<p style="text-align: center; padding: 64px 20px; color: var(--color-text-muted);">No clusters created. Go back to Step 3.</p>';
        return;
    }

    const wrapper = createElement("div", { classes: "step-4-container" });

    // Render cluster tabs
    renderClusterTabs(wrapper);

    // Render header
    const header = createElement("div", {
        classes: "rp-step4-header",
        html: `
            <h4 style="margin: 0 0 4px 0;">Assign Vehicle → <span style="color: var(--color-primary);">${activeCluster.zone}</span></h4>
            <p class="rp-step4-subtitle" style="margin: 0;">
                Cluster load: ${Math.round(calculateTotalWeight(activeCluster.orders))} kg / ${Math.round(calculateTotalVolume(activeCluster.orders) * 10) / 10} m³ · ${activeCluster.orders.length} orders
            </p>
        `,
    });
    wrapper.appendChild(header);

    // Render vehicles
    renderVehicles(wrapper, activeCluster);

    container.appendChild(wrapper);
}

function renderClusterTabs(container) {
    const state = routePlanningState.getState();

    const tabs = createElement("div", {
        classes: "rp-step4-tabs",
        html: `
            <p style="font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); font-weight: 600; margin: 0 0 8px 0;">
                SELECT ROUTE (CLUSTER)
            </p>
            <div class="rp-step4-tabs-list" id="cluster-tabs"></div>
        `,
    });
    container.appendChild(tabs);

    setTimeout(() => {
        const tabsContainer = document.getElementById("cluster-tabs");
        if (tabsContainer) {
            // Clear existing tabs
            tabsContainer.innerHTML = "";

            state.clusters.forEach((cluster, index) => {
                const rc = state.routeConfigs[cluster.zone] || {};
                const isActive = state.activeClusterIndex === index;

                const tab = createElement("button", {
                    classes: ["rp-step4-tab", isActive ? "is-active" : ""],
                    attrs: { type: "button" },
                    html: `
                        <span class="rp-step4-tab-dot" style="background: ${cluster.color};"></span>
                        <span class="rp-step4-tab-zone">${cluster.zone}</span>
                        <span class="rp-step4-tab-count">(${cluster.orders.length})</span>
                        ${rc.vehicle ? `<span class="rp-step4-tab-vehicle">${rc.vehicle}</span>` : ""}
                    `,
                });

                tab.addEventListener("click", () => {
                    routePlanningState.setState({ activeClusterIndex: index });
                });

                tabsContainer.appendChild(tab);
            });
        }
    }, 0);
}

function renderVehicles(container, activeCluster) {
    const state = routePlanningState.getState();
    const vehicles = state.vehicles || [];
    const rc = state.routeConfigs[activeCluster.zone] || {};
    const totalWeight = calculateTotalWeight(activeCluster.orders);
    const totalVolume = calculateTotalVolume(activeCluster.orders);

    const usedVehicles = new Set(
        state.clusters
            .filter((_, i) => i !== state.activeClusterIndex)
            .map((c) => state.routeConfigs[c.zone]?.vehicle)
            .filter(Boolean),
    );

    const vehiclesContainer = createElement("div", {
        classes: "rp-step4-vehicles",
        html: '<div class="rp-step4-vehicles-list" id="vehicles-list"></div>',
    });
    container.appendChild(vehiclesContainer);

    setTimeout(() => {
        const list = document.getElementById("vehicles-list");
        if (list) {
            // Clear existing vehicles
            list.innerHTML = "";

            vehicles.forEach((vehicle) => {
                const weightPct = Math.round(
                    (totalWeight / vehicle.maxWeight) * 100,
                );
                const volPct = Math.round(
                    (totalVolume / vehicle.maxVolume) * 100,
                );
                const fits = weightPct <= 100 && volPct <= 100;
                const usedByOther = usedVehicles.has(vehicle.plate);

                const card = createElement("label", {
                    classes: [
                        "rp-step4-vehicle-card",
                        rc.vehicle === vehicle.plate ? "is-selected" : "",
                        usedByOther ? "is-disabled" : "",
                        !fits ? "is-over-capacity" : "",
                    ],
                    html: `
                        <input class="rp-step4-vehicle-radio" type="radio" name="vehicle" value="${vehicle.plate}" ${rc.vehicle === vehicle.plate ? "checked" : ""} ${usedByOther ? "disabled" : ""}>
                        <div class="rp-step4-vehicle-icon">
                            <i data-lucide="truck"></i>
                        </div>
                        <div class="rp-step4-vehicle-content">
                            <div class="rp-step4-vehicle-top">
                                <span class="rp-step4-vehicle-plate">${vehicle.plate}</span>
                                <span class="rp-step4-vehicle-type">${vehicle.type}</span>
                                ${usedByOther ? '<span class="rp-step4-vehicle-assigned">Assigned to another route</span>' : ""}
                            </div>
                            <div class="rp-step4-meters">
                                <div class="rp-step4-meter">
                                    <div class="rp-step4-meter-head">
                                        <span>Weight</span>
                                        <span>${Math.min(weightPct, 100)}%</span>
                                    </div>
                                    <div class="rp-step4-meter-track">
                                        <div class="rp-step4-meter-fill" style="width: ${Math.min(weightPct, 100)}%; background: ${weightPct > 100 ? "#ef4444" : weightPct > 80 ? "#f59e0b" : "#10b981"};"></div>
                                    </div>
                                </div>
                                <div class="rp-step4-meter">
                                    <div class="rp-step4-meter-head">
                                        <span>Volume</span>
                                        <span>${Math.min(volPct, 100)}%</span>
                                    </div>
                                    <div class="rp-step4-meter-track">
                                        <div class="rp-step4-meter-fill" style="width: ${Math.min(volPct, 100)}%; background: ${volPct > 100 ? "#ef4444" : volPct > 80 ? "#f59e0b" : "#10b981"};"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `,
                });

                const radio = card.querySelector('input[type="radio"]');
                radio.addEventListener("change", () => {
                    const newConfigs = { ...state.routeConfigs };
                    newConfigs[activeCluster.zone] = {
                        ...newConfigs[activeCluster.zone],
                        vehicle: vehicle.plate,
                        capacityResult: null,
                        optimizedStops: [],
                    };

                    routePlanningState.setState({
                        routeConfigs: newConfigs,
                        stepComplete: clearStepCompletionFrom(state, 5),
                    });
                });

                list.appendChild(card);
            });
        }
    }, 0);
}
