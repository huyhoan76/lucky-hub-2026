/**
 * Provider Definitions
 * Configuration for all supported AI providers
 */

export type ProviderId = 'google' | 'openrouter' | 'groq' | 'cohere' | 'custom' | 'selfhosted';

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  baseUrl: string;
  modelsEndpoint: string;
  authType: 'bearer' | 'api_key' | 'none' | 'google'; // google = x-goog-api-key header
  defaultTimeoutMs: number;
  defaultRetries: number;
  freeModels: string[]; // Model IDs that are free tier
  visionModels: string[]; // Model IDs known to support vision
  requiresCustomUrl: boolean; // true for custom/selfhosted
  description: string;
}

export const PROVIDER_DEFINITIONS: Record<ProviderId, ProviderDefinition> = {
  google: {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelsEndpoint: '/models',
    authType: 'google', // Uses x-goog-api-key header
    defaultTimeoutMs: 45000,
    defaultRetries: 2,
    freeModels: [
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-lite',
    ],
    visionModels: [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-lite',
    ],
    requiresCustomUrl: false,
    description: 'Google\'s Gemini models with generous free tier (1500 RPM)',
  },

  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelsEndpoint: '/models',
    authType: 'bearer', // Authorization: Bearer <key>
    defaultTimeoutMs: 60000,
    defaultRetries: 2,
    freeModels: [
      'deepseek/deepseek-chat',
      'deepseek/deepseek-v3',
      'qwen/qwen-2.5-vl',
      'meta-llama/llama-3.1-70b-instruct',
      'meta-llama/llama-3.1-8b-instruct',
      'google/gemma-2-9b-it',
      'mistralai/mistral-7b-instruct',
    ],
    visionModels: [
      'qwen/qwen-2.5-vl',
      'google/gemini-2.5-flash',
      'google/gemini-2.0-flash-exp',
      'openai/gpt-4o-mini',
      'openai/gpt-4o',
      'anthropic/claude-3.5-sonnet',
      'meta-llama/llama-3.2-11b-vision-instruct',
    ],
    requiresCustomUrl: false,
    description: 'Unified gateway for 100+ models including many free options',
  },

  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelsEndpoint: '/models',
    authType: 'bearer',
    defaultTimeoutMs: 30000,
    defaultRetries: 2,
    freeModels: [
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
    visionModels: [], // Groq doesn't support vision yet
    requiresCustomUrl: false,
    description: 'Ultra-fast inference for Llama, Mixtral, Gemma (no vision support)',
  },

  cohere: {
    id: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.com/v1',
    modelsEndpoint: '/models',
    authType: 'bearer',
    defaultTimeoutMs: 45000,
    defaultRetries: 2,
    freeModels: [
      'command-r',
      'command-r-plus',
    ],
    visionModels: [], // Cohere doesn't support vision
    requiresCustomUrl: false,
    description: 'Command R/R+ models optimized for RAG and enterprise',
  },

  custom: {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    baseUrl: '', // User must provide
    modelsEndpoint: '/models',
    authType: 'bearer',
    defaultTimeoutMs: 45000,
    defaultRetries: 2,
    freeModels: [],
    visionModels: [],
    requiresCustomUrl: true,
    description: 'Any OpenAI-compatible API (vLLM, TGI, LocalAI, etc.)',
  },

  selfhosted: {
    id: 'selfhosted',
    name: 'Self-hosted Gateway',
    baseUrl: '', // User must provide (e.g., http://mc.luckyhub.io.vn:20128/v1)
    modelsEndpoint: '/models',
    authType: 'bearer', // or 'none' if no auth needed
    defaultTimeoutMs: 60000,
    defaultRetries: 3,
    freeModels: [],
    visionModels: [],
    requiresCustomUrl: true,
    description: 'Your own GPU gateway (RunPod, Lambda, local server, etc.)',
  },
};

/**
 * Get provider definition by ID
 */
export function getProviderDefinition(providerId: ProviderId): ProviderDefinition {
  return PROVIDER_DEFINITIONS[providerId];
}

/**
 * Get all provider definitions (for admin UI dropdown)
 */
export function getAllProviderDefinitions(): ProviderDefinition[] {
  return Object.values(PROVIDER_DEFINITIONS);
}

/**
 * Get providers that support vision
 */
export function getVisionProviders(): ProviderDefinition[] {
  return Object.values(PROVIDER_DEFINITIONS).filter(p => p.visionModels.length > 0);
}

/**
 * Get providers with free tier models
 */
export function getFreeTierProviders(): ProviderDefinition[] {
  return Object.values(PROVIDER_DEFINITIONS).filter(p => p.freeModels.length > 0);
}

/**
 * Check if a model ID is a known free tier model for a provider
 */
export function isFreeTierModel(providerId: ProviderId, modelId: string): boolean {
  const def = PROVIDER_DEFINITIONS[providerId];
  return def.freeModels.some(free => modelId.toLowerCase().includes(free.toLowerCase()));
}

/**
 * Check if a model ID is a known vision model for a provider
 */
export function isVisionModel(providerId: ProviderId, modelId: string): boolean {
  const def = PROVIDER_DEFINITIONS[providerId];
  return def.visionModels.some(vision => modelId.toLowerCase().includes(vision.toLowerCase()));
}

/**
 * Detect capabilities from model ID and provider definition
 */
export function detectCapabilities(modelId: string, providerId: ProviderId): {
  chat: boolean;
  vision: boolean;
  functionCalling: boolean;
  jsonMode: boolean;
  maxContext: number;
  maxOutput: number;
} {
  const def = PROVIDER_DEFINITIONS[providerId];
  const id = modelId.toLowerCase();

  const hasVision = def.visionModels.some(v => id.includes(v.toLowerCase())) ||
    id.includes('vision') || id.includes('vl') || id.includes('gpt-4o') || id.includes('claude-3.5');

  const hasFunctionCalling = id.includes('gpt-4') || id.includes('gemini') || id.includes('claude') ||
    id.includes('command-r') || id.includes('function');

  // Estimate context window
  let maxContext = 4096;
  if (id.includes('32k') || id.includes('32768')) maxContext = 32768;
  else if (id.includes('16k') || id.includes('16384')) maxContext = 16384;
  else if (id.includes('8k') || id.includes('8192')) maxContext = 8192;
  else if (id.includes('128k') || id.includes('131072')) maxContext = 131072;
  else if (id.includes('200k') || id.includes('200000')) maxContext = 200000;
  else if (id.includes('1m') || id.includes('1000000') || id.includes('1048576')) maxContext = 1048576;
  else if (id.includes('gemini-1.5')) maxContext = 1000000; // 1M for Gemini 1.5
  else if (id.includes('gemini-2.0')) maxContext = 1000000;
  else if (id.includes('gpt-4o')) maxContext = 128000;
  else if (id.includes('claude-3.5')) maxContext = 200000;

  // Estimate max output
  let maxOutput = 2048;
  if (id.includes('gemini')) maxOutput = 8192;
  else if (id.includes('gpt-4o')) maxOutput = 4096;
  else if (id.includes('claude')) maxOutput = 4096;
  else if (id.includes('command-r')) maxOutput = 4096;

  return {
    chat: true,
    vision: hasVision,
    functionCalling: hasFunctionCalling,
    jsonMode: true, // Most modern models support JSON mode
    maxContext,
    maxOutput,
  };
}

/**
 * Format model name for display
 */
export function formatModelName(modelId: string): string {
  // Convert "deepseek/deepseek-chat" -> "DeepSeek Chat"
  // Convert "gemini-1.5-flash" -> "Gemini 1.5 Flash"
  return modelId
    .split('/')
    .pop()! // Take last part after /
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Get auth header name for provider
 */
export function getAuthHeaderType(authType: ProviderDefinition['authType']): string {
  switch (authType) {
    case 'bearer': return 'Authorization';
    case 'api_key': return 'X-API-Key';
    case 'google': return 'x-goog-api-key';
    case 'none': return '';
  }
}