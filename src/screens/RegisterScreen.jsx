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
import { openDeviceLocationSettings, getCurrentDeviceLocation } from '../services/locationService';
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { SimulatedGradientBackground } from '../components/SimulatedGradientBackground';

export const RegisterScreen = ({ onNavigate, onGoBack }) => {
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
  const [sameAsPermanent, setSameAsPermanent] = useState(false);

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
      const coords = await getCurrentDeviceLocation(true);
      if (coords) {
        setTempLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        Alert.alert('Success', 'Current live location fetched as Temporary Address!');
      }
    } catch (err) {
      console.log('Fetch GPS location exception:', err);
      Alert.alert('Error', 'Unable to fetch current location.');
    } finally {
      setFetchingGPS(false);
    }
  };

  const handleRegister = async () => {
    const cleanPassword = password ? password.trim() : '';
    const cleanConfirmPassword = confirmPassword ? confirmPassword.trim() : '';

    if (!name.trim() || !email.trim() || !mobile.trim() || !cleanPassword || !cleanConfirmPassword) {
      Alert.alert('Required Fields', 'Please fill in all basic fields.');
      return;
    }

    if (!sameAsPermanent && (!selectedCountry?.name || !selectedState?.name || !district.trim() || (!selectedCity?.name && !district.trim()))) {
      Alert.alert('Address Mandatory', 'Please select Country, State, District, and City for your permanent address or check "Keep permanent address as current address".');
      return;
    }

    if (sameAsPermanent && !tempLocation) {
      Alert.alert('Live Location Required', 'Please fetch your current live location first, or uncheck "Keep permanent address as current address".');
      return;
    }

    if (cleanPassword !== cleanConfirmPassword) {
      Alert.alert('Password Mismatch', 'Password and Confirm Password do not match. Please verify both fields.');
      return;
    }

    if (cleanPassword.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    // Determine Lat & Lng coordinates
    let lat, lng;
    let finalCountry = selectedCountry?.name || 'India';
    let finalState = selectedState?.name || 'Maharashtra';
    let finalDistrict = district.trim() || 'Live GPS';
    let finalCity = selectedCity?.name || finalDistrict;

    if (sameAsPermanent && tempLocation) {
      lat = tempLocation.latitude;
      lng = tempLocation.longitude;
    } else {
      lat = parseFloat(selectedCity?.latitude || selectedState?.latitude || '18.5204');
      lng = parseFloat(selectedCity?.longitude || selectedState?.longitude || '73.8567');
      if (isNaN(lat) || isNaN(lng)) {
        lat = 18.5204;
        lng = 73.8567;
      }
    }

    try {
      setLoading(true);
      await apiClient.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        password: cleanPassword,
        confirmPassword: cleanConfirmPassword,
        gender,
        country: finalCountry,
        state: finalState,
        district: finalDistrict,
        city: finalCity,
        latitude: lat,
        longitude: lng,
        tempLatitude: tempLocation ? tempLocation.latitude : (sameAsPermanent ? lat : null),
        tempLongitude: tempLocation ? tempLocation.longitude : (sameAsPermanent ? lng : null),
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
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (onGoBack && onGoBack()) return;
                if (onNavigate) onNavigate('LOGIN');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonIcon}>←</Text>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>

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
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              value={password}
              onChangeText={setPassword}
            />

            <CustomInput
              label="Confirm Password"
              iconType="password"
              placeholder="Re-enter password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            {confirmPassword.length > 0 && (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  marginTop: -8,
                  marginBottom: 14,
                  marginLeft: 6,
                  color: password.trim() === confirmPassword.trim() ? '#4CAF50' : '#FF5252',
                }}
              >
                {password.trim() === confirmPassword.trim() ? '✅ Passwords match' : '❌ Passwords do not match'}
              </Text>
            )}

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
                onPress={() => {
                  setTempLocation(null);
                  setSameAsPermanent(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.removeGpsText}>✕ Remove Temporary Address</Text>
              </TouchableOpacity>
            )}

            {/* Checkbox: Keep permanent address as current address */}
            <TouchableOpacity
              style={styles.sameAddressCheckboxRow}
              onPress={() => setSameAsPermanent(!sameAsPermanent)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkboxSquare, sameAsPermanent && styles.checkboxSquareChecked]}>
                {sameAsPermanent && <Text style={styles.checkmarkIcon}>✓</Text>}
              </View>
              <Text style={styles.sameAddressCheckboxLabel}>
                Keep permanent address as current address.
              </Text>
            </TouchableOpacity>

            {sameAsPermanent ? (
              <View style={styles.autoAddressBanner}>
                <Text style={styles.autoAddressBannerText}>
                  ✅ Permanent address will be saved identical to your Current Live Location!
                </Text>
              </View>
            ) : (
              <>
                {/* OR Separator */}
                <View style={styles.orDividerContainer}>
                  <View style={styles.orDividerLine} />
                  <Text style={styles.orDividerText}>OR</Text>
                  <View style={styles.orDividerLine} />
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
              </>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardContainer}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentFull}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Select {modalType === 'country' ? 'Country' : modalType === 'state' ? 'State' : 'City / Taluka'}
                </Text>
                <TouchableOpacity onPress={() => setModalType(null)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.searchBarWrapper}>
                <Text style={styles.searchBarIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInputField}
                  placeholder={`Type keywords to filter ${modalType === 'country' ? 'country' : modalType === 'state' ? 'state' : 'city'}...`}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus={true}
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filteredModalData}
                keyExtractor={(item, index) => item.isoCode || item.name + index}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                style={styles.modalFlatList}
                contentContainerStyle={{ paddingBottom: 30 }}
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
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalListItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyEmoji}>🔍</Text>
                    <Text style={styles.emptyText}>
                      No {modalType} found matching "{searchQuery}"
                    </Text>
                  </View>
                }
              />
            </View>
          </View>
        </KeyboardAvoidingView>
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
    paddingTop: 10,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: Platform.OS === 'ios' ? 40 : 15,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  backButtonIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 6,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    color: '#FFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  sameAddressCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxSquareChecked: {
    backgroundColor: '#FE3C72',
    borderColor: '#FE3C72',
  },
  checkmarkIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sameAddressCheckboxLabel: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
    flex: 1,
  },
  autoAddressBanner: {
    backgroundColor: 'rgba(76, 175, 80, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  autoAddressBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  orDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  orDividerText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '800',
    marginHorizontal: 12,
    letterSpacing: 1,
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
  modalKeyboardContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContentFull: {
    backgroundColor: '#1E1E2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '88%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 15,
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
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  searchBarIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInputField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    height: '100%',
    paddingVertical: 0,
  },
  modalFlatList: {
    flex: 1,
  },
  modalListItem: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalListItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default RegisterScreen;
