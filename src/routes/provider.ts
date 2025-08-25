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

router.get('/provider/:userId', (req, res) => {
  const id = String(req.params.userId || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'userId param is required' });
  const cfg = getProvider(id);
  if (!cfg) return res.status(404).json({ ok: false, error: 'No provider configured for this user.' });
  return res.json({ ok: true, provider: mask(cfg) });
});

router.delete('/provider', (req, res) => {
  const { userId } = req.body || {};
  const id = String(userId || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'userId is required' });
  const deleted = deleteProvider(id);
  return res.json({ ok: true, deleted: Boolean(deleted) });
});

export default router;
