import '@shopify/polaris/build/esm/styles.css';
import React from 'react';
import { AppProvider, Frame, Page, Card, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';

export default function App() {
    return (
        <AppProvider i18n={enTranslations}>
            <Frame>
                <Page title="Sanity Test">
                    <Card>
                        <Text variant="headingLg" as="h2">
                            ✅ Polaris is rendering properly
                        </Text>
                    </Card>
                </Page>
            </Frame>
        </AppProvider>
    );
}
