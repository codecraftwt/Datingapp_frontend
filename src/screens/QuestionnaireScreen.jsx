import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
  PermissionsAndroid,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { apiClient } from '../api/apiClient';
import { getImageUrl, getVideoThumbnailUrl, isVideoUrl } from '../api/config';
import { syncUserLocationService } from '../services/locationService';
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { SimulatedGradientBackground } from '../components/SimulatedGradientBackground';
import { PreviewModal } from '../components/PreviewModal';
import Video from 'react-native-video';

const INTEREST_OPTIONS = [
  '🎵 Music',
  '✈️ Travel',
  '🏋️ Fitness',
  '🎬 Movies',
  '🎮 Gaming',
  '🍳 Cooking',
  '🎨 Art',
  '📸 Photography',
  '📚 Reading',
  '💃 Dancing',
  '☕ Coffee',
  '🐕 Pets',
  '🍷 Wine',
  '🧘 Yoga',
  '🍕 Foodie',
  '🏕️ Camping',
];

const ORIENTATIONS = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Queer'];
const LOOKING_FOR = ['Long-term Relationship', 'Short-term Fun', 'New Friends', 'Still Figuring It Out'];
const DRINK_HABITS = ['Never', 'Socially', 'Frequently'];
const SMOKE_HABITS = ['Never', 'Socially', 'Regularly'];
const EXERCISE_HABITS = ['Active', 'Sometimes', 'Never'];
const PETS_OPTIONS = ['Dog', 'Cat', 'Both', 'None'];
const EDUCATION_LEVELS = [
  '🎓 High School',
  '🎓 Bachelors Degree',
  '🎓 Masters Degree',
  '🎓 Doctorate / PhD',
  '🛠️ Trade / Vocational',
  '💼 Other Education',
];
const ZODIAC_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Marathi', 'Mandarin', 'Japanese', 'Italian', 'Portuguese', 'Russian', 'Arabic'];

const JOB_EXAMPLES = [
  '💻 Software Engineer',
  '👩‍🏫 Teacher',
  '🩺 Doctor',
  '🎓 Student',
  '💼 Business Owner',
];

const HEIGHT_OPTIONS = [
  "5'2\" (157 cm)",
  "5'4\" (163 cm)",
  "5'6\" (168 cm)",
  "5'8\" (173 cm)",
  "5'10\" (178 cm)",
  "6'0\" (183 cm)",
  "6'2\" (188 cm)",
];

const WEIGHT_OPTIONS = [
  "50 kg (110 lbs)",
  "55 kg (121 lbs)",
  "60 kg (132 lbs)",
  "65 kg (143 lbs)",
  "70 kg (154 lbs)",
  "75 kg (165 lbs)",
  "80 kg (176 lbs)",
  "85 kg (187 lbs)",
];

export const QuestionnaireScreen = ({ onNavigate, onGoBack, onFinish, initialData, isEditMode, initialStep, onCloseModal }) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const cardWidth = Math.min(windowWidth - 32, 600);
  // Calculate photo grid slot size dynamically based on card width
  const slotWidth = Math.max(70, Math.floor((cardWidth - 60) / 3));
  const slotHeight = Math.floor(slotWidth * 1.25);

  const [step, setStep] = useState(initialStep || (isEditMode ? 4 : 1));

  useEffect(() => {
    if (initialStep) {
      setStep(initialStep);
    }
  }, [initialStep]);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [bdayDay, setBdayDay] = useState('');
  const [bdayMonth, setBdayMonth] = useState('');
  const [bdayYear, setBdayYear] = useState('');
  const [gender, setGender] = useState('Women');
  const [interestedIn, setInterestedIn] = useState('Men');
  const [orientation, setOrientation] = useState('Straight');

  const [lookingFor, setLookingFor] = useState('Long-term Relationship');
  const [drinkHabit, setDrinkHabit] = useState('Socially');
  const [smokeHabit, setSmokeHabit] = useState('Never');
  const [exercise, setExercise] = useState('Active');
  const [pets, setPets] = useState('Dog');
  const [educationLevel, setEducationLevel] = useState('Bachelors Degree');
  const [zodiac, setZodiac] = useState('Leo');
  const [height, setHeight] = useState('5\'10" (178 cm)');
  const [weight, setWeight] = useState('60 kg (132 lbs)');
  const [job, setJob] = useState('');
  const [college, setCollege] = useState('');
  const [ageRangeMin, setAgeRangeMin] = useState('22');
  const [ageRangeMax, setAgeRangeMax] = useState('35');
  const [distanceRange, setDistanceRange] = useState('10');

  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState(['🎵 Music', '✈️ Travel', '☕ Coffee']);
  const [selectedLanguages, setSelectedLanguages] = useState(['English', 'Hindi']);

  const [photos, setPhotos] = useState(Array(9).fill(null));
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [uploadingSlotIndex, setUploadingSlotIndex] = useState(null);
  const [loading, setLoading] = useState(false);

  // Dynamic Options state fetched from Backend API
  const [optionsData, setOptionsData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchOptions = async () => {
      try {
        const res = await apiClient.getQuestionnaireOptions();
        if (isMounted && res && res.options) {
          setOptionsData(res.options);
        }
      } catch (err) {
        console.log('Error loading dynamic questionnaire options from backend API:', err);
      }
    };
    fetchOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  const interestOptionsList = optionsData?.interests || INTEREST_OPTIONS;
  const orientationsList = optionsData?.orientations || ORIENTATIONS;
  const lookingForList = optionsData?.lookingFor || LOOKING_FOR;
  const drinkHabitsList = optionsData?.drinkHabits || DRINK_HABITS;
  const smokeHabitsList = optionsData?.smokeHabits || SMOKE_HABITS;
  const exerciseHabitsList = optionsData?.exerciseHabits || EXERCISE_HABITS;
  const petsOptionsList = optionsData?.petsOptions || PETS_OPTIONS;
  const educationLevelsList = optionsData?.educationLevels || EDUCATION_LEVELS;
  const zodiacSignsList = optionsData?.zodiacSigns || ZODIAC_SIGNS;
  const languageOptionsList = optionsData?.languageOptions || LANGUAGE_OPTIONS;
  const jobExamplesList = optionsData?.jobExamples || JOB_EXAMPLES;
  const heightOptionsList = optionsData?.heightOptions || HEIGHT_OPTIONS;
  const weightOptionsList = optionsData?.weightOptions || WEIGHT_OPTIONS;

  // Pre-fill questionnaire data if provided
  useEffect(() => {
    if (initialData) {
      if (initialData.firstName || initialData.name) setFirstName(initialData.firstName || initialData.name);
      if (initialData.bdayDay) setBdayDay(initialData.bdayDay);
      if (initialData.bdayMonth) setBdayMonth(initialData.bdayMonth);
      if (initialData.bdayYear) setBdayYear(initialData.bdayYear);
      if (initialData.gender) setGender(initialData.gender);
      if (initialData.interestedIn) setInterestedIn(initialData.interestedIn);
      if (initialData.orientation) setOrientation(initialData.orientation);
      if (initialData.lookingFor) setLookingFor(initialData.lookingFor);
      if (initialData.drinkHabit) setDrinkHabit(initialData.drinkHabit);
      if (initialData.smokeHabit) setSmokeHabit(initialData.smokeHabit);
      if (initialData.exercise) setExercise(initialData.exercise);
      if (initialData.pets) setPets(initialData.pets);
      if (initialData.educationLevel) setEducationLevel(initialData.educationLevel);
      if (initialData.zodiac) setZodiac(initialData.zodiac);
      if (initialData.height) setHeight(initialData.height);
      if (initialData.weight) setWeight(initialData.weight);
      if (initialData.job) setJob(initialData.job);
      if (initialData.college) setCollege(initialData.college);
      if (initialData.ageRangeMin) setAgeRangeMin(initialData.ageRangeMin.toString());
      if (initialData.ageRangeMax) setAgeRangeMax(initialData.ageRangeMax.toString());
      if (initialData.distanceRange) setDistanceRange(initialData.distanceRange.toString());
      if (initialData.bio) setBio(initialData.bio);
      if (initialData.interests && Array.isArray(initialData.interests)) setSelectedInterests(initialData.interests);
      if (initialData.languages && Array.isArray(initialData.languages)) setSelectedLanguages(initialData.languages);

      // Populate 9 photos grid
      const existingPhotos = initialData.profileImages || initialData.photos || [];
      const initialGrid = Array(9).fill(null);
      if (initialData.profileImage) {
        initialGrid[0] = initialData.profileImage;
      }
      existingPhotos.forEach((img, idx) => {
        if (idx < 9 && img) initialGrid[idx] = img;
      });
      setPhotos(initialGrid);
    } else {
      setPhotos(Array(9).fill(null));
    }
  }, [initialData]);

  const calculateAge = () => {
    if (bdayYear && bdayYear.trim().length === 4) {
      const year = parseInt(bdayYear, 10);
      const month = parseInt(bdayMonth, 10) || 1;
      const day = parseInt(bdayDay, 10) || 1;

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
    return initialData?.age || 24;
  };

  const toggleInterest = (item) => {
    if (selectedInterests.includes(item)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== item));
    } else {
      if (selectedInterests.length < 6) {
        setSelectedInterests([...selectedInterests, item]);
      } else {
        Alert.alert('Limit Reached', 'You can select up to 6 interests.');
      }
    }
  };

  const toggleLanguage = (item) => {
    if (selectedLanguages.includes(item)) {
      setSelectedLanguages(selectedLanguages.filter((l) => l !== item));
    } else {
      setSelectedLanguages([...selectedLanguages, item]);
    }
  };

  const isVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return (
      lower.endsWith('.mp4') ||
      lower.endsWith('.mov') ||
      lower.endsWith('.webm') ||
      lower.endsWith('.3gp') ||
      lower.includes('/video/upload/') ||
      lower.includes('video')
    );
  };

  const handlePickImageForSlot = (slotIndex) => {
    const isMainProfileSlot = slotIndex === 0;
    const pickerOptions = isMainProfileSlot
      ? { mediaType: 'photo', quality: 0.7, maxWidth: 1080, maxHeight: 1080 }
      : { mediaType: 'mixed', videoQuality: 'low', quality: 0.7, durationLimit: 15, maxWidth: 1080, maxHeight: 1080 };

    launchImageLibrary(pickerOptions, async (response) => {
      console.log('[QuestionnaireScreen] launchImageLibrary response:', JSON.stringify(response));
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error('[QuestionnaireScreen] Media Picker error:', response.errorMessage);
        Alert.alert('Media Error', response.errorMessage || 'Failed to pick photo or video');
        return;
      }
      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        const localUri = asset.uri;
        const isVideo = asset.type?.startsWith('video/') || isVideoUrl(asset.fileName || localUri);

        // Slot #1 (Main Profile Picture) MUST be a photo ONLY
        if (isMainProfileSlot && isVideo) {
          Alert.alert(
            'Main Profile Picture (Slot #1)',
            'Your main profile picture (Slot #1) must be a photo. You can upload video clips in slots #2 through #9.'
          );
          return;
        }

        // Check 15 seconds video duration limit for slots 2-9
        if (isVideo && asset.duration && asset.duration > 15) {
          Alert.alert('Video Duration Limit', 'Video clips must be 15 seconds or less. Please select a shorter video.');
          return;
        }

        console.log(`[QuestionnaireScreen] Selected asset for Slot #${slotIndex + 1}:`, {
          uri: localUri,
          type: asset.type,
          fileName: asset.fileName,
          fileSize: asset.fileSize,
          isVideo,
        });

        // 100MB video limit
        const maxVideoSizeBytes = 100 * 1024 * 1024; // 100 MB
        if (isVideo && asset.fileSize && asset.fileSize > maxVideoSizeBytes) {
          Alert.alert(
            'Video Size Exceeded',
            `The selected video is ${(asset.fileSize / (1024 * 1024)).toFixed(1)}MB. Please choose a video clip under 100MB (or 15 seconds or less) for app stability.`
          );
          return;
        }

        // Optimistically set local URI for immediate UI preview so preview never disappears
        setPhotos((prevPhotos) => {
          const updated = [...prevPhotos];
          updated[slotIndex] = localUri;
          return updated;
        });

        // Upload file (Photo or Video) to Backend & Cloudinary
        try {
          setUploadingSlotIndex(slotIndex);
          const formData = new FormData();
          const ext = isVideo ? 'mp4' : 'jpg';
          const mime = asset.type || (isVideo ? 'video/mp4' : 'image/jpeg');

          const safeName = asset.fileName ? asset.fileName.replace(/[^a-zA-Z0-9._-]/g, '_') : `media_${Date.now()}_slot${slotIndex + 1}.${ext}`;

          formData.append('photo', {
            uri: Platform.OS === 'android' ? localUri : localUri.replace('file://', ''),
            type: mime,
            name: safeName,
          });

          console.log('[QuestionnaireScreen] Uploading slot media to /api/profile/upload...', { mime, ext });
          const uploadRes = await apiClient.uploadImage(formData);
          console.log('[QuestionnaireScreen] Cloudinary uploadRes:', uploadRes);

          const cloudinaryUrl = uploadRes?.url || uploadRes?.data?.url || uploadRes?.secure_url;
          console.log('[QuestionnaireScreen] Cloudinary URL for slot:', cloudinaryUrl);

          if (cloudinaryUrl) {
            setPhotos((prevPhotos) => {
              const updated = [...prevPhotos];
              updated[slotIndex] = cloudinaryUrl;
              return updated;
            });
          }
        } catch (uploadErr) {
          console.error('[QuestionnaireScreen] Backend Cloudinary upload error:', uploadErr);
          const errorMsg =
            uploadErr?.data?.message ||
            uploadErr?.message ||
            'Video upload was delayed or encountered a server issue.';
          Alert.alert('Upload Error', errorMsg);
        } finally {
          setUploadingSlotIndex(null);
        }
      }
    });
  };

  const handleRemovePhotoSlot = (slotIndex) => {
    const photoToRemove = photos[slotIndex];
    const updatedPhotos = [...photos];
    updatedPhotos[slotIndex] = null;
    setPhotos(updatedPhotos);

    if (photoToRemove && typeof photoToRemove === 'string' && photoToRemove.trim().length > 0) {
      apiClient.removeProfilePhoto({ imageUrl: photoToRemove, index: slotIndex }).catch((err) => {
        console.log('Error removing photo slot from backend:', err);
      });
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!firstName.trim()) {
        Alert.alert('Required Field', 'Please enter your first name.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      if (selectedInterests.length === 0) {
        Alert.alert('Interests Required', 'Please select at least 1 interest to help us find matches.');
        return;
      }
      setStep(5);
    } else if (step === 5) {
      setStep(6);
    }
  };

  const handleSubmit = async () => {
    console.log('[QuestionnaireScreen] handleSubmit initiated. Current photos array:', photos);
    setLoading(true);

    // Guarantee all local file:// and content:// URIs are uploaded to Cloudinary sequentially before saving questionnaire
    const uploadedPhotosList = [];
    for (let index = 0; index < photos.length; index++) {
      const photoUri = photos[index];
      if (!photoUri) {
        uploadedPhotosList.push(null);
        continue;
      }
      if (typeof photoUri === 'string' && (photoUri.startsWith('http://') || photoUri.startsWith('https://'))) {
        uploadedPhotosList.push(photoUri);
        continue;
      }
      if (typeof photoUri === 'string' && (photoUri.startsWith('file://') || photoUri.startsWith('content://'))) {
        try {
          const isVid = isVideoUrl(photoUri);
          const ext = isVid ? 'mp4' : 'jpg';
          const mime = isVid ? 'video/mp4' : 'image/jpeg';
          const formData = new FormData();
          formData.append('photo', {
            uri: Platform.OS === 'android' ? photoUri : photoUri.replace('file://', ''),
            type: mime,
            name: `media_${Date.now()}_slot${index}.${ext}`,
          });
          console.log(`[QuestionnaireScreen] Uploading local media URI for slot #${index + 1}:`, photoUri);
          const uploadRes = await apiClient.uploadImage(formData);
          console.log(`[QuestionnaireScreen] Cloudinary response for slot #${index + 1}:`, uploadRes);
          const cloudUrl = uploadRes?.url || uploadRes?.secure_url || uploadRes?.data?.url;
          if (cloudUrl && cloudUrl.startsWith('http')) {
            uploadedPhotosList.push(cloudUrl);
            continue;
          }
        } catch (e) {
          console.error(`[QuestionnaireScreen] Error uploading local media for slot #${index + 1}:`, e);
          Alert.alert('Media Upload Error', `Failed to upload media for slot #${index + 1}. Please try selecting the file again.`);
        }
      } else if (photoUri.startsWith('http')) {
        uploadedPhotosList.push(photoUri);
      }
    }

    console.log('[QuestionnaireScreen] Final uploadedPhotosList:', uploadedPhotosList);

    const validPhotos = uploadedPhotosList.filter((p) => p && typeof p === 'string' && p.trim().length > 0);
    const primaryPhoto = validPhotos[0] || null;
    const age = calculateAge();

    // [LOCATION SYNC DISABLED AFTER REGISTRATION]: Live location is captured ONLY at registration time in RegisterScreen.
    // Location check/sync after registration is disabled.
    let coords = null;
    /*
    try {
      coords = await syncUserLocationService(false);
    } catch (locErr) {
      console.log('Location acquisition error during questionnaire submit:', locErr);
    }
    */

    const profileData = {
      firstName: firstName.trim(),
      name: firstName.trim(),
      bdayDay: bdayDay.trim() || '15',
      bdayMonth: bdayMonth.trim() || '08',
      bdayYear: bdayYear.trim() || '1998',
      age: age,
      gender: gender,
      interestedIn: interestedIn,
      orientation: orientation,
      lookingFor: lookingFor,
      drinkHabit: drinkHabit,
      smokeHabit: smokeHabit,
      exercise: exercise,
      pets: pets,
      educationLevel: educationLevel,
      zodiac: zodiac,
      height: height.trim(),
      weight: weight.trim(),
      job: job.trim(),
      college: college.trim(),
      ageRangeMin: parseInt(ageRangeMin, 10) || 22,
      ageRangeMax: parseInt(ageRangeMax, 10) || 35,
      distanceRange: parseInt(distanceRange, 10) || 10,
      bio: bio.trim(),
      interests: selectedInterests,
      languages: selectedLanguages,
      profileImage: primaryPhoto,
      profileImages: validPhotos,
      photos: validPhotos,
      videos: validPhotos.filter((p) => isVideoUrl(p)),
      media: validPhotos,
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      completionPercentage: (() => {
        let computedPct = 0;
        if (firstName.trim()) computedPct += 15;
        const count = validPhotos.length;
        if (count >= 4) computedPct += 25;
        else if (count === 3) computedPct += 20;
        else if (count === 2) computedPct += 15;
        else if (count === 1) computedPct += 10;

        if (bdayYear.trim()) computedPct += 10;
        if (gender) computedPct += 10;
        if (bio.trim()) computedPct += 15;
        if (selectedInterests.length > 0) computedPct += 15;
        if (educationLevel || drinkHabit || smokeHabit || height || weight || job || college) computedPct += 10;
        return Math.min(100, Math.max(0, computedPct));
      })(),
    };

    console.log('[QuestionnaireScreen] Submitting final profileData to saveQuestionnaire API:', profileData);

    const videoUrlsList = validPhotos.filter((p) => isVideoUrl(p));

    setLoading(true);

    try {
      const saveRes = await apiClient.saveQuestionnaire(profileData);
      console.log('[QuestionnaireScreen] saveQuestionnaire API Response:', saveRes);

      if (isEditMode && onCloseModal) {
        onCloseModal();
      }
      if (onFinish) {
        onFinish(profileData);
      } else if (onNavigate && !isEditMode) {
        onNavigate('HOME');
      }
    } catch (err) {
      console.error('[QuestionnaireScreen] Error saving questionnaire to backend:', err);
      const errMsg = err?.data?.message || err?.message || 'Server error while saving profile';
      Alert.alert('Save Profile Error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  const validStoryPhotos = photos.filter((p) => p !== null);

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
          <View style={[styles.containerWrapper, { maxWidth: cardWidth }]}>
            {/* Top Bar with Back Arrow */}
            <View style={styles.editModeHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (isEditMode || onCloseModal) {
                    if (onCloseModal) onCloseModal();
                    else if (onGoBack && onGoBack()) return;
                    else if (onNavigate) onNavigate('HOME');
                  } else if (step > 1) {
                    setStep((prev) => prev - 1);
                  } else {
                    if (onGoBack && onGoBack()) return;
                    if (onNavigate) onNavigate('LOGIN');
                  }
                }}
                style={styles.closeBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.closeBtnText}>
                  {isEditMode || onCloseModal ? '← Back to Profile' : step > 1 ? `← Step ${step - 1}` : '← Back'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.editModeTitle}>
                {isEditMode ? 'Edit Questionnaire' : 'Profile Questionnaire'}
              </Text>
            </View>

            {/* Progress & Step Navigation Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${(step / 6) * 100}%` }]} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {[
                  { id: 1, label: '1. Info' },
                  { id: 2, label: '2. Habits' },
                  { id: 3, label: '3. Details' },
                  { id: 4, label: '4. Bio & Lang' },
                  { id: 5, label: '5. Filters' },
                  { id: 6, label: '6. Photos' },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.stepTabChip, step === tab.id && styles.stepTabChipActive]}
                    onPress={() => setStep(tab.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.stepTabText, step === tab.id && styles.stepTabTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Title Header */}
            <View style={styles.headerContainer}>
              <Text style={styles.title}>
                {step === 1 && 'Basic Information'}
                {step === 2 && 'Lifestyle & Habits'}
                {step === 3 && 'Education & Career'}
                {step === 4 && 'Passions, Bio & Languages'}
                {step === 5 && 'Match Preferences'}
                {step === 6 && 'Photos & Preview'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 1 && 'Tell potential matches who you are'}
                {step === 2 && 'Share your daily habits & lifestyle expectations'}
                {step === 3 && 'Share your education & career background'}
                {step === 4 && 'Show off what makes you unique'}
                {step === 5 && 'Set your ideal distance, age range & zodiac'}
                {step === 6 && 'Upload up to 9 photos from your gallery'}
              </Text>
            </View>

            {/* Card Content */}
            <View style={styles.card}>
              {step === 1 && (
                <>
                  <CustomInput
                    label="First Name"
                    iconType="user"
                    placeholder="e.g. Alex"
                    value={firstName}
                    onChangeText={setFirstName}
                  />

                  <Text style={styles.inputLabel}>Date of Birth</Text>
                  <View style={styles.bdayRow}>
                    <View style={styles.bdayColSmall}>
                      <CustomInput
                        placeholder="DD"
                        keyboardType="number-pad"
                        maxLength={2}
                        value={bdayDay}
                        onChangeText={setBdayDay}
                      />
                    </View>
                    <View style={styles.bdayColSmall}>
                      <CustomInput
                        placeholder="MM"
                        keyboardType="number-pad"
                        maxLength={2}
                        value={bdayMonth}
                        onChangeText={setBdayMonth}
                      />
                    </View>
                    <View style={styles.bdayColLarge}>
                      <CustomInput
                        placeholder="YYYY"
                        keyboardType="number-pad"
                        maxLength={4}
                        value={bdayYear}
                        onChangeText={setBdayYear}
                      />
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>Gender</Text>
                  <View style={styles.optionsRow}>
                    {['Women', 'Male', 'Non-binary'].map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.chip, gender === g && styles.chipSelected]}
                        onPress={() => setGender(g)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[styles.chipText, gender === g && styles.chipTextSelected]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Interested In</Text>
                  <View style={styles.optionsRow}>
                    {['Men', 'Women', 'Everyone'].map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.chip, interestedIn === opt && styles.chipSelected]}
                        onPress={() => setInterestedIn(opt)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[styles.chipText, interestedIn === opt && styles.chipTextSelected]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Sexual Orientation</Text>
                  <View style={styles.wrapRow}>
                    {orientationsList.map((o) => (
                      <TouchableOpacity
                        key={o}
                        style={[styles.wrapChip, orientation === o && styles.chipSelected]}
                        onPress={() => setOrientation(o)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, orientation === o && styles.chipTextSelected]}>
                          {o}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <CustomButton title="CONTINUE" variant="primary" onPress={handleNext} style={styles.nextBtn} />
                </>
              )}

              {/* STEP 2: Lifestyle & Habits */}
              {step === 2 && (
                <>
                  <Text style={styles.inputLabel}>Looking For</Text>
                  <View style={styles.wrapRow}>
                    {lookingForList.map((lf) => (
                      <TouchableOpacity
                        key={lf}
                        style={[styles.wrapChip, lookingFor === lf && styles.chipSelected]}
                        onPress={() => setLookingFor(lf)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, lookingFor === lf && styles.chipTextSelected]}>
                          {lf}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Drink Habit</Text>
                  <View style={styles.optionsRow}>
                    {drinkHabitsList.map((dh) => (
                      <TouchableOpacity
                        key={dh}
                        style={[styles.chip, drinkHabit === dh && styles.chipSelected]}
                        onPress={() => setDrinkHabit(dh)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[styles.chipText, drinkHabit === dh && styles.chipTextSelected]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {dh}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Smoke Habit</Text>
                  <View style={styles.optionsRow}>
                    {smokeHabitsList.map((sh) => (
                      <TouchableOpacity
                        key={sh}
                        style={[styles.chip, smokeHabit === sh && styles.chipSelected]}
                        onPress={() => setSmokeHabit(sh)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[styles.chipText, smokeHabit === sh && styles.chipTextSelected]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {sh}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Workout / Exercise</Text>
                  <View style={styles.optionsRow}>
                    {exerciseHabitsList.map((ex) => (
                      <TouchableOpacity
                        key={ex}
                        style={[styles.chip, exercise === ex && styles.chipSelected]}
                        onPress={() => setExercise(ex)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[styles.chipText, exercise === ex && styles.chipTextSelected]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {ex}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Pets</Text>
                  <View style={styles.optionsRow}>
                    {petsOptionsList.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.chip, pets === p && styles.chipSelected]}
                        onPress={() => setPets(p)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[styles.chipText, pets === p && styles.chipTextSelected]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)} activeOpacity={0.8}>
                      <Text style={styles.backBtnText}>BACK</Text>
                    </TouchableOpacity>
                    <CustomButton title="NEXT" variant="primary" onPress={handleNext} style={styles.flexBtn} />
                  </View>
                </>
              )}

              {/* STEP 3: Education & Career */}
              {step === 3 && (
                <>
                  {/* Education Level Question */}
                  <Text style={styles.inputLabel}>🎓 Education Level</Text>
                  <View style={styles.wrapRow}>
                    {educationLevelsList.map((edu) => (
                      <TouchableOpacity
                        key={edu}
                        style={[styles.wrapChip, educationLevel === edu && styles.chipSelected]}
                        onPress={() => setEducationLevel(edu)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, educationLevel === edu && styles.chipTextSelected]}>
                          {edu}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Height Question */}
                  <Text style={styles.inputLabel}>📏 Height</Text>
                  <View style={styles.wrapRow}>
                    {heightOptionsList.map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[styles.wrapChip, height === h && styles.chipSelected]}
                        onPress={() => setHeight(h)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, height === h && styles.chipTextSelected]}>
                          {h}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <CustomInput
                    placeholder="Or enter custom height (e.g. 5'9&quot; or 175 cm)"
                    value={height}
                    onChangeText={setHeight}
                  />

                  {/* Weight Question */}
                  <Text style={styles.inputLabel}>⚖️ Weight</Text>
                  <View style={styles.wrapRow}>
                    {weightOptionsList.map((w) => (
                      <TouchableOpacity
                        key={w}
                        style={[styles.wrapChip, weight === w && styles.chipSelected]}
                        onPress={() => setWeight(w)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, weight === w && styles.chipTextSelected]}>
                          {w}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <CustomInput
                    placeholder="Or enter custom weight (e.g. 62 kg or 136 lbs)"
                    value={weight}
                    onChangeText={setWeight}
                  />

                  {/* Job / Occupation Question */}
                  <Text style={styles.inputLabel}>💼 Job / Occupation</Text>
                  <View style={styles.wrapRow}>
                    {jobExamplesList.map((j) => {
                      const titleOnly = j.replace(/^[^\s]+\s/, '');
                      const isSelected = job === titleOnly || job === j;
                      return (
                        <TouchableOpacity
                          key={j}
                          style={[styles.wrapChip, isSelected && styles.chipSelected]}
                          onPress={() => setJob(titleOnly)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                            {j}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <CustomInput
                    placeholder="e.g. Software Engineer, Teacher, Doctor, Student, Business Owner"
                    value={job}
                    onChangeText={setJob}
                  />

                  {/* College / University Question */}
                  <CustomInput
                    label="🏛️ College / University"
                    placeholder="e.g. Harvard University, Stanford, MIT..."
                    value={college}
                    onChangeText={setCollege}
                  />

                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)} activeOpacity={0.8}>
                      <Text style={styles.backBtnText}>BACK</Text>
                    </TouchableOpacity>
                    <CustomButton title="NEXT" variant="primary" onPress={handleNext} style={styles.flexBtn} />
                  </View>
                </>
              )}

              {/* STEP 4: Passions, Bio & Languages */}
              {step === 4 && (
                <>
                  <CustomInput
                    label="Bio / About Me"
                    placeholder="Tell potential matches about yourself..."
                    multiline
                    numberOfLines={3}
                    value={bio}
                    onChangeText={setBio}
                    style={styles.bioInput}
                  />

                  <Text style={styles.inputLabel}>🗣️ Languages Spoken</Text>
                  <View style={styles.interestsWrap}>
                    {languageOptionsList.map((lang) => {
                      const isSelected = selectedLanguages.includes(lang);
                      return (
                        <TouchableOpacity
                          key={lang}
                          style={[styles.interestChip, isSelected && styles.interestChipSelected]}
                          onPress={() => toggleLanguage(lang)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.interestChipText, isSelected && styles.interestChipTextSelected]}>
                            {lang}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.inputLabel}>Select Your Interests (Max 6)</Text>
                  <View style={styles.interestsWrap}>
                    {interestOptionsList.map((item) => {
                      const isSelected = selectedInterests.includes(item);
                      return (
                        <TouchableOpacity
                          key={item}
                          style={[styles.interestChip, isSelected && styles.interestChipSelected]}
                          onPress={() => toggleInterest(item)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.interestChipText, isSelected && styles.interestChipTextSelected]}>
                            {item}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => setStep(3)} activeOpacity={0.8}>
                      <Text style={styles.backBtnText}>BACK</Text>
                    </TouchableOpacity>
                    <CustomButton title="NEXT" variant="primary" onPress={handleNext} style={styles.flexBtn} />
                  </View>
                </>
              )}

              {/* STEP 5: Match Preferences & Zodiac */}
              {step === 5 && (
                <>
                  {/* Maximum Distance Preference */}
                  <Text style={styles.inputLabel}>📍 Maximum Distance Preference: {distanceRange} km</Text>
                  <View style={styles.sliderRow}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setDistanceRange(Math.max(1, (parseInt(distanceRange, 10) || 10) - 5).toString())}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stepBtnText}>-</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginHorizontal: 6 }}>
                      {['5', '10', '25', '50', '100'].map((dist) => (
                        <TouchableOpacity
                          key={dist}
                          style={[styles.distChip, distanceRange === dist && styles.chipSelected]}
                          onPress={() => setDistanceRange(dist)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, distanceRange === dist && styles.chipTextSelected]}>
                            {dist} km
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setDistanceRange(Math.min(200, (parseInt(distanceRange, 10) || 10) + 5).toString())}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Age Range Preference */}
                  <Text style={styles.inputLabel}>
                    🎂 Preferred Age Range: {ageRangeMin} - {ageRangeMax} years old
                  </Text>

                  {/* Minimum Preferred Age */}
                  <Text style={styles.subInputLabel}>Min Age Preference: ({ageRangeMin} yrs)</Text>
                  <View style={styles.sliderRow}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setAgeRangeMin(Math.max(18, (parseInt(ageRangeMin, 10) || 18) - 1).toString())}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stepBtnText}>-</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginHorizontal: 6 }}>
                      {['18', '20', '22', '25', '28', '30'].map((val) => (
                        <TouchableOpacity
                          key={val}
                          style={[styles.distChip, ageRangeMin === val && styles.chipSelected]}
                          onPress={() => setAgeRangeMin(val)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, ageRangeMin === val && styles.chipTextSelected]}>
                            {val} yrs
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setAgeRangeMin(Math.min(parseInt(ageRangeMax, 10) - 1, (parseInt(ageRangeMin, 10) || 18) + 1).toString())}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Maximum Preferred Age */}
                  <Text style={styles.subInputLabel}>Max Age Preference: ({ageRangeMax} yrs)</Text>
                  <View style={styles.sliderRow}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setAgeRangeMax(Math.max(parseInt(ageRangeMin, 10) + 1, (parseInt(ageRangeMax, 10) || 35) - 1).toString())}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stepBtnText}>-</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginHorizontal: 6 }}>
                      {['25', '30', '35', '40', '45', '50', '60'].map((val) => (
                        <TouchableOpacity
                          key={val}
                          style={[styles.distChip, ageRangeMax === val && styles.chipSelected]}
                          onPress={() => setAgeRangeMax(val)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, ageRangeMax === val && styles.chipTextSelected]}>
                            {val} yrs
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setAgeRangeMax(Math.min(75, (parseInt(ageRangeMax, 10) || 35) + 1).toString())}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Zodiac Sign Question */}
                  <Text style={styles.inputLabel}>⭐ Zodiac Sign</Text>
                  <View style={styles.wrapRow}>
                    {zodiacSignsList.map((z) => (
                      <TouchableOpacity
                        key={z}
                        style={[styles.wrapChip, zodiac === z && styles.chipSelected]}
                        onPress={() => setZodiac(z)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, zodiac === z && styles.chipTextSelected]}>
                          {z}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => setStep(4)} activeOpacity={0.8}>
                      <Text style={styles.backBtnText}>BACK</Text>
                    </TouchableOpacity>
                    <CustomButton title="NEXT" variant="primary" onPress={handleNext} style={styles.flexBtn} />
                  </View>
                </>
              )}

              {/* STEP 6: Photos & Preview */}
              {step === 6 && (
                <>
                  {/* Status / Story Horizontal Carousel Preview */}
                  <Text style={styles.inputLabel}>📸 Status / Story Preview</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storyRow}>
                    {validStoryPhotos.map((url, idx) => {
                      const isVid = isVideoUrl(url);
                      const thumb = getVideoThumbnailUrl(url);
                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => setActiveStoryIndex(idx)}
                          activeOpacity={0.8}
                          style={styles.storyRing}
                        >
                          {isVid ? (
                            <Video
                              source={{ uri: url }}
                              style={styles.storyThumb}
                              paused={true}
                              muted={true}
                              resizeMode="cover"
                            />
                          ) : (
                            <Image source={{ uri: thumb }} style={styles.storyThumb} />
                          )}
                          <Text style={styles.storyBadge}>{isVid ? '🎬 Video' : `Photo #${idx + 1}`}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* 9 Photo & Video Slots Grid */}
                  <Text style={styles.inputLabel}>Upload Photos & Preview Videos (Up to 9 Slots)</Text>
                  <Text style={styles.gridSubtext}>Slot #1 is your Main Profile Picture (Photo only). Slots #2 through #9 support photos & short video clips (up to 15s).</Text>

                  <View style={styles.gridContainer}>
                    {photos.map((photoUri, index) => {
                      const isVid = isVideoUrl(photoUri);
                      const thumbUri = photoUri ? getVideoThumbnailUrl(photoUri) : null;
                      return (
                        <View key={index} style={[styles.gridSlot, { width: slotWidth, height: slotHeight }]}>
                          {photoUri ? (
                            <View style={styles.slotImageWrapper}>
                              {isVid ? (
                                <Video
                                  source={{ uri: photoUri }}
                                  style={styles.slotImage}
                                  paused={true}
                                  muted={true}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Image source={{ uri: thumbUri }} style={styles.slotImage} />
                              )}
                              {isVid ? (
                                <View style={[styles.mainBadge, { backgroundColor: '#3897F0' }]}>
                                  <Text style={styles.mainBadgeText}>📹 Video</Text>
                                </View>
                              ) : index === 0 ? (
                                <View style={styles.mainBadge}>
                                  <Text style={styles.mainBadgeText}>Main</Text>
                                </View>
                              ) : null}
                              {uploadingSlotIndex === index && (
                                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderRadius: 12 }}>
                                  <ActivityIndicator size="small" color="#FE3C72" />
                                </View>
                              )}
                              <TouchableOpacity
                                style={styles.deleteSlotBtn}
                                onPress={() => handleRemovePhotoSlot(index)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.deleteSlotText}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.emptySlotBtn}
                              onPress={() => handlePickImageForSlot(index)}
                              activeOpacity={0.7}
                            >
                              {uploadingSlotIndex === index ? (
                                <ActivityIndicator size="small" color="#FE3C72" />
                              ) : (
                                <>
                                  <Text style={styles.plusIcon}>+</Text>
                                  <Text style={styles.slotLabel}>Slot {index + 1}</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => setStep(5)} activeOpacity={0.8}>
                      <Text style={styles.backBtnText}>BACK</Text>
                    </TouchableOpacity>
                    <CustomButton
                      title={isEditMode ? "SAVE CHANGES" : "COMPLETE PROFILE"}
                      variant="primary"
                      loading={loading}
                      onPress={handleSubmit}
                      style={styles.flexBtn}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fullscreen Status & Photo Preview Modal */}
      <PreviewModal
        visible={activeStoryIndex !== null}
        photos={validStoryPhotos}
        initialIndex={activeStoryIndex || 0}
        userName={firstName || 'My Status'}
        userAvatar={validStoryPhotos[0]}
        onClose={() => setActiveStoryIndex(null)}
        onHideMedia={(hiddenUrl, index) => {
          if (typeof index === 'number' && index >= 0) {
            handleRemovePhotoSlot(index);
          }
        }}
      />
    </SimulatedGradientBackground>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
    alignItems: 'center',
  },
  containerWrapper: {
    width: '100%',
  },
  editModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  editModeTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  stepTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  stepTabChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  stepTabChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  stepTabText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  stepTabTextActive: {
    color: '#FE3C72',
    fontWeight: '800',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    width: '100%',
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
    marginLeft: 2,
    marginTop: 14,
    letterSpacing: 0.3,
  },
  subInputLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
    marginLeft: 2,
  },
  gridSubtext: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 2,
  },
  bdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  bdayColSmall: {
    flex: 1,
    marginRight: 8,
  },
  bdayColLarge: {
    flex: 1.4,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  scrollOptions: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  distChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  wrapChip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    margin: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  scrollChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  chipSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  chipTextSelected: {
    color: '#FE3C72',
    fontWeight: '900',
  },
  bioInput: {
    minHeight: 85,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingVertical: 10,
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  interestChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    margin: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  interestChipSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  interestChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  interestChipTextSelected: {
    color: '#FE3C72',
    fontWeight: '700',
  },
  storyRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  storyRing: {
    alignItems: 'center',
    marginRight: 12,
    padding: 3,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#FE3C72',
  },
  storyThumb: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  storyBadge: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridSlot: {
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderStyle: 'dashed',
  },
  slotImageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  mainBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#FE3C72',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  mainBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  deleteSlotBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteSlotText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  emptySlotBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  slotLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    marginTop: 2,
  },
  nextBtn: {
    marginTop: 18,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  backBtn: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  flexBtn: {
    flex: 1,
    marginVertical: 0,
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
  storyFullImage: {
    borderRadius: 16,
  },
  storyCounter: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 16,
    fontWeight: '600',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  distanceChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  diagOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  diagCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 20,
  },
  diagCardSuccess: {
    backgroundColor: '#121E17',
    borderColor: '#2ECC71',
  },
  diagCardError: {
    backgroundColor: '#201416',
    borderColor: '#FF4D4D',
  },
  diagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  diagEmoji: {
    fontSize: 28,
    marginRight: 10,
  },
  diagTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  diagScroll: {
    maxHeight: 240,
    marginVertical: 8,
  },
  diagMessage: {
    fontSize: 14,
    color: '#E0E6ED',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  diagFooter: {
    marginTop: 18,
    alignItems: 'center',
  },
  diagTimerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
  },
  diagTimerText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '600',
  },
  diagDismissBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagDismissBtnSuccess: {
    backgroundColor: '#2ECC71',
  },
  diagDismissBtnError: {
    backgroundColor: '#FF4D4D',
  },
  diagDismissText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
});

export default QuestionnaireScreen;
