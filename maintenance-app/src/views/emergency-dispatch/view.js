import emergencyDispatchService from "../../services/api/emergency-dispatch.js";
import { createIcons, icons } from "../../../../node_modules/lucide/dist/esm/lucide.mjs";

// State
let selectedIncidentId = null;
let pendingMechanicId = null;
let state = {
    incidents: [],
    mechanics: []
};

window.__refreshIcons = () => createIcons({ icons });

export function mount(root) {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "/login";
        return;
    }

    // Initial fetch
    Promise.all([
        emergencyDispatchService.getIncidents(),
        emergencyDispatchService.getMechanics(0) // 0 or any ID initially if we just want a list
    ]).then(([incidents, mechanics]) => {
        state.incidents = incidents || [];
        state.mechanics = mechanics || [];
        
        if (state.incidents.length > 0) {
            selectedIncidentId = state.incidents[0].id;
        }

        renderIncidents(root);
        renderIncidentDetails(root);
        renderMechanics(root);
        updateBadgeCount(root);
        setupModalListeners(root);
    }).catch(err => {
        console.error("Failed to load emergency dispatch data:", err);
    });
}

export function unmount() {
    selectedIncidentId = null;
    pendingMechanicId = null;
    state = { incidents: [], mechanics: [] };
}

function refreshIcons() {
    window.__refreshIcons?.();
}

function updateBadgeCount(root) {
    const badge = document.getElementById("incident-count-badge");
    if (badge) {
        const count = state.incidents.filter(i => i.status !== 'Dispatched').length;
        badge.textContent = `${count} active incident${count !== 1 ? 's' : ''}`;
    }
}

function renderIncidents(root) {
    const container = document.getElementById("incidents-list");
    if (!container) return;

    container.innerHTML = '';

    if (state.incidents.length === 0) {
        const template = document.getElementById('empty-incidents-template');
        if (template) {
            container.appendChild(template.content.cloneNode(true));
        }
        refreshIcons();
        return;
    }

    const template = document.getElementById('incident-item-template');
    if (!template) return;

    state.incidents.forEach(incident => {
        const clone = template.content.cloneNode(true);
        const item = clone.querySelector('.incident-item');

        item.dataset.id = incident.id;
        if (selectedIncidentId === incident.id) {
            item.classList.add('active');
        }

        clone.querySelector('.incident-id').textContent = incident.id;
        const pill = clone.querySelector('.status-pill');
        pill.textContent = incident.status;
        pill.className = `status-pill ${incident.status.toLowerCase()}`;
        clone.querySelector('.incident-vehicle').textContent = `${incident.vehicle.plate} • ${incident.vehicle.model}`;
        clone.querySelector('.time-ago').textContent = incident.timeAgo;

        item.addEventListener('click', () => {
            selectedIncidentId = incident.id;

            const items = container.querySelectorAll('.incident-item');
            items.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Refresh mechanics when clicking an incident
            emergencyDispatchService.getMechanics(incident.id).then(mechanics => {
                state.mechanics = mechanics || [];
                renderIncidentDetails(root);
                renderMechanics(root);
            }).catch(console.error);
        });

        container.appendChild(clone);
    });

    refreshIcons();
}

function renderIncidentDetails(root) {
    const container = document.getElementById("incident-details-container");
    if (!container) return;

    container.innerHTML = '';

    if (!selectedIncidentId) {
        const template = document.getElementById('empty-incident-details-template');
        if (template) {
            container.appendChild(template.content.cloneNode(true));
        }
        refreshIcons();
        return;
    }

    const incident = state.incidents.find(i => i.id === selectedIncidentId);
    if (!incident) return;

    const template = document.getElementById('incident-details-template');
    if (!template) return;
    
    const clone = template.content.cloneNode(true);

    const detailPill = clone.querySelector('.incident-status');
    detailPill.textContent = incident.status;
    detailPill.className = `status-pill ${incident.status.toLowerCase()} incident-status`;
    clone.querySelector('.driver-name').textContent = incident.driver.name;
    clone.querySelector('.driver-phone').textContent = incident.driver.phone;
    clone.querySelector('.vehicle-plate').textContent = incident.vehicle.plate;
    clone.querySelector('.vehicle-details').textContent = `${incident.vehicle.model} (${incident.vehicle.type})`;
    clone.querySelector('.location-address').textContent = incident.location.address;
    clone.querySelector('.location-gps').textContent = incident.location.gps;
    
    const ts = new Date(incident.timestamp);
    const dateStr = isNaN(ts.getTime()) ? '' : `(${ts.toLocaleString()})`;
    clone.querySelector('.reported-time').textContent = `${incident.timeAgo} ${dateStr}`;
    clone.querySelector('.issue-text').textContent = incident.issue;

    container.appendChild(clone);
    refreshIcons();
}

function renderMechanics(root) {
    const container = document.getElementById("mechanics-list");
    if (!container) return;

    container.innerHTML = '';

    // Check if the currently selected incident is already dispatched
    const selectedIncident = state.incidents.find(i => i.id === selectedIncidentId);
    const isDispatched = selectedIncident?.status === 'Dispatched';
    const assignedMechanicId = selectedIncident?.dispatchedMechanicId ?? null;

    const template = document.getElementById('mechanic-card-template');
    if (!template) return;

    state.mechanics.forEach(mechanic => {
        const clone = template.content.cloneNode(true);

        const avatar = clone.querySelector('.mechanic-avatar');
        avatar.className = `mechanic-avatar ${mechanic.avatarType || 'avatar-1'}`;
        avatar.textContent = mechanic.initials || 'ME';

        clone.querySelector('.mechanic-name').textContent = mechanic.name;

        const statusBadge = clone.querySelector('.mechanic-status');
        statusBadge.className = `badge ${mechanic.status === 'Available' ? 'success' : 'warning'}`;
        statusBadge.textContent = mechanic.status || 'Unknown';

        clone.querySelector('.mechanic-specialty-phone').textContent = `${mechanic.specialty} Specialist • ${mechanic.phone}`;
        clone.querySelector('.mechanic-distance').textContent = mechanic.distance || '0 km';
        clone.querySelector('.mechanic-eta').textContent = mechanic.eta || '0 min';

        const btn = clone.querySelector('.dispatch-btn');

        if (isDispatched) {
            // Remove the dispatch button entirely for all mechanics
            if (btn) btn.remove();

            // Show assignment label under the mechanic who was dispatched
            if (mechanic.id === assignedMechanicId) {
                const label = document.createElement('div');
                label.className = 'mechanic-assigned-label';
                label.innerHTML = `<i data-lucide="check-circle"></i> Dispatched to <strong>${selectedIncidentId}</strong>`;
                clone.querySelector('.mechanic-card').appendChild(label);
            }
        } else {
            if (btn) {
                btn.addEventListener('click', () => {
                    pendingMechanicId = mechanic.id;
                    const modal = document.getElementById('dispatch-modal');
                    if (modal) modal.classList.remove('hidden');
                });
            }
        }

        container.appendChild(clone);
    });

    refreshIcons();
}

function setupModalListeners(root) {
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-dispatch-btn');
    const confirmBtn = document.getElementById('confirm-dispatch-btn');

    const closeModalFn = () => closeModal(root);

    if (closeBtn) closeBtn.addEventListener('click', closeModalFn);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModalFn);
    
    // We only set this listener once
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            if (selectedIncidentId && pendingMechanicId) {
                // Disable button or show loading
                const originalText = confirmBtn.textContent;
                confirmBtn.textContent = 'Dispatching...';
                confirmBtn.disabled = true;

                emergencyDispatchService.dispatchMechanic(selectedIncidentId, pendingMechanicId).then((res) => {
                    if (res && res.success) {
                        const incident = state.incidents.find(i => i.id === selectedIncidentId);
                        if (incident) {
                            incident.status = 'Dispatched';
                            incident.dispatchedMechanicId = pendingMechanicId;
                        }
                    } else {
                        console.error('Dispatch failed', res);
                        // Optional: Show an error message to the user here
                    }
                }).catch(err => {
                    console.error('Dispatch error:', err);
                }).finally(() => {
                    confirmBtn.textContent = originalText;
                    confirmBtn.disabled = false;
                    pendingMechanicId = null;
                    closeModalFn();
                    
                    // Re-render all panels so status pills and mechanic cards update everywhere
                    renderIncidents(root);
                    renderIncidentDetails(root);
                    renderMechanics(root);
                    updateBadgeCount(root);
                });
            }
        });
    }
}

function closeModal(root) {
    const modal = document.getElementById('dispatch-modal');
    if (modal) modal.classList.add('hidden');
}