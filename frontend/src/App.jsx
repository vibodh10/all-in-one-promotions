import '@shopify/polaris/build/esm/styles.css';
import React from 'react';
import { AppProvider, Frame, Spinner } from '@shopify/polaris';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import enTranslations from '@shopify/polaris/locales/en.json';
import Dashboard from './pages/Dashboard.jsx';
import OfferBuilder from './pages/OfferBuilder.jsx';

function App() {
    // Optional: if you want to show spinner while waiting for Shopify init
    const [ready, setReady] = React.useState(false);

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('host')) setReady(true);
    }, []);

    if (!ready) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spinner accessibilityLabel="Loading App" size="large" />
            </div>
        );
    }

    return (
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
    );
}

export default App;
