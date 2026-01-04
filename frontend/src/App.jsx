import React, { useEffect, useState } from "react";
import { AppProvider, Frame, Spinner, Page } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css"; // ✅ RESTORE POLARIS STYLES
import enTranslations from "@shopify/polaris/locales/en.json";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import OfferBuilder from "./pages/OfferBuilder.jsx"; // your main page

export default function App() {
    const [config, setConfig] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const host = params.get("host");

        if (host) {
            setConfig({
                apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
                host,
                forceRedirect: true,
            });
        }
    }, []);

    if (!config) {
        return (
            <AppProvider i18n={enTranslations}>
                <Frame>
                    <Page>
                        <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
                            <Spinner accessibilityLabel="Loading app" size="large" />
                        </div>
                    </Page>
                </Frame>
            </AppProvider>
        );
    }

    return (
        <AppBridgeProvider config={config}>
            <AppProvider i18n={enTranslations}>
                <BrowserRouter basename="/frontend">
                    <Frame>
                        <Page>
                            <Routes>
                                <Route path="/" element={<OfferBuilder />} />
                                <Route path="/offers/new" element={<OfferBuilder />} />
                            </Routes>
                        </Page>
                    </Frame>
                </BrowserRouter>
            </AppProvider>
        </AppBridgeProvider>
    );
}
