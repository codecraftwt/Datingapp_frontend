import React, { useState, useEffect } from 'react';
// Profile Screen component - updated with Hide & Unhide Media support
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
  PermissionsAndroid,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../api/apiClient';
import { getImageUrl, getVideoThumbnailUrl, isVideoUrl } from '../api/config';
import { QuestionnaireScreen } from './QuestionnaireScreen';
import { PreviewModal } from '../components/PreviewModal';
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { registerFcmToken } from '../services/notificationService';
import Video from 'react-native-video';

const { width } = Dimensions.get('window');

const SUBSCRIPTION_PLANS = [
  {
    id: 'gold',
    name: 'Spark Gold ⭐',
    badge: 'MOST POPULAR',
    price: '$14.99/mo',
    features: [
      '⚡ Unlimited Likes & Swipes',
      '👀 See Who Liked You First',
      '🚀 1 Free Boost per Month',
      '⭐ 5 Free Super Likes a Week',
      '🔄 Unlimited Rewinds',
    ],
    accentColor: '#FFD700',
  },
  {
    id: 'platinum',
    name: 'Spark Platinum 👑',
    badge: 'VIP ACCESS',
    price: '$24.99/mo',
    features: [
      '👑 Priority Likes in Match Queue',
      '💬 Message Before Matching',
      '🌐 Passport to Any Location',
      '⚡ All Spark Gold Features Included',
    ],
    accentColor: '#E5E4E2',
  },
];

export const Profile = ({ userProfile, onUpdateProfile, onLogout, onRemoveProfile, onGoBack, onBack }) => {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(userProfile || null);
  const [loading, setLoading] = useState(false);
  const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
  const [questionnaireModalStep, setQuestionnaireModalStep] = useState(6);
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [activeHiddenStoryIndex, setActiveHiddenStoryIndex] = useState(null);
  const [fetchedHiddenMediaList, setFetchedHiddenMediaList] = useState([]);
  const [activePlan, setActivePlan] = useState('free');

  const openGalleryModal = (stepNum = 6) => {
    setQuestionnaireModalStep(stepNum);
    setIsQuestionnaireModalOpen(true);
  };

  const handleFetchAndShowHiddenMedia = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getHiddenProfileMedia();
      const list = res.hiddenMedia || res.data?.hiddenMedia || [];
      if (!list || list.length === 0) {
        Alert.alert('No Hidden Media 🙈', 'You do not have any hidden photos or videos.');
        return;
      }
      setFetchedHiddenMediaList(list);
      setActiveHiddenStoryIndex(0);
    } catch (err) {
      console.log('Error fetching hidden media:', err);
      Alert.alert('Error', 'Failed to fetch hidden media list.');
    } finally {
      setLoading(false);
    }
  };

  // Change / Reset Password state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  // Fetch real profile data directly from Backend API
  const fetchProfileFromBackend = async () => {
    try {
      setLoading(true);
      if (typeof apiClient.resetResolvedUrl === 'function') {
        apiClient.resetResolvedUrl();
      }
      const res = await apiClient.getProfile();
      const userData = res.user || res.data?.user || res;
      if (userData && typeof userData === 'object' && userData.firstName) {
        setProfile((prev) => ({
          ...(prev || {}),
          ...userData,
        }));
        if (onUpdateProfile) {
          onUpdateProfile(userData);
        }
      }
    } catch (err) {
      console.log('Error fetching user profile from API:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePullToRefresh = () => {
    setRefreshing(true);
    if (typeof apiClient.resetResolvedUrl === 'function') {
      apiClient.resetResolvedUrl();
    }
    fetchProfileFromBackend();
  };

  useEffect(() => {
    fetchProfileFromBackend();
  }, []);

  useEffect(() => {
    if (userProfile && typeof userProfile === 'object') {
      setProfile((prev) => ({
        ...userProfile,
        ...(prev || {}),
      }));
    }
  }, [userProfile]);

  const handleFinishEditQuestionnaire = async (updatedData) => {
    setProfile(updatedData);
    if (onUpdateProfile) {
      onUpdateProfile(updatedData);
    }
    setIsQuestionnaireModalOpen(false);
    await fetchProfileFromBackend();
    Alert.alert(
      'Diagnostic 5: Profile Refreshed',
      `Profile save complete!\nSaved profileImages: ${updatedData?.profileImages?.length || 0}\nSaved videos: ${updatedData?.videos?.length || 0}\n\nYour profile media gallery is updated!`
    );
  };

  const handleChangePasswordSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Required Fields', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Password Mismatch', 'New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Weak Password', 'New password must be at least 8 characters long.');
      return;
    }

    try {
      setPasswordLoading(true);
      await apiClient.changePassword({ oldPassword: currentPassword, currentPassword, newPassword });
      Alert.alert('Password Changed', 'Your password has been changed successfully.');
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      console.log('Error changing password:', err);
      const msg = err.data?.message || err.message || 'Failed to change password. Please check your current password.';
      Alert.alert('Password Change Failed', msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogoutAllDevices = () => {
    Alert.alert(
      'Logout From All Devices',
      'Are you sure you want to log out from all active sessions? You will be signed out on all devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout All Devices',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.logoutAllDevices();
              Alert.alert('Logged Out', 'Successfully logged out from all devices.');
              if (onLogout) {
                onLogout();
              }
            } catch (err) {
              console.log('Error logging out all devices:', err);
              Alert.alert('Logout Error', 'Failed to log out from all devices.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account Permanently',
      'Are you sure you want to delete your account? All your matches, chat history, and profile data will be permanently removed. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.deleteAccount();
              Alert.alert('Account Deleted', 'Your account has been deleted permanently.');
              if (onLogout) {
                onLogout();
              }
            } catch (err) {
              console.log('Error deleting account:', err);
              const msg = err.data?.message || err.message || 'Failed to delete account.';
              Alert.alert('Delete Failed', msg);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const processSelectedPhotoAsset = async (asset) => {
    if (!asset || !asset.uri) return;
    const localUri = asset.uri;
    const isVideo = asset.type?.startsWith('video/') || (asset.fileName && (asset.fileName.endsWith('.mp4') || asset.fileName.endsWith('.mov')));

    // Slot #1 (Main Profile Picture) must be a photo ONLY
    if (isVideo) {
      Alert.alert('Main Profile Picture', 'Your main profile picture (Slot #1) must be a photo.');
      return;
    }

    try {
      setLoading(true);

      // Upload image to Cloudinary via Backend API
      let finalPhotoUrl = localUri;
      try {
        const formData = new FormData();
        const ext = 'jpg';
        const mime = asset.type || 'image/jpeg';
        const safeName = asset.fileName ? asset.fileName.replace(/[^a-zA-Z0-9._-]/g, '_') : `photo_${Date.now()}.${ext}`;

        formData.append('photo', {
          uri: Platform.OS === 'android' ? localUri : localUri.replace('file://', ''),
          type: mime,
          name: safeName,
        });

        const uploadRes = await apiClient.uploadMainPhoto(formData);
        const cloudinaryUrl = uploadRes.profileImage || uploadRes.url || uploadRes.data?.url || uploadRes.secure_url;
        if (cloudinaryUrl) {
          finalPhotoUrl = cloudinaryUrl;
        }
      } catch (uploadErr) {
        console.log('Cloudinary upload error:', uploadErr);
        const errorMsg =
          uploadErr?.data?.message ||
          uploadErr?.message ||
          'Failed to upload photo to server. Please try again.';

        Alert.alert('Upload Error', errorMsg);
        setLoading(false);
        return;
      }

      const updatedPhotos = [...rawPhotosList];
      if (updatedPhotos.length > 0) {
        updatedPhotos[0] = finalPhotoUrl;
      } else {
        updatedPhotos.push(finalPhotoUrl);
      }

      const updatedProfile = {
        ...displayData,
        profileImage: finalPhotoUrl,
        profileImages: updatedPhotos,
        photos: updatedPhotos,
      };

      setProfile(updatedProfile);
      if (onUpdateProfile) {
        onUpdateProfile(updatedProfile);
      }

      Alert.alert('Photo Uploaded 📸', 'Your main profile photo has been updated successfully!');
    } catch (err) {
      console.log('Error saving new profile media:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestAndroidCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const isAlreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (isAlreadyGranted) return true;

        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission Required',
            message: 'Spark Dating App needs access to your camera so you can take a profile photo.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return (
          granted === PermissionsAndroid.RESULTS.GRANTED ||
          granted === true ||
          granted === 'granted'
        );
      } catch (err) {
        console.warn('Camera permission request error:', err);
        return true; // Fallback to let launchCamera handle native prompt
      }
    }
    return true;
  };

  const openCameraPicker = async () => {
    try {
      const hasPermission = await requestAndroidCameraPermission();
      if (!hasPermission) {
        console.log('Camera permission check returned false, attempting launchCamera fallback...');
      }
    } catch (e) {
      console.log('Camera permission check exception:', e);
    }

    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
        saveToPhotos: false,
        cameraType: 'front',
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          console.warn('Camera launch response error:', response.errorCode, response.errorMessage);
          if (response.errorCode === 'permission') {
            Alert.alert(
              'Camera Permission Needed 📷',
              'Please grant camera permission in your phone settings (Settings > Apps > Dating App > Permissions > Camera) to take photos.'
            );
          } else {
            Alert.alert('Camera Error', response.errorMessage || 'Unable to open device camera.');
          }
          return;
        }
        if (response.assets && response.assets.length > 0) {
          processSelectedPhotoAsset(response.assets[0]);
        }
      }
    );
  };

  const openGalleryPicker = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Gallery Error', response.errorMessage || 'Failed to pick photo from gallery.');
          return;
        }
        if (response.assets && response.assets.length > 0) {
          processSelectedPhotoAsset(response.assets[0]);
        }
      }
    );
  };

  const handleChangeProfilePhoto = () => {
    Alert.alert(
      'Update Profile Photo 📷',
      'Choose how you would like to update your profile photo:',
      [
        {
          text: '📸 Take Photo (Camera)',
          onPress: openCameraPicker,
        },
        {
          text: '🖼️ Choose from Gallery',
          onPress: openGalleryPicker,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleRemoveProfilePhoto = () => {
    Alert.alert(
      'Remove Profile Photo',
      'Are you sure you want to remove your main profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Photo',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const photoToRemove = displayData.profileImage || rawPhotosList[0];

              const updatedProfileImages = Array.isArray(displayData.profileImages)
                ? [...displayData.profileImages]
                : [];
              if (updatedProfileImages.length > 0) {
                updatedProfileImages[0] = null;
              }

              const updatedPhotos = Array.isArray(displayData.photos)
                ? [...displayData.photos]
                : [];
              if (updatedPhotos.length > 0) {
                updatedPhotos[0] = null;
              }

              const updatedProfile = {
                ...displayData,
                profileImage: null, // Slot #1 remains explicitly BLANK
                profileImages: updatedProfileImages,
                photos: updatedPhotos,
              };

              setProfile(updatedProfile);
              if (onUpdateProfile) {
                onUpdateProfile(updatedProfile);
              }

              try {
                await apiClient.removeMainPhoto();
              } catch (apiErr) {
                console.log('removeMainPhoto API call failed, falling back to saveQuestionnaire:', apiErr);
                await apiClient.saveQuestionnaire(updatedProfile);
              }

              Alert.alert('Photo Removed', 'Your main profile photo has been removed. Slot #1 is now blank.');
            } catch (err) {
              console.log('Error removing profile photo:', err);
              Alert.alert('Error', 'Failed to remove profile photo.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const displayData = profile || userProfile || {};

  const formatImageUri = (url) => {
    if (!url) return '';
    return getImageUrl(url);
  };

  // Extract all valid, non-null photo & video URIs from user record
  const validProfileImages = (displayData.profileImages || []).filter(
    (p) => typeof p === 'string' && p.trim().length > 0
  );
  const validPhotos = (displayData.photos || []).filter(
    (p) => typeof p === 'string' && p.trim().length > 0
  );
  const validVideos = (
    Array.isArray(displayData.videos)
      ? displayData.videos
      : Array.isArray(displayData.profileVideos)
        ? displayData.profileVideos
        : Array.isArray(displayData.media)
          ? displayData.media
          : []
  ).filter((p) => typeof p === 'string' && p.trim().length > 0);

  let rawPhotosList = [];
  if (
    displayData.profileImage &&
    typeof displayData.profileImage === 'string' &&
    displayData.profileImage.trim().length > 0
  ) {
    rawPhotosList.push(displayData.profileImage);
  }

  validProfileImages.forEach((img) => {
    if (!rawPhotosList.includes(img)) {
      rawPhotosList.push(img);
    }
  });

  validPhotos.forEach((img) => {
    if (!rawPhotosList.includes(img)) {
      rawPhotosList.push(img);
    }
  });

  validVideos.forEach((vid) => {
    if (!rawPhotosList.includes(vid)) {
      rawPhotosList.push(vid);
    }
  });

  const hiddenMediaList = Array.isArray(displayData.hiddenMedia) ? displayData.hiddenMedia : [];
  const publicRawPhotosList = rawPhotosList.filter((url) => !hiddenMediaList.includes(url));

  const hasMainProfilePhoto =
    displayData.profileImage &&
    typeof displayData.profileImage === 'string' &&
    displayData.profileImage.trim().length > 0 &&
    !hiddenMediaList.includes(displayData.profileImage);

  const hasUserUploadedPhoto = publicRawPhotosList.length > 0;
  const photosList = publicRawPhotosList.map((p) => formatImageUri(p));
  const mainPhotoUrl = hasMainProfilePhoto ? formatImageUri(displayData.profileImage) : null;

  const computeExactAge = () => {
    if (displayData.bdayYear && displayData.bdayYear.toString().trim().length === 4) {
      const year = parseInt(displayData.bdayYear, 10);
      const month = parseInt(displayData.bdayMonth, 10) || 1;
      const day = parseInt(displayData.bdayDay, 10) || 1;

      const today = new Date();
      let calculatedAge = today.getFullYear() - year;
      const monthDiff = (today.getMonth() + 1) - month;
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
        calculatedAge--;
      }
      if (calculatedAge >= 18 && calculatedAge <= 120) {
        return calculatedAge;
      }
    }
    return displayData.age || null;
  };

  const computeCompletionPercentage = () => {
    let score = 0;

    // 1. First Name / Display Name (15%)
    if (displayData.firstName || displayData.name) score += 15;

    // 2. Profile Photo Gallery Count (Up to 25%)
    const photoCount = rawPhotosList.length;
    if (photoCount >= 4) {
      score += 25; // 25% max for 4+ photos
    } else if (photoCount === 3) {
      score += 20;
    } else if (photoCount === 2) {
      score += 15;
    } else if (photoCount === 1) {
      score += 10;
    }

    // 3. Birthdate / Age (10%)
    if (displayData.bdayYear || displayData.age) score += 10;

    // 4. Gender (10%)
    if (displayData.gender) score += 10;

    // 5. Bio (15%)
    if (displayData.bio && displayData.bio.trim().length > 0) score += 15;

    // 6. Interests & Passions (15%)
    if (displayData.interests && displayData.interests.length > 0) score += 15;

    // 7. Lifestyle / Education Habits (10%)
    if (displayData.educationLevel || displayData.drinkHabit || displayData.smokeHabit || displayData.height || displayData.weight || displayData.job || displayData.college) score += 10;

    return Math.min(100, Math.max(0, score));
  };

  const completionPct = computeCompletionPercentage();
  const userAge = computeExactAge();

  const bdayFormatted =
    displayData.bdayDay && displayData.bdayMonth && displayData.bdayYear
      ? `${displayData.bdayDay}/${displayData.bdayMonth}/${displayData.bdayYear}`
      : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handlePullToRefresh}
          colors={['#FE3C72']}
          tintColor="#FE3C72"
        />
      }
    >
      <View style={[styles.topBarHeader, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 10 : 5) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (onGoBack && onGoBack()) return;
            if (onBack) onBack();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>My Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#FE3C72" />
        </View>
      ) : null}

      {/* Story / Status Photo Gallery Header Bar - Only if user has uploaded photos */}
      {hasUserUploadedPhoto && (
        <View style={styles.storySection}>
          <Text style={styles.sectionHeaderTitle}>📸 Status & Photo Gallery</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storyScrollView}>
            {photosList.map((url, idx) => {
              const isVid = isVideoUrl(url);
              const thumb = getVideoThumbnailUrl(url);
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.storyRing}
                  onPress={() => setActiveStoryIndex(idx)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: thumb }} style={styles.storyThumb} />
                  <Text style={styles.storyBadge}>{isVid ? '🎬 Video' : `Photo #${idx + 1}`}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Main Profile Header Card */}
      <View style={styles.card}>
        <View style={styles.avatarWrapper}>
          <View style={[styles.avatarRingOuter, { borderColor: completionPct >= 100 ? '#00E676' : '#FE3C72' }]}>
            {hasMainProfilePhoto ? (
              <TouchableOpacity onPress={() => setActiveStoryIndex(0)} activeOpacity={0.9}>
                <Image source={{ uri: getVideoThumbnailUrl(mainPhotoUrl) }} style={styles.avatar} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleChangeProfilePhoto} activeOpacity={0.8} style={styles.emptyAvatarCircle}>
                <Text style={styles.emptyAvatarIcon}>👤</Text>
                <Text style={styles.emptyAvatarLabel}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Profile Completion Percentage Ring Badge */}
          <View style={[styles.completionBadgePill, { backgroundColor: completionPct >= 100 ? '#00E676' : '#FE3C72' }]}>
            <Text style={styles.completionBadgeText}>{completionPct}%</Text>
          </View>

          <TouchableOpacity
            style={styles.cameraBadge}
            onPress={handleChangeProfilePhoto}
            activeOpacity={0.8}
          >
            <Text style={styles.cameraBadgeIcon}>📷</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.nameText}>
          {displayData.firstName || displayData.name || 'Your Name'}
          {userAge ? `, ${userAge}` : ''}
        </Text>

        {displayData.gender && <Text style={styles.genderSub}>{displayData.gender}</Text>}
        {displayData.email && <Text style={styles.contactSub}>✉️ {displayData.email}</Text>}
        {displayData.mobile && <Text style={styles.contactSub}>📱 {displayData.mobile}</Text>}
        {bdayFormatted && <Text style={styles.contactSub}>🎂 {bdayFormatted}</Text>}

        {displayData.bio && displayData.bio.trim().length > 0 ? (
          <Text style={styles.bioText}>"{displayData.bio.trim()}"</Text>
        ) : null}

        {/* Quick Action Chips for Profile Photo & Gallery Preview */}
        <View style={styles.photoActionRow}>
          <TouchableOpacity style={styles.changePhotoChip} onPress={handleChangeProfilePhoto} activeOpacity={0.8}>
            <Text style={styles.changePhotoChipText}>📷 {hasMainProfilePhoto ? 'Change Photo' : 'Upload Photo'}</Text>
          </TouchableOpacity>
          {photosList.length > 0 && (
            <TouchableOpacity style={styles.previewPhotoChip} onPress={() => setActiveStoryIndex(0)} activeOpacity={0.8}>
              <Text style={styles.previewPhotoChipText}>Preview </Text>
            </TouchableOpacity>
          )}
          {hasMainProfilePhoto && (
            <TouchableOpacity style={styles.removePhotoChip} onPress={handleRemoveProfilePhoto} activeOpacity={0.8}>
              <Text style={styles.removePhotoChipText}>🗑️ Remove</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => openGalleryModal(6)}
          activeOpacity={0.8}
        >
          <Text style={styles.editBtnText}>✏️ Edit Full Profile & Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Subscriptions & Premium Plans Card */}
      <View style={styles.card}>
        <View style={styles.subHeaderRow}>
          <Text style={styles.sectionTitle}>💎 Premium Subscriptions</Text>
          {activePlan !== 'free' && (
            <View style={styles.activePlanBadge}>
              <Text style={styles.activePlanText}>ACTIVE</Text>
            </View>
          )}
        </View>

        <Text style={styles.subSubtitle}>Upgrade your Spark experience to unlock exclusive features</Text>

        {SUBSCRIPTION_PLANS.map((plan) => (
          <View key={plan.id} style={[styles.planCard, { borderColor: plan.accentColor }]}>
            <View style={styles.planTitleRow}>
              <Text style={[styles.planName, { color: plan.accentColor }]}>{plan.name}</Text>

              <View style={[styles.planBadgeBg, { backgroundColor: plan.accentColor }]}>
                <Text style={styles.planBadgeText}>{plan.badge}</Text>
              </View>
            </View>

            <Text style={styles.planPrice}>{plan.price}</Text>

            {plan.features.map((feat, i) => (
              <Text key={i} style={styles.planFeatureText}>
                {feat}
              </Text>
            ))}

            <TouchableOpacity
              style={[
                styles.subscribeBtn,
                activePlan === plan.id ? styles.subscribedBtn : { backgroundColor: plan.accentColor },
              ]}
              onPress={() => {
                if (activePlan === plan.id) {
                  Alert.alert('Subscribed', `You are currently on ${plan.name}`);
                } else {
                  setActivePlan(plan.id);
                  Alert.alert('Subscription Activated', `Welcome to ${plan.name}! All premium features are unlocked.`);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.subscribeBtnText}>
                {activePlan === plan.id ? 'CURRENT PLAN' : `UPGRADE TO ${plan.name.toUpperCase()}`}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Dating Details & Lifestyle Badges */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Dating Details & Lifestyle</Text>
        <View style={styles.badgeWrap}>
          {displayData.interestedIn && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>👀 Interested In:</Text>
              <Text style={styles.badgeVal}>{displayData.interestedIn}</Text>
            </View>
          )}
          {displayData.lookingFor && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>💬 Looking For:</Text>
              <Text style={styles.badgeVal}>{displayData.lookingFor}</Text>
            </View>
          )}
          {displayData.orientation && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>🌈 Orientation:</Text>
              <Text style={styles.badgeVal}>{displayData.orientation}</Text>
            </View>
          )}
          {displayData.drinkHabit && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>🍷 Drink Habit:</Text>
              <Text style={styles.badgeVal}>{displayData.drinkHabit}</Text>
            </View>
          )}
          {displayData.smokeHabit && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>🚬 Smoke Habit:</Text>
              <Text style={styles.badgeVal}>{displayData.smokeHabit}</Text>
            </View>
          )}
          {displayData.exercise && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>🏋️ Workout:</Text>
              <Text style={styles.badgeVal}>{displayData.exercise}</Text>
            </View>
          )}
          {displayData.pets && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>🐕 Pets:</Text>
              <Text style={styles.badgeVal}>{displayData.pets}</Text>
            </View>
          )}
          {displayData.educationLevel && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>🎓 Education:</Text>
              <Text style={styles.badgeVal}>{displayData.educationLevel}</Text>
            </View>
          )}
          {displayData.height && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>📏 Height:</Text>
              <Text style={styles.badgeVal}>{displayData.height}</Text>
            </View>
          )}
          {displayData.weight && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>⚖️ Weight:</Text>
              <Text style={styles.badgeVal}>{displayData.weight}</Text>
            </View>
          )}
          {displayData.job && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>💼 Job:</Text>
              <Text style={styles.badgeVal}>{displayData.job}</Text>
            </View>
          )}
          {displayData.college && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>🏛️ College:</Text>
              <Text style={styles.badgeVal}>{displayData.college}</Text>
            </View>
          )}
          {displayData.zodiac && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>⭐ Zodiac:</Text>
              <Text style={styles.badgeVal}>{displayData.zodiac}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Interests & Passions */}
      {displayData.interests && displayData.interests.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Interests & Passions</Text>
          <View style={styles.chipWrap}>
            {displayData.interests.map((item, idx) => (
              <View key={idx} style={styles.chip}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Account Settings / Actions */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account Actions</Text>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => openGalleryModal(1)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>🔄</Text>
          <Text style={styles.actionText}>Retake Questionnaire</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setIsPasswordModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>🔑</Text>
          <Text style={styles.actionText}>Reset / Change Password</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleFetchAndShowHiddenMedia}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>🙈</Text>
          <Text style={styles.actionText}>Show Hidden Photos / Videos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={async () => {
            try {
              setLoading(true);
              const token = await registerFcmToken();
              if (token) {
                Alert.alert(
                  'Push Notifications Active 🔔',
                  `Successfully connected device token:\n\n${token.substring(0, 32)}...`
                );
              } else {
                Alert.alert(
                  'Push Notification Setup',
                  'Attempted token sync. Please ensure Google Play Services and Notification permissions are enabled.'
                );
              }
            } catch (e) {
              Alert.alert('Push Token Error', e?.message || 'Failed to sync FCM token');
            } finally {
              setLoading(false);
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>🔔</Text>
          <Text style={styles.actionText}>Sync Push Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={onLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>🚪</Text>
          <Text style={[styles.actionText, styles.logoutText]}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionRow, styles.deleteAccountRow]}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>🗑️</Text>
          <Text style={[styles.actionText, styles.deleteAccountText]}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Questionnaire Modal */}
      <Modal visible={isQuestionnaireModalOpen} animationType="slide">
        <QuestionnaireScreen
          initialData={displayData}
          isEditMode={true}
          initialStep={questionnaireModalStep}
          onCloseModal={() => setIsQuestionnaireModalOpen(false)}
          onFinish={handleFinishEditQuestionnaire}
        />
      </Modal>

      {/* Reset / Change Password Modal */}
      <Modal visible={isPasswordModalOpen} animationType="slide" transparent>
        <View style={styles.passwordModalOverlay}>
          <View style={styles.passwordModalCard}>
            <View style={styles.passwordModalHeader}>
              <Text style={styles.passwordModalTitle}>Reset / Change Password</Text>
              <TouchableOpacity
                onPress={() => setIsPasswordModalOpen(false)}
                style={styles.passwordCloseBtn}
              >
                <Text style={styles.passwordCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <CustomInput
              label="Current Password"
              secureTextEntry
              iconType="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <CustomInput
              label="New Password"
              secureTextEntry
              iconType="password"
              placeholder="Enter new password (min 8 chars)"
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <CustomInput
              label="Confirm New Password"
              secureTextEntry
              iconType="password"
              placeholder="Re-enter new password"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
            />

            <View style={styles.passwordBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsPasswordModalOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>

              <CustomButton
                title="UPDATE PASSWORD"
                variant="primary"
                loading={passwordLoading}
                onPress={handleChangePasswordSubmit}
                style={styles.submitPasswordBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Status & Photo Preview Modal */}
      <PreviewModal
        visible={activeStoryIndex !== null}
        photos={publicRawPhotosList}
        initialIndex={activeStoryIndex || 0}
        userName={displayData.firstName || displayData.name || 'My Status'}
        userAvatar={mainPhotoUrl}
        isOwnProfile={true}
        onClose={() => setActiveStoryIndex(null)}
        onHideMedia={async (hiddenUrl) => {
          try {
            if (!hiddenUrl) return;
            await apiClient.hideProfileMedia(hiddenUrl);
            Alert.alert(
              'Media Hidden 🙈',
              'This item has been hidden from public view. It is NOT deleted from your database, and you can Unhide it anytime on your Profile Screen.'
            );
            fetchProfileFromBackend();
          } catch (e) {
            console.log('Error hiding profile media:', e);
            Alert.alert('Error', 'Could not hide media item.');
          }
        }}
      />

      {/* Fullscreen Hidden Status & Photo Preview Modal */}
      <PreviewModal
        visible={activeHiddenStoryIndex !== null}
        photos={fetchedHiddenMediaList}
        initialIndex={activeHiddenStoryIndex || 0}
        userName="Hidden Photos & Videos 🙈"
        userAvatar={mainPhotoUrl}
        isHiddenMode={true}
        isOwnProfile={true}
        onClose={() => setActiveHiddenStoryIndex(null)}
        onUnhideMedia={async (unhideUrl) => {
          try {
            if (!unhideUrl) return;
            setLoading(true);
            await apiClient.unhideProfileMedia(unhideUrl);
            Alert.alert(
              'Media Restored 👁️',
              'This item has been unhidden! It is now visible again on your public profile & story preview.'
            );
            const updatedList = fetchedHiddenMediaList.filter((u) => u !== unhideUrl);
            setFetchedHiddenMediaList(updatedList);
            if (updatedList.length === 0) {
              setActiveHiddenStoryIndex(null);
            }
            fetchProfileFromBackend();
          } catch (e) {
            console.log('Error unhiding profile media:', e);
            Alert.alert('Error', 'Could not unhide media item.');
          } finally {
            setLoading(false);
          }
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  topBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 5,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  loaderContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  storySection: {
    backgroundColor: '#1E1E2E',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  storyScrollView: {
    flexDirection: 'row',
  },
  storyRing: {
    alignItems: 'center',
    marginRight: 14,
    padding: 3,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#FE3C72',
  },
  storyThumb: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  storyBadge: {
    color: '#A0A0B0',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1E1E2E',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
    alignItems: 'center',
  },
  avatarRingOuter: {
    padding: 3,
    borderRadius: 65,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  completionBadgePill: {
    position: 'absolute',
    top: -6,
    right: -6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#1E1E2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 7,
    zIndex: 10,
  },
  completionBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  emptyAvatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(254, 60, 114, 0.5)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyAvatarIcon: {
    fontSize: 32,
    marginBottom: 2,
    opacity: 0.8,
  },
  emptyAvatarLabel: {
    color: '#FE3C72',
    fontSize: 11,
    fontWeight: '700',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#FE3C72',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1E1E2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  cameraBadgeIcon: {
    fontSize: 16,
  },
  photoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  changePhotoChip: {
    backgroundColor: 'rgba(254, 60, 114, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.4)',
  },
  changePhotoChipText: {
    color: '#FE3C72',
    fontSize: 12,
    fontWeight: '700',
  },
  previewPhotoChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  previewPhotoChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  removePhotoChip: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
    marginLeft: 8,
  },
  removePhotoChipText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '700',
  },
  nameText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  genderSub: {
    fontSize: 13,
    color: '#FE3C72',
    fontWeight: '600',
    marginTop: 2,
  },
  contactSub: {
    fontSize: 13,
    color: '#A0A0B0',
    marginTop: 3,
  },
  bioText: {
    fontSize: 14,
    color: '#D0D0E0',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
    paddingHorizontal: 10,
  },
  editBtn: {
    backgroundColor: '#FE3C72',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 22,
    marginTop: 6,
  },
  editBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  activePlanBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activePlanText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  subSubtitle: {
    color: '#A0A0B0',
    fontSize: 13,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  planCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
  },
  planTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: 18,
    fontWeight: '800',
  },
  planBadgeBg: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  planBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
  },
  planPrice: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 6,
  },
  planFeatureText: {
    color: '#D0D0E0',
    fontSize: 13,
    marginVertical: 3,
    fontWeight: '500',
  },
  subscribeBtn: {
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 12,
  },
  subscribedBtn: {
    backgroundColor: '#4CAF50',
  },
  subscribeBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeWrap: {
    width: '100%',
    marginTop: 10,
  },
  badge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  badgeLabel: {
    color: '#D0D0E0',
    fontSize: 14,
    fontWeight: '700',
  },
  badgeVal: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginTop: 10,
  },
  chip: {
    backgroundColor: 'rgba(254, 60, 114, 0.25)',
    borderColor: '#FE3C72',
    borderWidth: 1.5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    margin: 4,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  logoutRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  deleteAccountRow: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  actionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutText: {
    color: '#FF9900',
  },
  deleteAccountText: {
    color: '#FF3B30',
    fontWeight: '700',
  },
  passwordModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  passwordModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E1E2E',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  passwordModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  passwordModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  passwordCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  passwordBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 10,
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  submitPasswordBtn: {
    flex: 1,
  },
  storyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
    zIndex: 10,
  },
  storyModalCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  hiddenMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  hiddenMediaCard: {
    width: 105,
    height: 135,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  hiddenMediaThumb: {
    width: '100%',
    height: 90,
    borderRadius: 10,
    opacity: 0.6,
  },
  hiddenBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hiddenBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  unhideBtn: {
    backgroundColor: '#00E676',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  unhideBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
});

export default Profile;
