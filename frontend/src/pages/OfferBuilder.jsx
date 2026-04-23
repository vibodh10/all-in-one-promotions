import { authenticatedFetch } from "@shopify/app-bridge-utils";
import React, { useState, useCallback, useMemo } from "react";
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
    Thumbnail, EmptyState,
} from "@shopify/polaris";
import { ResourcePicker } from "@shopify/app-bridge/actions";
import { useNavigate } from "react-router-dom";
import { DeleteIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";

function getLocalDateTimeString(date) {
    const pad = (n) => String(n).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function OfferBuilder() {
    const navigate = useNavigate();
    const app = useAppBridge();
    const fetchFunction = authenticatedFetch(app);

    const now = new Date();
    const in7Days = new Date(now);
    in7Days.setDate(now.getDate() + 7);

    const [step, setStep] = useState(1);
    const [errors, setErrors] = useState([]);

    const offerTypes = useMemo(
        () => [
            { label: "Quantity Breaks", value: "quantity_break" },
            // { label: "Bundle & Save", value: "bundle" },
            { label: "Volume Discount", value: "volume_discount" },
        ],
        []
    );

    const discountTypes = useMemo(
        () => [
            { label: "Percentage Off", value: "percentage" },
            // { label: "Fixed Amount Off", value: "fixed_amount" },
        ],
        []
    );

    const [offerData, setOfferData] = useState({
        name: "",
        description: "",
        type: "quantity_break",
        products: [],
        targeting: {
            mode: "specific_products",
            excludeProducts:
                offerData.targeting?.mode === "all_except_products"
                    ? offerData.products.map(p => p.id)
                    : [],
        },
        startDate: getLocalDateTimeString(now),
        endDate: getLocalDateTimeString(in7Days),
        discountType: "percentage",
        discountValue: null, // used for bundle
        tiers: [
            { quantity: 2, discount: 10 },
            { quantity: 3, discount: 15 },
        ],
        bundleConfig: {
            minItems: 2,
            maxItems: null,
            allowMixMatch: false,
            requiredProducts: [],
        },
        displaySettings: {
            widget: "inline",
            position: "below_atc",
        },
        styling: {
            primaryColor: "#000000",
            borderRadius: "4px",
        },
    });

    const targetingModes = [
        { label: "Specific products", value: "specific_products" },
        { label: "All products", value: "all" },
        { label: "All products except selected", value: "all_except_products" },
    ];

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
    // TIERS (for quantity_break / volume_discount)
    // -----------------------
    const addTier = () => {
        const last = offerData.tiers[offerData.tiers.length - 1];
        const nextQty = last ? Number(last.quantity || 0) + 1 : 2;
        const nextDisc = last ? Number(last.discount || 0) + 5 : 10;

        setOfferData((prev) => ({
            ...prev,
            tiers: [...prev.tiers, { quantity: nextQty, discount: nextDisc }],
        }));
    };

    const removeTier = (index) => {
        setOfferData((prev) => ({
            ...prev,
            tiers: prev.tiers.filter((_, i) => i !== index),
        }));
    };

    const updateTier = (index, field, value) => {
        const num = value === "" ? "" : Number(value);
        setOfferData((prev) => ({
            ...prev,
            tiers: prev.tiers.map((t, i) => (i === index ? { ...t, [field]: num } : t)),
        }));
    };

    // -----------------------
    // VALIDATION
    // -----------------------
    const validateStep = (s, publish = false) => {
        const newErrors = [];

        // Step 1: basic info + schedule
        if (s === 1) {
            if (!offerData.name.trim()) newErrors.push("Offer name is required");

            const now = new Date();

            const start = offerData.startDate ? new Date(offerData.startDate) : null;
            const end = offerData.endDate ? new Date(offerData.endDate) : null;

            // ✅ If both exist → start must be before end
            if (start && end && start >= end) {
                newErrors.push("Start date/time must be before end date/time");
            }

            // ✅ Start must not be in the past
            if (start && start < now) {
                newErrors.push("Start date/time cannot be in the past");
            }

            // ✅ End must not be in the past (optional but recommended)
            if (end && end < now) {
                newErrors.push("End date/time cannot be in the past");
            }

            // Offer type required
            if (!offerData.type) newErrors.push("Offer type is required");
        }

        // Step 2: targeting (products)
        if (s === 2) {
            if (
                offerData.targeting?.mode !== "all" &&
                offerData.products.length === 0
            ) {
                newErrors.push("Select at least one product");
            }
        }

        // Step 3: offer details (required for publish, recommended for draft)
        if (s === 3) {
            if (offerData.type === "quantity_break" || offerData.type === "volume_discount") {
                if (!Array.isArray(offerData.tiers) || offerData.tiers.length === 0) {
                    newErrors.push("Add at least one discount tier");
                } else {
                    // basic tier sanity
                    offerData.tiers.forEach((t, idx) => {
                        if (!t.quantity || Number(t.quantity) <= 0) {
                            newErrors.push(`Tier ${idx + 1}: quantity must be > 0`);
                        }
                        if (t.discount === "" || t.discount === null || Number(t.discount) <= 0) {
                            newErrors.push(`Tier ${idx + 1}: discount must be > 0`);
                        }
                    });
                }
            }

            if (offerData.type === "bundle") {
                const minItems = Number(offerData.bundleConfig?.minItems || 0);
                if (!minItems || minItems < 2) newErrors.push("Bundle: minimum items must be at least 2");

                if (offerData.discountValue === null || offerData.discountValue === "" || Number(offerData.discountValue) <= 0) {
                    newErrors.push("Bundle: discount value must be greater than 0");
                }
            }
        }

        // Extra rule: if publishing, require Step 3 to be valid regardless of current step
        if (publish) {
            const step3Errors = validateStep(3, false);
            // validateStep(3,false) returns boolean; but we need the messages.
            // We'll do a lightweight publish-only check here:
            // (Already handled above when s===3; for publish we’ll enforce by running s===3 in saveOffer)
        }

        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const nextStep = () => validateStep(step) && setStep(step + 1);
    const prevStep = () => {
        setErrors([]);
        setStep(step - 1);
    };

    // -----------------------
    // SAVE OFFER
    // -----------------------
    const saveOffer = async (publish = false) => {
        try {
            // Validate all required steps on publish
            if (publish) {
                const ok1 = validateStep(1);
                if (!ok1) return;
                const ok2 = validateStep(2);
                if (!ok2) return;
                const ok3 = validateStep(3);
                if (!ok3) return;
            } else {
                // For draft, just ensure basics + at least one product
                const ok1 = validateStep(1);
                if (!ok1) return;
                const ok2 = validateStep(2);
                if (!ok2) return;
            }

            const payload = {
                name: offerData.name,
                description: offerData.description,
                type: offerData.type,

                // Targeting
                products: offerData.products.map((p) => p.id),
                collections: [],

                // Discount config
                discountType: offerData.discountType,
                discountValue: offerData.type === "bundle" ? Number(offerData.discountValue) : null,
                tiers:
                    offerData.type === "quantity_break" || offerData.type === "volume_discount"
                        ? offerData.tiers.map((t) => ({
                            quantity: Number(t.quantity),
                            discount: Number(t.discount),
                        }))
                        : [],

                // Bundle config
                bundleConfig:
                    offerData.type === "bundle"
                        ? {
                            ...offerData.bundleConfig,
                            minItems: Number(offerData.bundleConfig?.minItems || 2),
                            maxItems:
                                offerData.bundleConfig?.maxItems === "" || offerData.bundleConfig?.maxItems === null
                                    ? null
                                    : Number(offerData.bundleConfig?.maxItems),
                            allowMixMatch: Boolean(offerData.bundleConfig?.allowMixMatch),
                            requiredProducts: offerData.bundleConfig?.requiredProducts || [],
                        }
                        : {
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
                    startDate: offerData.startDate
                        ? new Date(offerData.startDate).toISOString()
                        : null,
                    endDate: offerData.endDate
                        ? new Date(offerData.endDate).toISOString()
                        : null,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },

                targeting: {
                    mode: offerData.targeting?.mode || "specific_products",
                    customerGroups: [],
                    countries: [],

                    excludeProducts:
                        offerData.targeting?.mode === "all_except_products"
                            ? offerData.products.map(p => p.id)
                            : [],
                },

                analytics: {
                    impressions: 0,
                    clicks: 0,
                    conversions: 0,
                    revenue: 0,
                },

                status: publish
                    ? (offerData.startDate ? "scheduled" : "active")
                    : "draft",
            };

            const params = new URLSearchParams(window.location.search);
            const shop = params.get("shop");
            const host = params.get("host");

            const response = await fetchFunction(
                `/api/offers?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`,
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
                <TextField label="Offer Name" value={offerData.name} onChange={(v) => handleChange("name", v)} />

                <TextField
                    label="Description"
                    multiline={3}
                    value={offerData.description}
                    onChange={(v) => handleChange("description", v)}
                />

                <Select
                    label="Offer Type"
                    options={offerTypes}
                    value={offerData.type}
                    onChange={(v) => handleChange("type", v)}
                />

                <TextField
                    label="Start Date & Time (optional)"
                    type="datetime-local"
                    value={offerData.startDate}
                    onChange={(v) => handleChange("startDate", v)}
                />

                <TextField
                    label="End Date & Time (optional)"
                    type="datetime-local"
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

                {/* ✅ NEW: mode selector */}
                <Select
                    label="Apply to"
                    options={targetingModes}
                    value={offerData.targeting?.mode || "specific_products"}
                    onChange={(v) =>
                        setOfferData(prev => ({
                            ...prev,
                            targeting: { ...prev.targeting, mode: v }
                        }))
                    }
                />

                {/* ✅ If ALL products → no picker */}
                {offerData.targeting?.mode === "all" && (
                    <Banner tone="info">
                        <Text>This offer will apply to all products.</Text>
                    </Banner>
                )}

                {/* ✅ If SPECIFIC → show picker */}
                {offerData.targeting?.mode !== "all" && (
                    <>
                        {offerData.products.length === 0 ? (
                            <EmptyState
                                heading="Select products for this offer"
                                action={{
                                    content: "Select Products",
                                    onAction: openProductPicker
                                }}
                                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                            >
                                <p>Choose the products that this discount offer should apply to.</p>
                            </EmptyState>
                        ) : (
                            <>
                                <Button onClick={openProductPicker}>Add More Products</Button>

                                <ResourceList
                                    resourceName={{ singular: "product", plural: "products" }}
                                    items={offerData.products}
                                    renderItem={(item) => {
                                        const media = item.images?.[0]?.originalSrc ? (
                                            <Thumbnail source={item.images[0].originalSrc} alt={item.title} />
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
                            </>
                        )}
                    </>
                )}

            </BlockStack>
        </Card>
    );

    // -----------------------
    // STEP 3 (Type-specific details)
    // -----------------------
    const renderStep3 = () => (
        <Card>
            <BlockStack gap="400">
                {(offerData.type === "quantity_break" || offerData.type === "volume_discount") && (
                    <FormLayout>
                        <Select
                            label="Discount Type"
                            options={discountTypes}
                            value={offerData.discountType}
                            onChange={(v) => handleChange("discountType", v)}
                        />

                        <Text variant="headingSm" as="h3">
                            Discount Tiers
                        </Text>

                        <BlockStack gap="300">
                            {offerData.tiers.map((tier, i) => (
                                <InlineStack key={i} gap="200" align="center">
                                    <TextField
                                        label="Quantity"
                                        type="number"
                                        value={tier.quantity?.toString() ?? ""}
                                        onChange={(v) => updateTier(i, "quantity", v)}
                                        autoComplete="off"
                                    />
                                    <TextField
                                        label="Discount"
                                        type="number"
                                        value={tier.discount?.toString() ?? ""}
                                        onChange={(v) => updateTier(i, "discount", v)}
                                        suffix={offerData.discountType === "percentage" ? "%" : "$"}
                                        autoComplete="off"
                                    />
                                    {offerData.tiers.length > 1 && (
                                        <Button icon={DeleteIcon} onClick={() => removeTier(i)} />
                                    )}
                                </InlineStack>
                            ))}

                            <Button onClick={addTier}>Add Tier</Button>

                            {offerData.type === "volume_discount" && (
                                <Text tone="subdued" as="p">
                                    Volume Discount uses the tiers based on total quantity across the selected products.
                                </Text>
                            )}
                        </BlockStack>
                    </FormLayout>
                )}

                {offerData.type === "bundle" && (
                    <FormLayout>
                        <Select
                            label="Discount Type"
                            options={discountTypes}
                            value={offerData.discountType}
                            onChange={(v) => handleChange("discountType", v)}
                        />

                        <TextField
                            label={offerData.discountType === "percentage" ? "Discount (%)" : "Discount Amount"}
                            type="number"
                            value={offerData.discountValue?.toString() ?? ""}
                            onChange={(v) => handleChange("discountValue", v === "" ? "" : Number(v))}
                            suffix={offerData.discountType === "percentage" ? "%" : "$"}
                            autoComplete="off"
                        />

                        <TextField
                            label="Minimum items required"
                            type="number"
                            value={offerData.bundleConfig?.minItems?.toString() ?? "2"}
                            onChange={(v) => handleNestedChange("bundleConfig", "minItems", v === "" ? "" : Number(v))}
                            autoComplete="off"
                        />

                        <Text tone="subdued" as="p">
                            Bundle & Save applies when the customer adds at least the minimum number of items
                            from the selected products.
                        </Text>
                    </FormLayout>
                )}

                {offerData.type === "cross_sell" && (
                    <Banner tone="warning">
                        <Text as="p">
                            Cross-sell is coming soon. For now, please use Quantity Breaks or Volume Discount.
                        </Text>
                    </Banner>
                )}
            </BlockStack>
        </Card>
    );

    // -----------------------
    // UI
    // -----------------------
    return (
        <Page
            title="Create New Offer"
            subtitle="Create a new discount to increase conversions"
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

                        <Card>
                            <InlineStack align="space-between">
                                <Button onClick={prevStep} disabled={step === 1}>
                                    Previous
                                </Button>

                                <InlineStack gap="200">
                                    {step < 3 ? (
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