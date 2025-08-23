import { Router } from 'express';
import { callModel } from '../services/model.js';
import agent from '../services/agent.js';

const router = Router();

// POST /chat
// Accepts multiple input shapes: prompt, messages (OpenAI style), or conversation snapshot.
router.post('/chat', async (req, res) => {
  try {
    const body = req.body ?? {};
    const { userId, conversationId, prompt, conversation, messages } = body;

    // Validation
    if (!userId || String(userId).trim() === '') {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }

    if (!conversation && !messages && !prompt) {
      return res.status(400).json({ ok: false, error: 'Either conversation or messages or prompt is required' });
    }

    // Resolve provider config for this user early (for existence check and possible systemPrompt)
    const providerCfg = agent.getProvider(userId);
    if (!providerCfg) {
      return res.status(400).json({ ok: false, error: 'No provider configured for this user. Register a provider first.' });
    }

    // Build unified messages array (OpenAI chat format)
    const outMessages = [];
    if (providerCfg.systemPrompt) {
      outMessages.push({ role: 'system', content: providerCfg.systemPrompt });
    }

    // conversation snapshot -> single user message with lines of context
    if (Array.isArray(conversation)) {
      const lines = conversation.map(c => `${c.author}: ${c.text}`);
      outMessages.push({ role: 'user', content: 'Conversation so far:\n' + lines.join('\n') });
    }

    // messages are already OpenAI-style
    if (Array.isArray(messages)) {
      for (const m of messages) {
        outMessages.push(m);
      }
    }

    // prompt appended as a user message
    if (prompt && String(prompt).trim() !== '') {
      outMessages.push({ role: 'user', content: String(prompt) });
    }

    // Call model service with overrideConfig built from agent (provider+apiKey+model+endpoint)
    const overrideConfig = {
      provider: providerCfg.provider,
      apiKey: providerCfg.apiKey,
      model: providerCfg.model,
      endpoint: providerCfg.endpoint,
    };

    const result = await callModel(outMessages, req, { userId, overrideConfig });

    // callModel may return either a string (reply) or an object { text, meta }
    if (result && typeof result === 'object') {
      return res.json({ ok: true, reply: result.text, meta: result.meta || {} });
    }

    return res.json({ ok: true, reply: String(result) });
  } catch (e) {
    const status = Number(e?.status || 500) || 500;
    // preserve quota/rate-limit normalization already in service
    return res.status(status).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
