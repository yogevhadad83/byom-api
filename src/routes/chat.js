import { Router } from 'express';
import { callModel } from '../services/model.js';

const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { messages, prompt } = req.body ?? {};
    const msgs = Array.isArray(messages)
      ? messages
      : [{ role: 'user', content: String(prompt ?? '').trim() || 'ping' }];

    const reply = await callModel(msgs, req);
    res.json({ ok: true, reply });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
