# Quick Installation Guide

## Prerequisites

Before you begin, make sure you have:

- [ ] Node.js 16 or higher installed
- [ ] npm or yarn package manager
- [ ] Shopify Partner account
- [ ] Development store (for testing)
- [ ] PostgreSQL OR Firebase account

## Step 1: Initial Setup (5 minutes)

### 1.1 Extract and Navigate
```bash
cd smart-offers-app
```

### 1.2 Install Dependencies
```bash
npm install
```

### 1.3 Create Shopify App
1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Click "Apps" → "Create app"
3. Choose "Public app" or "Custom app"
4. Fill in app details:
   - App name: Smart Offers & Bundles
   - App URL: Your URL (e.g., https://your-app.com)
5. Note your API key and API secret

## Step 2: Environment Configuration (3 minutes)

### 2.1 Copy Environment Template
```bash
cp .env.example .env
```

### 2.2 Edit .env File
Open `.env` and add your credentials:

```bash
# Required
SHOPIFY_API_KEY=your_api_key_from_partners_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_partners_dashboard
APP_URL=https://your-app-url.com
NODE_ENV=development

# Database - Choose ONE option:

# Option A: PostgreSQL
DATABASE_URL=postgresql://username:password@localhost:5432/smart_offers

# Option B: Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Step 3: Database Setup (2 minutes)

### Option A: PostgreSQL

```bash
# Create database
createdb smart_offers

# Run migrations
psql -d smart_offers -f database/schema.sql
```

### Option B: Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project
3. Enable Firestore Database
4. Go to Project Settings → Service Accounts
5. Generate new private key
6. Copy credentials to `.env`

## Step 4: Update Shopify App Config (2 minutes)

Edit `shopify.app.toml`:

```toml
client_id = "YOUR_API_KEY"
application_url = "https://your-app-url.com"

[auth]
redirect_urls = [
  "https://your-app-url.com/auth/callback"
]
```

## Step 5: Start Development Server (1 minute)

### Local Development
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### With Shopify CLI (Recommended)
```bash
# Install Shopify CLI if not already installed
npm install -g @shopify/cli

# Start development with tunnel
shopify app dev
```

This will:
- Start your local server
- Create a tunnel (so Shopify can reach your local app)
- Open browser for app installation

## Step 6: Install in Development Store (1 minute)

1. Shopify CLI will show you an installation URL
2. Click the URL or paste it in browser
3. Select your development store
4. Click "Install app"
5. Authorize the requested permissions

## Step 7: Verify Installation (2 minutes)

### 7.1 Check App Dashboard
- You should see the app dashboard in Shopify admin
- Navigate through: Dashboard, Offers, Analytics, Settings

### 7.2 Create Test Offer
1. Click "Create Offer"
2. Complete the 4-step wizard:
   - Step 1: Name and type
   - Step 2: Select products
   - Step 3: Configure discount
   - Step 4: Design settings
3. Save as draft or publish

### 7.3 Test Storefront Widget
1. Go to your store's product page
2. Check if offer widget appears
3. Verify it displays correctly

## Troubleshooting

### App won't start
```bash
# Check Node version (must be 16+)
node --version

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Database connection error
```bash
# PostgreSQL: Test connection
psql -d smart_offers -c "SELECT 1"

# Firebase: Verify credentials in .env
```

### Shopify authentication fails
- Verify SHOPIFY_API_KEY and SHOPIFY_API_SECRET in `.env`
- Check APP_URL matches what's in Partners Dashboard
- Ensure redirect URLs are configured correctly

### Widget not appearing
- Check browser console for errors
- Verify offer is set to "active" status
- Ensure products are selected in offer configuration
- Check theme compatibility

## Common Commands

```bash
# Start development
npm run dev

# Run with Shopify CLI
shopify app dev

# View logs
npm run logs

# Run tests (when implemented)
npm test

# Build for production
npm run build

# Deploy (after configuring deployment)
npm run deploy
```

## Next Steps

Once installed:

1. ✅ **Create your first offer** (Dashboard → Create Offer)
2. ✅ **Customize styling** (match your brand)
3. ✅ **Test on storefront** (visit product page)
4. ✅ **Check analytics** (Dashboard → Analytics)
5. ✅ **Configure billing** (Settings → Billing)

## Development Workflow

```bash
# Daily development
1. Start dev server: npm run dev
2. Make code changes
3. Test in development store
4. Commit changes: git commit -m "description"
5. Push to repository: git push
```

## Production Deployment

When ready to deploy to production, see:
- `DEPLOYMENT.md` for detailed deployment guides
- Supports: Heroku, AWS, Google Cloud, Docker

## Getting Help

### Documentation
- `README.md` - Full API documentation
- `DEPLOYMENT.md` - Production deployment
- `PROJECT_SUMMARY.md` - Project overview

### Shopify Resources
- [Shopify App Development](https://shopify.dev/docs/apps)
- [Polaris Design System](https://polaris.shopify.com)
- [Shopify CLI Docs](https://shopify.dev/docs/apps/tools/cli)

### Support
- Check inline code comments
- Review error logs in console
- Search Shopify Partner community

## Configuration Checklist

Before going live:

- [ ] Environment variables configured
- [ ] Database connected and migrated
- [ ] Shopify app created in Partners
- [ ] App installed in development store
- [ ] Test offer created successfully
- [ ] Widget appearing on storefront
- [ ] Analytics tracking verified
- [ ] Billing integration tested
- [ ] Error handling working
- [ ] Performance acceptable (<200ms)

## Success Indicators

You'll know everything is working when:

✅ App dashboard loads in Shopify admin
✅ You can create and publish offers
✅ Offers appear on product pages
✅ Analytics events are being tracked
✅ Discounts apply at checkout
✅ No errors in browser console

---

**Installation Time**: ~15 minutes
**Difficulty**: Easy
**Status**: Production Ready

🎉 **Congratulations!** Your Smart Offers & Bundles app is ready to use.
