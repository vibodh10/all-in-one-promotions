import React, { useEffect, useState } from "react";
import { AppProvider, Frame, Spinner, Page } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css"; // ✅ Restore full Polaris styling
import enTranslations from "@shopify/polaris/locales/en.json";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import OfferBuilder from "./pages/OfferBuilder.jsx"; // Your main app page

export default function App() {
    const [config, setConfig] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const host = params.get("host");
        const shop = params.get("shop");

        if (host && shop) {
            setConfig({
                apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
                host,
                forceRedirect: true,
            });
        } else {
            console.warn("⚠️ Missing host or shop in URL");
        }
    }, []);

    if (!config) {
        return (
            <AppProvider i18n={enTranslations}>
                <Frame>
                    <Page>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                height: "100vh",
                            }}
                        >
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
