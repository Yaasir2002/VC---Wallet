import { safeLogger } from './safeLogger';

export function safeParseJSON<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    safeLogger.warn('Failed to parse JSON safely');
    return fallback;
  }
}

export function safeParseObject(value: string | null): Record<string, unknown> | null {
  const parsed = safeParseJSON<unknown>(value, null);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  return parsed as Record<string, unknown>;
}