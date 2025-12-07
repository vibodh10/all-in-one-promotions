import React from "react";
import { Page, Layout, Card, Text } from "@shopify/polaris";

function App() {
    return (
        <Page title="Hello Shopify">
            <Layout>
                <Layout.Section>
                    <Card>
                        <Text variant="headingLg" as="h2">
                            App is rendering ✅
                        </Text>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export default App;
