import { AppBridgeProvider } from '@shopify/app-bridge-react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ✅ Get the host parameter from the Shopify Admin URL
const host = new URLSearchParams(window.location.search).get('host');

// ✅ Configure App Bridge
const appBridgeConfig = {
    apiKey: process.env.SHOPIFY_API_KEY, // must be set in Render environment
    host,
    forceRedirect: true, // keeps app inside Shopify Admin
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
