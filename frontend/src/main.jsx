import { AppBridgeProvider } from '@shopify/app-bridge-react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ✅ Get the host parameter from the Shopify Admin URL
const host = new URLSearchParams(window.location.search).get('host');

// ✅ Configure App Bridge
const appBridgeConfig = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY, // ✅ correct for Vite
    host,
    forceRedirect: true,
};

// ✅ Render app inside AppBridgeProvider
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <BrowserRouter>
        <AppBridgeProvider config={appBridgeConfig}>
            <App />
        </AppBridgeProvider>
    </BrowserRouter>
);
