import React, { useState } from 'react';
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
  Divider,
  ResourceList,
  ResourceItem,
  Banner
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function OfferBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState([]);
  
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
    setOfferData(prev => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        {
          quantity: lastTier.quantity + 1,
          discount: lastTier.discount + 5
        }
      ]
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

  const validateStep = (currentStep) => {
    const newErrors = [];

    if (currentStep === 1) {
      if (!offerData.name.trim()) {
        newErrors.push('Offer name is required');
      }
      if (!offerData.type) {
        newErrors.push('Please select an offer type');
      }
    }

    if (currentStep === 2) {
      if (offerData.products.length === 0 && offerData.collections.length === 0) {
        newErrors.push('Please select at least one product or collection');
      }
    }

    if (currentStep === 3) {
      if (offerData.type === 'quantity_break' && offerData.tiers.length === 0) {
        newErrors.push('Please add at least one discount tier');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
    setErrors([]);
  };

  const saveOffer = async (publish = false) => {
    try {
      const finalOfferData = {
        ...offerData,
        status: publish ? 'active' : 'draft'
      };

      const response = await axios.post('/api/offers', finalOfferData);

      if (response.data.success) {
        navigate('/offers');
      }
    } catch (error) {
      console.error('Error saving offer:', error);
      setErrors(['Failed to save offer. Please try again.']);
    }
  };

  const renderStep1 = () => (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Step 1: Offer Type & Basic Info
        </Text>

        <FormLayout>
          <TextField
            label="Offer Name"
            value={offerData.name}
            onChange={(value) => handleChange('name', value)}
            placeholder="e.g., Buy 2 Get 10% Off"
            autoComplete="off"
          />

          <TextField
            label="Description (Optional)"
            value={offerData.description}
            onChange={(value) => handleChange('description', value)}
            placeholder="Describe your offer"
            multiline={3}
            autoComplete="off"
          />

          <Select
            label="Offer Type"
            options={offerTypes}
            value={offerData.type}
            onChange={(value) => handleChange('type', value)}
          />
        </FormLayout>
      </BlockStack>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Step 2: Product Selection
        </Text>

        <Text variant="bodyMd" as="p">
          Select which products this offer applies to. You can select individual products or entire collections.
        </Text>

        <Button onClick={() => {/* Open product picker */}}>
          Select Products
        </Button>

        <Button onClick={() => {/* Open collection picker */}}>
          Select Collections
        </Button>

        {offerData.products.length > 0 && (
          <BlockStack gap="200">
            <Text variant="bodyMd" as="p" fontWeight="semibold">
              Selected Products: {offerData.products.length}
            </Text>
          </BlockStack>
        )}

        {offerData.collections.length > 0 && (
          <BlockStack gap="200">
            <Text variant="bodyMd" as="p" fontWeight="semibold">
              Selected Collections: {offerData.collections.length}
            </Text>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Step 3: Discount Configuration
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
                    <Button
                      onClick={() => removeTier(index)}
                      destructive
                    >
                      Remove
                    </Button>
                  )}
                </InlineStack>
              ))}

              <Button onClick={addTier}>Add Tier</Button>
            </BlockStack>
          )}

          {offerData.type === 'bundle' && (
            <BlockStack gap="300">
              <TextField
                label="Minimum Items"
                type="number"
                value={offerData.bundleConfig.minItems.toString()}
                onChange={(value) => handleNestedChange('bundleConfig', 'minItems', parseInt(value) || 1)}
                autoComplete="off"
              />

              <TextField
                label="Bundle Discount"
                type="number"
                value={offerData.discountValue.toString()}
                onChange={(value) => handleChange('discountValue', parseFloat(value) || 0)}
                suffix={offerData.discountType === 'percentage' ? '%' : '$'}
                autoComplete="off"
              />
            </BlockStack>
          )}
        </FormLayout>
      </BlockStack>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Step 4: Display Settings
        </Text>

        <FormLayout>
          <Select
            label="Widget Type"
            options={widgetTypes}
            value={offerData.displaySettings.widget}
            onChange={(value) => handleNestedChange('displaySettings', 'widget', value)}
          />

          <Select
            label="Position"
            options={positionOptions}
            value={offerData.displaySettings.position}
            onChange={(value) => handleNestedChange('displaySettings', 'position', value)}
          />

          <TextField
            label="Primary Color"
            type="color"
            value={offerData.styling.primaryColor}
            onChange={(value) => handleNestedChange('styling', 'primaryColor', value)}
            autoComplete="off"
          />

          <TextField
            label="Border Radius"
            value={offerData.styling.borderRadius}
            onChange={(value) => handleNestedChange('styling', 'borderRadius', value)}
            suffix="px"
            autoComplete="off"
          />
        </FormLayout>
      </BlockStack>
    </Card>
  );

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
                <BlockStack gap="200">
                  {errors.map((error, index) => (
                    <Text key={index} variant="bodyMd" as="p">
                      {error}
                    </Text>
                  ))}
                </BlockStack>
              </Banner>
            )}

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} style={{ flex: 1, textAlign: 'center' }}>
                      <Text
                        variant="bodyMd"
                        as="p"
                        fontWeight={step === s ? 'bold' : 'regular'}
                        color={step === s ? 'success' : 'subdued'}
                      >
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
                <Button
                  onClick={prevStep}
                  disabled={step === 1}
                >
                  Previous
                </Button>

                <InlineStack gap="200">
                  {step < 4 ? (
                    <Button primary onClick={nextStep}>
                      Next
                    </Button>
                  ) : (
                    <>
                      <Button onClick={() => saveOffer(false)}>
                        Save as Draft
                      </Button>
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
