import WorkOrdersApi from "../../../services/api/work-orders.js";

// ─── State ───────────────────────────────────────────────────────────────────
let attachedFiles = [];
let cleanupFns = [];

// ─── Populate vehicle select ─────────────────────────────────────────────────
// ─── Populate vehicle select ─────────────────────────────────────────────────
function populateVehicles() {
    const sel = document.getElementById("cwo-vehicle");
    if (!sel) return;
    const vehicles = WorkOrdersApi.getVehicles();
    vehicles.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.plate;
        opt.textContent = `${v.plate} — ${v.category} — ${v.model} (${v.status})`;
        sel.appendChild(opt);
    });
    // Pre-select vehicle if passed via query string (e.g. from CTV details page)
    const preselect = new URLSearchParams(window.location.search).get("vehicle");
    if (preselect) sel.value = preselect;
}

// ─── Maintenance type card toggle ─────────────────────────────────────────────
function initTypeCards() {
    const cards = document.querySelectorAll(".cwo-type-card");
    cards.forEach(card => {
        const onClick = () => {
            cards.forEach(c => c.classList.remove("cwo-type-card--active"));
            card.classList.add("cwo-type-card--active");
        };
        card.addEventListener("click", onClick);
        cleanupFns.push(() => card.removeEventListener("click", onClick));
    });
}

// ─── Priority pill toggle ────────────────────────────────────────────────────
function initPriorityPills() {
    const pills = document.querySelectorAll(".cwo-priority-pill");
    pills.forEach(pill => {
        const onClick = () => {
            pills.forEach(p => p.classList.remove("cwo-priority-pill--active"));
            pill.classList.add("cwo-priority-pill--active");
        };
        pill.addEventListener("click", onClick);
        cleanupFns.push(() => pill.removeEventListener("click", onClick));
    });
}

// ─── Dropzone / file upload ──────────────────────────────────────────────────
function initDropzone() {
    const zone      = document.getElementById("cwo-dropzone");
    const fileInput = document.getElementById("cwo-file-input");
    const fileList  = document.getElementById("cwo-file-list");
    if (!zone || !fileInput || !fileList) return;

    // Drag-over highlight
    const onDragOver = e => {
        e.preventDefault();
        zone.classList.add("cwo-dropzone--dragover");
    };
    const onDragLeave = () => zone.classList.remove("cwo-dropzone--dragover");
    const onDrop = e => {
        e.preventDefault();
        zone.classList.remove("cwo-dropzone--dragover");
        addFiles([...e.dataTransfer.files]);
    };
    zone.addEventListener("dragover", onDragOver);
    zone.addEventListener("dragleave", onDragLeave);
    zone.addEventListener("drop", onDrop);
    cleanupFns.push(() => {
        zone.removeEventListener("dragover", onDragOver);
        zone.removeEventListener("dragleave", onDragLeave);
        zone.removeEventListener("drop", onDrop);
    });

    const onChange = () => {
        addFiles([...fileInput.files]);
        fileInput.value = ""; // reset so same file can be re-added
    };
    fileInput.addEventListener("change", onChange);
    cleanupFns.push(() => fileInput.removeEventListener("change", onChange));

    function addFiles(incoming) {
        const MAX = 10 * 1024 * 1024; // 10 MB
        incoming.forEach(f => {
            if (f.size > MAX) return; // silently skip oversized
            if (attachedFiles.some(a => a.name === f.name && a.size === f.size)) return; // dedup
            attachedFiles.push(f);
        });
        renderFileList(fileList);
    }
}

let fileListCleanup = [];
function renderFileList(container) {
    container.innerHTML = attachedFiles.map((f, idx) => `
        <div class="cwo-file-item">
            <span class="cwo-file-item__name" title="${f.name}">${f.name}</span>
            <span style="color:var(--color-text-muted);font-size:11px">${(f.size / 1024).toFixed(0)} KB</span>
            <button class="cwo-file-item__remove" type="button" data-idx="${idx}" title="Remove">✕</button>
        </div>
    `).join("");

    fileListCleanup.forEach(fn => fn());
    fileListCleanup = [];

    container.querySelectorAll(".cwo-file-item__remove").forEach(btn => {
        const onClick = () => {
            attachedFiles.splice(parseInt(btn.dataset.idx, 10), 1);
            renderFileList(container);
        };
        btn.addEventListener("click", onClick);
        fileListCleanup.push(() => btn.removeEventListener("click", onClick));
    });
}

// ─── Validation ──────────────────────────────────────────────────────────────
function validateForm(form) {
    let valid = true;
    let firstInvalid = null;

    const vehicle   = form.querySelector("#cwo-vehicle");
    const desc      = form.querySelector("#cwo-description");
    const vErr      = form.querySelector("#cwo-vehicle-error");
    const dErr      = form.querySelector("#cwo-description-error");

    // Reset
    [vehicle, desc].forEach(el => el.classList.remove("cwo-input--error",
                                                        "cwo-select--error",
                                                        "cwo-textarea--error"));
    if (vErr) vErr.textContent = "";
    if (dErr) dErr.textContent = "";

    // Vehicle
    if (!vehicle.value) {
        vehicle.classList.add("cwo-select--error");
        if (vErr) vErr.textContent = "Please select a vehicle.";
        valid = false;
        if (!firstInvalid) firstInvalid = vehicle;
    }

    // Description
    if (!desc.value.trim()) {
        desc.classList.add("cwo-textarea--error");
        if (dErr) dErr.textContent = "Description is required";
        valid = false;
        if (!firstInvalid) firstInvalid = desc;
    }

    if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return valid;
}

// ─── Collect form data ───────────────────────────────────────────────────────
function collectFormData(form) {
    const activeType     = form.querySelector(".cwo-type-card--active input[type='radio']");
    const activePriority = form.querySelector(".cwo-priority-pill--active input[type='radio']");
    return {
        vehicle:     form.querySelector("#cwo-vehicle").value,
        type:        activeType     ? activeType.value     : "Routine",
        description: form.querySelector("#cwo-description").value.trim(),
        priority:    activePriority ? activePriority.value : "Normal",
        startDate:   form.querySelector("#cwo-start-date").value,
        mechanic:    form.querySelector("#cwo-mechanic").value,
        files:       attachedFiles.map(f => f.name),
    };
}

// ─── Submit handler ──────────────────────────────────────────────────────────
function initSubmit(form) {
    const onSubmit = e => {
        e.preventDefault();
        if (!validateForm(form)) return;

        const data = collectFormData(form);

        try {
            WorkOrdersApi.createOrder(data);
            navigate("/work-orders");
        } catch (err) {
            alert("Failed to create work order. Please try again.");
        }
    };
    form.addEventListener("submit", onSubmit);
    cleanupFns.push(() => form.removeEventListener("submit", onSubmit));
}

// ─── SPA Navigation helper ───────────────────────────────────────────────────
function navigate(path) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
}

// ─── Mount / Unmount ─────────────────────────────────────────────────────────
export function mount() {
    cleanupFns = [];
    fileListCleanup = [];
    attachedFiles = []; // reset on each mount
    
    populateVehicles();
    initTypeCards();
    initPriorityPills();
    initDropzone();
    
    const form = document.getElementById("cwo-form");
    if (form) initSubmit(form);

    // Cancel button — works even if data-link isn't picked up
    const cancelBtn = document.querySelector("[data-cancel-nav]");
    if (cancelBtn) {
        const onCancel = e => {
            e.preventDefault();
            navigate("/work-orders");
        };
        cancelBtn.addEventListener("click", onCancel);
        cleanupFns.push(() => cancelBtn.removeEventListener("click", onCancel));
    }
}

export function unmount() {
    cleanupFns.forEach(fn => fn && fn());
    cleanupFns = [];
    
    fileListCleanup.forEach(fn => fn && fn());
    fileListCleanup = [];

    attachedFiles = [];
}
