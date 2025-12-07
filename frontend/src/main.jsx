import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import App from './App';

// Get host parameter from Shopify Admin URL
const host = new URLSearchParams(window.location.search).get('host');

// Configure App Bridge
const appBridgeConfig = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host,
    forceRedirect: true,
};

// Render app
ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <AppBridgeProvider config={appBridgeConfig}>
                <AppProvider i18n={{}}>
                    <App />
                </AppProvider>
            </AppBridgeProvider>
        </BrowserRouter>
    </React.StrictMode>
);
