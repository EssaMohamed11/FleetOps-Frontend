/**
 * Route Planning Page - Main Controller
 */

import RoutePlanningAPI from "../../services/api/route-planning.js";
import { routePlanningState } from "./utils/state-manager.js";
import { renderStep1 } from "./steps/step1-select-orders.js";
import { renderStep2 } from "./steps/step2-priority.js";
import { renderStep3 } from "./steps/step3-clustering.js";
import { renderStep4 } from "./steps/step4-vehicles.js";
import { renderStep5 } from "./steps/step5-capacity.js";
import { renderStep6 } from "./steps/step6-sequence.js";
import { renderStep7 } from "./steps/step7-eta.js";
import { renderStep8 } from "./steps/step8-drivers.js";
import { renderStep9 } from "./steps/step9-push.js";
import { renderStepper } from "./components/stepper.js";
import { renderEmergencyModal } from "./components/emergency-modal.js";
import { createIcons, icons } from "/node_modules/lucide/dist/esm/lucide.mjs";

// ============================================================================
// CONSTANTS
// ============================================================================

const STEPS = [
    { num: 1, label: "Select Orders", icon: "package", render: renderStep1 },
    { num: 2, label: "Priority Balancer", icon: "zap", render: renderStep2 },
    { num: 3, label: "Geo Clustering", icon: "map-pin", render: renderStep3 },
    { num: 4, label: "Assign Vehicles", icon: "truck", render: renderStep4 },
    {
        num: 5,
        label: "Capacity Check",
        icon: "alert-triangle",
        render: renderStep5,
    },
    {
        num: 6,
        label: "Sequence Optimizer",
        icon: "rotate-ccw",
        render: renderStep6,
    },
    { num: 7, label: "ETA Estimator", icon: "clock", render: renderStep7 },
    { num: 8, label: "Assign Drivers", icon: "user", render: renderStep8 },
    { num: 9, label: "Push Routes", icon: "check-circle", render: renderStep9 },
];

const PAGE_SIZE = 25;

// ============================================================================
// GLOBAL REFERENCES
// ============================================================================

let rootElement = null;
let unsubscribe = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function mount(root) {
    rootElement = root;

    // Load initial data
    await loadInitialData();

    // Render stepper
    renderStepper(STEPS);

    // Render current step
    renderCurrentStep();

    // Setup event listeners
    setupEventListeners();

    // Subscribe to state changes
    unsubscribe = routePlanningState.subscribe(handleStateChange);
}

export function unmount() {
    // Cleanup
    if (unsubscribe) {
        unsubscribe();
    }

    // Remove event listeners
    removeEventListeners();

    // Reset state
    routePlanningState.reset({
        currentStep: 1,
        stepComplete: {},
        orders: [],
        searchTerm: "",
        filterArea: "All",
        filterType: "all",
        currentPage: 0,
        showFilters: false,
        prioritizedOrders: [],
        isProcessing: false,
        clusters: [],
        routeConfigs: {},
        activeClusterIndex: 0,
        routeStartDateTime: getDefaultRouteStartDateTime(),
    });
}

function getDefaultRouteStartDateTime() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");

    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadInitialData() {
    try {
        const [orders, vehicles, drivers] = await Promise.all([
            RoutePlanningAPI.getOrders(),
            RoutePlanningAPI.getVehicles(),
            RoutePlanningAPI.getDrivers(),
        ]);

        // Extract areas from orders (no extra API call)
        const areas = await RoutePlanningAPI.getAreas(orders);

        routePlanningState.setState({
            orders,
            areas,
            vehicles,
            drivers,
        });
    } catch (error) {
        console.error("Failed to load initial data:", error);
    }
}

// ============================================================================
// RENDERING
// ============================================================================

function renderCurrentStep() {
    const state = routePlanningState.getState();
    const currentStep = state.currentStep;
    const step = STEPS.find((s) => s.num === currentStep);

    if (!step) {
        console.error("Invalid step:", currentStep);
        return;
    }

    const contentContainer = document.getElementById("step-content");
    if (!contentContainer) return;

    // Clear previous content
    contentContainer.innerHTML = "";

    // Render step
    step.render(contentContainer);

    // Initialize Lucide icons
    setTimeout(() => {
        createIcons({ icons });
    }, 0);

    // Update navigation
    updateNavigation();

    // Update step indicator
    const stepNumElement = document.getElementById("current-step-num");
    if (stepNumElement) {
        stepNumElement.textContent = currentStep;
    }
}

function updateNavigation() {
    const state = routePlanningState.getState();
    const currentStep = state.currentStep;

    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");

    if (prevBtn) {
        prevBtn.disabled = currentStep === 1;
    }

    if (nextBtn) {
        if (currentStep === 9) {
            nextBtn.style.display = "none";
        } else {
            nextBtn.style.display = "";
            nextBtn.disabled = !canProceed();
        }
    }
}

function canProceed() {
    const state = routePlanningState.getState();
    const currentStep = state.currentStep;

    switch (currentStep) {
        case 1:
            return state.orders.some((o) => o.selected);
        case 2:
            return state.prioritizedOrders.some(
                (order) => order.step2Selected !== false,
            );
        case 3:
            return (
                state.clusters.length > 0 &&
                state.clusters.every((c) => c.orders.length > 0)
            );
        case 4:
            return state.clusters.every((c) => {
                const rc = state.routeConfigs[c.zone];
                return rc && rc.vehicle;
            });
        case 5:
            return state.clusters.every((c) => {
                const rc = state.routeConfigs[c.zone];
                return rc && rc.capacityResult && rc.capacityResult.ok;
            });
        case 8:
            return state.clusters.every((c) => {
                const rc = state.routeConfigs[c.zone];
                return rc && rc.driver;
            });
        default:
            return true;
    }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function setupEventListeners() {
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const emergencyBtn = document.getElementById("emergency-insert-btn");
    const modalClose = document.getElementById("emergency-modal-close");
    const modal = document.getElementById("emergency-modal");

    if (prevBtn) {
        prevBtn.addEventListener("click", handlePrevious);
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", handleNext);
    }

    if (emergencyBtn) {
        emergencyBtn.addEventListener("click", handleEmergencyInsert);
    }

    if (modalClose) {
        modalClose.addEventListener("click", handleCloseModal);
    }

    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                handleCloseModal();
            }
        });
    }
}

function removeEventListeners() {
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const emergencyBtn = document.getElementById("emergency-insert-btn");
    const modalClose = document.getElementById("emergency-modal-close");

    if (prevBtn) {
        prevBtn.removeEventListener("click", handlePrevious);
    }

    if (nextBtn) {
        nextBtn.removeEventListener("click", handleNext);
    }

    if (emergencyBtn) {
        emergencyBtn.removeEventListener("click", handleEmergencyInsert);
    }

    if (modalClose) {
        modalClose.removeEventListener("click", handleCloseModal);
    }
}

function handlePrevious() {
    const state = routePlanningState.getState();
    if (state.currentStep > 1) {
        routePlanningState.setState({ currentStep: state.currentStep - 1 });
    }
}

function handleNext() {
    const state = routePlanningState.getState();
    if (state.currentStep < 9 && canProceed()) {
        routePlanningState.setState({ currentStep: state.currentStep + 1 });
    }
}

function handleEmergencyInsert() {
    const modal = document.getElementById("emergency-modal");
    const modalBody = document.getElementById("emergency-modal-body");

    if (modal && modalBody) {
        renderEmergencyModal(modalBody);
        modal.style.display = "flex";
    }
}

function handleCloseModal() {
    const modal = document.getElementById("emergency-modal");
    if (modal) {
        modal.style.display = "none";
    }
}

function handleStateChange(state) {
    const prevStep = routePlanningState.get("_prevStep") || 1;
    const prevStepComplete = routePlanningState.get("_prevStepComplete") || {};

    const stepChanged = prevStep !== state.currentStep;
    const stepCompleteChanged =
        JSON.stringify(prevStepComplete) !== JSON.stringify(state.stepComplete);

    routePlanningState.state._prevStep = state.currentStep;
    routePlanningState.state._prevStepComplete = { ...state.stepComplete };

    if (stepChanged || stepCompleteChanged) {
        // Re-render and refresh stepper only when visual step state changes.
        renderCurrentStep();
        renderStepper(STEPS);
        setTimeout(() => {
            createIcons({ icons });
        }, 0);
        return;
    }

    // Step 1 has its own scoped subscription-based re-render flow.
    // Skip full page re-render here to avoid duplicate async renders.
    if (state.currentStep === 1) {
        updateNavigation();
        return;
    }

    // Other steps rely on state mutations for immediate UI updates.
    renderCurrentStep();
}

// ============================================================================
// EXPORTS
// ============================================================================

export { STEPS, PAGE_SIZE };
