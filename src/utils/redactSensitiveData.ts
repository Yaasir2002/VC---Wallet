const SENSITIVE_KEYS = [
  'jwt',
  'rawJwt',
  'vcJwt',
  'token',
  'accessToken',
  'refreshToken',
  'privateKey',
  'privateJwk',
  'secret',
  'password',
  'pin',
  'proof',
  'credentialSubject',
  'rawCredential',
  'parsedCredential',
  'nik',
  'alamat',
  'address',
];

function shouldRedactKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return SENSITIVE_KEYS.some((sensitiveKey) =>
    normalizedKey.includes(sensitiveKey.toLowerCase())
  );
}

function redactString(value: string): string {
  if (value.length <= 12) {
    return '[REDACTED]';
  }

  return `${value.slice(0, 6)}...[REDACTED]...${value.slice(-4)}`;
}

export function redactSensitiveData<T>(value: T): T | string {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    if (value.split('.').length === 3 || value.length > 80) {
      return redactString(value);
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item)) as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (shouldRedactKey(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitiveData(item);
      }
    }

    return result as T;
  }

  return value;
}