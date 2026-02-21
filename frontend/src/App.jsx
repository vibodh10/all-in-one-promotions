import React from "react";
import { AppProvider, Frame } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import enTranslations from "@shopify/polaris/locales/en.json";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard.jsx";
import OfferBuilder from "./pages/OfferBuilder.jsx";
import OfferList from "./pages/OfferList.jsx";
import OfferEdit from "./pages/OfferEdit.jsx";
import Analytics from "./pages/Analytics.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
    return (
        <AppProvider i18n={enTranslations}>
            <MemoryRouter initialEntries={["/"]}>
                <Frame>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/offers" element={<OfferList />} />
                        <Route path="/offers/new" element={<OfferBuilder />} />
                        <Route path="/offers/:id/edit" element={<OfferEdit />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/settings" element={<Settings />} />
                    </Routes>
                </Frame>
            </MemoryRouter>
        </AppProvider>
    );
}