import { Router, type Response } from 'express';
import { PROVIDERS } from '../config.js';
import { setProvider, getProvider, deleteProvider, mask } from '../services/agent.js';
import { requireAuth, type AuthedRequest } from '../auth.js';

const router = Router();

// Protected: register or update provider config stored in Supabase (RLS enforces user scope)
router.post('/register-provider', requireAuth, async (req: AuthedRequest, res: Response) => {
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

// GET /provider (auth): fetch current user's provider from DB, fallback to memory
router.get('/provider', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const user = req.user!;

    let prov: any = null;
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('provider, config')
        .eq('user_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) prov = data;
    } catch (dbErr: any) {
      // eslint-disable-next-line no-console
      console.warn('DB fetch failed; trying in-memory fallback:', dbErr?.message || dbErr);
    }

    if (!prov) {
      const mem = getProvider(user.id);
      if (mem) {
        const masked = mask(mem);
        return res.json({ ok: true, provider: { provider: masked.provider, config: { apiKey: masked.apiKey, model: masked.model, endpoint: masked.endpoint, systemPrompt: masked.systemPrompt } } });
      }
      return res.status(404).json({ ok: false, error: 'No provider configured for this user.' });
    }

    const masked = mask({ provider: prov.provider, ...prov.config });
    return res.json({ ok: true, provider: { provider: masked.provider, config: { apiKey: masked.apiKey, model: masked.model, endpoint: masked.endpoint, systemPrompt: masked.systemPrompt } } });
  } catch (e: any) {
    const status = Number(e?.status || 500) || 500;
    return res.status(status).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE /provider (auth): delete current user's row from DB and clear memory
router.delete('/provider', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const user = req.user!;
    let dbOk = false;
    try {
      const { error } = await supabase
        .from('providers')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      dbOk = true;
    } catch (dbErr: any) {
      // eslint-disable-next-line no-console
      console.warn('DB delete failed; still clearing memory:', dbErr?.message || dbErr);
    }
    try { deleteProvider(user.id); } catch {}
    return res.json({ ok: true, deleted: dbOk });
  } catch (e: any) {
    const status = Number(e?.status || 500) || 500;
    return res.status(status).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
