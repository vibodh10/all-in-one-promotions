import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";

const root = ReactDOM.createRoot(document.getElementById("root"));

const params = new URLSearchParams(window.location.search);
const host = params.get("host");

if (host) {
    const config = {
        apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
        host,
        forceRedirect: true,
    };

    root.render(
        <AppBridgeProvider config={config}>
            <App />
        </AppBridgeProvider>
    );
} else {
    // Fallback if host missing (for local dev or direct open)
    root.render(<App />);
}
