import { Router } from 'express';
import { PROVIDERS } from '../config.js';
import { setProvider, getProvider, deleteProvider, mask } from '../services/agent.js';
import { requireAuth } from '../auth.js';

const router = Router();

// Protected: register or update provider config stored in Supabase (RLS enforces user scope)
router.post('/register-provider', requireAuth, async (req, res) => {
  try {
    const { provider, config } = req.body || {};
    const prov = String(provider || '').trim().toLowerCase();
    if (prov !== PROVIDERS.OPENAI && prov !== PROVIDERS.HTTP) {
      return res.status(400).json({ ok: false, error: `provider must be one of: ${PROVIDERS.OPENAI}, ${PROVIDERS.HTTP}` });
    }
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ ok: false, error: 'config object is required' });
    }
    if (prov === PROVIDERS.OPENAI && !String(config.apiKey || '').trim()) {
      return res.status(400).json({ ok: false, error: 'config.apiKey is required for openai' });
    }
    if (prov === PROVIDERS.HTTP && !String(config.endpoint || '').trim()) {
      return res.status(400).json({ ok: false, error: 'config.endpoint is required for http' });
    }

    const supabase = req.supabase;
    const user = req.user;
    let dbOk = false;
    try {
      const { error } = await supabase
        .from('providers')
        .upsert({
          user_id: user.id,
          provider: prov,
          config,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      dbOk = true;
    } catch (dbErr) {
      // eslint-disable-next-line no-console
      console.warn('DB upsert failed; falling back to memory:', dbErr?.message || dbErr);
    }

    // Maintain legacy in-memory store for compatibility (GET/DELETE and some tests)
    try {
      setProvider(user.id, { provider: prov, ...config });
    } catch {}

    // Log user and provider type (no secrets)
    try { console.log('register-provider', { userId: user.id, provider: prov, persisted: dbOk }); } catch {}
    return res.json({ ok: true, persisted: dbOk });
  } catch (e) {
    const status = Number(e?.status || 500) || 500;
    return res.status(status).json({ ok: false, error: String(e?.message || e) });
  }
});

// Fetch provider config for current authenticated user
router.get('/provider', requireAuth, async (req, res) => {
  try {
    const supabase = req.supabase;
    const user = req.user;

    let prov = null;
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('provider, config')
        .eq('user_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) prov = data;
    } catch (dbErr) {
      // eslint-disable-next-line no-console
      console.warn('DB fetch failed; will try in-memory agent:', dbErr?.message || dbErr);
    }

    if (!prov) {
      const mem = getProvider(user.id);
      if (mem) prov = { provider: mem.provider, config: { apiKey: mem.apiKey, model: mem.model, endpoint: mem.endpoint, systemPrompt: mem.systemPrompt } };
    }

    if (!prov) return res.status(404).json({ ok: false, error: 'No provider configured for this user.' });

    const masked = mask({ provider: prov.provider, ...(prov.config || {}) });
    return res.json({ ok: true, provider: masked });
  } catch (e) {
    const status = Number(e?.status || 500) || 500;
    return res.status(status).json({ ok: false, error: String(e?.message || e) });
  }
});

router.delete('/provider', requireAuth, async (req, res) => {
  try {
    const supabase = req.supabase;
    const user = req.user;

    let dbOk = false;
    try {
      const { error } = await supabase
        .from('providers')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      dbOk = true;
    } catch (dbErr) {
      // eslint-disable-next-line no-console
      console.warn('DB delete failed; will still clear in-memory:', dbErr?.message || dbErr);
    }

    const deleted = deleteProvider(user.id);
    try { console.log('delete-provider', { userId: user.id, persisted: dbOk, memoryCleared: Boolean(deleted) }); } catch {}
    return res.json({ ok: true });
  } catch (e) {
    const status = Number(e?.status || 500) || 500;
    return res.status(status).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
