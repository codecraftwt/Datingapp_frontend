import { Platform, PermissionsAndroid, Alert, Linking, AppState } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { apiClient } from '../api/apiClient';

// Configure Geolocation provider settings
try {
  Geolocation.setRNConfiguration({
    skipPermissionRequests: false,
    authorizationLevel: 'whenInUse',
    locationProvider: 'auto',
  });
} catch (configErr) {
  console.log('Geolocation configuration note:', configErr);
}

/**
 * Open Device Location Settings to allow user to turn on GPS
 */
export const openDeviceLocationSettings = () => {
  if (Platform.OS === 'android') {
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
      Linking.openSettings();
    });
  } else {
    Linking.openSettings();
  }
};

/**
 * Prompt user with an alert to turn on location/GPS
 * and attach an AppState listener to automatically retry fetching and saving real coordinates
 * as soon as the user turns on Location in settings and returns to the app.
 */
const promptTurnOnLocationAlert = (reason = 'disabled') => {
  if (reason === 'permission_denied') {
    Alert.alert(
      'Location Permission Required',
      'Please allow location access so we can show you nearby profiles around you.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  } else {
    Alert.alert(
      'Location Services Disabled',
      'Your device location (GPS) is turned off. Please turn on Location services to find matches around you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn On Location',
          onPress: () => {
            openDeviceLocationSettings();

            // Set up listener: when user turns Location ON and returns to app,
            // immediately fetch real GPS coordinates and save to MongoDB via API!
            let subscription;
            const handleAppStateChange = async (nextAppState) => {
              if (nextAppState === 'active') {
                if (subscription && typeof subscription.remove === 'function') {
                  subscription.remove();
                } else {
                  AppState.removeEventListener('change', handleAppStateChange);
                }
                console.log('📍 [LOCATION SERVICE] App returned to active. Retrying real GPS acquisition...');
                setTimeout(async () => {
                  await syncUserLocationService(false);
                }, 1500);
              }
            };

            subscription = AppState.addEventListener('change', handleAppStateChange);
          },
        },
      ]
    );
  }
};

/**
 * Main Location Service method: acquires real device GPS coordinates ONLY
 * and syncs them to backend database. If location is turned off or denied,
 * prompts an Alert for the user to turn on location settings.
 */
export const syncUserLocationService = async (showAlertOnFailure = true) => {
  console.log('----------------------------------------------------');
  console.log('📍 [LOCATION SERVICE] Acquiring real device GPS coordinates...');
  console.log('----------------------------------------------------');

  try {
    let hasPermission = false;
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission Required',
          message: 'Please allow location access so we can suggest nearby profiles around you.',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );
      hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      hasPermission = true;
    }

    if (!hasPermission) {
      console.log('❌ [LOCATION SERVICE] Permission denied by user.');
      if (showAlertOnFailure) {
        promptTurnOnLocationAlert('permission_denied');
      }
      return null;
    }

    // Try high accuracy GPS first, fallback to standard/network accuracy
    const getPosition = (highAccuracy, timeoutMs = 4000) =>
      new Promise((resolve) => {
        Geolocation.getCurrentPosition(
          (position) => {
            if (position && position.coords && typeof position.coords.latitude === 'number' && typeof position.coords.longitude === 'number') {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            } else {
              resolve(null);
            }
          },
          (err) => {
            console.log(`⚠️ Geolocation getCurrentPosition (highAccuracy=${highAccuracy}) failed:`, err?.message || err);
            resolve(null);
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: timeoutMs,
            maximumAge: 5000,
          }
        );
      });

    let coords = await getPosition(true, 4000);
    if (!coords) {
      console.log('📍 High accuracy GPS timed out/failed, trying standard/network accuracy...');
      coords = await getPosition(false, 3000);
    }

    if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
      console.log(`✅ [REAL DEVICE GPS SUCCESS] Latitude: ${coords.latitude}, Longitude: ${coords.longitude}`);
      
      // Update location via backend API
      const res = await apiClient.updateLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      console.log('✅ [DATABASE SUCCESS] Saved real device coordinates to MongoDB:', JSON.stringify(res, null, 2));
      return coords;
    } else {
      console.log('❌ [LOCATION SERVICE] Device GPS is turned OFF or unavailable.');
      if (showAlertOnFailure) {
        promptTurnOnLocationAlert('disabled');
      }
      return null;
    }
  } catch (err) {
    console.log('❌ [LOCATION SERVICE ERROR]:', err.message || err);
    if (showAlertOnFailure) {
      promptTurnOnLocationAlert('disabled');
    }
    return null;
  }
};
