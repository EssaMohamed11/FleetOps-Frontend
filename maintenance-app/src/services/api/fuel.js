import { FUEL_STORAGE_KEY, fuelMockData } from "../storage/fuel.js";

const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

function cloneFuelState(fuelState) {
    return JSON.parse(JSON.stringify(fuelState));
}

function writeFuelState(fuelState) {
    const clonedState = cloneFuelState(fuelState);
    localStorage.setItem(FUEL_STORAGE_KEY, JSON.stringify(clonedState));
    return clonedState;
}

function readFuelState() {
    const storedFuelState = localStorage.getItem(FUEL_STORAGE_KEY);

    if (!storedFuelState) {
        return writeFuelState(fuelMockData);
    }

    try {
        return JSON.parse(storedFuelState);
    } catch {
        return writeFuelState(fuelMockData);
    }
}

function getNextInvoiceId(invoices) {
    const year = new Date().getFullYear();
    const maxId = invoices.reduce((max, invoice) => {
        const match = /^INV-\d{4}-(\d+)$/.exec(invoice.id || "");
        return match ? Math.max(max, Number(match[1])) : max;
    }, 0);

    return `INV-${year}-${String(maxId + 1).padStart(3, "0")}`;
}

function getPeriodFromDate(fillDate) {
    return String(fillDate || "").slice(0, 7);
}

function average(values) {
    if (!values.length) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getVehicleBenchmark(records, vehiclePlate) {
    const vehicleRecords = records.filter(
        (record) => record.vehiclePlate === vehiclePlate && record.avgEfficiencyKmL > 0,
    );

    if (!vehicleRecords.length) {
        return 8.5;
    }

    return average(vehicleRecords.map((record) => record.avgEfficiencyKmL));
}

function findPreviousInvoice(invoices, vehiclePlate, fillDate) {
    const timestamp = new Date(fillDate).getTime();

    return [...invoices]
        .filter(
            (invoice) =>
                invoice.vehiclePlate === vehiclePlate &&
                new Date(invoice.fillDate).getTime() < timestamp,
        )
        .sort((left, right) => new Date(right.fillDate) - new Date(left.fillDate))[0] || null;
}

function upsertMonthlyRecord(state, invoice) {
    const period = getPeriodFromDate(invoice.fillDate);
    const recordIndex = state.records.findIndex(
        (record) =>
            record.vehiclePlate === invoice.vehiclePlate && record.period === period,
    );

    if (recordIndex !== -1) {
        const record = state.records[recordIndex];
        const nextActualFuel = Number(
            (record.actualFuelLiters + invoice.litersFilled).toFixed(1),
        );
        const nextEfficiency =
            nextActualFuel > 0
                ? Number((record.gpsDistanceKm / nextActualFuel).toFixed(1))
                : record.avgEfficiencyKmL;

        state.records[recordIndex] = {
            ...record,
            actualFuelLiters: nextActualFuel,
            avgEfficiencyKmL: nextEfficiency,
        };
        return state.records[recordIndex];
    }

    const previousInvoice = findPreviousInvoice(
        state.invoices,
        invoice.vehiclePlate,
        invoice.fillDate,
    );
    const benchmark = getVehicleBenchmark(state.records, invoice.vehiclePlate);
    const distance =
        previousInvoice && invoice.odometerKm > previousInvoice.odometerKm
            ? invoice.odometerKm - previousInvoice.odometerKm
            : 0;
    const expectedFuel =
        distance > 0 ? Number((distance / benchmark).toFixed(1)) : invoice.litersFilled;

    const newRecord = {
        vehiclePlate: invoice.vehiclePlate,
        vehicleType: invoice.vehicleType || "Unknown",
        period,
        gpsDistanceKm: distance,
        expectedFuelLiters: expectedFuel,
        actualFuelLiters: invoice.litersFilled,
        avgEfficiencyKmL:
            distance > 0
                ? Number((distance / invoice.litersFilled).toFixed(1))
                : Number(benchmark.toFixed(1)),
    };

    state.records.push(newRecord);
    return newRecord;
}

export async function getFuelState() {
    await delay(100);
    return readFuelState();
}

export async function getFuelRecords() {
    await delay(100);
    return readFuelState().records;
}

export async function getFuelInvoices() {
    await delay(100);
    return readFuelState().invoices;
}

export async function replaceFuelState(nextState) {
    await delay(100);
    return writeFuelState(nextState);
}

export async function createFuelInvoice(invoiceData) {
    await delay(100);
    const state = readFuelState();
    const normalizedInvoice = {
        ...invoiceData,
        id: invoiceData.id || getNextInvoiceId(state.invoices),
        litersFilled: Number(invoiceData.litersFilled),
        totalCostEgp: Number(invoiceData.totalCostEgp),
        odometerKm: Number(invoiceData.odometerKm),
        supplier: invoiceData.supplier || "Direct Entry",
        period: getPeriodFromDate(invoiceData.fillDate),
    };

    const updatedRecord = upsertMonthlyRecord(state, normalizedInvoice);
    state.invoices.unshift(normalizedInvoice);
    writeFuelState(state);

    return {
        invoice: normalizedInvoice,
        record: updatedRecord,
    };
}

export async function resetFuelState() {
    await delay(100);
    return writeFuelState(fuelMockData);
}

const FuelApi = {
    getFuelState,
    getFuelRecords,
    getFuelInvoices,
    replaceFuelState,
    createFuelInvoice,
    resetFuelState,
};

export default FuelApi;
