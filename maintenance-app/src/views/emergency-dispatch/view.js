import emergencyDispatchData from "../../services/storage/emergency-dispatch.js";

// State
let selectedIncidentId = null;
let pendingMechanicId = null;

export function mount(root) {
    if (emergencyDispatchData.incidents && emergencyDispatchData.incidents.length > 0) {
        selectedIncidentId = emergencyDispatchData.incidents[0].id;
    }
    renderIncidents(root);
    renderIncidentDetails(root);
    renderMechanics(root);
    updateBadgeCount(root);
    setupModalListeners(root);
}

export function unmount() {
    selectedIncidentId = null;
}

function refreshIcons() {
    window.__refreshIcons?.();
}


function updateBadgeCount(root) {
    const badge = document.getElementById("incident-count-badge");
    if (badge) {
        const count = emergencyDispatchData.incidents.filter(i => i.status !== 'Dispatched').length;
        badge.textContent = `${count} active incident${count !== 1 ? 's' : ''}`;
    }
}

function renderIncidents(root) {
    const container = document.getElementById("incidents-list");
    if (!container) return;

    container.innerHTML = '';

    if (emergencyDispatchData.incidents.length === 0) {
        const template = document.getElementById('empty-incidents-template');
        container.appendChild(template.content.cloneNode(true));
        refreshIcons();
        return;
    }

    const template = document.getElementById('incident-item-template');

    emergencyDispatchData.incidents.forEach(incident => {
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

            renderIncidentDetails(root);
            renderMechanics(root);
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
        container.appendChild(template.content.cloneNode(true));
        refreshIcons();
        return;
    }

    const incident = emergencyDispatchData.incidents.find(i => i.id === selectedIncidentId);
    if (!incident) return;

    const template = document.getElementById('incident-details-template');
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
    clone.querySelector('.reported-time').textContent = `${incident.timeAgo} (${new Date(incident.timestamp).toLocaleString()})`;
    clone.querySelector('.issue-text').textContent = incident.issue;

    container.appendChild(clone);
    refreshIcons();
}

function renderMechanics(root) {
    const container = document.getElementById("mechanics-list");
    if (!container) return;

    container.innerHTML = '';

    // Check if the currently selected incident is already dispatched
    const selectedIncident = emergencyDispatchData.incidents.find(i => i.id === selectedIncidentId);
    const isDispatched = selectedIncident?.status === 'Dispatched';
    const assignedMechanicId = selectedIncident?.dispatchedMechanicId ?? null;

    const template = document.getElementById('mechanic-card-template');

    emergencyDispatchData.mechanics.forEach(mechanic => {
        const clone = template.content.cloneNode(true);

        const avatar = clone.querySelector('.mechanic-avatar');
        avatar.className = `mechanic-avatar ${mechanic.avatarType}`;
        avatar.textContent = mechanic.initials;

        clone.querySelector('.mechanic-name').textContent = mechanic.name;

        const statusBadge = clone.querySelector('.mechanic-status');
        statusBadge.className = `badge ${mechanic.status === 'Available' ? 'success' : 'warning'}`;
        statusBadge.textContent = mechanic.status;

        clone.querySelector('.mechanic-specialty-phone').textContent = `${mechanic.specialty} Specialist • ${mechanic.phone}`;
        clone.querySelector('.mechanic-distance').textContent = mechanic.distance;
        clone.querySelector('.mechanic-eta').textContent = mechanic.eta;

        const btn = clone.querySelector('.dispatch-btn');

        if (isDispatched) {
            // Remove the dispatch button entirely for all mechanics
            btn.remove();

            // Show assignment label under the mechanic who was dispatched
            if (mechanic.id === assignedMechanicId) {
                const label = document.createElement('div');
                label.className = 'mechanic-assigned-label';
                label.innerHTML = `<i data-lucide="check-circle"></i> Dispatched to <strong>${selectedIncidentId}</strong>`;
                clone.querySelector('.mechanic-card').appendChild(label);
            }
        } else {
            btn.addEventListener('click', () => {
                pendingMechanicId = mechanic.id;
                const modal = document.getElementById('dispatch-modal');
                if (modal) modal.classList.remove('hidden');
            });
        }

        container.appendChild(clone);
    });

    refreshIcons();
}

function setupModalListeners(root) {
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-dispatch-btn');
    const confirmBtn = document.getElementById('confirm-dispatch-btn');

    if (closeBtn) closeBtn.addEventListener('click', () => closeModal(root));
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal(root));
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
        // Mark the currently selected incident as Dispatched and record the mechanic
        if (selectedIncidentId) {
            const incident = emergencyDispatchData.incidents.find(i => i.id === selectedIncidentId);
            if (incident) {
                incident.status = 'Dispatched';
                incident.dispatchedMechanicId = pendingMechanicId;
            }
        }
        pendingMechanicId = null;
        closeModal(root);
        // Re-render all panels so status pills and mechanic cards update everywhere
        renderIncidents(root);
        renderIncidentDetails(root);
        renderMechanics(root);
        updateBadgeCount(root);
    });
}

function closeModal(root) {
    const modal = document.getElementById('dispatch-modal');
    if (modal) modal.classList.add('hidden');
}