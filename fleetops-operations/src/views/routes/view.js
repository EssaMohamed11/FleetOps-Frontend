import RoutesApi from "../../services/api/routes.js";
import {
    createIcons,
    icons,
} from "/node_modules/lucide/dist/esm/lucide.mjs";

let cleanupFns = [];
let state = null;
let routePlaybackTimer = null;

// ─── Leaflet ───────────────────────────────────────────────────────────────
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL  = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
let leafletLoadPromise = null;
let routeMapInstance   = null;
let routeMapMarkers    = [];
let routeMapPolyline   = null;
let vehicleMarker      = null;

const PAGE_SIZE = 10;

export async function mount() {
    console.log("[Routes] mount() called, state before:", state);
    state = {
        activeStatus: "All",
        currentPage: 1,
        date: "All Dates",
        modal: null,
        routes: [],
        searchTerm: "",
        shift: "All Shifts",
    };

    // Load initial data
    const tableBody = document.getElementById("routes-table-body");
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="12"><div style="text-align: center; padding: 2rem;">Loading routes from server...</div></td></tr>`;

    console.log("[Routes] fetching routes...");
    state.routes = await RoutesApi.getRoutes();
    console.log("[Routes] getRoutes() returned:", state.routes.length, "routes. state is:", state);

    bindEvents();
    renderPage();
    await openRouteFromLiveMonitoring();
    console.log("[Routes] mount() complete");
}


export function unmount() {
    clearRoutePlaybackTimer();
    destroyMap();
    cleanupFns.forEach((cleanup) => cleanup?.());
    cleanupFns = [];
    state = null;
}

function loadLeaflet() {
    if (leafletLoadPromise) return leafletLoadPromise;

    leafletLoadPromise = new Promise((resolve, reject) => {
        if (window.L) {
            resolve(window.L);
            return;
        }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = LEAFLET_CSS_URL;
        document.head.appendChild(link);

        const script = document.createElement("script");
        script.src = LEAFLET_JS_URL;
        script.onload = () => resolve(window.L);
        script.onerror = reject;
        document.head.appendChild(script);
    });

    return leafletLoadPromise;
}

function destroyMap() {
    if (routeMapInstance) {
        routeMapInstance.remove();
        routeMapInstance = null;
    }
    routeMapMarkers = [];
    routeMapPolyline = null;
    vehicleMarker = null;
}

function bindEvents() {
    cleanupFns = [];

    const searchInput = document.getElementById("routes-search-input");
    const filters = document.getElementById("routes-filters");
    const shiftSelect = document.getElementById("routes-shift-select");
    const dateSelect = document.getElementById("routes-date-select");
    const tableBody = document.getElementById("routes-table-body");
    const pagination = document.getElementById("routes-pagination");
    const exportButton = document.getElementById("routes-export-btn");
    const newRouteButton = document.getElementById("routes-new-btn");
    const modalRoot = document.getElementById("routes-modal-root");

    searchInput?.addEventListener("input", handleSearchInput);
    filters?.addEventListener("click", handleFilterClick);
    shiftSelect?.addEventListener("change", handleShiftChange);
    dateSelect?.addEventListener("change", handleDateChange);
    tableBody?.addEventListener("click", handleTableClick);
    pagination?.addEventListener("click", handlePaginationClick);
    exportButton?.addEventListener("click", handleExport);
    newRouteButton?.addEventListener("click", openNewRouteModal);
    modalRoot?.addEventListener("click", handleModalClick);
    modalRoot?.addEventListener("submit", handleModalSubmit);

    const handleEscape = (event) => {
        if (event.key === "Escape" && state?.modal) {
            closeModal();
        }
    };

    document.addEventListener("keydown", handleEscape);

    cleanupFns.push(
        () => searchInput?.removeEventListener("input", handleSearchInput),
        () => filters?.removeEventListener("click", handleFilterClick),
        () => shiftSelect?.removeEventListener("change", handleShiftChange),
        () => dateSelect?.removeEventListener("change", handleDateChange),
        () => tableBody?.removeEventListener("click", handleTableClick),
        () => pagination?.removeEventListener("click", handlePaginationClick),
        () => exportButton?.removeEventListener("click", handleExport),
        () => newRouteButton?.removeEventListener("click", openNewRouteModal),
        () => modalRoot?.removeEventListener("click", handleModalClick),
        () => modalRoot?.removeEventListener("submit", handleModalSubmit),
        () => document.removeEventListener("keydown", handleEscape),
    );
}

function renderPage() {
    renderSummary();
    renderOverview();
    renderFilters();
    renderSelects();
    renderTable();
    renderModal();
    refreshIcons();
}

function renderSummary() {
    const summary = document.getElementById("routes-summary");
    if (!summary) {
        return;
    }

    summary.textContent = `${state.routes.length} total routes`;
}

function renderOverview() {
    const container = document.getElementById("routes-overview");
    if (!container) {
        return;
    }

    const stats = RoutesApi.getOverviewStats(state.routes);
    container.innerHTML = [
        renderStatCard("Active Routes", stats.activeRoutes, "map-pinned", "blue"),
        renderStatCard("Completed Today", stats.completedToday, "circle-check-big", "green"),
        renderStatCard("Total Distance", `${formatNumber(stats.totalDistanceKm)} km`, "route", "purple"),
        renderStatCard("Avg Stops/Route", stats.avgStops, "package", "orange"),
    ].join("");
}

function renderStatCard(label, value, icon, tone) {
    return `
        <article class="route-stat-card">
            <div class="route-stat-card__top">
                <span>${label}</span>
                <span class="route-stat-card__icon route-stat-card__icon--${tone}">
                    <i data-lucide="${icon}"></i>
                </span>
            </div>
            <strong class="route-stat-card__value">${value}</strong>
        </article>
    `;
}

function renderFilters() {
    const filters = document.getElementById("routes-filters");
    if (!filters) {
        return;
    }

    filters.innerHTML = RoutesApi.getStatusOptions()
        .map(
            (status) => `
                <button
                    class="routes-filter-chip ${state.activeStatus === status ? "is-active" : ""}"
                    type="button"
                    data-status-filter="${status}">
                    ${status}
                </button>
            `,
        )
        .join("");
}

function renderSelects() {
    const shiftSelect = document.getElementById("routes-shift-select");
    const dateSelect = document.getElementById("routes-date-select");

    if (shiftSelect) {
        shiftSelect.innerHTML = RoutesApi.getShiftOptions()
            .map(
                (option) =>
                    `<option value="${option}" ${state.shift === option ? "selected" : ""}>${option}</option>`,
            )
            .join("");
    }

    if (dateSelect) {
        dateSelect.innerHTML = RoutesApi.getDateOptions()
            .map(
                (option) =>
                    `<option value="${option}" ${state.date === option ? "selected" : ""}>${option}</option>`,
            )
            .join("");
    }
}

function renderTable() {
    const tableBody = document.getElementById("routes-table-body");
    const footerSummary = document.getElementById("routes-footer-summary");
    const pagination = document.getElementById("routes-pagination");

    if (!tableBody || !footerSummary || !pagination) {
        return;
    }

    const filteredRoutes = getFilteredRoutes();
    const totalPages = Math.max(1, Math.ceil(filteredRoutes.length / PAGE_SIZE));
    state.currentPage = Math.min(state.currentPage, totalPages);
    const pagedRoutes = paginate(filteredRoutes, state.currentPage, PAGE_SIZE);

    if (!filteredRoutes.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="12">
                    <div class="routes-empty">
                        <i data-lucide="map"></i>
                        <p>No routes match the selected filters.</p>
                    </div>
                </td>
            </tr>
        `;
        footerSummary.textContent = "Showing 0 routes";
        pagination.innerHTML = "";
        return;
    }

    tableBody.innerHTML = pagedRoutes.map(renderRouteRow).join("");

    const start = (state.currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, filteredRoutes.length);
    footerSummary.textContent = `Showing ${start}-${end} of ${filteredRoutes.length} routes`;
    pagination.innerHTML = renderPagination(totalPages);
}

function renderRouteRow(route) {
    return `
        <tr data-route-id="${route.id}">
            <td><span class="route-id">${route.id}</span></td>
            <td>
                <div class="route-driver">
                    <span class="route-driver__avatar">${route.driverInitials}</span>
                    <div class="route-driver__meta">
                        <strong>${route.driverName}</strong>
                    </div>
                </div>
            </td>
            <td>
                <div class="route-vehicle">
                    <i data-lucide="truck"></i>
                    <div class="route-vehicle__meta">
                        <strong>${route.vehicleId}</strong>
                        <span>${route.vehicleType}</span>
                    </div>
                </div>
            </td>
            <td>${renderStatusBadge(route.status)}</td>
            <td>${renderShiftBadge(route.shift)}</td>
            <td>${route.completedStops}/${route.totalStops}</td>
            <td>
                <div class="progress-cell">
                    <div class="progress-bar">
                        <span class="${getProgressClass(route.status)}" style="width: ${route.progress}%"></span>
                    </div>
                    <span class="progress-label">${route.progress}%</span>
                </div>
            </td>
            <td>${route.distanceKm} km</td>
            <td>${route.startTime}</td>
            <td>
                <div class="route-eta">
                    <div class="route-eta__meta">
                        <strong>${route.eta}</strong>
                        <span>${route.etaStatus || "--"}</span>
                    </div>
                </div>
            </td>
            <td>${route.date}</td>
            <td>
                <button class="route-action-btn" type="button" data-action="open-route" data-route-id="${route.id}">
                    <i data-lucide="eye"></i>
                </button>
            </td>
        </tr>
    `;
}

function renderPagination(totalPages) {
    const buttons = [];
    buttons.push(
        `<button class="page-btn" type="button" data-page-action="prev" ${state.currentPage === 1 ? "disabled" : ""}><i data-lucide="chevron-left"></i></button>`,
    );

    for (let page = 1; page <= totalPages; page += 1) {
        buttons.push(`
            <button
                class="page-btn ${page === state.currentPage ? "is-active" : ""}"
                type="button"
                data-page="${page}">
                ${page}
            </button>
        `);
    }

    buttons.push(
        `<button class="page-btn" type="button" data-page-action="next" ${state.currentPage === totalPages ? "disabled" : ""}><i data-lucide="chevron-right"></i></button>`,
    );

    return buttons.join("");
}

function renderModal() {
    const root = document.getElementById("routes-modal-root");
    if (!root) {
        return;
    }

    if (!state.modal) {
        root.innerHTML = "";
        return;
    }

    if (state.modal.type === "details" && state.modal.routeData) {
        root.innerHTML = renderDetailsModal(state.modal.routeData);

        const tab = state.modal.tab ?? "stops";
        if (tab === "playback") {
            setTimeout(() => initRouteMap(state.modal.routeData, "playback"), 50);
        } else if (tab === "summary") {
            setTimeout(() => initRouteMap(state.modal.routeData, "summary"), 50);
        } else {
            destroyMap();
        }
        return;
    }

    if (state.modal.type === "new") {
        root.innerHTML = renderNewRouteModal();
    }
}

function renderDetailsModal(route) {
    if (!route) {
        return "";
    }

    const activeTab = state.modal?.tab ?? "stops";

    return `
        <div class="routes-modal-overlay" data-modal-close="overlay">
            <section class="routes-modal" role="dialog" aria-modal="true" aria-label="Route details">
                <header class="routes-modal__header">
                    <div class="routes-modal__head">
                        <div class="routes-modal__icon">
                            <i data-lucide="map-pinned"></i>
                        </div>
                        <div>
                            <div class="routes-modal__title">
                                <strong>${route.id}</strong>
                                ${renderStatusBadge(route.status)}
                                ${renderShiftBadge(route.shift)}
                            </div>
                            <div class="routes-modal__sub">${route.date} - Version ${route.version}</div>
                        </div>
                    </div>
                    <button class="routes-modal__close" type="button" data-modal-close="button" aria-label="Close">
                        <i data-lucide="x"></i>
                    </button>
                </header>
                <div class="routes-modal__body">
                    <section class="route-detail-grid">
                        ${renderDetailCard("user-round", "Driver", route.driverName)}
                        ${renderDetailCard("truck", "Vehicle", `${route.vehicleId} (${route.vehicleType})`)}
                        ${renderDetailCard("map-pin", "Distance", `${route.distanceKm} km`)}
                        ${renderDetailCard("package", "Stops", `${route.completedStops}/${route.totalStops}`)}
                    </section>

                    <section>
                        <div class="route-progress-head">
                            <span>Route Progress</span>
                            <span>${route.progress}%</span>
                        </div>
                        <div class="route-progress-bar">
                            <span style="width:${route.progress}%"></span>
                        </div>
                    </section>

                    <section class="route-tab-strip">
                        <button class="route-tab-btn ${activeTab === "stops" ? "is-active" : ""}" type="button" data-tab="stops">Stops (${route.totalStops})</button>
                        <button class="route-tab-btn ${activeTab === "summary" ? "is-active" : ""}" type="button" data-tab="summary">Summary</button>
                        <button class="route-tab-btn ${activeTab === "playback" ? "is-active" : ""}" type="button" data-tab="playback">Playback</button>
                    </section>

                    ${renderRouteTab(route, activeTab)}
                </div>
            </section>
        </div>
    `;
}

function renderDetailCard(icon, label, value) {
    return `
        <article class="route-detail-card">
            <span class="route-detail-card__label"><i data-lucide="${icon}"></i><span>${label}</span></span>
            <strong class="route-detail-card__value">${value}</strong>
        </article>
    `;
}

function renderRouteTab(route, tab) {
    if (tab === "summary") {
        return `
            <section class="route-summary-layout">
                <div class="route-summary-grid">
                    <div><span>Total Weight</span><strong>${route.totalWeightKg} kg</strong></div>
                    <div><span>Total Volume</span><strong>${route.totalVolumeM3} m3</strong></div>
                    <div><span>Start Time</span><strong>${route.startTime}</strong></div>
                    <div><span>ETA Last Stop</span><strong>${route.eta}</strong></div>
                    <div><span>ETA Status</span><strong>${route.etaStatus || "--"}</strong></div>
                    <div><span>Route Version</span><strong>${route.version}</strong></div>
                </div>
                <div class="route-summary-chart" style="position: relative; overflow: hidden;">
                    <div id="route-summary-map" style="width: 100%; height: 100%; border-radius: 8px; min-height: 260px;"></div>
                    <div class="playback-legend route-summary-legend">
                        <span class="legend-chip"><span class="legend-dot legend-dot--purple"></span>Depot</span>
                        <span class="legend-chip"><span class="legend-dot legend-dot--green"></span>Delivered</span>
                        <span class="legend-chip"><span class="legend-dot legend-dot--slate"></span>Upcoming</span>
                        <span class="legend-chip"><span class="legend-dot legend-dot--yellow"></span>Vehicle</span>
                    </div>
                    <div class="route-summary-chart__pill">
                        <span>${route.distanceKm} km</span>
                        <span>${route.totalStops} Stops</span>
                    </div>
                </div>
            </section>
        `;
    }

    if (tab === "playback") {
        const frame = state.modal?.playbackFrame ?? 1;
        const speed = state.modal?.playbackSpeed ?? 1;
        const isPlaying = state.modal?.isPlaying ?? false;
        const playLabel = isPlaying ? "Pause" : "Play";

        return `
            <section class="route-banner">
                <div class="route-banner__left">
                    <i data-lucide="circle-check-big"></i>
                    <strong>Route ${route.status.toLowerCase()} - full historical playback available</strong>
                </div>
                <span>${route.completedStops}/${route.totalStops} stops - ${route.distanceKm} km</span>
            </section>
            <section class="route-playback-layout">
                <div>
                    <div class="route-playback">
                        <div id="route-playback-map" style="width: 100%; height: 100%; border-radius: 8px; min-height: 280px;"></div>
                        <div class="playback-legend">
                            <span class="legend-chip"><span class="legend-dot legend-dot--purple"></span>Depot</span>
                            <span class="legend-chip"><span class="legend-dot legend-dot--green"></span>Delivered</span>
                            <span class="legend-chip"><span class="legend-dot legend-dot--slate"></span>Upcoming</span>
                            <span class="legend-chip"><span class="legend-dot legend-dot--yellow"></span>Vehicle</span>
                        </div>
                    </div>
                    <div class="route-playback-controls">
                        <button class="play-btn" type="button" data-action="toggle-play">
                            <i data-lucide="${isPlaying ? "pause" : "play"}"></i>
                            <span>${playLabel}</span>
                        </button>
                        <div class="playback-speed">
                            <span>Speed</span>
                            <button class="speed-chip ${speed === 1 ? "is-active" : ""}" type="button" data-action="change-speed" data-speed="1">1x</button>
                            <button class="speed-chip ${speed === 2 ? "is-active" : ""}" type="button" data-action="change-speed" data-speed="2">2x</button>
                            <button class="speed-chip ${speed === 5 ? "is-active" : ""}" type="button" data-action="change-speed" data-speed="5">5x</button>
                            <button class="speed-chip ${speed === 10 ? "is-active" : ""}" type="button" data-action="change-speed" data-speed="10">10x</button>
                        </div>
                        <span id="playback-frame-counter">Frame ${frame} / ${route.playbackFrames} - ${route.eventTime}</span>
                    </div>
                </div>
                <div class="route-playback-panel">
                    <div class="route-log">
                        <div class="route-log__title">EVENT LOG</div>
                        ${route.eventLog
                            .map(
                                (entry) => `
                                    <div class="route-log__entry">
                                        <strong>${entry.title}</strong>
                                        <span>${entry.time}</span>
                                    </div>
                                `,
                            )
                            .join("")}
                    </div>
                    <div class="route-playback-summary">
                        <div><strong>Delivered</strong> ${route.playbackStopsDelivered}</div>
                        <div><strong>Remaining</strong> ${route.playbackStopsRemaining}</div>
                        <div><strong>Progress</strong> ${route.progress}%</div>
                    </div>
                </div>
            </section>
        `;
    }

    return `
        <section class="route-stop-list">
            ${route.stops
                .map(
                    (stop) => `
                        <article class="route-stop-row">
                            <div class="route-stop-row__main">
                                <span class="route-stop-check ${stop.delivered ? "" : "is-pending"}">
                                    <i data-lucide="${stop.delivered ? "check" : "clock-3"}"></i>
                                </span>
                                <div class="route-stop-copy">
                                    <strong>Stop ${stop.index} - ${stop.customer}</strong>
                                    <span>${stop.address} - ${stop.orderId}</span>
                                </div>
                            </div>
                            <div class="route-stop-time">
                                <div>Planned: ${stop.planned}</div>
                                <div>Actual: ${stop.actual}</div>
                            </div>
                        </article>
                    `,
                )
                .join("")}
        </section>
    `;
}

function renderPlaybackMap() {
    // Just a container — real map is injected after render by initRouteMap()
    return `<div id="route-playback-map" style="width: 100%; height: 100%; border-radius: 8px; min-height: 280px; background: #e8f4f8;"></div>`;
}

async function initRouteMap(route, mode) {
    // mode: "summary" (static stops only) or "playback" (stops + animated vehicle)
    const containerId = mode === "summary" ? "route-summary-map" : "route-playback-map";
    const mapContainer = document.getElementById(containerId);
    if (!mapContainer) return;

    try {
        const L = await loadLeaflet();
        destroyMap();

        // Cairo fallback coordinates
        const defaultLat = 30.0444;
        const defaultLng = 31.2357;

        routeMapInstance = L.map(mapContainer, {
            zoomControl: true,
            attributionControl: false,
        }).setView([defaultLat, defaultLng], 12);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
        }).addTo(routeMapInstance);

        const stopLatLngs = getRouteStopLatLngs(route);
        const gpsLatLngs = getRouteGpsLatLngs(route);
        const roadLatLngs = getRouteRoadLatLngs(route);
        const pathLatLngs = roadLatLngs.length > 1
            ? roadLatLngs
            : mode === "playback" && gpsLatLngs.length > 1
            ? gpsLatLngs
            : stopLatLngs;

        // ── Plot stop markers ──────────────────────────────────────────────
        (route.stops || []).forEach((stop, index) => {
            // Coordinates are guaranteed by the mapper (real DB or deterministic stub)
            const lat = stop.lat;
            const lng = stop.lng;
            if (!isValidCoordinate(lat, lng)) return; // skip if somehow still null

            const color = stop.delivered ? '#10b981' : '#94a3b8';
            const html = '<div style="background:' + color + ';width:24px;height:24px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.25);font-size:11px">' + (index + 1) + '</div>';

            const marker = L.marker([lat, lng], {
                icon: L.divIcon({ className: 'route-stop-icon', html, iconSize: [24, 24], iconAnchor: [12, 12] }),
                zIndexOffset: 700,
            }).addTo(routeMapInstance);
            marker.bindTooltip('Stop ' + (index + 1) + ' — ' + (stop.customer || ''), { direction: 'top', offset: [0, -12] });
            routeMapMarkers.push(marker);
        });

        if (pathLatLngs.length === 0 && gpsLatLngs.length === 0) {
            console.warn('[RouteMap] No stops with coordinates found for route', route.id);
            return;
        }

        // ── Depot marker ───────────────────────────────────────────────────
        const depotHtml = '<div style="background:#8b5cf6;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>';
        const depotLatLng = stopLatLngs[0] || pathLatLngs[0] || gpsLatLngs[0];
        L.marker(depotLatLng, {
            icon: L.divIcon({ className: 'depot-icon', html: depotHtml, iconSize: [30, 30], iconAnchor: [15, 15] }),
            zIndexOffset: 100,
        }).addTo(routeMapInstance);

        // ── Route polyline ─────────────────────────────────────────────────
        if (pathLatLngs.length > 1) {
            routeMapPolyline = L.polyline(pathLatLngs, { color: '#14b8a6', weight: 4, opacity: 0.75, dashArray: mode === 'summary' ? null : '8 4' }).addTo(routeMapInstance);
        }

        // ── Vehicle marker (playback only) ─────────────────────────────────
        const vehicleLatLng = getVehicleStartLatLng(route, mode, pathLatLngs, gpsLatLngs);
        if (vehicleLatLng) {
            vehicleMarker = createVehicleMarker(L, vehicleLatLng).addTo(routeMapInstance);

            if (mode === 'playback' && pathLatLngs.length > 1) {
                updateVehiclePosition(
                    Math.max(1, route.playbackFrames),
                    state.modal?.playbackFrame || 1,
                    pathLatLngs,
                );
            }
        }

        fitMapToPoints([...stopLatLngs, ...gpsLatLngs, ...roadLatLngs, vehicleLatLng].filter(Boolean));
        setTimeout(() => routeMapInstance?.invalidateSize(), 0);

    } catch (err) {
        console.error('[RouteMap] Failed to init Leaflet:', err);
    }
}

function getRouteStopLatLngs(route) {
    return (route.stops || [])
        .map((stop) => [Number(stop.lat), Number(stop.lng)])
        .filter(([lat, lng]) => isValidCoordinate(lat, lng));
}

function getRouteGpsLatLngs(route) {
    return (route.gpsTrail || [])
        .map((point) => [Number(point.lat), Number(point.lng)])
        .filter(([lat, lng]) => isValidCoordinate(lat, lng));
}

function getRouteRoadLatLngs(route) {
    return (route.roadPath || [])
        .map((point) => [Number(point.lat), Number(point.lng)])
        .filter(([lat, lng]) => isValidCoordinate(lat, lng));
}

function getVehicleStartLatLng(route, mode, pathLatLngs, gpsLatLngs) {
    const current = route.currentLocation;
    if (current && isValidCoordinate(Number(current.lat), Number(current.lng))) {
        return [Number(current.lat), Number(current.lng)];
    }

    if (mode === "summary") {
        const progressFrame = Math.max(
            1,
            Math.round((route.progress / 100) * Math.max(1, route.playbackFrames)),
        );
        return interpolateLatLng(Math.max(1, route.playbackFrames), progressFrame, pathLatLngs);
    }

    return gpsLatLngs[0] || pathLatLngs[0] || null;
}

function createVehicleMarker(L, latLng) {
    const vehicleHtml = '<div style="background:#f59e0b;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>';

    return L.marker(latLng, {
        icon: L.divIcon({ className: 'vehicle-icon', html: vehicleHtml, iconSize: [34, 34], iconAnchor: [17, 17] }),
        zIndexOffset: 1000,
    });
}

function fitMapToPoints(points) {
    if (!routeMapInstance || !points.length) return;

    if (points.length === 1) {
        routeMapInstance.setView(points[0], 13);
        return;
    }

    routeMapInstance.fitBounds(window.L.latLngBounds(points), { padding: [40, 40] });
}

function updateVehiclePosition(totalFrames, currentFrame, latLngs) {
    if (!vehicleMarker || latLngs.length < 2) return;

    const currentLatLng = interpolateLatLng(totalFrames, currentFrame, latLngs);
    if (currentLatLng) {
        vehicleMarker.setLatLng(currentLatLng);
    }
}

function interpolateLatLng(totalFrames, currentFrame, latLngs) {
    if (!latLngs.length) return null;
    if (latLngs.length === 1) return latLngs[0];

    // Simple interpolation along the path based on frame percentage
    const percentage = Math.min(1, currentFrame / totalFrames);
    
    // Find which segment we are in
    const totalSegments = latLngs.length - 1;
    const exactSegment = percentage * totalSegments;
    const segmentIndex = Math.min(Math.floor(exactSegment), totalSegments - 1);
    const segmentPercentage = exactSegment - segmentIndex;
    
    const startPoint = latLngs[segmentIndex];
    const endPoint = latLngs[segmentIndex + 1];
    
    // Leaflet LatLng objects use .lat/.lng, plain arrays use [0]/[1]
    const startLat = startPoint.lat !== undefined ? startPoint.lat : startPoint[0];
    const startLng = startPoint.lng !== undefined ? startPoint.lng : startPoint[1];
    const endLat   = endPoint.lat   !== undefined ? endPoint.lat   : endPoint[0];
    const endLng   = endPoint.lng   !== undefined ? endPoint.lng   : endPoint[1];
    
    const currentLat = startLat + (endLat - startLat) * segmentPercentage;
    const currentLng = startLng + (endLng - startLng) * segmentPercentage;

    return [currentLat, currentLng];
}

function isValidCoordinate(lat, lng) {
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function getRouteLinePoints(count) {
    const points = [];
    for (let i = 0; i < count; i++) {
        points.push(20 + Math.sin(i * 1.5) * 12 + (i % 2) * 8);
    }
    return points;
}

function renderSummaryChart(route) {
    const pointsArray = getRouteLinePoints(route.totalStops);
    
    // Dynamically calculate width so the dots aren't crammed if there are many stops
    const chartWidth = Math.max(420, pointsArray.length * 60 + 40);

    const pointsStr = pointsArray
        .map((point, index) => {
            const x = 20 + index * 60;
            const y = 100 - point * 2;
            return `${x},${y}`;
        })
        .join(" ");

    return `
        <svg viewBox="0 0 ${chartWidth} 120" preserveAspectRatio="xMinYMid slice" aria-hidden="true" style="width: 100%; min-width: ${chartWidth}px;">
            <polyline
                fill="none"
                stroke="#19c6c1"
                stroke-width="3"
                points="${pointsStr}" />
            ${pointsArray
                .map((point, index) => {
                    const x = 20 + index * 60;
                    const y = 100 - point * 2;
                    return `
                        <circle cx="${x}" cy="${y}" r="8" fill="#10b981"></circle>
                        <text x="${x}" y="${y + 3}" text-anchor="middle" font-size="8" fill="#ffffff" font-weight="700">${index + 1}</text>
                    `;
                })
                .join("")}
        </svg>
    `;
}

function renderNewRouteModal() {
    return `
        <div class="routes-modal-overlay" data-modal-close="overlay">
            <section class="routes-modal routes-modal--compact" role="dialog" aria-modal="true" aria-label="New route">
                <header class="routes-modal__header">
                    <div>
                        <div class="routes-modal__title"><strong>New Route</strong></div>
                        <div class="routes-modal__sub">Create a route plan and add it to the dispatch queue.</div>
                    </div>
                    <button class="routes-modal__close" type="button" data-modal-close="button" aria-label="Close">
                        <i data-lucide="x"></i>
                    </button>
                </header>
                <div class="routes-modal__body">
                    <form class="routes-form" id="new-route-form">
                        <div class="routes-form-grid">
                            <label>
                                <span class="label">Driver Name</span>
                                <input name="driverName" required />
                            </label>
                            <label>
                                <span class="label">Vehicle ID</span>
                                <input name="vehicleId" required />
                            </label>
                            <label>
                                <span class="label">Vehicle Type</span>
                                <input name="vehicleType" value="Light" required />
                            </label>
                            <label>
                                <span class="label">Shift</span>
                                <select name="shift">
                                    ${RoutesApi.getShiftOptions()
                                        .filter((option) => option !== "All Shifts")
                                        .map((option) => `<option value="${option}">${option}</option>`)
                                        .join("")}
                                </select>
                            </label>
                            <label>
                                <span class="label">Total Stops</span>
                                <input name="totalStops" type="number" min="1" value="8" required />
                            </label>
                            <label>
                                <span class="label">Distance (km)</span>
                                <input name="distanceKm" type="number" min="1" value="40" required />
                            </label>
                            <label>
                                <span class="label">Total Weight (kg)</span>
                                <input name="totalWeightKg" type="number" min="1" value="250" required />
                            </label>
                            <label>
                                <span class="label">Total Volume (m3)</span>
                                <input name="totalVolumeM3" type="number" min="0.1" step="0.1" value="5.5" required />
                            </label>
                            <label class="full">
                                <span class="label">Zone / Area</span>
                                <input name="zone" placeholder="Greater Cairo Cluster" required />
                            </label>
                            <label class="full">
                                <span class="label">Date</span>
                                <select name="date">
                                    ${RoutesApi.getDateOptions()
                                        .filter((option) => option !== "All Dates")
                                        .map((option) => `<option value="${option}">${option}</option>`)
                                        .join("")}
                                </select>
                            </label>
                        </div>
                        <div class="routes-form-actions">
                            <button class="button secondary" type="button" data-modal-close="button">Cancel</button>
                            <button class="button primary" type="submit">Create Route</button>
                        </div>
                    </form>
                </div>
            </section>
        </div>
    `;
}

function handleSearchInput(event) {
    state.searchTerm = event.target.value.trim().toLowerCase();
    state.currentPage = 1;
    renderTable();
    refreshIcons();
}

function handleFilterClick(event) {
    const button = event.target.closest("[data-status-filter]");
    if (!button) {
        return;
    }

    state.activeStatus = button.dataset.statusFilter;
    state.currentPage = 1;
    renderFilters();
    renderTable();
    refreshIcons();
}

function handleShiftChange(event) {
    state.shift = event.target.value;
    state.currentPage = 1;
    renderTable();
}

function handleDateChange(event) {
    state.date = event.target.value;
    state.currentPage = 1;
    renderTable();
}

async function handleTableClick(event) {
    const trigger = event.target.closest("[data-route-id], [data-action='open-route']");
    if (!trigger) {
        return;
    }

    const routeId =
        trigger.dataset.routeId ??
        trigger.closest("[data-route-id]")?.dataset.routeId;

    if (routeId) {
        await openDetailsModal(routeId);
    }
}

function handlePaginationClick(event) {
    const pageButton = event.target.closest("[data-page]");
    const actionButton = event.target.closest("[data-page-action]");

    const filteredRoutes = getFilteredRoutes();
    const totalPages = Math.max(1, Math.ceil(filteredRoutes.length / PAGE_SIZE));

    if (pageButton) {
        state.currentPage = Number(pageButton.dataset.page);
        renderTable();
        refreshIcons();
        return;
    }

    if (!actionButton) {
        return;
    }

    if (actionButton.dataset.pageAction === "prev") {
        state.currentPage = Math.max(1, state.currentPage - 1);
    }

    if (actionButton.dataset.pageAction === "next") {
        state.currentPage = Math.min(totalPages, state.currentPage + 1);
    }

    renderTable();
    refreshIcons();
}

function handleModalClick(event) {
    const overlay = event.target.closest("[data-modal-close='overlay']");
    const closeButton = event.target.closest("[data-modal-close='button']");
    const tabButton = event.target.closest("[data-tab]");
    const actionButton = event.target.closest("[data-action]");

    if (event.target === overlay || closeButton) {
        closeModal();
        return;
    }

    if (tabButton) {
        state.modal = {
            ...state.modal,
            tab: tabButton.dataset.tab,
        };
        renderModal();
        refreshIcons();
        return;
    }

    if (actionButton) {
        const action = actionButton.dataset.action;

        if (action === "toggle-play") {
            if (state.modal?.isPlaying) {
                stopRoutePlayback();
            } else {
                startRoutePlayback();
            }
            
            // Update button UI directly
            const iconElem = actionButton.querySelector("i");
            const textElem = actionButton.querySelector("span");
            if (iconElem && textElem) {
                const isPlaying = state.modal?.isPlaying;
                iconElem.setAttribute("data-lucide", isPlaying ? "pause" : "play");
                textElem.textContent = isPlaying ? "Pause" : "Play";
                refreshIcons();
            }
            return;
        }

        if (action === "change-speed") {
            const speed = Number(actionButton.dataset.speed);
            if (!Number.isNaN(speed)) {
                setRoutePlaybackSpeed(speed);
                // Update speed UI directly
                const speedChips = document.querySelectorAll(".speed-chip");
                speedChips.forEach(chip => {
                    if (Number(chip.dataset.speed) === speed) {
                        chip.classList.add("is-active");
                    } else {
                        chip.classList.remove("is-active");
                    }
                });
            }
            return;
        }
    }
}

async function handleModalSubmit(event) {
    if (event.target.id !== "new-route-form") {
        return;
    }

    event.preventDefault();
    
    // Show loading text on button
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating...";
    }

    const formData = new FormData(event.target);
    await RoutesApi.createRoute(Object.fromEntries(formData.entries()));
    state.routes = await RoutesApi.getRoutes();
    state.currentPage = 1;
    closeModal();
    renderPage();
}

function clearRoutePlaybackTimer() {
    if (routePlaybackTimer) {
        window.clearInterval(routePlaybackTimer);
        routePlaybackTimer = null;
    }
}

function startRoutePlayback() {
    if (!state.modal || !state.modal.routeData) {
        return;
    }

    const route = state.modal.routeData;

    state.modal.isPlaying = true;
    clearRoutePlaybackTimer();

    routePlaybackTimer = window.setInterval(() => {
        const maxFrame = Math.max(1, route.playbackFrames);
        const nextFrame = state.modal.playbackFrame >= maxFrame ? 1 : state.modal.playbackFrame + state.modal.playbackSpeed;
        state.modal.playbackFrame = Math.min(nextFrame, maxFrame);
        
        // Update vehicle position on map if it exists
        if (routeMapPolyline && vehicleMarker) {
            updateVehiclePosition(maxFrame, state.modal.playbackFrame, routeMapPolyline.getLatLngs());
        }
        
        // Update DOM text for frame counter
        const frameTextElem = document.getElementById("playback-frame-counter");
        if (frameTextElem) {
            frameTextElem.textContent = `Frame ${state.modal.playbackFrame} / ${route.playbackFrames} - ${route.eventTime}`;
        }
    }, 500);
}

function stopRoutePlayback() {
    if (!state.modal) {
        return;
    }

    state.modal.isPlaying = false;
    clearRoutePlaybackTimer();

    // Update button UI directly without re-rendering the whole modal (which would destroy the map)
    const playBtn = document.querySelector('[data-action="toggle-play"]');
    if (playBtn) {
        const iconElem = playBtn.querySelector('i');
        const textElem = playBtn.querySelector('span');
        if (iconElem) iconElem.setAttribute('data-lucide', 'play');
        if (textElem) textElem.textContent = 'Play';
        refreshIcons();
    }
}

function setRoutePlaybackSpeed(speed) {
    if (!state.modal) {
        return;
    }

    state.modal.playbackSpeed = speed;
    if (state.modal.isPlaying) {
        startRoutePlayback();
    }
    // No renderModal() needed - speed chip classes are updated directly by handleModalClick
}

function handleExport() {
    const rows = getFilteredRoutes();
    const csv = [
        ["Route ID", "Driver", "Vehicle", "Status", "Shift", "Stops", "Distance", "Date"].join(","),
        ...rows.map((route) =>
            [
                route.id,
                route.driverName,
                route.vehicleId,
                route.status,
                route.shift,
                `${route.completedStops}/${route.totalStops}`,
                route.distanceKm,
                route.date,
            ]
                .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                .join(","),
        ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "routes-export.csv";
    link.click();
    URL.revokeObjectURL(url);
}

async function openDetailsModal(routeId) {
    clearRoutePlaybackTimer();
    
    // Fetch detailed data from backend (includes full stop list)
    let routeData = await RoutesApi.getRouteById(routeId);

    // Fallback to locally cached route if API fails
    if (!routeData) {
        routeData = state.routes.find((r) => r.id === routeId) || null;
    }

    state.modal = {
        routeId,
        routeData,
        tab: "stops",
        type: "details",
        playbackFrame: 1,
        playbackSpeed: 1,
        isPlaying: false,
    };
    renderModal();
    refreshIcons();
}

async function openRouteFromLiveMonitoring() {
    const routeId = sessionStorage.getItem("fleetops-live-selected-route");
    if (!routeId) {
        return;
    }

    sessionStorage.removeItem("fleetops-live-selected-route");
    const route = await RoutesApi.getRouteById(routeId);
    if (route) {
        await openDetailsModal(routeId);
    }
}

function openNewRouteModal() {
    state.modal = { type: "new" };
    renderModal();
    refreshIcons();
}

function closeModal() {
    state.modal = null;
    clearRoutePlaybackTimer();
    renderModal();
}

function getFilteredRoutes() {
    return state.routes.filter((route) => {
        const matchesStatus =
            state.activeStatus === "All" || route.status === state.activeStatus;
        const matchesShift =
            state.shift === "All Shifts" || route.shift === state.shift;
        const matchesDate =
            state.date === "All Dates" || route.date === state.date;
        const term = state.searchTerm;
        const matchesSearch =
            !term ||
            route.id.toLowerCase().includes(term) ||
            route.driverName.toLowerCase().includes(term) ||
            route.vehicleId.toLowerCase().includes(term);

        return matchesStatus && matchesShift && matchesDate && matchesSearch;
    });
}

function paginate(items, page, pageSize) {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
}

function renderStatusBadge(status) {
    return `<span class="route-status-badge route-status-badge--${toKebabCase(status)}">${status}</span>`;
}

function renderShiftBadge(shift) {
    return `<span class="route-shift-badge route-shift-badge--${toKebabCase(shift)}">${shift}</span>`;
}

function getProgressClass(status) {
    if (status === "Completed") {
        return "progress--done";
    }

    if (status === "Active" || status === "In Transit") {
        return "progress--moving";
    }

    return "progress--idle";
}

function toKebabCase(value) {
    return value.toLowerCase().replace(/\s+/g, "-");
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
}

function refreshIcons() {
    createIcons({ icons });
}
