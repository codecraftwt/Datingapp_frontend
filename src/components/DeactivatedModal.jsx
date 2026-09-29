import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

export const DeactivatedModal = ({ visible, deactivatedData, onLogout }) => {
  if (!visible) return null;

  const reason = deactivatedData?.reason || 'Your account has been deactivated by the admin moderation team.';
  const deactivatedDate = deactivatedData?.deactivatedAt
    ? new Date(deactivatedData.deactivatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header Lock Icon Badge */}
          <View style={styles.headerBadge}>
            <Ionicons name="lock-closed" size={38} color="#EF4444" />
          </View>

          <Text style={styles.title}>Account Deactivated 🚫</Text>
          <Text style={styles.subtitle}>
            Your account has been deactivated by the Admin Moderation Team.
          </Text>

          {/* Status Tag */}
          <View style={styles.statusTag}>
            <Text style={styles.statusTagText}>ACCOUNT SUSPENDED</Text>
          </View>

          <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.reasonBox}>
              <Text style={styles.reasonHeader}>Admin Deactivation Reason:</Text>
              <Text style={styles.reasonBody}>{reason}</Text>
            </View>

            {deactivatedDate && (
              <View style={styles.dateBox}>
                <Ionicons name="time-outline" size={14} color="#8A8A9E" style={{ marginRight: 6 }} />
                <Text style={styles.dateText}>Deactivated on: {deactivatedDate}</Text>
              </View>
            )}

            <Text style={styles.footerNotice}>
              You cannot access profiles, swipes, or chats while your account is deactivated. If you believe this was done in error, please contact support.
            </Text>
          </ScrollView>

          {/* Mandatory Action Button: Log Out */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              if (typeof onLogout === 'function') {
                onLogout(reason);
              }
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.logoutBtnText}>Log Out & Return to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 9999,
  },
  modalCard: {
    width: Math.min(width - 32, 420),
    backgroundColor: '#1C1C24',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  headerBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  statusTag: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  detailsContainer: {
    width: '100%',
    maxHeight: 200,
    marginBottom: 18,
  },
  reasonBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    marginBottom: 10,
  },
  reasonHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  reasonBody: {
    fontSize: 14,
    color: '#FAFAFA',
    lineHeight: 20,
    fontWeight: '500',
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#A1A1AA',
  },
  footerNotice: {
    fontSize: 12,
    color: '#71717A',
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  logoutBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
