# Deployment Guide - Smart Offers & Bundles

This guide covers deploying the Smart Offers & Bundles Shopify app to production.

## Prerequisites

Before deploying, ensure you have:

- [ ] Shopify Partner account with app created
- [ ] Production database (PostgreSQL or Firebase)
- [ ] Cloud hosting account (AWS, Google Cloud, or similar)
- [ ] Domain name (optional but recommended)
- [ ] SSL certificate

## Deployment Options

### Option 1: Deploy to Heroku

1. **Create Heroku app**
```bash
heroku create smart-offers-app
```

2. **Add PostgreSQL addon**
```bash
heroku addons:create heroku-postgresql:mini
```

3. **Set environment variables**
```bash
heroku config:set SHOPIFY_API_KEY=your_key
heroku config:set SHOPIFY_API_SECRET=your_secret
heroku config:set NODE_ENV=production
```

4. **Deploy**
```bash
git push heroku main
```

5. **Run database migrations**
```bash
heroku pg:psql < database/schema.sql
```

### Option 2: Deploy to AWS

#### Using AWS Elastic Beanstalk

1. **Install EB CLI**
```bash
pip install awsebcli
```

2. **Initialize EB application**
```bash
eb init -p node.js-16 smart-offers-app
```

3. **Create environment**
```bash
eb create smart-offers-production
```

4. **Configure environment variables**
```bash
eb setenv SHOPIFY_API_KEY=your_key \
         SHOPIFY_API_SECRET=your_secret \
         DATABASE_URL=your_db_url \
         NODE_ENV=production
```

5. **Deploy**
```bash
eb deploy
```

#### Using AWS ECS (Docker)

1. **Create Dockerfile** (already included)

2. **Build and push to ECR**
```bash
aws ecr create-repository --repository-name smart-offers-app
docker build -t smart-offers-app .
docker tag smart-offers-app:latest YOUR_ECR_URI:latest
docker push YOUR_ECR_URI:latest
```

3. **Create ECS task definition and service**
```bash
aws ecs create-cluster --cluster-name smart-offers-cluster
# Create task definition (see ecs-task-definition.json)
aws ecs create-service --cluster smart-offers-cluster --service-name smart-offers-service --task-definition smart-offers-app
```

### Option 3: Deploy to Google Cloud Platform

#### Using Google App Engine

1. **Create app.yaml**
```yaml
runtime: nodejs16
env: standard
instance_class: F2

env_variables:
  SHOPIFY_API_KEY: "your_key"
  SHOPIFY_API_SECRET: "your_secret"
  NODE_ENV: "production"
```

2. **Deploy**
```bash
gcloud app deploy
```

#### Using Cloud Run

1. **Build container**
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/smart-offers-app
```

2. **Deploy to Cloud Run**
```bash
gcloud run deploy smart-offers-app \
  --image gcr.io/PROJECT_ID/smart-offers-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Database Setup

### PostgreSQL (Production)

1. **Create database**
```bash
createdb smart_offers_production
```

2. **Run migrations**
```bash
psql -d smart_offers_production -f database/schema.sql
```

3. **Create indexes**
```sql
-- Already included in schema.sql
```

### Firebase (Production)

1. **Create project in Firebase Console**

2. **Enable Firestore**

3. **Create service account**
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Save JSON file securely

4. **Set up security rules**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /offers/{offerId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /analytics_events/{eventId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Environment Variables

Set these variables in your production environment:

```bash
# Shopify Configuration
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_SCOPES=write_products,read_products,write_discounts,read_discounts

# App Configuration
APP_URL=https://your-production-url.com
NODE_ENV=production
PORT=8080

# Database (choose one)
# PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/database

# OR Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn
```

## SSL/TLS Configuration

### Using Let's Encrypt (free)

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### Using Cloudflare (recommended)

1. Add your domain to Cloudflare
2. Enable SSL/TLS encryption (Full mode)
3. Enable Always Use HTTPS
4. Configure DNS records

## Post-Deployment Checklist

- [ ] Verify app loads in Shopify admin
- [ ] Test OAuth flow
- [ ] Verify webhooks are registering
- [ ] Test creating an offer
- [ ] Test storefront widget rendering
- [ ] Check analytics tracking
- [ ] Verify billing integration
- [ ] Load test (use tools like Apache Bench or k6)
- [ ] Set up monitoring (Sentry, Datadog, etc.)
- [ ] Configure backup strategy
- [ ] Set up CI/CD pipeline

## Monitoring & Logging

### Application Monitoring

**Sentry Integration**
```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
});
```

**CloudWatch (AWS)**
```bash
aws logs create-log-group --log-group-name /aws/elasticbeanstalk/smart-offers-app
```

### Database Monitoring

**PostgreSQL**
- Use pg_stat_statements extension
- Monitor slow queries
- Set up automated backups

**Firebase**
- Enable Firestore monitoring in console
- Set up usage alerts
- Monitor read/write operations

## Scaling Considerations

### Horizontal Scaling

- Use load balancer (ALB, NGINX, etc.)
- Implement session stickiness
- Use Redis for session storage

### Database Scaling

- Set up read replicas
- Implement connection pooling
- Consider database sharding for large merchants

### CDN Configuration

Use CDN for static assets:
- Cloudflare
- AWS CloudFront
- Fastly

## Backup Strategy

### Database Backups

**PostgreSQL**
```bash
# Daily backup cron
0 2 * * * pg_dump smart_offers_production | gzip > backup_$(date +%Y%m%d).sql.gz
```

**Firebase**
- Enable automated backups in console
- Export to Cloud Storage daily

### Application Backups

- Store code in git repository
- Tag releases
- Keep previous versions available

## Rollback Procedure

If deployment fails:

1. **Revert to previous version**
```bash
# Heroku
heroku rollback

# EB
eb deploy --version previous-version

# Cloud Run
gcloud run services update smart-offers-app --image gcr.io/PROJECT_ID/smart-offers-app:previous-tag
```

2. **Database rollback** (if needed)
```bash
psql -d smart_offers_production < backup_YYYYMMDD.sql
```

3. **Clear caches**
```bash
# Redis
redis-cli FLUSHALL

# Cloudflare
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

## Performance Optimization

1. **Enable gzip compression**
2. **Implement caching** (Redis/Memcached)
3. **Optimize database queries**
4. **Use CDN for static assets**
5. **Implement lazy loading**
6. **Minimize bundle size**

## Security Best Practices

- [ ] Use HTTPS everywhere
- [ ] Implement rate limiting
- [ ] Sanitize all inputs
- [ ] Keep dependencies updated
- [ ] Use environment variables for secrets
- [ ] Implement CSRF protection
- [ ] Set secure headers
- [ ] Regular security audits

## Support & Maintenance

### Regular Maintenance Tasks

- Weekly: Review error logs
- Monthly: Update dependencies
- Quarterly: Security audit
- Yearly: Performance review

### Support Channels

- Email: support@smartoffers.com
- In-app chat
- Knowledge base
- Status page: status.smartoffers.com

## Troubleshooting

### Common Issues

**App not loading in Shopify admin**
- Check APP_URL is correct
- Verify SSL certificate is valid
- Check Shopify API credentials

**Webhooks not firing**
- Verify webhook URLs are accessible
- Check webhook signature validation
- Review Shopify webhook logs

**Database connection errors**
- Check DATABASE_URL format
- Verify database credentials
- Check firewall rules

**Performance issues**
- Review slow query logs
- Check server resources
- Verify CDN configuration
- Review application logs

## Additional Resources

- [Shopify App Development Docs](https://shopify.dev/docs/apps)
- [Shopify CLI Documentation](https://shopify.dev/docs/apps/tools/cli)
- [Polaris Design System](https://polaris.shopify.com)
- [Shopify Functions](https://shopify.dev/docs/api/functions)

## Contact

For deployment assistance:
- Technical Support: tech@smartoffers.com
- DevOps Team: devops@smartoffers.com
