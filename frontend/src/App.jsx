import React, { useState, useEffect } from 'react';
import { AppProvider, Frame, Spinner } from '@shopify/polaris';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import enTranslations from '@shopify/polaris/locales/en.json';
import Dashboard from './pages/Dashboard.jsx';
import OfferBuilder from './pages/OfferBuilder.jsx';

function App() {
    const [config, setConfig] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const host = params.get('host');
        const shop = params.get('shop');

        if (host && shop) {
            setConfig({
                apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
                host,
                forceRedirect: true,
            });
        } else {
            console.warn('Shopify host or shop not found in URL.');
        }
    }, []);

    if (!config) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spinner accessibilityLabel="Loading App" size="large" />
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
