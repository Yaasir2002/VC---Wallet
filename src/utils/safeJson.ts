// File: src/utils/safeJson.ts

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function safeParseJson<T>(
  value: string,
  fallback: T | null = null
): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifySafeValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '-';
  }
}