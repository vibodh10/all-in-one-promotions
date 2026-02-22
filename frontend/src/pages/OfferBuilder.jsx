import { authenticatedFetch } from "@shopify/app-bridge-utils";
import React, { useState, useCallback } from "react";
import {
    Page,
    Layout,
    Card,
    FormLayout,
    TextField,
    Button,
    BlockStack,
    InlineStack,
    Text,
    ResourceList,
    ResourceItem,
    Banner,
    Thumbnail,
} from "@shopify/polaris";
import { ResourcePicker } from "@shopify/app-bridge/actions";
import { useNavigate } from "react-router-dom";
import { DeleteIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";

function OfferBuilder() {
    const navigate = useNavigate();
    const app = useAppBridge();
    const fetchFunction = authenticatedFetch(app);

    const [step, setStep] = useState(1);
    const [errors, setErrors] = useState([]);

    const [offerData, setOfferData] = useState({
        name: "",
        description: "",
        type: "quantity_break",
        products: [],
        startDate: "",
        endDate: "",
        discountType: "percentage",
        discountValue: null,
        tiers: [
            { quantity: 2, discount: 10 },
            { quantity: 3, discount: 15 },
        ],
        displaySettings: {
            widget: "inline",
            position: "below_atc",
        },
        styling: {
            primaryColor: "#000000",
            borderRadius: "4px",
        },
    });

    const handleChange = (field, value) =>
        setOfferData((prev) => ({ ...prev, [field]: value }));

    const handleNestedChange = (parent, field, value) =>
        setOfferData((prev) => ({
            ...prev,
            [parent]: { ...prev[parent], [field]: value },
        }));

    // -----------------------
    // PRODUCT PICKER
    // -----------------------

    const openProductPicker = useCallback(() => {
        const picker = ResourcePicker.create(app, {
            resourceType: ResourcePicker.ResourceType.Product,
            options: { selectMultiple: true },
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
    }, [app]);

    const removeProduct = (id) => {
        setOfferData((prev) => ({
            ...prev,
            products: prev.products.filter((p) => p.id !== id),
        }));
    };

    // -----------------------
    // VALIDATION
    // -----------------------

    const validateStep = (s) => {
        const newErrors = [];

        if (s === 1) {
            if (!offerData.name.trim())
                newErrors.push("Offer name is required");

            // If one date exists, both must exist
            if (
                (offerData.startDate && !offerData.endDate) ||
                (!offerData.startDate && offerData.endDate)
            ) {
                newErrors.push("Both start and end date must be provided");
            }

            // If both provided, validate order
            if (
                offerData.startDate &&
                offerData.endDate &&
                new Date(offerData.startDate) >= new Date(offerData.endDate)
            ) {
                newErrors.push("Start date must be before end date");
            }
        }

        if (s === 2 && offerData.products.length === 0)
            newErrors.push("Select at least one product");

        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const nextStep = () => validateStep(step) && setStep(step + 1);
    const prevStep = () => setStep(step - 1);

    // -----------------------
    // SAVE OFFER
    // -----------------------

    const saveOffer = async (publish = false) => {
        try {
            if (offerData.products.length === 0) {
                setErrors(["Select at least one product"]);
                return;
            }

            const payload = {
                name: offerData.name,
                description: offerData.description,
                type: offerData.type,
                products: offerData.products.map((p) => p.id),
                collections: [],
                discountType: offerData.discountType,
                discountValue: offerData.discountValue,
                tiers: offerData.tiers,
                bundleConfig: {
                    minItems: 1,
                    maxItems: null,
                    allowMixMatch: false,
                    requiredProducts: [],
                },
                freeGift: {
                    enabled: false,
                    productId: null,
                    variantId: null,
                    threshold: null,
                },
                displaySettings: offerData.displaySettings,
                styling: offerData.styling,
                schedule: {
                    startDate: offerData.startDate || null,
                    endDate: offerData.endDate || null,
                    timezone: "UTC",
                },
                targeting: {
                    customerGroups: [],
                    countries: [],
                    excludeProducts: [],
                },
                analytics: {
                    impressions: 0,
                    clicks: 0,
                    conversions: 0,
                    revenue: 0,
                },
                status: publish ? "active" : "draft",
            };

            const params = new URLSearchParams(window.location.search);
            const shop = params.get("shop");
            const host = params.get("host");

            const response = await fetchFunction(
                `/api/offers?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(
                    host
                )}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setErrors([data?.error || "Failed to save offer"]);
                return;
            }

            navigate("/");
        } catch (error) {
            console.error(error);
            setErrors(["Failed to save offer"]);
        }
    };

    // -----------------------
    // STEP 1
    // -----------------------

    const renderStep1 = () => (
        <Card>
            <FormLayout>
                <TextField
                    label="Offer Name"
                    value={offerData.name}
                    onChange={(v) => handleChange("name", v)}
                />

                <TextField
                    label="Description"
                    multiline={3}
                    value={offerData.description}
                    onChange={(v) => handleChange("description", v)}
                />

                <TextField
                    label="Start Date"
                    type="date"
                    value={offerData.startDate}
                    onChange={(v) => handleChange("startDate", v)}
                />

                <TextField
                    label="End Date"
                    type="date"
                    value={offerData.endDate}
                    onChange={(v) => handleChange("endDate", v)}
                />
            </FormLayout>
        </Card>
    );

    // -----------------------
    // STEP 2
    // -----------------------

    const renderStep2 = () => (
        <Card>
            <BlockStack gap="400">
                <Button onClick={openProductPicker}>Select Products</Button>

                <ResourceList
                    resourceName={{ singular: "product", plural: "products" }}
                    items={offerData.products}
                    renderItem={(item) => {
                        const media = item.images?.[0]?.originalSrc ? (
                            <Thumbnail
                                source={item.images[0].originalSrc}
                                alt={item.title}
                            />
                        ) : null;

                        return (
                            <ResourceItem id={item.id} media={media}>
                                <InlineStack align="space-between">
                                    <Text>{item.title}</Text>
                                    <Button
                                        plain
                                        icon={DeleteIcon}
                                        onClick={() => removeProduct(item.id)}
                                    />
                                </InlineStack>
                            </ResourceItem>
                        );
                    }}
                />
            </BlockStack>
        </Card>
    );

    // -----------------------
    // UI
    // -----------------------

    return (
        <Page title="Create New Offer">
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

                        <Card>
                            <InlineStack align="space-between">
                                <Button onClick={prevStep} disabled={step === 1}>
                                    Previous
                                </Button>

                                {step < 2 ? (
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
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export default OfferBuilder;