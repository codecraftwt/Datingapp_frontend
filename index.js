if (__DEV__) {
  require('./ReactotronConfig');
}

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Register FCM background message handler (app in background or quit state)
try {
  const getMessagingModule = () => {
    if (typeof messaging === 'function') return messaging;
    try {
      const mod = require('@react-native-firebase/messaging');
      return mod.default || mod;
    } catch (e) {
      return null;
    }
  };

  const messagingFunc = getMessagingModule();
  if (typeof messagingFunc === 'function') {
    messagingFunc().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('[FCM Background] Message received in background / quit state:', remoteMessage);
      try {
        const notification = remoteMessage.notification || {};
        const data = remoteMessage.data || {};
        const title = notification.title || data.title || 'New Notification';
        const body = notification.body || data.body || '';

        const channelId = await notifee.createChannel({
          id: 'default_notification_channel_v2',
          name: 'High Priority Notifications',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
        });

        await notifee.displayNotification({
          id: data.notificationId || remoteMessage.messageId || `${Date.now()}`,
          title,
          body,
          data,
          android: {
            channelId,
            importance: AndroidImportance.HIGH,
            pressAction: { id: 'default' },
            showTimestamp: true,
          },
        });
      } catch (err) {
        console.log('[FCM Background] Error displaying notification:', err);
      }
    });
  }
} catch (e) {
  console.warn('[FCM Background] Error registering background handler:', e);
}

AppRegistry.registerComponent(appName, () => App);
