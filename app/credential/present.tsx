import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { getAllVCs } from '../../src/Storage/vcStorage';
import { getDID } from '../../src/Storage/didStorage';
import { ModularCredential } from '../../src/types/vc';
import { createSignedPresentationJWT } from '../../src/Services/presentationService';
import { checkCredentialExpiration } from '../../src/Services/credentialValidityService';
import { validatePresentationPayloadSize } from '../../src/Services/qrPayloadService';
import { safeLogger } from '../../src/utils/safeLogger';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

export default function PresentCredentialScreen() {
  const router = useRouter();

  const { documentId, requester } = useLocalSearchParams<{
    documentId?: string;
    requester?: string;
  }>();

  const [credentials, setCredentials] = useState<ModularCredential[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [presentationJwt, setPresentationJwt] = useState('');
  const [loading, setLoading] = useState(false);

  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState('');

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  const requesterName = requester || 'Verifier';

  const loadCredentials = useCallback(async () => {
    try {
      setLoading(true);

      const allVCs = await getAllVCs();

      const filteredVCs = documentId
        ? allVCs.filter((vc) => vc.documentId === documentId)
        : allVCs;

      setCredentials(filteredVCs);
      setSelectedIds([]);
      setPresentationJwt('');

      if (filteredVCs.length > 0) {
        setDocumentName(filteredVCs[0].documentName || 'Credential Document');
        setDocumentType(filteredVCs[0].documentType || 'CUSTOM');
      } else {
        setDocumentName('');
        setDocumentType('');
      }
    } catch {
      safeLogger.error('Failed to load credentials for presentation');

      setToast({
        visible: true,
        message: 'Gagal mengambil credential',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  function toggleCredential(id: string) {
    setPresentationJwt('');

    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }

      return [...prev, id];
    });
  }

  function selectAll() {
    setPresentationJwt('');
    setSelectedIds(
      credentials.filter(isCredentialPresentable).map((vc) => vc.id)
    );
  }

  function clearSelection() {
    setPresentationJwt('');
    setSelectedIds([]);
  }

  function getCredentialStatusLabel(vc: ModularCredential): string {
    const expiration = checkCredentialExpiration(vc);

    if (expiration.isExpired) {
      return 'Expired';
    }

    if (expiration.isNotYetValid) {
      return 'Belum Berlaku';
    }

    if (vc.verificationStatus === 'verified') {
      return 'Verified';
    }

    if (vc.verificationStatus === 'untrusted_issuer') {
      return 'Untrusted Issuer';
    }

    if (vc.verificationStatus === 'invalid') {
      return 'Invalid';
    }

    if (vc.verificationStatus === 'invalid_signature') {
      return 'Invalid Signature';
    }

    if (vc.verificationStatus === 'unsupported_proof_type') {
      return 'Unsupported Proof';
    }

    return 'Pending Verification';
  }

  function isCredentialPresentable(vc: ModularCredential): boolean {
    const expiration = checkCredentialExpiration(vc);

    if (expiration.isExpired || expiration.isNotYetValid) {
      return false;
    }

    return ![
      'invalid',
      'invalid_signature',
      'malformed_credential',
      'expired',
      'not_yet_valid',
    ].includes(vc.verificationStatus ?? '');
  }

  async function handleConfirmAndSign() {
    try {
      if (selectedIds.length === 0) {
        setToast({
          visible: true,
          message: 'Pilih minimal 1 atribut untuk dibagikan',
          type: 'error',
        });
        return;
      }

      setLoading(true);

      const didData = await getDID();

      if (!didData?.did) {
        setToast({
          visible: true,
          message: 'DID belum tersedia',
          type: 'error',
        });
        return;
      }

      const selectedCredentials = credentials.filter((vc) =>
        selectedIds.includes(vc.id)
      );

      const blockedCredential = selectedCredentials.find(
        (vc) => !isCredentialPresentable(vc)
      );

      if (blockedCredential) {
        setToast({
          visible: true,
          message:
            'Credential expired, belum berlaku, atau invalid tidak boleh dipresentasikan',
          type: 'error',
        });
        return;
      }

      const vp = await createSignedPresentationJWT({
        holderDid: didData.did,
        credentials: selectedCredentials,
      });

      validatePresentationPayloadSize(vp.jwt);
      setPresentationJwt(vp.jwt);

      setToast({
        visible: true,
        message: `${selectedCredentials.length} atribut berhasil ditandatangani`,
        type: 'success',
      });
    } catch (error) {
      safeLogger.error('Failed to create VP JWT');

      setToast({
        visible: true,
        message:
          error instanceof Error
            ? error.message
            : 'Gagal membuat presentation JWT',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyJWT() {
    if (!presentationJwt) return;

    await Clipboard.setStringAsync(presentationJwt);

    setToast({
      visible: true,
      message: 'VP JWT berhasil disalin',
      type: 'success',
    });
  }

  const selectedCredentials = credentials.filter((vc) =>
    selectedIds.includes(vc.id)
  );

  const title = documentName || 'Prepare Presentation';

  const subtitle = documentId
    ? `Pilih atribut dari ${documentName || 'dokumen ini'} yang ingin dibagikan.`
    : 'Pilih credential mana saja yang ingin dibagikan kepada verifier.';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={20} color="#111827" />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>

        <LinearGradient
          colors={['#2563EB', '#1D4ED8', '#F97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View>
            <Text style={styles.heroLabel}>
              {documentType
                ? `${documentType} Selective Disclosure`
                : 'Selective Disclosure'}
            </Text>

            <Text style={styles.heroTitle}>{title}</Text>

            <Text style={styles.heroSubtitle}>{subtitle}</Text>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={36}
              color="#2563EB"
            />
          </View>
        </LinearGradient>

        <View style={styles.requesterCard}>
          <View style={styles.requesterIcon}>
            <Ionicons name="business-outline" size={24} color="#2563EB" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.requesterLabel}>Data diminta oleh</Text>
            <Text style={styles.requesterName}>{requesterName}</Text>
            <Text style={styles.requesterDesc}>
              Pastikan kamu hanya membagikan atribut yang relevan. Atribut yang
              tidak dipilih tidak akan masuk ke dalam QR presentation.
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Atribut yang Dibagikan</Text>
              <Text style={styles.smallText}>
                Dipilih: {selectedIds.length} dari {credentials.length}
              </Text>
            </View>

            <View style={styles.inlineActions}>
              <Pressable style={styles.smallButton} onPress={selectAll}>
                <Text style={styles.smallButtonText}>Semua</Text>
              </Pressable>

              <Pressable style={styles.smallButtonLight} onPress={clearSelection}>
                <Text style={styles.smallButtonLightText}>Reset</Text>
              </Pressable>
            </View>
          </View>

          {credentials.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="file-tray-outline" size={38} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Belum Ada Atribut</Text>
              <Text style={styles.emptyText}>
                Dokumen ini belum memiliki credential atau data tidak ditemukan.
              </Text>
            </View>
          ) : (
            credentials.map((vc) => {
              const selected = selectedIds.includes(vc.id);
              const presentable = isCredentialPresentable(vc);
              const statusLabel = getCredentialStatusLabel(vc);

              return (
                <Pressable
                  key={vc.id}
                  style={[
                    styles.credentialOption,
                    selected && styles.credentialOptionActive,
                    !presentable && styles.credentialOptionDisabled,
                  ]}
                  onPress={() => {
                    if (!presentable) {
                      setToast({
                        visible: true,
                        message:
                          'Credential ini tidak dapat dipresentasikan karena expired, belum berlaku, atau invalid',
                        type: 'error',
                      });
                      return;
                    }

                    toggleCredential(vc.id);
                  }}
                >
                  <View
                    style={[
                      styles.checkCircle,
                      selected && styles.checkCircleActive,
                    ]}
                  >
                    {selected && (
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.optionTitle,
                        selected && styles.optionTitleActive,
                      ]}
                    >
                      {vc.credentialSubject.attributeName}
                    </Text>

                    <Text
                      style={[
                        styles.optionValue,
                        selected && styles.optionValueActive,
                      ]}
                    >
                      {vc.credentialSubject.attributeValue || '-'}
                    </Text>

                    <Text
                      style={[
                        styles.optionMeta,
                        selected && styles.optionMetaActive,
                      ]}
                    >
                      Type: {vc.credentialSubject.attributeType} • Issuer:{' '}
                      {shorten(vc.issuer)}
                    </Text>

                    <Text
                      style={[
                        styles.statusText,
                        selected && styles.statusTextActive,
                        !presentable && styles.statusTextBlocked,
                      ]}
                    >
                      Status: {statusLabel}
                    </Text>
                  </View>

                  <Ionicons
                    name={selected ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color={selected ? '#FFFFFF' : '#6B7280'}
                  />
                </Pressable>
              );
            })
          )}

          <AnimatedButton
            style={[
              styles.createVPButton,
              selectedIds.length === 0 && styles.disabledButton,
            ]}
            disabled={selectedIds.length === 0}
            onPress={handleConfirmAndSign}
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.createVPButtonText}>
              Confirm & Sign Presentation
            </Text>
          </AnimatedButton>
        </View>

        {selectedCredentials.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Preview Data yang Dibagikan</Text>

            {selectedCredentials.map((vc) => (
              <View key={vc.id} style={styles.previewRow}>
                <Text style={styles.previewLabel}>
                  {vc.credentialSubject.attributeName}
                </Text>
                <Text style={styles.previewValue}>
                  {vc.credentialSubject.attributeValue || '-'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {presentationJwt ? (
          <>
            <View style={styles.qrCard}>
              <Text style={styles.sectionTitle}>Signed QR Presentation</Text>

              <View style={styles.qrBox}>
                <QRCode value={presentationJwt} size={220} />
              </View>

              <Text style={styles.qrNote}>
                QR ini hanya berisi atribut yang kamu setujui untuk dibagikan
                kepada {requesterName}.
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.jwtHeader}>
                <Text style={styles.sectionTitle}>VP JWT</Text>

                <AnimatedButton style={styles.copyButton} onPress={handleCopyJWT}>
                  <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.copyButtonText}>Copy</Text>
                </AnimatedButton>
              </View>

              <Text style={styles.jwtText}>{presentationJwt}</Text>
            </View>

            <View style={styles.noteCard}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#F97316"
              />
              <Text style={styles.noteText}>
                Verifier hanya dapat melihat atribut yang dipilih user. Atribut
                lain tetap tersimpan di wallet dan tidak masuk ke QR.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.noteCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color="#F97316"
            />
            <Text style={styles.noteText}>
              Setelah memilih atribut, tekan Confirm & Sign untuk membuat paket
              bukti presentasi dalam bentuk VP JWT.
            </Text>
          </View>
        )}
      </ScrollView>

      <LoadingOverlay visible={loading} message="Membuat VP JWT..." />

      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}

function shorten(value?: string) {
  if (!value) return '-';
  if (value.length <= 18) return value;

  return `${value.slice(0, 12)}...${value.slice(-6)}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  hero: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 13,
    color: '#FFEDD5',
    fontWeight: '900',
    maxWidth: 230,
  },
  heroTitle: {
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 2,
    maxWidth: 230,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#DBEAFE',
    marginTop: 8,
    lineHeight: 21,
    maxWidth: 235,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requesterCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  requesterIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requesterLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '900',
  },
  requesterName: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '900',
    marginTop: 3,
  },
  requesterDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    marginTop: 5,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
  },
  smallText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 4,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  smallButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  smallButtonLight: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  smallButtonLightText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 12,
  },
  credentialOption: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  credentialOptionActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  credentialOptionDisabled: {
    opacity: 0.55,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  optionTitle: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '900',
  },
  optionTitleActive: {
    color: '#FFFFFF',
  },
  optionValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '700',
    marginTop: 3,
  },
  optionValueActive: {
    color: '#DBEAFE',
  },
  optionMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 5,
    fontWeight: '700',
  },
  optionMetaActive: {
    color: '#BFDBFE',
  },
  statusText: {
    fontSize: 11,
    color: '#C2410C',
    marginTop: 5,
    fontWeight: '900',
  },
  statusTextActive: {
    color: '#FFEDD5',
  },
  statusTextBlocked: {
    color: '#DC2626',
  },
  createVPButton: {
    backgroundColor: '#F97316',
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  createVPButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  previewRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  previewLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '900',
  },
  previewValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '800',
    marginTop: 4,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    marginTop: 14,
  },
  qrNote: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 12,
  },
  jwtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copyButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  jwtText: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    color: '#2563EB',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    padding: 12,
    borderRadius: 14,
  },
  noteCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  emptyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
});