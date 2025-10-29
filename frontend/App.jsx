import React, { useState, useEffect } from 'react';
import { AppProvider, Page, Frame } from '@shopify/polaris';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import enTranslations from '@shopify/polaris/locales/en.json';

// Pages
import Dashboard from './pages/Dashboard';
import OfferList from './pages/OfferList';
import OfferBuilder from './pages/OfferBuilder';
import OfferEdit from './pages/OfferEdit';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Billing from './pages/Billing';

// Components
import Navigation from './components/Navigation';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    // Get Shopify app configuration from URL params
    const params = new URLSearchParams(window.location.search);
    const host = params.get('host');
    const shop = params.get('shop');

    if (host && shop) {
      setConfig({
        apiKey: process.env.REACT_APP_SHOPIFY_API_KEY,
        host: host,
        shop: shop,
        forceRedirect: true
      });
    }
  }, []);

  if (!config) {
    return <div>Loading...</div>;
  }

  return (
    <AppBridgeProvider config={config}>
      <AppProvider i18n={enTranslations}>
        <AuthProvider>
          <BrowserRouter>
            <Frame navigation={<Navigation />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/offers" element={<OfferList />} />
                <Route path="/offers/new" element={<OfferBuilder />} />
                <Route path="/offers/:id/edit" element={<OfferEdit />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/billing" element={<Billing />} />
              </Routes>
            </Frame>
          </BrowserRouter>
        </AuthProvider>
      </AppProvider>
    </AppBridgeProvider>
  );
}

export default App;
