// File: src/Services/qrPresentationService.ts

import {
  MAX_PRESENTATION_QR_BYTES,
  PRESENTATION_QR_WARNING_BYTES,
} from '../config/securityLimits';
import { PresentationQrPayload } from '../types/presentation';
import { isJwtString } from './walletSigner';

function byteLength(value: string): number {
  try {
    return new TextEncoder().encode(value).length;
  } catch {
    return value.length;
  }
}

export function preparePresentationJwtForQr(jwt: string): PresentationQrPayload {
  const normalized = jwt.trim();

  if (!isJwtString(normalized)) {
    throw new Error('Signed VP JWT tidak valid.');
  }

  const size = byteLength(normalized);

  if (size > MAX_PRESENTATION_QR_BYTES) {
    throw new Error('JWT presentation terlalu panjang. QR mungkin sulit dipindai.');
  }

  return {
    jwt: normalized,
    byteLength: size,
    warning:
      size > PRESENTATION_QR_WARNING_BYTES
        ? 'JWT presentation terlalu panjang. QR mungkin sulit dipindai.'
        : undefined,
  };
}