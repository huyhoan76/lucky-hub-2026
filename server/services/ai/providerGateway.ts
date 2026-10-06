/**
 * Provider Gateway Client
 * Unified HTTP client for OpenAI-compatible APIs
 * Handles all providers: Google, OpenRouter, Groq, Cohere, Custom, Self-hosted
 */

import { encrypt, decrypt } from '../../utils/encryption.ts';

/** Request message format (OpenAI compatible) */
export interface GatewayMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | GatewayContentPart[];
}

export type GatewayContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

/** Gateway configuration */
export interface GatewayConfig {
  baseUrl: string;
  apiKey: string; // Already decrypted
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs: number;
  retries: number;
  authType: 'bearer' | 'google' | 'api_key' | 'none';
  customHeaders?: Record<string, string>;
}

/** Gateway response */
export interface GatewayResult {
  text: string;
  resolvedModel: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost?: number;
  durationMs: number;
}

/** Gateway error with retry info */
export class GatewayError extends Error {
  status: number;
  retryable: boolean;
  errorCode: string;

  constructor(message: string, status = 0, retryable = false, errorCode = 'GATEWAY_ERROR') {
    super(message);
    this.name = 'GatewayError';
    this.status = status;
    this.retryable = retryable;
    this.errorCode = errorCode;
  }
}

/** Build auth headers for provider */
function buildAuthHeaders(config: GatewayConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  switch (config.authType) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      break;
    case 'google':
      headers['x-goog-api-key'] = config.apiKey;
      break;
    case 'api_key':
      headers['X-API-Key'] = config.apiKey;
      break;
    case 'none':
      // No auth header
      break;
  }

  // Add custom headers
  if (config.customHeaders) {
    Object.assign(headers, config.customHeaders);
  }

  return headers;
}

/** Parse response from various gateway formats */
function parseGatewayResponse(raw: string, requestModel: string): { text: string; resolvedModel: string; usage?: any; cost?: number } {
  let parsed: any;

  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to extract JSON from SSE stream
    const lines = raw.split('\n').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      const data = line.slice(6).trim();
      if (data && data !== '[DONE]') {
        try {
          parsed = JSON.parse(data);
          break;
        } catch {}
      }
    }
  }

  if (!parsed) {
    throw new GatewayError('Empty or invalid response from gateway', 0, true, 'INVALID_RESPONSE');
  }

  // Handle OpenRouter/OpenAI format: { choices: [{ message: { content }, finish_reason }] }
  // Also handle: { data: { choices: [...] } }
  const root = parsed.data || parsed;
  const choice = root.choices?.[0];

  if (!choice) {
    throw new GatewayError('No choices in response', 0, false, 'NO_CHOICES');
  }

  // Extract text content
  let text = '';
  if (choice.message?.content) {
    text = typeof choice.message.content === 'string'
      ? choice.message.content
      : JSON.stringify(choice.message.content);
  } else if (choice.delta?.content) {
    text = choice.delta.content;
  } else if (choice.text) {
    text = choice.text;
  }

  if (!text) {
    throw new GatewayError('Empty content in response', 0, true, 'EMPTY_CONTENT');
  }

  // Extract resolved model (may differ from requested for router models)
  const resolvedModel = root.model || choice.message?.model || requestModel;

  // Extract usage
  const usage = root.usage || choice.usage;

  // Extract cost (OpenRouter specific)
  const cost = choice?.message?.provider_metadata?.gateway?.cost ||
               root.provider_metadata?.gateway?.cost;

  return { text, resolvedModel, usage, cost: cost ? parseFloat(cost) : undefined };
}

/** Check if error is retryable */
function isRetryableError(status: number, errorCode?: string): boolean {
  if (status >= 500) return true;
  if (status === 429) return true;
  if (status === 408) return true; // Request timeout
  if (errorCode === 'ECONNRESET' || errorCode === 'ETIMEDOUT' || errorCode === 'ENOTFOUND') return true;
  return false;
}

/** Check if error is rate limit */
function isRateLimitError(status: number, body: string): boolean {
  if (status === 429) return true;
  const lower = body.toLowerCase();
  return lower.includes('rate limit') || lower.includes('quota') || lower.includes('too many requests');
}

/**
 * Main gateway call with retry logic
 */
export async function callGateway(
  config: GatewayConfig,
  messages: GatewayMessage[],
  requestId: string
): Promise<GatewayResult> {
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const startTime = Date.now();
  const maxAttempts = Math.max(1, config.retries + 1);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const body: Record<string, any> = {
        model: config.model,
        messages,
        stream: false,
      };

      if (config.temperature !== undefined) body.temperature = config.temperature;
      if (config.maxTokens && config.maxTokens > 0) body.max_tokens = config.maxTokens;

      const headers = buildAuthHeaders(config);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const raw = await response.text();
      clearTimeout(timeout);

      if (!response.ok) {
        const retryable = isRetryableError(response.status);
        const rateLimited = isRateLimitError(response.status, raw);

        lastError = new GatewayError(
          `Gateway HTTP ${response.status}: ${raw.slice(0, 500)}`,
          response.status,
          retryable || rateLimited,
          rateLimited ? 'RATE_LIMIT' : `HTTP_${response.status}`
        );

        if ((retryable || rateLimited) && attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff max 10s
          console.warn(`[Gateway] ${requestId} Attempt ${attempt}/${maxAttempts} failed (${response.status}), retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw lastError;
      }

      // Parse successful response
      const result = parseGatewayResponse(raw, config.model);
      const durationMs = Date.now() - startTime;

      console.log(`[Gateway] ${requestId} OK ${durationMs}ms | model=${result.resolvedModel}${result.usage ? ` | tokens=${result.usage.total_tokens}` : ''}${result.cost !== undefined ? ` | cost=$${result.cost}` : ''}`);

      return {
        text: result.text,
        resolvedModel: result.resolvedModel,
        usage: result.usage,
        cost: result.cost,
        durationMs,
      };

    } catch (err: any) {
      clearTimeout(timeout);

      if (err instanceof GatewayError) {
        lastError = err;
        if (err.retryable && attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.warn(`[Gateway] ${requestId} Attempt ${attempt}/${maxAttempts} failed: ${err.message}, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }

      if (err.name === 'AbortError') {
        lastError = new GatewayError(`Gateway timeout after ${config.timeoutMs}ms`, 0, true, 'TIMEOUT');
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw lastError;
      }

      // Network or other error
      lastError = new GatewayError(err?.message || 'Unknown gateway error', 0, true, 'NETWORK_ERROR');
      if (attempt < maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.warn(`[Gateway] ${requestId} Attempt ${attempt}/${maxAttempts} failed: ${err.message}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new GatewayError('Max retries exceeded', 0, false, 'MAX_RETRIES');
}

/**
 * List models from gateway
 */
export async function listModels(config: GatewayConfig): Promise<any[]> {
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/models`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 15000));

  try {
    const headers = buildAuthHeaders(config);
    const response = await fetch(endpoint, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new GatewayError(`Failed to list models: HTTP ${response.status}`, response.status, false);
    }

    const data = await response.json();
    return data.data || data.models || [];
  } catch (err: any) {
    clearTimeout(timeout);
    if (err instanceof GatewayError) throw err;
    throw new GatewayError(err?.message || 'Failed to list models', 0, false);
  }
}

/**
 * Convert Gemini-style payload to OpenAI-compatible messages
 * Handles: contents[], parts[], inlineData, systemInstruction
 */
export function convertGeminiPayload(payload: any, systemOverride?: string): GatewayMessage[] {
  const messages: GatewayMessage[] = [];

  // System prompt
  const systemPrompt = systemOverride || payload?.config?.systemInstruction;
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: typeof systemPrompt === 'string' ? systemPrompt : JSON.stringify(systemPrompt)
    });
  }

  // Handle OpenAI format directly
  if (Array.isArray(payload?.messages)) {
    for (const m of payload.messages) {
      if (!m?.role) continue;
      const role = m.role === 'model' ? 'assistant' : m.role;
      messages.push({ role, content: m.content ?? '' });
    }
    return messages;
  }

  // Handle Gemini format: { contents: [{ role, parts: [...] }] }
  const contents = Array.isArray(payload?.contents) ? payload.contents : [];

  for (const content of contents) {
    const role = content?.role === 'model' ? 'assistant' : (content?.role || 'user');
    const parts = Array.isArray(content?.parts) ? content.parts : [];

    const openaiParts: GatewayContentPart[] = [];
    let hasImage = false;

    for (const part of parts) {
      if (part?.text) {
        openaiParts.push({ type: 'text', text: part.text });
      }
      if (part?.inlineData?.data) {
        hasImage = true;
        const mime = part.inlineData.mimeType || 'image/jpeg';
        const data = part.inlineData.data.startsWith('data:')
          ? part.inlineData.data
          : `data:${mime};base64,${part.inlineData.data}`;
        openaiParts.push({ type: 'image_url', image_url: { url: data } });
      }
      if (part?.fileData?.fileUri) {
        hasImage = true;
        openaiParts.push({ type: 'image_url', image_url: { url: part.fileData.fileUri } });
      }
    }

    if (hasImage) {
      // Ensure there's some text with images
      if (!openaiParts.some(p => p.type === 'text')) {
        openaiParts.push({ type: 'text', text: 'Analyze this image.' });
      }
      messages.push({ role, content: openaiParts });
    } else {
      const text = openaiParts.map(p => p.type === 'text' ? p.text : '').join('\n');
      messages.push({ role, content: text });
    }
  }

  // Fallback: if no messages, add a ping
  if (messages.length === 0) {
    messages.push({ role: 'user', content: 'Ping' });
  }

  return messages;
}