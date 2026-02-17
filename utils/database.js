import pool from "./db.js";

const USE_FIREBASE = false

/** Get all offers for a shop */
async function getOffers(filters = {}) {
    if (USE_FIREBASE) {
        let query = pool.collection('offers').where('shopId', '==', filters.shopId);
        if (filters.status) query = query.where('status', '==', filters.status);
        if (filters.type) query = query.where('type', '==', filters.type);
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
        const result = await pool.query(query, params);
        return result.rows;
    }
}

/** Get offer by ID */
async function getOfferById(id, shopId) {
    if (USE_FIREBASE) {
        const doc = await pool.collection('offers').doc(id).get();
        if (!doc.exists) return null;
        const data = doc.data();
        if (data.shopId !== shopId) return null;
        return { id: doc.id, ...data };
    } else {
        const result = await pool.query(
            'SELECT * FROM offers WHERE id = $1 AND shop_id = $2',
            [id, shopId]
        );
        return result.rows[0] || null;
    }
}

/** Create a new offer */
async function createOffer(offerData) {
    if (USE_FIREBASE) {
        const docRef = await pool.collection('offers').add({
            ...offerData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { id: docRef.id, ...offerData };
    } else {
        const result = await pool.query(
            `INSERT INTO offers
             (shop_id, type, name, description, status, products, collections,
              discount_type, discount_value, tiers, bundle_config, free_gift,
              display_settings, styling, schedule, targeting, analytics, created_at, updated_at)
             VALUES
                 ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
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

/** Update an offer */
async function updateOffer(id, updates) {
    if (USE_FIREBASE) {
        await pool.collection('offers').doc(id).update({
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const doc = await pool.collection('offers').doc(id).get();
        return { id: doc.id, ...doc.data() };
    } else {
        const toSnakeCase = (str) =>
            str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

        // Remove updatedAt if present (we handle it manually)
        const cleanedUpdates = { ...updates };
        delete cleanedUpdates.updatedAt;
        delete cleanedUpdates.updated_at;

        const fields = Object.keys(cleanedUpdates);

        const setClause = fields
            .map((field, i) => `${toSnakeCase(field)} = $${i + 2}`)
            .join(", ");

        const values = fields.map(f => cleanedUpdates[f]);

        const result = await pool.query(
            `UPDATE offers
             SET ${setClause}${fields.length ? "," : ""} updated_at = NOW()
             WHERE id = $1
                 RETURNING *`,
            [id, ...values]
        );

        return result.rows[0];
    }
}

/** Delete an offer */
async function deleteOffer(id, shopId) {
    if (USE_FIREBASE) {
        const doc = await pool.collection('offers').doc(id).get();
        if (doc.data().shopId !== shopId) throw new Error('Unauthorized');
        await pool.collection('offers').doc(id).delete();
    } else {
        await pool.query('DELETE FROM offers WHERE id = $1 AND shop_id = $2', [id, shopId]);
    }
}

/** Save analytics event */
async function saveAnalyticsEvent(event) {
    if (USE_FIREBASE) {
        await pool.collection('analytics_events').add({
            ...event,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } else {
        await pool.query(
            `INSERT INTO analytics_events (event_name, offer_id, product_id, cart_value,
                                           currency, metadata, shop_id, timestamp)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
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

/** Get analytics events */
async function getAnalyticsEvents(filters = {}) {
    if (USE_FIREBASE) {
        let query = pool.collection('analytics_events').where('shopId', '==', filters.shopId);
        if (filters.offerId) query = query.where('offerId', '==', filters.offerId);
        if (filters.startDate) query = query.where('timestamp', '>=', filters.startDate);
        if (filters.endDate) query = query.where('timestamp', '<=', filters.endDate);
        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
        let query = 'SELECT * FROM analytics_events WHERE shop_id = $1';
        const params = [filters.shopId];
        let paramIndex = 2;
        if (filters.offerId) { query += ` AND offer_id = $${paramIndex}`; params.push(filters.offerId); paramIndex++; }
        if (filters.startDate) { query += ` AND timestamp >= $${paramIndex}`; params.push(filters.startDate); paramIndex++; }
        if (filters.endDate) { query += ` AND timestamp <= $${paramIndex}`; params.push(filters.endDate); }
        const result = await pool.query(query, params);
        return result.rows;
    }
}

/** Get subscription */
async function getSubscription(shopId) {
    if (USE_FIREBASE) {
        const doc = await pool.collection('subscriptions').doc(shopId).get();
        return doc.exists ? doc.data() : null;
    } else {
        const result = await pool.query('SELECT * FROM subscriptions WHERE shop_id = $1', [shopId]);
        return result.rows[0] || null;
    }
}

/** Save subscription */
async function saveSubscription(subscription) {
    if (USE_FIREBASE) {
        await pool.collection('subscriptions').doc(subscription.shopId).set(subscription, { merge: true });
    } else {
        await pool.query(
            `INSERT INTO subscriptions (shop_id, plan, charge_id, status, price, start_date,
                                        billing_on, trial_ends_on, features, cancelled_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                 ON CONFLICT (shop_id) DO UPDATE SET
                plan=$2, charge_id=$3, status=$4, price=$5, start_date=$6,
                                              billing_on=$7, trial_ends_on=$8, features=$9, cancelled_at=$10`,
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

/** Save session */
async function saveSession(session) {
    if (USE_FIREBASE) {
        await pool.collection('sessions').doc(session.id).set(session);
    } else {
        await pool.query(
            `INSERT INTO sessions (id, shop, access_token, expires_at, data)
             VALUES ($1,$2,$3,$4,$5)
                 ON CONFLICT (id) DO UPDATE SET
                shop=$2, access_token=$3, expires_at=$4, data=$5`,
            [session.id, session.shop, session.accessToken, session.expires, JSON.stringify(session)]
        );
    }
}

/** Get session */
async function getSession(id) {
    if (USE_FIREBASE) {
        const doc = await pool.collection('sessions').doc(id).get();
        return doc.exists ? doc.data() : null;
    } else {
        const result = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
        return result.rows[0]?.data || null;
    }
}

/** Delete shop data */
async function deleteShopData(shopId) {
    if (USE_FIREBASE) {
        const batch = pool.batch();
        const offers = await pool.collection('offers').where('shopId', '==', shopId).get();
        offers.docs.forEach(doc => batch.delete(doc.ref));
        const analytics = await pool.collection('analytics_events').where('shopId', '==', shopId).get();
        analytics.docs.forEach(doc => batch.delete(doc.ref));
        batch.delete(pool.collection('subscriptions').doc(shopId));
        await batch.commit();
    } else {
        await pool.query('DELETE FROM offers WHERE shop_id=$1', [shopId]);
        await pool.query('DELETE FROM analytics_events WHERE shop_id=$1', [shopId]);
        await pool.query('DELETE FROM subscriptions WHERE shop_id=$1', [shopId]);
        await pool.query('DELETE FROM sessions WHERE shop=$1', [shopId]);
    }
}

/** Get offers by product ID */
async function getOffersByProduct(productId) {
    if (USE_FIREBASE) {
        const snapshot = await pool.collection('offers')
            .where('products', 'array-contains', productId.toString())
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
        const result = await pool.query(
            `SELECT * FROM offers WHERE products @> $1::jsonb`,
            [JSON.stringify([productId.toString()])]
        );
        return result.rows;
    }
}

async function saveShop({ shop, accessToken }) {
    await pool.query(
        `
            INSERT INTO shop_tokens (shop, access_token, updated_at)
            VALUES ($1, $2, now())
                ON CONFLICT (shop)
    DO UPDATE SET
                access_token = EXCLUDED.access_token,
                           updated_at = now()
        `,
        [shop, accessToken]
    );
}

async function getShopByDomain(shop) {
    const result = await pool.query(
        "select shop, access_token from shop_tokens where shop = $1",
        [shop]
    );
    return result.rows[0];
}


const database = {
    getOffers,
    getOfferById,
    createOffer,
    updateOffer,
    deleteOffer,
    saveAnalyticsEvent,
    getAnalyticsEvents,
    getSubscription,
    saveSubscription,
    getShopByDomain,
    saveShop,
    saveSession,
    getSession,
    deleteShopData,
    getOffersByProduct
};

export default database;