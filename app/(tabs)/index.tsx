import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';

import { DIDData } from '../../src/types/did';
import { VerifiableCredential } from '../../src/types/vc';
import { getDID } from '../../src/Storage/didStorage';
import { getAllVCs } from '../../src/Storage/vcStorage';

import AppToast from '../../components/ui/AppToast';
import AnimatedButton from '../../components/ui/AnimatedButton';
import SkeletonBox from '../../components/ui/SkeletonBox';
import AnimatedScreen from '../../components/ui/AnimatedScreen';

export default function HomeScreen() {
  const router = useRouter();

  const [didData, setDidData] = useState<DIDData | null>(null);
  const [credentials, setCredentials] = useState<VerifiableCredential[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  async function loadDashboard() {
    try {
      setLoadingDashboard(true);

      const did = await getDID();
      const vcs = await getAllVCs();

      setDidData(did);
      setCredentials(vcs);
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function handleCopyDID() {
    if (!didData?.did) return;

    await Clipboard.setStringAsync(didData.did);

    setToast({
      visible: true,
      message: 'DID berhasil disalin',
      type: 'success',
    });
  }

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const latestCredential = credentials[0];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AnimatedScreen>
        <LinearGradient
          colors={['#2563EB', '#1D4ED8', '#F97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View>
            <Text style={styles.welcomeTextGradient}>Welcome to</Text>
            <Text style={styles.appTitleGradient}>VC Wallet</Text>
            <Text style={styles.subtitleGradient}>
              Secure digital identity wallet for DID and Verifiable Credential.
            </Text>
          </View>

          <View style={styles.logoCircleGradient}>
            <Ionicons name="shield-checkmark" size={34} color="#2563EB" />
          </View>
        </LinearGradient>
        </AnimatedScreen>

        <AnimatedScreen delay={120}>
        {loadingDashboard ? (
          <View style={styles.didCard}>
            <SkeletonBox width="60%" height={20} />

            <SkeletonBox width="100%" height={16} style={{ marginTop: 16 }} />
            <SkeletonBox width="80%" height={16} style={{ marginTop: 10 }} />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
              <SkeletonBox width="48%" height={70} borderRadius={16} />
              <SkeletonBox width="48%" height={70} borderRadius={16} />
            </View>
          </View>
        ) : (
          <View style={styles.didCard}>
            <View style={styles.didHeader}>
              <View style={styles.didIcon}>
                <Ionicons
                  name="finger-print-outline"
                  size={28}
                  color="#2563EB"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>Digital Identity</Text>
                <Text style={styles.cardTitle}>
                  {didData ? 'Active DID' : 'No DID Created'}
                </Text>
              </View>

              <View style={didData ? styles.activeBadge : styles.inactiveBadge}>
                <Text
                  style={
                    didData ? styles.activeBadgeText : styles.inactiveBadgeText
                  }
                >
                  {didData ? 'ACTIVE' : 'SETUP'}
                </Text>
              </View>
            </View>

            <Text style={styles.didAddressLabel}>DID Address</Text>
            <Text style={styles.didAddress}>
              {didData?.did ??
                'Create DID first to activate your identity wallet.'}
            </Text>

            {didData && (
              <AnimatedButton
                style={styles.copyDidButton}
                onPress={handleCopyDID}
              >
                <Ionicons name="copy-outline" size={16} color="#2563EB" />
                <Text style={styles.copyDidText}>Copy DID Address</Text>
              </AnimatedButton>
            )}

            <View style={styles.didMetaRow}>
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>Method</Text>
                <Text style={styles.metaValue}>{didData?.method ?? '-'}</Text>
              </View>

              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>Network</Text>
                <Text style={styles.metaValue}>{didData?.network ?? '-'}</Text>
              </View>
            </View>

            {!didData && (
              <AnimatedButton
                style={styles.createButton}
                onPress={() => router.push('/(tabs)/did')}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Create DID</Text>
              </AnimatedButton>
            )}
          </View>
        )}
        </AnimatedScreen>

        <AnimatedScreen delay={220}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconBlue}>
              <Ionicons name="id-card-outline" size={24} color="#2563EB" />
            </View>
            <Text style={styles.statNumber}>
              {loadingDashboard ? '-' : credentials.length}
            </Text>
            <Text style={styles.statLabel}>Credentials</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconOrange}>
              <Ionicons name="qr-code-outline" size={24} color="#F97316" />
            </View>
            <Text style={styles.statNumber}>
              {loadingDashboard ? '-' : didData ? 'Ready' : 'Locked'}
            </Text>
            <Text style={styles.statLabel}>Presentation</Text>
          </View>
        </View>
          </AnimatedScreen>

        <AnimatedScreen delay={320}>
        <View style={styles.smartCard}>
          <Ionicons
            name={
              !didData
                ? 'alert-circle-outline'
                : credentials.length === 0
                ? 'cloud-upload-outline'
                : 'checkmark-done-circle-outline'
            }
            size={24}
            color={
              !didData
                ? '#F97316'
                : credentials.length === 0
                ? '#2563EB'
                : '#16A34A'
            }
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.smartTitle}>
              {!didData
                ? 'Setup Identity Required'
                : credentials.length === 0
                ? 'Add Your First Credential'
                : 'Wallet Ready to Use'}
            </Text>

            <Text style={styles.smartText}>
              {!didData
                ? 'Create Ethereum DID before using credential wallet.'
                : credentials.length === 0
                ? 'Import your first Verifiable Credential to start presenting identity.'
                : 'Your DID and credential are ready for presentation and verification.'}
            </Text>
          </View>
        </View> 
        </AnimatedScreen>

          <AnimatedScreen delay={420}>
        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>Quick Action</Text>

          <AnimatedButton
            style={[
              styles.presentButton,
              !latestCredential && styles.disabledButton,
            ]}
            disabled={!latestCredential}
            onPress={() => {
              if (!latestCredential) return;

              router.push({
                pathname: '/credential/present',
                params: { id: latestCredential.id },
              });
            }}
          >
            <View style={styles.presentIcon}>
              <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.presentTitle}>Present Credential</Text>
              <Text style={styles.presentSubtitle}>
                {latestCredential
                  ? 'Share your latest credential as QR presentation.'
                  : 'Import credential first to use presentation.'}
              </Text>
            </View>

            <Ionicons name="chevron-forward-outline" size={22} color="#6B7280" />
          </AnimatedButton>
        </View>
          </AnimatedScreen>

            <AnimatedScreen delay={520}>
        <View style={styles.recentCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Credential</Text>

            <Pressable onPress={() => router.push('/(tabs)/wallet')}>
              <Text style={styles.viewAllText}>View Wallet</Text>
            </Pressable>
          </View>

          {loadingDashboard ? (
            <View style={styles.emptyCredential}>
              <SkeletonBox width={48} height={48} borderRadius={24} />
              <SkeletonBox width="70%" height={16} style={{ marginTop: 14 }} />
              <SkeletonBox width="50%" height={13} style={{ marginTop: 8 }} />
            </View>
          ) : latestCredential ? (
            <Pressable
              style={styles.credentialItem}
              onPress={() =>
                router.push({
                  pathname: '/credential/[id]',
                  params: { id: latestCredential.id },
                })
              }
            >
              <View style={styles.credentialIcon}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={24}
                  color="#2563EB"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.credentialTitle}>
                  {latestCredential.type.includes('IdentityCredential')
                    ? 'Identity Credential'
                    : 'Verifiable Credential'}
                </Text>
                <Text style={styles.credentialSubtitle}>
                  Issuer: {latestCredential.issuer}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View style={styles.emptyCredential}>
              <Ionicons name="file-tray-outline" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No credential stored yet.</Text>
            </View>
          )}
        </View>
          </AnimatedScreen>

          <AnimatedScreen delay={620}> 
        <View style={styles.securityCard}>
          <Ionicons name="lock-closed-outline" size={22} color="#F97316" />
          <Text style={styles.securityText}>
            Wallet protected with local secure storage, PIN, and biometric lock.
          </Text>
        </View>
        </AnimatedScreen>
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
  heroGradient: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeTextGradient: {
    fontSize: 14,
    color: '#FFEDD5',
    fontWeight: '900',
  },
  appTitleGradient: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  subtitleGradient: {
    fontSize: 14,
    color: '#DBEAFE',
    marginTop: 8,
    lineHeight: 21,
    maxWidth: 240,
  },
  logoCircleGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  didCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  didHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  didIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 19,
    color: '#111827',
    fontWeight: '900',
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  inactiveBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeBadgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '900',
  },
  inactiveBadgeText: {
    color: '#C2410C',
    fontSize: 11,
    fontWeight: '900',
  },
  didAddressLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '800',
    marginTop: 18,
  },
  didAddress: {
    fontSize: 13,
    color: '#2563EB',
    marginTop: 6,
    lineHeight: 20,
    fontWeight: '600',
  },
  copyDidButton: {
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  copyDidText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 13,
  },
  didMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  metaBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
  },
  metaLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  metaValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '900',
    marginTop: 4,
  },
  createButton: {
    backgroundColor: '#2563EB',
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
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
    fontSize: 23,
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
  smartCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  smartTitle: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '900',
  },
  smartText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 19,
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
  presentButton: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  disabledButton: {
    opacity: 0.55,
  },
  presentIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  presentSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
    lineHeight: 18,
  },
  recentCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllText: {
    color: '#2563EB',
    fontWeight: '900',
    fontSize: 13,
  },
  credentialItem: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  credentialIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  credentialTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },
  credentialSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },
  emptyCredential: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 8,
  },
  securityCard: {
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
  securityText: {
    flex: 1,
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});