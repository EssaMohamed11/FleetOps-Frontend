/**
 * Step 8: Assign Drivers
 */

import { routePlanningState } from "../utils/state-manager.js";
import { createElement } from "../utils/helpers.js";

function clearStepCompletionFrom(state, startStep) {
    const next = { ...state.stepComplete };
    for (let step = startStep; step <= 9; step += 1) {
        delete next[step];
    }
    return next;
}

export function renderStep8(container) {
    const state = routePlanningState.getState();
    const vehicles = state.vehicles || [];
    const activeCluster = state.clusters[state.activeClusterIndex];
    if (!activeCluster) {
        container.innerHTML =
            '<p style="text-align: center; padding: 64px 20px; color: var(--color-text-muted);">No clusters created. Go back to Step 3.</p>';
        return;
    }

    const rc = state.routeConfigs[activeCluster.zone];
    const vehicle = vehicles.find((v) => v.plate === rc.vehicle) || vehicles[0];

    container.innerHTML = `
        <div class="rp-step8-tabs" id="cluster-tabs-8"></div>
        <div class="rp-step8-header">
            <h4 style="margin: 0 0 4px 0;">Assign Driver → <span style="color: var(--color-primary);">${activeCluster.zone}</span></h4>
            <p class="rp-step8-subtitle" style="margin: 0;">
                Vehicle: ${rc.vehicle || "—"} (${vehicle.type})
            </p>
        </div>
        <div class="rp-step8-drivers" id="drivers-list"></div>
    `;

    setTimeout(() => {
        renderClusterTabs();
        renderDrivers(activeCluster, rc, vehicle);
    }, 0);
}

function renderClusterTabs() {
    const state = routePlanningState.getState();
    const container = document.getElementById("cluster-tabs-8");
    if (!container) return;

    container.innerHTML = `
        <p style="font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); font-weight: 600; margin: 0 0 8px 0;">
            SELECT ROUTE (CLUSTER)
        </p>
        <div class="rp-step4-tabs-list" id="tabs-container-8"></div>
    `;

    const tabsContainer = document.getElementById("tabs-container-8");
    state.clusters.forEach((cluster, index) => {
        const isActive = state.activeClusterIndex === index;
        const btn = createElement("button", {
            classes: ["rp-step4-tab", isActive ? "is-active" : ""],
            html: `
                <span class="rp-step4-tab-dot" style="background: ${cluster.color};"></span>
                <span class="rp-step4-tab-zone">${cluster.zone}</span>
                <span class="rp-step4-tab-count">(${cluster.orders.length})</span>
            `,
        });

        btn.addEventListener("click", () => {
            routePlanningState.setState({ activeClusterIndex: index });
        });

        tabsContainer.appendChild(btn);
    });
}

function renderDrivers(activeCluster, rc, vehicle) {
    const state = routePlanningState.getState();
    const drivers = state.drivers || [];
    const container = document.getElementById("drivers-list");
    if (!container) return;
    // Clear existing drivers list to avoid duplicate DOM nodes
    container.innerHTML = "";

    try {
        console.log(
            "[renderDrivers] zone:",
            activeCluster.zone,
            "drivers:",
            drivers.length,
        );
    } catch (e) {}

    const usedDrivers = new Set(
        state.clusters
            .filter((_, i) => i !== state.activeClusterIndex)
            .map((c) => state.routeConfigs[c.zone]?.driver)
            .filter(Boolean),
    );

    drivers.forEach((driver) => {
        function isLicenseCompatible(vehicleTypeRaw, driverLicenseRaw) {
            const vt = (vehicleTypeRaw || "").toLowerCase();
            const dl = (driverLicenseRaw || "").toLowerCase();
            const map = {
                light: ["light"],
                heavy: ["heavy"],
                refrigerated: ["refrigerated"],
            };
            const allowed = map[vt];
            if (!allowed) return true;
            return allowed.includes(dl);
        }

        const licenseMismatch = !isLicenseCompatible(
            vehicle.type,
            driver.license,
        );
        const usedByOther = usedDrivers.has(driver.name);

        const card = createElement("label", {
            classes: [
                "rp-step8-driver-card",
                rc.driver === driver.name ? "is-selected" : "",
                licenseMismatch || usedByOther ? "is-disabled" : "",
            ],
            html: `
                <input class="rp-step8-driver-radio" type="radio" name="driver" value="${driver.name}" ${rc.driver === driver.name ? "checked" : ""} ${licenseMismatch || usedByOther ? "disabled" : ""}>
                <div class="rp-step8-driver-avatar">
                    <i data-lucide="user"></i>
                </div>
                <div class="rp-step8-driver-content">
                    <div class="rp-step8-driver-top">
                        <span class="rp-step8-driver-name">${driver.name}</span>
                        ${licenseMismatch ? '<span class="rp-step8-driver-badge mismatch">LICENSE MISMATCH</span>' : ""}
                        ${usedByOther ? '<span class="rp-step8-driver-badge assigned">Assigned to another route</span>' : ""}
                    </div>
                    <p class="rp-step8-driver-meta">
                        License: ${driver.license} · Score: ${driver.score}/100
                    </p>
                </div>
                <span class="rp-step8-driver-status ${driver.status === "Available" ? "available" : "other"}">
                    ${driver.status}
                </span>
            `,
        });

        const radio = card.querySelector('input[type="radio"]');

        card.addEventListener("click", (ev) => {
            if (licenseMismatch || usedByOther) {
                ev.preventDefault();
                ev.stopPropagation();
            }
        });

        radio.addEventListener("change", () => {
            const newConfigs = { ...state.routeConfigs };
            newConfigs[activeCluster.zone] = {
                ...newConfigs[activeCluster.zone],
                driver: driver.name,
            };
            routePlanningState.setState({
                routeConfigs: newConfigs,
                stepComplete: clearStepCompletionFrom(state, 9),
            });
        });

        container.appendChild(card);
    });
}
