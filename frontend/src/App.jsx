import React, { useState, useEffect } from 'react';
import { AppProvider, Frame } from '@shopify/polaris';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import enTranslations from '@shopify/polaris/locales/en.json';

// ✅ Only import files that actually exist
import Dashboard from './pages/Dashboard.jsx';
import OfferBuilder from './pages/OfferBuilder.jsx';

function App() {
    const [config, setConfig] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const host = params.get('host');
        const shop = params.get('shop');
        console.log('Shopify host:', new URLSearchParams(window.location.search).get('host'));

        if (host && shop) {
            setConfig({
                apiKey: import.meta.env.VITE_SHOPIFY_API_KEY, // ✅ use Vite env var format
                host,
                shop,
                forceRedirect: true
            });
        }
    }, []);

    if (!config) return <div>Loading...</div>;

    return (
        <AppBridgeProvider config={config}>
            <AppProvider i18n={enTranslations}>
                <BrowserRouter>
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
