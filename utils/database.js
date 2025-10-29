import { Pool } from 'pg';
import admin from 'firebase-admin';

const USE_FIREBASE = process.env.FIREBASE_PROJECT_ID ? true : false;

let db;

if (USE_FIREBASE) {
    // Firebase implementation
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
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
}

/** Example: getOffers function */
async function getOffers(filters = {}) {
    if (USE_FIREBASE) {
        let query = db.collection('offers').where('shopId', '==', filters.shopId);

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

        const result = await db.query(query, params);
        return result.rows;
    }
}

// ...keep all other functions the same as before...

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
    saveSession,
    getSession,
    deleteShopData,
    getOffersByProduct
};

export default database;