import { normalizePath, notFoundRoute, routes } from "./routes.js";

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

        // ─── Route Guard (نظام الحماية) ──────────────────────────────────

        // 1. إذا لم يكن مسجل الدخول ويحاول فتح أي صفحة -> توجيه لصفحة تسجيل الدخول
        if (!token && currentPath !== "/login") {
            navigateTo("/login");
            return;
        }

        // 2. إذا كان مسجل الدخول ويحاول فتح صفحة تسجيل الدخول -> توجيه للوحة التحكم
        if (token && currentPath === "/login") {
            navigateTo("/");
            return;
        }
        // ─────────────────────────────────────────────────────────────────

        const activeRoute =
            routes.find((route) => route.path === currentPath) ?? notFoundRoute;

        // ─── Layout Toggle (تعديل الهيكل الخارجي لصفحة الدخول) ────────────
        const shell = document.querySelector("[data-shell]");
        if (activeRoute.path === "/login") {
            shell?.classList.add("is-login-layout");
        } else {
            shell?.classList.remove("is-login-layout");
        }
        // ─────────────────────────────────────────────────────────────────

        if (currentRouteModule?.unmount) {
            currentRouteModule.unmount(outlet);
        }

        const cacheBuster = `?t=${Date.now()}`;
        const htmlResponse = await fetch(`${activeRoute.view.html}${cacheBuster}`);
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
        stylesheet.href = `${activeRoute.view.css}${cacheBuster}`;
        stylesheet.dataset.routeStyle = activeRoute.path;
        document.head.appendChild(stylesheet);

        currentRouteStylesheet = stylesheet;
        document.title = activeRoute.title;
        outlet.innerHTML = html;

        // تحديث عنوان الـ Topbar فقط إذا لم نكن في صفحة تسجيل الدخول
        if (activeRoute.path !== "/login") {
            const navTitle = document.getElementById("nav-title");
            if (navTitle) {
                navTitle.textContent = activeRoute.title;
            }
        }

        const routeModule = await import(`${activeRoute.view.js}${cacheBuster}`);
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

        // تجاهل الروابط الخارجية
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

    // Initial render
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