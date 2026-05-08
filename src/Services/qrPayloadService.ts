import { SECURITY_LIMITS } from '../config/securityLimits';

function getByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function validateQrPayloadSize(data: string) {
  if (getByteLength(data) > SECURITY_LIMITS.MAX_QR_PAYLOAD_BYTES) {
    throw new Error('QR terlalu besar untuk diproses.');
  }
}

export function validatePresentationPayloadSize(payload: string) {
  if (getByteLength(payload) > SECURITY_LIMITS.MAX_PRESENTATION_QR_BYTES) {
    throw new Error('Payload QR terlalu besar. Kurangi atribut yang dipilih.');
  }
}

export async function validateResponseSize(response: Response) {
  const contentLength = response.headers.get('content-length');

  if (
    contentLength &&
    Number(contentLength) > SECURITY_LIMITS.MAX_CREDENTIAL_RESPONSE_BYTES
  ) {
    throw new Error('Credential dari URL terlalu besar.');
  }
}

export async function readResponseTextWithLimit(response: Response): Promise<string> {
  await validateResponseSize(response);

  const text = await response.text();

  if (getByteLength(text) > SECURITY_LIMITS.MAX_CREDENTIAL_RESPONSE_BYTES) {
    throw new Error('Credential dari URL terlalu besar.');
  }

  return text;
}

export function assertJsonContentType(response: Response) {
  const contentType = response.headers.get('content-type');

  if (contentType && !contentType.toLowerCase().includes('application/json')) {
    throw new Error('Response credential bukan JSON.');
  }
}

export function assertHttpsUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== 'https:') {
    throw new Error('URL credential tidak aman. Gunakan HTTPS.');
  }
}