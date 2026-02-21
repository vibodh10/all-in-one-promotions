import React, { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    FormLayout,
    TextField,
    Select,
    Checkbox,
    Button,
    Text,
    BlockStack,
    InlineStack,
    Banner,
    Divider
} from '@shopify/polaris';

import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Settings() {
    
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [settings, setSettings] = useState({
        // General Settings
        storeName: '',
        contactEmail: '',
        timezone: 'UTC',
        currency: 'USD',

        // Display Settings
        defaultWidgetPosition: 'below_atc',
        showBranding: true,
        enableAnimations: true,

        // Notification Settings
        emailNotifications: true,
        weeklyReports: true,
        lowPerformanceAlerts: true,

        // Advanced Settings
        analyticsRetention: '365',
        enableDebugMode: false,
        customCSS: ''
    });

    const timezoneOptions = [
        { label: 'UTC', value: 'UTC' },
        { label: 'America/New_York (EST)', value: 'America/New_York' },
        { label: 'America/Los_Angeles (PST)', value: 'America/Los_Angeles' },
        { label: 'America/Chicago (CST)', value: 'America/Chicago' },
        { label: 'Europe/London (GMT)', value: 'Europe/London' },
        { label: 'Europe/Paris (CET)', value: 'Europe/Paris' },
        { label: 'Asia/Tokyo (JST)', value: 'Asia/Tokyo' },
        { label: 'Australia/Sydney (AEST)', value: 'Australia/Sydney' }
    ];

    const currencyOptions = [
        { label: 'USD ($)', value: 'USD' },
        { label: 'EUR (€)', value: 'EUR' },
        { label: 'GBP (£)', value: 'GBP' },
        { label: 'CAD (C$)', value: 'CAD' },
        { label: 'AUD (A$)', value: 'AUD' }
    ];

    const widgetPositionOptions = [
        { label: 'Below Add to Cart', value: 'below_atc' },
        { label: 'Above Add to Cart', value: 'above_atc' },
        { label: 'Product Tabs', value: 'product_tabs' }
    ];

    const retentionOptions = [
        { label: '30 Days', value: '30' },
        { label: '90 Days', value: '90' },
        { label: '180 Days', value: '180' },
        { label: '1 Year', value: '365' },
        { label: 'Forever', value: '-1' }
    ];

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            // In a real implementation, this would fetch from the backend
            // For now, we'll use the default settings
            console.log('Fetching settings...');
        } catch (err) {
            console.error('Error fetching settings:', err);
            setError('Failed to load settings.');
        }
    };

    const handleChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            // In a real implementation, this would save to the backend
            await new Promise(resolve => setTimeout(resolve, 1000));

            setSuccess('Settings saved successfully!');
        } catch (err) {
            console.error('Error saving settings:', err);
            setError('Failed to save settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            setSettings({
                storeName: '',
                contactEmail: '',
                timezone: 'UTC',
                currency: 'USD',
                defaultWidgetPosition: 'below_atc',
                showBranding: true,
                enableAnimations: true,
                emailNotifications: true,
                weeklyReports: true,
                lowPerformanceAlerts: true,
                analyticsRetention: '365',
                enableDebugMode: false,
                customCSS: ''
            });
            setSuccess('Settings reset to defaults.');
        }
    };

    return (
        <Page
            title="Settings"
            backAction={{ content: 'Dashboard', onAction: () => navigate('/') }}
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
                                    General Settings
                                </Text>

                                <FormLayout>
                                    <TextField
                                        label="Store Name"
                                        value={settings.storeName}
                                        onChange={(value) => handleChange('storeName', value)}
                                        placeholder="My Store"
                                        autoComplete="off"
                                    />

                                    <TextField
                                        label="Contact Email"
                                        type="email"
                                        value={settings.contactEmail}
                                        onChange={(value) => handleChange('contactEmail', value)}
                                        placeholder="admin@mystore.com"
                                        autoComplete="email"
                                    />

                                    <Select
                                        label="Timezone"
                                        options={timezoneOptions}
                                        value={settings.timezone}
                                        onChange={(value) => handleChange('timezone', value)}
                                    />

                                    <Select
                                        label="Currency"
                                        options={currencyOptions}
                                        value={settings.currency}
                                        onChange={(value) => handleChange('currency', value)}
                                    />
                                </FormLayout>
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h2">
                                    Display Settings
                                </Text>

                                <FormLayout>
                                    <Select
                                        label="Default Widget Position"
                                        options={widgetPositionOptions}
                                        value={settings.defaultWidgetPosition}
                                        onChange={(value) => handleChange('defaultWidgetPosition', value)}
                                        helpText="Where offers will appear on product pages by default"
                                    />

                                    <Checkbox
                                        label="Show app branding"
                                        checked={settings.showBranding}
                                        onChange={(value) => handleChange('showBranding', value)}
                                        helpText="Display 'Powered by Smart Offers' badge"
                                    />

                                    <Checkbox
                                        label="Enable animations"
                                        checked={settings.enableAnimations}
                                        onChange={(value) => handleChange('enableAnimations', value)}
                                        helpText="Animate offer widgets and transitions"
                                    />
                                </FormLayout>
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h2">
                                    Notification Settings
                                </Text>

                                <BlockStack gap="300">
                                    <Checkbox
                                        label="Email notifications"
                                        checked={settings.emailNotifications}
                                        onChange={(value) => handleChange('emailNotifications', value)}
                                        helpText="Receive updates about your offers via email"
                                    />

                                    <Checkbox
                                        label="Weekly performance reports"
                                        checked={settings.weeklyReports}
                                        onChange={(value) => handleChange('weeklyReports', value)}
                                        helpText="Get weekly summaries of offer performance"
                                    />

                                    <Checkbox
                                        label="Low performance alerts"
                                        checked={settings.lowPerformanceAlerts}
                                        onChange={(value) => handleChange('lowPerformanceAlerts', value)}
                                        helpText="Notify me when offers aren't performing well"
                                    />
                                </BlockStack>
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h2">
                                    Advanced Settings
                                </Text>

                                <FormLayout>
                                    <Select
                                        label="Analytics Data Retention"
                                        options={retentionOptions}
                                        value={settings.analyticsRetention}
                                        onChange={(value) => handleChange('analyticsRetention', value)}
                                        helpText="How long to keep analytics data"
                                    />

                                    <Checkbox
                                        label="Enable debug mode"
                                        checked={settings.enableDebugMode}
                                        onChange={(value) => handleChange('enableDebugMode', value)}
                                        helpText="Show detailed logging in browser console"
                                    />

                                    <TextField
                                        label="Custom CSS"
                                        value={settings.customCSS}
                                        onChange={(value) => handleChange('customCSS', value)}
                                        multiline={4}
                                        placeholder=".smart-offer-widget { /* custom styles */ }"
                                        helpText="Add custom CSS to style offer widgets"
                                        autoComplete="off"
                                    />
                                </FormLayout>
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="300">
                                <Text variant="headingMd" as="h2">
                                    Danger Zone
                                </Text>

                                <Text variant="bodyMd" as="p" color="subdued">
                                    These actions are irreversible. Please be careful.
                                </Text>

                                <Divider />

                                <BlockStack gap="200">
                                    <InlineStack align="space-between">
                                        <BlockStack gap="100">
                                            <Text variant="bodyMd" as="p" fontWeight="semibold">
                                                Reset Settings
                                            </Text>
                                            <Text variant="bodySm" as="p" color="subdued">
                                                Restore all settings to default values
                                            </Text>
                                        </BlockStack>
                                        <Button onClick={handleReset}>
                                            Reset to Defaults
                                        </Button>
                                    </InlineStack>

                                    <InlineStack align="space-between">
                                        <BlockStack gap="100">
                                            <Text variant="bodyMd" as="p" fontWeight="semibold">
                                                Clear Analytics Data
                                            </Text>
                                            <Text variant="bodySm" as="p" color="subdued">
                                                Delete all historical analytics data
                                            </Text>
                                        </BlockStack>
                                        <Button destructive>
                                            Clear All Data
                                        </Button>
                                    </InlineStack>

                                    <InlineStack align="space-between">
                                        <BlockStack gap="100">
                                            <Text variant="bodyMd" as="p" fontWeight="semibold">
                                                Uninstall App
                                            </Text>
                                            <Text variant="bodySm" as="p" color="subdued">
                                                Remove app and all associated data
                                            </Text>
                                        </BlockStack>
                                        <Button destructive>
                                            Uninstall
                                        </Button>
                                    </InlineStack>
                                </BlockStack>
                            </BlockStack>
                        </Card>

                        <Card>
                            <InlineStack align="end" gap="200">
                                <Button onClick={() => navigate('/')}>
                                    Cancel
                                </Button>
                                <Button primary onClick={handleSave} loading={saving}>
                                    Save Settings
                                </Button>
                            </InlineStack>
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export default Settings;