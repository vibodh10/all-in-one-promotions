import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import App from './App.jsx';

const host = new URLSearchParams(window.location.search).get('host');

const isDev = window.location.hostname === "localhost";

const appBridgeConfig = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host,
    forceRedirect: !isDev,
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <AppBridgeProvider config={appBridgeConfig}>
        <App />
    </AppBridgeProvider>
);
