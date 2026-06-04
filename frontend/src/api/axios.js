// import axios from "axios";
//
// const params = new URLSearchParams(window.location.search);
// const shop = params.get("shop");
//
// const api = axios.create({
//     baseURL: "/api",
//     withCredentials: true,
// });
//
// // Automatically append shop to every request
// api.interceptors.request.use((config) => {
//     config.params = {
//         ...config.params,
//         shop,
//     };
//     return config;
// });
//
// export default api;

import axios from "axios";
import { authenticatedFetch } from "@shopify/app-bridge-utils";

let appBridgeApp = null;

export function setAppBridgeApp(app) {
    appBridgeApp = app;
}

const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
});

api.interceptors.request.use(async (config) => {
    if (!appBridgeApp) {
        console.warn("App Bridge not initialized");
        return config;
    }

    const authFetch = authenticatedFetch(appBridgeApp);

    config.adapter = async (axiosConfig) => {
        const url = `${axiosConfig.baseURL || ""}${axiosConfig.url}`;

        const response = await authFetch(url, {
            method: axiosConfig.method?.toUpperCase(),
            headers: axiosConfig.headers,
            body: axiosConfig.data,
        });

        const data = await response.json();

        return {
            data,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            config: axiosConfig,
            request: response,
        };
    };

    return config;
});

export default api;