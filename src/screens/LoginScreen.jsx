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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../redux/slices/authSlice';
import { apiClient } from '../api/apiClient';
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { SimulatedGradientBackground } from '../components/SimulatedGradientBackground';
import { syncUserLocationService } from '../services/locationService';

export const LoginScreen = ({ onNavigate }) => {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter both your email address and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.login({
        email: email.trim().toLowerCase(),
        password,
      });

      const rawUser = res.user || res.data?.user || res;
      const token = res.token || res.data?.token;

      if (rawUser && token) {
        // Normalize user ID field for compatibility across MongoDB and frontend
        const userId = rawUser.id || rawUser._id;
        const user = {
          ...rawUser,
          id: userId,
          _id: userId,
        };

        // Check if user has already completed questionnaire or has profile data
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

        dispatch(setCredentials({ user, token }));

        // Trigger real device location check and sync to database via API upon login
        try {
          await syncUserLocationService(true);
        } catch (locErr) {
          console.log('Location sync on login error:', locErr);
        }

        if (onNavigate) {
          if (isReturningUser) {
            await onNavigate('HOME', user);
          } else {
            await onNavigate('QUESTIONNAIRE', user);
          }
        }
      } else {
        Alert.alert('Login Failed', res.message || 'Invalid email or password.');
      }
    } catch (err) {
      console.log('Login error:', err);
      const msg = err.data?.message || err.message || 'Invalid email or password. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SimulatedGradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

            <CustomInput
              label="Email Address"
              iconType="email"
              placeholder="Enter your email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
            />

            <CustomInput
              label="Password"
              iconType="password"
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
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
