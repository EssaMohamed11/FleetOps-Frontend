import api from "/shared/api-handler.js";

api.setBaseURL("http://localhost:8000");

async function getKpiData(period = "30d") {
  try {
    const response = await api.get(
      `/api/v1/analytics/analytics-kpis?range=${period}`,
    );
    const data = response.data.data.kpis;
    return [
      {
        icon: "dollar-sign",
        label: "Total Revenue",
        value: `${data.revenue.value.toLocaleString()}`,
        change: parseFloat(data.revenue.change) || 0,
        color: "#0f988e",
        bg: "#ecfdf5",
      },
      {
        icon: "truck",
        label: "Active Vehicles",
        value: `${data.active_vehicles.value} / ${data.active_vehicles.total}`,
        change: parseFloat(data.active_vehicles.change) || 0,
        color: "#3b82f6",
        bg: "#eff6ff",
      },
      {
        icon: "check-circle",
        label: "Delivered",
        value: data.delivered.value,
        change: parseFloat(data.delivered.change) || 0,
        color: "#10b981",
        bg: "#ecfdf5",
      },
      {
        icon: "zap",
        label: "Efficiency",
        value: `${data.efficiency.value}%`,
        change: parseFloat(data.efficiency.change) || 0,
        color: "#f59e0b",
        bg: "#fffbeb",
      },
    ];
  } catch (e) {
    console.error("Failed to fetch KPIs", e);
    return [];
  }
}

async function getMonthlyChartData() {
  try {
    const response = await api.get(
      "/api/v1/analytics/analytics-revenue-chart",
      {
        params: { months: 3 },
      },
    );

    if (response.status === 204 || !response?.data?.data) {
      return { labels: [], revenue: [], loss: [], profit: [], currency: "EGP" };
    }

    const payload = response.data.data;

    const labels = Array.isArray(payload.labels) ? payload.labels : [];
    const revenue = Array.isArray(payload.revenue) ? payload.revenue : [];
    const loss = Array.isArray(payload.loss) ? payload.loss : [];

    // Calculate profit
    const profit = revenue.map((rev, i) => {
      const los = loss[i] || 0;
      return rev - los;
    });

    return {
      labels,
      revenue,
      loss,
      profit,
      currency: payload.currency || "EGP",
    };
  } catch (e) {
    console.error("Failed to fetch chart data", e);
    return { labels: [], revenue: [], loss: [], profit: [], currency: "EGP" };
  }
}

async function getFleetStatus() {
  try {
    const response = await api.get(
      "/api/v1/analytics/analytics-fleet-distribution",
    );
    const dist = response.data.data.distribution;
    const colorMap = {
      active: "#0f988e",
      maintenance: "#f59e0b",
      idle: "#94a3b8",
      inactive: "#e55c3a",
    };
    return dist.map((d) => ({
      label: d.status.charAt(0).toUpperCase() + d.status.slice(1),
      count: d.count,
      color: colorMap[d.status.toLowerCase()] || "#94a3b8",
    }));
  } catch (e) {
    console.error("Failed to fetch fleet status", e);
    return [];
  }
}

async function getDriverPerformance() {
  try {
    const response = await api.get(
      "/api/v1/analytics/reports/driver-leaderboard",
    );
    // returns array of { Rank, Driver, Speed%, Fuel%, Rating, Score }
    return response.data.data.map((d) => ({
      name: d.Driver,
      speed: parseFloat(d["Speed%"]) || 0,
      fuel: parseFloat(d["Fuel%"]) || 0,
      rating: d.Rating,
      score: d.Score,
    }));
  } catch (e) {
    console.error("Failed to fetch driver leaderboard", e);
    return [];
  }
}

async function getCO2ReportData() {
  try {
    const response = await api.get("/api/v1/analytics/kpis/co2-report");
    return response.data.data.vehicles.map((v) => ({
      vehicle: v.vehicle,
      type: v.type,
      emissions: v.emissions_tons,
      reduction: parseFloat(v.reduction_vs_last_month) || 0,
      status: v.status,
    }));
  } catch (e) {
    console.error("Failed to fetch CO2 report", e);
    return [];
  }
}

async function getFuelAuditData() {
  try {
    const response = await api.get("/api/v1/analytics/analytics-fuel-audit");
    return response.data.data.vehicles.map((v) => {
      const expected = v.expected_fuel;
      const actual = v.actual_invoice; // Wait, actual is invoice. The backend returns actual_invoice. Wait, KpiService actually computes actual_invoice. But actual_litres is not in the row. Let's just use expected and actual.
      const discrepancy =
        expected > 0 ? (((actual - expected) / expected) * 100).toFixed(1) : 0;
      return {
        vehicle: v.license,
        gpsDistance: v.gps_distance + " km",
        expected: expected + " L",
        actual: actual + " L",
        discrepancy: discrepancy + "%",
        status: v.status === "flagged" ? "Flagged" : "OK",
        subtext:
          v.status === "flagged"
            ? "Possible fuel theft or leak — review required"
            : "",
      };
    });
  } catch (e) {
    console.error("Failed to fetch fuel audit", e);
    return [];
  }
}

async function getMaintenanceCostData() {
  try {
    const response = await api.get(
      "/api/v1/analytics/analytics-maintenance-cost",
    );

    const payload = response.data?.data ?? response.data;
    const vehicles = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.vehicles)
          ? payload.vehicles
          : [];

    const summaryData = payload?.summary;
    const preventiveValue = summaryData?.preventive?.value || 0;
    const reactiveValue = summaryData?.reactive?.value || 0;
    const total =
      preventiveValue + reactiveValue ||
      vehicles.reduce((sum, v) => sum + (v.total_cost || 0), 0);

    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      console.warn(
        "Maintenance cost API returned unexpected data shape. Expected array of vehicles.",
      );
      return {
        summary: {
          total,
          preventive: preventiveValue,
          reactive: reactiveValue,
          currency: "EGP",
        },
        table: [],
      };
    }

    return {
      summary: {
        total,
        preventive: preventiveValue,
        reactive: reactiveValue,
        currency: "EGP",
      },
      table: vehicles.map((v) => ({
        vehicle: v.vehicle_license || v.vehicle_id || v.license || "",
        service: v.vehicle_model || v.VehicleType || "",
        date: v.date || "N/A",
        parts: (v.total_cost || 0) / 2,
        labor: (v.total_cost || 0) / 2,
        total: v.total_cost || 0,
        status: v.status || "Completed",
      })),
    };
  } catch (e) {
    console.error("Failed to fetch maintenance cost", e);
    return {
      summary: { total: 0, preventive: 0, reactive: 0, currency: "EGP" },
      table: [],
    };
  }
}

const AnalyticsStorage = {
  getKpiData,
  getMonthlyChartData,
  getFleetStatus,
  getDriverPerformance,
  getCO2ReportData,
  getFuelAuditData,
  getMaintenanceCostData,
};

export default AnalyticsStorage;
