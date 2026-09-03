import React, { useState, useEffect } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View, ActivityIndicator, Text, Platform, AppState, Alert, BackHandler, ToastAndroid } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { store } from './src/redux/store';
import { logout, selectCurrentUser, setCredentials } from './src/redux/slices/authSlice';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { QuestionnaireScreen } from './src/screens/QuestionnaireScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { apiClient } from './src/api/apiClient';
import { syncUserLocationService } from './src/services/locationService';
import { registerFcmToken, setupNotificationListeners, displayLocalSystemNotification } from './src/services/notificationService';
import { TopToastBanner } from './src/components/TopToastBanner';

function MainApp() {
  const isDarkMode = useColorScheme() === 'dark';
  const [isInitializing, setIsInitializing] = useState(true);
  const [screenStack, setScreenStack] = useState(['LOGIN']);
  const [userProfile, setUserProfile] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [topToast, setTopToast] = useState({ visible: false, message: '', type: 'info' });

  const currentScreen = screenStack[screenStack.length - 1] || 'LOGIN';

  const navigateTo = (nextScreen) => {
    if (nextScreen === 'HOME' || nextScreen === 'LOGIN') {
      setScreenStack([nextScreen]);
    } else {
      setScreenStack((prev) => {
        if (prev[prev.length - 1] === nextScreen) return prev;
        return [...prev, nextScreen];
      });
    }
  };

  const goBack = () => {
    if (screenStack.length > 1) {
      setScreenStack((prev) => prev.slice(0, -1));
      return true;
    }
    return false;
  };
  
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);

  const checkUnreadNotifications = async () => {
    try {
      const res = await apiClient.getUnreadNotifications();
      console.log('🔔 [checkUnreadNotifications] result:', res);
      if (res && res.unreadCount > 0 && Array.isArray(res.notifications)) {
        const notifIds = [];
        for (const notif of res.notifications) {
          if (notif._id) notifIds.push(notif._id);
          if (typeof displayLocalSystemNotification === 'function') {
            await displayLocalSystemNotification({
              title: notif.title,
              body: notif.body,
              data: {
                ...notif.data,
                notificationId: notif._id ? notif._id.toString() : Date.now().toString(),
                senderId: notif.sender?._id || notif.sender?.id || notif.sender,
                type: notif.type,
              },
            });
          }
        }
        if (notifIds.length > 0 && typeof apiClient.markNotificationsAsRead === 'function') {
          await apiClient.markNotificationsAsRead({ notificationIds: notifIds });
        }
      }
    } catch (e) {
      console.log('Error checking unread notifications on login:', e);
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      if (screenStack.length > 1) {
        setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [screenStack]);

  useEffect(() => {
    if (user) {
      try {
        if (typeof registerFcmToken === 'function') {
          registerFcmToken().catch((e) => console.log('FCM Token registration error:', e));
        }

        checkUnreadNotifications();

        let cleanupFcm;
        if (typeof setupNotificationListeners === 'function') {
          cleanupFcm = setupNotificationListeners((data) => {
            console.log('Notification tapped with payload:', data);
            if (data?.type === 'chat' || data?.type === 'like' || data?.type === 'match') {
              navigateTo('HOME');
            }
          });
        }
        return () => {
          if (typeof cleanupFcm === 'function') cleanupFcm();
        };
      } catch (err) {
        console.warn('FCM Initialization error:', err);
      }
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected);
    });

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && user) {
        // [LOCATION SYNC DISABLED AFTER LOGIN]: Location is fetched ONLY at registration time.
        // Location check/sync after login is intentionally commented out.
        // console.log('📍 App foreground active. Checking location sync...');
        // syncUserLocationService(false).catch((e) => console.log('Location sync on active error:', e));
      }
    });

    return () => {
      unsubscribe();
      if (appStateSubscription && typeof appStateSubscription.remove === 'function') {
        appStateSubscription.remove();
      }
    };
  }, [user]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        const storedToken = await AsyncStorage.getItem('token');
        if (storedUser && storedToken) {
          const parsedUser = JSON.parse(storedUser);
          console.log('--- Restored Session on Startup ---');
          console.log('JWT Token:', storedToken);
          console.log('User Profile:', JSON.stringify(parsedUser, null, 2));

          dispatch(setCredentials({
            user: parsedUser,
            token: storedToken,
          }));

          const userId = parsedUser.id || parsedUser._id;
          const hasCompleted = await AsyncStorage.getItem(`hasCompletedQuestionnaire_${userId}`);
          const hasProfileOnUser = !!(
            parsedUser.firstName ||
            parsedUser.age ||
            parsedUser.profileImage ||
            parsedUser.bio ||
            (parsedUser.interests && parsedUser.interests.length > 0)
          );

          if (hasCompleted === 'true' || hasProfileOnUser) {
            const storedProfile = await AsyncStorage.getItem(`profileData_${userId}`);
            setUserProfile(storedProfile ? JSON.parse(storedProfile) : parsedUser);
            navigateTo('HOME');
          } else {
            navigateTo('QUESTIONNAIRE');
          }

          // [LOCATION SYNC DISABLED AFTER LOGIN]: Location is fetched ONLY at registration time.
          // The code below for checking/syncing location on login/session restore is commented out.
          /*
          try {
            await syncUserLocationService(true);
          } catch (locErr) {
            console.log('Error syncing location on session restore:', locErr);
          }
          */
        }
      } catch (err) {
        console.log('Error loading stored session:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    loadSession();
  }, [dispatch]);

  const handleFinishQuestionnaire = async (profileData) => {
    setUserProfile(profileData);
    if (user && user.id) {
      try {
        await AsyncStorage.setItem(`hasCompletedQuestionnaire_${user.id}`, 'true');
        await AsyncStorage.setItem(`profileData_${user.id}`, JSON.stringify(profileData));
      } catch (err) {
        console.log('Error saving questionnaire status:', err);
      }
    }
    navigateTo('HOME');
  };

  const handleUpdateProfile = async (updatedProfile) => {
    setUserProfile(updatedProfile);
    if (user && (user.id || user._id)) {
      const userId = user.id || user._id;
      try {
        await AsyncStorage.setItem(`profileData_${userId}`, JSON.stringify(updatedProfile));
      } catch (err) {
        console.log('Error saving profile data update:', err);
      }
    }
  };

  const handleRemoveProfile = async () => {
    if (user && (user.id || user._id)) {
      const userId = user.id || user._id;
      try {
        await AsyncStorage.removeItem(`hasCompletedQuestionnaire_${userId}`);
        await AsyncStorage.removeItem(`profileData_${userId}`);
      } catch (err) {
        console.log('Error removing questionnaire/profile storage:', err);
      }
    }
    setUserProfile(null);
    navigateTo('QUESTIONNAIRE');
  };

  const handleLogout = async () => {
    try {
      await apiClient.logoutBackend();
    } catch (err) {
      console.log('Error logging out from backend:', err);
    }
    try {
      await AsyncStorage.clear();
    } catch (err) {
      console.log('Error clearing session storage on logout:', err);
    }
    dispatch(logout());
    setUserProfile(null);

    const logoutMsg = 'Logged out successfully.';
    if (Platform.OS === 'android') {
      try {
        ToastAndroid.showWithGravityAndOffset(
          logoutMsg,
          ToastAndroid.LONG,
          ToastAndroid.TOP,
          0,
          120
        );
      } catch (e) {
        ToastAndroid.show(logoutMsg, ToastAndroid.SHORT);
      }
    } else {
      Alert.alert('Logged Out', 'You have been logged out successfully.');
    }
    setTopToast({ visible: true, message: logoutMsg, type: 'info' });

    navigateTo('LOGIN');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'LOGIN':
        return (
          <LoginScreen
            onNavigate={async (nextScreen, loggedUser) => {
              if (nextScreen === 'HOME') {
                try {
                  const res = await apiClient.getProfile();
                  const freshUser = res.user || res.data?.user || res;
                  if (freshUser) {
                    setUserProfile(freshUser);
                  } else if (loggedUser) {
                    setUserProfile(loggedUser);
                  }
                } catch (err) {
                  console.log('Error fetching fresh profile for HOME:', err);
                  if (loggedUser) {
                    setUserProfile(loggedUser);
                  }
                }
                navigateTo('HOME');
                checkUnreadNotifications().catch(() => {});
                return;
              }

              if (nextScreen === 'QUESTIONNAIRE') {
                if (loggedUser) {
                  setUserProfile(loggedUser);
                }
                navigateTo('QUESTIONNAIRE');
              } else {
                navigateTo(nextScreen);
              }
            }}
          />
        );
      case 'REGISTER':
        return <RegisterScreen onNavigate={navigateTo} onGoBack={goBack} />;
      case 'FORGOT_PASSWORD':
        return <ForgotPasswordScreen onNavigate={navigateTo} onGoBack={goBack} />;
      case 'QUESTIONNAIRE':
        return (
          <QuestionnaireScreen
            onNavigate={navigateTo}
            onGoBack={goBack}
            onFinish={handleFinishQuestionnaire}
            onLogout={handleLogout}
          />
        );
      case 'HOME':
        return (
          <HomeScreen
            userProfile={userProfile || (user ? { firstName: user.name, email: user.email } : null)}
            onUpdateProfile={handleUpdateProfile}
            onLogout={handleLogout}
            onRemoveProfile={handleRemoveProfile}
            onNavigate={navigateTo}
            onGoBack={goBack}
          />
        );
      default:
        return <LoginScreen onNavigate={navigateTo} onGoBack={goBack} />;
    }
  };

  if (isInitializing) {
    return (
      <SafeAreaProvider>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <View style={styles.container}>
        {renderScreen()}
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              ⚠️ No Internet Connection. Check your network.
            </Text>
          </View>
        )}
        <TopToastBanner
          visible={topToast.visible}
          message={topToast.message}
          type={topToast.type}
          onHide={() => setTopToast((prev) => ({ ...prev, visible: false }))}
        />
      </View>
    </SafeAreaProvider>
  );
}

function App() {
  return (
    <Provider store={store}>
      <MainApp />
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6D55',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF6D55',
  },
  offlineBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 35,
    left: 16,
    right: 16,
    backgroundColor: '#D32F2F',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 9999,
  },
  offlineBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default App;

