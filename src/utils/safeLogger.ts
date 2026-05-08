type SafeLogMeta = Record<string, string | number | boolean | null | undefined>;

const SENSITIVE_KEYS = [
  'vc',
  'credential',
  'credentialSubject',
  'jwt',
  'privateKey',
  'pin',
  'password',
  'mnemonic',
  'seed',
  'token',
  'rawCredential',
  'qrPayload',
  'proof',
];

function sanitizeMeta(meta?: SafeLogMeta): SafeLogMeta | undefined {
  if (!meta) return undefined;

  return Object.fromEntries(
    Object.entries(meta).filter(([key]) => {
      const normalized = key.toLowerCase();
      return !SENSITIVE_KEYS.some((sensitive) =>
        normalized.includes(sensitive.toLowerCase())
      );
    })
  );
}

export const safeLogger = {
  info(message: string, meta?: SafeLogMeta) {
    if (__DEV__) {
      console.info(message, sanitizeMeta(meta));
    }
  },

  warn(message: string, meta?: SafeLogMeta) {
    if (__DEV__) {
      console.warn(message, sanitizeMeta(meta));
    }
  },

  error(message: string, meta?: SafeLogMeta) {
    if (__DEV__) {
      console.error(message, sanitizeMeta(meta));
    }
  },
};