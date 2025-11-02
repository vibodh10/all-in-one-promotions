import React, { useState, useEffect } from 'react';
import { AppProvider, Frame, Spinner } from '@shopify/polaris';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import enTranslations from '@shopify/polaris/locales/en.json';
import Dashboard from './pages/Dashboard.jsx';
import OfferBuilder from './pages/OfferBuilder.jsx';

function App() {
    const [config, setConfig] = useState(null);
    const [bridgeReady, setBridgeReady] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const host = params.get('host');
        const shop = params.get('shop');

        if (host && shop) {
            const appBridgeConfig = {
                apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
                host,
                forceRedirect: true,
            };

            setConfig(appBridgeConfig);

            // ✅ Wait until Shopify injects its global object
            const checkShopifyReady = () => {
                if (window.Shopify && window.Shopify.AppBridge) {
                    setBridgeReady(true);
                } else {
                    setTimeout(checkShopifyReady, 100);
                }
            };

            checkShopifyReady();
        }
    }, []);

    if (!config || !bridgeReady) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spinner accessibilityLabel="Loading App Bridge" size="large" />
            </div>
        );
    }

    return (
        <AppBridgeProvider config={config}>
            <AppProvider i18n={enTranslations}>
                <BrowserRouter basename="/frontend">
                    <Frame>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/offers/new" element={<OfferBuilder />} />
                        </Routes>
                    </Frame>
                </BrowserRouter>
            </AppProvider>
        </AppBridgeProvider>
    );
}

export default App;
