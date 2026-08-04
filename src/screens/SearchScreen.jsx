import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { apiClient } from '../api/apiClient';
import { getImageUrl } from '../api/config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

export function SearchScreen({ onSelectProfile }) {
  // Search Bar State
  const [searchKeyword, setSearchKeyword] = useState('');
  
  // Results & Pagination States
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Master Filter Options & Saved Preferences
  const [filterOptions, setFilterOptions] = useState({
    interests: ['Music', 'Travel', 'Fitness', 'Gaming', 'Photography', 'Cooking', 'Art', 'Tech', 'Movies', 'Sports'],
    languages: ['English', 'Spanish', 'French', 'German', 'Hindi', 'Marathi', 'Mandarin', 'Japanese'],
    professions: ['Software Engineer', 'Doctor', 'Designer', 'Teacher', 'Entrepreneur', 'Student', 'Architect'],
    drinkHabits: ['Never', 'Socially', 'Regularly'],
    smokeHabits: ['No', 'Socially', 'Regularly'],
    exerciseHabits: ['Active', 'Sometimes', 'Never'],
    petsOptions: ['Dog lover', 'Cat lover', 'No pets', 'Has pets'],
    educationLevels: ['High School', 'Bachelors', 'Masters', 'PhD'],
    zodiacSigns: ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'],
    lookingForOptions: ['Long-term relationship', 'Casual dating', 'Friendship', 'Not sure'],
  });

  // Active Filter Controls State
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(50);
  const [distanceKm, setDistanceKm] = useState(50);
  const [selectedGender, setSelectedGender] = useState('Everyone');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [selectedDrinkHabits, setSelectedDrinkHabits] = useState([]);
  const [selectedSmokeHabits, setSelectedSmokeHabits] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState([]);
  const [selectedPets, setSelectedPets] = useState([]);
  const [selectedEducation, setSelectedEducation] = useState([]);
  const [selectedZodiac, setSelectedZodiac] = useState([]);
  const [selectedLookingFor, setSelectedLookingFor] = useState([]);
  const [sortBy, setSortBy] = useState('matchPercentage');

  // Modal Visibility State
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Expanded Profile View & Action States
  const [selectedProfileModal, setSelectedProfileModal] = useState(null);
  const [actionStatusMap, setActionStatusMap] = useState({});
  const [matchedCelebrationUser, setMatchedCelebrationUser] = useState(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Initialize Search & Load Filter Metadata
  useEffect(() => {
    loadMasterFilterOptions();
    loadUserSavedPreferences();
  }, []);

  const loadMasterFilterOptions = async () => {
    try {
      const res = await apiClient.getFilterOptions();
      if (res && res.options) {
        setFilterOptions(res.options);
      }
    } catch (err) {
      console.log('Error fetching filter options:', err);
    }
  };

  const loadUserSavedPreferences = async () => {
    try {
      const res = await apiClient.getSearchPreferences();
      if (res && res.preferences) {
        const p = res.preferences;
        if (p.ageMin) setAgeMin(p.ageMin);
        if (p.ageMax) setAgeMax(p.ageMax);
        if (p.distanceKm) setDistanceKm(p.distanceKm);
        if (p.gender) setSelectedGender(p.gender);
        if (p.interests) setSelectedInterests(p.interests);
        if (p.languages) setSelectedLanguages(p.languages);
        if (p.sortBy) setSortBy(p.sortBy);
        if (p.lifestyle) {
          if (p.lifestyle.drinkHabit) setSelectedDrinkHabits(p.lifestyle.drinkHabit);
          if (p.lifestyle.smokeHabit) setSelectedSmokeHabits(p.lifestyle.smokeHabit);
          if (p.lifestyle.exercise) setSelectedExercise(p.lifestyle.exercise);
          if (p.lifestyle.pets) setSelectedPets(p.lifestyle.pets);
          if (p.lifestyle.educationLevel) setSelectedEducation(p.lifestyle.educationLevel);
          if (p.lifestyle.zodiac) setSelectedZodiac(p.lifestyle.zodiac);
          if (p.lifestyle.lookingFor) setSelectedLookingFor(p.lifestyle.lookingFor);
        }
      }
      // Execute initial search query with defaults
      executeSearch(1, true);
    } catch (err) {
      console.log('Error fetching search preferences:', err);
      executeSearch(1, true);
    }
  };

  // Main Execute Search API Call
  const executeSearch = async (pageNum = 1, isInitialOrRefetch = false) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const payload = {
        profession: searchKeyword.trim(),
        ageMin,
        ageMax,
        distanceKm,
        gender: selectedGender,
        interests: selectedInterests,
        languages: selectedLanguages,
        lifestyle: {
          drinkHabit: selectedDrinkHabits,
          smokeHabit: selectedSmokeHabits,
          exercise: selectedExercise,
          pets: selectedPets,
          educationLevel: selectedEducation,
          zodiac: selectedZodiac,
          lookingFor: selectedLookingFor,
        },
        sortBy,
        page: pageNum,
        limit: 15,
      };

      const res = await apiClient.advancedSearch(payload);
      if (res && res.success) {
        if (pageNum === 1 || isInitialOrRefetch) {
          setResults(res.users || []);
        } else {
          setResults((prev) => [...prev, ...(res.users || [])]);
        }
        setTotalCount(res.totalCount || 0);
        setPage(res.page || 1);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.error('Search API Error:', err);
      Alert.alert('Search Error', err?.data?.message || err?.message || 'Unable to execute search.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleApplyFilters = () => {
    setShowFilterModal(false);
    executeSearch(1, true);
  };

  const handleSavePreferences = async () => {
    try {
      const prefsPayload = {
        ageMin,
        ageMax,
        distanceKm,
        gender: selectedGender,
        interests: selectedInterests,
        languages: selectedLanguages,
        sortBy,
        lifestyle: {
          drinkHabit: selectedDrinkHabits,
          smokeHabit: selectedSmokeHabits,
          exercise: selectedExercise,
          pets: selectedPets,
          educationLevel: selectedEducation,
          zodiac: selectedZodiac,
          lookingFor: selectedLookingFor,
        },
      };
      await apiClient.updateSearchPreferences(prefsPayload);
      Alert.alert('Success', 'Search filter preferences saved as default!');
    } catch (err) {
      Alert.alert('Error', 'Failed to save search preferences.');
    }
  };

  const handleResetFilters = () => {
    setSearchKeyword('');
    setAgeMin(18);
    setAgeMax(50);
    setDistanceKm(50);
    setSelectedGender('Everyone');
    setSelectedInterests([]);
    setSelectedLanguages([]);
    setSelectedDrinkHabits([]);
    setSelectedSmokeHabits([]);
    setSelectedExercise([]);
    setSelectedPets([]);
    setSelectedEducation([]);
    setSelectedZodiac([]);
    setSelectedLookingFor([]);
    setSortBy('matchPercentage');
  };

  const handleLikeProfile = async (targetProfile, actionType = 'like') => {
    if (!targetProfile) return;
    const targetId = targetProfile._id || targetProfile.id;

    try {
      const res = actionType === 'superlike'
        ? await apiClient.superLikeUser({ targetUserId: targetId })
        : await apiClient.likeUser({ targetUserId: targetId });

      const isMatch = res?.isMatch || res?.matched || res?.status === 'match';

      if (isMatch) {
        setActionStatusMap((prev) => ({ ...prev, [targetId]: 'matched' }));
        setMatchedCelebrationUser(targetProfile);
      } else {
        setActionStatusMap((prev) => ({ ...prev, [targetId]: actionType === 'superlike' ? 'superliked' : 'liked' }));
        Alert.alert(
          actionType === 'superlike' ? 'Super Liked! ⭐' : 'Profile Liked! ❤️',
          `You liked ${targetProfile.firstName || targetProfile.name}!`
        );
      }
    } catch (err) {
      console.log('Error liking profile from search:', err);
      setActionStatusMap((prev) => ({ ...prev, [targetId]: actionType === 'superlike' ? 'superliked' : 'liked' }));
      Alert.alert('Liked!', `You liked ${targetProfile.firstName || targetProfile.name}!`);
    } finally {
      setSelectedProfileModal(null);
    }
  };

  const handlePassProfile = async (targetProfile) => {
    if (!targetProfile) return;
    const targetId = targetProfile._id || targetProfile.id;

    try {
      await apiClient.likeUser({
        targetUserId: targetId,
        action: 'pass',
      });
    } catch (err) {
      console.log('Error passing profile from search:', err);
    } finally {
      setActionStatusMap((prev) => ({ ...prev, [targetId]: 'passed' }));
      setSelectedProfileModal(null);
    }
  };

  const handleReportProfile = (targetProfile) => {
    Alert.alert(
      'Report / Block Profile',
      `Select an action for ${targetProfile.firstName || targetProfile.name}:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report Profile 🚩',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.reportUser({
                targetUserId: targetProfile._id || targetProfile.id,
                reason: 'Inappropriate behavior or fake profile',
              });
              Alert.alert('Reported', 'Thank you for making our community safe.');
              setSelectedProfileModal(null);
            } catch (err) {
              Alert.alert('Reported', 'Profile reported to support.');
              setSelectedProfileModal(null);
            }
          },
        },
        {
          text: 'Block User 🚫',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.blockUser({
                targetUserId: targetProfile._id || targetProfile.id,
              });
              setActionStatusMap((prev) => ({ ...prev, [targetProfile._id || targetProfile.id]: 'passed' }));
              Alert.alert('Blocked', `${targetProfile.firstName || targetProfile.name} has been blocked.`);
              setSelectedProfileModal(null);
            } catch (err) {
              Alert.alert('Blocked', 'User blocked.');
              setSelectedProfileModal(null);
            }
          },
        },
      ]
    );
  };

  const toggleSelection = (item, list, setList) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Header Bar */}
      <View style={styles.searchHeader}>
        <View style={styles.inputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search profession, job, college..."
            placeholderTextColor="#8E8E93"
            value={searchKeyword}
            onChangeText={setSearchKeyword}
            onSubmitEditing={() => executeSearch(1, true)}
            returnKeyType="search"
          />
          {searchKeyword.length > 0 && (
            <TouchableOpacity onPress={() => setSearchKeyword('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Modal Toggle Button */}
        <TouchableOpacity style={styles.filterToggleBtn} onPress={() => setShowFilterModal(true)}>
          <Text style={styles.filterToggleIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Active Filters Summary Pills */}
      <View style={styles.activePillsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
          <View style={styles.pillBadge}>
            <Text style={styles.pillText}>Age: {ageMin}-{ageMax}</Text>
          </View>
          <View style={styles.pillBadge}>
            <Text style={styles.pillText}>Distance: {distanceKm} km</Text>
          </View>
          {selectedInterests.length > 0 && (
            <View style={styles.pillBadgeActive}>
              <Text style={styles.pillTextActive}>Interests ({selectedInterests.length})</Text>
            </View>
          )}
          {selectedLanguages.length > 0 && (
            <View style={styles.pillBadgeActive}>
              <Text style={styles.pillTextActive}>Languages ({selectedLanguages.length})</Text>
            </View>
          )}
          {searchKeyword.length > 0 && (
            <View style={styles.pillBadgeActive}>
              <Text style={styles.pillTextActive}>Keyword: {searchKeyword}</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Results Header Count */}
      <View style={styles.resultsCountHeader}>
        <Text style={styles.resultsCountText}>
          {totalCount} {totalCount === 1 ? 'Matching Profile' : 'Matching Profiles'} Found
        </Text>
      </View>

      {/* Profile Results List */}
      {isLoading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF4458" />
          <Text style={styles.loadingText}>Searching matching profiles...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id.toString()}
          onRefresh={() => {
            setIsRefreshing(true);
            executeSearch(1, true);
          }}
          refreshing={isRefreshing}
          contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 30 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No Profiles Found</Text>
              <Text style={styles.emptySubtitle}>Try broadening your age, distance, or interest filters.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = actionStatusMap[item._id || item.id];
            return (
              <TouchableOpacity
                style={[styles.profileCard, status === 'passed' && { opacity: 0.6 }]}
                activeOpacity={0.9}
                onPress={() => {
                  setSelectedProfileModal(item);
                  setActivePhotoIndex(0);
                  if (onSelectProfile) onSelectProfile(item);
                }}
              >
                {/* Profile Image & Badges */}
                <View style={styles.cardHeaderImageRow}>
                <Image
                  source={{
                    uri: item.profileImage
                      ? getImageUrl(item.profileImage)
                      : (item.profileImages && item.profileImages[0]
                          ? getImageUrl(item.profileImages[0])
                          : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400')
                  }}
                  style={styles.cardAvatar}
                />
                <View style={styles.cardHeaderMeta}>
                  <View style={styles.nameRow}>
                    <Text style={styles.cardName}>{item.firstName || item.name}</Text>
                    {item.age && <Text style={styles.cardAge}>, {item.age}</Text>}
                  </View>

                  {item.job ? (
                    <Text style={styles.cardJob}>💼 {item.job}</Text>
                  ) : null}

                  {item.college ? (
                    <Text style={styles.cardCollege}>🎓 {item.college}</Text>
                  ) : null}
                </View>

                {/* Match Percentage Badge */}
                <View style={styles.matchScoreBadge}>
                  <Text style={styles.matchScoreText}>{item.matchPercentage}%</Text>
                  <Text style={styles.matchScoreLabel}>Match</Text>
                </View>
              </View>

              {/* Bio snippet */}
              {item.bio ? (
                <Text style={styles.cardBio} numberOfLines={2}>
                  {item.bio}
                </Text>
              ) : null}

              {/* Badges Footer Row */}
              <View style={styles.cardFooterRow}>
                {item.calculatedDistanceKm !== null && item.calculatedDistanceKm !== undefined && (
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceBadgeText}>📍 {item.calculatedDistanceKm} km away</Text>
                  </View>
                )}

                {item.languages && item.languages.length > 0 && (
                  <View style={styles.langBadge}>
                    <Text style={styles.langBadgeText}>🗣️ {item.languages.slice(0, 2).join(', ')}</Text>
                  </View>
                )}
              </View>

              {/* Common Interests Chips */}
              {item.commonInterests && item.commonInterests.length > 0 && (
                <View style={styles.interestsRow}>
                  {item.commonInterests.slice(0, 4).map((interest, idx) => (
                    <View key={idx} style={styles.commonInterestChip}>
                      <Text style={styles.commonInterestText}>✓ {interest}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Action Status Pill Badge */}
              {status && (
                <View style={[styles.cardStatusBadge, status === 'matched' ? styles.statusBadgeMatched : status === 'passed' ? styles.statusBadgePassed : styles.statusBadgeLiked]}>
                  <Text style={styles.cardStatusBadgeText}>
                    {status === 'matched' ? '🎉 Matched!' : status === 'passed' ? '✖ Passed' : status === 'superliked' ? '⭐ Super Liked' : '❤️ Liked'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
          onEndReached={() => {
            if (page < totalPages && !isLoading) {
              executeSearch(page + 1);
            }
          }}
          onEndReachedThreshold={0.4}
        />
      )}

      {/* Filter Modal Overlay */}
      <Modal visible={showFilterModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalSafeArea}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Text style={styles.modalCloseBtn}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Advanced Filters</Text>
            <TouchableOpacity onPress={handleResetFilters}>
              <Text style={styles.modalResetBtn}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Age Range Section */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionHeading}>Age Range: {ageMin} - {ageMax} yrs</Text>
              <View style={styles.rangeControlRow}>
                <TouchableOpacity
                  onPress={() => setAgeMin((prev) => Math.max(18, prev - 1))}
                  style={styles.counterBtn}
                >
                  <Text style={styles.counterBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterLabel}>Min: {ageMin}</Text>
                <TouchableOpacity
                  onPress={() => setAgeMin((prev) => Math.min(ageMax - 1, prev + 1))}
                  style={styles.counterBtn}
                >
                  <Text style={styles.counterBtnText}>+</Text>
                </TouchableOpacity>

                <View style={{ width: 20 }} />

                <TouchableOpacity
                  onPress={() => setAgeMax((prev) => Math.max(ageMin + 1, prev - 1))}
                  style={styles.counterBtn}
                >
                  <Text style={styles.counterBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterLabel}>Max: {ageMax}</Text>
                <TouchableOpacity
                  onPress={() => setAgeMax((prev) => Math.min(100, prev + 1))}
                  style={styles.counterBtn}
                >
                  <Text style={styles.counterBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Distance Radius Section */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionHeading}>Maximum Distance: {distanceKm} km</Text>
              <View style={styles.distanceChipsRow}>
                {[10, 25, 50, 100, 200].map((km) => (
                  <TouchableOpacity
                    key={km}
                    onPress={() => setDistanceKm(km)}
                    style={[styles.chip, distanceKm === km && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, distanceKm === km && styles.chipTextActive]}>
                      {km} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sort Order Section */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionHeading}>Sort Results By</Text>
              <View style={styles.chipsWrapContainer}>
                {[
                  { label: '🔥 Match %', value: 'matchPercentage' },
                  { label: '📍 Distance', value: 'distance' },
                  { label: '🎂 Age', value: 'age' },
                  { label: '🆕 Newest', value: 'recent' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    onPress={() => setSortBy(s.value)}
                    style={[styles.chip, sortBy === s.value && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, sortBy === s.value && styles.chipTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Interests Section */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionHeading}>Interests</Text>
              <View style={styles.chipsWrapContainer}>
                {filterOptions.interests.map((item) => {
                  const isSelected = selectedInterests.includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => toggleSelection(item, selectedInterests, setSelectedInterests)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Languages Section */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionHeading}>Languages Spoken</Text>
              <View style={styles.chipsWrapContainer}>
                {filterOptions.languages.map((item) => {
                  const isSelected = selectedLanguages.includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => toggleSelection(item, selectedLanguages, setSelectedLanguages)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Lifestyle Choices Section */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionHeading}>Drinking Habits</Text>
              <View style={styles.chipsWrapContainer}>
                {filterOptions.drinkHabits.map((item) => {
                  const isSelected = selectedDrinkHabits.includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => toggleSelection(item, selectedDrinkHabits, setSelectedDrinkHabits)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionHeading, { marginTop: 15 }]}>Smoking Habits</Text>
              <View style={styles.chipsWrapContainer}>
                {filterOptions.smokeHabits.map((item) => {
                  const isSelected = selectedSmokeHabits.includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => toggleSelection(item, selectedSmokeHabits, setSelectedSmokeHabits)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Modal Footer Buttons */}
          <View style={styles.modalFooterRow}>
            <TouchableOpacity style={styles.savePrefBtn} onPress={handleSavePreferences}>
              <Text style={styles.savePrefBtnText}>💾 Save Default</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={handleApplyFilters}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Expanded Profile Detail Modal */}
      <Modal visible={!!selectedProfileModal} animationType="slide" transparent={false}>
        {selectedProfileModal && (
          <SafeAreaView style={styles.expandedModalSafeArea}>
            {/* Top Navigation Bar */}
            <View style={styles.expandedNavHeader}>
              <TouchableOpacity
                style={styles.expandedBackBtn}
                onPress={() => setSelectedProfileModal(null)}
              >
                <Text style={styles.expandedBackIcon}>←</Text>
              </TouchableOpacity>
              <Text style={styles.expandedNavTitle} numberOfLines={1}>
                {selectedProfileModal.firstName || selectedProfileModal.name}'s Profile
              </Text>
              <TouchableOpacity
                style={styles.expandedReportBtn}
                onPress={() => handleReportProfile(selectedProfileModal)}
              >
                <Text style={styles.expandedReportIcon}>⋮</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.expandedContentScroll} showsVerticalScrollIndicator={false}>
              {/* Photo Carousel Header */}
              <View style={styles.photoCarouselContainer}>
                {(() => {
                  const photos = [
                    selectedProfileModal.profileImage,
                    ...(selectedProfileModal.profileImages || []),
                  ].filter(Boolean);
                  const displayPhotos = photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'];
                  const activePhoto = displayPhotos[activePhotoIndex % displayPhotos.length];

                  return (
                    <View style={styles.carouselImageWrapper}>
                      <Image source={{ uri: getImageUrl(activePhoto) }} style={styles.carouselImage} />
                      {displayPhotos.length > 1 && (
                        <View style={styles.photoIndicatorRow}>
                          {displayPhotos.map((_, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={[
                                styles.photoIndicatorDot,
                                idx === activePhotoIndex && styles.photoIndicatorDotActive,
                              ]}
                              onPress={() => setActivePhotoIndex(idx)}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })()}

                {/* Match Percentage Floating Badge */}
                <View style={styles.expandedMatchBadge}>
                  <Text style={styles.expandedMatchBadgeText}>
                    ✨ {selectedProfileModal.matchPercentage || 85}% Match
                  </Text>
                </View>
              </View>

              {/* Identity & Basic Info Header */}
              <View style={styles.expandedInfoSection}>
                <View style={styles.expandedNameRow}>
                  <Text style={styles.expandedNameText}>
                    {selectedProfileModal.firstName || selectedProfileModal.name}
                  </Text>
                  {selectedProfileModal.age && (
                    <Text style={styles.expandedAgeText}>, {selectedProfileModal.age}</Text>
                  )}
                  {selectedProfileModal.isVerified && (
                    <Text style={styles.verifiedCheckIcon}> ✔</Text>
                  )}
                </View>

                {/* Location / Distance */}
                <View style={styles.expandedMetaRow}>
                  <Text style={styles.expandedDistanceText}>
                    📍 {selectedProfileModal.calculatedDistanceKm
                      ? `${selectedProfileModal.calculatedDistanceKm} km away`
                      : (selectedProfileModal.distanceText || selectedProfileModal.distance || 'Near you')}
                  </Text>
                </View>

                {/* Work & College */}
                {(selectedProfileModal.job || selectedProfileModal.profession) ? (
                  <View style={styles.expandedMetaRow}>
                    <Text style={styles.expandedJobText}>
                      💼 {selectedProfileModal.job || selectedProfileModal.profession}
                    </Text>
                  </View>
                ) : null}

                {selectedProfileModal.college ? (
                  <View style={styles.expandedMetaRow}>
                    <Text style={styles.expandedCollegeText}>
                      🎓 {selectedProfileModal.college}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Bio Section */}
              {selectedProfileModal.bio ? (
                <View style={styles.expandedSectionBox}>
                  <Text style={styles.expandedSectionHeader}>About Me</Text>
                  <Text style={styles.expandedBioText}>{selectedProfileModal.bio}</Text>
                </View>
              ) : null}

              {/* Interests & Languages */}
              {((selectedProfileModal.interests && selectedProfileModal.interests.length > 0) ||
                (selectedProfileModal.languages && selectedProfileModal.languages.length > 0)) && (
                <View style={styles.expandedSectionBox}>
                  <Text style={styles.expandedSectionHeader}>Interests & Languages</Text>
                  <View style={styles.expandedChipsWrap}>
                    {(selectedProfileModal.interests || []).map((interest, idx) => {
                      const isCommon = (selectedProfileModal.commonInterests || []).includes(interest);
                      return (
                        <View
                          key={`int-${idx}`}
                          style={[
                            styles.expandedChip,
                            isCommon && styles.expandedChipHighlight,
                          ]}
                        >
                          <Text
                            style={[
                              styles.expandedChipText,
                              isCommon && styles.expandedChipTextHighlight,
                            ]}
                          >
                            {isCommon ? `★ ${interest}` : interest}
                          </Text>
                        </View>
                      );
                    })}
                    {(selectedProfileModal.languages || []).map((lang, idx) => (
                      <View key={`lang-${idx}`} style={styles.expandedChipSubtle}>
                        <Text style={styles.expandedChipSubtleText}>🗣️ {lang}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Lifestyle & Basics */}
              <View style={styles.expandedSectionBox}>
                <Text style={styles.expandedSectionHeader}>Lifestyle & Basics</Text>
                <View style={styles.lifestyleGrid}>
                  {selectedProfileModal.gender && (
                    <View style={styles.lifestyleItem}>
                      <Text style={styles.lifestyleIcon}>👤</Text>
                      <Text style={styles.lifestyleLabel}>{selectedProfileModal.gender}</Text>
                    </View>
                  )}
                  {selectedProfileModal.drinkHabit && (
                    <View style={styles.lifestyleItem}>
                      <Text style={styles.lifestyleIcon}>🍷</Text>
                      <Text style={styles.lifestyleLabel}>{selectedProfileModal.drinkHabit}</Text>
                    </View>
                  )}
                  {selectedProfileModal.smokeHabit && (
                    <View style={styles.lifestyleItem}>
                      <Text style={styles.lifestyleIcon}>🚬</Text>
                      <Text style={styles.lifestyleLabel}>{selectedProfileModal.smokeHabit}</Text>
                    </View>
                  )}
                  {selectedProfileModal.exercise && (
                    <View style={styles.lifestyleItem}>
                      <Text style={styles.lifestyleIcon}>🏋️</Text>
                      <Text style={styles.lifestyleLabel}>{selectedProfileModal.exercise}</Text>
                    </View>
                  )}
                  {selectedProfileModal.pets && (
                    <View style={styles.lifestyleItem}>
                      <Text style={styles.lifestyleIcon}>🐶</Text>
                      <Text style={styles.lifestyleLabel}>{selectedProfileModal.pets}</Text>
                    </View>
                  )}
                  {selectedProfileModal.zodiac && (
                    <View style={styles.lifestyleItem}>
                      <Text style={styles.lifestyleIcon}>♌</Text>
                      <Text style={styles.lifestyleLabel}>{selectedProfileModal.zodiac}</Text>
                    </View>
                  )}
                  {selectedProfileModal.lookingFor && (
                    <View style={styles.lifestyleItemFull}>
                      <Text style={styles.lifestyleIcon}>💍</Text>
                      <Text style={styles.lifestyleLabel}>Looking for: {selectedProfileModal.lookingFor}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action Controls Bar (Pass, Superlike, Like) */}
            <View style={styles.expandedActionBar}>
              {/* Pass Button */}
              <TouchableOpacity
                style={[styles.expandedActionBtn, styles.expandedActionBtnPass]}
                onPress={() => handlePassProfile(selectedProfileModal)}
                activeOpacity={0.8}
              >
                <Text style={styles.expandedActionIconPass}>✖</Text>
                <Text style={styles.expandedActionLabelPass}>Pass</Text>
              </TouchableOpacity>

              {/* Super Like Button */}
              <TouchableOpacity
                style={[styles.expandedActionBtn, styles.expandedActionBtnSuper]}
                onPress={() => handleLikeProfile(selectedProfileModal, 'superlike')}
                activeOpacity={0.8}
              >
                <Text style={styles.expandedActionIconSuper}>★</Text>
                <Text style={styles.expandedActionLabelSuper}>Superlike</Text>
              </TouchableOpacity>

              {/* Like Button */}
              <TouchableOpacity
                style={[styles.expandedActionBtn, styles.expandedActionBtnLike]}
                onPress={() => handleLikeProfile(selectedProfileModal, 'like')}
                activeOpacity={0.8}
              >
                <Text style={styles.expandedActionIconLike}>♥</Text>
                <Text style={styles.expandedActionLabelLike}>Like</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Modal>

      {/* Match Celebration Dialog */}
      <Modal visible={!!matchedCelebrationUser} animationType="fade" transparent={true}>
        {matchedCelebrationUser && (
          <View style={styles.matchDialogOverlay}>
            <View style={styles.matchDialogContainer}>
              <Text style={styles.matchDialogTitle}>It's a Match! 🎉</Text>
              <Text style={styles.matchDialogSubtitle}>
                You and {matchedCelebrationUser.firstName || matchedCelebrationUser.name} liked each other!
              </Text>

              <Image
                source={{
                  uri: matchedCelebrationUser.profileImage
                    ? getImageUrl(matchedCelebrationUser.profileImage)
                    : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
                }}
                style={styles.matchDialogAvatar}
              />

              <TouchableOpacity
                style={styles.matchDialogChatBtn}
                onPress={() => {
                  const matchedUser = matchedCelebrationUser;
                  setMatchedCelebrationUser(null);
                  Alert.alert('Match Created!', `You can now chat with ${matchedUser.firstName || matchedUser.name} in the Chat tab!`);
                }}
              >
                <Text style={styles.matchDialogChatBtnText}>Send Message 💬</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.matchDialogCloseBtn}
                onPress={() => setMatchedCelebrationUser(null)}
              >
                <Text style={styles.matchDialogCloseText}>Keep Searching</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F13',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C24',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 45,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
  },
  clearBtnText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  filterToggleBtn: {
    backgroundColor: '#1C1C24',
    width: 45,
    height: 45,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleIcon: {
    fontSize: 20,
  },
  activePillsRow: {
    height: 35,
    marginBottom: 5,
  },
  pillBadge: {
    backgroundColor: '#262632',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
  },
  pillText: {
    color: '#A0A0B0',
    fontSize: 12,
  },
  pillBadgeActive: {
    backgroundColor: '#FF4458',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
  },
  pillTextActive: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultsCountHeader: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  resultsCountText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#8E8E93',
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 45,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  profileCard: {
    backgroundColor: '#1C1C24',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeaderImageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2C2C38',
  },
  cardHeaderMeta: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardName: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  cardAge: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  cardJob: {
    color: '#FF88A0',
    fontSize: 13,
    marginTop: 2,
  },
  cardCollege: {
    color: '#A0A0B0',
    fontSize: 12,
    marginTop: 2,
  },
  matchScoreBadge: {
    backgroundColor: 'rgba(255, 68, 88, 0.15)',
    borderWidth: 1,
    borderColor: '#FF4458',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  matchScoreText: {
    color: '#FF4458',
    fontWeight: 'bold',
    fontSize: 15,
  },
  matchScoreLabel: {
    color: '#FF4458',
    fontSize: 9,
    fontWeight: '600',
  },
  cardBio: {
    color: '#D0D0E0',
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  cardFooterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  distanceBadge: {
    backgroundColor: '#262632',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  distanceBadgeText: {
    color: '#A0A0B0',
    fontSize: 12,
  },
  langBadge: {
    backgroundColor: '#262632',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  langBadgeText: {
    color: '#A0A0B0',
    fontSize: 12,
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  commonInterestChip: {
    backgroundColor: 'rgba(255, 68, 88, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  commonInterestText: {
    color: '#FF4458',
    fontSize: 11,
    fontWeight: '600',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#0F0F13',
    paddingTop: STATUSBAR_HEIGHT,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C24',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseBtn: {
    color: '#8E8E93',
    fontSize: 22,
  },
  modalResetBtn: {
    color: '#FF4458',
    fontSize: 15,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterSection: {
    marginTop: 20,
  },
  sectionHeading: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  rangeControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C24',
    padding: 12,
    borderRadius: 12,
  },
  counterBtn: {
    backgroundColor: '#2C2C38',
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  counterLabel: {
    color: '#FFF',
    marginHorizontal: 8,
    fontWeight: '600',
  },
  distanceChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipsWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#1C1C24',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2C38',
  },
  chipActive: {
    backgroundColor: '#FF4458',
    borderColor: '#FF4458',
  },
  chipText: {
    color: '#A0A0B0',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  modalFooterRow: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#1C1C24',
    gap: 10,
  },
  savePrefBtn: {
    backgroundColor: '#2C2C38',
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  savePrefBtnText: {
    color: '#FFF',
    fontWeight: '600',
  },
  applyBtn: {
    flex: 1,
    backgroundColor: '#FF4458',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardStatusBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeLiked: {
    backgroundColor: 'rgba(255, 68, 88, 0.2)',
  },
  statusBadgeMatched: {
    backgroundColor: 'rgba(76, 217, 100, 0.2)',
  },
  statusBadgePassed: {
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
  },
  cardStatusBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  expandedModalSafeArea: {
    flex: 1,
    backgroundColor: '#0F0F13',
    paddingTop: STATUSBAR_HEIGHT,
  },
  expandedNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C24',
  },
  expandedBackBtn: {
    padding: 6,
  },
  expandedBackIcon: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  expandedNavTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  expandedReportBtn: {
    padding: 6,
  },
  expandedReportIcon: {
    color: '#8E8E93',
    fontSize: 24,
  },
  expandedContentScroll: {
    flex: 1,
  },
  photoCarouselContainer: {
    position: 'relative',
    width: '100%',
    height: Math.min(SCREEN_WIDTH * 1.05, 420),
    backgroundColor: '#1C1C24',
  },
  carouselImageWrapper: {
    width: '100%',
    height: '100%',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoIndicatorRow: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  photoIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  photoIndicatorDotActive: {
    width: 20,
    backgroundColor: '#FF4458',
  },
  expandedMatchBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(255, 68, 88, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  expandedMatchBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  expandedInfoSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C24',
  },
  expandedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandedNameText: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  expandedAgeText: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  verifiedCheckIcon: {
    color: '#3897F0',
    fontSize: 20,
  },
  expandedMetaRow: {
    marginTop: 6,
  },
  expandedDistanceText: {
    color: '#A0A0B0',
    fontSize: 14,
  },
  expandedJobText: {
    color: '#FF88A0',
    fontSize: 15,
    fontWeight: '600',
  },
  expandedCollegeText: {
    color: '#A0A0B0',
    fontSize: 14,
  },
  expandedSectionBox: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C24',
  },
  expandedSectionHeader: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  expandedBioText: {
    color: '#D0D0E0',
    fontSize: 14,
    lineHeight: 22,
  },
  expandedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expandedChip: {
    backgroundColor: '#1C1C24',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C38',
  },
  expandedChipHighlight: {
    backgroundColor: 'rgba(255, 68, 88, 0.15)',
    borderColor: '#FF4458',
  },
  expandedChipText: {
    color: '#A0A0B0',
    fontSize: 13,
  },
  expandedChipTextHighlight: {
    color: '#FF4458',
    fontWeight: 'bold',
  },
  expandedChipSubtle: {
    backgroundColor: '#1C1C24',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  expandedChipSubtleText: {
    color: '#A0A0B0',
    fontSize: 13,
  },
  lifestyleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  lifestyleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C24',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  lifestyleItemFull: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C24',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  lifestyleIcon: {
    fontSize: 16,
  },
  lifestyleLabel: {
    color: '#D0D0E0',
    fontSize: 13,
  },
  expandedActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#16161E',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 16 : 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#262632',
  },
  expandedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 6,
  },
  expandedActionBtnPass: {
    backgroundColor: '#262632',
  },
  expandedActionIconPass: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: 'bold',
  },
  expandedActionLabelPass: {
    color: '#FFF',
    fontWeight: '600',
  },
  expandedActionBtnSuper: {
    backgroundColor: '#3897F0',
  },
  expandedActionIconSuper: {
    color: '#FFF',
    fontSize: 16,
  },
  expandedActionLabelSuper: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  expandedActionBtnLike: {
    backgroundColor: '#FF4458',
  },
  expandedActionIconLike: {
    color: '#FFF',
    fontSize: 18,
  },
  expandedActionLabelLike: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  matchDialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  matchDialogContainer: {
    width: '90%',
    backgroundColor: '#1C1C24',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 88, 0.3)',
  },
  matchDialogTitle: {
    color: '#FF4458',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  matchDialogSubtitle: {
    color: '#D0D0E0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  matchDialogAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#FF4458',
    marginBottom: 20,
  },
  matchDialogChatBtn: {
    width: '100%',
    backgroundColor: '#FF4458',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  matchDialogChatBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  matchDialogCloseBtn: {
    paddingVertical: 10,
  },
  matchDialogCloseText: {
    color: '#8E8E93',
    fontSize: 14,
  },
});
