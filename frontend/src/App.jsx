import React from "react";
import { AppProvider, Frame, Page } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import enTranslations from "@shopify/polaris/locales/en.json";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import OfferBuilder from "./pages/OfferBuilder.jsx";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
    return (
        <AppProvider i18n={enTranslations}>
            <MemoryRouter initialEntries={["/"]}>
                <Frame>
                    <Page>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/offers/new" element={<OfferBuilder />} />
                        </Routes>
                    </Page>
                </Frame>
            </MemoryRouter>
        </AppProvider>
    );
}
