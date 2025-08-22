import { Router } from 'express';
import { callModel } from '../services/model.js';

const router = Router();

router.post('/chat', async (req, res) => {
  try {
  const { messages, prompt, userId } = req.body ?? {};
    const msgs = Array.isArray(messages)
      ? messages
      : [{ role: 'user', content: String(prompt ?? '').trim() || 'ping' }];

  const reply = await callModel(msgs, req, { userId });
    res.json({ ok: true, reply });
  } catch (e) {
  const status = Number(e?.status || 500) || 500;
  res.status(status).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
