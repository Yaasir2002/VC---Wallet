import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';

import { deleteAllVCs } from '../../src/Storage/vcStorage';
import { CredentialDocument } from '../../src/types/vc';
import { getCredentialDocuments } from '../../src/Services/documentCredentialService';
import { getDocumentIcon } from '../../src/utils/credentialUtils';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import SkeletonBox from '../../components/ui/SkeletonBox';

export default function WalletScreen() {
  const router = useRouter();

  const [documents, setDocuments] = useState<CredentialDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  async function loadDocuments() {
    try {
      setLoadingDocs(true);

      const docs = await getCredentialDocuments();
      setDocuments(docs);
    } catch (error) {
      console.log('LOAD DOCUMENTS ERROR:', error);

      setToast({
        visible: true,
        message: 'Gagal mengambil dokumen credential',
        type: 'error',
      });
    } finally {
      setLoadingDocs(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [])
  );

  function handleAddCredential() {
    router.push('/credential/create');
  }

  function handleDeleteAllDocuments() {
    Alert.alert(
      'Hapus Semua Dokumen',
      'Apakah kamu yakin ingin menghapus semua credential? Tindakan ini tidak dapat dibatalkan.',
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              await deleteAllVCs();
              setDocuments([]);

              setToast({
                visible: true,
                message: 'Semua dokumen credential berhasil dihapus',
                type: 'success',
              });
            } catch (error) {
              console.log('DELETE DOCUMENTS ERROR:', error);

              setToast({
                visible: true,
                message: 'Gagal menghapus dokumen credential',
                type: 'error',
              });
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  const totalAttributes = documents.reduce(
    (total, doc) => total + doc.credentials.length,
    0
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <LinearGradient
          colors={['#2563EB', '#1D4ED8', '#F97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View>
            <Text style={styles.heroLabel}>Credential Wallet</Text>
            <Text style={styles.heroTitle}>My Documents</Text>
            <Text style={styles.heroSubtitle}>
              Kelola dokumen credential digital secara modular dan tersimpan
              lokal di wallet.
            </Text>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons name="wallet-outline" size={36} color="#2563EB" />
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconBlue}>
              <Ionicons
                name="folder-open-outline"
                size={24}
                color="#2563EB"
              />
            </View>
            <Text style={styles.statNumber}>
              {loadingDocs ? '-' : documents.length}
            </Text>
            <Text style={styles.statLabel}>Documents</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconOrange}>
              <Ionicons name="list-outline" size={24} color="#F97316" />
            </View>
            <Text style={styles.statNumber}>
              {loadingDocs ? '-' : totalAttributes}
            </Text>
            <Text style={styles.statLabel}>Attributes</Text>
          </View>
        </View>

        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>Tambah Credential</Text>

          <Text style={styles.actionDescription}>
            Tambahkan credential digital seperti KTP atau KTM dengan mengisi data
            dokumen secara manual. Credential akan dibuat sebagai dokumen parent
            yang berisi beberapa atribut identitas.
          </Text>

            <AnimatedButton
              style={styles.addCredentialButton}
              onPress={handleAddCredential}
              disabled={loading}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Tambah Credential</Text>
            </AnimatedButton>

          {documents.length > 0 && (
            <AnimatedButton
              style={styles.dangerFullButton}
              onPress={handleDeleteAllDocuments}
              disabled={loading}
            >
              <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              <Text style={styles.dangerFullButtonText}>
                Hapus Semua Dokumen
              </Text>
            </AnimatedButton>
          )}
        </View>

        {loadingDocs ? (
          <View style={styles.listSection}>
            {[1, 2].map((item) => (
              <View key={item} style={styles.documentCard}>
                <View style={styles.cardHeader}>
                  <SkeletonBox width={56} height={56} borderRadius={28} />

                  <View style={{ flex: 1 }}>
                    <SkeletonBox width="70%" height={18} />
                    <SkeletonBox
                      width="50%"
                      height={14}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                </View>

                <View style={styles.divider} />

                <SkeletonBox width="100%" height={14} />
                <SkeletonBox width="80%" height={14} style={{ marginTop: 10 }} />
              </View>
            ))}
          </View>
        ) : documents.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="folder-open-outline" size={44} color="#2563EB" />
            </View>

            <Text style={styles.emptyTitle}>Belum Ada Dokumen</Text>

            <Text style={styles.emptyText}>
              Tambahkan credential KTP atau KTM terlebih dahulu. Satu credential
              parent akan berisi beberapa atribut identitas modular.
            </Text>
          </View>
        ) : (
          <View style={styles.listSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Document List</Text>
              <Text style={styles.countText}>{documents.length} documents</Text>
            </View>

            {documents.map((doc) => (
              <Pressable
                key={doc.documentId}
                style={({ pressed }) => [
                  styles.documentCard,
                  pressed && styles.documentCardPressed,
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/credential/document/[documentId]',
                    params: { documentId: doc.documentId },
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <View style={styles.documentIcon}>
                    <Ionicons
                      name={getDocumentIcon(doc.documentType)}
                      size={30}
                      color="#2563EB"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.documentTitle}>{doc.documentName}</Text>

                    <Text style={styles.documentSubtitle}>
                      {doc.documentType} • {doc.credentials.length} atribut
                    </Text>
                  </View>

                  <View style={styles.documentBadge}>
                    <Text style={styles.documentBadgeText}>
                      {doc.documentType}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.label}>Attributes</Text>

                <View style={styles.attributePreviewWrap}>
                  {doc.credentials.slice(0, 4).map((vc) => (
                    <View key={vc.id} style={styles.attributeChip}>
                      <Text style={styles.attributeChipText}>
                        {vc.credentialSubject.attributeName}
                      </Text>
                    </View>
                  ))}

                  {doc.credentials.length > 4 && (
                    <View style={styles.attributeChipMore}>
                      <Text style={styles.attributeChipMoreText}>
                        +{doc.credentials.length - 4}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.footerRow}>
                  <View style={styles.localBadge}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={15}
                      color="#166534"
                    />
                    <Text style={styles.localBadgeText}>Stored Locally</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailText}>Detail</Text>
                    <Ionicons
                      name="chevron-forward-outline"
                      size={18}
                      color="#6B7280"
                    />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={22} color="#2563EB" />
          <Text style={styles.noteText}>
            Credential parent membungkus beberapa atribut seperti nama, NIK, NIM,
            tanggal lahir, alamat, kampus, dan data identitas lainnya. Saat
            detail dibuka, atribut akan tampil sebagai tabel sederhana.
          </Text>
        </View>
      </ScrollView>

      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
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
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 14,
    color: '#FFEDD5',
    fontWeight: '900',
  },
  heroTitle: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 2,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#DBEAFE',
    marginTop: 8,
    lineHeight: 21,
    maxWidth: 240,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statIconBlue: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconOrange: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    marginTop: 12,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 2,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  actionDescription: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
  },
  addCredentialButton: {
    backgroundColor: '#2563EB',
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  dangerFullButton: {
    backgroundColor: '#DC2626',
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dangerFullButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  listSection: {
    marginTop: 18,
  },
  sectionHeader: {
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  documentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  documentCardPressed: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFC',
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  documentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  documentSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '700',
  },
  documentBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  documentBadgeText: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '800',
  },
  attributePreviewWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  attributeChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  attributeChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '800',
  },
  attributeChipMore: {
    backgroundColor: '#FFEDD5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  attributeChipMoreText: {
    fontSize: 12,
    color: '#C2410C',
    fontWeight: '900',
  },
  footerRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  localBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  localBadgeText: {
    color: '#166534',
    fontWeight: '900',
    fontSize: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#6B7280',
    fontWeight: '900',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 26,
    padding: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
  },
  noteCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    padding: 16,
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
