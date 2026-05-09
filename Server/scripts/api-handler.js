/**
 * api-handler.js
 * A universal API handler for any HTTP request.
 */

// ─── Default Config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
    baseURL: "",
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
    retries: 0,
    retryDelay: 500, // ms
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildURL(baseURL, endpoint, params = {}) {
    const url = new URL(
        endpoint,
        baseURL || window?.location?.origin || "http://localhost",
    );
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, value);
        }
    });
    return url.toString();
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseResponse(response) {
    const contentType = response.headers.get("Content-Type") || "";

    if (contentType.includes("application/json")) {
        return response.json();
    }

    if (contentType.includes("text/")) {
        return response.text();
    }

    if (
        contentType.includes("application/octet-stream") ||
        contentType.includes("blob")
    ) {
        return response.blob();
    }

    // Fallback: try JSON, then text
    try {
        return await response.json();
    } catch {
        return response.text();
    }
}

// ─── Core Request Function ────────────────────────────────────────────────────

/**
 * Makes an HTTP request with retry support.
 *
 * @param {Object} options
 * @param {string}  options.url         - Full URL or endpoint path
 * @param {string}  [options.method]    - HTTP method (default: "GET")
 * @param {Object}  [options.headers]   - Request headers
 * @param {Object}  [options.body]      - Request body (auto-serialized)
 * @param {Object}  [options.params]    - URL query params
 * @param {number}  [options.timeout]   - Timeout in ms
 * @param {number}  [options.retries]   - Number of retry attempts
 * @param {number}  [options.retryDelay]- Delay between retries in ms
 * @param {string}  [options.baseURL]   - Base URL to prepend
 * @param {boolean} [options.rawBody]   - Send body as-is (skip JSON.stringify)
 * @returns {Promise<{ data, status, headers, ok }>}
 */
async function request(options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };

    const {
        url,
        method = "GET",
        headers = {},
        body,
        params = {},
        timeout,
        retries,
        retryDelay,
        baseURL,
        rawBody = false,
    } = config;

    const fullURL = buildURL(baseURL || DEFAULT_CONFIG.baseURL, url, params);

    const mergedHeaders = {
        ...DEFAULT_CONFIG.headers,
        // Always read token fresh from localStorage on every request
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        ...headers,
    };

    // Don't set Content-Type for FormData; let the browser handle it
    let serializedBody;
    if (body instanceof FormData) {
        delete mergedHeaders["Content-Type"];
        serializedBody = body;
    } else if (body !== undefined && body !== null) {
        serializedBody = rawBody ? body : JSON.stringify(body);
    }

    const fetchOptions = {
        method: method.toUpperCase(),
        headers: mergedHeaders,
        ...(serializedBody !== undefined && { body: serializedBody }),
    };

    // ── Timeout via AbortController ──────────────────────────────────────────
    let timeoutId;
    const controller = new AbortController();
    if (timeout) {
        timeoutId = setTimeout(() => controller.abort(), timeout);
        fetchOptions.signal = controller.signal;
    }

    // ── Retry Loop ───────────────────────────────────────────────────────────
    let lastError;
    const attempts = retries + 1;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const response = await fetch(fullURL, fetchOptions);

            clearTimeout(timeoutId);

            const data = await parseResponse(response);

            if (!response.ok) {
                const error = new Error(
                    `HTTP ${response.status}: ${response.statusText}`,
                );
                error.status = response.status;
                error.data = data;
                error.response = response;
                throw error;
            }

            return {
                data,
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                ok: true,
            };
        } catch (err) {
            lastError = err;

            const isLastAttempt = attempt === attempts;
            const isAbort = err.name === "AbortError";

            if (isAbort) {
                lastError = new Error(`Request timed out after ${timeout}ms`);
                lastError.code = "TIMEOUT";
                break;
            }

            if (!isLastAttempt) {
                await sleep(retryDelay * attempt); // exponential-ish back-off
                continue;
            }
        }
    }

    clearTimeout(timeoutId);
    throw lastError;
}

// ─── Convenience Methods ──────────────────────────────────────────────────────

const api = {
    /** Override global defaults */
    setDefaults(overrides = {}) {
        Object.assign(DEFAULT_CONFIG, overrides);
    },

    /** Set a base URL for all requests */
    setBaseURL(url) {
        DEFAULT_CONFIG.baseURL = url;
    },

    /** Set a global auth token (Bearer by default) */
    setAuthToken(token, scheme = "Bearer") {
        DEFAULT_CONFIG.headers["Authorization"] = `${scheme} ${token}`;
    },

    /** Clear the auth token */
    clearAuthToken() {
        delete DEFAULT_CONFIG.headers["Authorization"];
    },

    get(url, options = {}) {
        return request({ ...options, url, method: "GET" });
    },

    post(url, body, options = {}) {
        return request({ ...options, url, method: "POST", body });
    },

    put(url, body, options = {}) {
        return request({ ...options, url, method: "PUT", body });
    },

    patch(url, body, options = {}) {
        return request({ ...options, url, method: "PATCH", body });
    },

    delete(url, options = {}) {
        return request({ ...options, url, method: "DELETE" });
    },

    head(url, options = {}) {
        return request({ ...options, url, method: "HEAD" });
    },
};

// ─── Exports ──────────────────────────────────────────────────────────────────

// // ESM
export { request, api };
export default api;
