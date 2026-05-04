/**
 * Step 9: Push Routes
 */

import RoutePlanningAPI from "../../../services/api/route-planning.js";
import { routePlanningState, initialState } from "../utils/state-manager.js";
import {
    createElement,
    calculateTotalWeight,
    calculateTotalVolume,
} from "../utils/helpers.js";

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function renderStep9(container) {
    const state = routePlanningState.getState();

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <h4 style="margin: 0;">Route Summary — ${state.clusters.length} Routes Ready</h4>
        </div>
        <p style="font-size: 0.75rem; color: var(--color-text-muted); margin: 0 0 20px 0;">
            Review all routes before pushing to driver apps
        </p>
        <div id="routes-summary" style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; overflow: auto;"></div>
        <button type="button" class="button primary" id="confirm-push-btn" style="width: 100%; padding: 16px; font-size: 0.875rem; font-weight: 700;">
            <i data-lucide="check-circle"></i>
            Confirm & Push All ${state.clusters.length} Routes to Driver App
        </button>
    `;

    setTimeout(() => {
        renderRoutesSummary();

        document
            .getElementById("confirm-push-btn")
            ?.addEventListener("click", async () => {
                await pushAllRoutesToBackend();
            });
    }, 0);
}

function renderRoutesSummary() {
    const state = routePlanningState.getState();
    const container = document.getElementById("routes-summary");
    if (!container) return;
    // Clear existing summary to avoid duplicates when re-rendering
    container.innerHTML = "";

    try {
        console.log("[renderRoutesSummary] clusters:", state.clusters.length);
    } catch (e) {}

    state.clusters.forEach((cluster, index) => {
        const rc = state.routeConfigs[cluster.zone];
        const weight = calculateTotalWeight(cluster.orders);
        const volume = calculateTotalVolume(cluster.orders);
        const hasViolations =
            rc.optimizedStops?.some((s) => !s.withinWindow) || false;
        const lastEta =
            rc.optimizedStops?.length > 0
                ? rc.optimizedStops[rc.optimizedStops.length - 1].eta
                : "—";
        const estimatedDistance = Number(rc.estimatedDistanceM);
        const estimatedDuration = Number(rc.estimatedDurationS);
        const distanceLabel = Number.isFinite(estimatedDistance)
            ? `${Math.round(estimatedDistance / 1000)} km`
            : `${Math.round((rc.optimizedStops?.length || 0) * 4.2)} km`;
        const durationLabel = Number.isFinite(estimatedDuration)
            ? `${Math.floor(estimatedDuration / 3600)}h ${Math.round((estimatedDuration % 3600) / 60)}min`
            : `${Math.floor(((rc.optimizedStops?.length || 0) * 18) / 60)}h ${((rc.optimizedStops?.length || 0) * 18) % 60}min`;

        const card = createElement("div", {
            html: `
                <div style="background: var(--color-surface-low); border-radius: var(--radius-lg); padding: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="width: 16px; height: 16px; border-radius: 50%; background: ${cluster.color};"></div>
                        <span style="font-size: 0.875rem; font-weight: 700;">Route ${index + 1}: ${escapeHtml(cluster.zone)}</span>
                        <button
                            type="button"
                            data-rename-route-index="${index}"
                            class="button outlined"
                            style="padding: 4px 8px; font-size: 0.6875rem; min-height: 28px;"
                        >
                            <i data-lucide="pencil" style="width: 12px; height: 12px;"></i>
                            Rename
                        </button>
                        ${
                            hasViolations
                                ? `
                            <span style="font-size: 0.625rem; padding: 4px 10px; border-radius: 999px; background: #fef3c7; color: #92400e; display: flex; align-items: center; gap: 4px; font-weight: 600;">
                                <i data-lucide="alert-triangle" style="width: 12px; height: 12px;"></i>
                                ${rc.optimizedStops.filter((s) => !s.withinWindow).length} window violations
                            </span>
                        `
                                : ""
                        }
                        <i data-lucide="check-circle" style="width: 16px; height: 16px; color: #10b981; margin-left: auto;"></i>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                        ${[
                            { label: "Vehicle", value: rc.vehicle || "—" },
                            { label: "Driver", value: rc.driver || "—" },
                            {
                                label: "Stops",
                                value: rc.optimizedStops?.length || 0,
                            },
                            {
                                label: "Distance",
                                value: distanceLabel,
                            },
                            {
                                label: "Weight",
                                value: `${Math.round(weight)} kg`,
                            },
                            {
                                label: "Volume",
                                value: `${Math.round(volume * 10) / 10} m³`,
                            },
                            { label: "Duration", value: durationLabel },
                            { label: "Last ETA", value: lastEta },
                        ]
                            .map(
                                (field) => `
                            <div style="display: flex; justify-content: space-between; padding: 10px 12px; background: var(--color-surface); border-radius: 12px; font-size: 0.875rem;">
                                <span style="color: var(--color-text-muted); font-size: 0.75rem;">${field.label}</span>
                                <span style="font-weight: 600; font-size: 0.75rem;">${field.value}</span>
                            </div>
                        `,
                            )
                            .join("")}
                    </div>
                </div>
            `,
        });

        container.appendChild(card);
    });

    container
        .querySelectorAll("[data-rename-route-index]")
        .forEach((button) => {
            button.addEventListener("click", (event) => {
                const routeIndex = Number(
                    event.currentTarget.dataset.renameRouteIndex,
                );
                renameRouteByIndex(routeIndex);
            });
        });
}

function renameRouteByIndex(routeIndex) {
    const state = routePlanningState.getState();
    const cluster = state.clusters[routeIndex];
    if (!cluster) {
        return;
    }

    const oldZone = cluster.zone;
    const newZoneRaw = prompt("Enter new route name", oldZone);
    if (newZoneRaw === null) {
        return;
    }

    const newZone = newZoneRaw.trim();
    if (!newZone || newZone === oldZone) {
        return;
    }

    const nameExists = state.clusters.some(
        (item, idx) =>
            idx !== routeIndex &&
            String(item.zone).toLowerCase() === newZone.toLowerCase(),
    );

    if (nameExists) {
        showPopup(
            "Route name already exists. Please choose another name.",
            "error",
        );
        return;
    }

    const nextClusters = state.clusters.map((item, idx) =>
        idx === routeIndex ? { ...item, zone: newZone } : item,
    );

    const nextRouteConfigs = { ...state.routeConfigs };
    const oldConfig = nextRouteConfigs[oldZone] || {};
    delete nextRouteConfigs[oldZone];
    nextRouteConfigs[newZone] = {
        ...oldConfig,
        clusterId: newZone,
    };

    routePlanningState.setState({
        clusters: nextClusters,
        routeConfigs: nextRouteConfigs,
    });
}

async function pushAllRoutesToBackend() {
    const state = routePlanningState.getState();
    const pushButton = document.getElementById("confirm-push-btn");

    if (!state.clusters.length) {
        showPopup("No routes available to push.", "error");
        return;
    }

    if (pushButton) {
        pushButton.disabled = true;
        pushButton.innerHTML = `<i data-lucide="loader"></i> Pushing routes...`;
    }

    try {
        const payloads = buildRoutePayloads(state);
        const results = await Promise.all(
            payloads.map((payload) => RoutePlanningAPI.createRoute(payload)),
        );

        // If any route creation returned a failure (success: false), treat whole operation as failed
        const failedResults = (results || []).filter(
            (r) => !r || (typeof r.success !== "undefined" && !r.success),
        );

        if (failedResults.length > 0) {
            const errorMessages = failedResults
                .map((r) => r?.message || "Unknown error")
                .filter(Boolean)
                .join(" · ");

            // Show backend-provided message clearly and do NOT clear current data
            showPopup(errorMessages || "Failed to push some routes.", "error");
            return;
        }

        const messages = results
            .map((res) => res?.message)
            .filter(Boolean)
            .join(" · ");

        // All succeeded — show success and reset all route planning data to start over
        showPopup(
            messages || `Successfully pushed ${results.length} route(s).`,
            "success",
        );

        // Reset global state to initial and let subscribers re-render the UI
        try {
            routePlanningState.reset(initialState);
        } catch (e) {
            console.warn("Failed to reset route planning state:", e);
        }
    } catch (error) {
        // Prefer server-provided JSON message when available.
        const backendMessage =
            // request() attaches parsed body on `error.data` (fetch wrapper)
            (error &&
                error.data &&
                (error.data.message ||
                    (typeof error.data === "string" ? error.data : null))) ||
            // some wrappers use `response.data`
            (error &&
                error.response &&
                error.response.data &&
                (error.response.data.message ||
                    (typeof error.response.data === "string"
                        ? error.response.data
                        : null))) ||
            // fallback to generic error message
            error?.message ||
            "Failed to push routes to backend.";

        showPopup(backendMessage, "error");
    } finally {
        if (pushButton) {
            pushButton.disabled = false;
            pushButton.innerHTML = `
                <i data-lucide="check-circle"></i>
                Confirm & Push All ${state.clusters.length} Routes to Driver App
            `;
        }
    }
}

function buildRoutePayloads(state) {
    return state.clusters.map((cluster) => {
        const rc = state.routeConfigs[cluster.zone] || {};
        const driver = (state.drivers || []).find((d) => d.name === rc.driver);
        const vehicle = (state.vehicles || []).find(
            (v) => v.plate === rc.vehicle,
        );

        if (!driver?.id) {
            throw new Error(
                `Route "${cluster.zone}" is missing a valid driver.`,
            );
        }

        if (!vehicle?.vehicleId) {
            throw new Error(
                `Route "${cluster.zone}" is missing a valid vehicle.`,
            );
        }

        const startDate = toIsoDateTime(
            state.routeStartDateTime || new Date().toISOString(),
        );

        if (!startDate) {
            throw new Error("Invalid route start date/time.");
        }

        const stops = (rc.optimizedStops || [])
            .map((stop, index) => ({
                order_id: Number(stop.orderId),
                stop_no: Number(stop.num || index + 1),
                eta: toIsoDateTime(stop.eta) || startDate,
                latitude: Number(stop.latitude),
                longitude: Number(stop.longitude),
            }))
            .filter((stop) => Number.isFinite(stop.order_id));

        if (!stops.length) {
            throw new Error(`Route "${cluster.zone}" has no valid stops.`);
        }

        const estimatedDurationSec = Number(rc.estimatedDurationS);
        const endDate = Number.isFinite(estimatedDurationSec)
            ? new Date(
                  new Date(startDate).getTime() + estimatedDurationSec * 1000,
              ).toISOString()
            : stops[stops.length - 1]?.eta || startDate;

        const estimatedDistanceMeters = Number(rc.estimatedDistanceM);
        const totalDistanceKm = Number.isFinite(estimatedDistanceMeters)
            ? Number((estimatedDistanceMeters / 1000).toFixed(2))
            : Number(((stops.length || 0) * 4.2).toFixed(2));

        return {
            route_name: cluster.zone,
            driver_id: Number(driver.id),
            vehicle_id: Number(vehicle.vehicleId),
            scheduled_start_time: startDate,
            scheduled_end_time: endDate,
            status: "Planned",
            total_distance: totalDistanceKm,
            stops,
        };
    });
}

function toIsoDateTime(value) {
    if (!value) return null;

    const normalized = String(value)
        .trim()
        .replace(" ", "T")
        .replace(/\//g, "-");

    if (!normalized) return null;

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
}

function showPopup(message, type = "success") {
    const existing = document.getElementById("route-push-popup");
    if (existing) {
        existing.remove();
    }

    const popup = document.createElement("div");
    popup.id = "route-push-popup";
    popup.textContent = message;
    popup.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 260px;
        max-width: 440px;
        padding: 12px 14px;
        border-radius: 10px;
        color: #ffffff;
        font-size: 0.8125rem;
        font-weight: 600;
        box-shadow: 0 14px 32px rgba(15, 23, 42, 0.25);
        background: ${type === "success" ? "#059669" : "#dc2626"};
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity 0.2s ease, transform 0.2s ease;
    `;

    document.body.appendChild(popup);

    requestAnimationFrame(() => {
        popup.style.opacity = "1";
        popup.style.transform = "translateY(0)";
    });

    setTimeout(() => {
        popup.style.opacity = "0";
        popup.style.transform = "translateY(-8px)";

        setTimeout(() => {
            popup.remove();
        }, 220);
    }, 2600);
}
