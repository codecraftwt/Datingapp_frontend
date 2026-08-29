import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

export const WarningModal = ({ visible, warning, onAcknowledge, onClose, loading, isMandatory = false }) => {
  if (!visible || !warning) return null;

  const getSeverityColor = (sev) => {
    switch ((sev || '').toLowerCase()) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#d97706';
      case 'low':
      default:
        return '#2563eb';
    }
  };

  const severityColor = getSeverityColor(warning.severity);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={isMandatory ? () => {} : (onClose || (() => {}))}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Top Right Close Button (Hidden if mandatory acknowledgment is active) */}
          {onClose && !isMandatory && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}

          {/* Header Warning Badge */}
          <View style={[styles.headerBadge, { backgroundColor: `${severityColor}15` }]}>
            <Ionicons name="warning" size={36} color={severityColor} />
          </View>

          <Text style={styles.title}>Official Warning Issued</Text>
          <Text style={styles.subtitle}>
            Our moderation team has flagged policy violations associated with your account.
          </Text>

          {/* Severity Tag */}
          <View style={[styles.severityTag, { backgroundColor: severityColor }]}>
            <Text style={styles.severityText}>
              {(warning.severity || 'HIGH').toUpperCase()} SEVERITY
            </Text>
          </View>

          <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Violation Category:</Text>
              <Text style={styles.valueText}>{warning.category || 'Community Guidelines Violation'}</Text>
            </View>

            <View style={styles.reasonBox}>
              <Text style={styles.reasonHeader}>Admin Notice / Reason:</Text>
              <Text style={styles.reasonBody}>
                {warning.message || 'Continued violations may result in temporary account restriction or a permanent ban.'}
              </Text>
            </View>

            <Text style={styles.footerNotice}>
              Please review our Community Guidelines. You must acknowledge this warning to continue using the application.
            </Text>
          </ScrollView>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.acknowledgeBtn, { backgroundColor: severityColor }]}
            onPress={onAcknowledge}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.acknowledgeBtnText}>I Understand & Acknowledge</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: Math.min(width - 32, 400),
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  headerBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  severityTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  severityText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailsContainer: {
    width: '100%',
    maxHeight: 200,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoRow: {
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  reasonBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    marginBottom: 10,
  },
  reasonHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  reasonBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  footerNotice: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 15,
  },
  acknowledgeBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  acknowledgeBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
});
