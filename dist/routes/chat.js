import { Router } from 'express';
import { callModel } from '../services/model.js';
import agent from '../services/agent.js';
import { requireAuth } from '../auth.js';
const router = Router();
// POST /chat
// Accepts multiple input shapes: prompt, messages (OpenAI style), or conversation snapshot.
router.post('/chat', requireAuth, async (req, res) => {
    try {
        const body = req.body ?? {};
        const { conversationId, prompt, conversation, messages } = body;
        const supabase = req.supabase;
        const user = req.user;
        // Validation
        if (!prompt && !conversation && !messages) {
            return res.status(400).json({ ok: false, error: 'Either conversation or messages or prompt is required' });
        }
        // Build base messages (OpenAI chat format)
        const baseOutMessages = [];
        if (Array.isArray(conversation)) {
            const lines = conversation.map(c => `${c.author}: ${c.text}`);
            baseOutMessages.push({ role: 'user', content: 'Conversation so far:\n' + lines.join('\n') });
        }
        if (Array.isArray(messages)) {
            for (const m of messages)
                baseOutMessages.push(m);
        }
        if (prompt && String(prompt).trim() !== '') {
            baseOutMessages.push({ role: 'user', content: String(prompt) });
        }
        // In test mode, allow header-based path to keep unit tests meaningful
        const isTest = process.env.NODE_ENV === 'test';
        if (isTest) {
            // Prefer agent config (override headers) to match new behavior
            const testUserId = String(req?.body?.userId || '').trim();
            if (testUserId) {
                const agentCfg = agent.getProvider(testUserId);
                if (agentCfg) {
                    const overrideConfig = {
                        provider: agentCfg.provider,
                        apiKey: agentCfg.apiKey,
                        model: agentCfg.model,
                        endpoint: agentCfg.endpoint,
                    };
                    const result = await callModel(baseOutMessages, req, { userId: testUserId, overrideConfig });
                    const modelId = agentCfg?.model ?? null;
                    if (result && typeof result === 'object') {
                        const mergedMeta = { ...(result.meta || {}), modelId };
                        return res.json({ ok: true, reply: result.text, meta: mergedMeta });
                    }
                    return res.json({ ok: true, reply: String(result), meta: { modelId } });
                }
            }
            // Fallback to header-based path if no agent config
            try {
                const result = await callModel(baseOutMessages, req, {});
                const text = typeof result === 'string' ? result : result.text;
                const meta = typeof result === 'object' ? result.meta || {} : {};
                return res.json({ ok: true, reply: text, meta });
            }
            catch {
                // fall through to DB-backed fetch
            }
        }
        // Fetch provider config for current user via RLS-protected table
        let prov = null;
        try {
            const { data, error } = await supabase
                .from('providers')
                .select('provider, config')
                .eq('user_id', user.id)
                .single();
            if (error && error.code !== 'PGRST116')
                throw error;
            if (data)
                prov = data;
        }
        catch (dbErr) {
            // eslint-disable-next-line no-console
            console.warn('DB fetch failed; will try in-memory agent:', dbErr?.message || dbErr);
        }
        if (!prov) {
            const mem = agent.getProvider(user.id);
            if (mem)
                prov = { provider: mem.provider, config: { apiKey: mem.apiKey, model: mem.model, endpoint: mem.endpoint, systemPrompt: mem.systemPrompt } };
        }
        if (!prov)
            return res.status(400).json({ ok: false, error: 'No provider configured for this user. Register a provider first.' });
        if (!conversation && !messages && !prompt) {
            return res.status(400).json({ ok: false, error: 'Either conversation or messages or prompt is required' });
        }
        // Resolve provider config for this user early (for existence check and possible systemPrompt)
        const providerCfg = { provider: prov.provider, ...prov.config };
        // Build final messages array including optional systemPrompt
        const outMessages = [];
        if (providerCfg.systemPrompt) {
            outMessages.push({ role: 'system', content: providerCfg.systemPrompt });
        }
        outMessages.push(...baseOutMessages);
        // Call model service with overrideConfig built from agent (provider+apiKey+model+endpoint)
        const overrideConfig = {
            provider: providerCfg.provider,
            apiKey: providerCfg.apiKey,
            model: providerCfg.model,
            endpoint: providerCfg.endpoint,
        };
        const result = await callModel(outMessages, req, { userId: user.id, overrideConfig });
        // Log user and provider (no secrets)
        try {
            console.log('chat', { userId: user.id, provider: providerCfg.provider });
        }
        catch { }
        // callModel may return either a string (reply) or an object { text, meta }
        const modelId = providerCfg?.model ?? null;
        if (result && typeof result === 'object') {
            const mergedMeta = { ...(result.meta || {}), modelId };
            return res.json({ ok: true, reply: result.text, meta: mergedMeta });
        }
        return res.json({ ok: true, reply: String(result), meta: { modelId } });
    }
    catch (e) {
        const status = Number(e?.status || 500) || 500;
        // preserve quota/rate-limit normalization already in service
        return res.status(status).json({ ok: false, error: String(e?.message || e) });
    }
});
export default router;
