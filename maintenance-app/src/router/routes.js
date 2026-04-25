export const routes = [
    {
        path: "/",
        title: "Dashboard",
        navTitle: "Dashboard",
        view: {
            html: "/src/views/dashboard/view.html",
            css: "/src/views/dashboard/view.css",
            js: "/src/views/dashboard/view.js",
        },
    },
    {
        path: "/work-orders",
        title: "Work Orders",
        navTitle: "Work Orders",
        view: {
            html: "/src/views/work-orders/view.html",
            css: "/src/views/work-orders/view.css",
            js: "/src/views/work-orders/view.js",
        },
    },
    {
        path: "/work-orders/details",
        title: "Work Order Details",
        navTitle: "Work Orders",
        view: {
            html: "/src/views/work-orders/details/view.html",
            css: "/src/views/work-orders/details/view.css",
            js: "/src/views/work-orders/details/view.js",
        },
    },
    {
        path: "/work-orders/create",
        title: "Create Work Order",
        navTitle: "Work Orders",
        view: {
            html: "/src/views/work-orders/create/view.html",
            css: "/src/views/work-orders/create/view.css",
            js: "/src/views/work-orders/create/view.js",
        },
    },
    {
        path: "/vehicles",
        title: "Vehicles",
        navTitle: "Vehicles",
        view: {
            html: "/src/views/vehicles/view.html",
            css: "/src/views/vehicles/view.css",
            js: "/src/views/vehicles/view.js",
        },
    },
    {
        path: "/spare-parts",
        title: "Spare Parts",
        navTitle: "Spare Parts",
        view: {
            html: "/src/views/spare-parts/view.html",
            css: "/src/views/spare-parts/view.css",
            js: "/src/views/spare-parts/view.js",
        },
    },
    {
        path: "/technician-assignment",
        title: "Technician Assignment",
        navTitle: "Technician Assignment",
        view: {
            html: "/src/views/technician-assignment/view.html",
            css: "/src/views/technician-assignment/view.css",
            js: "/src/views/technician-assignment/view.js",
        },
    },
    {
        path: "/fuel-efficiency",
        title: "Fuel & Efficiency",
        navTitle: "Fuel & Efficiency",
        view: {
            html: "/src/views/fuel-efficiency/view.html",
            css: "/src/views/fuel-efficiency/view.css",
            js: "/src/views/fuel-efficiency/view.js",
        },
    },
    {
        path: "/alerts-inspections",
        title: "Alerts & Inspections",
        navTitle: "Alerts & Inspections",
        view: {
            html: "/src/views/alerts-inspections/view.html",
            css: "/src/views/alerts-inspections/view.css",
            js: "/src/views/alerts-inspections/view.js",
        },
    },
    {
        path: "/emergency-dispatch",
        title: "Emergency Dispatch",
        navTitle: "Emergency Dispatch",
        view: {
            html: "/src/views/emergency-dispatch/view.html",
            css: "/src/views/emergency-dispatch/view.css",
            js: "/src/views/emergency-dispatch/view.js",
        },
    },
    {
        path: "/cost-to-value",
        title: "Cost-to-Value",
        navTitle: "Cost-to-Value",
        view: {
            html: "/src/views/cost-to-value/view.html",
            css: "/src/views/cost-to-value/view.css",
            js: "/src/views/cost-to-value/view.js",
        },
    },
    {
        path: "/cost-to-value/details",
        title: "Vehicle CTV Details",
        navTitle: "Cost-to-Value",
        view: {
            html: "/src/views/cost-to-value/details/view.html",
            css: "/src/views/cost-to-value/details/view.css",
            js: "/src/views/cost-to-value/details/view.js",
        },
    },
    {
        path: "/notifications",
        title: "Notifications",
        navTitle: "Notifications",
        view: {
            html: "/src/views/notifications/view.html",
            css: "/src/views/notifications/view.css",
            js: "/src/views/notifications/view.js",
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
    navTitle: "Not Found",
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
