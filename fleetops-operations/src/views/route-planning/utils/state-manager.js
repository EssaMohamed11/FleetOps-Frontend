/**
 * State Manager for Route Planning
 *
 * Simple state management system for handling complex state without React
 */

class StateManager {
    constructor(initialState = {}) {
        this.state = { ...initialState };
        this.listeners = [];
    }

    /**
     * Get current state
     * @returns {Object} Current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Get specific state value
     * @param {string} key - State key
     * @returns {*} State value
     */
    get(key) {
        return this.state[key];
    }

    /**
     * Set state and notify listeners
     * @param {Object|Function} updates - State updates or updater function
     */
    setState(updates) {
        const prevState = { ...this.state };
        const newState =
            typeof updates === "function" ? updates(this.state) : updates;

        this.state = { ...this.state, ...newState };
        this.notify(prevState);
        console.log(this.state);
    }

    /**
     * Subscribe to state changes
     * @param {Function} listener - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.push(listener);

        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    /**
     * Notify all listeners of state change
     * @param {Object} prevState - Previous state before update
     */
    notify(prevState = {}) {
        this.listeners.forEach((listener) => listener(this.state, prevState));
    }

    /**
     * Reset state to initial values
     * @param {Object} initialState - New initial state
     */
    reset(initialState = {}) {
        this.state = { ...initialState };
        this.notify();
    }
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
    // Current step (1-9)
    currentStep: 1,

    // Step completion status
    stepComplete: {},

    // Step 1: Select Orders
    orders: [],
    areas: [],
    vehicles: [],
    drivers: [],
    searchTerm: "",
    filterArea: "All",
    filterType: "all",
    currentPage: 0,
    showFilters: false,

    // Step 2: Priority Balancer
    prioritizedOrders: [],
    isProcessing: false,
    manualEditMode2: false,
    editPriorityId: null,
    editPriorityValue: "",

    // Step 3: Geo Clustering
    clusters: [],
    editingCluster: null,
    moveOrderId: null,
    moveFromCluster: null,
    newClusterName: "",
    showNewClusterModal: false,
    clusterSearchTerm: "",

    // Steps 4-9: Route Configs (per cluster)
    routeConfigs: {},
    activeClusterIndex: 0,

    // Step 6: Manual Edit
    manualEditMode6: false,
    routeStartDateTime: getDefaultRouteStartDateTime(),

    // Emergency Insert
    showEmergencyInsert: false,
    emergencyOrder: {
        customer: "",
        address: "",
        phone: "",
        weight: "",
        volume: "",
        window: "",
        notes: "",
    },
    emergencyTargetCluster: "",
    emergencyInsertPosition: "optimal",
    emergencyInserted: false,
};

// ============================================================================
// CREATE GLOBAL STATE INSTANCE
// ============================================================================

const routePlanningState = new StateManager(initialState);

function getDefaultRouteStartDateTime() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");

    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { StateManager, routePlanningState, initialState };
