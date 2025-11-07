-- Smart Offers & Bundles Database Schema
-- PostgreSQL version

-- Shops table
CREATE TABLE IF NOT EXISTS shops (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    currency VARCHAR(10),
    timezone VARCHAR(100),
    plan_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    shop VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    expires_at TIMESTAMP,
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop) REFERENCES shops(id) ON DELETE CASCADE
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    shop_id VARCHAR(255) PRIMARY KEY,
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    charge_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    price DECIMAL(10, 2) DEFAULT 0,
    start_date TIMESTAMP,
    billing_on TIMESTAMP,
    trial_ends_on TIMESTAMP,
    features JSONB,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Offers table
CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    priority INTEGER DEFAULT 0,
    products JSONB DEFAULT '[]',
    collections JSONB DEFAULT '[]',
    discount_type VARCHAR(50),
    discount_value DECIMAL(10, 2),
    tiers JSONB DEFAULT '[]',
    bundle_config JSONB,
    free_gift JSONB,
    display_settings JSONB,
    styling JSONB,
    schedule JSONB,
    targeting JSONB,
    analytics JSONB DEFAULT '{"impressions": 0, "clicks": 0, "conversions": 0, "revenue": 0}',
    shopify_discount_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Indexes for offers table
CREATE INDEX idx_offers_shop_id ON offers(shop_id);
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_type ON offers(type);
CREATE INDEX idx_offers_products ON offers USING GIN (products);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    offer_id INTEGER,
    product_id VARCHAR(255),
    cart_value DECIMAL(10, 2),
    currency VARCHAR(10),
    metadata JSONB,
    shop_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Indexes for analytics_events table
CREATE INDEX idx_analytics_shop_id ON analytics_events(shop_id);
CREATE INDEX idx_analytics_offer_id ON analytics_events(offer_id);
CREATE INDEX idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp);

-- Pending charges table (for billing)
CREATE TABLE IF NOT EXISTS pending_charges (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL,
    charge_id VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    confirmation_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (optional)
-- INSERT INTO shops (id, name, email, currency, timezone, plan_name) 
-- VALUES ('test-shop.myshopify.com', 'Test Shop', 'test@example.com', 'USD', 'America/New_York', 'partner_test');
