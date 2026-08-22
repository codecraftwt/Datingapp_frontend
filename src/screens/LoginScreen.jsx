import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ToastAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../redux/slices/authSlice';
import { apiClient, setAuthToken } from '../api/apiClient';
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { SimulatedGradientBackground } from '../components/SimulatedGradientBackground';
import { registerFcmToken } from '../services/notificationService';

export const LoginScreen = ({ onNavigate }) => {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [alreadyLoggedInError, setAlreadyLoggedInError] = useState(false);

  const processSuccessfulLogin = async (res) => {
    const rawUser = res.user || res.data?.user || res;
    const token = res.token || res.data?.token;

    if (rawUser && token) {
      const userId = rawUser.id || rawUser._id;
      const user = {
        ...rawUser,
        id: userId,
        _id: userId,
      };

      const hasProfileOnUser = !!(
        user.firstName ||
        user.age ||
        user.profileImage ||
        user.bio ||
        (user.interests && user.interests.length > 0)
      );

      const hasCompletedBefore = await AsyncStorage.getItem(`hasCompletedQuestionnaire_${userId}`);
      const isReturningUser = hasCompletedBefore === 'true' || hasProfileOnUser;

      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('token', token);

      if (isReturningUser) {
        await AsyncStorage.setItem(`hasCompletedQuestionnaire_${userId}`, 'true');
        await AsyncStorage.setItem(`profileData_${userId}`, JSON.stringify(user));
      }

      setAuthToken(token);
      dispatch(setCredentials({ user, token }));

      // Immediately trigger FCM Token registration after credentials set
      registerFcmToken().catch((e) => console.log('[LoginScreen] FCM register notice:', e));

      if (Platform.OS === 'android') {
        ToastAndroid.show('Logged in successfully! 👋', ToastAndroid.SHORT);
      } else {
        Alert.alert('Login Successful 🎉', 'Welcome back!');
      }

      if (onNavigate) {
        if (isReturningUser) {
          await onNavigate('HOME', user);
        } else {
          await onNavigate('QUESTIONNAIRE', user);
        }
      }
    }
  };

  const handleLogoutAllDevicesCall = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter your email and password to log out from all devices.');
      return;
    }

    try {
      setLoading(true);
      await apiClient.logoutAllDevices({
        email: email.trim().toLowerCase(),
        password,
      });

      setAlreadyLoggedInError(false);
      Alert.alert(
        'Sessions Terminated',
        'Successfully logged out from all devices! Please click LOG IN to sign in to your session.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.log('Error forcing logout from all devices:', err);
      const msg = err.data?.message || err.message || 'Failed to logout from all devices.';
      Alert.alert('Logout Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter both your email address and password.');
      return;
    }

    try {
      setLoading(true);
      setAlreadyLoggedInError(false);
      const res = await apiClient.login({
        email: email.trim().toLowerCase(),
        password,
      });

      if (res?.status === 'DEVICE_LIMIT_REACHED') {
        setAlreadyLoggedInError(true);
        Alert.alert(
          'Device Limit Reached',
          res?.message || 'Device limit reached. User is already logged in, please Logout from all devices.'
        );
        return;
      }

      const rawUser = res.user || res.data?.user || res;
      const token = res.token || res.data?.token;

      if (rawUser && token) {
        await processSuccessfulLogin(res);
      } else {
        Alert.alert('Login Failed', res.message || 'Invalid email or password.');
      }
    } catch (err) {
      console.log('Login error:', err);
      const isDeviceLimit =
        err?.status === 409 ||
        err?.data?.status === 'DEVICE_LIMIT_REACHED' ||
        err?.message?.includes('active on another device') ||
        err?.message?.includes('already logged in') ||
        err?.message?.includes('Device limit reached') ||
        err?.data?.message?.includes('already logged in') ||
        err?.data?.message?.includes('Device limit reached');

      if (isDeviceLimit) {
        setAlreadyLoggedInError(true);
        Alert.alert(
          'Device Limit Reached',
          err?.data?.message || err?.message || 'Device limit reached. User is already logged in, please Logout from all devices.'
        );
        return;
      }

      const isNetworkFail = err?.message?.includes('Network request failed') || err?.name === 'TypeError';
      const msg = isNetworkFail
        ? 'Cannot reach backend server (Network Request Failed). Ensure backend is running and ADB reverse is enabled.'
        : (err.data?.message || err.message || 'Invalid email or password. Please try again.');
      Alert.alert('Login Failed', msg);
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
          <View style={styles.headerContainer}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoHeart}>🔥</Text>
            </View>
            <Text style={styles.title}>Spark</Text>
            <Text style={styles.subtitle}>Find your true connection today</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>

            {/* Inline warning banner when user is already logged in elsewhere */}
            {alreadyLoggedInError && (
              <View style={styles.alreadyLoggedInContainer}>
                <Text style={styles.alreadyLoggedInText}>
                  Device limit reached. User is already logged in, please Logout from all devices.
                </Text>
                <TouchableOpacity
                  style={styles.logoutAllInlineBtn}
                  onPress={handleLogoutAllDevicesCall}
                  activeOpacity={0.8}
                >
                  <Text style={styles.logoutAllInlineBtnText}>Logout All devices</Text>
                </TouchableOpacity>
              </View>
            )}

            <CustomInput
              label="Email Address"
              iconType="email"
              placeholder="Enter your email"
              keyboardType="email-address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (alreadyLoggedInError) setAlreadyLoggedInError(false);
              }}
              autoCapitalize="none"
            />

            <CustomInput
              label="Password"
              iconType="password"
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (alreadyLoggedInError) setAlreadyLoggedInError(false);
              }}
            />

            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => onNavigate && onNavigate('FORGOT_PASSWORD')}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <CustomButton
              title="LOG IN"
              variant="primary"
              loading={loading}
              onPress={handleLogin}
              style={styles.loginBtn}
            />
          </View>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity
              onPress={() => onNavigate && onNavigate('REGISTER')}
              activeOpacity={0.7}
            >
              <Text style={styles.signUpText}> Sign Up</Text>
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
    paddingBottom: 30,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logoBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  logoHeart: {
    fontSize: 34,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  alreadyLoggedInContainer: {
    backgroundColor: 'rgba(254, 60, 114, 0.2)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FE3C72',
    alignItems: 'center',
  },
  alreadyLoggedInText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
  },
  logoutAllInlineBtn: {
    backgroundColor: '#C62828',
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  logoutAllInlineBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  forgotText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  loginBtn: {
    marginTop: 8,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 15,
  },
  signUpText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
