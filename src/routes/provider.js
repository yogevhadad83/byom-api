import { Router } from 'express';
import { PROVIDERS } from '../config.js';
import { setProvider, getProvider, deleteProvider, mask } from '../services/agent.js';
import supabaseAuth from '../supabaseAuth.js';

const router = Router();

// Protected: register or update provider config stored in Supabase (RLS enforces user scope)
router.post('/register-provider', supabaseAuth(), async (req, res) => {
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

    const { error } = await supabase
      .from('providers')
      .upsert({
        user_id: user.id,
        provider: prov,
        config,
        updated_at: new Date().toISOString(),
      });
    if (error) return res.status(400).json({ ok: false, error: error.message || String(error) });

    // Maintain legacy in-memory store for compatibility (GET/DELETE and some tests)
    try {
      setProvider(user.id, { provider: prov, ...config });
    } catch {}

    return res.json({ ok: true });
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
