import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  TextInput,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { Country, State, City } from 'country-state-city';
import { apiClient } from '../api/apiClient';
import { openDeviceLocationSettings } from '../services/locationService';
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { SimulatedGradientBackground } from '../components/SimulatedGradientBackground';

export const RegisterScreen = ({ onNavigate }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState('Male');

  // Mandatory Permanent Address Location States
  // Default country: India (IN)
  const defaultCountry = useMemo(() => {
    const india = Country.getCountryByCode('IN');
    return india || { name: 'India', isoCode: 'IN' };
  }, []);

  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const [selectedState, setSelectedState] = useState(null);
  const [district, setDistrict] = useState('');
  const [selectedCity, setSelectedCity] = useState(null);

  // Optional Temporary Address / Current Location State
  const [tempLocation, setTempLocation] = useState(null); // { latitude, longitude } | null
  const [fetchingGPS, setFetchingGPS] = useState(false);

  // Modal selector state
  const [modalType, setModalType] = useState(null); // 'country' | 'state' | 'city' | null
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Data lists from country-state-city
  const countriesList = useMemo(() => Country.getAllCountries(), []);

  const statesList = useMemo(() => {
    if (!selectedCountry?.isoCode) return [];
    return State.getStatesOfCountry(selectedCountry.isoCode);
  }, [selectedCountry]);

  const citiesList = useMemo(() => {
    if (!selectedCountry?.isoCode || !selectedState?.isoCode) return [];
    return City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode);
  }, [selectedCountry, selectedState]);

  // Filtered list based on search modal
  const filteredModalData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (modalType === 'country') {
      return countriesList.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (modalType === 'state') {
      return statesList.filter((s) => s.name.toLowerCase().includes(q));
    }
    if (modalType === 'city') {
      return citiesList.filter((ci) => ci.name.toLowerCase().includes(q));
    }
    return [];
  }, [modalType, searchQuery, countriesList, statesList, citiesList]);

  const handleFetchCurrentLocation = async () => {
    try {
      setFetchingGPS(true);
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Please allow location permission to fetch your current live location.',
            buttonPositive: 'Allow',
            buttonNegative: 'Cancel',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission Denied',
            'Location permission is required to fetch current location.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          setFetchingGPS(false);
          return;
        }
      }

      Geolocation.getCurrentPosition(
        (pos) => {
          if (pos?.coords) {
            setTempLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
            Alert.alert('Success', 'Current live location fetched as Temporary Address!');
          } else {
            Alert.alert('Error', 'Unable to fetch GPS coordinates.');
          }
          setFetchingGPS(false);
        },
        (err) => {
          console.log('GPS Fetch Error:', err);
          Alert.alert(
            'Location Services Disabled',
            'Your device Location (GPS) is turned off. Please turn on Location services in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Turn On Location', onPress: () => openDeviceLocationSettings() },
            ]
          );
          setFetchingGPS(false);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 10000 }
      );
    } catch (err) {
      console.log('Fetch GPS location exception:', err);
      setFetchingGPS(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !mobile.trim() || !password || !confirmPassword) {
      Alert.alert('Required Fields', 'Please fill in all basic fields.');
      return;
    }

    if (!selectedCountry?.name || !selectedState?.name || !district.trim() || (!selectedCity?.name && !district.trim())) {
      Alert.alert('Address Mandatory', 'Please select Country, State, District, and City for your permanent address.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Password and Confirm Password do not match.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    // Extract Lat & Lng from selected City or State (country-state-city built-in coordinates)
    let lat = parseFloat(selectedCity?.latitude || selectedState?.latitude || '18.5204');
    let lng = parseFloat(selectedCity?.longitude || selectedState?.longitude || '73.8567');

    if (isNaN(lat) || isNaN(lng)) {
      lat = 18.5204;
      lng = 73.8567;
    }

    const cityName = selectedCity?.name || district.trim();

    try {
      setLoading(true);
      await apiClient.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        password,
        confirmPassword,
        gender,
        country: selectedCountry.name,
        state: selectedState.name,
        district: district.trim(),
        city: cityName,
        latitude: lat,
        longitude: lng,
        tempLatitude: tempLocation ? tempLocation.latitude : null,
        tempLongitude: tempLocation ? tempLocation.longitude : null,
      });

      Alert.alert(
        'Registration Successful',
        'Your account has been created successfully with permanent location! Please log in to continue.',
        [
          {
            text: 'Log In',
            onPress: () => {
              if (onNavigate) onNavigate('LOGIN');
            },
          },
        ]
      );
      if (onNavigate) {
        onNavigate('LOGIN');
      }
    } catch (err) {
      console.log('Register error:', err);
      const msg = err.data?.message || err.message || 'Failed to create account. Please try again.';
      Alert.alert('Registration Failed', msg);
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
              <Text style={styles.logoHeart}>✨</Text>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Spark and discover awesome matches</Text>
          </View>

          <View style={styles.card}>
            <CustomInput
              label="Full Name"
              iconType="user"
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
            />

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
              label="Mobile Number"
              iconType="phone"
              placeholder="Enter 10-digit mobile number"
              keyboardType="phone-pad"
              value={mobile}
              onChangeText={setMobile}
            />

            <CustomInput
              label="Password (min 8 chars)"
              iconType="password"
              placeholder="Create password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <CustomInput
              label="Confirm Password"
              iconType="password"
              placeholder="Re-enter password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            {/* Gender Selection */}
            <View style={styles.genderContainer}>
              <Text style={styles.genderLabel}>Gender</Text>
              <View style={styles.genderOptions}>
                {['Male', 'Female', 'Non-binary'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.genderChip,
                      gender === option && styles.genderChipSelected,
                    ]}
                    onPress={() => setGender(option)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.genderChipText,
                        gender === option && styles.genderChipTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Permanent Address Inputs (Mandatory) */}
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>📍 Permanent Address (Mandatory)</Text>
            </View>

            {/* Country Selector */}
            <Text style={styles.pickerLabel}>Country *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => {
                setModalType('country');
                setSearchQuery('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.pickerButtonText}>
                {selectedCountry ? `🌐 ${selectedCountry.name}` : 'Select Country'}
              </Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </TouchableOpacity>

            {/* State Selector */}
            <Text style={styles.pickerLabel}>State *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => {
                if (!selectedCountry) {
                  Alert.alert('Select Country', 'Please select a country first.');
                  return;
                }
                setModalType('state');
                setSearchQuery('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.pickerButtonText}>
                {selectedState ? `🏛️ ${selectedState.name}` : 'Select State'}
              </Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </TouchableOpacity>

            {/* District Input */}
            <CustomInput
              label="District *"
              iconType="user"
              placeholder="e.g. Kolhapur"
              value={district}
              onChangeText={setDistrict}
            />

            {/* City Selector */}
            <Text style={styles.pickerLabel}>City / Taluka *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => {
                if (!selectedState) {
                  Alert.alert('Select State', 'Please select a state first.');
                  return;
                }
                setModalType('city');
                setSearchQuery('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.pickerButtonText}>
                {selectedCity ? `🏙️ ${selectedCity.name}` : 'Select City / Taluka'}
              </Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </TouchableOpacity>

            {/* Temporary Address / Current Location (Optional) */}
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>🎯 Temporary Address (Optional)</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.gpsButton,
                tempLocation && styles.gpsButtonSuccess,
              ]}
              onPress={handleFetchCurrentLocation}
              disabled={fetchingGPS}
              activeOpacity={0.8}
            >
              <Text style={styles.gpsButtonText}>
                {fetchingGPS
                  ? '⏳ Fetching Current GPS Location...'
                  : tempLocation
                  ? `✅ Live Location Captured (${tempLocation.latitude.toFixed(4)}, ${tempLocation.longitude.toFixed(4)})`
                  : '📍 Fetch Current Live Location'}
              </Text>
            </TouchableOpacity>

            {tempLocation && (
              <TouchableOpacity
                style={styles.removeGpsBtn}
                onPress={() => setTempLocation(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.removeGpsText}>✕ Remove Temporary Address</Text>
              </TouchableOpacity>
            )}

            <CustomButton
              title="SIGN UP"
              variant="primary"
              loading={loading}
              onPress={handleRegister}
              style={styles.registerBtn}
            />
          </View>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity
              onPress={() => onNavigate && onNavigate('LOGIN')}
              activeOpacity={0.7}
            >
              <Text style={styles.loginLinkText}> Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal for Country / State / City Selection */}
      <Modal
        visible={modalType !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalType(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {modalType === 'country' ? 'Country' : modalType === 'state' ? 'State' : 'City / Taluka'}
              </Text>
              <TouchableOpacity onPress={() => setModalType(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${modalType}...`}
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <FlatList
              data={filteredModalData}
              keyExtractor={(item, index) => item.isoCode || item.name + index}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalListItem}
                  onPress={() => {
                    if (modalType === 'country') {
                      setSelectedCountry(item);
                      setSelectedState(null);
                      setSelectedCity(null);
                    } else if (modalType === 'state') {
                      setSelectedState(item);
                      setSelectedCity(null);
                    } else if (modalType === 'city') {
                      setSelectedCity(item);
                    }
                    setModalType(null);
                  }}
                >
                  <Text style={styles.modalListItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No results found</Text>
              }
            />
          </View>
        </View>
      </Modal>
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
    paddingTop: 30,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  logoHeart: {
    fontSize: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 20,
  },
  genderContainer: {
    marginBottom: 14,
  },
  genderLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
    opacity: 0.9,
  },
  genderOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderChip: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  genderChipSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  genderChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  genderChipTextSelected: {
    color: '#FE3C72',
    fontWeight: '700',
  },
  sectionDivider: {
    marginTop: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
    paddingBottom: 6,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  pickerLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 6,
    marginLeft: 4,
    opacity: 0.9,
  },
  pickerButton: {
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  pickerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  pickerChevron: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  gpsButton: {
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderStyle: 'dashed',
  },
  gpsButtonSuccess: {
    backgroundColor: 'rgba(76, 175, 80, 0.25)',
    borderColor: '#4CAF50',
    borderStyle: 'solid',
  },
  gpsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  removeGpsBtn: {
    alignSelf: 'center',
    marginBottom: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  removeGpsText: {
    color: '#FF5252',
    fontSize: 13,
    fontWeight: '600',
  },
  registerBtn: {
    marginTop: 16,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 15,
  },
  loginLinkText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 14,
  },
  modalListItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalListItemText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 15,
  },
});

export default RegisterScreen;
