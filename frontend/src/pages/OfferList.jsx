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
    BlockStack,
    Modal
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import api from "../api/axios.js";

function OfferList() {

    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [offers, setOffers] = useState([]);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');

    const [deleteModal, setDeleteModal] = useState(false);
    const [offerToDelete, setOfferToDelete] = useState(null);

    useEffect(() => {
        fetchOffers();
    }, [filterStatus]);

    const fetchOffers = async () => {
        try {

            setLoading(true);
            setError(null);

            const params = {};
            if (filterStatus !== 'all') params.status = filterStatus;

            const response = await api.get('/offers', { params });

            setOffers(response.data.data || []);

        } catch (err) {

            console.error('Error fetching offers:', err);
            setError('Failed to load offers. Please try again.');

        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = async () => {

        try {

            await api.delete(`/offers/${offerToDelete}`);

            setDeleteModal(false);
            fetchOffers();

        } catch (err) {

            console.error('Error deleting offer:', err);
            setError('Failed to delete offer.');

        }
    };

    const handleDelete = (offerId) => {

        setOfferToDelete(offerId);
        setDeleteModal(true);

    };

    const handleStatusChange = async (offerId, newStatus) => {
        try {

            await api.patch(`/offers/${offerId}/status`, {
                status: newStatus
            });

            fetchOffers();

        } catch (err) {

            console.error("Error updating offer status:", err);

            if (err.response && err.response.data) {
                const backendMessage = err.response.data.error;

                if (backendMessage) {
                    if (backendMessage.includes("already exists")) {
                        setError(
                            "An active offer already exists for one or more of the selected products. Please pause it before activating this one."
                        );
                    } else {
                        setError(backendMessage);
                    }
                    return;
                }
            }

            setError("Unable to update offer status. Please try again.");
        }
    };

    const handleDuplicate = async (offerId) => {
        try {

            await api.post(`/offers/${offerId}/duplicate`);

            fetchOffers();

        } catch (err) {

            console.error("Error duplicating offer:", err);

            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError("Failed to duplicate offer.");
            }
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
            quantity_break: 'Quantity Break',
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

        <ButtonGroup>

            <Button size="slim" onClick={() => navigate(`/offers/${offer.id}/edit`)}>
                Edit
            </Button>

            {offer.status === 'active' ? (
                <Button
                    size="slim"
                    onClick={() => handleStatusChange(offer.id, 'paused')}
                >
                    Pause
                </Button>
            ) : (
                <Button
                    size="slim"
                    primary
                    onClick={() => handleStatusChange(offer.id, 'active')}
                >
                    Activate
                </Button>
            )}

            <Button
                size="slim"
                onClick={() => handleDuplicate(offer.id)}
            >
                Duplicate
            </Button>

            <Button
                size="slim"
                destructive
                onClick={() => handleDelete(offer.id)}
            >
                Delete
            </Button>

        </ButtonGroup>

    ]);

    if (loading) {

        return (
            <Page title="Offers" subtitle="Create and manage discounts to increase average order value">
                <Layout>
                    <Layout.Section>
                        <Card>
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <Spinner size="large" />
                                <Text>Loading offers...</Text>
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
            subtitle="Create and manage discounts to increase average order value"
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

                            {offers.length > 0 ? (

                                <DataTable
                                    columnContentTypes={['text','text','text','text']}
                                    headings={['Name','Type','Status','Actions']}
                                    rows={rows}
                                />

                            ) : (

                                <EmptyState
                                    heading="Create your first offer"
                                    image="https://cdn.shopify.com/shopifycloud/web/assets/v1/vite/client/en/assets/emptystate-discounts.png"
                                    action={{
                                        content: "Create Offer",
                                        onAction: () => navigate('/offers/new')
                                    }}
                                >
                                    <p>
                                        Increase your average order value using quantity discounts and bundles.
                                    </p>
                                </EmptyState>

                            )}

                        </Card>

                    </BlockStack>

                </Layout.Section>
            </Layout>

            <Modal
                open={deleteModal}
                onClose={() => setDeleteModal(false)}
                title="Delete offer?"
                primaryAction={{
                    content: 'Delete',
                    destructive: true,
                    onAction: confirmDelete
                }}
                secondaryActions={[
                    {
                        content: 'Cancel',
                        onAction: () => setDeleteModal(false)
                    }
                ]}
            >
                <Modal.Section>
                    <Text>This action cannot be undone.</Text>
                </Modal.Section>
            </Modal>

        </Page>

    );
}

export default OfferList;