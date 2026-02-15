import React, { useState, useCallback } from 'react';
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
    Text,
    ResourceList,
    ResourceItem,
    Banner,
    Thumbnail,
} from '@shopify/polaris';
import { ResourcePicker } from '@shopify/app-bridge/actions';
import { useNavigate } from 'react-router-dom';
import { DeleteIcon } from '@shopify/polaris-icons';
import axios from 'axios';

import { useAppBridge } from '@shopify/app-bridge-react';

function OfferBuilder() {
    const navigate = useNavigate();
    const app = useAppBridge();

    window.appBridge = app; // ✅ Ensures picker can find it

    const [step, setStep] = useState(1);
    const [errors, setErrors] = useState([]);

    const [offerData, setOfferData] = useState({
        name: '',
        description: '',
        type: 'quantity_break',
        products: [],
        collections: [],
        discountType: 'percentage',
        discountValue: 10,
        tiers: [
            { quantity: 2, discount: 10 },
            { quantity: 3, discount: 15 },
        ],
        bundleConfig: {
            minItems: 2,
            maxItems: null,
            allowMixMatch: false,
        },
        displaySettings: {
            widget: 'inline',
            position: 'below_atc',
            showProgressBar: true,
            showSavings: true,
        },
        styling: {
            primaryColor: '#000000',
            secondaryColor: '#ffffff',
            fontFamily: 'inherit',
            borderRadius: '4px',
        },
        status: 'draft',
    });

    const offerTypes = [
        { label: 'Quantity Breaks & Free Gift', value: 'quantity_break' },
        { label: 'Bundle & Save More', value: 'bundle' },
        { label: 'Volume Discount', value: 'volume_discount' },
        { label: 'Related Products / Cross-Sell', value: 'cross_sell' },
    ];

    const discountTypes = [
        { label: 'Percentage Off', value: 'percentage' },
        { label: 'Fixed Amount Off', value: 'fixed_amount' },
    ];

    const widgetTypes = [
        { label: 'Inline Widget', value: 'inline' },
        { label: 'Modal Popup', value: 'modal' },
        { label: 'Side Drawer', value: 'drawer' },
    ];

    const positionOptions = [
        { label: 'Below Add to Cart', value: 'below_atc' },
        { label: 'Above Add to Cart', value: 'above_atc' },
        { label: 'Product Tabs', value: 'product_tabs' },
    ];

    // ---- Field Handlers ---- //
    const handleChange = (field, value) =>
        setOfferData((prev) => ({ ...prev, [field]: value }));

    const handleNestedChange = (parent, field, value) =>
        setOfferData((prev) => ({
            ...prev,
            [parent]: { ...prev[parent], [field]: value },
        }));

    // ---- Product Picker ---- //
    const openProductPicker = useCallback(() => {
        if (!app) {
            console.error("App Bridge not ready yet");
            return;
        }

        try {
            const picker = ResourcePicker.create(app, {
                resourceType: ResourcePicker.ResourceType.Product,
                options: {
                    selectMultiple: true,
                },
            });

            picker.subscribe(ResourcePicker.Action.SELECT, (payload) => {
                const selected = payload.selection.map((p) => ({
                    id: p.id,
                    title: p.title,
                    images: p.images,
                }));
                setOfferData((prev) => ({ ...prev, products: selected }));
                setErrors([]);
            });

            picker.dispatch(ResourcePicker.Action.OPEN);
        } catch (err) {
            console.error("Error opening picker:", err);
            setErrors(["Failed to select products. Please try again."]);
        }
    }, [app]);

    const openCollectionPicker = () => {
        console.log("AppBridge instance:", app);
        console.log("window.shopify:", window.shopify);
        console.log("Host param:", new URLSearchParams(window.location.search).get('host'));

        try {
            if (!app) {
                console.error('App Bridge not initialized');
                setErrors(['Shopify App Bridge not ready. Please refresh and try again.']);
                return;
            }

            const picker = ResourcePicker.create(app, {
                resourceType: ResourcePicker.ResourceType.Collection,
                options: {
                    selectMultiple: true,
                    app, // ✅ Add this line here too
                },
            });

            picker.subscribe(ResourcePicker.Action.SELECT, (payload) => {
                const selected = payload.selection.map((c) => ({
                    id: c.id,
                    title: c.title,
                    image: c.image,
                }));

                setOfferData((prev) => ({
                    ...prev,
                    collections: [
                        ...prev.collections,
                        ...selected.filter((c) => !prev.collections.some((x) => x.id === c.id)),
                    ],
                }));

                setErrors([]);
            });

            picker.subscribe(ResourcePicker.Action.CANCEL, () => {
                console.log('Collection selection canceled');
            });

            picker.dispatch(ResourcePicker.Action.OPEN);
        } catch (err) {
            console.error('Error opening collection picker:', err);
            setErrors(['Failed to select collections. Please try again.']);
        }
    };

    const removeProduct = useCallback((id) => {
        setOfferData((prev) => ({
            ...prev,
            products: prev.products.filter((p) => p.id !== id),
        }));
    }, []);

    const removeCollection = useCallback((id) => {
        setOfferData((prev) => ({
            ...prev,
            collections: prev.collections.filter((c) => c.id !== id),
        }));
    }, []);

    // ---- Discount Tier Logic ---- //
    const addTier = () => {
        const lastTier = offerData.tiers[offerData.tiers.length - 1];
        setOfferData((prev) => ({
            ...prev,
            tiers: [
                ...prev.tiers,
                { quantity: lastTier.quantity + 1, discount: lastTier.discount + 5 },
            ],
        }));
    };

    const removeTier = (index) =>
        setOfferData((prev) => ({
            ...prev,
            tiers: prev.tiers.filter((_, i) => i !== index),
        }));

    const updateTier = (index, field, value) =>
        setOfferData((prev) => ({
            ...prev,
            tiers: prev.tiers.map((tier, i) =>
                i === index ? { ...tier, [field]: parseFloat(value) || 0 } : tier
            ),
        }));

    // ---- Validation ---- //
    const validateStep = (s) => {
        const newErrors = [];
        if (s === 1 && !offerData.name.trim())
            newErrors.push('Offer name is required');
        if (s === 2 && offerData.products.length === 0)
            newErrors.push('Select at least one product or collection');
        if (s === 3 && offerData.tiers.length === 0)
            newErrors.push('Add at least one discount tier');
        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const nextStep = () => validateStep(step) && setStep(step + 1);
    const prevStep = () => {
        setErrors([]);
        setStep(step - 1);
    };

    // ---- Save Offer ---- //
    const saveOffer = async (publish = false) => {
        try {
            const payload = { ...offerData, status: publish ? 'active' : 'draft' };
            const { data } = await axios.post('/api/offers', payload);
            if (data.success) navigate('/offers');
        } catch {
            setErrors(['Failed to save offer. Try again.']);
        }
    };

    // ---- Step Renderers ---- //
    const renderStep1 = () => (
        <Card>
            <FormLayout>
                <TextField
                    label="Offer Name"
                    value={offerData.name}
                    onChange={(v) => handleChange('name', v)}
                />
                <TextField
                    label="Description"
                    multiline={3}
                    value={offerData.description}
                    onChange={(v) => handleChange('description', v)}
                />
                <Select
                    label="Offer Type"
                    options={offerTypes}
                    value={offerData.type}
                    onChange={(v) => handleChange('type', v)}
                />
            </FormLayout>
        </Card>
    );

    const renderStep2 = () => (
        <Card>
            <BlockStack gap="400">
                <InlineStack gap="300">
                    <Button onClick={openProductPicker}>Select Products</Button>
                    <Button onClick={openCollectionPicker}>Select Collections</Button>
                </InlineStack>

                <ResourceList
                    resourceName={{ singular: 'product', plural: 'products' }}
                    items={offerData.products}
                    renderItem={(item) => {
                        const media = item.images?.[0]?.originalSrc ? (
                            <Thumbnail source={item.images[0].originalSrc} alt={item.title} />
                        ) : null;
                        return (
                            <ResourceItem id={item.id} media={media}>
                                <InlineStack align="space-between">
                                    <Text>{item.title}</Text>
                                    <Button plain icon={DeleteIcon} onClick={() => removeProduct(item.id)} />
                                </InlineStack>
                            </ResourceItem>
                        );
                    }}
                />
            </BlockStack>
        </Card>
    );

    const renderStep3 = () => (
        <Card>
            <FormLayout>
                <Select
                    label="Discount Type"
                    options={discountTypes}
                    value={offerData.discountType}
                    onChange={(v) => handleChange('discountType', v)}
                />
                {offerData.tiers.map((tier, i) => (
                    <InlineStack key={i} gap="200" align="center">
                        <TextField
                            label="Quantity"
                            type="number"
                            value={tier.quantity.toString()}
                            onChange={(v) => updateTier(i, 'quantity', v)}
                        />
                        <TextField
                            label="Discount"
                            type="number"
                            value={tier.discount.toString()}
                            suffix={offerData.discountType === 'percentage' ? '%' : '£'}
                            onChange={(v) => updateTier(i, 'discount', v)}
                        />
                        {offerData.tiers.length > 1 && (
                            <Button icon={DeleteIcon} onClick={() => removeTier(i)} />
                        )}
                    </InlineStack>
                ))}
                <Button onClick={addTier}>Add Tier</Button>
            </FormLayout>
        </Card>
    );

    const renderStep4 = () => (
        <Card>
            <FormLayout>
                <Select
                    label="Widget Type"
                    options={widgetTypes}
                    value={offerData.displaySettings.widget}
                    onChange={(v) => handleNestedChange('displaySettings', 'widget', v)}
                />
                <Select
                    label="Position"
                    options={positionOptions}
                    value={offerData.displaySettings.position}
                    onChange={(v) => handleNestedChange('displaySettings', 'position', v)}
                />
                <TextField
                    label="Primary Color"
                    type="color"
                    value={offerData.styling.primaryColor}
                    onChange={(v) => handleNestedChange('styling', 'primaryColor', v)}
                />
                <TextField
                    label="Border Radius"
                    suffix="px"
                    value={offerData.styling.borderRadius}
                    onChange={(v) => handleNestedChange('styling', 'borderRadius', v)}
                />
            </FormLayout>
        </Card>
    );

    // ---- UI ---- //
    return (
        <Page
            title="Create New Offer"
            backAction={{ content: 'Offers', onAction: () => navigate('/offers') }}
        >
            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        {errors.length > 0 && (
                            <Banner tone="critical">
                                {errors.map((e, i) => (
                                    <Text key={i}>{e}</Text>
                                ))}
                            </Banner>
                        )}
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                        {step === 4 && renderStep4()}

                        <Card>
                            <InlineStack align="space-between">
                                <Button onClick={prevStep} disabled={step === 1}>
                                    Previous
                                </Button>
                                <InlineStack gap="200">
                                    {step < 4 ? (
                                        <Button primary onClick={nextStep}>
                                            Next
                                        </Button>
                                    ) : (
                                        <>
                                            <Button onClick={() => saveOffer(false)}>Save as Draft</Button>
                                            <Button primary onClick={() => saveOffer(true)}>
                                                Publish Offer
                                            </Button>
                                        </>
                                    )}
                                </InlineStack>
                            </InlineStack>
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export default OfferBuilder;
