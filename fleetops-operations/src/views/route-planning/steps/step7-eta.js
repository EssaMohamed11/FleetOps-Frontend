/**
 * Step 7: ETA Estimator
 */

import { routePlanningState } from "../utils/state-manager.js";
import { createElement } from "../utils/helpers.js";

export function renderStep7(container) {
    const state = routePlanningState.getState();
    const activeCluster = state.clusters[state.activeClusterIndex];
    const rc = state.routeConfigs[activeCluster.zone];
    const durationSeconds = Number(rc?.estimatedDurationS);
    const distanceMeters = Number(rc?.estimatedDistanceM);
    const hasApiEstimates =
        Number.isFinite(durationSeconds) || Number.isFinite(distanceMeters);
    const fallbackDurationMinutes = Math.max(
        (rc.optimizedStops.length || 0) * 18,
        0,
    );
    const fallbackDistanceKm = Math.round(
        (rc.optimizedStops.length || 0) * 4.2,
    );

    const durationLabel = Number.isFinite(durationSeconds)
        ? `${Math.floor(durationSeconds / 3600)}h ${Math.round((durationSeconds % 3600) / 60)}min`
        : `${Math.floor(fallbackDurationMinutes / 60)}h ${fallbackDurationMinutes % 60}min`;
    const distanceLabel = Number.isFinite(distanceMeters)
        ? `${Math.round(distanceMeters / 1000)} km`
        : `${fallbackDistanceKm} km`;

    container.innerHTML = `
        <div id="cluster-tabs-7"></div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
            <h4 style="margin: 0;">Stop Time ETA — <span style="color: var(--color-primary);">${activeCluster.zone}</span></h4>
            <span class="rp-badge" style="background: #ebfdf5; color: #0f4f49;">${hasApiEstimates ? "API CALCULATED" : "CALCULATED"}</span>
        </div>
        <div style="position: relative; padding-left: 40px; max-height: 450px; overflow-y: auto;">
            <div style="position: absolute; left: 18px; top: 0; bottom: 0; width: 1px; background: var(--color-border);"></div>
            <div id="timeline-stops"></div>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 16px; background: var(--color-surface-low); border-radius: var(--radius-lg); margin-top: 20px; font-size: 0.875rem;">
            <span>Duration: <b>${durationLabel}</b></span>
            <span>Distance: <b>${distanceLabel}</b></span>
            <span>Stops: <b>${rc.optimizedStops.length}</b></span>
        </div>
    `;

    setTimeout(() => {
        renderClusterTabs();
        renderTimeline(rc.optimizedStops, activeCluster.color);
    }, 0);
}

function renderClusterTabs() {
    const state = routePlanningState.getState();
    const container = document.getElementById("cluster-tabs-7");
    if (!container) return;

    container.innerHTML = `
        <p style="font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); font-weight: 600; margin: 0 0 8px 0;">
            SELECT ROUTE (CLUSTER)
        </p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;" id="tabs-container-7"></div>
    `;

    const tabsContainer = document.getElementById("tabs-container-7");
    state.clusters.forEach((cluster, index) => {
        const isActive = state.activeClusterIndex === index;
        const btn = createElement("button", {
            classes: "button",
            html: `
                <div style="width: 10px; height: 10px; border-radius: 50%; background: ${cluster.color};"></div>
                <span style="font-weight: 600;">${cluster.zone}</span>
                <span style="color: var(--color-text-muted);">(${cluster.orders.length})</span>
            `,
        });

        btn.style.cssText = isActive
            ? "border: 2px solid var(--color-primary); background: rgba(61, 166, 154, 0.05);"
            : "border: 2px solid var(--color-border); background: var(--color-surface);";

        btn.addEventListener("click", () => {
            routePlanningState.setState({ activeClusterIndex: index });
        });

        tabsContainer.appendChild(btn);
    });
}

function renderTimeline(stops, color) {
    const container = document.getElementById("timeline-stops");
    if (!container) return;
    // Clear existing timeline entries to avoid duplicate nodes
    container.innerHTML = "";

    try {
        console.log(
            "[renderTimeline] stops:",
            stops.length,
            stops.map((s) => ({ num: s.num, orderId: s.orderId })),
        );
    } catch (e) {}

    stops.forEach((stop) => {
        const card = createElement("div", {
            html: `
                <div style="position: relative; padding-bottom: 16px;">
                    <div style="position: absolute; left: -26px; top: 8px; width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--color-surface); background: ${stop.withinWindow ? color : "#f59e0b"}; display: flex; align-items: center; justify-content: center; font-size: 0.5rem; color: white; font-weight: 700;">
                        ${stop.num}
                    </div>
                    <div style="padding: 16px; border: 1px solid ${stop.withinWindow ? "var(--color-border)" : "#fcd34d"}; background: ${stop.withinWindow ? "var(--color-surface)" : "rgba(252, 211, 77, 0.05)"}; border-radius: 12px; margin-left: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <p style="margin: 0 0 4px 0; font-size: 0.875rem; font-weight: 600;">
                                    Stop ${stop.num} — ${stop.customer}
                                </p>
                                <p style="margin: 0; font-size: 0.75rem; color: var(--color-text-muted);">
                                    ${stop.address}
                                </p>
                            </div>
                            <div style="text-align: right;">
                                <p style="margin: 0 0 4px 0; font-size: 0.875rem; font-weight: 700;">
                                    ${stop.eta}
                                </p>
                                <span style="font-size: 0.625rem; padding: 2px 8px; border-radius: 999px; background: ${stop.withinWindow ? "#ebfdf5" : "#fef3c7"}; color: ${stop.withinWindow ? "#0f4f49" : "#92400e"}; font-weight: 600;">
                                    ${stop.withinWindow ? "Within window" : "Exceeds window"}
                                </span>
                            </div>
                        </div>
                        ${stop.travel !== "—" ? `<p style="margin: 8px 0 0 0; font-size: 0.625rem; color: var(--color-text-muted);">Travel: ${stop.travel}</p>` : ""}
                    </div>
                </div>
            `,
        });
        container.appendChild(card);
    });
}
