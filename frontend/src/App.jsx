import React, { useEffect, useState } from "react";
import { AppProvider, Frame, Spinner, Page } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// ✅ You already have OfferBuilder.jsx — keep using that
import OfferBuilder from "./pages/OfferBuilder.jsx";

export default function App() {
    const [config, setConfig] = useState(null);

    // Shopify host handling (so window.shopify will exist)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const host = params.get("host");

        if (host) {
            setConfig({
                apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
                host,
                forceRedirect: true,
            });
        } else {
            console.warn("⚠️ Missing host param — embedded app may not load correctly");
        }
    }, []);

    // Show spinner until App Bridge config loads
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

    // Main app wrapper
    return (
        <AppBridgeProvider config={config}>
            <AppProvider i18n={enTranslations}>
                <BrowserRouter basename="/frontend">
                    <Frame>
                        <Routes>
                            <Route path="/" element={<OfferBuilder />} />
                            <Route path="/offers/new" element={<OfferBuilder />} />
                        </Routes>
                    </Frame>
                </BrowserRouter>
            </AppProvider>
        </AppBridgeProvider>
    );
}
