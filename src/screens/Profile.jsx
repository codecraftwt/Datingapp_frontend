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
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
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

  // Reported Users Modal State
  const [isReportedUsersModalOpen, setIsReportedUsersModalOpen] = useState(false);
  const [reportedUsersList, setReportedUsersList] = useState([]);
  const [reportedUsersLoading, setReportedUsersLoading] = useState(false);

  // Blocked Users Modal State
  const [isBlockedUsersModalOpen, setIsBlockedUsersModalOpen] = useState(false);
  const [blockedUsersList, setBlockedUsersList] = useState([]);
  const [blockedUsersLoading, setBlockedUsersLoading] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState(null);

  // Profile Privacy & Visibility State
  const [isProfileHiddenState, setIsProfileHiddenState] = useState(!!userProfile?.isProfileHidden);
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  useEffect(() => {
    if (userProfile && userProfile.isProfileHidden !== undefined) {
      setIsProfileHiddenState(!!userProfile.isProfileHidden);
    }
  }, [userProfile]);

  const handleToggleProfileVisibility = async () => {
    const nextVal = !isProfileHiddenState;
    const actionText = nextVal ? 'Hide My Profile' : 'Show My Profile';
    const msgText = nextVal
      ? 'Hide your profile from candidate discovery & search? Existing matches and chats remain available.'
      : 'Show your profile in candidate discovery & search again?';

    Alert.alert(
      `${actionText} 🔒`,
      msgText,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextVal ? 'Hide Profile' : 'Show Profile',
          onPress: async () => {
            try {
              setVisibilityLoading(true);
              let res;
              if (typeof apiClient?.updateProfileVisibility === 'function') {
                res = await apiClient.updateProfileVisibility({ isProfileHidden: nextVal });
              } else if (typeof apiClient?.request === 'function') {
                res = await apiClient.request('/api/profile/visibility', {
                  method: 'PUT',
                  body: JSON.stringify({ isProfileHidden: nextVal }),
                });
              } else {
                throw new Error('API Client method updateProfileVisibility not ready. Please restart app.');
              }
              setIsProfileHiddenState(nextVal);
              setProfile((prev) => ({ ...prev, isProfileHidden: nextVal }));
              if (onUpdateProfile) {
                onUpdateProfile({ ...(userProfile || {}), isProfileHidden: nextVal });
              }
              Alert.alert(
                nextVal ? 'Profile Hidden ' : 'Profile Visible ',
                res?.message || (nextVal ? 'Profile is now hidden from discovery.' : 'Profile is now visible.')
              );
              fetchProfileFromBackend();
            } catch (err) {
              console.error('Error toggling profile visibility:', err);
              Alert.alert('Error', err?.data?.message || err?.message || 'Failed to update profile visibility.');
            } finally {
              setVisibilityLoading(false);
            }
          },
        },
      ]
    );
  };

  const fetchBlockedUsers = async () => {
    try {
      setBlockedUsersLoading(true);
      const res = await apiClient.getBlockedUsers();
      const list = res?.blockedUsers || res?.data || [];
      setBlockedUsersList(Array.isArray(list) ? list : []);
    } catch (err) {
      console.log('Error fetching blocked users:', err);
      setBlockedUsersList([]);
    } finally {
      setBlockedUsersLoading(false);
    }
  };

  const handleOpenBlockedUsersModal = () => {
    setIsBlockedUsersModalOpen(true);
    fetchBlockedUsers();
  };

  const handleUnblockUserInProfile = async (targetUserId, targetName) => {
    Alert.alert(
      'Unblock User 🔓',
      `Are you sure you want to unblock ${targetName}? They will be able to view your profile and message you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              setUnblockingUserId(targetUserId);
              await apiClient.unblockUser({ targetUserId });
              setBlockedUsersList((prev) => prev.filter((u) => (u.id || u._id || u.userId)?.toString() !== targetUserId.toString()));
              Alert.alert('User Unblocked 🔓', `${targetName} has been unblocked.`);
            } catch (err) {
              console.log('Error unblocking user:', err);
              Alert.alert('Error', 'Failed to unblock user.');
            } finally {
              setUnblockingUserId(null);
            }
          },
        },
      ]
    );
  };

  const handleFetchAndShowReportedUsers = async () => {
    try {
      setReportedUsersLoading(true);
      setIsReportedUsersModalOpen(true);
      const res = await apiClient.getMyReports();
      const list = res.reports || res.data?.reports || [];
      setReportedUsersList(list);
    } catch (err) {
      console.log('Error fetching reported users:', err);
      Alert.alert('Error', 'Failed to fetch your reported users list.');
    } finally {
      setReportedUsersLoading(false);
    }
  };

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
            message: 'Dating App needs access to your camera so you can take a profile photo.',
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
        return true;
      }
    }
    return true;
  };

  const requestAndroidGalleryPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 33) {
          if (PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES) {
            const hasImagesPermission = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
            );
            if (hasImagesPermission) return true;

            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
              {
                title: 'Storage Permission Required 🖼️',
                message: 'Dating App needs access to your photos so you can upload a profile picture.',
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
          }
          return true;
        } else {
          const hasStoragePermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
          );
          if (hasStoragePermission) return true;

          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            {
              title: 'Storage Permission Required 🖼️',
              message: 'Dating App needs access to your photos so you can upload a profile picture.',
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
        }
      } catch (err) {
        console.warn('Gallery permission request error:', err);
        return true;
      }
    }
    return true;
  };

  const openCameraPicker = async () => {
    try {
      await requestAndroidCameraPermission();
      const options = {
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: false,
        cameraType: 'front',
      };
      launchCamera(options, (response) => {
        if (!response || response.didCancel) return;
        if (response.errorCode) {
          console.warn('Camera launch response error:', response.errorCode, response.errorMessage);
          if (response.errorCode === 'permission') {
            Alert.alert(
              'Camera Permission Needed 📷',
              'Please grant camera permission in your phone settings to take photos.'
            );
          } else {
            Alert.alert('Camera Error', response.errorMessage || 'Unable to open device camera.');
          }
          return;
        }
        if (response.assets && response.assets.length > 0) {
          processSelectedPhotoAsset(response.assets[0]);
        }
      });
    } catch (e) {
      console.error('Exception in openCameraPicker:', e);
      Alert.alert('Camera Error', e?.message || 'Could not launch camera.');
    }
  };

  const openGalleryPicker = async () => {
    try {
      if (Platform.OS === 'android') {
        try {
          if (Platform.Version >= 33) {
            if (PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES) {
              await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
            }
          } else {
            await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
          }
        } catch (permErr) {
          console.log('Gallery permission request note:', permErr);
        }
      }

      const options = {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
      };

      launchImageLibrary(options, (response) => {
        if (!response || response.didCancel) return;
        if (response.errorCode) {
          console.warn('Gallery launch response error:', response.errorCode, response.errorMessage);
          if (response.errorCode === 'permission') {
            Alert.alert(
              'Photo Permission Needed 🖼️',
              'Please grant photo storage permission in your phone settings to choose photos from gallery.'
            );
          } else {
            Alert.alert('Gallery Error', response.errorMessage || 'Failed to pick photo from gallery.');
          }
          return;
        }
        if (response.assets && response.assets.length > 0) {
          processSelectedPhotoAsset(response.assets[0]);
        }
      });
    } catch (e) {
      console.error('Exception in openGalleryPicker:', e);
      Alert.alert('Gallery Error', e?.message || 'Could not open photo gallery.');
    }
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
      <View style={styles.topBarHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (onGoBack && onGoBack()) return;
            if (onBack) onBack();
          }}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.backBtnText}>Back</Text>
          </View>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name="camera-outline" size={18} color="#FE3C72" style={{ marginRight: 6 }} />
            <Text style={styles.sectionHeaderTitle}>Status & Photo Gallery</Text>
          </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={isVid ? "videocam-outline" : "camera-outline"} size={10} color="#FFF" style={{ marginRight: 2 }} />
                    <Text style={styles.storyBadge}>{isVid ? 'Video' : `Photo${idx + 1}`}</Text>
                  </View>
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
                <Ionicons name="person" size={28} color="rgba(255,255,255,0.4)" style={{ marginBottom: 2 }} />
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
            <Ionicons name="camera" size={14} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
          <Text style={styles.nameText}>
            {displayData.firstName || displayData.name || 'Your Name'}
            {userAge ? `, ${userAge}` : ''}
          </Text>
          {!!displayData.isEmailVerified && (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#0084FF"
              style={{ marginLeft: 6 }}
            />
          )}
        </View>

        {displayData.gender && <Text style={styles.genderSub}>{displayData.gender}</Text>}

        {/* Real-time Online Status Badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: 'rgba(56, 239, 125, 0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#38EF7D', marginRight: 6 }} />
          <Text style={{ color: '#38EF7D', fontSize: 12, fontWeight: '700' }}>Online</Text>
        </View>

        {displayData.email && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Ionicons name="mail-outline" size={13} color="rgba(255,255,255,0.6)" style={{ marginRight: 5 }} />
            <Text style={styles.contactSub}>{displayData.email}</Text>
          </View>
        )}
        {displayData.mobile && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.6)" style={{ marginRight: 5 }} />
            <Text style={styles.contactSub}>{displayData.mobile}</Text>
          </View>
        )}
        {bdayFormatted && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.6)" style={{ marginRight: 5 }} />
            <Text style={styles.contactSub}>{bdayFormatted}</Text>
          </View>
        )}

        {displayData.bio && displayData.bio.trim().length > 0 ? (
          <Text style={styles.bioText}>"{displayData.bio.trim()}"</Text>
        ) : null}

        {/* Quick Action Chips for Profile Photo & Gallery Preview */}
        <View style={styles.photoActionRow}>
          <TouchableOpacity style={styles.changePhotoChip} onPress={handleChangeProfilePhoto} activeOpacity={0.8}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="camera-outline" size={13} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.changePhotoChipText}>{hasMainProfilePhoto ? 'Change Photo' : 'Upload Photo'}</Text>
            </View>
          </TouchableOpacity>
          {photosList.length > 0 && (
            <TouchableOpacity style={styles.previewPhotoChip} onPress={() => setActiveStoryIndex(0)} activeOpacity={0.8}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="eye-outline" size={13} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.previewPhotoChipText}>Preview</Text>
              </View>
            </TouchableOpacity>
          )}
          {hasMainProfilePhoto && (
            <TouchableOpacity style={styles.removePhotoChip} onPress={handleRemoveProfilePhoto} activeOpacity={0.8}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="trash-outline" size={13} color="#FF3B30" style={{ marginRight: 4 }} />
                <Text style={styles.removePhotoChipText}>Remove</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => openGalleryModal(6)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="create-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.editBtnText}>Edit Full Profile & Gallery</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Subscriptions & Premium Plans Card */}
      <View style={styles.card}>
        <View style={styles.subHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="diamond" size={18} color="#FFD700" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>Premium Subscriptions</Text>
          </View>
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
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="eye-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Interested In:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.interestedIn}</Text>
            </View>
          )}
          {displayData.lookingFor && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="heart-circle-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Looking For:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.lookingFor}</Text>
            </View>
          )}
          {displayData.orientation && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="sparkles-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Orientation:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.orientation}</Text>
            </View>
          )}
          {displayData.drinkHabit && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="wine-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Drink Habit:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.drinkHabit}</Text>
            </View>
          )}
          {displayData.smokeHabit && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="flame-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Smoke Habit:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.smokeHabit}</Text>
            </View>
          )}
          {displayData.exercise && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="barbell-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Workout:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.exercise}</Text>
            </View>
          )}
          {displayData.pets && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="paw-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Pets:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.pets}</Text>
            </View>
          )}
          {displayData.educationLevel && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="school-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Education:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.educationLevel}</Text>
            </View>
          )}
          {displayData.height && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="resize-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Height:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.height}</Text>
            </View>
          )}
          {displayData.weight && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="fitness-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Weight:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.weight}</Text>
            </View>
          )}
          {displayData.job && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="briefcase-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Job:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.job}</Text>
            </View>
          )}
          {displayData.college && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="school-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>College:</Text>
              </View>
              <Text style={styles.badgeVal}>{displayData.college}</Text>
            </View>
          )}
          {displayData.zodiac && (
            <View style={styles.badge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="moon-outline" size={14} color="#FE3C72" style={{ marginRight: 4 }} />
                <Text style={styles.badgeLabel}>Zodiac:</Text>
              </View>
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
          onPress={handleToggleProfileVisibility}
          disabled={visibilityLoading}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isProfileHiddenState ? "eye-outline" : "eye-off-outline"}
            size={22}
            color={isProfileHiddenState ? "#00E676" : "#FF9500"}
            style={{ marginRight: 10 }}
          />
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.actionText}>
              {isProfileHiddenState ? 'Show My Profile' : 'Hide My Profile'}
            </Text>
            <View style={{
              backgroundColor: isProfileHiddenState ? 'rgba(255, 149, 0, 0.15)' : 'rgba(0, 230, 118, 0.15)',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              marginLeft: 6,
            }}>
              <Text style={{
                color: isProfileHiddenState ? '#FF9500' : '#00E676',
                fontSize: 11,
                fontWeight: '700',
              }}>
                {isProfileHiddenState ? '🔒 Hidden' : '👁️ Visible'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => openGalleryModal(1)}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-circle-outline" size={22} color="#FE3C72" style={{ marginRight: 10 }} />
          <Text style={styles.actionText}>Retake Questionnaire</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setIsPasswordModalOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="key-outline" size={22} color="#FE3C72" style={{ marginRight: 10 }} />
          <Text style={styles.actionText}>Reset / Change Password</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleFetchAndShowHiddenMedia}
          activeOpacity={0.7}
        >
          <Ionicons name="eye-off-outline" size={22} color="#FE3C72" style={{ marginRight: 10 }} />
          <Text style={styles.actionText}>Show Hidden Photos / Videos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleFetchAndShowReportedUsers}
          activeOpacity={0.7}
        >
          <Ionicons name="flag-outline" size={22} color="#FE3C72" style={{ marginRight: 10 }} />
          <Text style={styles.actionText}>Reported Users</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleOpenBlockedUsersModal}
          activeOpacity={0.7}
        >
          <Ionicons name="hand-left-outline" size={22} color="#FE3C72" style={{ marginRight: 10 }} />
          <Text style={styles.actionText}>Blocked Accounts</Text>
        </TouchableOpacity>



        <TouchableOpacity
          style={styles.actionRow}
          onPress={onLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={22} color="#FF3B30" style={{ marginRight: 10 }} />
          <Text style={[styles.actionText, styles.logoutText]}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionRow, styles.deleteAccountRow]}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-bin-outline" size={22} color="#FF3B30" style={{ marginRight: 10 }} />
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
                <Ionicons name="close" size={20} color="#FFF" />
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

      {/* Reported Users Modal */}
      <Modal visible={isReportedUsersModalOpen} animationType="slide" transparent>
        <View style={styles.passwordModalOverlay}>
          <View style={styles.reportedModalCard}>
            <View style={styles.passwordModalHeader}>
              <Text style={styles.passwordModalTitle}> Reported Users</Text>
              <TouchableOpacity
                onPress={() => setIsReportedUsersModalOpen(false)}
                style={styles.passwordCloseBtn}
              >
                <Text style={styles.passwordCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {reportedUsersLoading ? (
              <View style={styles.reportedLoadingContainer}>
                <ActivityIndicator size="large" color="#FF4458" />
                <Text style={styles.reportedLoadingText}>Loading reported users...</Text>
              </View>
            ) : reportedUsersList.length === 0 ? (
              <View style={styles.reportedEmptyContainer}>
                <Text style={styles.reportedEmptyIcon}>🛡️</Text>
                <Text style={styles.reportedEmptyTitle}>No Reported Users</Text>
                <Text style={styles.reportedEmptySub}>You have not reported any users yet.</Text>
              </View>
            ) : (
              <ScrollView style={styles.reportedListScroll} showsVerticalScrollIndicator={false}>
                {reportedUsersList.map((rep) => {
                  const u = rep.reportedUser || {};
                  const avatarUrl = getImageUrl(u.profileImage);
                  const statusColor =
                    rep.status === 'resolved'
                      ? '#4CAF50'
                      : rep.status === 'reviewed'
                        ? '#2196F3'
                        : rep.status === 'dismissed'
                          ? '#9E9E9E'
                          : '#FF9800';

                  return (
                    <View key={rep._id} style={styles.reportedCardItem}>
                      <View style={styles.reportedHeaderRow}>
                        {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={styles.reportedAvatar} />
                        ) : (
                          <View style={[styles.reportedAvatar, styles.reportedAvatarPlaceholder]}>
                            <Text style={styles.reportedAvatarInitial}>
                              {(u.name || 'U').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.reportedUserInfo}>
                          <Text style={styles.reportedUserName}>
                            {u.name || u.firstName || 'User'}{u.age ? `, ${u.age}` : ''}
                          </Text>
                          <Text style={styles.reportedUserEmail}>{u.email || 'Reported Profile'}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                          <Text style={styles.statusBadgeText}>
                            {(rep.status || 'pending').toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.reportedReasonWrap}>
                        <Text style={styles.reportedReasonLabel}>Reason: </Text>
                        <Text style={styles.reportedReasonVal}>{rep.reason}</Text>
                      </View>

                      {rep.details ? (
                        <View style={styles.reportedDetailsWrap}>
                          <Text style={styles.reportedDetailsLabel}>Details: </Text>
                          <Text style={styles.reportedDetailsVal}>{rep.details}</Text>
                        </View>
                      ) : null}

                      <Text style={styles.reportedDateText}>
                        Reported on: {new Date(rep.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.reportedCloseBtn}
              onPress={() => setIsReportedUsersModalOpen(false)}
            >
              <Text style={styles.reportedCloseBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Blocked Accounts Modal */}
      <Modal
        visible={isBlockedUsersModalOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsBlockedUsersModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#121212', paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 25 : 40) }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.1)',
          }}>
            <TouchableOpacity
              style={{ padding: 6 }}
              onPress={() => setIsBlockedUsersModalOpen(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>Blocked Accounts 🔒</Text>
            <TouchableOpacity
              style={{ padding: 6 }}
              onPress={fetchBlockedUsers}
            >
              <Ionicons name="refresh" size={20} color="#FE3C72" />
            </TouchableOpacity>
          </View>

          {blockedUsersLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#FE3C72" />
              <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 12, fontSize: 14 }}>
                Loading blocked accounts...
              </Text>
            </View>
          ) : blockedUsersList.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🛡️</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                No Blocked Accounts
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                You haven't blocked any users yet. Blocked accounts will be listed here with an option to unblock them.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 16 }}>
                Showing {blockedUsersList.length} blocked account{blockedUsersList.length > 1 ? 's' : ''}. Unblocking allows them to view your profile and message you.
              </Text>

              {blockedUsersList.map((item) => {
                const userId = item.id || item._id || item.userId;
                const userName = item.firstName || item.name || 'Blocked User';
                const userAvatar = item.profileImage || (item.photos && item.photos[0]) || null;
                const isUnblocking = unblockingUserId === userId;

                return (
                  <View
                    key={userId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {userAvatar ? (
                      <Image source={{ uri: getImageUrl(userAvatar) }} style={{ width: 50, height: 50, borderRadius: 25, marginRight: 14 }} />
                    ) : (
                      <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#FE3C72', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                        <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>
                          {userName ? userName[0].toUpperCase() : 'U'}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
                        {userName}{item.age ? `, ${item.age}` : ''}
                      </Text>
                      {!!item.city && (
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
                          📍 {item.city}
                        </Text>
                      )}
                      {!!item.blockReason && (
                        <Text style={{ color: '#FF3B30', fontSize: 11, marginTop: 2 }}>
                          Reason: {item.blockReason}
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 20,
                        backgroundColor: '#FE3C72',
                        opacity: isUnblocking ? 0.6 : 1,
                      }}
                      onPress={() => handleUnblockUserInProfile(userId, userName)}
                      disabled={isUnblocking}
                      activeOpacity={0.8}
                    >
                      {isUnblocking ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Unblock</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  topBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingTop: 4,
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
  reportedModalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
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
  reportedLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportedLoadingText: {
    color: '#8A8A9E',
    fontSize: 14,
    marginTop: 12,
  },
  reportedEmptyContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportedEmptyIcon: {
    fontSize: 42,
    marginBottom: 10,
  },
  reportedEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  reportedEmptySub: {
    color: '#8A8A9E',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  reportedListScroll: {
    marginVertical: 10,
  },
  reportedCardItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  reportedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportedAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  reportedAvatarPlaceholder: {
    backgroundColor: '#33334A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportedAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  reportedUserInfo: {
    flex: 1,
  },
  reportedUserName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  reportedUserEmail: {
    color: '#8A8A9E',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  reportedReasonWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportedReasonLabel: {
    color: '#FF4458',
    fontSize: 13,
    fontWeight: '700',
  },
  reportedReasonVal: {
    color: '#E1E1E6',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  reportedDetailsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  reportedDetailsLabel: {
    color: '#8A8A9E',
    fontSize: 12,
    fontWeight: '600',
  },
  reportedDetailsVal: {
    color: '#CCCCCC',
    fontSize: 12,
    flex: 1,
  },
  reportedDateText: {
    color: '#66667A',
    fontSize: 11,
    marginTop: 4,
  },
  reportedCloseBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  reportedCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default Profile;
