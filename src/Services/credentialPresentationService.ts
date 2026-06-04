import { getDID } from '../Storage/didStorage';
import { getVCById } from '../Storage/vcStorage';
import { MAX_PRESENTATION_QR_BYTES } from '../config/securityLimits';
import {
  PresentationMetadata,
  VerifiableCredentialV2,
  VerifiablePresentationV2,
} from '../types/vc';
import {
  filterCredentialSubjectAttributes,
  normalizeToVcV2,
  VC_V2_CONTEXT,
} from './credentialV2Service';
import { signVpJwtWithWallet } from './walletJwtSigner';

function nowIso(): string {
  return new Date().toISOString();
}

function createPresentationId(): string {
  return `urn:uuid:${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function byteLength(value: string): number {
  try {
    return new TextEncoder().encode(value).length;
  } catch {
    return value.length;
  }
}

export function buildVerifiablePresentationV2(
  credential: VerifiableCredentialV2,
  options?: {
    holderDid?: string;
    selectedAttributes?: string[];
  }
): VerifiablePresentationV2 {
  const holderDid =
    options?.holderDid ||
    credential.credentialSubject?.id ||
    credential.metadata?.holder ||
    '';

  if (!holderDid || typeof holderDid !== 'string' || !holderDid.startsWith('did:')) {
    throw new Error('Holder DID tidak valid.');
  }

  const filteredCredential = filterCredentialSubjectAttributes(
    normalizeToVcV2(credential),
    options?.selectedAttributes
  );

  const metadata: PresentationMetadata = {
    schemaVersion: 'vc-data-model-v2.0',
    presentationFormat: 'jwt_vp',
    selectedAttributes: options?.selectedAttributes || [],
    createdAt: nowIso(),
  };

  return {
    '@context': [VC_V2_CONTEXT],
    id: createPresentationId(),
    type: ['VerifiablePresentation'],
    holder: holderDid,
    verifiableCredential: [filteredCredential],
    metadata,
  };
}

export function buildPresentationJwtPayload(
  vp: VerifiablePresentationV2,
  holderDid: string
) {
  const now = Math.floor(Date.now() / 1000);
  const jti = vp.id || createPresentationId();

  return {
    iss: holderDid,
    sub: jti,
    iat: now,
    nbf: now,
    jti,
    vp: {
      '@context': [VC_V2_CONTEXT],
      type: ['VerifiablePresentation'],
      holder: holderDid,
      verifiableCredential: vp.verifiableCredential,
    },
  };
}

export async function signPresentationAsJwt(
  vp: VerifiablePresentationV2,
  holderDid: string
): Promise<string> {
  return signVpJwtWithWallet({
    holderDid,
    vp: {
      '@context': [VC_V2_CONTEXT],
      type: ['VerifiablePresentation'],
      holder: holderDid,
      verifiableCredential: vp.verifiableCredential,
    },
  });
}

export async function createPresentationJwtFromCredential(
  credentialId: string,
  selectedAttributes?: string[]
): Promise<string> {
  const didData = await getDID();

  if (!didData?.did) {
    throw new Error('Wallet signer belum tersedia.');
  }

  const credential = await getVCById(credentialId);

  if (!credential) {
    throw new Error('Credential tidak ditemukan.');
  }

  const vcV2 = normalizeToVcV2(credential);
  const vp = buildVerifiablePresentationV2(vcV2, {
    holderDid: didData.did,
    selectedAttributes,
  });

  const jwt = await signPresentationAsJwt(vp, didData.did);

  return createQrPayloadFromPresentationJwt(jwt);
}

export function createQrPayloadFromPresentationJwt(jwt: string): string {
  if (!jwt || jwt.split('.').length !== 3) {
    throw new Error('JWT presentation tidak valid.');
  }

  if (byteLength(jwt) > MAX_PRESENTATION_QR_BYTES) {
    throw new Error('Payload QR terlalu besar. Kurangi atribut yang dipresentasikan.');
  }

  return jwt;
}