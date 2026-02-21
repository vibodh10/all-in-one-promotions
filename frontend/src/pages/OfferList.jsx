import React, { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    DataTable,
    Badge,
    Button,
    ButtonGroup,
    Text,
    EmptyState,
    Spinner,
    Banner,
    InlineStack,
    BlockStack
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import api from "../api/axios.js";

function OfferList() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [offers, setOffers] = useState([]);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        fetchOffers();
    }, [filterStatus]);

    const fetchOffers = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = {};
            if (filterStatus !== 'all') {
                params.status = filterStatus;
            }

            const response = await api.get('/offers', {
                params,
            });

            setOffers(response.data.data || []);
        } catch (err) {
            console.error('Error fetching offers:', err);
            setError('Failed to load offers. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (offerId, newStatus) => {
        try {
            await api.patch(
                `/offers/${offerId}/status`,
                { status: newStatus },
                {  }
            );

            // Refresh offers list
            fetchOffers();
        } catch (err) {
            console.error('Error updating offer status:', err);
            setError('Failed to update offer status.');
        }
    };

    const handleDuplicate = async (offerId) => {
        try {
            await api.post(
                `/offers/${offerId}/duplicate`,
                {},
                {  }
            );

            // Refresh offers list
            fetchOffers();
        } catch (err) {
            console.error('Error duplicating offer:', err);
            setError('Failed to duplicate offer.');
        }
    };

    const handleDelete = async (offerId) => {
        if (!confirm('Are you sure you want to delete this offer?')) {
            return;
        }

        try {
            await api.delete(`/api/offers/${offerId}`, {
                
            });

            // Refresh offers list
            fetchOffers();
        } catch (err) {
            console.error('Error deleting offer:', err);
            setError('Failed to delete offer.');
        }
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            active: { tone: 'success', label: 'Active' },
            draft: { tone: 'info', label: 'Draft' },
            paused: { tone: 'warning', label: 'Paused' },
            scheduled: { tone: 'attention', label: 'Scheduled' }
        };

        const config = statusMap[status] || { tone: 'info', label: status };
        return <Badge tone={config.tone}>{config.label}</Badge>;
    };

    const getOfferTypeLabel = (type) => {
        const typeMap = {
            quantity_break: 'Quantity Breaks',
            bundle: 'Bundle & Save',
            volume_discount: 'Volume Discount',
            cross_sell: 'Cross-Sell',
            cart_upsell: 'Cart Upsell'
        };

        return typeMap[type] || type;
    };

    const rows = offers.map((offer) => [
        offer.name,
        getOfferTypeLabel(offer.type),
        getStatusBadge(offer.status),
        offer.analytics?.impressions || 0,
        offer.analytics?.clicks || 0,
        offer.analytics?.conversions || 0,
        new Date(offer.createdAt).toLocaleDateString(),
        <ButtonGroup>
            <Button size="slim" onClick={() => navigate(`/offers/${offer.id}/edit`)}>
                Edit
            </Button>
            {offer.status === 'active' ? (
                <Button size="slim" onClick={() => handleStatusChange(offer.id, 'paused')}>
                    Pause
                </Button>
            ) : (
                <Button size="slim" primary onClick={() => handleStatusChange(offer.id, 'active')}>
                    Activate
                </Button>
            )}
            <Button size="slim" onClick={() => handleDuplicate(offer.id)}>
                Duplicate
            </Button>
            <Button size="slim" destructive onClick={() => handleDelete(offer.id)}>
                Delete
            </Button>
        </ButtonGroup>
    ]);

    if (loading) {
        return (
            <Page title="Offers">
                <Layout>
                    <Layout.Section>
                        <Card>
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <Spinner size="large" />
                                <Text variant="bodyMd" as="p" color="subdued">
                                    Loading offers...
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
            title="Offers"
            primaryAction={{
                content: 'Create Offer',
                onAction: () => navigate('/offers/new')
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
                                        All Offers ({offers.length})
                                    </Text>
                                    <ButtonGroup>
                                        <Button
                                            pressed={filterStatus === 'all'}
                                            onClick={() => setFilterStatus('all')}
                                        >
                                            All
                                        </Button>
                                        <Button
                                            pressed={filterStatus === 'active'}
                                            onClick={() => setFilterStatus('active')}
                                        >
                                            Active
                                        </Button>
                                        <Button
                                            pressed={filterStatus === 'draft'}
                                            onClick={() => setFilterStatus('draft')}
                                        >
                                            Draft
                                        </Button>
                                        <Button
                                            pressed={filterStatus === 'paused'}
                                            onClick={() => setFilterStatus('paused')}
                                        >
                                            Paused
                                        </Button>
                                    </ButtonGroup>
                                </InlineStack>

                                {offers.length > 0 ? (
                                    <DataTable
                                        columnContentTypes={[
                                            'text',
                                            'text',
                                            'text',
                                            'numeric',
                                            'numeric',
                                            'numeric',
                                            'text',
                                            'text'
                                        ]}
                                        headings={[
                                            'Name',
                                            'Type',
                                            'Status',
                                            'Impressions',
                                            'Clicks',
                                            'Conversions',
                                            'Created',
                                            'Actions'
                                        ]}
                                        rows={rows}
                                    />
                                ) : (
                                    <EmptyState
                                        heading="No offers found"
                                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                                    >
                                        <p>Create your first offer to start increasing conversions and AOV.</p>
                                        <Button primary onClick={() => navigate('/offers/new')}>
                                            Create Offer
                                        </Button>
                                    </EmptyState>
                                )}
                            </BlockStack>
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export default OfferList;