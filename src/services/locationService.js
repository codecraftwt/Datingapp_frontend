import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { apiClient } from '../api/apiClient';

/**
 * Fetch approximate location coordinates using public IP geolocation services
 */
export const fetchLocationByIP = async () => {
  try {
    console.log('🌐 [IP GEOLOCATION] Attempting IP-based Geolocation fallback via ipapi.co...');
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const data = await response.json();
      console.log('🌐 [IP GEOLOCATION RESPONSE ipapi.co]:', JSON.stringify(data, null, 2));
      if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        console.log(`✅ [IP GEO SUCCESS] Latitude: ${data.latitude}, Longitude: ${data.longitude} (${data.city || 'Unknown'}, ${data.country_name || ''})`);
        return { latitude: data.latitude, longitude: data.longitude, city: data.city };
      }
    }
  } catch (err) {
    console.log('⚠️ [IP GEO STEP 1 FAILED] ipapi.co error:', err.message || err);
  }

  try {
    console.log('🌐 [IP GEOLOCATION] Trying secondary IP Geolocation fallback via ip-api.com...');
    const response2 = await fetch('http://ip-api.com/json/', { method: 'GET' });
    if (response2.ok) {
      const data2 = await response2.json();
      console.log('🌐 [IP GEOLOCATION RESPONSE ip-api.com]:', JSON.stringify(data2, null, 2));
      if (data2 && data2.status === 'success' && typeof data2.lat === 'number' && typeof data2.lon === 'number') {
        console.log(`✅ [IP GEO SUCCESS] Latitude: ${data2.lat}, Longitude: ${data2.lon} (${data2.city || ''})`);
        return { latitude: data2.lat, longitude: data2.lon, city: data2.city };
      }
    }
  } catch (err2) {
    console.log('❌ [IP GEO STEP 2 FAILED] ip-api.com error:', err2.message || err2);
  }

  return null;
};

/**
 * Main Location Service method to acquire user coordinates (Hardware GPS with IP Fallback)
 * and sync them to backend database.
 */
export const syncUserLocationService = async () => {
  console.log('----------------------------------------------------');
  console.log('📍 [LOCATION SERVICE] Starting user location acquisition...');
  console.log('----------------------------------------------------');
  let coords = null;

  try {
    let hasPermission = false;
    if (Platform.OS === 'android') {
      console.log('📍 [GPS STEP 1] Requesting Android FINE_LOCATION permission...');
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission Required',
          message: 'Please allow location access so we can suggest nearby profiles around you.',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );
      console.log('📍 [GPS STEP 2] PermissionsAndroid result:', granted);
      hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      hasPermission = true;
    }

    if (hasPermission) {
      try {
        console.log('📍 [GPS STEP 3] Calling Geolocation.getCurrentPosition()...');
        coords = await new Promise((resolve) => {
          Geolocation.getCurrentPosition(
            (position) => {
              console.log('✅ [GEOLOCATION API SUCCESS] Received Position Object:');
              console.log('    Latitude:', position.coords.latitude);
              console.log('    Longitude:', position.coords.longitude);
              console.log('    Accuracy:', position.coords.accuracy, 'meters');
              console.log('    Altitude:', position.coords.altitude);
              console.log('    Heading:', position.coords.heading);
              console.log('    Speed:', position.coords.speed);
              console.log('    Timestamp:', position.timestamp);
              console.log('    Full Raw Position Object:', JSON.stringify(position, null, 2));

              resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
            },
            (error) => {
              console.log('❌ [GEOLOCATION API ERROR] getCurrentPosition failed:');
              console.log('    Error Code:', error.code, '(1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT)');
              console.log('    Error Message:', error.message);
              console.log('    Full Error Object:', JSON.stringify(error, null, 2));
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
          );
        });
      } catch (gpsErr) {
        console.log('⚠️ [GEOLOCATION API EXCEPTION] Exception calling getCurrentPosition:', gpsErr.message || gpsErr);
      }
    } else {
      console.log('ℹ️ [GPS STEP 3] Permission denied by user.');
    }

    // Fallback to IP Geolocation if hardware GPS is undefined, timed out, or unpermitted
    if (!coords) {
      console.log('🔄 [FALLBACK] Hardware GPS did not return coordinates. Triggering IP Geolocation...');
      coords = await fetchLocationByIP();
    }

    if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
      console.log(`📍 [LOCATION SERVICE] Final coordinates to send to backend: [Lat: ${coords.latitude}, Lng: ${coords.longitude}]`);
      const res = await apiClient.updateLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      console.log('✅ [LOCATION SERVICE] Server response:', JSON.stringify(res, null, 2));
      return coords;
    } else {
      console.log('⚠️ [LOCATION SERVICE] Could not acquire valid coordinates from GPS or IP.');
      return null;
    }
  } catch (err) {
    console.log('❌ [LOCATION SERVICE ERROR] Exception in syncUserLocationService:', err.message || err);
    return null;
  }
};
