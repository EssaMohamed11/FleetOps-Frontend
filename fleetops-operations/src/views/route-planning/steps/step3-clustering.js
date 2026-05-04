/**
 * Step 3: Geo Clustering
 */

import RoutePlanningAPI from "../../../services/api/route-planning.js";
import { routePlanningState } from "../utils/state-manager.js";
import {
    createElement,
    calculateTotalWeight,
    calculateTotalVolume,
} from "../utils/helpers.js";

const CLUSTER_BG_COLORS = [
    "#14b8a6",
    "#6366f1",
    "#f59e0b",
    "#f43f5e",
    "#8b5cf6",
    "#06b6d4",
    "#10b981",
    "#ec4899",
    "#f97316",
    "#84cc16",
];

const CLUSTER_FG_COLORS = [
    "#0d9488",
    "#4f46e5",
    "#d97706",
    "#e11d48",
    "#7c3aed",
    "#0891b2",
    "#059669",
    "#db2777",
    "#ea580c",
    "#65a30d",
];

const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletLoadPromise = null;
let step3MapInstance = null;

function clearStepCompletionFrom(state, startStep) {
    const next = { ...state.stepComplete };
    for (let step = startStep; step <= 9; step += 1) {
        delete next[step];
    }
    return next;
}

function isOrderSelectedInStep2(order) {
    return order?.step2Selected !== false;
}

export async function renderStep3(container) {
    const state = routePlanningState.getState();

    const wrapper = createElement("div", { classes: "step-3-container" });

    if (
        state.clusters.length === 0 &&
        !state.stepComplete[3] &&
        !state.isProcessing
    ) {
        renderLoading(wrapper);
        container.appendChild(wrapper);
        setTimeout(() => autoClusters(), 0);
        return;
    }

    if (state.isProcessing) {
        renderLoading(wrapper);
    } else {
        renderClusters(wrapper);
    }

    container.appendChild(wrapper);
}

async function autoClusters() {
    routePlanningState.setState({ isProcessing: true });

    const state = routePlanningState.getState();
    const selectedOrders = state.prioritizedOrders.filter(
        isOrderSelectedInStep2,
    );

    if (selectedOrders.length === 0) {
        routePlanningState.setState({
            clusters: [],
            routeConfigs: {},
            activeClusterIndex: 0,
            isProcessing: false,
            stepComplete: { ...state.stepComplete, 3: true },
            editingCluster: null,
            moveOrderId: null,
            moveFromCluster: null,
        });
        return;
    }

    const clusters = await RoutePlanningAPI.createGeoClusters(selectedOrders);

    const routeConfigs = { ...state.routeConfigs };
    clusters.forEach((cluster) => {
        if (!routeConfigs[cluster.zone]) {
            routeConfigs[cluster.zone] = {
                clusterId: cluster.zone,
                vehicle: "",
                driver: "",
                capacityResult: null,
                optimizedStops: [],
            };
        }
    });

    routePlanningState.setState({
        clusters,
        routeConfigs,
        isProcessing: false,
        stepComplete: { ...state.stepComplete, 3: true },
        editingCluster: null,
        moveOrderId: null,
        moveFromCluster: null,
    });
}

function renderLoading(container) {
    const loading = createElement("div", {
        classes: "rp-loading",
        html: `
            <div class="rp-loading__spinner"></div>
            <div class="rp-loading__text">
                <p class="rp-loading__title">Auto-Clustering Orders...</p>
                <p class="rp-loading__subtitle">Grouping orders by geographic proximity</p>
            </div>
        `,
    });
    container.appendChild(loading);
}

function renderClusters(container) {
    const state = routePlanningState.getState();

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px; height: 100%; min-height: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                        <h4 style="margin: 0;">Geospatial Clusters</h4>
                        <span class="rp-badge" style="background: #ebfdf5; color: #0f4f49;">AUTO-COMPLETE</span>
                        <span style="font-size: 0.75rem; color: var(--color-text-muted);">·</span>
                        <span style="font-size: 0.75rem; color: var(--color-primary); font-weight: 600;">
                            ${state.clusters.length} clusters = ${state.clusters.length} routes
                        </span>
                    </div>
                    <p style="font-size: 0.75rem; color: var(--color-text-muted); margin: 0;">
                        Each cluster becomes its own route. Edit clusters, move orders between them, or create new clusters.
                    </p>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="button outlined" id="recluster-btn">
                        <i data-lucide="rotate-ccw"></i>
                        Re-cluster
                    </button>
                    <button type="button" class="button primary" id="show-new-cluster-btn">
                        <i data-lucide="plus"></i>
                        New Cluster
                    </button>
                </div>
            </div>

            ${state.showNewClusterModal ? renderNewClusterPanel(state) : ""}
            ${state.moveOrderId && state.moveFromCluster !== null ? renderMoveOverlay(state) : ""}

            <div class="rp-step3-layout" style="display: grid; grid-template-columns: 1fr 420px; gap: 16px; min-height: 0; flex: 1;">
                ${renderMap(state)}
                <div id="clusters-list" class="rp-step3-list" style="display: flex; flex-direction: column; gap: 12px; max-height: 450px; overflow-y: auto; padding-right: 4px;"></div>
            </div>
        </div>
    `;

    const list = container.querySelector("#clusters-list");
    if (list) {
        state.clusters.forEach((cluster, index) => {
            list.appendChild(renderClusterCard(cluster, index, state));
        });
    }

    bindGlobalActions(container);

    setTimeout(() => {
        initializeRealMap(state);
    }, 0);
}

function renderNewClusterPanel(state) {
    return `
        <div style="padding: 12px; border: 1px solid rgba(61, 166, 154, 0.25); background: rgba(61, 166, 154, 0.05); border-radius: 12px;">
            <p style="margin: 0 0 8px 0; font-size: 0.8125rem; font-weight: 600; color: var(--color-text-title);">Create New Cluster (Route)</p>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <input
                    id="new-cluster-name"
                    type="text"
                    value="${escapeHtml(state.newClusterName || "")}"
                    placeholder="Cluster name (e.g., Zone X - Special)"
                    style="flex: 1; min-width: 240px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 0.75rem;"
                />
                <button type="button" class="button primary" id="create-cluster-btn">Create</button>
                <button type="button" class="button outlined" id="cancel-cluster-btn">Cancel</button>
            </div>
        </div>
    `;
}

function renderMoveOverlay(state) {
    const fromCluster = state.clusters[state.moveFromCluster];
    const targetButtons = state.clusters
        .map((cluster, index) => {
            if (index === state.moveFromCluster) {
                return "";
            }
            return `
                <button
                    type="button"
                    class="button outlined"
                    data-move-target-index="${index}"
                    style="display: inline-flex; align-items: center; gap: 6px;">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: ${cluster.color};"></span>
                    ${escapeHtml(cluster.zone)} (${cluster.orders.length})
                </button>
            `;
        })
        .join("");

    return `
        <div style="padding: 12px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                <p style="margin: 0; font-size: 0.75rem; color: #92400e; font-weight: 600;">
                    <i data-lucide="move-right" style="width: 14px; height: 14px;"></i>
                    Moving order ${escapeHtml(state.moveOrderId)} from ${fromCluster ? escapeHtml(fromCluster.zone) : "selected cluster"}.
                </p>
                <button type="button" class="button outlined" id="cancel-move-order-btn">Cancel</button>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${targetButtons}
            </div>
        </div>
    `;
}

function renderMap(state) {
    const clusterChips = state.clusters
        .map(
            (cluster, index) => `
                <button
                    type="button"
                    data-toggle-cluster-index="${index}"
                    style="border: none; border-radius: 8px; padding: 6px 8px; color: #fff; background: ${cluster.color}; font-size: 0.625rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                    <span style="width: 8px; height: 8px; border-radius: 999px; background: ${cluster.color}; box-shadow: 0 0 0 1px rgba(255,255,255,0.35);"></span>
                    ${escapeHtml(cluster.zone)} (${cluster.orders.length})
                </button>
            `,
        )
        .join("");

    return `
        <div class="rp-step3-map" style="background: linear-gradient(135deg, #334155 0%, #1e293b 100%); border-radius: 16px; border: 1px solid var(--color-border); height: 450px; position: relative; overflow: hidden;">
            <div id="rp-step3-real-map" style="position: absolute; inset: 0;"></div>
            <div style="position: absolute; top: 12px; left: 12px; right: 12px; z-index: 500; display: flex; gap: 6px; flex-wrap: wrap; pointer-events: none;">
                <div style="pointer-events: auto; margin-left: 40px; display: flex; gap: 6px; flex-wrap: wrap;">
                    ${clusterChips}
                </div>
            </div>
            <div id="rp-step3-map-empty" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center; z-index: 450; color: #e2e8f0; font-size: 0.75rem; background: rgba(15, 23, 42, 0.45); text-align: center; padding: 16px;">
                No valid coordinates found in current orders.
            </div>
        </div>
    `;
}

async function initializeRealMap(state) {
    const mapElement = document.getElementById("rp-step3-real-map");
    const emptyElement = document.getElementById("rp-step3-map-empty");
    if (!mapElement) {
        return;
    }

    if (step3MapInstance) {
        step3MapInstance.remove();
        step3MapInstance = null;
    }

    const clusterPoints = state.clusters
        .map((cluster) => ({
            zone: cluster.zone,
            color: cluster.color,
            points: cluster.orders
                .map((order) => ({
                    order,
                    coords: getOrderCoordinates(order),
                }))
                .filter((entry) => entry.coords !== null),
        }))
        .filter((cluster) => cluster.points.length > 0);

    if (clusterPoints.length === 0) {
        if (emptyElement) {
            emptyElement.style.display = "flex";
        }
        return;
    }

    if (emptyElement) {
        emptyElement.style.display = "none";
    }

    try {
        await loadLeafletAssets();
    } catch (error) {
        console.error("Failed to load map assets", error);
        if (emptyElement) {
            emptyElement.style.display = "flex";
            emptyElement.textContent =
                "Failed to load map tiles. Check internet connection.";
        }
        return;
    }

    const L = window.L;
    if (!L) {
        return;
    }

    step3MapInstance = L.map(mapElement, {
        zoomControl: true,
        preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(step3MapInstance);

    const bounds = [];

    clusterPoints.forEach((cluster) => {
        const markers = cluster.points.map((entry) => {
            const [lat, lng] = entry.coords;
            bounds.push([lat, lng]);

            const marker = L.circleMarker([lat, lng], {
                radius: 7,
                color: "#ffffff",
                weight: 1.5,
                fillColor: cluster.color,
                fillOpacity: 0.9,
            });

            marker.bindPopup(`
                <div style="font-size: 12px; min-width: 150px;">
                    <p style="margin: 0 0 6px 0; font-weight: 700;">${escapeHtml(cluster.zone)}</p>
                    <p style="margin: 0 0 4px 0;">Order: ${escapeHtml(entry.order.id)}</p>
                    <p style="margin: 0; color: #475569;">${escapeHtml(entry.order.customer)}</p>
                </div>
            `);

            return marker;
        });

        markers.forEach((marker) => marker.addTo(step3MapInstance));
    });

    if (bounds.length === 1) {
        step3MapInstance.setView(bounds[0], 12);
    } else {
        step3MapInstance.fitBounds(bounds, {
            padding: [24, 24],
            maxZoom: 13,
        });
    }
}

function getOrderCoordinates(order) {
    const lat = Number(order?.lat ?? order?.Latitude);
    const lng = Number(order?.lng ?? order?.Longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
    }

    return [lat, lng];
}

function loadLeafletAssets() {
    if (window.L) {
        return Promise.resolve();
    }

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

function renderClusterCard(cluster, index, state) {
    const isExpanded = state.editingCluster === index;
    const weight = calculateTotalWeight(cluster.orders);
    const volume = calculateTotalVolume(cluster.orders);

    const visibleOrders = cluster.orders.filter((order) => {
        const term = (state.clusterSearchTerm || "").trim().toLowerCase();
        if (!term) {
            return true;
        }
        return (
            order.id.toLowerCase().includes(term) ||
            order.customer.toLowerCase().includes(term)
        );
    });

    const card = createElement("div", {
        html: `
            <div style="border-radius: 12px; border: 1px solid ${isExpanded ? "rgba(61, 166, 154, 0.45)" : "var(--color-border)"}; background: var(--color-surface); box-shadow: ${isExpanded ? "0 6px 18px rgba(15, 23, 42, 0.08)" : "none"}; transition: all 0.2s ease;">
                <div data-cluster-header-index="${index}" style="padding: 14px; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <div style="width: 12px; height: 12px; border-radius: 999px; background: ${cluster.color};"></div>
                        <span style="font-size: 0.875rem; font-weight: 600; color: var(--color-text-title);">${escapeHtml(cluster.zone)}</span>
                        <span style="font-size: 0.625rem; padding: 2px 8px; border-radius: 999px; background: var(--color-surface-low); color: var(--color-text-muted);">Route ${index + 1}</span>
                        <span style="font-size: 0.625rem; color: var(--color-text-muted); margin-left: auto;">${cluster.orders.length} orders</span>
                        <button type="button" data-delete-cluster-index="${index}" style="border: none; background: transparent; color: #9ca3af; cursor: pointer; padding: 2px; border-radius: 6px;" title="Delete cluster">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                        <i data-lucide="${isExpanded ? "chevron-up" : "chevron-down"}" style="width: 14px; height: 14px; color: var(--color-text-muted);"></i>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                        <div style="padding: 8px; border-radius: 8px; text-align: center; background: var(--color-surface-low);">
                            <p style="margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--color-text-title);">${cluster.orders.length}</p>
                            <p style="margin: 0; font-size: 0.625rem; color: var(--color-text-muted);">Orders</p>
                        </div>
                        <div style="padding: 8px; border-radius: 8px; text-align: center; background: var(--color-surface-low);">
                            <p style="margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--color-text-title);">${Math.round(weight)}</p>
                            <p style="margin: 0; font-size: 0.625rem; color: var(--color-text-muted);">kg</p>
                        </div>
                        <div style="padding: 8px; border-radius: 8px; text-align: center; background: var(--color-surface-low);">
                            <p style="margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--color-text-title);">${Math.round(volume * 10) / 10}</p>
                            <p style="margin: 0; font-size: 0.625rem; color: var(--color-text-muted);">m³</p>
                        </div>
                    </div>
                </div>
                ${isExpanded ? renderExpandedOrders(visibleOrders, index, state.clusterSearchTerm, cluster.orders.length) : ""}
            </div>
        `,
    });

    return card;
}

function renderExpandedOrders(
    orders,
    clusterIndex,
    clusterSearchTerm,
    totalCount,
) {
    const searchUI =
        totalCount > 5
            ? `
                <div style="position: relative;">
                    <i data-lucide="search" style="position: absolute; left: 8px; top: 7px; width: 12px; height: 12px; color: var(--color-text-muted);"></i>
                    <input
                        type="text"
                        id="cluster-search-input"
                        value="${escapeHtml(clusterSearchTerm || "")}"
                        placeholder="Search..."
                        style="padding: 5px 8px 5px 24px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 0.625rem; width: 130px;"
                    />
                </div>
            `
            : "";

    const rows = orders
        .map(
            (order) => `
                <div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: rgba(248, 250, 252, 0.7);">
                    <span style="font-size: 0.6875rem; font-weight: 600; color: var(--color-text-title); white-space: nowrap;">${escapeHtml(order.id)}</span>
                    <span style="font-size: 0.6875rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHtml(order.customer)}</span>
                    <span style="font-size: 0.625rem; color: var(--color-text-muted); white-space: nowrap;">${order.weight}kg</span>
                    <button type="button" data-start-move-order-id="${order.id}" data-start-move-from-cluster="${clusterIndex}" style="border: none; background: #eff6ff; color: #2563eb; width: 24px; height: 24px; border-radius: 6px; cursor: pointer;" title="Move order">
                        <i data-lucide="move-right" style="width: 12px; height: 12px;"></i>
                    </button>
                    <button type="button" data-remove-order-id="${order.id}" data-remove-order-cluster="${clusterIndex}" style="border: none; background: #fef2f2; color: #dc2626; width: 24px; height: 24px; border-radius: 6px; cursor: pointer;" title="Remove order">
                        <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                    </button>
                </div>
            `,
        )
        .join("");

    return `
        <div style="padding: 12px 14px 14px; border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <p style="margin: 0; font-size: 0.625rem; color: var(--color-text-muted); letter-spacing: 0.06em; font-weight: 600;">ORDERS IN THIS CLUSTER</p>
                ${searchUI}
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto;">
                ${rows || `<p style="margin: 0; font-size: 0.75rem; color: var(--color-text-muted); text-align: center; padding: 8px 0;">No matching orders</p>`}
            </div>
        </div>
    `;
}

function bindGlobalActions(container) {
    const reclusterBtn = container.querySelector("#recluster-btn");
    const showNewClusterBtn = container.querySelector("#show-new-cluster-btn");
    const createClusterBtn = container.querySelector("#create-cluster-btn");
    const cancelClusterBtn = container.querySelector("#cancel-cluster-btn");
    const newClusterInput = container.querySelector("#new-cluster-name");
    const clusterSearchInput = container.querySelector("#cluster-search-input");
    const cancelMoveBtn = container.querySelector("#cancel-move-order-btn");

    if (showNewClusterBtn) {
        showNewClusterBtn.addEventListener("click", () => {
            const state = routePlanningState.getState();
            routePlanningState.setState({
                showNewClusterModal: !state.showNewClusterModal,
                newClusterName: state.showNewClusterModal
                    ? ""
                    : state.newClusterName,
            });
        });
    }

    if (newClusterInput) {
        newClusterInput.addEventListener("input", (event) => {
            routePlanningState.setState({ newClusterName: event.target.value });
        });
    }

    if (createClusterBtn) {
        createClusterBtn.addEventListener("click", () => {
            addNewCluster();
        });
    }

    if (cancelClusterBtn) {
        cancelClusterBtn.addEventListener("click", () => {
            routePlanningState.setState({
                showNewClusterModal: false,
                newClusterName: "",
            });
        });
    }

    if (clusterSearchInput) {
        clusterSearchInput.addEventListener("input", (event) => {
            routePlanningState.setState({
                clusterSearchTerm: event.target.value,
            });
        });
    }

    if (cancelMoveBtn) {
        cancelMoveBtn.addEventListener("click", () => {
            routePlanningState.setState({
                moveOrderId: null,
                moveFromCluster: null,
            });
        });
    }

    container
        .querySelectorAll("[data-toggle-cluster-index]")
        .forEach((button) => {
            button.addEventListener("click", (event) => {
                const index = Number(
                    event.currentTarget.dataset.toggleClusterIndex,
                );
                toggleCluster(index);
            });
        });

    container
        .querySelectorAll("[data-cluster-header-index]")
        .forEach((header) => {
            header.addEventListener("click", (event) => {
                if (event.target.closest("[data-delete-cluster-index]")) {
                    return;
                }
                const index = Number(
                    event.currentTarget.dataset.clusterHeaderIndex,
                );
                toggleCluster(index);
            });
        });

    container
        .querySelectorAll("[data-delete-cluster-index]")
        .forEach((button) => {
            button.addEventListener("click", (event) => {
                event.stopPropagation();
                const index = Number(
                    event.currentTarget.dataset.deleteClusterIndex,
                );
                deleteCluster(index);
            });
        });

    container
        .querySelectorAll("[data-start-move-order-id]")
        .forEach((button) => {
            button.addEventListener("click", (event) => {
                const orderId = event.currentTarget.dataset.startMoveOrderId;
                const fromIndex = Number(
                    event.currentTarget.dataset.startMoveFromCluster,
                );
                routePlanningState.setState({
                    moveOrderId: orderId,
                    moveFromCluster: fromIndex,
                });
            });
        });

    container.querySelectorAll("[data-remove-order-id]").forEach((button) => {
        button.addEventListener("click", (event) => {
            const orderId = event.currentTarget.dataset.removeOrderId;
            const clusterIndex = Number(
                event.currentTarget.dataset.removeOrderCluster,
            );
            removeOrderFromCluster(orderId, clusterIndex);
        });
    });

    container.querySelectorAll("[data-move-target-index]").forEach((button) => {
        button.addEventListener("click", (event) => {
            const targetIndex = Number(
                event.currentTarget.dataset.moveTargetIndex,
            );
            const state = routePlanningState.getState();
            moveOrderToCluster(
                state.moveOrderId,
                state.moveFromCluster,
                targetIndex,
            );
        });
    });

    if (reclusterBtn) {
        reclusterBtn.addEventListener("click", () => {
            const state = routePlanningState.getState();

            routePlanningState.setState({
                stepComplete: clearStepCompletionFrom(state, 3),
                clusters: [],
                routeConfigs: {},
                activeClusterIndex: 0,
                editingCluster: null,
                moveOrderId: null,
                moveFromCluster: null,
                showNewClusterModal: false,
                newClusterName: "",
                clusterSearchTerm: "",
            });
        });
    }
}

function toggleCluster(index) {
    const state = routePlanningState.getState();
    routePlanningState.setState({
        editingCluster: state.editingCluster === index ? null : index,
        clusterSearchTerm: "",
    });
}

function addNewCluster() {
    const state = routePlanningState.getState();
    const zone = (state.newClusterName || "").trim();
    if (!zone) {
        return;
    }

    const exists = state.clusters.some(
        (cluster) => cluster.zone.toLowerCase() === zone.toLowerCase(),
    );
    if (exists) {
        return;
    }

    const nextCluster = {
        zone,
        color: CLUSTER_BG_COLORS[
            state.clusters.length % CLUSTER_BG_COLORS.length
        ],
        orders: [],
    };

    routePlanningState.setState({
        clusters: [...state.clusters, nextCluster],
        routeConfigs: {
            ...state.routeConfigs,
            [zone]: {
                clusterId: zone,
                vehicle: "",
                driver: "",
                capacityResult: null,
                optimizedStops: [],
            },
        },
        showNewClusterModal: false,
        newClusterName: "",
        stepComplete: {
            ...clearStepCompletionFrom(state, 4),
            3: true,
        },
    });
}

function moveOrderToCluster(orderId, fromClusterIndex, toClusterIndex) {
    if (
        !orderId ||
        fromClusterIndex === null ||
        fromClusterIndex === undefined
    ) {
        return;
    }

    const state = routePlanningState.getState();
    const clusters = state.clusters.map((cluster) => ({
        ...cluster,
        orders: [...cluster.orders],
    }));

    const source = clusters[fromClusterIndex];
    const target = clusters[toClusterIndex];
    if (!source || !target) {
        return;
    }

    const orderIndex = source.orders.findIndex((order) => order.id === orderId);
    if (orderIndex < 0) {
        return;
    }

    const [order] = source.orders.splice(orderIndex, 1);
    target.orders.push(order);

    const cleanedClusters = clusters.filter(
        (cluster) => cluster.orders.length > 0,
    );

    routePlanningState.setState({
        clusters: cleanedClusters,
        routeConfigs: syncRouteConfigs(state.routeConfigs, cleanedClusters),
        activeClusterIndex: 0,
        moveOrderId: null,
        moveFromCluster: null,
        editingCluster: null,
        clusterSearchTerm: "",
        stepComplete: {
            ...clearStepCompletionFrom(state, 4),
            3: true,
        },
    });
}

function removeOrderFromCluster(orderId, clusterIndex) {
    const state = routePlanningState.getState();
    const clusters = state.clusters.map((cluster, index) => {
        if (index !== clusterIndex) {
            return { ...cluster, orders: [...cluster.orders] };
        }
        return {
            ...cluster,
            orders: cluster.orders.filter((order) => order.id !== orderId),
        };
    });

    const cleanedClusters = clusters.filter(
        (cluster) => cluster.orders.length > 0,
    );

    routePlanningState.setState({
        clusters: cleanedClusters,
        routeConfigs: syncRouteConfigs(state.routeConfigs, cleanedClusters),
        activeClusterIndex: 0,
        editingCluster: null,
        moveOrderId: null,
        moveFromCluster: null,
        clusterSearchTerm: "",
        stepComplete: {
            ...clearStepCompletionFrom(state, 4),
            3: true,
        },
    });
}

function deleteCluster(index) {
    const state = routePlanningState.getState();
    if (state.clusters.length <= 1) {
        return;
    }

    const clusters = state.clusters.map((cluster) => ({
        ...cluster,
        orders: [...cluster.orders],
    }));

    const removed = clusters[index];
    if (!removed) {
        return;
    }

    if (removed.orders.length > 0) {
        const targetIndex = index === 0 ? 1 : 0;
        if (clusters[targetIndex]) {
            clusters[targetIndex].orders.push(...removed.orders);
        }
    }

    clusters.splice(index, 1);

    routePlanningState.setState({
        clusters,
        routeConfigs: syncRouteConfigs(state.routeConfigs, clusters),
        activeClusterIndex: 0,
        editingCluster: null,
        moveOrderId: null,
        moveFromCluster: null,
        clusterSearchTerm: "",
        stepComplete: {
            ...clearStepCompletionFrom(state, 4),
            3: true,
        },
    });
}

function syncRouteConfigs(currentConfigs, clusters) {
    const next = {};
    clusters.forEach((cluster) => {
        next[cluster.zone] = currentConfigs[cluster.zone] || {
            clusterId: cluster.zone,
            vehicle: "",
            driver: "",
            capacityResult: null,
            optimizedStops: [],
        };
    });
    return next;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
