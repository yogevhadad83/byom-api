import OpenAI from 'openai';
// Initialize an OpenAI client with the provided API key, or return null if invalid/missing.
export function makeOpenAIClient(apiKey) {
    try {
        if (!apiKey)
            return null;
        return new OpenAI({ apiKey });
    }
    catch (_e) {
        return null;
    }
}
// Call OpenAI chat completions API and return first message content.
export async function openaiChat({ client, model, messages }) {
    const completion = await client.chat.completions.create({ model, messages });
    const text = completion.choices?.[0]?.message?.content ?? '(no content)';
    return { text, meta: { modelId: model } };
}
