const KPI_DATA = {
  "7d": [
    { icon: "dollar-sign",  label: "Total Revenue",      value: "$142,830", raw: 142830, change: +5.2,  color: "#0f988e", bg: "#ecfdf5", bar: 72 },
    { icon: "trending-down",label: "Operating Costs",    value: "$89,410",  raw: 89410,  change: -1.8,  color: "#e55c3a", bg: "#fef2f2", bar: 55 },
    { icon: "truck",        label: "Fleet Utilization",  value: "86.4%",    raw: 86.4,   change: +3.1,  color: "#3b82f6", bg: "#eff6ff", bar: 86 },
    { icon: "zap",          label: "Avg Fuel Efficiency", value: "9.8 km/L", raw: 9.8,   change: +1.4,  color: "#f59e0b", bg: "#fffbeb", bar: 68 },
  ],
  "30d": [
    { icon: "dollar-sign",  label: "Total Revenue",      value: "$618,500", raw: 618500, change: +8.7,  color: "#0f988e", bg: "#ecfdf5", bar: 80 },
    { icon: "trending-down",label: "Operating Costs",    value: "$374,200", raw: 374200, change: +2.3,  color: "#e55c3a", bg: "#fef2f2", bar: 60 },
    { icon: "truck",        label: "Fleet Utilization",  value: "83.1%",    raw: 83.1,   change: +1.8,  color: "#3b82f6", bg: "#eff6ff", bar: 83 },
    { icon: "zap",          label: "Avg Fuel Efficiency", value: "9.5 km/L", raw: 9.5,   change: -0.6,  color: "#f59e0b", bg: "#fffbeb", bar: 62 },
  ],
  "90d": [
    { icon: "dollar-sign",  label: "Total Revenue",      value: "$1.87M",   raw: 1870000,change: +12.1, color: "#0f988e", bg: "#ecfdf5", bar: 90 },
    { icon: "trending-down",label: "Operating Costs",    value: "$1.12M",   raw: 1120000,change: +4.1,  color: "#e55c3a", bg: "#fef2f2", bar: 65 },
    { icon: "truck",        label: "Fleet Utilization",  value: "81.8%",    raw: 81.8,   change: -0.5,  color: "#3b82f6", bg: "#eff6ff", bar: 82 },
    { icon: "zap",          label: "Avg Fuel Efficiency", value: "9.3 km/L", raw: 9.3,   change: -1.2,  color: "#f59e0b", bg: "#fffbeb", bar: 59 },
  ],
  "ytd": [
    { icon: "dollar-sign",  label: "Total Revenue",      value: "$2.43M",   raw: 2430000,change: +18.4, color: "#0f988e", bg: "#ecfdf5", bar: 95 },
    { icon: "trending-down",label: "Operating Costs",    value: "$1.48M",   raw: 1480000,change: +6.3,  color: "#e55c3a", bg: "#fef2f2", bar: 72 },
    { icon: "truck",        label: "Fleet Utilization",  value: "84.2%",    raw: 84.2,   change: +2.9,  color: "#3b82f6", bg: "#eff6ff", bar: 84 },
    { icon: "zap",          label: "Avg Fuel Efficiency", value: "9.6 km/L", raw: 9.6,   change: +0.8,  color: "#f59e0b", bg: "#fffbeb", bar: 64 },
  ],
};

const MONTHLY_CHART_DATA = {
  labels: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"],
  revenue: [420000, 510000, 390000, 320000, 530000, 618500],
  costs:   [262000, 305000, 248000, 380000, 317000, 374200],
  profit:  [158000, 205000, 142000, -60000, 213000, 244300],
};

const FLEET_STATUS = [
  { label: "Active",       count: 61, color: "#0f988e" },
  { label: "In Maintenance", count: 14, color: "#f59e0b" },
  { label: "Idle",         count: 11, color: "#94a3b8" },
];

const DRIVER_PERF = {
  labels: ["Ahmed K.", "Sara M.", "Karim H.", "Nour F.", "Omar S."],
  efficiency: [92, 87, 95, 78, 83],
  safety:     [88, 91, 84, 90, 76],
};


const AVATAR_COLORS = ["#0f988e","#3b82f6","#e55c3a","#f59e0b","#8b5cf6","#ec4899","#10b981","#6366f1"];

const TABLE_DATA = [
  { date:"2026-04-19", vehicle:"VH-3821", driver:"Ahmed K.",   distance:412, fuel:41, idle:"0h 32m", eff:92, status:"Optimal"    },
  { date:"2026-04-19", vehicle:"VH-5503", driver:"Sara M.",    distance:287, fuel:31, idle:"1h 05m", eff:81, status:"Optimal"    },
  { date:"2026-04-18", vehicle:"VH-7742", driver:"Karim H.",   distance:538, fuel:52, idle:"0h 15m", eff:95, status:"Optimal"    },
  { date:"2026-04-18", vehicle:"VH-1190", driver:"Nour F.",    distance:190, fuel:24, idle:"2h 10m", eff:58, status:"Needs Review"},
  { date:"2026-04-18", vehicle:"VH-4455", driver:"Omar S.",    distance:622, fuel:72, idle:"0h 45m", eff:72, status:"High Usage" },
  { date:"2026-04-17", vehicle:"VH-8831", driver:"Layla T.",   distance:348, fuel:38, idle:"0h 22m", eff:88, status:"Optimal"    },
  { date:"2026-04-17", vehicle:"VH-2267", driver:"Hassan W.",  distance:175, fuel:22, idle:"3h 00m", eff:52, status:"Needs Review"},
  { date:"2026-04-17", vehicle:"VH-9910", driver:"Mona R.",    distance:495, fuel:58, idle:"0h 50m", eff:77, status:"High Usage" },
  { date:"2026-04-16", vehicle:"VH-3355", driver:"Youssef A.", distance:381, fuel:40, idle:"0h 28m", eff:89, status:"Optimal"    },
  { date:"2026-04-16", vehicle:"VH-6620", driver:"Dina K.",    distance:260, fuel:30, idle:"1h 15m", eff:74, status:"High Usage" },
  { date:"2026-04-16", vehicle:"VH-1144", driver:"Khalid B.",  distance:444, fuel:46, idle:"0h 38m", eff:86, status:"Optimal"    },
  { date:"2026-04-15", vehicle:"VH-7788", driver:"Rana H.",    distance:312, fuel:37, idle:"1h 40m", eff:63, status:"High Usage" },
  { date:"2026-04-15", vehicle:"VH-5599", driver:"Tarek M.",   distance:188, fuel:23, idle:"2h 55m", eff:55, status:"Needs Review"},
  { date:"2026-04-15", vehicle:"VH-2230", driver:"Salma E.",   distance:530, fuel:54, idle:"0h 18m", eff:93, status:"Optimal"    },
  { date:"2026-04-14", vehicle:"VH-8800", driver:"Ahmed K.",   distance:401, fuel:42, idle:"0h 29m", eff:91, status:"Optimal"    },
  { date:"2026-04-14", vehicle:"VH-4477", driver:"Omar S.",    distance:580, fuel:68, idle:"0h 55m", eff:69, status:"High Usage" },
  { date:"2026-04-13", vehicle:"VH-3310", driver:"Sara M.",    distance:297, fuel:33, idle:"1h 00m", eff:83, status:"Optimal"    },
  { date:"2026-04-13", vehicle:"VH-6688", driver:"Karim H.",   distance:215, fuel:27, idle:"2h 20m", eff:59, status:"Needs Review"},
  { date:"2026-04-12", vehicle:"VH-9921", driver:"Hassan W.",  distance:470, fuel:49, idle:"0h 40m", eff:85, status:"Optimal"    },
  { date:"2026-04-12", vehicle:"VH-1122", driver:"Nour F.",    distance:344, fuel:41, idle:"1h 10m", eff:75, status:"High Usage" },
  { date:"2026-04-11", vehicle:"VH-7733", driver:"Layla T.",   distance:410, fuel:43, idle:"0h 25m", eff:90, status:"Optimal"    },
  { date:"2026-04-11", vehicle:"VH-5544", driver:"Mona R.",    distance:165, fuel:21, idle:"3h 30m", eff:48, status:"Needs Review"},
  { date:"2026-04-10", vehicle:"VH-2211", driver:"Youssef A.", distance:495, fuel:51, idle:"0h 35m", eff:87, status:"Optimal"    },
  { date:"2026-04-10", vehicle:"VH-8866", driver:"Dina K.",    distance:322, fuel:38, idle:"1h 20m", eff:76, status:"High Usage" },
  { date:"2026-04-09", vehicle:"VH-3399", driver:"Khalid B.",  distance:558, fuel:58, idle:"0h 20m", eff:91, status:"Optimal"    },
  { date:"2026-04-09", vehicle:"VH-6611", driver:"Tarek M.",   distance:200, fuel:26, idle:"2h 45m", eff:53, status:"Needs Review"},
  { date:"2026-04-08", vehicle:"VH-1177", driver:"Rana H.",    distance:388, fuel:42, idle:"0h 42m", eff:84, status:"Optimal"    },
  { date:"2026-04-08", vehicle:"VH-4422", driver:"Salma E.",   distance:445, fuel:46, idle:"0h 30m", eff:88, status:"Optimal"    },
  { date:"2026-04-07", vehicle:"VH-9988", driver:"Ahmed K.",   distance:610, fuel:65, idle:"0h 10m", eff:94, status:"Optimal"    },
  { date:"2026-04-07", vehicle:"VH-7755", driver:"Omar S.",    distance:170, fuel:22, idle:"3h 15m", eff:44, status:"Needs Review"},
  { date:"2026-04-06", vehicle:"VH-5566", driver:"Sara M.",    distance:340, fuel:37, idle:"0h 55m", eff:82, status:"Optimal"    },
  { date:"2026-04-06", vehicle:"VH-2288", driver:"Karim H.",   distance:490, fuel:52, idle:"0h 22m", eff:89, status:"Optimal"    },
  { date:"2026-04-05", vehicle:"VH-8844", driver:"Hassan W.",  distance:225, fuel:29, idle:"2h 00m", eff:61, status:"High Usage" },
  { date:"2026-04-05", vehicle:"VH-3366", driver:"Mona R.",    distance:375, fuel:40, idle:"0h 48m", eff:85, status:"Optimal"    },
  { date:"2026-04-04", vehicle:"VH-6633", driver:"Youssef A.", distance:505, fuel:53, idle:"0h 15m", eff:93, status:"Optimal"    },
  { date:"2026-04-04", vehicle:"VH-1155", driver:"Nour F.",    distance:280, fuel:34, idle:"1h 25m", eff:70, status:"High Usage" },
  { date:"2026-04-03", vehicle:"VH-9977", driver:"Layla T.",   distance:420, fuel:44, idle:"0h 35m", eff:88, status:"Optimal"    },
  { date:"2026-04-03", vehicle:"VH-7711", driver:"Dina K.",    distance:185, fuel:24, idle:"3h 05m", eff:50, status:"Needs Review"},
  { date:"2026-04-02", vehicle:"VH-4433", driver:"Khalid B.",  distance:460, fuel:48, idle:"0h 40m", eff:87, status:"Optimal"    },
  { date:"2026-04-02", vehicle:"VH-2299", driver:"Tarek M.",   distance:310, fuel:36, idle:"1h 30m", eff:72, status:"High Usage" },
  { date:"2026-04-01", vehicle:"VH-5577", driver:"Rana H.",    distance:540, fuel:56, idle:"0h 20m", eff:92, status:"Optimal"    },
  { date:"2026-04-01", vehicle:"VH-8822", driver:"Salma E.",   distance:240, fuel:30, idle:"2h 10m", eff:62, status:"High Usage" },
  { date:"2026-03-31", vehicle:"VH-3344", driver:"Ahmed K.",   distance:478, fuel:50, idle:"0h 28m", eff:90, status:"Optimal"    },
  { date:"2026-03-31", vehicle:"VH-6655", driver:"Omar S.",    distance:195, fuel:25, idle:"3h 00m", eff:47, status:"Needs Review"},
  { date:"2026-03-30", vehicle:"VH-1188", driver:"Sara M.",    distance:362, fuel:39, idle:"0h 45m", eff:84, status:"Optimal"    },
  { date:"2026-03-30", vehicle:"VH-9900", driver:"Karim H.",   distance:512, fuel:53, idle:"0h 18m", eff:93, status:"Optimal"    },
  { date:"2026-03-29", vehicle:"VH-7766", driver:"Hassan W.",  distance:228, fuel:28, idle:"2h 30m", eff:58, status:"High Usage" },
  { date:"2026-03-29", vehicle:"VH-4411", driver:"Mona R.",    distance:385, fuel:41, idle:"0h 38m", eff:86, status:"Optimal"    },
];

const CO2_REPORT_DATA = [
  { vehicle: "VH-3821", type: "Truck", emissions: "1.2", reduction: 5, status: "Good" },
  { vehicle: "VH-5503", type: "Van", emissions: "1.8", reduction: -2, status: "Needs Improvement" },
  { vehicle: "VH-7742", type: "Truck", emissions: "0.9", reduction: 12, status: "Excellent" },
  { vehicle: "VH-1190", type: "Van", emissions: "2.1", reduction: -8, status: "Poor" },
  { vehicle: "VH-4455", type: "Truck", emissions: "1.5", reduction: 1, status: "Good" }
];

const FUEL_AUDIT_DATA = [
  { vehicle: "TRK-042", gpsDistance: "3,200 km", expected: "421 L", actual: "420 L", discrepancy: "0.2%", status: "OK" },
  { vehicle: "TRK-015", gpsDistance: "2,800 km", expected: "311 L", actual: "310 L", discrepancy: "0.3%", status: "OK" },
  { vehicle: "TRK-007", gpsDistance: "2,100 km", expected: "350 L", actual: "410 L", discrepancy: "17.1%", status: "Flagged", subtext: "Possible fuel theft or leak — review required" },
  { vehicle: "TRK-031", gpsDistance: "2,400 km", expected: "270 L", actual: "275 L", discrepancy: "1.9%", status: "OK" }
];

const MAINTENANCE_COST_DATA = [
  { vehicle: "VH-5503", service: "Oil Change & Filters", date: "2024-04-12", parts: 150, labor: 100, total: 250, status: "Completed" },
  { vehicle: "VH-1190", service: "Brake Pad Replacement", date: "2024-04-10", parts: 300, labor: 150, total: 450, status: "Completed" },
  { vehicle: "VH-4455", service: "Engine Diagnostics", date: "2024-04-05", parts: 0, labor: 200, total: 200, status: "Pending" },
  { vehicle: "VH-7742", service: "Transmission Fluid", date: "2024-04-01", parts: 80, labor: 120, total: 200, status: "Completed" },
  { vehicle: "VH-3821", service: "Tire Rotation", date: "2024-03-28", parts: 0, labor: 80, total: 80, status: "Completed" }
];

const MAINTENANCE_SUMMARY_DATA = {
  total: 42800,
  preventive: 28200,
  reactive: 14600,
  currency: 'SAR'
};

export {
  KPI_DATA,
  MONTHLY_CHART_DATA,
  FLEET_STATUS,
  DRIVER_PERF,
  TABLE_DATA,
  CO2_REPORT_DATA,
  FUEL_AUDIT_DATA,
  MAINTENANCE_COST_DATA,
  MAINTENANCE_SUMMARY_DATA
};