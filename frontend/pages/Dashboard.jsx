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
  ProgressBar
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

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
        headers: { Authorization: `Bearer ${session?.accessToken}` }
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
    {
      title: 'Total Offers',
      value: metrics?.totalOffers || 0,
      color: 'primary'
    },
    {
      title: 'Impressions',
      value: metrics?.totalImpressions || 0,
      color: 'info'
    },
    {
      title: 'Clicks',
      value: metrics?.totalClicks || 0,
      color: 'success'
    },
    {
      title: 'Conversions',
      value: metrics?.totalConversions || 0,
      color: 'success'
    },
    {
      title: 'Revenue',
      value: formatCurrency(metrics?.totalRevenue || 0),
      color: 'success'
    },
    {
      title: 'Conversion Rate',
      value: formatPercent(metrics?.conversionRate || 0),
      color: 'warning'
    }
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
          <BlockStack gap="400">
            <InlineStack gap="400" wrap>
              {metricCards.map((metric, index) => (
                <div key={index} style={{ flex: '1 1 200px', minWidth: '200px' }}>
                  <Card>
                    <BlockStack gap="200">
                      <Text variant="bodyMd" as="p" color="subdued">
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
                  <Text variant="bodyMd" as="p" color="subdued">
                    No offer data available yet. Create your first offer to start tracking performance.
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Quick Actions
                </Text>
                
                <InlineStack gap="300">
                  <Button onClick={() => navigate('/offers/new')}>
                    Create New Offer
                  </Button>
                  <Button onClick={() => navigate('/offers')}>
                    View All Offers
                  </Button>
                  <Button onClick={() => navigate('/analytics')}>
                    View Analytics
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text variant="headingLg" as="h2">
                  Getting Started
                </Text>
                
                <BlockStack gap="200">
                  <div>
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p">
                        1. Create your first offer
                      </Text>
                      <Badge tone={metrics?.totalOffers > 0 ? 'success' : 'info'}>
                        {metrics?.totalOffers > 0 ? 'Complete' : 'Pending'}
                      </Badge>
                    </InlineStack>
                  </div>
                  
                  <div>
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p">
                        2. Customize your offer design
                      </Text>
                      <Badge tone="info">Optional</Badge>
                    </InlineStack>
                  </div>
                  
                  <div>
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p">
                        3. Publish and track performance
                      </Text>
                      <Badge tone={metrics?.totalConversions > 0 ? 'success' : 'info'}>
                        {metrics?.totalConversions > 0 ? 'Active' : 'Pending'}
                      </Badge>
                    </InlineStack>
                  </div>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default Dashboard;
