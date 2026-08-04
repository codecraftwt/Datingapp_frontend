import messaging, { AuthorizationStatus } from '@react-native-firebase/messaging';
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
 * Safely get messaging instance if native module is compiled and linked
 */
const getMessagingInstance = () => {
  try {
    if (typeof messaging === 'function') {
      const instance = messaging();
      if (instance && typeof instance.requestPermission === 'function') {
        return instance;
      }
    }
  } catch (err) {
    console.warn('[FCM] Firebase messaging native module not compiled into APK yet:', err.message);
  }
  return null;
};

/**
 * Request notification permissions on Android (13+) & iOS
 */
export const requestNotificationPermission = async () => {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('[FCM] Android 13+ Notification permission denied.');
        return false;
      }
    }

    await notifee.requestPermission();

    const messagingInstance = getMessagingInstance();
    if (!messagingInstance || typeof messagingInstance.requestPermission !== 'function') {
      console.warn('[FCM] Notifee permissions granted; Firebase Messaging native instance deferred.');
      return true;
    }

    const authStatus = await messagingInstance.requestPermission();
    const authorizedVal = AuthorizationStatus?.AUTHORIZED ?? 1;
    const provisionalVal = AuthorizationStatus?.PROVISIONAL ?? 2;

    const enabled = authStatus === authorizedVal || authStatus === provisionalVal;
    if (enabled) {
      console.log('[FCM] Notification permission status:', authStatus);
    }
    return true;
  } catch (error) {
    console.warn('[FCM] Error requesting notification permission:', error?.message || error);
    return true;
  }
};

/**
 * Fetch and register FCM Token with Backend
 */
export const registerFcmToken = async () => {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    const messagingInstance = getMessagingInstance();
    if (!messagingInstance || typeof messagingInstance.getToken !== 'function') return;

    const fcmToken = await messagingInstance.getToken();
    if (fcmToken) {
      console.log('[FCM] Device FCM Token:', fcmToken);
      await apiClient.updateFcmToken(fcmToken);
      console.log('[FCM] Token successfully registered with backend.');
    }
  } catch (error) {
    console.warn('[FCM] Error registering FCM Token:', error?.message || error);
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
      if (remoteMessage.notification) {
        const { title, body } = remoteMessage.notification;
        // Display system notification banner using Notifee
        await displayLocalSystemNotification({
          title: title || 'New Notification',
          body: body || '',
          data: remoteMessage.data || {},
        });
      }
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
