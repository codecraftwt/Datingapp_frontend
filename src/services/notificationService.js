import messaging, { AuthorizationStatus, getMessaging, getToken as getModularToken } from '@react-native-firebase/messaging';
import firebase from '@react-native-firebase/app';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { apiClient } from '../api/apiClient';

const displayedNotificationIds = new Set();

/**
 * Display system push notification banner using Notifee with deduplication
 */
export const displayLocalSystemNotification = async ({ title, body, data }) => {
  try {
    const senderId = data?.senderId || data?.userId;
    const notifId = data?.notificationId || data?.messageId || data?.id || (senderId ? `${data?.type || 'notif'}_${senderId}_${Date.now()}` : `${Date.now()}_${Math.random()}`);
    
    if (notifId && displayedNotificationIds.has(notifId)) {
      console.log(`[Notifee] Skipping duplicate notification (ID: ${notifId})`);
      return;
    }

    if (notifId) {
      displayedNotificationIds.add(notifId);
      // Keep set size manageable
      if (displayedNotificationIds.size > 100) {
        const firstKey = displayedNotificationIds.values().next().value;
        displayedNotificationIds.delete(firstKey);
      }
    }

    const channelId = await notifee.createChannel({
      id: 'default_notification_channel_v2',
      name: 'High Priority Notifications',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 500, 300, 500],
    });

    await notifee.displayNotification({
      id: notifId || undefined,
      title: title || 'New Notification',
      body: body || '',
      data: data || {},
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
        autoCancel: false,
        timeoutAfter: 30000, // 30 seconds display duration
        showTimestamp: true,
      },
    });
  } catch (err) {
    console.warn('[Notifee] Error displaying system notification:', err);
  }
};

/**
 * Ensure default Firebase App is initialized
 */
const ensureFirebaseInitialized = async () => {
  try {
    if (!firebase?.apps?.length) {
      console.log('[FCM-DEBUG] Firebase apps count is 0. Initializing default app in JS...');
      await firebase.initializeApp({
        appId: '1:470179138168:android:7f8c32b3aeabec6c137b8d',
        apiKey: 'AIzaSyDyIc3uxKKZku_oqTLwa1wqM1-1Q_PvATc',
        projectId: 'dating-app-51de6',
        messagingSenderId: '470179138168',
        storageBucket: 'dating-app-51de6.firebasestorage.app',
      });
      console.log('[FCM-DEBUG] ✅ Firebase default app successfully initialized in JS!');
    }
  } catch (err) {
    console.warn('[FCM-DEBUG] Firebase initialize notice:', err?.message || err);
  }
};

/**
 * Safely get messaging instance if native module is compiled and linked
 */
const getMessagingInstance = () => {
  try {
    if (typeof getMessaging === 'function') {
      const inst = getMessaging();
      if (inst) return inst;
    }
  } catch (e) {
    console.warn('[FCM-DEBUG] getMessaging() notice:', e?.message || e);
  }
  try {
    if (typeof messaging === 'function') {
      return messaging();
    }
  } catch (e) {
    console.warn('[FCM-DEBUG] messaging() notice:', e?.message || e);
  }
  return messaging || null;
};

/**
 * Request notification permissions on Android (13+) & iOS
 */
export const requestNotificationPermission = async () => {
  console.log('[FCM-DEBUG] Step 3: Requesting Notification Permission...');
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      console.log('[FCM-DEBUG] Android 13+ detected (API ' + Platform.Version + '). Requesting POST_NOTIFICATIONS permission...');
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      console.log('[FCM-DEBUG] Android POST_NOTIFICATIONS result:', granted);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[FCM-DEBUG] ⚠️ Android 13+ Notification permission denied by user.');
        return false;
      }
    }

    console.log('[FCM-DEBUG] Requesting Notifee permission...');
    await notifee.requestPermission();

    const messagingModule = getMessagingInstance();
    if (!messagingModule) {
      console.warn('[FCM-DEBUG] Notifee permissions granted; Firebase Messaging native instance deferred.');
      return true;
    }

    let messagingInstance = messagingModule;
    if (typeof messagingModule === 'function') {
      try {
        messagingInstance = messagingModule();
      } catch (e) {}
    }

    if (!messagingInstance || typeof messagingInstance.requestPermission !== 'function') {
      console.warn('[FCM-DEBUG] Notifee permissions granted; Firebase Messaging native instance deferred.');
      return true;
    }

    console.log('[FCM-DEBUG] Requesting Firebase Messaging permission...');
    const authStatus = await messagingInstance.requestPermission();
    const authorizedVal = AuthorizationStatus?.AUTHORIZED ?? 1;
    const provisionalVal = AuthorizationStatus?.PROVISIONAL ?? 2;

    const enabled = authStatus === authorizedVal || authStatus === provisionalVal;
    console.log('[FCM-DEBUG] Step 4: Notification permission status code:', authStatus, 'Enabled:', enabled);
    return enabled;
  } catch (error) {
    console.warn('[FCM-DEBUG] ⚠️ Error requesting notification permission:', error?.message || error);
    return true;
  }
};

/**
 * Helper to fetch device FCM Token without calling backend API
 */
export const getFcmTokenOnly = async () => {
  console.log('[FCM-DEBUG-ONLY] 1. getFcmTokenOnly() invoked...');
  try {
    await ensureFirebaseInitialized();
    let token = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const inst = getMessagingInstance();
        if (inst) {
          if (typeof inst.setAutoInitEnabled === 'function') {
            await inst.setAutoInitEnabled(true).catch(() => {});
          }
          if (typeof inst.registerDeviceForRemoteMessages === 'function') {
            await inst.registerDeviceForRemoteMessages().catch(() => {});
          }

          if (typeof getModularToken === 'function') {
            try {
              token = await getModularToken(inst);
            } catch (mErr) {}
          }

          if (!token && typeof inst.getToken === 'function') {
            token = await inst.getToken();
          }

          if (token) break;
        }
      } catch (err) {
        console.warn(`[FCM-DEBUG-ONLY] Attempt ${attempt} error:`, err?.code || '', err?.message || err);
      }
      if (attempt < 4 && !token) await new Promise((r) => setTimeout(r, 1500));
    }
    console.log('[FCM-DEBUG-ONLY] 2. getToken result:', token ? (token.substring(0, 20) + '...') : 'NULL');
    return token || null;
  } catch (e) {
    console.log('[FCM-DEBUG-ONLY] ⚠️ getFcmTokenOnly error:', e?.message || e);
  }
  return null;
};

/**
 * Fetch and register FCM Token with Backend
 */
export const registerFcmToken = async () => {
  console.log('----------------------------------------------------');
  console.log('[FCM-DEBUG] Step 1: Starting registerFcmToken()...');
  try {
    await ensureFirebaseInitialized();

    // Non-blocking permission request so getToken is never stuck on UI permission prompts
    requestNotificationPermission().catch((permErr) => {
      console.log('[FCM-DEBUG] Request permission notice:', permErr?.message || permErr);
    });

    let fcmToken = null;
    let lastError = null;

    // Retry loop to handle cold startup FIS network initialization delay
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        console.log(`[FCM-DEBUG] Step 5 Attempt ${attempt}: Getting Firebase Messaging instance...`);
        const inst = getMessagingInstance();
        if (inst) {
          if (typeof inst.setAutoInitEnabled === 'function') {
            await inst.setAutoInitEnabled(true).catch(() => {});
          }
          if (typeof inst.registerDeviceForRemoteMessages === 'function') {
            await inst.registerDeviceForRemoteMessages().catch(() => {});
          }

          if (typeof inst.getToken === 'function') {
            try {
              console.log(`[FCM-DEBUG] Attempt ${attempt}: Calling getModularToken(inst)...`);
              fcmToken = await getModularToken(inst);
            } catch (mErr) {
              console.warn(`[FCM-DEBUG] Attempt ${attempt} getModularToken notice:`, mErr?.code || '', mErr?.message || mErr);
            }

            if (!fcmToken) {
              try {
                console.log(`[FCM-DEBUG] Attempt ${attempt}: Calling inst.getToken()...`);
                fcmToken = await inst.getToken();
              } catch (gErr) {
                console.warn(`[FCM-DEBUG] Attempt ${attempt} inst.getToken error:`, gErr?.code || '', gErr?.message || gErr);
                if (typeof inst.deleteToken === 'function') {
                  try {
                    await inst.deleteToken();
                    console.log('[FCM-DEBUG] Cleared stale token cache. Retrying getToken()...');
                    fcmToken = await inst.getToken();
                  } catch (delErr) {}
                }
              }
            }

            if (!fcmToken) {
              try {
                console.log(`[FCM-DEBUG] Attempt ${attempt}: Trying inst.getToken('470179138168')...`);
                fcmToken = await inst.getToken('470179138168');
              } catch (sErr) {
                console.warn(`[FCM-DEBUG] Attempt ${attempt} senderId getToken error:`, sErr?.code || '', sErr?.message || sErr);
              }
            }
          }

          if (fcmToken) {
            console.log(`[FCM-DEBUG] Step 5 Attempt ${attempt} SUCCESS! Token length: ${fcmToken.length}`);
            break;
          }
        } else {
          console.warn(`[FCM-DEBUG] Step 5 Attempt ${attempt}: getMessagingInstance() returned null`);
        }
      } catch (err) {
        lastError = err;
        console.warn(`[FCM-DEBUG] ⚠️ Step 5 Attempt ${attempt} failed: Code: ${err?.code || 'NONE'}, Message: ${err?.message || err}`);
      }
      if (attempt < 4 && !fcmToken) {
        console.log('[FCM-DEBUG] Waiting 2s before retrying getToken()...');
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (fcmToken) {
      console.log('[FCM-DEBUG] Step 6: FCM Token fetched successfully! Token:', fcmToken.substring(0, 20) + '...');
      console.log('[FCM-DEBUG] Step 7: Sending token to backend via apiClient.updateFcmToken()...');
      const res = await apiClient.updateFcmToken(fcmToken);
      console.log('[FCM-DEBUG] Step 8: SUCCESS 🎉 Token registered with backend:', res);
      console.log('----------------------------------------------------');
      return fcmToken;
    } else {
      const codeStr = lastError?.code || 'N/A';
      const msgStr = lastError?.message || (typeof lastError === 'string' ? lastError : JSON.stringify(lastError || {}));
      console.error(`[FCM-DEBUG] ❌ Step 6 FAILED: messaging().getToken() returned null. Code: ${codeStr} | Message: ${msgStr}`);
      console.log('----------------------------------------------------');
      return null;
    }
  } catch (error) {
    console.error('[FCM-DEBUG] ❌ EXCEPTION in registerFcmToken():', error?.message || error, error);
    console.log('----------------------------------------------------');
    return null;
  }
};

/**
 * Setup FCM & Notifee Listeners for Foreground, Background, and Quit states
 * @param {Function} onNotificationClick - Optional callback when user taps a notification
 */
export const setupNotificationListeners = (onNotificationClick) => {
  try {
    // Listen for Notifee notification press events
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS && detail.notification) {
        console.log('[Notifee] Notification pressed:', detail.notification);
        if (onNotificationClick && detail.notification.data) {
          onNotificationClick(detail.notification.data);
        }
      }
    });

    const messagingInstance = getMessagingInstance();
    if (!messagingInstance || typeof messagingInstance.onMessage !== 'function') return unsubscribeNotifee;

    // 1. Foreground Message Handler (App is actively open)
    const unsubscribeForeground = messagingInstance.onMessage(async (remoteMessage) => {
      console.log('[FCM] Foreground Notification Received:', remoteMessage);
      const title = remoteMessage.notification?.title || remoteMessage.data?.title || 'New Notification';
      const body = remoteMessage.notification?.body || remoteMessage.data?.body || '';
      // Display system notification banner using Notifee
      await displayLocalSystemNotification({
        title,
        body,
        data: remoteMessage.data || {},
      });
    });

    // 2. Token Refresh Listener
    let unsubscribeTokenRefresh;
    if (typeof messagingInstance.onTokenRefresh === 'function') {
      unsubscribeTokenRefresh = messagingInstance.onTokenRefresh(async (newToken) => {
        console.log('[FCM] Token Refreshed:', newToken);
        try {
          await apiClient.updateFcmToken(newToken);
        } catch (e) {
          console.error('[FCM] Error updating refreshed token:', e);
        }
      });
    }

    // 3. Notification Opened from Background State
    let unsubscribeNotificationOpened;
    if (typeof messagingInstance.onNotificationOpenedApp === 'function') {
      unsubscribeNotificationOpened = messagingInstance.onNotificationOpenedApp((remoteMessage) => {
        console.log('[FCM] Notification opened from background:', remoteMessage);
        if (onNotificationClick && remoteMessage?.data) {
          onNotificationClick(remoteMessage.data);
        }
      });
    }

    // 4. Notification Opened from Quit State (App was closed)
    if (typeof messagingInstance.getInitialNotification === 'function') {
      messagingInstance
        .getInitialNotification()
        .then((remoteMessage) => {
          if (remoteMessage) {
            console.log('[FCM] Notification opened from quit state:', remoteMessage);
            if (onNotificationClick && remoteMessage?.data) {
              onNotificationClick(remoteMessage.data);
            }
          }
        })
        .catch((e) => console.log('[FCM] Initial notification error:', e));
    }

    return () => {
      if (typeof unsubscribeNotifee === 'function') unsubscribeNotifee();
      if (typeof unsubscribeForeground === 'function') unsubscribeForeground();
      if (typeof unsubscribeTokenRefresh === 'function') unsubscribeTokenRefresh();
      if (typeof unsubscribeNotificationOpened === 'function') unsubscribeNotificationOpened();
    };
  } catch (err) {
    console.warn('[FCM] Error setting up notification listeners:', err);
    return () => {};
  }
};
