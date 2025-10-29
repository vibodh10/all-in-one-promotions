# Smart Offers & Bundles - Shopify App

A comprehensive Shopify app for creating and managing promotional offers, bundles, discounts, and upsells to increase AOV and conversions.

## Features

### Offer Types
- **Quantity Breaks & Free Gifts**: Buy X, get Y% off or receive a free gift
- **Bundle & Save More**: Fixed bundles or mix-and-match collections with discount
- **Volume Discounts**: Tiered pricing across multiple SKUs
- **Related Products / Cross-Sell**: Manual or AI-driven recommendations with incentives
- **Cart-Level Upsells** (Phase 2): Conditional suggestions based on cart contents

### Key Capabilities
- ✅ Native Shopify Online Store 2.0 integration
- ✅ No code editing required
- ✅ Full customization of design, colors, fonts, and layout
- ✅ Real-time analytics and conversion tracking
- ✅ Automatic discount application via Shopify Functions
- ✅ Multi-language support
- ✅ Mobile-responsive widgets
- ✅ Performance optimized (<200ms load time)

## Installation

### Prerequisites
- Node.js 16+ and npm
- Shopify Partner account
- PostgreSQL or Firebase (for database)
- Shopify CLI 3.x

### Setup Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd smart-offers-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- `SHOPIFY_API_KEY`: Your Shopify app API key
- `SHOPIFY_API_SECRET`: Your Shopify app secret
- `APP_URL`: Your app's public URL
- Database credentials (Firebase or PostgreSQL)

4. **Initialize database**

For PostgreSQL:
```bash
psql -U your_username -d your_database -f database/schema.sql
```

For Firebase:
- Create a Firebase project
- Enable Firestore
- Download service account key
- Add credentials to `.env`

5. **Start development server**
```bash
npm run dev
```

6. **Install in a Shopify development store**
```bash
shopify app dev
```

## Project Structure

```
smart-offers-app/
├── index.js                 # Main server entry point
├── package.json             # Dependencies and scripts
├── .env.example             # Environment configuration template
├── middleware/              # Authentication and middleware
│   └── auth.js
├── routes/                  # API endpoints
│   ├── offers.js           # Offer CRUD operations
│   ├── analytics.js        # Analytics and tracking
│   ├── billing.js          # Subscription management
│   └── webhooks.js         # Shopify webhooks
├── models/                  # Data models
│   └── Offer.js
├── utils/                   # Utility functions
│   ├── database.js         # Database abstraction
│   ├── shopifyFunctions.js # Shopify API integration
│   └── sessionStorage.js   # Session management
├── frontend/                # React admin interface
│   ├── App.jsx
│   ├── pages/              # Page components
│   │   ├── Dashboard.jsx
│   │   ├── OfferList.jsx
│   │   ├── OfferBuilder.jsx
│   │   ├── OfferEdit.jsx
│   │   ├── Analytics.jsx
│   │   ├── Settings.jsx
│   │   └── Billing.jsx
│   └── components/         # Reusable components
├── extensions/             # Shopify theme extensions
│   └── storefront-widget.js # Storefront widget script
└── database/               # Database schemas
    └── schema.sql
```

## API Documentation

### Offers API

#### Create Offer
```http
POST /api/offers
Content-Type: application/json

{
  "name": "Buy 2 Get 10% Off",
  "type": "quantity_break",
  "products": ["123456"],
  "discountType": "percentage",
  "discountValue": 10,
  "tiers": [
    { "quantity": 2, "discount": 10 },
    { "quantity": 3, "discount": 15 }
  ]
}
```

#### Get All Offers
```http
GET /api/offers?status=active&type=quantity_break
```

#### Update Offer
```http
PUT /api/offers/:id
Content-Type: application/json

{
  "name": "Updated Offer Name",
  "status": "active"
}
```

#### Delete Offer
```http
DELETE /api/offers/:id
```

### Analytics API

#### Track Event
```http
POST /api/analytics/event
Content-Type: application/json

{
  "eventName": "offer_view",
  "offerId": "123",
  "productId": "456",
  "timestamp": "2025-10-28T10:00:00Z"
}
```

#### Get Offer Analytics
```http
GET /api/analytics/offers/:id?startDate=2025-01-01&endDate=2025-01-31
```

#### Get Dashboard Metrics
```http
GET /api/analytics/dashboard?period=30d
```

## Offer Types Configuration

### Quantity Breaks
```javascript
{
  "type": "quantity_break",
  "tiers": [
    { "quantity": 2, "discount": 10 },
    { "quantity": 3, "discount": 15 },
    { "quantity": 5, "discount": 20 }
  ],
  "freeGift": {
    "enabled": true,
    "productId": "789",
    "threshold": 5
  }
}
```

### Bundle Discount
```javascript
{
  "type": "bundle",
  "bundleConfig": {
    "minItems": 2,
    "maxItems": 5,
    "allowMixMatch": true
  },
  "discountType": "percentage",
  "discountValue": 15
}
```

### Volume Discount
```javascript
{
  "type": "volume_discount",
  "tiers": [
    { "quantity": 10, "discount": 5 },
    { "quantity": 25, "discount": 10 },
    { "quantity": 50, "discount": 15 }
  ]
}
```

## Analytics Events

The app tracks the following events:

| Event Name | Trigger | Parameters |
|------------|---------|------------|
| `offer_view` | Widget visible on page | offer_id, product_id, timestamp |
| `offer_click` | User interacts with offer | offer_id, product_id, timestamp |
| `offer_applied` | Discount added to cart | offer_id, cart_value, currency |
| `cart_update` | Cart contents modified | cart_id, products, quantity |
| `purchase_complete` | Checkout completed | offer_id, total_value, conversion_time |

## Billing Plans

| Plan | Price | Features |
|------|-------|----------|
| Free | $0/month | 1 active offer, basic analytics |
| Growth | $19/month | 10 offers, full customization, analytics dashboard |
| Pro | $49/month | Unlimited offers, AI recommendations, cart upsells, priority support |

## Theme Integration

### Automatic Integration (Online Store 2.0)
The app automatically creates app blocks that can be added through the theme editor.

### Manual Integration
Add the widget script to your theme:

```liquid
<!-- In theme.liquid, before </body> -->
<script src="https://your-app-url.com/widget.js" defer></script>
```

## Testing

### Run Tests
```bash
npm test
```

### Test Coverage
```bash
npm run test:coverage
```

### Test Environments
- Dawn theme
- Impulse theme
- Motion theme
- Prestige theme

## Performance

- Script load time: <200ms
- Lazy-loaded components
- No blocking scripts
- Lighthouse score target: 90+

## Security & Compliance

- ✅ GDPR & CCPA compliant
- ✅ No PII stored outside Shopify
- ✅ Data anonymized after 12 months
- ✅ TLS encryption enforced
- ✅ Regular security audits

## Support

- Documentation: [docs.smartoffers.com](https://docs.smartoffers.com)
- Email: support@smartoffers.com
- In-app chat support
- SLA: 24h response for P1 issues

## Roadmap

### Phase 2
- AI-based product recommendations
- Cart-level upsells via Checkout Extensibility
- POS integration

### Phase 3
- Multi-store analytics view
- A/B testing engine
- Email/SMS campaign integration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with Shopify Polaris UI
- Powered by Shopify Functions API
- Analytics with Shopify Storefront API
