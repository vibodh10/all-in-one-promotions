import React from "react";
import ReactDOM from "react-dom/client";
import { createApp } from "@shopify/app-bridge";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import App from "./App.jsx";
import axios from "axios";
import {setAppBridgeApp} from "./api/axios.js";

axios.defaults.withCredentials = true;

const params = new URLSearchParams(window.location.search);
const host = params.get("host");

const config = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host,
    forceRedirect: true,
};

/* Initialize App Bridge for Shopify automated check */
const app = createApp(config);

// setAppBridgeApp(app);

ReactDOM.createRoot(document.getElementById("root")).render(
    <AppBridgeProvider config={config}>
        <App />
    </AppBridgeProvider>
);