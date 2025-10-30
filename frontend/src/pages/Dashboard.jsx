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
    InlineStack,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// ✅ Adjust this if AuthContext is missing
// Create a dummy useAuth if you don’t have it yet
// import { useAuth } from '../contexts/AuthContext';
const useAuth = () => ({ session: { accessToken: '' } });

function Dashboard() {
    const navigate = useNavigate();
    const { session } = useAuth();
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState(null);
    const [topOffers, setTopOffers] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            const response = await axios.get('/api/analytics/dashboard', {
                params: { period: '30d' },
                headers: { Authorization: `Bearer ${session?.accessToken}` },
            });

            setMetrics(response.data.data);
            setTopOffers(response.data.data.topPerformingOffers || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);

    const formatPercent = (value) => `${value.toFixed(2)}%`;

    const metricCards = [
        { title: 'Total Offers', value: metrics?.totalOffers || 0 },
        { title: 'Impressions', value: metrics?.totalImpressions || 0 },
        { title: 'Clicks', value: metrics?.totalClicks || 0 },
        { title: 'Conversions', value: metrics?.totalConversions || 0 },
        { title: 'Revenue', value: formatCurrency(metrics?.totalRevenue || 0) },
        { title: 'Conversion Rate', value: formatPercent(metrics?.conversionRate || 0) },
    ];

    const offerRows = topOffers.map((offer) => [
        offer.offerName,
        offer.impressions,
        offer.clicks,
        offer.conversions,
        formatCurrency(offer.revenue),
        formatPercent(offer.conversionRate),
    ]);

    return (
        <Page
            title="Dashboard"
            primaryAction={{
                content: 'Create Offer',
                onAction: () => navigate('/offers/new'),
            }}
        >
            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        {/* Summary Cards */}
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

                        {/* Top Offers Table */}
                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingLg" as="h2">
                                    Top Performing Offers (Last 30 Days)
                                </Text>

                                {topOffers.length > 0 ? (
                                    <DataTable
                                        columnContentTypes={[
                                            'text',
                                            'numeric',
                                            'numeric',
                                            'numeric',
                                            'numeric',
                                            'numeric',
                                        ]}
                                        headings={[
                                            'Offer Name',
                                            'Impressions',
                                            'Clicks',
                                            'Conversions',
                                            'Revenue',
                                            'Conv. Rate',
                                        ]}
                                        rows={offerRows}
                                    />
                                ) : (
                                    <Text variant="bodyMd" as="p" tone="subdued">
                                        No offer data available yet. Create your first offer to start tracking performance.
                                    </Text>
                                )}
                            </BlockStack>
                        </Card>

                        {/* Quick Actions */}
                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingLg" as="h2">
                                    Quick Actions
                                </Text>
                                <InlineStack gap="300">
                                    <Button onClick={() => navigate('/offers/new')}>Create New Offer</Button>
                                    <Button onClick={() => navigate('/offers')}>View All Offers</Button>
                                    <Button onClick={() => navigate('/analytics')}>View Analytics</Button>
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
