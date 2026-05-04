import {
    canAccessPath,
    normalizePath,
    normalizeRole,
    notFoundRoute,
    routes,
} from "./routes.js";

export function initRouter({ outletId }) {
    const outlet = document.getElementById(outletId);
    let currentRouteModule = null;
    let currentRouteStylesheet = null;

    if (!outlet) {
        throw new Error(`Router outlet #${outletId} was not found.`);
    }

    async function renderCurrentRoute() {
        const currentPath = normalizePath(window.location.pathname);
        const token = localStorage.getItem("token");
        const userRaw = localStorage.getItem("user");
        let currentRole = "";

        if (userRaw) {
            try {
                currentRole = normalizeRole(JSON.parse(userRaw)?.role);
            } catch {
                currentRole = "";
            }
        }

        if (!token && currentPath !== "/login") {
            navigateTo("/login");
            return;
        }
        if (token && currentPath === "/login") {
            navigateTo("/");
            return;
        }

        if (token && currentPath !== "/login" && !currentRole) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigateTo("/login");
            return;
        }

        const activeRoute =
            routes.find((route) => route.path === currentPath) ?? notFoundRoute;

        if (activeRoute.path !== "/login" && activeRoute.path !== "/404") {
            if (!canAccessPath(activeRoute.path, currentRole)) {
                navigateTo("/");
                return;
            }
        }

        if (currentRouteModule?.unmount) {
            currentRouteModule.unmount(outlet);
        }

        const htmlResponse = await fetch(activeRoute.view.html);
        if (!htmlResponse.ok) {
            throw new Error(
                `Failed to load HTML view: ${activeRoute.view.html}`,
            );
        }

        const html = await htmlResponse.text();

        if (currentRouteStylesheet) {
            currentRouteStylesheet.remove();
        }

        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = activeRoute.view.css;
        stylesheet.dataset.routeStyle = activeRoute.path;
        document.head.appendChild(stylesheet);

        currentRouteStylesheet = stylesheet;
        document.title = activeRoute.title;
        outlet.innerHTML = html;

        document.getElementById("nav-title").textContent = activeRoute.title;

        const routeModule = await import(activeRoute.view.js);
        currentRouteModule = routeModule;

        if (routeModule.mount) {
            routeModule.mount(outlet);
        }

        setActiveLink(activeRoute.path);

        window.dispatchEvent(
            new CustomEvent("route:changed", {
                detail: { path: activeRoute.path },
            }),
        );
    }

    function navigateTo(path) {
        const targetPath = normalizePath(path);
        const currentPath = normalizePath(window.location.pathname);

        if (targetPath === currentPath) {
            return;
        }

        window.history.pushState({}, "", targetPath);
        renderCurrentRoute().catch(handleRenderError);
    }

    function handleLinkNavigation(event) {
        const link = event.target.closest("a[data-link]");

        if (!link) {
            return;
        }

        const href = link.getAttribute("href");

        if (!href || href.startsWith("http")) {
            return;
        }

        event.preventDefault();
        navigateTo(href);
    }

    function setActiveLink(pathname) {
        const navLinks = document.querySelectorAll("[data-route]");

        navLinks.forEach((link) => {
            const linkRoute = link.getAttribute("data-route");
            link.classList.toggle("is-active", linkRoute === pathname);
        });
    }

    function handleRenderError(error) {
        console.error(error);
        outlet.innerHTML = `
            <section class="view-page stack">
                <h1 class="heading-lg">Unexpected Error</h1>
                <p>Could not render this page. Please retry.</p>
            </section>
        `;
    }

    const handlePopState = () => {
        renderCurrentRoute().catch(handleRenderError);
    };

    document.addEventListener("click", handleLinkNavigation);
    window.addEventListener("popstate", handlePopState);

    renderCurrentRoute().catch(handleRenderError);

    return {
        navigateTo,
        destroy() {
            document.removeEventListener("click", handleLinkNavigation);
            window.removeEventListener("popstate", handlePopState);

            if (currentRouteModule?.unmount) {
                currentRouteModule.unmount(outlet);
            }

            if (currentRouteStylesheet) {
                currentRouteStylesheet.remove();
            }
        },
    };
}
