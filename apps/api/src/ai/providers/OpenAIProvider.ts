import type { AIChatMessage, AIChatOptions, AIProvider } from './AIProvider.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/** o-series / reasoning models reject temperature + json_mode + max_tokens */
function isReasoningModel(model: string): boolean {
  const m = model.toLowerCase();
  return /^o\d/.test(m) || m.startsWith('gpt-5');
}

function supportsJsonMode(model: string): boolean {
  if (isReasoningModel(model)) return false;
  const m = model.toLowerCase();
  return m.includes('gpt-4') || m.includes('gpt-3.5') || m.includes('gpt-4o');
}

function normalizeModel(model: string): string {
  return model.replace(/^openai\//i, '').trim();
}

function parseOpenAiError(status: number, text: string): string {
  try {
    const errJson = JSON.parse(text) as { error?: { message?: string; type?: string } };
    if (errJson.error?.message) {
      return `OpenAI (${status}): ${errJson.error.message}`;
    }
  } catch { /* fall through */ }
  return `OpenAI API error (${status}): ${text.slice(0, 500)}`;
}

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey.trim();
    const normalized = normalizeModel(model?.trim() || DEFAULT_MODEL);
    this.model = normalized || DEFAULT_MODEL;
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private buildBody(messages: AIChatMessage[], opts: AIChatOptions): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
    };

    if (!isReasoningModel(this.model)) {
      body.temperature = opts.temperature ?? 0.3;
    }

    if (opts.json && supportsJsonMode(this.model)) {
      const hasJsonHint = messages.some((m) => /json/i.test(m.content));
      body.response_format = { type: 'json_object' };
      if (!hasJsonHint) {
        (body.messages as AIChatMessage[]).unshift({
          role: 'system',
          content: 'You must respond with valid JSON only.',
        });
      }
    }

    if (opts.maxOutputTokens) {
      if (isReasoningModel(this.model)) {
        body.max_completion_tokens = opts.maxOutputTokens;
      } else {
        body.max_tokens = opts.maxOutputTokens;
      }
    }

    return body;
  }

  async chat(messages: AIChatMessage[], opts: AIChatOptions = {}): Promise<string> {
    if (!this.isConfigured) throw new Error('OpenAI API key is not configured');

    if (!this.apiKey.startsWith('sk-')) {
      throw new Error(
        'OpenAI API key should start with "sk-". Check for extra spaces or a pasted project/organization key in the wrong field.',
      );
    }

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.buildBody(messages, opts)),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(parseOpenAiError(res.status, text));
    }

    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');
    return content;
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.chat(
        [{ role: 'user', content: 'Reply with exactly: ok' }],
        { maxOutputTokens: 16 },
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
