import axios from "axios";

const params = new URLSearchParams(window.location.search);
const shop = params.get("shop");

const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
});

// Automatically append shop to every request
api.interceptors.request.use((config) => {
    config.params = {
        ...config.params,
        shop,
    };
    return config;
});

export default api;

// import axios from "axios";
// import { getSessionToken } from "@shopify/app-bridge-utils";
//
// let appBridgeApp = null;
//
// // 🔧 Call this once from your main app
// export function setAppBridgeApp(app) {
//     appBridgeApp = app;
// }
//
// const api = axios.create({
//     baseURL: "/api",
//     withCredentials: true,
// });
//
// // 🔐 Attach session token to every request
// api.interceptors.request.use(async (config) => {
//     if (!appBridgeApp) {
//         console.warn("App Bridge not initialized");
//         return config;
//     }
//
//     const token = await getSessionToken(appBridgeApp);
//
//     config.headers = {
//         ...config.headers,
//         Authorization: `Bearer ${token}`,
//     };
//
//     return config;
// });
//
// export default api;