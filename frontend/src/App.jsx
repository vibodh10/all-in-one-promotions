import React from "react";
import { AppProvider, Frame, Page } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import enTranslations from "@shopify/polaris/locales/en.json";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import OfferBuilder from "./pages/OfferBuilder.jsx";

export default function App() {
    return (
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
    );
}
