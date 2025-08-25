// In-memory per-user provider config store with TTL and periodic purge.
// Shape of stored config: { provider: 'openai'|'http', model?, apiKey?, endpoint? }
import { PROVIDERS } from '../config.js';
const DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
// userId -> { cfg, expiresAt }
const store = new Map();
function now() {
    return Date.now();
}
function isValidProviderConfig(cfg) {
    if (!cfg || typeof cfg !== 'object')
        return false;
    const provider = String(cfg.provider || '').toLowerCase();
    if (provider !== PROVIDERS.OPENAI && provider !== PROVIDERS.HTTP)
        return false;
    if (provider === PROVIDERS.OPENAI && !String(cfg.apiKey || '').trim())
        return false;
    if (provider === PROVIDERS.HTTP && !String(cfg.endpoint || '').trim())
        return false;
    return true;
}
export function setProvider(userId, cfg, ttlMs = DAY_MS) {
    const id = String(userId || '').trim();
    if (!id)
        throw Object.assign(new Error('userId is required'), { status: 400 });
    if (!cfg || typeof cfg !== 'object')
        throw Object.assign(new Error('config object is required'), { status: 400 });
    const provider = String(cfg.provider || '').toLowerCase();
    const merged = { provider, model: cfg.model || '', apiKey: cfg.apiKey || '', endpoint: cfg.endpoint || '' };
    if (!isValidProviderConfig(merged)) {
        throw Object.assign(new Error('Invalid provider config: openai requires apiKey; http requires endpoint.'), { status: 400 });
    }
    store.set(id, { cfg: merged, expiresAt: now() + Number(ttlMs || DAY_MS) });
}
export function getProvider(userId) {
    const id = String(userId || '').trim();
    if (!id)
        return null;
    const entry = store.get(id);
    if (!entry)
        return null;
    if (entry.expiresAt <= now()) {
        store.delete(id);
        return null;
    }
    return entry.cfg;
}
export function deleteProvider(userId) {
    const id = String(userId || '').trim();
    if (!id)
        return false;
    return store.delete(id);
}
export function mask(cfg) {
    if (!cfg || typeof cfg !== 'object')
        return cfg;
    const apiKey = String(cfg.apiKey || '').trim();
    let masked = apiKey;
    if (apiKey) {
        const last4 = apiKey.slice(-4);
        const prefix = apiKey.startsWith('sk-') ? 'sk-' : '';
        masked = `${prefix}****${last4}`;
    }
    return { ...cfg, apiKey: apiKey ? masked : '' };
}
function purgeExpired() {
    const t = now();
    for (const [id, entry] of store.entries()) {
        if (!entry || entry.expiresAt <= t)
            store.delete(id);
    }
}
// Periodic purge
setInterval(purgeExpired, PURGE_INTERVAL_MS).unref?.();
export default {
    setProvider,
    getProvider,
    deleteProvider,
    mask,
};
