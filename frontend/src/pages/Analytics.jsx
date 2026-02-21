import React, { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    DataTable,
    Select,
    Button,
    Text,
    BlockStack,
    InlineStack,
    Spinner,
    Banner
} from '@shopify/polaris';

import axios from 'axios';
import api from "../api/axios.js";

function Analytics() {
    
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState(null);
    const [period, setPeriod] = useState('30d');
    const [error, setError] = useState(null);
    const [exporting, setExporting] = useState(false);

    const periodOptions = [
        { label: 'Last 7 Days', value: '7d' },
        { label: 'Last 30 Days', value: '30d' },
        { label: 'Last 90 Days', value: '90d' }
    ];

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.get('/analytics/dashboard', {
                params: { period },
                
            });

            setMetrics(response.data.data);
        } catch (err) {
            console.error('Error fetching analytics:', err);
            setError('Failed to load analytics. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            setExporting(true);
            setError(null);

            const response = await api.get('/analytics/export', {
                params: {
                    period,
                    startDate: getStartDate(period),
                    endDate: new Date().toISOString()
                },
                responseType: 'blob'
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `analytics-${period}-${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Error exporting analytics:', err);
            setError('Failed to export analytics. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const getStartDate = (period) => {
        const date = new Date();
        switch (period) {
            case '7d':
                date.setDate(date.getDate() - 7);
                break;
            case '30d':
                date.setDate(date.getDate() - 30);
                break;
            case '90d':
                date.setDate(date.getDate() - 90);
                break;
            default:
                date.setDate(date.getDate() - 30);
        }
        return date.toISOString();
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

    const formatNumber = (value) => {
        return new Intl.NumberFormat('en-US').format(value);
    };

    const overviewMetrics = metrics ? [
        {
            title: 'Total Offers',
            value: formatNumber(metrics.totalOffers),
            description: 'Active offers running'
        },
        {
            title: 'Total Impressions',
            value: formatNumber(metrics.totalImpressions),
            description: 'Times offers were viewed'
        },
        {
            title: 'Total Clicks',
            value: formatNumber(metrics.totalClicks),
            description: 'User interactions with offers'
        },
        {
            title: 'Total Conversions',
            value: formatNumber(metrics.totalConversions),
            description: 'Completed purchases'
        },
        {
            title: 'Total Revenue',
            value: formatCurrency(metrics.totalRevenue),
            description: 'Generated from offers'
        },
        {
            title: 'Click-Through Rate',
            value: formatPercent(metrics.clickThroughRate),
            description: 'Clicks / Impressions'
        },
        {
            title: 'Conversion Rate',
            value: formatPercent(metrics.conversionRate),
            description: 'Conversions / Impressions'
        },
        {
            title: 'Average Order Value',
            value: formatCurrency(metrics.averageOrderValue),
            description: 'Per converted order'
        }
    ] : [];

    const offerRows = metrics?.topPerformingOffers?.map(offer => [
        offer.offerName,
        formatNumber(offer.impressions),
        formatNumber(offer.clicks),
        formatNumber(offer.conversions),
        formatCurrency(offer.revenue),
        formatPercent(offer.conversionRate || 0)
    ]) || [];

    if (loading) {
        return (
            <Page title="Analytics">
                <Layout>
                    <Layout.Section>
                        <Card>
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <Spinner size="large" />
                                <Text variant="bodyMd" as="p" color="subdued">
                                    Loading analytics...
                                </Text>
                            </div>
                        </Card>
                    </Layout.Section>
                </Layout>
            </Page>
        );
    }

    return (
        <Page
            title="Analytics"
            primaryAction={{
                content: 'Export CSV',
                onAction: handleExport,
                loading: exporting
            }}
        >
            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        {error && (
                            <Banner tone="critical" onDismiss={() => setError(null)}>
                                {error}
                            </Banner>
                        )}

                        <Card>
                            <BlockStack gap="300">
                                <InlineStack align="space-between">
                                    <Text variant="headingMd" as="h2">
                                        Performance Overview
                                    </Text>
                                    <Select
                                        label=""
                                        options={periodOptions}
                                        value={period}
                                        onChange={(value) => setPeriod(value)}
                                    />
                                </InlineStack>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: '16px'
                                }}>
                                    {overviewMetrics.map((metric, index) => (
                                        <Card key={index}>
                                            <BlockStack gap="200">
                                                <Text variant="bodyMd" as="p" color="subdued">
                                                    {metric.title}
                                                </Text>
                                                <Text variant="headingLg" as="h3">
                                                    {metric.value}
                                                </Text>
                                                <Text variant="bodySm" as="p" color="subdued">
                                                    {metric.description}
                                                </Text>
                                            </BlockStack>
                                        </Card>
                                    ))}
                                </div>
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h2">
                                    Top Performing Offers
                                </Text>

                                {offerRows.length > 0 ? (
                                    <DataTable
                                        columnContentTypes={[
                                            'text',
                                            'numeric',
                                            'numeric',
                                            'numeric',
                                            'numeric',
                                            'numeric'
                                        ]}
                                        headings={[
                                            'Offer Name',
                                            'Impressions',
                                            'Clicks',
                                            'Conversions',
                                            'Revenue',
                                            'Conv. Rate'
                                        ]}
                                        rows={offerRows}
                                    />
                                ) : (
                                    <Text variant="bodyMd" as="p" color="subdued">
                                        No data available for the selected period.
                                    </Text>
                                )}
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="300">
                                <Text variant="headingMd" as="h2">
                                    Insights & Recommendations
                                </Text>

                                <BlockStack gap="200">
                                    {metrics?.conversionRate < 1 && (
                                        <Banner tone="info">
                                            <p>
                                                <strong>Low conversion rate detected.</strong> Consider adjusting your offer value or targeting to improve performance.
                                            </p>
                                        </Banner>
                                    )}

                                    {metrics?.clickThroughRate < 5 && (
                                        <Banner tone="warning">
                                            <p>
                                                <strong>Low click-through rate.</strong> Try improving your offer design or placement to increase engagement.
                                            </p>
                                        </Banner>
                                    )}

                                    {metrics?.totalOffers === 0 && (
                                        <Banner tone="info">
                                            <p>
                                                <strong>No active offers.</strong> Create your first offer to start tracking performance!
                                            </p>
                                        </Banner>
                                    )}

                                    {metrics?.conversionRate >= 5 && (
                                        <Banner tone="success">
                                            <p>
                                                <strong>Great performance!</strong> Your offers are converting well. Consider creating similar offers for other products.
                                            </p>
                                        </Banner>
                                    )}
                                </BlockStack>
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="300">
                                <Text variant="headingMd" as="h2">
                                    Export Options
                                </Text>

                                <Text variant="bodyMd" as="p">
                                    Download detailed analytics data as CSV for further analysis in Excel or other tools.
                                </Text>

                                <InlineStack gap="200">
                                    <Button onClick={handleExport} loading={exporting}>
                                        Export Current Period
                                    </Button>
                                    <Button onClick={() => {
                                        setPeriod('90d');
                                        setTimeout(handleExport, 1000);
                                    }} loading={exporting}>
                                        Export Last 90 Days
                                    </Button>
                                </InlineStack>
                            </BlockStack>
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export default Analytics;