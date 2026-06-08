import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';

import { ModularCredential, SignedPresentationJWT } from '../../src/types/vc';
import { getAllVCs } from '../../src/Storage/vcStorage';
import { getDID } from '../../src/Storage/didStorage';
import { createSignedPresentationJWT } from '../../src/Services/presentationService';
import { checkCredentialExpiration } from '../../src/Services/credentialValidityService';
import { validatePresentationPayloadSize } from '../../src/Services/qrPayloadService';
import { isJwtString } from '../../src/Services/walletJwtSigner';

import AnimatedButton from '../../components/ui/AnimatedButton';
import AppToast from '../../components/ui/AppToast';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

type ToastState = {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
};

const INVALID_PRESENTATION_STATUSES = [
  'invalid',
  'invalid_signature',
  'malformed_credential',
  'expired',
  'not_yet_valid',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toDisplayText(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined || value === '') return fallback;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function issuerToText(issuer: unknown): string {
  if (!issuer) return '-';

  if (typeof issuer === 'string') {
    return issuer.trim() || '-';
  }

  if (isRecord(issuer)) {
    if (typeof issuer.name === 'string' && issuer.name.trim()) {
      return issuer.name.trim();
    }

    if (typeof issuer.id === 'string' && issuer.id.trim()) {
      return issuer.id.trim();
    }
  }

  return '-';
}

function subjectText(
  credentialSubject: Record<string, unknown> | undefined,
  key: string,
  fallback = '-'
): string {
  return toDisplayText(credentialSubject?.[key], fallback);
}

function shorten(value?: string) {
  if (!value) return '-';
  if (value.length <= 24) return value;

  return `${value.slice(0, 14)}...${value.slice(-8)}`;
}

function getCredentialDisplayTitle(credential: ModularCredential): string {
  if (credential.documentName) return credential.documentName;
  if (credential.documentType) return `${credential.documentType} Credential`;

  const specificType = credential.type.find(
    (item) => item !== 'VerifiableCredential'
  );

  return specificType || 'Verifiable Credential';
}

function getCredentialJwt(credential: ModularCredential): string {
  const proof = isRecord(credential.proof) ? credential.proof : null;

  if (isJwtString(credential.jwt)) {
    return credential.jwt.trim();
  }

  if (isJwtString(proof?.jwt)) {
    return String(proof.jwt).trim();
  }

  if (isJwtString(proof?.jws)) {
    return String(proof.jws).trim();
  }

  return '';
}

export default function PresentCredentialScreen() {
  const router = useRouter();

  const [credentials, setCredentials] = useState<ModularCredential[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [presentationJwt, setPresentationJwt] = useState('');
  const [presentationMeta, setPresentationMeta] =
    useState<SignedPresentationJWT | null>(null);
  const [qrWarning, setQrWarning] = useState('');
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
  });

  const qrJwt = presentationJwt.trim();
  const isPresentationJwtValid = Boolean(qrJwt) && isJwtString(qrJwt);

  const selectedCredentials = useMemo(
    () => credentials.filter((item) => selectedIds.includes(item.id)),
    [credentials, selectedIds]
  );

  const presentableCredentials = useMemo(
    () => credentials.filter(isCredentialPresentable),
    [credentials]
  );

  const loadCredentials = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getAllVCs();
      setCredentials(data);
      setSelectedIds([]);
      setPresentationJwt('');
      setPresentationMeta(null);
      setQrWarning('');
    } catch {
      Alert.alert('Error', 'Gagal mengambil credential dari wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  function showToast(message: string, type: ToastState['type']) {
    setToast({
      visible: true,
      message,
      type,
    });
  }

  function resetPresentation() {
    setPresentationJwt('');
    setPresentationMeta(null);
    setQrWarning('');
  }

  function hasCredentialJwt(vc: ModularCredential): boolean {
    return Boolean(getCredentialJwt(vc));
  }

  function isCredentialPresentable(vc: ModularCredential): boolean {
    const expiration = checkCredentialExpiration(vc);

    if (expiration.isExpired || expiration.isNotYetValid) {
      return false;
    }

    if (!hasCredentialJwt(vc)) {
      return false;
    }

    return !INVALID_PRESENTATION_STATUSES.includes(vc.verificationStatus ?? '');
  }

  function getCredentialStatusLabel(vc: ModularCredential): string {
    const expiration = checkCredentialExpiration(vc);

    if (!hasCredentialJwt(vc)) return 'Tidak punya VC JWT';
    if (expiration.isExpired) return 'Expired';
    if (expiration.isNotYetValid) return 'Belum Berlaku';
    if (vc.verificationStatus === 'verified') return 'Verified JWT';
    if (vc.verificationStatus === 'signature_verified') return 'Signature Verified';

    return vc.verificationStatus || 'Pending Verification';
  }

  function getCredentialBlockedReason(vc: ModularCredential): string {
    const expiration = checkCredentialExpiration(vc);

    if (!hasCredentialJwt(vc)) {
      return 'Credential ini tidak punya VC JWT. Buat ulang credential sebagai VC JWT valid.';
    }

    if (expiration.isExpired) {
      return 'Credential ini sudah expired.';
    }

    if (expiration.isNotYetValid) {
      return 'Credential ini belum berlaku.';
    }

    if (INVALID_PRESENTATION_STATUSES.includes(vc.verificationStatus ?? '')) {
      return 'Credential ini berstatus invalid dan tidak dapat dipresentasikan.';
    }

    return 'Credential ini tidak dapat dipresentasikan.';
  }

  function toggleCredential(idValue: string) {
    resetPresentation();

    setSelectedIds((prev) => {
      if (prev.includes(idValue)) {
        return prev.filter((item) => item !== idValue);
      }

      return [...prev, idValue];
    });
  }

  function selectAll() {
    resetPresentation();

    const presentableIds = credentials
      .filter(isCredentialPresentable)
      .map((item) => item.id);

    setSelectedIds(presentableIds);

    if (presentableIds.length === 0) {
      showToast(
        'Tidak ada credential yang bisa dipresentasikan. Pastikan credential punya VC JWT valid.',
        'error'
      );
    }
  }

  function clearSelection() {
    resetPresentation();
    setSelectedIds([]);
  }

  async function handleConfirmAndSignPresentation() {
    try {
      if (selectedIds.length === 0) {
        showToast('Pilih minimal 1 credential untuk dipresentasikan.', 'error');
        return;
      }

      setLoading(true);
      resetPresentation();

      const didData = await getDID();

      if (!didData?.did) {
        showToast('DID belum tersedia.', 'error');
        return;
      }

      if (!didData.did.startsWith('did:key:')) {
        showToast('DID wallet harus menggunakan did:key.', 'error');
        return;
      }

      if (selectedCredentials.length === 0) {
        showToast('Credential terpilih tidak ditemukan.', 'error');
        return;
      }

      const invalidCredential = selectedCredentials.find(
        (item) => !isCredentialPresentable(item)
      );

      if (invalidCredential) {
        showToast(
          `Ada credential yang tidak dapat dipresentasikan. ${getCredentialBlockedReason(
            invalidCredential
          )}`,
          'error'
        );
        return;
      }

      const vp = await createSignedPresentationJWT({
        holderDid: didData.did,
        credentials: selectedCredentials,
      });

      const vpJwt = vp.jwt.trim();

      if (!vpJwt) {
        throw new Error('VP JWT kosong.');
      }

      if (!isJwtString(vpJwt) || vpJwt.split('.').length !== 3) {
        throw new Error('VP JWT hasil signing tidak valid.');
      }

      validatePresentationPayloadSize(vpJwt);

      if (vpJwt.length > 2500) {
        setQrWarning(
          'VP JWT cukup panjang. Jika QR sulit discan, kurangi jumlah credential yang dipilih.'
        );
      }

      setPresentationJwt(vpJwt);
      setPresentationMeta(vp);

      showToast(
        `${vp.credentialCount} credential berhasil ditandatangani sebagai VP JWT.`,
        'success'
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal membuat signed VP JWT.';

      setQrWarning(message);
      setPresentationJwt('');
      setPresentationMeta(null);

      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyJWT() {
    if (!isPresentationJwtValid) {
      showToast('VP JWT tidak valid sehingga tidak bisa disalin.', 'error');
      return;
    }

    await Clipboard.setStringAsync(qrJwt);

    showToast('VP JWT berhasil disalin.', 'success');
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={20} color="#111827" />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>

        <View style={styles.headerCard}>
          <View style={styles.headerIcon}>
            <Ionicons name="qr-code-outline" size={38} color="#2563EB" />
          </View>

          <Text style={styles.title}>Present Credential</Text>

          <Text style={styles.subtitle}>
            Pilih credential yang ingin dipresentasikan, lalu tanda tangani
            sebagai Verifiable Presentation JWT.
          </Text>
        </View>

        <View style={styles.actionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Credential Tersedia</Text>
              <Text style={styles.sectionSubtitle}>
                {presentableCredentials.length} dari {credentials.length} credential dapat dipresentasikan
              </Text>
            </View>

            <View style={styles.selectionButtons}>
              <Pressable style={styles.smallButton} onPress={selectAll}>
                <Text style={styles.smallButtonText}>Pilih Semua</Text>
              </Pressable>

              <Pressable style={styles.smallButtonMuted} onPress={clearSelection}>
                <Text style={styles.smallButtonMutedText}>Bersihkan</Text>
              </Pressable>
            </View>
          </View>

          {credentials.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="file-tray-outline" size={36} color="#94A3B8" />
              <Text style={styles.emptyTitle}>Belum Ada Credential</Text>
              <Text style={styles.emptyText}>
                Wallet belum memiliki credential untuk dipresentasikan.
              </Text>
            </View>
          ) : (
            credentials.map((vc) => {
              const isSelected = selectedIds.includes(vc.id);
              const isPresentable = isCredentialPresentable(vc);

              return (
                <Pressable
                  key={vc.id}
                  style={[
                    styles.credentialCard,
                    isSelected && styles.credentialCardSelected,
                    !isPresentable && styles.credentialCardDisabled,
                  ]}
                  onPress={() => {
                    if (!isPresentable) {
                      showToast(getCredentialBlockedReason(vc), 'error');
                      return;
                    }

                    toggleCredential(vc.id);
                  }}
                >
                  <View style={styles.credentialHeader}>
                    <View style={styles.credentialIcon}>
                      <Ionicons
                        name={isSelected ? 'checkbox-outline' : 'square-outline'}
                        size={24}
                        color={isSelected ? '#2563EB' : '#94A3B8'}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.credentialTitle} numberOfLines={1}>
                        {getCredentialDisplayTitle(vc)}
                      </Text>

                      <Text style={styles.credentialValue} numberOfLines={2}>
                        {subjectText(vc.credentialSubject, 'attributeValue')}
                      </Text>

                      <Text style={styles.credentialMeta} numberOfLines={2}>
                        Type: {subjectText(vc.credentialSubject, 'attributeType')} • Issuer:{' '}
                        {shorten(issuerToText(vc.issuer))}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        isPresentable ? styles.statusBadgeValid : styles.statusBadgeInvalid,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isPresentable ? styles.statusTextValid : styles.statusTextInvalid,
                        ]}
                      >
                        {getCredentialStatusLabel(vc)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}

          <AnimatedButton
            style={styles.signButton}
            onPress={handleConfirmAndSignPresentation}
            disabled={loading || selectedIds.length === 0}
          >
            <Ionicons name="create-outline" size={22} color="#FFFFFF" />
            <Text style={styles.signButtonText}>
              Sign Presentation ({selectedIds.length})
            </Text>
          </AnimatedButton>
        </View>

        {qrWarning ? (
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={22} color="#F97316" />
            <Text style={styles.warningText}>{qrWarning}</Text>
          </View>
        ) : null}

        {presentationJwt ? (
          <View style={styles.qrCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Signed VP JWT QR</Text>
                <Text style={styles.sectionSubtitle}>
                  QR ini berisi Verifiable Presentation JWT yang ditandatangani holder.
                </Text>
              </View>
            </View>

            <View style={styles.qrBox}>
              <QRCode value={qrJwt} size={230} />
            </View>

            <View style={styles.jwtBox}>
              <Text style={styles.jwtText} selectable>
                {qrJwt.length > 110
                  ? `${qrJwt.slice(0, 52)}...${qrJwt.slice(-36)}`
                  : qrJwt}
              </Text>
            </View>

            <View style={styles.metaBox}>
              <Text style={styles.metaText}>
                Holder DID: {presentationMeta?.holderDid || '-'}
              </Text>
              <Text style={styles.metaText}>
                Credential Count: {presentationMeta?.credentialCount || selectedCredentials.length}
              </Text>
              <Text style={styles.metaText}>
                Algorithm: {presentationMeta?.algorithm || '-'}
              </Text>
            </View>

            <Pressable style={styles.copyButton} onPress={handleCopyJWT}>
              <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
              <Text style={styles.copyButtonText}>Copy VP JWT</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <LoadingOverlay visible={loading} message="Memproses..." />

      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 42,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  backText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    alignItems: 'center',
  },
  headerIcon: {
    width: 78,
    height: 78,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    lineHeight: 18,
  },
  selectionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '900',
  },
  smallButtonMuted: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallButtonMutedText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
  },
  emptyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 10,
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  credentialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  credentialCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  credentialCardDisabled: {
    opacity: 0.6,
  },
  credentialHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  credentialIcon: {
    width: 32,
    alignItems: 'center',
    paddingTop: 2,
  },
  credentialTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  credentialValue: {
    marginTop: 5,
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  credentialMeta: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  statusBadge: {
    maxWidth: 96,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusBadgeValid: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeInvalid: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
  statusTextValid: {
    color: '#166534',
  },
  statusTextInvalid: {
    color: '#991B1B',
  },
  signButton: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 15,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  signButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  warningCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  warningText: {
    flex: 1,
    color: '#C2410C',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  qrBox: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  jwtBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  jwtText: {
    color: '#0F172A',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  metaBox: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  metaText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  copyButton: {
    marginTop: 14,
    backgroundColor: '#2563EB',
    borderRadius: 15,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});