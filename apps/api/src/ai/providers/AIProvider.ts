/**
 * AIProvider abstraction.
 * Implementations: OpenAIProvider, GeminiProvider, DisabledProvider.
 * NodeMap never sends entire repos to an AI — only structured context.
 */

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatOptions {
  /** Request a JSON-formatted response. */
  json?: boolean;
  /** Temperature override. */
  temperature?: number;
  /** Hard upper bound on output tokens. */
  maxOutputTokens?: number;
}

export interface AIProvider {
  readonly id: 'openai' | 'gemini' | 'disabled';
  readonly model: string;
  readonly isConfigured: boolean;
  chat(messages: AIChatMessage[], opts?: AIChatOptions): Promise<string>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}

export class DisabledProvider implements AIProvider {
  readonly id = 'disabled' as const;
  readonly model = 'disabled';
  readonly isConfigured = false;
  async chat(): Promise<string> {
    throw new Error('AI is disabled. Configure a provider in Settings.');
  }
  async testConnection() {
    return { ok: false, error: 'AI provider is set to "disabled"' };
  }
}
