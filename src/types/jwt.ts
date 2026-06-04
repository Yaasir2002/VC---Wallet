// File: src/types/jwt.ts

export type JwtHeader = {
  alg: string;
  kid: string;
  iss?: string;
  typ?: string;
  [key: string]: unknown;
};

export type JwtCompactParts = {
  rawJwt: string;
  encodedHeader: string;
  encodedPayload: string;
  encodedSignature: string;
  signingInput: string;
};

export type DecodedJwt<TPayload = Record<string, unknown>> = {
  rawJwt: string;
  header: JwtHeader;
  payload: TPayload;
  parts: JwtCompactParts;
};