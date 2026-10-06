/**
 * AI Log Service
 * Comprehensive logging with debug mode toggle for all AI requests
 */

import { AILog } from '../../models/AILog.ts';

let debugMode = true; // ENABLED by default for debugging
const DEBUG_LOG_LIMIT = 10000; // Max debug logs to keep

/**
 * Enable/disable debug mode
 * When enabled, stores full request/response payloads
 */
export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
  console.log(`[AI-Log] Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

export function getDebugMode(): boolean {
  return debugMode;
}

/**
 * Sanitize payload for logging (remove sensitive data, truncate large fields)
 */
function sanitizePayload(payload: any, maxLength = 5000): any {
  if (!payload) return null;

  try {
    const cloned = JSON.parse(JSON.stringify(payload));

    // Remove/replace sensitive fields
    const sanitize = (obj: any, path = ''): any => {
      if (!obj || typeof obj !== 'object') return obj;

      if (Array.isArray(obj)) {
        return obj.map((item, i) => sanitize(item, `${path}[${i}]`));
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const fullPath = path ? `${path}.${key}` : key;

        // Skip or mask sensitive fields
        if (lowerKey.includes('key') || lowerKey.includes('secret') || lowerKey.includes('token') ||
            lowerKey.includes('password') || lowerKey.includes('authorization') || lowerKey.includes('apikey')) {
          sanitized[key] = '[REDACTED]';
        }
        // Handle inlineData (images)
        else if (key === 'inlineData' && value && typeof value === 'object') {
          const inline = value as { data?: string };
          sanitized[key] = {
            ...inline,
            data: inline.data ? `[BASE64_IMAGE_${inline.data.length}chars]` : inline.data
          };
        }
        // Handle image_url
        else if (key === 'image_url' && value && typeof value === 'object') {
          const imageUrl = value as { url?: string };
          if (imageUrl.url) {
            sanitized[key] = {
              url: imageUrl.url.startsWith('data:') ? `[BASE64_IMAGE]` : imageUrl.url
            };
          } else {
            sanitized[key] = sanitize(value, fullPath);
          }
        }
        // Truncate very long strings
        else if (typeof value === 'string' && value.length > maxLength) {
          sanitized[key] = value.substring(0, maxLength) + `... [TRUNCATED ${value.length} chars]`;
        }
        // Recurse into objects
        else if (value && typeof value === 'object') {
          sanitized[key] = sanitize(value, fullPath);
        }
        else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    return sanitize(cloned);
  } catch (err) {
    return { _error: 'Failed to sanitize payload', originalError: err?.message };
  }
}

/**
 * Log an AI request
 * Fire-and-forget - doesn't await the DB write
 */
export function logAIRequest(params: {
  requestId: string;
  taskType: 'chat' | 'coach' | 'vision' | 'verify' | 'food' | 'meal-plan' | 'embedding';
  userId?: string;
  providerId: string;
  providerName: string;
  modelId: string;
  apiKeyLabel: string;
  durationMs: number;
  queueTimeMs?: number;
  status: 'success' | 'error' | 'fallback' | 'rate_limited' | 'timeout' | 'cancelled';
  fallbackFrom?: string;
  fallbackAttempt?: number;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd?: number;
  };
  debugData?: {
    requestPayload?: any;
    responsePayload?: any;
    modelOptionsTried?: Array<{
      providerId: string;
      providerName: string;
      modelId: string;
      apiKeyLabel: string;
      error: string;
      errorCode: string;
      durationMs: number;
    }>;
  };
}): void {
  const logEntry: any = {
    requestId: params.requestId,
    taskType: params.taskType,
    userId: params.userId,
    timestamp: new Date(),
    providerId: params.providerId,
    providerName: params.providerName,
    modelId: params.modelId,
    apiKeyLabel: params.apiKeyLabel,
    durationMs: params.durationMs,
    queueTimeMs: params.queueTimeMs || 0,
    status: params.status,
    fallbackFrom: params.fallbackFrom,
    fallbackAttempt: params.fallbackAttempt || 0,
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    httpStatus: params.httpStatus,
    usage: params.usage || {},
    logLevel: debugMode ? 'debug' : (params.status === 'error' ? 'error' : params.status === 'fallback' ? 'warn' : 'info'),
  };

  // Add debug payload only when debug mode is enabled
  if (debugMode && params.debugData) {
    logEntry.debug = {
      requestPayload: sanitizePayload(params.debugData.requestPayload),
      responsePayload: sanitizePayload(params.debugData.responsePayload),
      modelOptionsTried: params.debugData.modelOptionsTried?.map(m => ({
        ...m,
        error: m.error ? sanitizePayload({ error: m.error }).error : undefined,
      })),
    };
    logEntry.logLevel = 'debug';
  }

  // Async write - don't block the request
  AILog.create(logEntry).catch(err => {
    console.error('[AI-Log] Failed to write log:', err.message);
  });

  // Always log to console for real-time monitoring
  const statusIcon = {
    success: '✅',
    error: '❌',
    fallback: '🔄',
    rate_limited: '⚠️',
    timeout: '⏱️',
    cancelled: '🚫',
  }[params.status] || '❓';

  const fallbackInfo = params.fallbackFrom ? ` (fallback from ${params.fallbackFrom}, attempt ${params.fallbackAttempt})` : '';
  const costInfo = params.usage?.costUsd ? ` | $${params.usage.costUsd.toFixed(6)}` : '';

  console.log(
    `[AI] ${params.taskType} | ${params.providerName}/${params.modelId} | ${statusIcon} ${params.status.toUpperCase()}${fallbackInfo} | ${params.durationMs}ms${costInfo} | req=${params.requestId}`
  );

  if (params.errorMessage) {
    console.error(`[AI] Error: ${params.errorMessage}`);
  }
}

/**
 * Get logs with filters (for admin UI)
 */
export async function getLogs(filters: {
  page?: number;
  limit?: number;
  taskType?: string;
  providerId?: string;
  status?: string;
  userId?: string;
  requestId?: string;
  startDate?: Date;
  endDate?: Date;
  logLevel?: string;
} = {}): Promise<{ logs: any[]; total: number; page: number; limit: number }> {
  return AILog.getLogs(filters);
}

/**
 * Get statistics for dashboard
 */
export async function getLogStats(hours = 24): Promise<any> {
  return AILog.getStats(hours);
}

/**
 * Get debug mode status
 */
export async function getDebugModeStatus(): Promise<{ debugMode: boolean }> {
  return { debugMode };
}

/**
 * Set debug mode (admin toggle)
 */
export async function setDebugModeStatus(enabled: boolean): Promise<{ success: boolean; debugMode: boolean }> {
  setDebugMode(enabled);
  return { success: true, debugMode: enabled };
}

/**
 * Clean old logs
 */
export async function cleanLogs(olderThanDays = 30): Promise<{ deletedCount: number }> {
  const count = await AILog.cleanOldLogs(olderThanDays);
  return { deletedCount: count };
}

/**
 * Get recent errors for alerting
 */
export async function getRecentErrors(limit = 10): Promise<any[]> {
  const since = new Date(Date.now() - 60 * 60 * 1000); // Last hour
  return AILog.find({
    timestamp: { $gte: since },
    status: { $in: ['error', 'rate_limited', 'timeout'] },
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
}

/**
 * Log a fallback attempt (for tracking fallback chains)
 */
export function logFallback(params: {
  requestId: string;
  taskType: string;
  fromProvider: string;
  fromModel: string;
  fromKeyLabel: string;
  toProvider: string;
  toModel: string;
  toKeyLabel: string;
  reason: string;
  attempt: number;
}): void {
  console.log(
    `[AI-FALLBACK] ${params.taskType} | ${params.fromProvider}/${params.fromModel} → ${params.toProvider}/${params.toModel} | Reason: ${params.reason} | Attempt: ${params.attempt} | req=${params.requestId}`
  );
}

/**
 * Log rate limit hit
 */
export function logRateLimit(params: {
  requestId: string;
  taskType: string;
  provider: string;
  model: string;
  keyLabel: string;
  retryAfterMs?: number;
}): void {
  console.warn(
    `[AI-RATELIMIT] ${params.taskType} | ${params.provider}/${params.model} (${params.keyLabel}) | Retry after: ${params.retryAfterMs || 'unknown'}ms | req=${params.requestId}`
  );
}

/**
 * Log key cooldown
 */
export function logKeyCooldown(params: {
  providerId: string;
  providerName: string;
  keyLabel: string;
  keyId: string;
  cooldownMs: number;
  reason: string;
}): void {
  console.warn(
    `[AI-COOLDOWN] ${params.providerName}/${params.keyLabel} | Cooldown: ${params.cooldownMs}ms | Reason: ${params.reason} | keyId=${params.keyId}`
  );
}