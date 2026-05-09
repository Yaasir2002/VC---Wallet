/**
 * jwtUtils.ts
 *
 * Shared JWT utility functions used by credentialService and presentationService.
 * Centralised here to avoid code duplication across service files.
 */

/**
 * A pure-JS base64url encoder that works in React Native without
 * depending on Node.js Buffer or browser btoa().
 */
export function base64UrlEncode(value: any): string {
  const json = typeof value === 'string' ? value : JSON.stringify(value);

  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  let output = '';
  let i = 0;

  while (i < json.length) {
    const chr1 = json.charCodeAt(i++);
    const chr2 = json.charCodeAt(i++);
    const chr3 = json.charCodeAt(i++);

    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    let enc4 = chr3 & 63;

    if (isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(chr3)) {
      enc4 = 64;
    }

    output +=
      chars.charAt(enc1) +
      chars.charAt(enc2) +
      chars.charAt(enc3) +
      chars.charAt(enc4);
  }

  return output.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Creates an unsigned JWT for local development / offline fallback.
 * The third segment is a fixed placeholder string — NOT a real cryptographic signature.
 *
 * ⚠️ This is intentionally insecure and must never be used in production signing flows.
 */
export function createLocalDevelopmentJWT(payload: any): string {
  const header = {
    alg: 'none',
    typ: 'JWT',
  };

  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.development-signature`;
}
