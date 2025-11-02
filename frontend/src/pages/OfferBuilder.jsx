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
    Banner,
    ResourceList,
    ResourceItem,
    Thumbnail
} from '@shopify/polaris';
import { DeleteIcon } from '@shopify/polaris-icons';
import { useNavigate } from 'react-router-dom';
import { useAppBridge, ResourcePicker } from '@shopify/app-bridge-react';
import axios from 'axios';

function OfferBuilder() {
    const navigate = useNavigate();
    const app = useAppBridge();

    const [step, setStep] = useState(1);
    const [errors, setErrors] = useState([]);
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [showCollectionPicker, setShowCollectionPicker] = useState(false);

    // Form state
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
            { quantity: 3, discount: 15 }
        ],
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

    // === Helpers ===
    const handleChange = (field, value) => setOfferData(prev => ({ ...prev, [field]: value }));
    const handleNestedChange = (parent, field, value) => setOfferData(prev => ({ ...prev, [parent]: { ...prev[parent], [field]: value }}));

    const addTier = () => {
        const lastTier = offerData.tiers[offerData.tiers.length - 1];
        setOfferData(prev => ({
            ...prev,
            tiers: [...prev.tiers, { quantity: lastTier.quantity + 1, discount: lastTier.discount + 5 }]
        }));
    };

    const removeTier = (index) => setOfferData(prev => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== index) }));
    const updateTier = (index, field, value) => setOfferData(prev => ({ ...prev, tiers: prev.tiers.map((tier, i) => i === index ? { ...tier, [field]: parseFloat(value) || 0 } : tier) }));

    // === ResourcePicker Handlers ===
    const handleProductSelection = useCallback((selection) => {
        if (selection && selection.length > 0) {
            const newProducts = selection.map(p => ({
                id: p.id,
                title: p.title,
                handle: p.handle || '',
                images: p.images || [],
                variants: p.variants || []
            }));
            setOfferData(prev => ({
                ...prev,
                products: [...prev.products, ...newProducts.filter(np => !prev.products.some(ep => ep.id === np.id))]
            }));
        }
        setShowProductPicker(false);
    }, []);

    const handleCollectionSelection = useCallback((selection) => {
        if (selection && selection.length > 0) {
            const newCollections = selection.map(c => ({
                id: c.id,
                title: c.title,
                handle: c.handle || '',
                image: c.image || null
            }));
            setOfferData(prev => ({
                ...prev,
                collections: [...prev.collections, ...newCollections.filter(nc => !prev.collections.some(ec => ec.id === nc.id))]
            }));
        }
        setShowCollectionPicker(false);
    }, []);

    const removeProduct = useCallback((id) => setOfferData(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) })), []);
    const removeCollection = useCallback((id) => setOfferData(prev => ({ ...prev, collections: prev.collections.filter(c => c.id !== id) })), []);

    // === Navigation & Validation ===
    const validateStep = (currentStep) => {
        const newErrors = [];
        if (currentStep === 1) {
            if (!offerData.name.trim()) newErrors.push('Offer name is required');
            if (!offerData.type) newErrors.push('Please select an offer type');
        }
        if (currentStep === 2 && offerData.products.length === 0 && offerData.collections.length === 0) {
            newErrors.push('Please select at least one product or collection');
        }
        if (currentStep === 3 && offerData.type === 'quantity_break' && offerData.tiers.length === 0) {
            newErrors.push('Please add at least one discount tier');
        }
        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const nextStep = () => { if (validateStep(step)) setStep(step + 1); };
    const prevStep = () => { setStep(step - 1); setErrors([]); };

    const saveOffer = async (publish = false) => {
        try {
            const finalOfferData = { ...offerData, status: publish ? 'active' : 'draft' };
            const response = await axios.post('/api/offers', finalOfferData);
            if (response.data.success) navigate('/offers');
        } catch (err) {
            console.error(err);
            setErrors(['Failed to save offer. Please try again.']);
        }
    };

    // === Step Renders ===
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

    const widgetTypes = [
        { label: 'Inline Widget', value: 'inline' },
        { label: 'Modal Popup', value: 'modal' },
        { label: 'Side Drawer', value: 'drawer' }
    ];

    const positionOptions = [
        { label: 'Below Add to Cart', value: 'below_atc' },
        { label: 'Above Add to Cart', value: 'above_atc' },
        { label: 'Product Tabs', value: 'product_tabs' }
    ];

    // === Step 1 ===
    const renderStep1 = () => (
        <Card>
            <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Step 1: Offer Type & Basic Info</Text>
                <FormLayout>
                    <TextField label="Offer Name" value={offerData.name} onChange={v => handleChange('name', v)} autoComplete="off" />
                    <TextField label="Description (Optional)" value={offerData.description} onChange={v => handleChange('description', v)} multiline={3} autoComplete="off" />
                    <Select label="Offer Type" options={offerTypes} value={offerData.type} onChange={v => handleChange('type', v)} />
                </FormLayout>
            </BlockStack>
        </Card>
    );

    // === Step 2 ===
    const renderStep2 = () => (
        <Card>
            <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Step 2: Product Selection</Text>
                <InlineStack gap="200">
                    <Button onClick={() => setShowProductPicker(true)}>Select Products</Button>
                    <Button onClick={() => setShowCollectionPicker(true)}>Select Collections</Button>
                </InlineStack>

                {offerData.products.length > 0 && (
                    <ResourceList
                        resourceName={{ singular: 'product', plural: 'products' }}
                        items={offerData.products}
                        renderItem={(p) => {
                            const media = p.images?.[0]?.originalSrc ? <Thumbnail source={p.images[0].originalSrc} alt={p.title} /> : null;
                            return (
                                <ResourceItem id={p.id} media={media}>
                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text fontWeight="bold">{p.title}</Text>
                                        <Button plain destructive icon={DeleteIcon} onClick={() => removeProduct(p.id)}>Remove</Button>
                                    </InlineStack>
                                </ResourceItem>
                            );
                        }}
                    />
                )}

                {offerData.collections.length > 0 && (
                    <ResourceList
                        resourceName={{ singular: 'collection', plural: 'collections' }}
                        items={offerData.collections}
                        renderItem={(c) => {
                            const media = c.image?.src ? <Thumbnail source={c.image.src} alt={c.title} /> : null;
                            return (
                                <ResourceItem id={c.id} media={media}>
                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text fontWeight="bold">{c.title}</Text>
                                        <Button plain destructive icon={DeleteIcon} onClick={() => removeCollection(c.id)}>Remove</Button>
                                    </InlineStack>
                                </ResourceItem>
                            );
                        }}
                    />
                )}

                {/* Shopify ResourcePickers */}
                {app && showProductPicker && (
                    <ResourcePicker
                        resourceType="Product"
                        open={showProductPicker}
                        onSelection={handleProductSelection}
                        onCancel={() => setShowProductPicker(false)}
                        selectMultiple
                        app={app}
                    />
                )}

                {app && showCollectionPicker && (
                    <ResourcePicker
                        resourceType="Collection"
                        open={showCollectionPicker}
                        onSelection={handleCollectionSelection}
                        onCancel={() => setShowCollectionPicker(false)}
                        selectMultiple
                        app={app}
                    />
                )}
            </BlockStack>
        </Card>
    );

    // === Step 3 & 4 render as before ===
    const renderStep3 = () => (
        <Card>
            <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Step 3: Discount Configuration</Text>
                <FormLayout>
                    <Select label="Discount Type" options={discountTypes} value={offerData.discountType} onChange={v => handleChange('discountType', v)} />

                    {offerData.type === 'quantity_break' && offerData.tiers.map((tier, i) => (
                        <InlineStack key={i} gap="200" align="center">
                            <TextField label="Quantity" type="number" value={tier.quantity.toString()} onChange={v => updateTier(i, 'quantity', v)} autoComplete="off" />
                            <TextField label="Discount" type="number" value={tier.discount.toString()} onChange={v => updateTier(i, 'discount', v)} suffix={offerData.discountType === 'percentage' ? '%' : '$'} autoComplete="off" />
                            {offerData.tiers.length > 1 && <Button destructive onClick={() => removeTier(i)}>Remove</Button>}
                        </InlineStack>
                    ))}
                    {offerData.type === 'quantity_break' && <Button onClick={addTier}>Add Tier</Button>}

                    {offerData.type === 'bundle' && (
                        <BlockStack gap="300">
                            <TextField label="Minimum Items" type="number" value={offerData.bundleConfig.minItems.toString()} onChange={v => handleNestedChange('bundleConfig', 'minItems', parseInt(v) || 1)} autoComplete="off" />
                            <TextField label="Bundle Discount" type="number" value={offerData.discountValue.toString()} onChange={v => handleChange('discountValue', parseFloat(v) || 0)} suffix={offerData.discountType === 'percentage' ? '%' : '$'} autoComplete="off" />
                        </BlockStack>
                    )}
                </FormLayout>
            </BlockStack>
        </Card>
    );

    const renderStep4 = () => (
        <Card>
            <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Step 4: Display Settings</Text>
                <FormLayout>
                    <Select label="Widget Type" options={widgetTypes} value={offerData.displaySettings.widget} onChange={v => handleNestedChange('displaySettings', 'widget', v)} />
                    <Select label="Position" options={positionOptions} value={offerData.displaySettings.position} onChange={v => handleNestedChange('displaySettings', 'position', v)} />
                    <TextField label="Primary Color" type="color" value={offerData.styling.primaryColor} onChange={v => handleNestedChange('styling', 'primaryColor', v)} autoComplete="off" />
                    <TextField label="Border Radius" value={offerData.styling.borderRadius} onChange={v => handleNestedChange('styling', 'borderRadius', v)} suffix="px" autoComplete="off" />
                </FormLayout>
            </BlockStack>
        </Card>
    );

    // === Render Page ===
    return (
        <Page title="Create New Offer" backAction={{ content: 'Offers', onAction: () => navigate('/offers') }}>
            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        {errors.length > 0 && (
                            <Banner tone="critical">
                                <BlockStack gap="200">{errors.map((e, i) => <Text key={i}>{e}</Text>)}</BlockStack>
                            </Banner>
                        )}

                        <Card>
                            <BlockStack gap="300">
                                <InlineStack align="space-between">
                                    {[1, 2, 3, 4].map(s => (
                                        <div key={s} style={{ flex: 1, textAlign: 'center' }}>
                                            <Text variant="bodyMd" as="p" fontWeight={step === s ? 'bold' : 'regular'} color={step === s ? 'success' : 'subdued'}>
                                                Step {s}
                                            </Text>
                                        </div>
                                    ))}
                                </InlineStack>
                            </BlockStack>
                        </Card>

                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                        {step === 4 && renderStep4()}

                        <Card>
                            <InlineStack align="space-between">
                                <Button onClick={prevStep} disabled={step === 1}>Previous</Button>
                                <InlineStack gap="200">
                                    {step < 4 ? <Button primary onClick={nextStep}>Next</Button> : (
                                        <>
                                            <Button onClick={() => saveOffer(false)}>Save as Draft</Button>
                                            <Button primary onClick={() => saveOffer(true)}>Publish Offer</Button>
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
