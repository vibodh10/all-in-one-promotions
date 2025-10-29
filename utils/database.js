/**
 * Database utility module
 * Supports both Firebase and PostgreSQL
 */

const USE_FIREBASE = process.env.FIREBASE_PROJECT_ID ? true : false;

let db;

if (USE_FIREBASE) {
  // Firebase implementation
  const admin = require('firebase-admin');
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });

  db = admin.firestore();
} else {
  // PostgreSQL implementation
  const { Pool } = require('pg');
  
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

/**
 * Get all offers for a shop
 */
async function getOffers(filters = {}) {
  if (USE_FIREBASE) {
    let query = db.collection('offers').where('shopId', '==', filters.shopId);
    
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    let query = 'SELECT * FROM offers WHERE shop_id = $1';
    const params = [filters.shopId];
    let paramIndex = 2;
    
    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    
    if (filters.type) {
      query += ` AND type = $${paramIndex}`;
      params.push(filters.type);
    }
    
    const result = await db.query(query, params);
    return result.rows;
  }
}

/**
 * Get offer by ID
 */
async function getOfferById(id, shopId) {
  if (USE_FIREBASE) {
    const doc = await db.collection('offers').doc(id).get();
    if (!doc.exists) return null;
    
    const data = doc.data();
    if (data.shopId !== shopId) return null;
    
    return { id: doc.id, ...data };
  } else {
    const result = await db.query(
      'SELECT * FROM offers WHERE id = $1 AND shop_id = $2',
      [id, shopId]
    );
    return result.rows[0] || null;
  }
}

/**
 * Create a new offer
 */
async function createOffer(offerData) {
  if (USE_FIREBASE) {
    const docRef = await db.collection('offers').add({
      ...offerData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { id: docRef.id, ...offerData };
  } else {
    const result = await db.query(
      `INSERT INTO offers (shop_id, type, name, description, status, products, collections, 
       discount_type, discount_value, tiers, bundle_config, free_gift, display_settings, 
       styling, schedule, targeting, analytics, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
       RETURNING *`,
      [
        offerData.shopId,
        offerData.type,
        offerData.name,
        offerData.description,
        offerData.status,
        JSON.stringify(offerData.products),
        JSON.stringify(offerData.collections),
        offerData.discountType,
        offerData.discountValue,
        JSON.stringify(offerData.tiers),
        JSON.stringify(offerData.bundleConfig),
        JSON.stringify(offerData.freeGift),
        JSON.stringify(offerData.displaySettings),
        JSON.stringify(offerData.styling),
        JSON.stringify(offerData.schedule),
        JSON.stringify(offerData.targeting),
        JSON.stringify(offerData.analytics)
      ]
    );
    
    return result.rows[0];
  }
}

/**
 * Update an offer
 */
async function updateOffer(id, updates) {
  if (USE_FIREBASE) {
    await db.collection('offers').doc(id).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const doc = await db.collection('offers').doc(id).get();
    return { id: doc.id, ...doc.data() };
  } else {
    const fields = Object.keys(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
    
    const result = await db.query(
      `UPDATE offers SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...fields.map(f => updates[f])]
    );
    
    return result.rows[0];
  }
}

/**
 * Delete an offer
 */
async function deleteOffer(id, shopId) {
  if (USE_FIREBASE) {
    const doc = await db.collection('offers').doc(id).get();
    if (doc.data().shopId !== shopId) {
      throw new Error('Unauthorized');
    }
    
    await db.collection('offers').doc(id).delete();
  } else {
    await db.query('DELETE FROM offers WHERE id = $1 AND shop_id = $2', [id, shopId]);
  }
}

/**
 * Save analytics event
 */
async function saveAnalyticsEvent(event) {
  if (USE_FIREBASE) {
    await db.collection('analytics_events').add({
      ...event,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } else {
    await db.query(
      `INSERT INTO analytics_events (event_name, offer_id, product_id, cart_value, 
       currency, metadata, shop_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        event.eventName,
        event.offerId,
        event.productId,
        event.cartValue,
        event.currency,
        JSON.stringify(event.metadata),
        event.shopId
      ]
    );
  }
}

/**
 * Get analytics events
 */
async function getAnalyticsEvents(filters = {}) {
  if (USE_FIREBASE) {
    let query = db.collection('analytics_events').where('shopId', '==', filters.shopId);
    
    if (filters.offerId) {
      query = query.where('offerId', '==', filters.offerId);
    }
    
    if (filters.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    let query = 'SELECT * FROM analytics_events WHERE shop_id = $1';
    const params = [filters.shopId];
    let paramIndex = 2;
    
    if (filters.offerId) {
      query += ` AND offer_id = $${paramIndex}`;
      params.push(filters.offerId);
      paramIndex++;
    }
    
    if (filters.startDate) {
      query += ` AND timestamp >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    
    if (filters.endDate) {
      query += ` AND timestamp <= $${paramIndex}`;
      params.push(filters.endDate);
    }
    
    const result = await db.query(query, params);
    return result.rows;
  }
}

/**
 * Get subscription for shop
 */
async function getSubscription(shopId) {
  if (USE_FIREBASE) {
    const doc = await db.collection('subscriptions').doc(shopId).get();
    return doc.exists ? doc.data() : null;
  } else {
    const result = await db.query('SELECT * FROM subscriptions WHERE shop_id = $1', [shopId]);
    return result.rows[0] || null;
  }
}

/**
 * Save subscription
 */
async function saveSubscription(subscription) {
  if (USE_FIREBASE) {
    await db.collection('subscriptions').doc(subscription.shopId).set(subscription, { merge: true });
  } else {
    await db.query(
      `INSERT INTO subscriptions (shop_id, plan, charge_id, status, price, start_date, 
       billing_on, trial_ends_on, features, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (shop_id) DO UPDATE SET
       plan = $2, charge_id = $3, status = $4, price = $5, start_date = $6,
       billing_on = $7, trial_ends_on = $8, features = $9, cancelled_at = $10`,
      [
        subscription.shopId,
        subscription.plan,
        subscription.chargeId,
        subscription.status,
        subscription.price,
        subscription.startDate,
        subscription.billingOn,
        subscription.trialEndsOn,
        JSON.stringify(subscription.features),
        subscription.cancelledAt
      ]
    );
  }
}

/**
 * Save session
 */
async function saveSession(session) {
  if (USE_FIREBASE) {
    await db.collection('sessions').doc(session.id).set(session);
  } else {
    await db.query(
      `INSERT INTO sessions (id, shop, access_token, expires_at, data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
       shop = $2, access_token = $3, expires_at = $4, data = $5`,
      [session.id, session.shop, session.accessToken, session.expires, JSON.stringify(session)]
    );
  }
}

/**
 * Get session by ID
 */
async function getSession(id) {
  if (USE_FIREBASE) {
    const doc = await db.collection('sessions').doc(id).get();
    return doc.exists ? doc.data() : null;
  } else {
    const result = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    return result.rows[0]?.data || null;
  }
}

/**
 * Delete shop data (on uninstall)
 */
async function deleteShopData(shopId) {
  if (USE_FIREBASE) {
    const batch = db.batch();
    
    // Delete offers
    const offers = await db.collection('offers').where('shopId', '==', shopId).get();
    offers.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete analytics
    const analytics = await db.collection('analytics_events').where('shopId', '==', shopId).get();
    analytics.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete subscription
    batch.delete(db.collection('subscriptions').doc(shopId));
    
    await batch.commit();
  } else {
    await db.query('DELETE FROM offers WHERE shop_id = $1', [shopId]);
    await db.query('DELETE FROM analytics_events WHERE shop_id = $1', [shopId]);
    await db.query('DELETE FROM subscriptions WHERE shop_id = $1', [shopId]);
    await db.query('DELETE FROM sessions WHERE shop = $1', [shopId]);
  }
}

/**
 * Get offers by product ID
 */
async function getOffersByProduct(productId) {
  if (USE_FIREBASE) {
    const snapshot = await db.collection('offers')
      .where('products', 'array-contains', productId.toString())
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    const result = await db.query(
      `SELECT * FROM offers WHERE products @> $1::jsonb`,
      [JSON.stringify([productId.toString()])]
    );
    return result.rows;
  }
}

module.exports = {
  getOffers,
  getOfferById,
  createOffer,
  updateOffer,
  deleteOffer,
  saveAnalyticsEvent,
  getAnalyticsEvents,
  getSubscription,
  saveSubscription,
  saveSession,
  getSession,
  deleteShopData,
  getOffersByProduct
};
