/**
 * Step 6: Sequence Optimizer
 */

import RoutePlanningAPI from "../../../services/api/route-planning.js";
import { routePlanningState } from "../utils/state-manager.js";
import { createElement } from "../utils/helpers.js";

const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletLoadPromise = null;
let step6MapInstance = null;

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function clearStepCompletionFrom(state, startStep) {
    const next = { ...state.stepComplete };
    for (let step = startStep; step <= 9; step += 1) {
        delete next[step];
    }
    return next;
}

export async function renderStep6(container) {
    const state = routePlanningState.getState();
    const routeStartDateTime =
        state.routeStartDateTime || getDefaultRouteStartDateTime();

    if (!state.routeStartDateTime) {
        routePlanningState.setState({ routeStartDateTime });
    }

    const wrapper = createElement("div", { classes: "step-6-container" });

    // Auto-optimize if not done yet
    if (!state.stepComplete[6] && !state.isProcessing) {
        renderLoading(wrapper);
        container.appendChild(wrapper);
        // Mark processing immediately to avoid scheduling multiple optimizers
        routePlanningState.setState({ isProcessing: true });
        // Run optimization after render to avoid infinite loop
        setTimeout(() => autoOptimize(), 0);
        return;
    }

    if (state.isProcessing) {
        renderLoading(wrapper);
    } else {
        renderSequence(wrapper);
    }

    container.appendChild(wrapper);
}

async function autoOptimize() {
    const current = routePlanningState.getState();
    if (!current.isProcessing) {
        routePlanningState.setState({ isProcessing: true });
    }

    const state = routePlanningState.getState();
    const optimizedClusters = await RoutePlanningAPI.optimizeRouteSequence(
        state.clusters,
        state.routeStartDateTime || new Date().toISOString(),
    );

    const newConfigs = { ...state.routeConfigs };

    optimizedClusters.forEach((clusterResult) => {
        newConfigs[clusterResult.zone] = {
            ...newConfigs[clusterResult.zone],
            optimizedStops: clusterResult.optimizedStops || [],
            estimatedDistanceM: clusterResult.estimatedDistanceM,
            estimatedDurationS: clusterResult.estimatedDurationS,
        };
    });

    routePlanningState.setState({
        routeConfigs: newConfigs,
        isProcessing: false,
        stepComplete: { ...state.stepComplete, 6: true },
    });
}

function renderLoading(container) {
    container.innerHTML = `
        <div class="rp-loading">
            <div class="rp-loading__spinner"></div>
            <div class="rp-loading__text">
                <p class="rp-loading__title">Optimizing Delivery Sequences...</p>
                <p class="rp-loading__subtitle">Running TSP algorithm on all routes</p>
            </div>
        </div>
    `;
}

function renderSequence(container) {
    const state = routePlanningState.getState();
    const activeCluster = state.clusters[state.activeClusterIndex];
    const rc = state.routeConfigs[activeCluster.zone];
    const isManualMode = state.manualEditMode6;
    const routeStartDateTime =
        state.routeStartDateTime || getDefaultRouteStartDateTime();

    container.innerHTML = `
        <div id="cluster-tabs-6"></div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;">
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <h4 style="margin: 0 0 4px 0; display: flex; align-items: center; gap: 8px;">
                    Optimized Sequence — <span style="color: var(--color-primary);">${activeCluster.zone}</span>
                    <span class="rp-badge" style="background: #ebfdf5; color: #0f4f49;">AUTO-COMPLETE</span>
                </h4>
            </div>
            <div style="display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap;">
                <label style="display: flex; flex-direction: column; gap: 6px; font-size: 0.75rem; font-weight: 600; color: var(--color-text-muted); min-width: 260px;">
                    Start Date & Time
                    <input
                        type="datetime-local"
                        step="1"
                        id="route-start-datetime"
                        value="${routeStartDateTime}"
                        style="padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); font-size: 0.875rem; color: var(--color-text-title);"
                    />
                </label>
                <div style="display: flex; gap: 8px;">
                <button type="button" class="button outlined" style="display:none;" id="manual-edit-step6-btn">
                    <i data-lucide="sliders-horizontal"></i>
                    ${isManualMode ? "Disable Manual Edit" : "Manual Edit"}
                </button>
                <button type="button" class="button outlined" id="recalculate-btn">
                    <i data-lucide="rotate-ccw"></i>
                    Recalculate All
                </button>
                </div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 420px; gap: 20px;">
                <div style="border-radius: var(--radius-lg); height: 384px; position: relative; overflow: hidden; border: 1px solid var(--color-border); background: linear-gradient(135deg, #334155 0%, #1e293b 100%);">
                    <div id="rp-step6-real-map" style="position: absolute; inset: 0;"></div>
                    <div id="rp-step6-map-empty" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center; z-index: 450; color: #e2e8f0; font-size: 0.75rem; background: rgba(15, 23, 42, 0.45); text-align: center; padding: 16px;">
                        No route coordinates available for this cluster.
                    </div>
                    <div style="position: absolute; bottom: 12px; left: 12px; display: flex; gap: 8px; z-index: 520;">
                        <span style="padding: 6px 12px; border-radius: 8px; background: rgba(51, 65, 85, 0.8); color: white; font-size: 0.625rem; font-weight: 700;">
                            ${rc.optimizedStops.length} STOPS
                        </span>
                        <span style="padding: 6px 12px; border-radius: 8px; background: ${activeCluster.color}; color: white; font-size: 0.625rem; font-weight: 700;">
                            ${activeCluster.zone}
                        </span>
                    </div>
                </div>
            <div id="stops-list" style="max-height: 384px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;"></div>
        </div>
    `;

    setTimeout(() => {
        renderClusterTabs();
        renderStops(
            rc.optimizedStops,
            activeCluster.color,
            activeCluster.zone,
            isManualMode,
        );
        // initialize or update the map for this step
        initializeStep6Map(routePlanningState.getState());
        document
            .getElementById("manual-edit-step6-btn")
            ?.addEventListener("click", () => {
                routePlanningState.setState({
                    manualEditMode6: !state.manualEditMode6,
                });
            });

        document
            .getElementById("route-start-datetime")
            ?.addEventListener("change", (event) => {
                routePlanningState.setState({
                    routeStartDateTime: event.target.value,
                });
            });

        document
            .getElementById("recalculate-btn")
            ?.addEventListener("click", () => {
                routePlanningState.setState({
                    stepComplete: clearStepCompletionFrom(state, 6),
                    manualEditMode6: false,
                });
            });
    }, 0);
}

function loadLeafletAssets() {
    if (window.L) return Promise.resolve();

    if (!leafletLoadPromise) {
        leafletLoadPromise = new Promise((resolve, reject) => {
            if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
                const cssLink = document.createElement("link");
                cssLink.rel = "stylesheet";
                cssLink.href = LEAFLET_CSS_URL;
                document.head.appendChild(cssLink);
            }

            const existingScript = document.querySelector(
                `script[src="${LEAFLET_JS_URL}"]`,
            );
            if (existingScript) {
                existingScript.addEventListener("load", () => resolve(), {
                    once: true,
                });
                existingScript.addEventListener(
                    "error",
                    () => reject(new Error("Leaflet script failed to load")),
                    { once: true },
                );
                return;
            }

            const script = document.createElement("script");
            script.src = LEAFLET_JS_URL;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () =>
                reject(new Error("Leaflet script failed to load"));
            document.head.appendChild(script);
        });
    }

    return leafletLoadPromise;
}

async function initializeStep6Map(state) {
    const mapEl = document.getElementById("rp-step6-real-map");
    const emptyEl = document.getElementById("rp-step6-map-empty");
    if (!mapEl) return;

    // Remove previous instance to avoid "container already initialized" errors
    if (step6MapInstance) {
        try {
            step6MapInstance.remove();
        } catch (e) {}
        step6MapInstance = null;
    }

    const active = state.clusters[state.activeClusterIndex];
    const rc = state.routeConfigs?.[active?.zone] || { optimizedStops: [] };
    const stops = Array.isArray(rc.optimizedStops) ? rc.optimizedStops : [];

    if (!stops || stops.length === 0) {
        if (emptyEl) emptyEl.style.display = "flex";
        return;
    }

    if (emptyEl) emptyEl.style.display = "none";

    try {
        await loadLeafletAssets();
    } catch (err) {
        console.error("Failed to load leaflet assets", err);
        if (emptyEl) {
            emptyEl.style.display = "flex";
            emptyEl.textContent = "Failed to load map assets.";
        }
        return;
    }

    const L = window.L;
    if (!L) return;

    // build latlngs first from stops
    const latlngs = [];
    stops.forEach((stop) => {
        const lat = Number(stop.latitude || stop.lat || 0);
        const lng = Number(stop.longitude || stop.lng || 0);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        latlngs.push([lat, lng]);
    });

    // create map with a safe initial center to avoid "Set map center and zoom first" errors
    const initialCenter = latlngs.length > 0 ? latlngs[0] : [24.7136, 46.6753];
    const initialZoom = latlngs.length === 1 ? 12 : 6;
    step6MapInstance = L.map(mapEl, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
        preferCanvas: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(step6MapInstance);

    // add markers (distinguish start / end)
    const startIndex = 0;
    const endIndex = stops.length - 1;
    stops.forEach((stop, idx) => {
        const lat = Number(stop.latitude || stop.lat || 0);
        const lng = Number(stop.longitude || stop.lng || 0);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        // style start / end differently
        let markerOptions = {
            radius: 6,
            color: "#ffffff",
            weight: 1.5,
            fillColor: active?.color || "#14b8a6",
            fillOpacity: 0.95,
        };

        if (idx === startIndex) {
            markerOptions = {
                ...markerOptions,
                radius: 9,
                fillColor: "#10b981",
                weight: 2,
            };
        } else if (idx === endIndex) {
            markerOptions = {
                ...markerOptions,
                radius: 9,
                fillColor: "#ef4444",
                weight: 2,
            };
        }

        const marker = L.circleMarker([lat, lng], markerOptions);

        marker.bindPopup(`
            <div style="font-size:12px; min-width:160px;">
                <p style="margin:0 0 6px 0; font-weight:700;">${escapeHtml(active?.zone || "Route")}</p>
                <p style="margin:0 0 4px 0;">#${escapeHtml(String(stop.orderId || "—"))} — ${escapeHtml(stop.customer || "—")}</p>
                <p style="margin:0; color:#475569;">ETA: ${escapeHtml(stop.eta || "—")}</p>
            </div>
        `);

        // add permanent tooltip label for start/end to make them obvious
        if (idx === startIndex) {
            marker.bindTooltip("Start", {
                permanent: true,
                direction: "top",
                className: "rp-map-tooltip-start",
            });
        } else if (idx === endIndex) {
            marker.bindTooltip("End", {
                permanent: true,
                direction: "top",
                className: "rp-map-tooltip-end",
            });
        } else {
            // show stop number as small label
            marker.bindTooltip(String(stop.num || idx + 1), {
                permanent: true,
                direction: "center",
                className: "rp-map-tooltip-stop",
            });
        }

        marker.addTo(step6MapInstance);
    });

    if (latlngs.length === 1) {
        step6MapInstance.setView(latlngs[0], 12);
    } else if (latlngs.length > 1) {
        const bounds = L.latLngBounds(latlngs);
        step6MapInstance.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });

        // draw polyline for path
        const line = L.polyline(latlngs, {
            color: active?.color || "#14b8a6",
            weight: 4,
            opacity: 0.9,
        }).addTo(step6MapInstance);
    }

    // ensure tiles render correctly when container layout stabilizes
    setTimeout(() => {
        try {
            step6MapInstance.invalidateSize();
        } catch (e) {}
    }, 200);
}

function getDefaultRouteStartDateTime() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");

    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function renderClusterTabs() {
    const state = routePlanningState.getState();
    const container = document.getElementById("cluster-tabs-6");
    if (!container) return;

    container.innerHTML = `
        <p style="font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); font-weight: 600; margin: 0 0 8px 0;">
            SELECT ROUTE (CLUSTER)
        </p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;" id="tabs-container-6"></div>
    `;

    const tabsContainer = document.getElementById("tabs-container-6");
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

function renderStops(stops, color, zone, isManualMode) {
    const container = document.getElementById("stops-list");
    if (!container) return;

    // Clear existing list to avoid duplicate DOM nodes if renderStops is called multiple times
    container.innerHTML = "";

    try {
        console.log(
            "[renderStops] zone:",
            zone,
            "stops:",
            stops.length,
            stops.map((s) => ({ num: s.num, orderId: s.orderId })),
        );
    } catch (e) {}

    stops.forEach((stop, index) => {
        const card = createElement("div", {
            html: `
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px;">
                    <span style="width: 28px; height: 28px; border-radius: 50%; background: ${color}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.625rem; font-weight: 700; flex-shrink: 0;">
                        ${stop.num}
                    </span>
                    <div style="flex: 1; min-width: 0;">
                        <p style="margin: 0; font-size: 0.875rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${stop.customer}
                        </p>
                        <p style="margin: 0; font-size: 0.625rem; color: var(--color-text-muted);">
                            ${stop.address} · ${stop.orderId}
                        </p>
                    </div>
                    <div style="text-align: right; flex-shrink: 0;">
                        <p style="margin: 0; font-size: 0.75rem; font-weight: 600 ;" dir="rtl">${stop.eta}</p>
                        ${stop.travel !== "—" ? `<p style="margin: 0; font-size: 0.625rem; color: var(--color-text-muted);">${stop.travel}</p>` : ""}
                    </div>
                    ${
                        isManualMode
                            ? `
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <button type="button" data-stop-up-index="${index}" class="button outlined" style="padding: 4px 6px;"><i data-lucide="arrow-up" style="width: 12px; height: 12px;"></i></button>
                            <button type="button" data-stop-down-index="${index}" class="button outlined" style="padding: 4px 6px;"><i data-lucide="arrow-down" style="width: 12px; height: 12px;"></i></button>
                            <button type="button" data-stop-remove-index="${index}" class="button outlined" style="padding: 4px 6px; color: #b91c1c;"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i></button>
                        </div>
                    `
                            : ""
                    }
                </div>
            `,
        });
        container.appendChild(card);
    });

    if (isManualMode) {
        setTimeout(() => {
            document.querySelectorAll("[data-stop-up-index]").forEach((btn) => {
                btn.addEventListener("click", (e) => {
                    const index = Number(e.currentTarget.dataset.stopUpIndex);
                    moveStopUp(zone, index);
                });
            });

            document
                .querySelectorAll("[data-stop-down-index]")
                .forEach((btn) => {
                    btn.addEventListener("click", (e) => {
                        const index = Number(
                            e.currentTarget.dataset.stopDownIndex,
                        );
                        moveStopDown(zone, index);
                    });
                });

            document
                .querySelectorAll("[data-stop-remove-index]")
                .forEach((btn) => {
                    btn.addEventListener("click", (e) => {
                        const index = Number(
                            e.currentTarget.dataset.stopRemoveIndex,
                        );
                        removeStop(zone, index);
                    });
                });
        }, 0);
    }
}

function moveStopUp(zone, index) {
    if (index <= 0) return;

    const state = routePlanningState.getState();
    const routeConfig = state.routeConfigs[zone];
    if (!routeConfig) return;

    const stops = [...(routeConfig.optimizedStops || [])];
    [stops[index - 1], stops[index]] = [stops[index], stops[index - 1]];

    const renumbered = stops.map((s, i) => ({ ...s, num: i + 1 }));
    routePlanningState.setState({
        routeConfigs: {
            ...state.routeConfigs,
            [zone]: { ...routeConfig, optimizedStops: renumbered },
        },
        stepComplete: {
            ...clearStepCompletionFrom(state, 7),
            6: true,
        },
    });
}

function moveStopDown(zone, index) {
    const state = routePlanningState.getState();
    const routeConfig = state.routeConfigs[zone];
    if (!routeConfig) return;

    const stops = [...(routeConfig.optimizedStops || [])];
    if (index >= stops.length - 1) return;

    [stops[index], stops[index + 1]] = [stops[index + 1], stops[index]];

    const renumbered = stops.map((s, i) => ({ ...s, num: i + 1 }));
    routePlanningState.setState({
        routeConfigs: {
            ...state.routeConfigs,
            [zone]: { ...routeConfig, optimizedStops: renumbered },
        },
        stepComplete: {
            ...clearStepCompletionFrom(state, 7),
            6: true,
        },
    });
}

function removeStop(zone, index) {
    const state = routePlanningState.getState();
    const routeConfig = state.routeConfigs[zone];
    if (!routeConfig) return;

    const stops = [...(routeConfig.optimizedStops || [])];
    if (index < 0 || index >= stops.length) return;

    stops.splice(index, 1);
    const renumbered = stops.map((s, i) => ({ ...s, num: i + 1 }));

    routePlanningState.setState({
        routeConfigs: {
            ...state.routeConfigs,
            [zone]: { ...routeConfig, optimizedStops: renumbered },
        },
        stepComplete: {
            ...clearStepCompletionFrom(state, 7),
            6: true,
        },
    });
}
