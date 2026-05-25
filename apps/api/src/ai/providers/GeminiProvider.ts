import type { AIChatMessage, AIChatOptions, AIProvider } from './AIProvider.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function normalizeModelId(model: string): string {
  return model.replace(/^models\//, '').trim();
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const;
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey.trim();
    this.model = normalizeModelId(model?.trim() || DEFAULT_MODEL);
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey?.trim());
  }

  async chat(messages: AIChatMessage[], opts: AIChatOptions = {}): Promise<string> {
    if (!this.isConfigured) throw new Error('Gemini API key is not configured');

    // Gemini API uses a `contents` array — we fold system messages into a
    // top-level systemInstruction and pass user+assistant alternating turns.
    const systemMessages = messages.filter((m) => m.role === 'system' && m.content.trim());
    const turns = messages
      .filter((m) => m.role !== 'system' && m.content.trim())
      .map((t) => ({
        role: t.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: t.content }],
      }));

    if (turns.length === 0) {
      turns.push({ role: 'user', parts: [{ text: 'Respond to the instructions above.' }] });
    }

    const systemText = systemMessages.map((m) => m.content).join('\n');

    const body: Record<string, unknown> = {
      contents: turns,
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: opts.maxOutputTokens ?? 2048,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    };
    if (systemText) {
      body.systemInstruction = { parts: [{ text: systemText }] };
    }

    const url = `${BASE}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      let detail = text.slice(0, 500);
      try {
        const errJson = JSON.parse(text) as { error?: { message?: string } };
        if (errJson.error?.message) detail = errJson.error.message;
      } catch { /* raw text */ }
      throw new Error(`Gemini API error (${res.status}): ${detail}`);
    }

    const json = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
    if (!text) throw new Error('Empty response from Gemini');
    return text;
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.chat(
        [
          { role: 'system', content: 'Respond with the JSON {"ok":true}.' },
          { role: 'user', content: 'ping' },
        ],
        { json: true, maxOutputTokens: 30 },
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
