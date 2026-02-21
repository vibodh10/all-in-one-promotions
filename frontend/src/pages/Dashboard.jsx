import React, { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    DataTable,
    Badge,
    Button,
    Text,
    BlockStack,
    InlineStack
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import api from "../api/axios.js";

function Dashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState(null);
    const [topOffers, setTopOffers] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            const response = await api.get('/analytics/dashboard', {
                params: { period: '30d' },
            });

            setMetrics(response.data.data);
            setTopOffers(response.data.data.topPerformingOffers || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const formatPercent = (value) => {
        return `${value.toFixed(2)}%`;
    };

    const metricCards = [
        { title: 'Total Offers', value: metrics?.totalOffers || 0 },
        { title: 'Impressions', value: metrics?.totalImpressions || 0 },
        { title: 'Clicks', value: metrics?.totalClicks || 0 },
        { title: 'Conversions', value: metrics?.totalConversions || 0 },
        { title: 'Revenue', value: formatCurrency(metrics?.totalRevenue || 0) },
        { title: 'Conversion Rate', value: formatPercent(metrics?.conversionRate || 0) }
    ];

    const offerRows = topOffers.map(offer => [
        offer.offerName,
        offer.impressions,
        offer.clicks,
        offer.conversions,
        formatCurrency(offer.revenue),
        formatPercent(offer.conversionRate)
    ]);

    return (
        <Page
            title="Dashboard"
            primaryAction={{
                content: 'Create Offer',
                onAction: () => navigate('/offers/new')
            }}
        >
            <Layout>
                <Layout.Section>
                    <BlockStack gap="500">

                        {/* Metrics */}
                        <InlineStack gap="400" wrap>
                            {metricCards.map((metric, index) => (
                                <div key={index} style={{ flex: '1 1 200px', minWidth: '200px' }}>
                                    <Card>
                                        <BlockStack gap="200">
                                            <Text variant="bodyMd" as="p" tone="subdued">
                                                {metric.title}
                                            </Text>
                                            <Text variant="heading2xl" as="h3">
                                                {metric.value}
                                            </Text>
                                        </BlockStack>
                                    </Card>
                                </div>
                            ))}
                        </InlineStack>

                        {/* Navigation Section */}
                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingLg" as="h2">
                                    Manage Your App
                                </Text>

                                <InlineStack gap="300" wrap>
                                    <Button onClick={() => navigate('/offers')} size="large">
                                        Manage Offers
                                    </Button>

                                    <Button onClick={() => navigate('/offers/new')} size="large">
                                        Create Offer
                                    </Button>

                                    <Button onClick={() => navigate('/analytics')} size="large">
                                        View Analytics
                                    </Button>

                                    <Button onClick={() => navigate('/settings')} size="large">
                                        App Settings
                                    </Button>
                                </InlineStack>
                            </BlockStack>
                        </Card>

                        {/* Top Offers */}
                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingLg" as="h2">
                                    Top Performing Offers (Last 30 Days)
                                </Text>

                                {topOffers.length > 0 ? (
                                    <DataTable
                                        columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric', 'numeric']}
                                        headings={['Offer Name', 'Impressions', 'Clicks', 'Conversions', 'Revenue', 'Conv. Rate']}
                                        rows={offerRows}
                                    />
                                ) : (
                                    <Text variant="bodyMd" as="p" tone="subdued">
                                        No offer data available yet. Create your first offer to start tracking performance.
                                    </Text>
                                )}
                            </BlockStack>
                        </Card>

                        {/* Getting Started */}
                        <Card>
                            <BlockStack gap="300">
                                <Text variant="headingLg" as="h2">
                                    Getting Started
                                </Text>

                                <InlineStack align="space-between">
                                    <Text>Create your first offer</Text>
                                    <Badge tone={metrics?.totalOffers > 0 ? 'success' : 'info'}>
                                        {metrics?.totalOffers > 0 ? 'Complete' : 'Pending'}
                                    </Badge>
                                </InlineStack>

                                <InlineStack align="space-between">
                                    <Text>Activate your offer</Text>
                                    <Badge tone={metrics?.totalConversions > 0 ? 'success' : 'info'}>
                                        {metrics?.totalConversions > 0 ? 'Active' : 'Pending'}
                                    </Badge>
                                </InlineStack>
                            </BlockStack>
                        </Card>

                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export default Dashboard;