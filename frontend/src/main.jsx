import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import App from './App.jsx';
import axios from "axios";

axios.defaults.withCredentials = true;

const params = new URLSearchParams(window.location.search);
const host = params.get('host');

if (!host) {
    console.error("Missing host parameter in URL");
}

const appBridgeConfig = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host,
    forceRedirect: true,
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <AppBridgeProvider config={appBridgeConfig}>
        <App />
    </AppBridgeProvider>
);