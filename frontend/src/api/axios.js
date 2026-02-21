import axios from "axios";

const params = new URLSearchParams(window.location.search);
const shop = params.get("shop");

const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
    params: { shop }
});

export default api;