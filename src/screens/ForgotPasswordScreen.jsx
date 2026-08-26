import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ToastAndroid,
} from 'react-native';
import { apiClient } from '../api/apiClient';
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { SimulatedGradientBackground } from '../components/SimulatedGradientBackground';

export const ForgotPasswordScreen = ({ onNavigate, onGoBack }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1); // 1 = Request OTP, 2 = Verify OTP, 3 = Reset Password
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (!email.trim()) {
      Alert.alert('Required Field', 'Please enter your registered email address.');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.forgotPassword({ email: email.trim().toLowerCase() });
      
      setCode('');
      Alert.alert(
        'Code Sent ✉️',
        res.message || `Password reset code sent to ${email.trim()}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setCode('');
              setStep(2);
            },
          },
        ]
      );
    } catch (err) {
      console.log('Forgot password error:', err);
      const msg = err.data?.message || err.message || 'User with this email does not exist.';
      Alert.alert('Notice', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email.trim()) {
      Alert.alert('Required Field', 'Please enter your registered email address.');
      return;
    }

    try {
      setResendLoading(true);
      const res = await apiClient.forgotPassword({ email: email.trim().toLowerCase() });
      
      setCode('');

      const successMessage = res.message || `Password reset code resent to ${email.trim()}`;
      if (Platform.OS === 'android') {
        ToastAndroid.show(successMessage, ToastAndroid.SHORT);
      } else {
        Alert.alert('OTP Resent ✉️', successMessage);
      }
    } catch (err) {
      console.log('Resend OTP error:', err);
      const msg = err.data?.message || err.message || 'Failed to resend OTP code. Please try again.';
      Alert.alert('Resend Failed', msg);
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!code.trim()) {
      Alert.alert('Required Field', 'Please enter the 6-digit verification code sent to your email.');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.verifyResetOtp({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });

      Alert.alert(
        'OTP Verified 🎉',
        res.message || 'Verification code confirmed. You can now set your new password.',
        [
          {
            text: 'Continue',
            onPress: () => setStep(3),
          },
        ]
      );
    } catch (err) {
      console.log('Verify OTP error:', err);
      const msg = err.data?.message || err.message || 'Invalid or expired verification code.';
      Alert.alert('Verification Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Required Field', 'Please enter your new password.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Weak Password', 'New password must be at least 8 characters long.');
      return;
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'New password and confirm password do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.resetPassword({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      });

      Alert.alert(
        'Password Reset Successful 🎉',
        res.message || 'Your password has been updated successfully. Please log in.',
        [{ text: 'Log In', onPress: () => onNavigate && onNavigate('LOGIN') }]
      );
    } catch (err) {
      console.log('Reset password error:', err);
      const msg = err.data?.message || err.message || 'Invalid or expired verification code.';
      Alert.alert('Reset Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SimulatedGradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (step > 1) {
                  setStep(step - 1);
                } else {
                  if (onGoBack && onGoBack()) return;
                  if (onNavigate) onNavigate('LOGIN');
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonIcon}>←</Text>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerContainer}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoHeart}>🔑</Text>
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              {step === 1
                ? 'Enter your email to receive a 6-digit password reset code'
                : step === 2
                ? `Enter the 6-digit code sent to ${email.trim()}`
                : 'Choose a strong new password for your account'}
            </Text>
          </View>

          <View style={styles.card}>
            {step === 1 && (
              <>
                <CustomInput
                  label="Email Address"
                  iconType="email"
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />

                <CustomButton
                  title="SEND RESET CODE"
                  variant="primary"
                  loading={loading}
                  onPress={handleRequestOtp}
                  style={styles.actionBtn}
                />
              </>
            )}

            {step === 2 && (
              <>
                <CustomInput
                  label="Registered Email"
                  iconType="email"
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />

                <CustomInput
                  label="6-Digit Reset Code"
                  iconType="user"
                  placeholder="Enter 6-digit code (e.g. 123456)"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />

                <CustomButton
                  title="VERIFY CODE"
                  variant="primary"
                  loading={loading}
                  onPress={handleVerifyOtp}
                  style={styles.actionBtn}
                />

                <CustomButton
                  title="RESEND OTP"
                  variant="outline"
                  loading={resendLoading}
                  onPress={handleResendOtp}
                  style={styles.resendActionBtn}
                />
              </>
            )}

            {step === 3 && (
              <>
                <CustomInput
                  label="New Password"
                  iconType="password"
                  placeholder="Enter new password (min 8 chars)"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />

                <CustomInput
                  label="Confirm New Password"
                  iconType="password"
                  placeholder="Confirm new password"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />

                <CustomButton
                  title="RESET PASSWORD"
                  variant="primary"
                  loading={loading}
                  onPress={handleResetPassword}
                  style={styles.actionBtn}
                />
              </>
            )}
          </View>

          <View style={styles.footerContainer}>
            <TouchableOpacity
              onPress={() => onNavigate && onNavigate('LOGIN')}
              activeOpacity={0.7}
            >
              <Text style={styles.backToLoginText}>← Back to Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SimulatedGradientBackground>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: Platform.OS === 'ios' ? 40 : 15,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  backButtonIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 6,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  logoHeart: {
    fontSize: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 20,
  },
  actionBtn: {
    marginTop: 12,
  },
  resendActionBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 14,
  },
  resendText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  backToLoginText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default ForgotPasswordScreen;
