// utils/tokenManager.js
import pool from "./db.js";

const SHOPIFY_TOKEN_URL = (shop) =>
    `https://${shop}/admin/oauth/access_token`;

function addSeconds(seconds) {
    const parsedSeconds = Number(seconds);

    if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) {
        throw new Error(`Invalid token expiry value: ${seconds}`);
    }

    return new Date(Date.now() + parsedSeconds * 1000);
}

function isExpiringSoon(date, bufferMs = 5 * 60 * 1000) {
    if (!date) return true;

    const expiryTime = new Date(date).getTime();

    if (Number.isNaN(expiryTime)) {
        return true;
    }

    return expiryTime <= Date.now() + bufferMs;
}

export async function refreshOfflineToken(shop, refreshToken) {
    if (!shop || !refreshToken) {
        throw new Error("Shop and refresh token are required");
    }

    const body = new URLSearchParams({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });

    const response = await fetch(SHOPIFY_TOKEN_URL(shop), {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body,
    });

    const json = await response.json().catch(() => null);

    if (
        !response.ok ||
        !json?.access_token ||
        !json?.refresh_token ||
        !json?.expires_in ||
        !json?.refresh_token_expires_in
    ) {
        console.error("Shopify offline-token refresh failed", {
            shop,
            status: response.status,
            error: json?.error,
            errorDescription: json?.error_description,
        });

        throw new Error(
            json?.error_description ||
            "Failed to refresh Shopify offline access token"
        );
    }

    const accessTokenExpiresAt = addSeconds(json.expires_in);
    const refreshTokenExpiresAt = addSeconds(
        json.refresh_token_expires_in
    );

    const result = await pool.query(
        `
            UPDATE shop_tokens
            SET access_token = $1,
                refresh_token = $2,
                access_token_expires_at = $3,
                refresh_token_expires_at = $4,
                token_type = 'expiring_offline',
                updated_at = now()
            WHERE shop = $5
            RETURNING shop
        `,
        [
            json.access_token,
            json.refresh_token,
            accessTokenExpiresAt,
            refreshTokenExpiresAt,
            shop,
        ]
    );

    if (result.rowCount !== 1) {
        throw new Error(
            `Could not save refreshed token for shop ${shop}`
        );
    }

    return json.access_token;
}

export async function getValidOfflineAccessToken(shop) {
    if (!shop) {
        throw new Error("Shop is required");
    }

    const result = await pool.query(
        `
            SELECT access_token,
                   refresh_token,
                   access_token_expires_at,
                   refresh_token_expires_at,
                   token_type
            FROM shop_tokens
            WHERE shop = $1
                LIMIT 1
        `,
        [shop]
    );

    const row = result.rows[0];

    if (!row?.access_token) {
        throw new Error(`No access token found for shop ${shop}`);
    }

    if (row.token_type !== "expiring_offline") {
        return row.access_token;
    }

    if (!isExpiringSoon(row.access_token_expires_at)) {
        return row.access_token;
    }

    if (!row.refresh_token) {
        throw new Error(
            `Missing refresh token for migrated shop ${shop}`
        );
    }

    if (
        row.refresh_token_expires_at &&
        isExpiringSoon(row.refresh_token_expires_at, 0)
    ) {
        throw new Error(
            `Refresh token has expired for shop ${shop}; reauthorization is required`
        );
    }

    return refreshOfflineToken(shop, row.refresh_token);
}

export async function exchangeOfflineToken({
                                               shop,
                                               oldAccessToken,
                                           }) {
    if (!shop || !oldAccessToken) {
        throw new Error(
            "Shop and existing offline access token are required"
        );
    }

    const body = new URLSearchParams({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        grant_type:
            "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: oldAccessToken,
        subject_token_type:
            "urn:shopify:params:oauth:token-type:offline-access-token",
        requested_token_type:
            "urn:shopify:params:oauth:token-type:offline-access-token",
        expiring: "1",
    });

    const response = await fetch(SHOPIFY_TOKEN_URL(shop), {
        method: "POST",
        headers: {
            "Content-Type":
                "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body,
    });

    const json = await response.json().catch(() => null);

    if (
        !response.ok ||
        !json?.access_token ||
        !json?.refresh_token ||
        !json?.expires_in ||
        !json?.refresh_token_expires_in
    ) {
        console.error("Offline-token exchange failed:", {
            shop,
            status: response.status,
            error: json?.error,
            errorDescription: json?.error_description,
            hasAccessToken: Boolean(json?.access_token),
            hasRefreshToken: Boolean(json?.refresh_token),
        });

        throw new Error(
            json?.error_description ||
            "Failed to exchange Shopify offline access token"
        );
    }

    return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        scope: json.scope || null,
        accessTokenExpiresAt: addSeconds(json.expires_in),
        refreshTokenExpiresAt: addSeconds(
            json.refresh_token_expires_in
        ),
    };
}