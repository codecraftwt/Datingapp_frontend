import React, { useState, useEffect, useMemo } from 'react';
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
  KeyboardAvoidingView,
} from 'react-native';
import { apiClient } from '../api/apiClient';
import { getImageUrl } from '../api/config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

export function SearchScreen({ onSelectProfile, onGoBack, onBack }) {
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
    professions: [
      'Software Engineer',
      'Doctor',
      'Designer',
      'Teacher',
      'Entrepreneur',
      'Student',
      'Architect',
      'Business Owner',
      'Lawyer / Advocate',
      'Accountant / CA',
      'Artist / Creative',
      'Chef / Culinary',
      'Civil / Mechanical Engineer',
      'Nurse / Healthcare',
      'Banker / Finance',
      'Pilot / Aviation',
      'Consultant',
      'Marketer / Digital Marketing',
      'Data Scientist / AI',
      'Real Estate Agent',
      'Civil Services / Government Job',
      'HR / Human Resources',
      'Content Creator / Influencer',
      'Event Manager',
      'Fitness Trainer',
      'Journalist / Media',
      'Manager',
      'Researcher / Scientist',
    ],
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
  const [selectedProfession, setSelectedProfession] = useState('All');
  const [sortBy, setSortBy] = useState('matchPercentage');

  // Modal Visibility State
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showProfessionModal, setShowProfessionModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showDistanceModal, setShowDistanceModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [professionSearchQuery, setProfessionSearchQuery] = useState('');
  const [languageSearchQuery, setLanguageSearchQuery] = useState('');

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
        setFilterOptions((prev) => ({
          ...prev,
          ...res.options,
          professions: res.options.professions && res.options.professions.length > 0 
            ? Array.from(new Set([...prev.professions, ...res.options.professions]))
            : prev.professions,
        }));
      }
    } catch (err) {
      console.log('Error fetching filter options:', err);
    }
  };

  const allAvailableProfessions = useMemo(() => {
    const baseList = filterOptions.professions || [];
    const candidateJobs = (results || [])
      .map((u) => u.job)
      .filter(Boolean);
    const combined = Array.from(new Set([...baseList, ...candidateJobs]));
    return combined.sort((a, b) => a.localeCompare(b));
  }, [filterOptions.professions, results]);

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
  const executeSearch = async (pageNum = 1, isInitialOrRefetch = false, customProf = undefined) => {
    if (isLoading) return;
    setIsLoading(true);

    const activeProf = customProf !== undefined
      ? customProf
      : (selectedProfession && selectedProfession !== 'All' ? selectedProfession : searchKeyword.trim());

    try {
      const payload = {
        profession: activeProf === 'All' ? '' : activeProf,
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
      if (err?.status === 401 || err?.data?.message?.includes('authorization denied') || err?.data?.message?.includes('invalid or expired')) {
        Alert.alert('Session Expired', 'Your login session has expired or is invalid. Please log in again to continue.');
      } else {
        Alert.alert('Search Error', err?.data?.message || err?.message || 'Unable to execute search.');
      }
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
    setSelectedProfession('All');
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
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => {
            if (onGoBack && onGoBack()) return;
            if (onBack) onBack();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.headerBackBtnText}>←</Text>
        </TouchableOpacity>
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

      {/* Interactive Quick Filter Buttons Bar */}
      <View style={styles.quickFilterBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, gap: 8, alignItems: 'center' }}>
          {/* Profession Quick Filter */}
          <TouchableOpacity
            style={[styles.quickFilterChip, selectedProfession && selectedProfession !== 'All' && styles.quickFilterChipActive]}
            onPress={() => {
              setProfessionSearchQuery('');
              setShowProfessionModal(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.quickFilterChipText, selectedProfession && selectedProfession !== 'All' && styles.quickFilterChipTextActive]} numberOfLines={1}>
              {selectedProfession && selectedProfession !== 'All' ? `💼 ${selectedProfession}` : '💼 Profession'}
            </Text>
            <Text style={styles.quickFilterChevron}>▼</Text>
          </TouchableOpacity>

          {/* Age Range Quick Filter */}
          <TouchableOpacity
            style={[styles.quickFilterChip, (ageMin !== 18 || ageMax !== 50) && styles.quickFilterChipActive]}
            onPress={() => setShowAgeModal(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.quickFilterChipText, (ageMin !== 18 || ageMax !== 50) && styles.quickFilterChipTextActive]}>
              🎂 Age: {ageMin}-{ageMax}
            </Text>
            <Text style={styles.quickFilterChevron}>▼</Text>
          </TouchableOpacity>

          {/* Distance Radius Quick Filter */}
          <TouchableOpacity
            style={[styles.quickFilterChip, distanceKm !== 50 && styles.quickFilterChipActive]}
            onPress={() => setShowDistanceModal(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.quickFilterChipText, distanceKm !== 50 && styles.quickFilterChipTextActive]}>
              📍 {distanceKm} km
            </Text>
            <Text style={styles.quickFilterChevron}>▼</Text>
          </TouchableOpacity>

          {/* Languages Quick Filter */}
          <TouchableOpacity
            style={[styles.quickFilterChip, selectedLanguages.length > 0 && styles.quickFilterChipActive]}
            onPress={() => {
              setLanguageSearchQuery('');
              setShowLanguageModal(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.quickFilterChipText, selectedLanguages.length > 0 && styles.quickFilterChipTextActive]} numberOfLines={1}>
              {selectedLanguages.length > 0 ? `🗣️ ${selectedLanguages.length} Lang` : '🗣️ Languages'}
            </Text>
            <Text style={styles.quickFilterChevron}>▼</Text>
          </TouchableOpacity>

          {/* All Filters Toggle Button */}
          <TouchableOpacity
            style={[styles.quickFilterChip, styles.quickFilterChipMore]}
            onPress={() => setShowFilterModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.quickFilterChipTextMore}>⚙️ All Filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Language Quick Dropdown Bar */}
      <View style={styles.profFilterContainerRow}>
        <Text style={styles.profFilterLabel}>🗣️ Language:</Text>
        <TouchableOpacity
          style={styles.profFilterDropdownBtn}
          onPress={() => {
            setLanguageSearchQuery('');
            setShowLanguageModal(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.profFilterDropdownText} numberOfLines={1}>
            {selectedLanguages.length > 0 ? selectedLanguages.join(', ') : 'All Languages'}
          </Text>
          <Text style={styles.profFilterChevron}>▼</Text>
        </TouchableOpacity>

        {selectedLanguages.length > 0 && (
          <TouchableOpacity
            style={styles.profFilterClearBtn}
            onPress={() => {
              setSelectedLanguages([]);
              executeSearch(1, true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.profFilterClearText}>✕ Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Active Filters Clearable Pills Summary */}
      {(selectedProfession !== 'All' || ageMin !== 18 || ageMax !== 50 || distanceKm !== 50 || selectedLanguages.length > 0 || selectedInterests.length > 0 || searchKeyword.length > 0) && (
        <View style={styles.activePillsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, gap: 6, alignItems: 'center' }}>
            {selectedProfession && selectedProfession !== 'All' && (
              <TouchableOpacity
                style={styles.pillBadgeActiveClear}
                onPress={() => {
                  setSelectedProfession('All');
                  executeSearch(1, true, 'All');
                }}
              >
                <Text style={styles.pillTextActive}>💼 {selectedProfession}</Text>
                <Text style={styles.pillClearIcon}>✕</Text>
              </TouchableOpacity>
            )}

            {(ageMin !== 18 || ageMax !== 50) && (
              <TouchableOpacity
                style={styles.pillBadgeActiveClear}
                onPress={() => {
                  setAgeMin(18);
                  setAgeMax(50);
                  executeSearch(1, true);
                }}
              >
                <Text style={styles.pillTextActive}>🎂 {ageMin}-{ageMax} yrs</Text>
                <Text style={styles.pillClearIcon}>✕</Text>
              </TouchableOpacity>
            )}

            {distanceKm !== 50 && (
              <TouchableOpacity
                style={styles.pillBadgeActiveClear}
                onPress={() => {
                  setDistanceKm(50);
                  executeSearch(1, true);
                }}
              >
                <Text style={styles.pillTextActive}>📍 {distanceKm} km</Text>
                <Text style={styles.pillClearIcon}>✕</Text>
              </TouchableOpacity>
            )}

            {selectedLanguages.length > 0 && (
              <TouchableOpacity
                style={styles.pillBadgeActiveClear}
                onPress={() => {
                  setSelectedLanguages([]);
                  executeSearch(1, true);
                }}
              >
                <Text style={styles.pillTextActive}>🗣️ {selectedLanguages.join(', ')}</Text>
                <Text style={styles.pillClearIcon}>✕</Text>
              </TouchableOpacity>
            )}

            {selectedInterests.length > 0 && (
              <TouchableOpacity
                style={styles.pillBadgeActiveClear}
                onPress={() => {
                  setSelectedInterests([]);
                  executeSearch(1, true);
                }}
              >
                <Text style={styles.pillTextActive}>🎯 {selectedInterests.length} Interests</Text>
                <Text style={styles.pillClearIcon}>✕</Text>
              </TouchableOpacity>
            )}

            {searchKeyword.length > 0 && (
              <TouchableOpacity
                style={styles.pillBadgeActiveClear}
                onPress={() => {
                  setSearchKeyword('');
                  executeSearch(1, true);
                }}
              >
                <Text style={styles.pillTextActive}>🔍 "{searchKeyword}"</Text>
                <Text style={styles.pillClearIcon}>✕</Text>
              </TouchableOpacity>
            )}

            {/* Clear All Button */}
            <TouchableOpacity
              style={styles.clearAllBtn}
              onPress={() => {
                handleResetFilters();
                executeSearch(1, true);
              }}
            >
              <Text style={styles.clearAllBtnText}>Reset All</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

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
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.sectionHeading}>Maximum Distance: {distanceKm} km</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setDistanceKm((prev) => Math.max(1, prev - 5))}
                    style={styles.counterBtn}
                  >
                    <Text style={styles.counterBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={{ color: '#FFF', fontWeight: 'bold', minWidth: 45, textAlign: 'center' }}>{distanceKm} km</Text>
                  <TouchableOpacity
                    onPress={() => setDistanceKm((prev) => Math.min(500, prev + 5))}
                    style={styles.counterBtn}
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.distanceChipsRow}>
                {[5, 10, 25, 50, 100, 200].map((km) => (
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

            {/* Profession Dropdown Filter Section */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionHeading}>Profession / Job Title</Text>
              <TouchableOpacity
                style={styles.modalProfDropdownBtn}
                onPress={() => {
                  setProfessionSearchQuery('');
                  setShowProfessionModal(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalProfDropdownBtnText} numberOfLines={1}>
                  {selectedProfession && selectedProfession !== 'All' ? `💼 ${selectedProfession}` : 'Select Profession / Job...'}
                </Text>
                <Text style={styles.modalProfDropdownChevron}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Language Dropdown Filter Section */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionHeading}>Languages Spoken</Text>
              <TouchableOpacity
                style={styles.modalProfDropdownBtn}
                onPress={() => {
                  setLanguageSearchQuery('');
                  setShowLanguageModal(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalProfDropdownBtnText} numberOfLines={1}>
                  {selectedLanguages.length > 0 ? `🗣️ ${selectedLanguages.join(', ')}` : 'Select Languages Spoken...'}
                </Text>
                <Text style={styles.modalProfDropdownChevron}>▼</Text>
              </TouchableOpacity>
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

      {/* Dedicated Profession Selector Dropdown Modal */}
      <Modal
        visible={showProfessionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfessionModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.profModalKeyboardContainer}
        >
          <View style={styles.profModalOverlay}>
            <View style={styles.profModalContent}>
              <View style={styles.profModalHeader}>
                <Text style={styles.profModalTitle}>Select Profession</Text>
                <TouchableOpacity onPress={() => setShowProfessionModal(false)} style={{ padding: 6 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.profSearchBarWrapper}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
                <TextInput
                  style={styles.profSearchInput}
                  placeholder="Type to search profession..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={professionSearchQuery}
                  onChangeText={setProfessionSearchQuery}
                  autoFocus={true}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {professionSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setProfessionSearchQuery('')} style={{ padding: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={[
                  'All Professions',
                  ...(allAvailableProfessions || []).filter((p) =>
                    p.toLowerCase().includes(professionSearchQuery.toLowerCase().trim())
                  ),
                ]}
                keyExtractor={(item, index) => item + index}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 30 }}
                renderItem={({ item }) => {
                  const isSelected = (selectedProfession === item) || (item === 'All Professions' && (!selectedProfession || selectedProfession === 'All'));
                  return (
                    <TouchableOpacity
                      style={[
                        styles.profListItem,
                        isSelected && styles.profListItemSelected,
                      ]}
                      onPress={() => {
                        const newProf = item === 'All Professions' ? 'All' : item;
                        setSelectedProfession(newProf);
                        setShowProfessionModal(false);
                        executeSearch(1, true, newProf);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.profListItemText,
                          isSelected && styles.profListItemTextSelected,
                        ]}
                      >
                        {item === 'All Professions' ? '🌐 All Professions' : item}
                      </Text>
                      {isSelected && (
                        <Text style={{ color: '#FF4458', fontWeight: 'bold', fontSize: 16 }}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Dedicated Age Range Selector Modal */}
      <Modal
        visible={showAgeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAgeModal(false)}
      >
        <View style={styles.profModalOverlay}>
          <View style={styles.quickModalCard}>
            <View style={styles.profModalHeader}>
              <Text style={styles.profModalTitle}>🎂 Select Age Range</Text>
              <TouchableOpacity onPress={() => setShowAgeModal(false)} style={{ padding: 6 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.quickModalSubtitle}>Currently Selected: {ageMin} - {ageMax} years old</Text>

            {/* Quick Age Presets */}
            <Text style={styles.quickPresetTitle}>Quick Presets:</Text>
            <View style={styles.chipsWrapContainer}>
              {[
                { min: 18, max: 25, label: '18 - 25' },
                { min: 22, max: 30, label: '22 - 30' },
                { min: 25, max: 35, label: '25 - 35' },
                { min: 30, max: 45, label: '30 - 45' },
                { min: 18, max: 60, label: 'Any Age' },
              ].map((preset) => {
                const isSelected = ageMin === preset.min && ageMax === preset.max;
                return (
                  <TouchableOpacity
                    key={preset.label}
                    style={[styles.quickPresetChip, isSelected && styles.quickPresetChipActive]}
                    onPress={() => {
                      setAgeMin(preset.min);
                      setAgeMax(preset.max);
                    }}
                  >
                    <Text style={[styles.quickPresetChipText, isSelected && styles.quickPresetChipTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Stepper Controls for Min & Max Age */}
            <View style={styles.stepperContainerRow}>
              {/* Min Age Stepper */}
              <View style={styles.stepperBox}>
                <Text style={styles.stepperLabel}>Min Age</Text>
                <View style={styles.stepperControls}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setAgeMin((prev) => Math.max(18, Math.min(prev - 1, ageMax - 1)))}
                  >
                    <Text style={styles.stepperBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValText}>{ageMin}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setAgeMin((prev) => Math.min(prev + 1, ageMax - 1))}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Max Age Stepper */}
              <View style={styles.stepperBox}>
                <Text style={styles.stepperLabel}>Max Age</Text>
                <View style={styles.stepperControls}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setAgeMax((prev) => Math.max(ageMin + 1, prev - 1))}
                  >
                    <Text style={styles.stepperBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValText}>{ageMax}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setAgeMax((prev) => Math.min(80, prev + 1))}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Action Footer */}
            <TouchableOpacity
              style={styles.modalApplyBtnPrimary}
              onPress={() => {
                setShowAgeModal(false);
                executeSearch(1, true);
              }}
            >
              <Text style={styles.modalApplyBtnPrimaryText}>Apply Age Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dedicated Distance Selector Modal */}
      <Modal
        visible={showDistanceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDistanceModal(false)}
      >
        <View style={styles.profModalOverlay}>
          <View style={styles.quickModalCard}>
            <View style={styles.profModalHeader}>
              <Text style={styles.profModalTitle}>📍 Maximum Distance</Text>
              <TouchableOpacity onPress={() => setShowDistanceModal(false)} style={{ padding: 6 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.quickModalSubtitle}>Showing profiles within {distanceKm} km</Text>

            {/* Stepper Control for Distance (+ / -) */}
            <View style={[styles.stepperContainerRow, { marginVertical: 12 }]}>
              <View style={[styles.stepperBox, { width: '100%' }]}>
                <Text style={styles.stepperLabel}>Adjust Distance Radius</Text>
                <View style={styles.stepperControls}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setDistanceKm((prev) => Math.max(1, prev - 5))}
                  >
                    <Text style={styles.stepperBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={[styles.stepperValText, { minWidth: 60 }]}>{distanceKm} km</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setDistanceKm((prev) => Math.min(500, prev + 5))}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Quick Distance Presets */}
            <Text style={styles.quickPresetTitle}>Quick Presets:</Text>
            <View style={styles.distanceGridContainer}>
              {[5, 10, 25, 50, 100, 200].map((km) => {
                const isSelected = distanceKm === km;
                return (
                  <TouchableOpacity
                    key={km}
                    style={[styles.distanceOptionCard, isSelected && styles.distanceOptionCardActive]}
                    onPress={() => {
                      setDistanceKm(km);
                    }}
                  >
                    <Text style={[styles.distanceOptionVal, isSelected && styles.distanceOptionValActive]}>
                      {km} km
                    </Text>
                    <Text style={[styles.distanceOptionDesc, isSelected && styles.distanceOptionDescActive]}>
                      {km <= 10 ? 'Nearby city' : km <= 50 ? 'Regional area' : 'Wide radius'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Footer */}
            <TouchableOpacity
              style={styles.modalApplyBtnPrimary}
              onPress={() => {
                setShowDistanceModal(false);
                executeSearch(1, true);
              }}
            >
              <Text style={styles.modalApplyBtnPrimaryText}>Apply Distance Filter ({distanceKm} km)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dedicated Language Selector Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.profModalKeyboardContainer}
        >
          <View style={styles.profModalOverlay}>
            <View style={styles.profModalContent}>
              <View style={styles.profModalHeader}>
                <Text style={styles.profModalTitle}>🗣️ Select Languages</Text>
                <TouchableOpacity onPress={() => setShowLanguageModal(false)} style={{ padding: 6 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.profSearchBarWrapper}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
                <TextInput
                  style={styles.profSearchInput}
                  placeholder="Search language..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={languageSearchQuery}
                  onChangeText={setLanguageSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {languageSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setLanguageSearchQuery('')} style={{ padding: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={(filterOptions.languages || []).filter((lang) =>
                  lang.toLowerCase().includes(languageSearchQuery.toLowerCase().trim())
                )}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => {
                  const isSelected = selectedLanguages.includes(item);
                  return (
                    <TouchableOpacity
                      style={[styles.profListItem, isSelected && styles.profListItemSelected]}
                      onPress={() => {
                        if (isSelected) {
                          setSelectedLanguages(selectedLanguages.filter((l) => l !== item));
                        } else {
                          setSelectedLanguages([...selectedLanguages, item]);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.profListItemText, isSelected && styles.profListItemTextSelected]}>
                        🗣️ {item}
                      </Text>
                      <View style={[styles.langCheckbox, isSelected && styles.langCheckboxSelected]}>
                        {isSelected && <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 12 }}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              <View style={{ paddingTop: 10, paddingBottom: 20, paddingHorizontal: 15 }}>
                <TouchableOpacity
                  style={styles.modalApplyBtnPrimary}
                  onPress={() => {
                    setShowLanguageModal(false);
                    executeSearch(1, true);
                  }}
                >
                  <Text style={styles.modalApplyBtnPrimaryText}>
                    Apply Languages ({selectedLanguages.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1C1C24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBackBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
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

  // Profession Quick Filter Bar Styles
  profFilterContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 6,
    gap: 8,
  },
  profFilterLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  profFilterDropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#262632',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  profFilterDropdownText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
  },
  profFilterChevron: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },
  profFilterClearBtn: {
    backgroundColor: 'rgba(255, 68, 88, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FF4458',
  },
  profFilterClearText: {
    color: '#FF4458',
    fontSize: 12,
    fontWeight: '700',
  },

  // Modal Profession Dropdown Trigger Styles
  modalProfDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#262632',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 6,
  },
  modalProfDropdownBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  modalProfDropdownChevron: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },

  // Dedicated Profession Modal Styles
  profModalKeyboardContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  profModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  profModalContent: {
    backgroundColor: '#1E1E2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '82%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 15,
  },
  profModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  profModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  profSearchBarWrapper: {
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
  profSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    height: '100%',
    paddingVertical: 0,
  },
  profListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    marginBottom: 2,
  },
  profListItemSelected: {
    backgroundColor: 'rgba(255, 68, 88, 0.15)',
  },
  profListItemText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  profListItemTextSelected: {
    color: '#FF4458',
    fontWeight: '700',
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
  quickFilterBarContainer: {
    paddingVertical: 10,
    backgroundColor: '#12121A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C26',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 6,
  },
  quickFilterChipActive: {
    backgroundColor: 'rgba(255, 68, 88, 0.15)',
    borderColor: '#FF4458',
  },
  quickFilterChipMore: {
    backgroundColor: '#252533',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  quickFilterChipText: {
    color: '#D0D0E0',
    fontSize: 13,
    fontWeight: '600',
  },
  quickFilterChipTextActive: {
    color: '#FF4458',
    fontWeight: 'bold',
  },
  quickFilterChipTextMore: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  quickFilterChevron: {
    color: '#8E8E93',
    fontSize: 10,
  },
  pillBadgeActiveClear: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 88, 0.2)',
    borderColor: '#FF4458',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  pillClearIcon: {
    color: '#FF4458',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  clearAllBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearAllBtnText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  quickModalCard: {
    width: '92%',
    maxWidth: 480,
    backgroundColor: '#1A1A24',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 88, 0.25)',
  },
  quickModalSubtitle: {
    color: '#FF88A0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  quickPresetTitle: {
    color: '#A0A0B0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  quickPresetChip: {
    backgroundColor: '#242432',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickPresetChipActive: {
    backgroundColor: '#FF4458',
    borderColor: '#FF4458',
  },
  quickPresetChipText: {
    color: '#D0D0E0',
    fontSize: 13,
    fontWeight: '600',
  },
  quickPresetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  stepperContainerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 18,
    gap: 12,
  },
  stepperBox: {
    flex: 1,
    backgroundColor: '#242432',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  stepperLabel: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FF4458',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  stepperValText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    minWidth: 26,
    textAlign: 'center',
  },
  modalApplyBtnPrimary: {
    width: '100%',
    backgroundColor: '#FF4458',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  modalApplyBtnPrimaryText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  distanceGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 14,
  },
  distanceOptionCard: {
    width: '48%',
    backgroundColor: '#242432',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  distanceOptionCardActive: {
    backgroundColor: 'rgba(255, 68, 88, 0.15)',
    borderColor: '#FF4458',
  },
  distanceOptionVal: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  distanceOptionValActive: {
    color: '#FF4458',
  },
  distanceOptionDesc: {
    color: '#8E8E93',
    fontSize: 12,
  },
  distanceOptionDescActive: {
    color: '#FF88A0',
  },
  langCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langCheckboxSelected: {
    backgroundColor: '#FF4458',
    borderColor: '#FF4458',
  },
});
