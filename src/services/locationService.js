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
 * Validate latitude and longitude values
 */
export const isValidCoordinates = (lat, lng) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false; // Common default/uninitialized coordinates
  return true;
};

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
 * Request Location Permission across Android (12+ Fine/Coarse) and iOS
 */
export const requestDeviceLocationPermissions = async () => {
  try {
    if (Platform.OS === 'android') {
      const fineGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const coarseGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );

      if (fineGranted || coarseGranted) {
        return true;
      }

      const grantedResults = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const isFineOk =
        grantedResults[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED;
      const isCoarseOk =
        grantedResults[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED;

      return isFineOk || isCoarseOk;
    } else if (Platform.OS === 'ios') {
      if (typeof Geolocation.requestAuthorization === 'function') {
        Geolocation.requestAuthorization();
      }
      return true;
    }
    return true;
  } catch (err) {
    console.log('Permission request error:', err);
    return false;
  }
};

/**
 * Prompt user with an alert to turn on location/GPS or grant permission
 */
export const promptTurnOnLocationAlert = (reason = 'disabled', onRetry = null) => {
  if (reason === 'permission_denied') {
    Alert.alert(
      'Location Permission Required',
      'Please allow location access in your device settings so we can capture your temporary location.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  } else {
    Alert.alert(
      'Location Services Disabled',
      'Your device location (GPS) is turned off. Please turn on Location services to capture your live location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn On Location',
          onPress: () => {
            openDeviceLocationSettings();

            if (onRetry) {
              let subscription;
              const handleAppStateChange = async (nextAppState) => {
                if (nextAppState === 'active') {
                  if (subscription && typeof subscription.remove === 'function') {
                    subscription.remove();
                  } else if (typeof AppState.removeEventListener === 'function') {
                    AppState.removeEventListener('change', handleAppStateChange);
                  }
                  console.log('📍 [LOCATION SERVICE] App active. Retrying GPS acquisition...');
                  setTimeout(() => {
                    onRetry();
                  }, 1500);
                }
              };
              subscription = AppState.addEventListener('change', handleAppStateChange);
            }
          },
        },
      ]
    );
  }
};

/**
 * Fetch raw GPS coordinates from device (tries High Accuracy first, then Network fallback)
 */
export const getCurrentDeviceLocation = async (showAlerts = true) => {
  const hasPermission = await requestDeviceLocationPermissions();
  if (!hasPermission) {
    console.log('❌ [LOCATION SERVICE] Permission denied by user.');
    if (showAlerts) {
      promptTurnOnLocationAlert('permission_denied');
    }
    return null;
  }

  const getPosition = (highAccuracy, timeoutMs = 6000, maxAgeMs = 10000) =>
    new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          if (
            position &&
            position.coords &&
            isValidCoordinates(position.coords.latitude, position.coords.longitude)
          ) {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          } else {
            resolve(null);
          }
        },
        (err) => {
          console.log(`⚠️ Geolocation getCurrentPosition (highAccuracy=${highAccuracy}) code ${err?.code}:`, err?.message || err);
          resolve({ error: err });
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: maxAgeMs,
        }
      );
    });

  // Attempt 1: High Accuracy GPS (6s timeout)
  let result = await getPosition(true, 6000, 10000);

  // Fallback if result has error or null
  if (!result || result.error || !isValidCoordinates(result.latitude, result.longitude)) {
    const lastErrCode = result?.error?.code;
    if (lastErrCode === 1) { // PERMISSION_DENIED
      if (showAlerts) promptTurnOnLocationAlert('permission_denied');
      return null;
    }

    console.log('📍 High Accuracy GPS timed out/failed, trying Network location accuracy fallback...');
    result = await getPosition(false, 15000, 30000);
  }

  if (result && isValidCoordinates(result.latitude, result.longitude)) {
    console.log(`✅ [GPS SUCCESS] Latitude: ${result.latitude}, Longitude: ${result.longitude}`);
    return {
      latitude: result.latitude,
      longitude: result.longitude,
    };
  }

  console.log('❌ [LOCATION SERVICE] GPS turned off or location acquisition timed out.');
  if (showAlerts) {
    promptTurnOnLocationAlert('disabled');
  }
  return null;
};

/**
 * Sync user location with backend MongoDB database
 */
export const syncUserLocationService = async (showAlertOnFailure = true) => {
  console.log('----------------------------------------------------');
  console.log('📍 [LOCATION SERVICE] Acquiring real device GPS coordinates...');
  console.log('----------------------------------------------------');

  try {
    const coords = await getCurrentDeviceLocation(showAlertOnFailure);
    if (coords && isValidCoordinates(coords.latitude, coords.longitude)) {
      const res = await apiClient.updateLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      console.log('✅ [DATABASE SUCCESS] Saved coordinates to MongoDB:', JSON.stringify(res, null, 2));
      return coords;
    }
    return null;
  } catch (err) {
    console.log('❌ [LOCATION SERVICE ERROR]:', err.message || err);
    if (showAlertOnFailure) {
      promptTurnOnLocationAlert('disabled');
    }
    return null;
  }
};

