// File: src/types/presentation.ts

export type EnvelopedVerifiableCredential = {
  '@context': string[];
  type: ['EnvelopedVerifiableCredential'];
  id: string;
};

export type VerifiablePresentationV2 = {
  '@context': string[];
  type: ['VerifiablePresentation'];
  holder: string;
  verifiableCredential: EnvelopedVerifiableCredential[];
};

export type SignedPresentationResult = {
  vp: VerifiablePresentationV2;
  vpJwt: string;
  qrPayload: string;
  holderDid: string;
  credentialCount: number;
  createdAt: string;
  algorithm: string;
};

export type PresentationQrPayload = {
  jwt: string;
  byteLength: number;
  warning?: string;
};