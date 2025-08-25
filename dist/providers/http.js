// Generic HTTP passthrough for custom endpoints.
export async function httpChat({ endpoint, model, messages }) {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-llm-model': model || '' },
        body: JSON.stringify({ messages }),
    });
    if (!res.ok)
        throw new Error(`HTTP provider error ${res.status}`);
    const json = await res.json();
    return json.reply || json.content || json.output || '(no content)';
}
