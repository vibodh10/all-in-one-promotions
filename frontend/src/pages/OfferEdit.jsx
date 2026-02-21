import React, { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    FormLayout,
    TextField,
    Select,
    Button,
    BlockStack,
    InlineStack,
    Banner,
    Spinner,
    Text
} from '@shopify/polaris';
import { useNavigate, useParams } from 'react-router-dom';

import axios from 'axios';

function OfferEdit() {
    const navigate = useNavigate();
    const { id } = useParams();
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [offerData, setOfferData] = useState({
        name: '',
        description: '',
        type: 'quantity_break',
        products: [],
        collections: [],
        discountType: 'percentage',
        discountValue: 10,
        tiers: [],
        bundleConfig: {
            minItems: 2,
            maxItems: null,
            allowMixMatch: false
        },
        displaySettings: {
            widget: 'inline',
            position: 'below_atc',
            showProgressBar: true,
            showSavings: true
        },
        styling: {
            primaryColor: '#000000',
            secondaryColor: '#ffffff',
            fontFamily: 'inherit',
            borderRadius: '4px'
        },
        status: 'draft'
    });

    const offerTypes = [
        { label: 'Quantity Breaks & Free Gift', value: 'quantity_break' },
        { label: 'Bundle & Save More', value: 'bundle' },
        { label: 'Volume Discount', value: 'volume_discount' },
        { label: 'Related Products / Cross-Sell', value: 'cross_sell' }
    ];

    const discountTypes = [
        { label: 'Percentage Off', value: 'percentage' },
        { label: 'Fixed Amount Off', value: 'fixed_amount' }
    ];

    const statusOptions = [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' }
    ];

    useEffect(() => {
        fetchOffer();
    }, [id]);

    const fetchOffer = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.get(`/api/offers/${id}`, {
                
            });

            setOfferData(response.data.data);
        } catch (err) {
            console.error('Error fetching offer:', err);
            setError('Failed to load offer. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setOfferData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleNestedChange = (parent, field, value) => {
        setOfferData(prev => ({
            ...prev,
            [parent]: {
                ...prev[parent],
                [field]: value
            }
        }));
    };

    const addTier = () => {
        const lastTier = offerData.tiers[offerData.tiers.length - 1];
        const newTier = lastTier
            ? { quantity: lastTier.quantity + 1, discount: lastTier.discount + 5 }
            : { quantity: 2, discount: 10 };

        setOfferData(prev => ({
            ...prev,
            tiers: [...prev.tiers, newTier]
        }));
    };

    const removeTier = (index) => {
        setOfferData(prev => ({
            ...prev,
            tiers: prev.tiers.filter((_, i) => i !== index)
        }));
    };

    const updateTier = (index, field, value) => {
        setOfferData(prev => ({
            ...prev,
            tiers: prev.tiers.map((tier, i) =>
                i === index ? { ...tier, [field]: parseFloat(value) || 0 } : tier
            )
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            await axios.put(
                `/api/offers/${id}`,
                offerData,
                {  }
            );

            setSuccess('Offer updated successfully!');

            // Redirect after brief delay
            setTimeout(() => {
                navigate('/offers');
            }, 1500);
        } catch (err) {
            console.error('Error updating offer:', err);
            setError('Failed to update offer. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this offer? This cannot be undone.')) {
            return;
        }

        try {
            setSaving(true);
            setError(null);

            await axios.delete(`/api/offers/${id}`, {
                
            });

            navigate('/offers');
        } catch (err) {
            console.error('Error deleting offer:', err);
            setError('Failed to delete offer. Please try again.');
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Page title="Edit Offer">
                <Layout>
                    <Layout.Section>
                        <Card>
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <Spinner size="large" />
                                <Text variant="bodyMd" as="p" color="subdued">
                                    Loading offer...
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
            title={`Edit: ${offerData.name}`}
            backAction={{ content: 'Offers', onAction: () => navigate('/offers') }}
        >
            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        {error && (
                            <Banner tone="critical" onDismiss={() => setError(null)}>
                                {error}
                            </Banner>
                        )}

                        {success && (
                            <Banner tone="success" onDismiss={() => setSuccess(null)}>
                                {success}
                            </Banner>
                        )}

                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h2">
                                    Basic Information
                                </Text>

                                <FormLayout>
                                    <TextField
                                        label="Offer Name"
                                        value={offerData.name}
                                        onChange={(value) => handleChange('name', value)}
                                        autoComplete="off"
                                    />

                                    <TextField
                                        label="Description"
                                        value={offerData.description}
                                        onChange={(value) => handleChange('description', value)}
                                        multiline={3}
                                        autoComplete="off"
                                    />

                                    <Select
                                        label="Offer Type"
                                        options={offerTypes}
                                        value={offerData.type}
                                        onChange={(value) => handleChange('type', value)}
                                    />

                                    <Select
                                        label="Status"
                                        options={statusOptions}
                                        value={offerData.status}
                                        onChange={(value) => handleChange('status', value)}
                                    />
                                </FormLayout>
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h2">
                                    Discount Configuration
                                </Text>

                                <FormLayout>
                                    <Select
                                        label="Discount Type"
                                        options={discountTypes}
                                        value={offerData.discountType}
                                        onChange={(value) => handleChange('discountType', value)}
                                    />

                                    {offerData.type === 'quantity_break' && (
                                        <BlockStack gap="300">
                                            <Text variant="bodyMd" as="p" fontWeight="semibold">
                                                Discount Tiers
                                            </Text>

                                            {offerData.tiers.map((tier, index) => (
                                                <InlineStack key={index} gap="200" align="center">
                                                    <TextField
                                                        label="Quantity"
                                                        type="number"
                                                        value={tier.quantity.toString()}
                                                        onChange={(value) => updateTier(index, 'quantity', value)}
                                                        autoComplete="off"
                                                    />

                                                    <TextField
                                                        label="Discount"
                                                        type="number"
                                                        value={tier.discount.toString()}
                                                        onChange={(value) => updateTier(index, 'discount', value)}
                                                        suffix={offerData.discountType === 'percentage' ? '%' : '$'}
                                                        autoComplete="off"
                                                    />

                                                    {offerData.tiers.length > 1 && (
                                                        <Button onClick={() => removeTier(index)} destructive>
                                                            Remove
                                                        </Button>
                                                    )}
                                                </InlineStack>
                                            ))}

                                            <Button onClick={addTier}>Add Tier</Button>
                                        </BlockStack>
                                    )}

                                    {offerData.type === 'bundle' && (
                                        <TextField
                                            label="Bundle Discount"
                                            type="number"
                                            value={offerData.discountValue.toString()}
                                            onChange={(value) => handleChange('discountValue', parseFloat(value) || 0)}
                                            suffix={offerData.discountType === 'percentage' ? '%' : '$'}
                                            autoComplete="off"
                                        />
                                    )}
                                </FormLayout>
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h2">
                                    Styling
                                </Text>

                                <FormLayout>
                                    <TextField
                                        label="Primary Color"
                                        type="color"
                                        value={offerData.styling.primaryColor}
                                        onChange={(value) => handleNestedChange('styling', 'primaryColor', value)}
                                        autoComplete="off"
                                    />

                                    <TextField
                                        label="Secondary Color"
                                        type="color"
                                        value={offerData.styling.secondaryColor}
                                        onChange={(value) => handleNestedChange('styling', 'secondaryColor', value)}
                                        autoComplete="off"
                                    />

                                    <TextField
                                        label="Border Radius"
                                        value={offerData.styling.borderRadius}
                                        onChange={(value) => handleNestedChange('styling', 'borderRadius', value)}
                                        autoComplete="off"
                                    />
                                </FormLayout>
                            </BlockStack>
                        </Card>

                        <Card>
                            <InlineStack align="space-between">
                                <Button destructive onClick={handleDelete} disabled={saving}>
                                    Delete Offer
                                </Button>

                                <InlineStack gap="200">
                                    <Button onClick={() => navigate('/offers')}>
                                        Cancel
                                    </Button>
                                    <Button primary onClick={handleSave} loading={saving}>
                                        Save Changes
                                    </Button>
                                </InlineStack>
                            </InlineStack>
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export default OfferEdit;