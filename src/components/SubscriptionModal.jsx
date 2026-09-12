import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Dimensions,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { apiClient } from '../api/apiClient';

const { width } = Dimensions.get('window');

export const SubscriptionModal = ({ visible, onClose, onSubscriptionUpdated, currentTier = 'Free' }) => {
  const [selectedPlan, setSelectedPlan] = useState('Gold');
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchMySubscription();
    }
  }, [visible]);

  const fetchMySubscription = async () => {
    try {
      setIsFetchingInfo(true);
      const res = await apiClient.getMySubscription();
      if (res && res.success) {
        setSubscriptionInfo(res);
      }
    } catch (err) {
      console.log('Error fetching subscription info:', err);
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const activeTier = subscriptionInfo?.subscriptionTier || currentTier || 'Free';

  const handleSubscribe = async () => {
    try {
      setIsLoading(true);

      // 1. Create Hosted Checkout Session with Stripe Backend
      const checkoutRes = await apiClient.createSubscriptionCheckout(selectedPlan);

      if (!checkoutRes || !checkoutRes.success || !checkoutRes.checkoutUrl) {
        throw new Error(checkoutRes?.message || 'Failed to initialize subscription checkout.');
      }

      // 2. Open official Stripe Checkout page in device browser
      try {
        await Linking.openURL(checkoutRes.checkoutUrl);
      } catch (linkErr) {
        console.warn('Could not open Stripe Checkout URL:', linkErr);
      }

      // 3. Prompt user to complete payment on Stripe test page (4242 4242 4242 4242)
      Alert.alert(
        '💳 Stripe Payment Page Opened',
        'Enter test card details (4242 4242 4242 4242, exp 12/28, CVC 123) on the Stripe checkout page to complete your order.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'I Have Paid',
            onPress: async () => {
              try {
                setIsLoading(true);
                const confirmRes = await apiClient.confirmSubscription(
                  checkoutRes.subscriptionId,
                  selectedPlan
                );

                if (confirmRes && confirmRes.success) {
                  Alert.alert(
                    '🎉 Subscription Activated!',
                    `Congratulations! You are now subscribed to ${selectedPlan} Membership!`,
                    [
                      {
                        text: 'Awesome!',
                        onPress: () => {
                          if (typeof onSubscriptionUpdated === 'function') {
                            onSubscriptionUpdated(selectedPlan);
                          }
                          onClose();
                        },
                      },
                    ]
                  );
                } else {
                  throw new Error(confirmRes?.message || 'Subscription confirmation failed.');
                }
              } catch (confirmErr) {
                Alert.alert('Activation Error', confirmErr.message || 'Failed to confirm subscription activation.');
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error('Subscription error:', err);
      Alert.alert('Payment Error', err.message || 'Something went wrong while processing your subscription.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your auto-renewal? You will revert to the Free tier at period end.',
      [
        { text: 'Keep Membership', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const res = await apiClient.cancelSubscription();
              if (res && res.success) {
                Alert.alert('Subscription Cancelled', 'Your subscription auto-renewal has been cancelled.');
                if (typeof onSubscriptionUpdated === 'function') {
                  onSubscriptionUpdated('Free');
                }
                fetchMySubscription();
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to cancel subscription.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium Upgrades</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Banner Hero */}
          <View style={styles.heroSection}>
            <Text style={styles.heroEmoji}>👑</Text>
            <Text style={styles.heroTitle}>Unlock Your Dating Superpowers</Text>
            <Text style={styles.heroSubtitle}>
              Get 5x more matches, see who likes you, and stand out from the crowd.
            </Text>

            {activeTier !== 'Free' && (
              <View style={styles.activeBadgeContainer}>
                <Text style={styles.activeBadgeText}>
                  ✨ CURRENT PLAN: {activeTier.toUpperCase()} MEMBER
                </Text>
              </View>
            )}
          </View>

          {/* Plan Selector Cards */}
          <View style={styles.plansContainer}>
            {/* Gold Card */}
            <TouchableOpacity
              style={[
                styles.planCard,
                styles.goldPlanCard,
                selectedPlan === 'Gold' && styles.selectedGoldCard,
              ]}
              onPress={() => setSelectedPlan('Gold')}
              activeOpacity={0.9}
            >
              {selectedPlan === 'Gold' && <View style={styles.radioSelectedDot} />}
              <View style={styles.planCardHeader}>
                <View style={styles.goldBadge}>
                  <Text style={styles.goldBadgeText}>MOST POPULAR</Text>
                </View>
                <Text style={styles.planNameGold}>GOLD</Text>
                <Text style={styles.planPrice}>₹999 <Text style={styles.perMonth}>/ month</Text></Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Text style={styles.checkIcon}>💛</Text>
                  <Text style={styles.featureText}>Unlimited Likes & Swipes</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.checkIcon}>👁️</Text>
                  <Text style={styles.featureText}>See Who Liked Your Profile</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.checkIcon}>⭐</Text>
                  <Text style={styles.featureText}>5 Super Likes Every Day</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.checkIcon}>✈️</Text>
                  <Text style={styles.featureText}>Passport Location Teleport</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Premium Card */}
            <TouchableOpacity
              style={[
                styles.planCard,
                styles.premiumPlanCard,
                selectedPlan === 'Premium' && styles.selectedPremiumCard,
              ]}
              onPress={() => setSelectedPlan('Premium')}
              activeOpacity={0.9}
            >
              {selectedPlan === 'Premium' && <View style={styles.radioSelectedDot} />}
              <View style={styles.planCardHeader}>
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>BEST VALUE</Text>
                </View>
                <Text style={styles.planNamePremium}>PREMIUM</Text>
                <Text style={styles.planPrice}>₹499 <Text style={styles.perMonth}>/ month</Text></Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Text style={styles.checkIcon}>💎</Text>
                  <Text style={styles.featureText}>All Gold Tier Features Included</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.checkIcon}>🚀</Text>
                  <Text style={styles.featureText}>1 Free Monthly Profile Boost</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.checkIcon}>🔥</Text>
                  <Text style={styles.featureText}>Priority Likes in Deck</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.checkIcon}>🔍</Text>
                  <Text style={styles.featureText}>Advanced Search Filters Unlocked</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.checkIcon}>✨</Text>
                  <Text style={styles.featureText}>Ad-Free Experience</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom CTA Action Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.subscribeBtn,
              selectedPlan === 'Premium' ? styles.premiumBtnBg : styles.goldBtnBg,
              isLoading && styles.btnDisabled,
            ]}
            onPress={handleSubscribe}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.subscribeBtnText}>
                {activeTier === selectedPlan
                  ? 'MANAGE MEMBERSHIP'
                  : 'Subscribe'}
              </Text>
            )}
          </TouchableOpacity>

          {activeTier !== 'Free' && (
            <TouchableOpacity
              style={styles.cancelLink}
              onPress={handleCancelSubscription}
              disabled={isLoading}
            >
              <Text style={styles.cancelLinkText}>Cancel Active Subscription</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F121A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  activeBadgeContainer: {
    marginTop: 14,
    backgroundColor: 'rgba(255, 215, 0, 0.18)',
    borderWidth: 1,
    borderColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  plansContainer: {
    marginTop: 10,
  },
  planCard: {
    backgroundColor: '#1E222B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  goldPlanCard: {},
  selectedGoldCard: {
    borderColor: '#FFD700',
    backgroundColor: '#26281D',
  },
  premiumPlanCard: {},
  selectedPremiumCard: {
    borderColor: '#FE3C72',
    backgroundColor: '#2A1D27',
  },
  radioSelectedDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FE3C72',
  },
  planCardHeader: {
    alignItems: 'flex-start',
  },
  goldBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  goldBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
  },
  premiumBadge: {
    backgroundColor: 'rgba(254, 60, 114, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  premiumBadgeText: {
    color: '#FE3C72',
    fontSize: 10,
    fontWeight: '800',
  },
  planNameGold: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  planNamePremium: {
    color: '#FE3C72',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  planPrice: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  perMonth: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '400',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 14,
  },
  featureList: {},
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  featureText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#0F121A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  subscribeBtn: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  goldBtnBg: {
    backgroundColor: '#FFD700',
  },
  premiumBtnBg: {
    backgroundColor: '#FE3C72',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  subscribeBtnText: {
    color: '#0F121A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cancelLink: {
    alignItems: 'center',
    marginTop: 12,
  },
  cancelLinkText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
