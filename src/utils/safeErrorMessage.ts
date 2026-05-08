export function getSafeErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();

  if (!message) {
    return fallback;
  }

  const unsafePatterns = [
    /stack/i,
    /token/i,
    /private/i,
    /secret/i,
    /key/i,
    /jwt/i,
    /file:\/\//i,
    /documentDirectory/i,
    /SecureStore/i,
    /AsyncStorage/i,
  ];

  if (unsafePatterns.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  return message.slice(0, 160);
}