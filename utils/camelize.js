export function camelize(obj) {
    if (Array.isArray(obj)) {
        return obj.map(camelize);
    }

    if (obj !== null && typeof obj === "object") {
        return Object.entries(obj).reduce((acc, [key, value]) => {
            const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            acc[camelKey] = camelize(value);
            return acc;
        }, {});
    }

    return obj;
}