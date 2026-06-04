// File: src/utils/base64url.ts

import { Buffer } from 'buffer';

export function assertBase64Url(value: string, label: string): void {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`${label} bukan base64url yang valid.`);
  }
}

export function base64UrlToBuffer(value: string): Uint8Array {
  assertBase64Url(value, 'Data');

  const padded = value.padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    '='
  );

  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

export function base64UrlToUtf8(value: string): string {
  return Buffer.from(base64UrlToBuffer(value)).toString('utf8');
}

export function base64UrlToJson<T>(value: string): T {
  const text = base64UrlToUtf8(value);
  return JSON.parse(text) as T;
}

export function utf8ToBytes(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'utf8'));
}