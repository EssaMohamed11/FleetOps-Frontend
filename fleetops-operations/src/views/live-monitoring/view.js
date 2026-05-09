import LiveMonitoringApi from "../../services/api/live-monitoring.js";
import { createIcons, icons } from "/node_modules/lucide/dist/esm/lucide.mjs";

// ─── Leaflet ───────────────────────────────────────────────────────────────

const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL  = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
let leafletLoadPromise = null;
let liveMapInstance    = null;
let liveMarkers        = [];   // Leaflet marker instances (cleared on update)
let livePolylines      = [];   // Leaflet overlay instances (cleared on update)
const routeGeometryCache = new Map();

// ─── Module State ──────────────────────────────────────────────────────────

let cleanupFns = [];
let playbackTimer = null;
let state = null;
let _mounted = false; // Guard for deferred callbacks (setTimeout, async continuations)

let handleDatePickerTrigger = null;

// ─── Status colours (used by Leaflet markers) ──────────────────────────────

const STATUS_COLOR = {
    "On-time":  "#10b981",
    "At-risk":  "#f59e0b",
    "Delayed":  "#f97316",
    "Breakdown":"#ef4444",
};

function getStatusColor(status) {
    return STATUS_COLOR[status] ?? "#14b8a6";
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

export async function mount() {
    _mounted = true;
    const defaultDate   = LiveMonitoringApi.getDefaultDate();
    // Show mock data immediately (instant render)
    const mockSnapshot  = LiveMonitoringApi.getSnapshot(defaultDate);
    const firstVehicleId = mockSnapshot.operations[0]?.id ?? null;

    state = {
        activeDate:        defaultDate,
        activeStatus:      "All",
        searchTerm:        "",
        selectedVehicleId: firstVehicleId,
        shift:             "All Shifts",
        snapshot:          mockSnapshot,
        playback: { frame: 100, isPlaying: false, speed: 1 },
    };

    bindEvents();
    renderPage();

    // Now fetch real data in background and re-render if it arrives
    const liveSnapshot = await LiveMonitoringApi.getSnapshotAsync(defaultDate);
    if (_mounted && state && liveSnapshot) {
        state.snapshot          = liveSnapshot;
        state.selectedVehicleId = liveSnapshot.operations[0]?.id ?? null;
        renderPage();
    }
}

export function unmount() {
    _mounted = false; // Cancel all deferred callbacks
    destroyMap();
    cleanupFns.forEach((fn) => fn?.());
    cleanupFns = [];
    state = null;
}

// ─── Events ────────────────────────────────────────────────────────────────

function bindEvents() {
    cleanupFns = [];

    const filters        = document.getElementById("live-monitoring-filters");
    const searchInput    = document.getElementById("live-monitoring-search-input");
    const shiftSelect    = document.getElementById("live-monitoring-shift-select");
    const shortcuts      = document.getElementById("live-monitoring-date-shortcuts");
    const dateInput      = document.getElementById("live-monitoring-date-input");
    const dateTrigger    = document.getElementById("live-monitoring-date-picker-trigger");
    const viewRoutesBtn  = document.getElementById("live-monitoring-view-routes-btn");

    handleDatePickerTrigger = () => dateInput?.showPicker?.();

    filters?.addEventListener("click",  handleFilterClick);
    searchInput?.addEventListener("input",  handleSearch);
    shiftSelect?.addEventListener("change", handleShiftChange);
    shortcuts?.addEventListener("click",  handleDateShortcutClick);
    dateInput?.addEventListener("change", handleDateChange);
    dateTrigger?.addEventListener("click",  handleDatePickerTrigger);
    viewRoutesBtn?.addEventListener("click", handleViewRoutesClick);

    cleanupFns.push(
        () => filters?.removeEventListener("click",  handleFilterClick),
        () => searchInput?.removeEventListener("input",  handleSearch),
        () => shiftSelect?.removeEventListener("change", handleShiftChange),
        () => shortcuts?.removeEventListener("click",  handleDateShortcutClick),
        () => dateInput?.removeEventListener("change", handleDateChange),
        () => dateTrigger?.removeEventListener("click",  handleDatePickerTrigger),
        () => viewRoutesBtn?.removeEventListener("click", handleViewRoutesClick),
    );
}

// ─── Render ────────────────────────────────────────────────────────────────

function renderPage() {
    renderFilters();
    renderToolbarControls();
    renderOverview();
    renderMap();
    renderSidebar();
    renderAlerts();
    refreshIcons();
}

function renderFilters() {
    const filters = document.getElementById("live-monitoring-filters");
    if (!filters) return;

    filters.innerHTML = LiveMonitoringApi.getStatusOptions()
        .map((status) => `
            <button
                class="live-filter-chip ${state.activeStatus === status ? "is-active" : ""}"
                type="button"
                data-status="${status}">
                ${status}
            </button>
        `)
        .join("");
}

function renderToolbarControls() {
    const shiftSelect = document.getElementById("live-monitoring-shift-select");
    const shortcuts   = document.getElementById("live-monitoring-date-shortcuts");
    const dateInput   = document.getElementById("live-monitoring-date-input");

    if (shiftSelect) {
        shiftSelect.innerHTML = LiveMonitoringApi.getShiftOptions()
            .map((o) => `<option value="${o}" ${state.shift === o ? "selected" : ""}>${o}</option>`)
            .join("");
    }

    if (shortcuts) {
        shortcuts.innerHTML = LiveMonitoringApi.getDateOptions()
            .slice(0, 3)
            .map((date) => {
                const label = date === "2026-04-23" ? "Today" : formatDateLabel(date);
                return `
                    <button
                        class="live-date-chip ${state.activeDate === date ? "is-active" : ""}"
                        type="button"
                        data-date-shortcut="${date}">
                        ${label}
                    </button>
                `;
            })
            .join("");
    }

    if (dateInput) {
        dateInput.value = state.activeDate;
        dateInput.min   = LiveMonitoringApi.getDateOptions().at(-1);
        dateInput.max   = LiveMonitoringApi.getDateOptions()[0];
    }

}

function renderOverview() {
    const root = document.getElementById("live-monitoring-overview");
    if (!root) return;

    const { summary } = state.snapshot;
    const visibleCount = getFilteredOperations().length;

    root.innerHTML = [
        renderOverviewCard("Visible Vehicles",   visibleCount,       `${summary.activeTrips} active vehicles reporting GPS`),
        renderOverviewCard("On-Time Fleet",       summary.onTime,    "Healthy routes and confirmed ETA"),
        renderOverviewCard("At-Risk Trips",        summary.atRisk,   "Needs dispatcher attention"),
        renderOverviewCard("Incidents",            summary.incidents, "Breakdowns, delays, or anomalies"),
    ].join("");
}

function renderOverviewCard(label, value, meta) {
    return `
        <article class="live-overview-card">
            <span  class="live-overview-card__label">${label}</span>
            <strong class="live-overview-card__value">${value}</strong>
            <span  class="live-overview-card__meta">${meta}</span>
        </article>
    `;
}

// ─── Map (Leaflet) ─────────────────────────────────────────────────────────────

function renderMap() {
    const root = document.getElementById("live-monitoring-map");
    if (!root) return;

    // ── If the map already exists just refresh markers (no DOM rebuild) ──────
    // This prevents the flickering / "weird things" during playback
    if (liveMapInstance) {
        updateMapOverlayCard();
        updateLeafletMarkers();
        return;
    }

    // ── First render: build DOM + initialise Leaflet ─────────────────────────
    const selected = getSelectedVehicle();

    root.innerHTML = `
        <div class="live-monitoring-map-frame" style="position:relative; height:100%;">
            <div
                id="live-monitoring-leaflet-map"
                style="position:absolute; inset:0; z-index:1; border-radius:inherit;">
            </div>
            <article class="map-overlay-card" id="live-map-overlay-card" style="z-index:2; position:absolute;">
                <strong>${formatDateLong(state.activeDate)}</strong>
                <span>${selected ? `${selected.id} current position selected` : "Select any vehicle on the map"}</span>
                <span>Showing latest GPS ping for each active vehicle</span>
            </article>
        </div>
    `;

    setTimeout(() => { if (_mounted) initLeafletMap(); }, 0);
}

/** Update only the text in the overlay card (no map rebuild). */
function updateMapOverlayCard() {
    const card    = document.getElementById("live-map-overlay-card");
    const selected = getSelectedVehicle();
    if (!card) return;
    card.innerHTML = `
        <strong>${formatDateLong(state.activeDate)}</strong>
        <span>${selected ? `${selected.id} current position selected` : "Select any vehicle on the map"}</span>
        <span>Showing latest GPS ping for each active vehicle</span>
    `;
}

async function initLeafletMap() {
    const mapEl = document.getElementById("live-monitoring-leaflet-map");
    if (!mapEl) return;

    try {
        await loadLeafletAssets();
    } catch (err) {
        console.error("[LiveMonitoring] Failed to load Leaflet:", err);
        if (mapEl) mapEl.innerHTML = `<div style="color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100%;font-size:0.75rem;">Map failed to load — check internet connection.</div>`;
        return;
    }

    const L = window.L;
    if (!L) return;

    // Create map centred on Greater Cairo
    liveMapInstance = L.map(mapEl, {
        center:       [29.97, 31.25],
        zoom:         11,
        zoomControl:  true,
        preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom:     19,
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(liveMapInstance);

    // Draw all markers + selected vehicle's trail
    const bounds = addMarkersAndTrail(L);

    if (bounds.length === 1) {
        liveMapInstance.setView(bounds[0], 13);
    } else if (bounds.length > 1) {
        liveMapInstance.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
    }

    setTimeout(() => {
        try { liveMapInstance.invalidateSize(); } catch {}
    }, 200);

}

/**
 * Clear all markers/polylines and redraw them.
 * Called on every playback tick instead of rebuilding the whole map.
 */
function updateLeafletMarkers() {
    if (!liveMapInstance || !window.L) return;

    // Remove previous markers and polylines
    liveMarkers.forEach((m) => { try { m.remove(); } catch {} });
    livePolylines.forEach((p) => { try { p.remove(); } catch {} });
    liveMarkers   = [];
    livePolylines = [];

    addMarkersAndTrail(window.L);
}

/**
 * Fetch real road geometries from OSRM for all vehicles.
 * Caches results and redraws polylines on actual roads once done.
 */
async function loadRoadRoutes() {
    if (!liveMapInstance || !window.L) return;

    const operations = getFilteredOperations();

    await Promise.all(operations.map(async (vehicle) => {
        if (routeGeometryCache.has(vehicle.id)) return; // already cached

        // Playback path is now an array of real lat/lng waypoints
        const waypoints = vehicle.playbackPath;

        try {
            // OSRM expects: lng,lat;lng,lat;...
            const coordStr = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
            const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

            const res  = await fetch(url);
            const json = await res.json();

            if (json.code === "Ok" && json.routes?.[0]) {
                // OSRM returns [lng, lat] — flip to [lat, lng] for Leaflet
                const coords = json.routes[0].geometry.coordinates.map(
                    ([lng, lat]) => [lat, lng]
                );
                routeGeometryCache.set(vehicle.id, coords);
            } else {
                routeGeometryCache.set(vehicle.id, waypoints); // fallback straight
            }
        } catch {
            // Network error or OSRM down — use straight line as fallback
            routeGeometryCache.set(vehicle.id, vehicle.playbackPath);
        }
    }));

    // All routes loaded — redraw with real road geometry
    if (liveMapInstance) updateLeafletMarkers();
}

/**
 * Adds vehicle CircleMarkers + the selected vehicle's route trail to the map.
 * Returns bounds array for fitBounds.
 */
function addMarkersAndTrail(L) {
    const operations = getFilteredOperations();
    const bounds     = [];

    // ── 1. Draw route trail for EVERY vehicle ────────────────────────────────
    const selectedId   = state.selectedVehicleId;
    const frameRatio   = state.playback.frame / 100;   // 0 → 1

    operations.forEach((vehicle) => {
        return;
        const isSelected   = vehicle.id === selectedId;
        const statusColor  = getStatusColor(vehicle.status);

        // Use real road geometry if cached, otherwise fall back to straight line
        const roadPath = routeGeometryCache.get(vehicle.id) ?? vehicle.playbackPath;

        // Full planned path — dashed line (road geometry if cached)
        // Selected: grey dashed  |  Others: very faint dashed
        const fullLine = L.polyline(roadPath, {
            color:     isSelected ? "#94a3b8" : statusColor,
            weight:    isSelected ? 2 : 1,
            opacity:   isSelected ? 0.45 : 0.20,
            dashArray: "5 7",
        }).addTo(liveMapInstance);
        livePolylines.push(fullLine);

        // Travelled portion — animates along the road geometry
        const travelIdx     = Math.max(1, Math.round(frameRatio * (roadPath.length - 1)) + 1);
        const travelledPath = roadPath.slice(0, travelIdx);
        if (travelledPath.length > 1) {
            const travelLine = L.polyline(travelledPath, {
                color:   statusColor,
                weight:  isSelected ? 4 : 2,
                opacity: isSelected ? 0.9 : 0.45,
            }).addTo(liveMapInstance);
            livePolylines.push(travelLine);
        }

        // Start depot marker (green) — use road path start point
        const startMkr = L.circleMarker(roadPath[0], {
            radius:      isSelected ? 9 : 6,
            color:       "#fff",
            weight:      2,
            fillColor:   "#10b981",
            fillOpacity: isSelected ? 1 : 0.6,
        }).bindTooltip(`${vehicle.id} — Depot / Start`, {
            permanent: false, direction: "top", className: "live-map-tooltip",
        }).addTo(liveMapInstance);
        liveMarkers.push(startMkr);

        // End / Final Stop marker (red) — use road path end point
        const endMkr = L.circleMarker(roadPath[roadPath.length - 1], {
            radius:      isSelected ? 9 : 6,
            color:       "#fff",
            weight:      2,
            fillColor:   "#ef4444",
            fillOpacity: isSelected ? 1 : 0.6,
        }).bindTooltip(`${vehicle.id} — Final Stop`, {
            permanent: false, direction: "top", className: "live-map-tooltip",
        }).addTo(liveMapInstance);
        liveMarkers.push(endMkr);
    });

    // ── 2. Draw vehicle markers ──────────────────────────────────────────────
    operations.forEach((vehicle) => {
        let lat = Number(vehicle.lat);
        let lng = Number(vehicle.lng);

        // Always interpolate along road points based on playback frame for smooth movement
        const roadPath = routeGeometryCache.get(vehicle.id) ?? vehicle.playbackPath;

        const ratio      = state.playback.frame / 100;               // 0 → 1
        const exactIdx   = ratio * (roadPath.length - 1);
        const i1         = Math.floor(exactIdx);
        const i2         = Math.min(i1 + 1, roadPath.length - 1);
        const t          = exactIdx - i1;
        const [la1, ln1] = roadPath[i1];
        const [la2, ln2] = roadPath[i2];
        lat = la1 + (la2 - la1) * t;
        lng = ln1 + (ln2 - ln1) * t;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        bounds.push([lat, lng]);

        const isSelected = state.selectedVehicleId === vehicle.id;
        const fillColor  = getStatusColor(vehicle.status);
        const vehicleId  = vehicle.id;

        const marker = L.circleMarker([lat, lng], {
            radius:      isSelected ? 13 : 8,
            color:       isSelected ? fillColor : "#ffffff",
            weight:      isSelected ? 3 : 1.5,
            fillColor,
            fillOpacity: 0.92,
        });

        marker.bindPopup(`
            <div style="font-size:12px;min-width:160px;">
                <p style="margin:0 0 6px 0;font-weight:700;">${vehicleId}</p>
                <p style="margin:0 0 4px 0;">${vehicle.driver} · ${vehicle.plate}</p>
                <p style="margin:0 0 4px 0;color:${fillColor};font-weight:600;">${vehicle.status}</p>
                <p style="margin:0;color:#475569;">${vehicle.speed} km/h · Last update ${vehicle.lastUpdate}</p>
            </div>
        `);

        marker.bindTooltip(vehicleId, {
            permanent: true, direction: "top",
            offset: [0, -12], className: "live-map-tooltip",
        });

        marker.on("click", () => {
            state.selectedVehicleId = vehicleId;
            updateLeafletMarkers();   // update markers in-place (no DOM rebuild)
            renderSidebar();
            refreshIcons();
        });

        marker.addTo(liveMapInstance);
        liveMarkers.push(marker);   // track so updateLeafletMarkers() can remove it
    });

    return bounds;
}


function destroyMap() {
    liveMarkers.forEach((m) => { try { m.remove(); } catch {} });
    livePolylines.forEach((p) => { try { p.remove(); } catch {} });
    liveMarkers   = [];
    livePolylines = [];
    routeGeometryCache.clear(); // clear road cache — new date/data needs fresh routes

    if (liveMapInstance) {
        try { liveMapInstance.remove(); } catch {}
        liveMapInstance = null;
    }
}

function loadLeafletAssets() {
    if (window.L) return Promise.resolve();

    if (!leafletLoadPromise) {
        leafletLoadPromise = new Promise((resolve, reject) => {
            if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
                const link = document.createElement("link");
                link.rel  = "stylesheet";
                link.href = LEAFLET_CSS_URL;
                document.head.appendChild(link);
            }

            const existing = document.querySelector(`script[src="${LEAFLET_JS_URL}"]`);
            if (existing) {
                existing.addEventListener("load",  () => resolve(), { once: true });
                existing.addEventListener("error", () => reject(new Error("Leaflet load failed")), { once: true });
                return;
            }

            const script    = document.createElement("script");
            script.src      = LEAFLET_JS_URL;
            script.async    = true;
            script.onload   = () => resolve();
            script.onerror  = () => reject(new Error("Leaflet load failed"));
            document.head.appendChild(script);
        });
    }

    return leafletLoadPromise;
}

// ─── Sidebar ───────────────────────────────────────────────────────────────

function renderSidebar() {
    const root = document.getElementById("live-monitoring-sidebar");
    if (!root) return;

    const selected = getSelectedVehicle();
    if (!selected) {
        root.innerHTML = `
            <div class="live-sidebar-empty">
                <div>
                    <strong>No operation selected</strong>
                    <p>Pick any truck from the map to inspect its latest GPS position.</p>
                </div>
            </div>
        `;
        return;
    }

    root.innerHTML = `
        <header class="live-sidebar-head">
            <div class="live-sidebar-head__title">
                <strong>${selected.id}</strong>
                <span>${selected.driver} | ${selected.plate}</span>
                <span>${selected.address}</span>
            </div>
            ${renderStatusBadge(selected.status)}
        </header>

        <section class="live-sidebar-grid">
            ${renderMetricCard("Speed",    `${selected.speed} km/h`)}
            ${renderMetricCard("Last Ping", selected.lastUpdate)}
            ${renderMetricCard("Shift",    selected.shift)}
            ${renderMetricCard("Orders",   `${selected.orderCount} drops`)}
            ${renderMetricCard("Progress", `${selected.progress}%`)}
            ${renderMetricCard("Temp",     selected.temperature)}
        </section>

        <section class="live-sidebar-banner">
            <strong>${selected.alert}</strong>
            <span>Destination: ${selected.destination}</span>
            <span>Last update: ${selected.lastUpdate}</span>
        </section>

        <section class="live-sidebar-timeline">
            <div class="live-sidebar-timeline__head">
                <strong>Current Position</strong>
                <span>${formatDateLong(state.activeDate)}</span>
            </div>
            ${selected.timeline
                .map((entry) => `
                    <article class="live-timeline-item">
                        <span class="live-timeline-item__time">${entry.time}</span>
                        <div class="live-timeline-item__content">
                            <strong>${entry.title}</strong>
                            <span>${entry.location}</span>
                        </div>
                    </article>
                `)
                .join("")}
        </section>
    `;
}

function renderMetricCard(label, value) {
    return `
        <article class="live-sidebar-metric">
            <span>${label}</span>
            <strong>${value}</strong>
        </article>
    `;
}

// ─── Alerts ────────────────────────────────────────────────────────────────

function renderAlerts() {
    const root = document.getElementById("live-monitoring-alerts");
    if (!root) return;

    root.innerHTML = state.snapshot.alerts
        .map((alert) => `
            <span class="live-alert-chip live-alert-chip--${alert.tone}">
                <i data-lucide="${getAlertIcon(alert.tone)}"></i>
                <span>${alert.text}</span>
            </span>
        `)
        .join("");
}

// ─── Event Handlers ────────────────────────────────────────────────────────

function handleFilterClick(event) {
    const button = event.target.closest("[data-status]");
    if (!button) return;
    state.activeStatus = button.dataset.status;
    ensureSelectedVehicleVisible();
    renderPage();
}

function handleSearch(event) {
    state.searchTerm = event.target.value.trim().toLowerCase();
    ensureSelectedVehicleVisible();
    renderPage();
}

function handleShiftChange(event) {
    state.shift = event.target.value;
    ensureSelectedVehicleVisible();
    renderPage();
}

function handleDateShortcutClick(event) {
    const button = event.target.closest("[data-date-shortcut]");
    if (!button) return;
    updateDate(button.dataset.dateShortcut);
}

function handleDateChange(event) {
    updateDate(event.target.value);
}

function handleFrameChange(event) {
    state.playback.frame = Number(event.target.value);
    renderMap();
    refreshIcons();
}

function handleViewRoutesClick() {
    const selected = getSelectedVehicle();
    if (selected?.routeId) {
        sessionStorage.setItem("fleetops-live-selected-route", selected.routeId);
    } else {
        sessionStorage.removeItem("fleetops-live-selected-route");
    }
    stopPlayback();
}

function handleSpeedChange(event) {
    state.playback.speed = Number(event.target.value);
    if (state.playback.isPlaying) startPlayback();
}

// ─── Date Update (async — tries real API for today) ────────────────────────

async function updateDate(date) {
    if (!LiveMonitoringApi.getDateOptions().includes(date)) return;

    stopPlayback();

    // Destroy the map first — new date = fresh map with new data
    destroyMap();

    state.activeDate        = date;
    state.playback.frame    = 100;

    // Show mock snapshot immediately while fetching
    const mockSnap = LiveMonitoringApi.getSnapshot(date);
    state.snapshot            = mockSnap;
    state.selectedVehicleId   = mockSnap.operations[0]?.id ?? null;
    ensureSelectedVehicleVisible();
    renderPage();

    // Then fetch real data and re-render if it arrives
    const liveSnap = await LiveMonitoringApi.getSnapshotAsync(date);
    if (state && liveSnap) {
        destroyMap();                                     // destroy again before fresh render
        state.snapshot          = liveSnap;
        state.selectedVehicleId = liveSnap.operations[0]?.id ?? null;
        ensureSelectedVehicleVisible();
        renderPage();
    }
}

// ─── Playback ──────────────────────────────────────────────────────────────

function startPlayback() {
    stopPlayback();
    state.playback.isPlaying = true;

    playbackTimer = window.setInterval(() => {
        const next = state.playback.frame >= 100 ? 0 : state.playback.frame + state.playback.speed * 4;
        state.playback.frame = Math.min(next, 100);
        renderMap();
        renderToolbarControls();
        refreshIcons();
    }, 420);
}

function stopPlayback() {
    state.playback.isPlaying = false;
    if (playbackTimer) {
        window.clearInterval(playbackTimer);
        playbackTimer = null;
    }
}

// ─── Filtering ─────────────────────────────────────────────────────────────

function getFilteredOperations() {
    return state.snapshot.operations.filter((vehicle) => {
        const matchStatus = state.activeStatus === "All" || vehicle.status === state.activeStatus;
        const matchShift  = state.shift === "All Shifts" || vehicle.shift === state.shift;
        const matchSearch =
            !state.searchTerm ||
            vehicle.id.toLowerCase().includes(state.searchTerm) ||
            vehicle.driver.toLowerCase().includes(state.searchTerm) ||
            vehicle.plate.toLowerCase().includes(state.searchTerm);

        return matchStatus && matchShift && matchSearch;
    });
}

function getSelectedVehicle() {
    return getFilteredOperations().find((v) => v.id === state.selectedVehicleId) ?? null;
}

function ensureSelectedVehicleVisible() {
    const visible     = getFilteredOperations();
    const stillThere  = visible.some((v) => v.id === state.selectedVehicleId);
    if (!stillThere) state.selectedVehicleId = visible[0]?.id ?? null;
}

// ─── Playback Path ─────────────────────────────────────────────────────────

function getVehiclePosition(vehicle) {
    const path       = vehicle.playbackPath;
    const scaledFrame= state.playback.frame / 25;
    const index      = Math.min(Math.floor(scaledFrame), path.length - 1);
    const nextIndex  = Math.min(index + 1, path.length - 1);
    const progress   = Math.min(scaledFrame - index, 1);
    const [x1, y1]   = path[index];
    const [x2, y2]   = path[nextIndex];

    return [x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress];
}

// ─── Small Helpers ─────────────────────────────────────────────────────────

function renderStatusBadge(status) {
    return `<span class="live-status-badge live-status-badge--${toKebabCase(status)}">${status}</span>`;
}

function getAlertIcon(tone) {
    if (tone === "success") return "badge-check";
    if (tone === "danger")  return "circle-alert";
    return "triangle-alert";
}

function formatDateLabel(dateString) {
    return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" })
        .format(new Date(`${dateString}T00:00:00`));
}

function formatDateLong(dateString) {
    return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" })
        .format(new Date(`${dateString}T00:00:00`));
}

function toKebabCase(value) {
    return value.toLowerCase().replace(/\s+/g, "-");
}

function refreshIcons() {
    createIcons({ icons });
}
