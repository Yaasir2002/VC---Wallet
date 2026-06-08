// File: components/PresentationQrView.tsx

import { View, Text, StyleSheet, Pressable } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';

type PresentationQrViewProps = {
  jwt: string;
  holderDid?: string;
  credentialCount?: number;
  algorithm?: string;
  warning?: string;
  onCopy?: () => void;
};

function getJwtPartCount(jwt: string): number {
  return jwt.trim().split('.').length;
}

export default function PresentationQrView({
  jwt,
  holderDid,
  credentialCount = 1,
  algorithm,
  warning,
  onCopy,
}: PresentationQrViewProps) {
  const normalizedJwt = jwt.trim();

  return (
    <View style={styles.qrCard}>
      <Text style={styles.qrTitle}>Signed VP JWT QR</Text>

      <View style={styles.qrStatusBox}>
        <Text style={styles.qrStatusText}>
          Status: Signed Presentation JWT
        </Text>
        <Text style={styles.qrStatusText}>
          JWT Parts: {getJwtPartCount(normalizedJwt)}
        </Text>
        <Text style={styles.qrStatusText}>
          Credential Count: {credentialCount}
        </Text>
        <Text style={styles.qrStatusText}>
          Algorithm: {algorithm || '-'}
        </Text>
        <Text style={styles.qrStatusText}>
          JWT Length: {normalizedJwt.length}
        </Text>
        {holderDid ? (
          <Text style={styles.qrStatusText} numberOfLines={2}>
            Holder: {holderDid}
          </Text>
        ) : null}
      </View>

      {warning ? (
        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={22} color="#F97316" />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ) : null}

      <View style={styles.qrBox}>
        <QRCode
          value={normalizedJwt}
          size={260}
          ecl="M"
        />
      </View>

      <Text style={styles.qrNote}>
        QR ini berisi signed VP JWT compact string: header.payload.signature.
      </Text>

      <Text style={styles.jwtLabel}>Preview JWT</Text>
      <Text style={styles.jwtPreview} numberOfLines={4}>
        {normalizedJwt}
      </Text>

      {onCopy ? (
        <Pressable style={styles.copyButton} onPress={onCopy}>
          <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
          <Text style={styles.copyButtonText}>Copy Signed VP JWT</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  qrCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
  },
  qrStatusBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    gap: 5,
    marginBottom: 16,
  },
  qrStatusText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
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
  qrBox: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrNote: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  jwtLabel: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
  },
  jwtPreview: {
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    color: '#334155',
    fontSize: 11,
    lineHeight: 16,
  },
  copyButton: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
});