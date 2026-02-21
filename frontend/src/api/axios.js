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