export const routes = [
    {
        path: "/",
        title: "Dashboard",
        view: {
            html: "/src/views/dashboard/view.html",
            css: "/src/views/dashboard/view.css",
            js: "/src/views/dashboard/view.js",
        },
    },
    {
        path: "/orders",
        title: "Orders",
        view: {
            html: "/src/views/orders/view.html",
            css: "/src/views/orders/view.css",
            js: "/src/views/orders/view.js",
        },
    },
    {
        path: "/route-planning",
        title: "Route Planning",
        view: {
            html: "/src/views/route-planning/view.html",
            css: "/src/views/route-planning/view.css",
            js: "/src/views/route-planning/view.js",
        },
    },
    {
        path: "/routes",
        title: "Routes",
        view: {
            html: "/src/views/routes/view.html",
            css: "/src/views/routes/view.css",
            js: "/src/views/routes/view.js",
        },
    },
    {
        path: "/live-monitoring",
        title: "Live Monitoring",
        view: {
            html: "/src/views/live-monitoring/view.html",
            css: "/src/views/live-monitoring/view.css",
            js: "/src/views/live-monitoring/view.js",
        },
    },
    {
        path: "/fleet-management",
        title: "Fleet Management",
        view: {
            html: "/src/views/fleet-management/view.html",
            css: "/src/views/fleet-management/view.css",
            js: "/src/views/fleet-management/view.js",
        },
    },
    {
        path: "/drivers",
        title: "Drivers",
        view: {
            html: "/src/views/drivers/view.html",
            css: "/src/views/drivers/view.css",
            js: "/src/views/drivers/view.js",
        },
    },
    {
        path: "/shifts",
        title: "Shifts",
        view: {
            html: "/src/views/shifts/view.html",
            css: "/src/views/shifts/view.css",
            js: "/src/views/shifts/view.js",
        },
    },
    {
        path: "/cod-management",
        title: "COD Management",
        view: {
            html: "/src/views/cod-management/view.html",
            css: "/src/views/cod-management/view.css",
            js: "/src/views/cod-management/view.js",
        },
    },
    {
        path: "/inventory",
        title: "Inventory",
        view: {
            html: "/src/views/inventory/view.html",
            css: "/src/views/inventory/view.css",
            js: "/src/views/inventory/view.js",
        },
    },
    {
        path: "/user-management",
        title: "User Management",
        view: {
            html: "/src/views/user-management/view.html",
            css: "/src/views/user-management/view.css",
            js: "/src/views/user-management/view.js",
        },
    },
    {
        path: "/analytics",
        title: "Analytics",
        view: {
            html: "/src/views/analytics/view.html",
            css: "/src/views/analytics/view.css",
            js: "/src/views/analytics/view.js",
        },
    },
    {
        path: "/maintenance",
        title: "Maintenance",
        view: {
            html: "/src/views/maintenance/view.html",
            css: "/src/views/maintenance/view.css",
            js: "/src/views/maintenance/view.js",
        },
    },
    {
        path: "/audit-trail",
        title: "Audit Trail",
        view: {
            html: "/src/views/audit-trail/view.html",
            css: "/src/views/audit-trail/view.css",
            js: "/src/views/audit-trail/view.js",
        },
    },
    {
        path: "/settings",
        title: "Settings",
        view: {
            html: "/src/views/settings/view.html",
            css: "/src/views/settings/view.css",
            js: "/src/views/settings/view.js",
        },
    },
    {
        path: "/preview-page",
        title: "Template Page",
        view: {
            html: "/src/views/preview-page/view.html",
            css: "/src/views/preview-page/view.css",
            js: "/src/views/preview-page/view.js",
        },
    },
];

export const notFoundRoute = {
    path: "/404",
    title: "Not Found",
    view: {
        html: "/src/views/not-found/view.html",
        css: "/src/views/not-found/view.css",
        js: "/src/views/not-found/view.js",
    },
};

export function normalizePath(pathname) {
    if (!pathname || pathname === "/index.html") {
        return "/";
    }

    const trimmed =
        pathname.endsWith("/") && pathname.length > 1
            ? pathname.slice(0, -1)
            : pathname;

    return trimmed;
}
