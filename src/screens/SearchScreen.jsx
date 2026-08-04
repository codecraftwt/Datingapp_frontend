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
} from 'react-native';
import { apiClient } from '../api/apiClient';
import { getImageUrl } from '../api/config';

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
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.profileCard}
              activeOpacity={0.9}
              onPress={() => onSelectProfile && onSelectProfile(item)}
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
            </TouchableOpacity>
          )}
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
});
