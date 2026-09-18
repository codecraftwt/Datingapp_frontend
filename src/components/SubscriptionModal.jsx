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
  NativeModules,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { apiClient } from '../api/apiClient';

const { width } = Dimensions.get('window');

const isWebViewAvailable = !!(
  NativeModules.RNCWebView ||
  NativeModules.RNCWebViewModule ||
  NativeModules.RNCCustomWebView
);

export const SubscriptionModal = ({ visible, onClose, onSubscriptionUpdated, currentTier = 'Free' }) => {
  const [selectedPlan, setSelectedPlan] = useState('Gold');
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);

  // In-App Stripe WebView State
  const [showWebView, setShowWebView] = useState(false);
  const [stripeUrl, setStripeUrl] = useState('');
  const [pendingSubId, setPendingSubId] = useState('');

  useEffect(() => {
    if (visible) {
      console.log('📌 [FRONTEND SUBSCRIPTION STEP 1: MODAL_OPENED] Subscription Modal opened. Current tier:', currentTier);
      fetchMySubscription();
    }
  }, [visible]);

  const fetchMySubscription = async () => {
    try {
      console.log('📌 [FRONTEND SUBSCRIPTION STEP 1.1: FETCH_INFO] Calling apiClient.getMySubscription()...');
      setIsFetchingInfo(true);
      const res = await apiClient.getMySubscription();
      console.log('✅ [FRONTEND SUBSCRIPTION STEP 1.2: FETCH_INFO_RESULT] Response:', res);
      if (res && res.success) {
        setSubscriptionInfo(res);
      }
    } catch (err) {
      console.error('❌ [FRONTEND SUBSCRIPTION STEP 1.3: FETCH_INFO_ERROR] Error fetching subscription info:', err);
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const activeTier = subscriptionInfo?.subscriptionTier || currentTier || 'Free';

  const handleSubscribe = async () => {
    console.log(`📌 [FRONTEND SUBSCRIPTION STEP 2: SUBSCRIBE_CLICKED] Selected Plan: "${selectedPlan}", Active Tier: "${activeTier}"`);
    try {
      setIsLoading(true);

      // 1. Create Hosted Checkout Session with Stripe Backend
      console.log(`🚀 [FRONTEND SUBSCRIPTION STEP 3: CREATE_SESSION_REQUEST] Requesting checkout session for plan "${selectedPlan}"...`);
      const checkoutRes = await apiClient.createSubscriptionCheckout(selectedPlan);
      console.log('✅ [FRONTEND SUBSCRIPTION STEP 4: CREATE_SESSION_RESPONSE] Received backend response:', checkoutRes);

      if (!checkoutRes || !checkoutRes.success || !checkoutRes.checkoutUrl) {
        console.error('❌ [FRONTEND SUBSCRIPTION STEP 4.1: INVALID_RESPONSE] Missing checkoutUrl or success flag!');
        Alert.alert('Checkout Session Error', checkoutRes?.message || 'Failed to initialize subscription session.');
        throw new Error(checkoutRes?.message || 'Failed to initialize subscription checkout.');
      }

      setPendingSubId(checkoutRes.subscriptionId || '');
      setStripeUrl(checkoutRes.checkoutUrl);

      // Alert Popup: Session Created Successfully
      Alert.alert(
        '💳 Stripe Checkout Ready',
        `Session Created for ${selectedPlan} Plan!\nOpening Stripe Checkout page...`,
        [{ text: 'Continue to Payment', onPress: () => {} }]
      );

      // 2. If Native WebView Module is compiled in APK, open WebView. Else fallback to browser.
      if (isWebViewAvailable) {
        console.log(`📱 [FRONTEND SUBSCRIPTION STEP 5: OPEN_WEBVIEW] RNCWebViewModule available. Opening in-app WebView for URL: ${checkoutRes.checkoutUrl}`);
        setShowWebView(true);
      } else {
        console.log('🌐 [FRONTEND SUBSCRIPTION STEP 5: OPEN_BROWSER] Native RNCWebViewModule not compiled. Falling back to Linking.openURL()...');
        try {
          await Linking.openURL(checkoutRes.checkoutUrl);
          console.log(`✅ [FRONTEND SUBSCRIPTION STEP 5.1: BROWSER_OPENED] Browser launched successfully.`);
        } catch (linkErr) {
          console.warn('⚠️ [FRONTEND SUBSCRIPTION STEP 5.2: BROWSER_OPEN_FAILED] Could not open Stripe Checkout URL:', linkErr);
          Alert.alert('Browser Link Error', 'Failed to launch system browser for payment: ' + linkErr.message);
        }

        Alert.alert(
          '💳 Stripe Payment Page Opened',
          'Enter test card (4000 0027 6000 3184, exp 12/30, CVC 123, Country: India) on the Stripe checkout page, then click "Complete" on 3DS screen.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => console.log('🔴 [FRONTEND SUBSCRIPTION STEP 5.3: MANUAL_CANCEL] User pressed Cancel on Alert.'),
            },
            {
              text: 'I Have Paid',
              onPress: async () => {
                console.log('⚡ [FRONTEND SUBSCRIPTION STEP 8: MANUAL_CONFIRM_CLICKED] User pressed "I Have Paid" button!');
                try {
                  setIsLoading(true);
                  const confirmRes = await apiClient.confirmSubscription(
                    checkoutRes.subscriptionId,
                    selectedPlan
                  );
                  console.log('✅ [FRONTEND SUBSCRIPTION STEP 8.1: CONFIRM_RESPONSE] Confirm response:', confirmRes);

                  if (confirmRes && confirmRes.success) {
                    console.log('🎉 [FRONTEND SUBSCRIPTION STEP 9: ACTIVATED_SUCCESS] Upgrade complete!');
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
                  }
                } catch (confirmErr) {
                  console.error('❌ [FRONTEND SUBSCRIPTION STEP 8.2: CONFIRM_ERROR] Confirmation error:', confirmErr);
                  Alert.alert('Activation Error', confirmErr.message || 'Failed to confirm subscription activation.');
                } finally {
                  setIsLoading(false);
                }
              },
            },
          ]
        );
      }
    } catch (err) {
      console.error('❌ [FRONTEND SUBSCRIPTION STEP 3/4 ERROR] Subscription error:', err);
      Alert.alert('Payment Error', err.message || 'Something went wrong while processing your subscription.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebViewNavigation = async (navState) => {
    const { url } = navState;
    console.log('🌐 [FRONTEND SUBSCRIPTION STEP 6: WEBVIEW_NAVIGATED] Navigated URL:', url);

    if (url && (
      url.includes('success-page') ||
      url.includes('checkout.stripe.dev/success') ||
      url.includes('status=success') ||
      url.includes('/success')
    )) {
      console.log('🎉 [FRONTEND SUBSCRIPTION STEP 7: PAYMENT_SUCCESS_DETECTED] Success URL reached! Initiating auto-activation...');
      setShowWebView(false);
      setIsLoading(true);

      Alert.alert('🎉 Payment Success Detected', `Processing your ${selectedPlan} plan activation...`);

      try {
        console.log(`🚀 [FRONTEND SUBSCRIPTION STEP 8: AUTO_CONFIRM] Calling apiClient.confirmSubscription for sub ${pendingSubId}, plan ${selectedPlan}...`);
        const confirmRes = await apiClient.confirmSubscription(pendingSubId, selectedPlan);
        console.log('✅ [FRONTEND SUBSCRIPTION STEP 8.1: AUTO_CONFIRM_RESPONSE]:', confirmRes);
        if (confirmRes && confirmRes.success) {
          console.log(`🎉 [FRONTEND SUBSCRIPTION STEP 9: ACTIVATION_COMPLETE] Successfully upgraded to ${selectedPlan}!`);
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
          Alert.alert('Activation Note', confirmRes?.message || 'Subscription processed!');
        }
      } catch (err) {
        console.warn('⚠️ [FRONTEND SUBSCRIPTION STEP 8.2: AUTO_CONFIRM_WARNING] Confirmation error:', err.message);
        Alert.alert('Activation Warning', err.message || 'Subscription completed.');
      } finally {
        setIsLoading(false);
      }
    } else if (url && (url.includes('cancel-page') || url.includes('checkout.stripe.dev/cancel') || url.includes('/cancel'))) {
      console.log('🔴 [FRONTEND SUBSCRIPTION STEP 7: PAYMENT_CANCEL_DETECTED] Cancel URL reached.');
      setShowWebView(false);
      Alert.alert('Checkout Cancelled', 'Your checkout process was cancelled.');
    }
  };

  const handleCancelSubscription = async () => {
    console.log('📌 [FRONTEND SUBSCRIPTION CANCEL STEP: INITIATED] Prompting user to confirm cancellation...');
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your auto-renewal? You will revert to the Free tier at period end.',
      [
        { text: 'Keep Membership', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            console.log('🔴 [FRONTEND SUBSCRIPTION CANCEL STEP: CONFIRMED] Sending cancel request...');
            try {
              setIsLoading(true);
              const res = await apiClient.cancelSubscription();
              console.log('✅ [FRONTEND SUBSCRIPTION CANCEL STEP: RESULT]', res);
              if (res && res.success) {
                Alert.alert('Subscription Cancelled', 'Your subscription auto-renewal has been cancelled.');
                if (typeof onSubscriptionUpdated === 'function') {
                  onSubscriptionUpdated('Free');
                }
                fetchMySubscription();
              }
            } catch (err) {
              console.error('❌ [FRONTEND SUBSCRIPTION CANCEL STEP: ERROR]', err);
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

      {/* In-App Stripe Checkout WebView Modal */}
      <Modal
        visible={showWebView}
        animationType="slide"
        onRequestClose={() => setShowWebView(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0F121A' }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: '#1E293B',
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.1)'
          }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
              💳 Secure Stripe Checkout
            </Text>
            <TouchableOpacity onPress={() => setShowWebView(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Test Mode Step-by-Step Helper Banner */}
          <View style={{
            backgroundColor: '#1E1B4B',
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderBottomWidth: 1,
            borderBottomColor: '#4338CA',
          }}>
            <Text style={{ color: '#A5B4FC', fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
              🧪 <Text style={{ fontWeight: '800', color: '#E0E7FF' }}>Test Mode Steps:</Text>{'\n'}
              1. Card: <Text style={{ color: '#FDE047', fontWeight: '800' }}>4242 4242 4242 4242</Text> | Exp: <Text style={{ color: '#FDE047', fontWeight: '800' }}>12/30</Text> | CVC: <Text style={{ color: '#FDE047', fontWeight: '800' }}>123</Text>{'\n'}
              2. Country: <Text style={{ color: '#FDE047', fontWeight: '800' }}>India</Text> (or US) ➔ Tap <Text style={{ color: '#38BDF8', fontWeight: '800' }}>Subscribe</Text>{'\n'}
              3. Payment completes instantly & auto-activates! 🎉
            </Text>
          </View>

          {stripeUrl ? (
            <WebView
              source={{ uri: stripeUrl }}
              onNavigationStateChange={handleWebViewNavigation}
              onShouldStartLoadWithRequest={(request) => {
                console.log('🔍 [WEBVIEW LOAD REQUEST]:', request.url);
                if (request.url && (
                  request.url.includes('success-page') ||
                  request.url.includes('checkout.stripe.dev/success') ||
                  request.url.includes('status=success') ||
                  request.url.includes('/success')
                )) {
                  handleWebViewNavigation(request);
                  return false;
                }
                return true;
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('🔴 [WEBVIEW ERROR LOG]:', nativeEvent);
                if (nativeEvent && nativeEvent.url && (
                  nativeEvent.url.includes('success-page') ||
                  nativeEvent.url.includes('checkout.stripe.dev/success') ||
                  nativeEvent.url.includes('status=success') ||
                  nativeEvent.url.includes('/success')
                )) {
                  console.log('⚡ [WEBVIEW ERROR RECOVERY] Connection error on success URL (e.g. localhost unreachable), auto-activating subscription anyway!');
                  handleWebViewNavigation(nativeEvent);
                }
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('🔴 [WEBVIEW HTTP ERROR LOG]:', nativeEvent.statusCode, nativeEvent.url);
                if (nativeEvent && nativeEvent.url && (
                  nativeEvent.url.includes('success-page') ||
                  nativeEvent.url.includes('checkout.stripe.dev/success') ||
                  nativeEvent.url.includes('status=success') ||
                  nativeEvent.url.includes('/success')
                )) {
                  console.log('⚡ [WEBVIEW HTTP ERROR RECOVERY] HTTP status error on success URL, auto-activating subscription anyway!');
                  handleWebViewNavigation(nativeEvent);
                }
              }}
              onLoadEnd={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.log('🏁 [WEBVIEW LOAD END]:', nativeEvent.url);
                if (nativeEvent && nativeEvent.url) {
                  handleWebViewNavigation(nativeEvent);
                }
              }}
              injectedJavaScript={`
                (function() {
                  // Intercept button clicks for log tracking and 3DS completion
                  document.addEventListener('click', function(e) {
                    var target = e.target || e.srcElement;
                    var text = target ? (target.innerText || target.value || target.textContent || '') : '';
                    if (text.includes('Complete') || text.includes('Authorize')) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STRIPE_COMPLETE_CLICKED', buttonText: text }));
                    } else if (text.includes('Subscribe') || text.includes('Pay') || text.includes('Submit')) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STRIPE_SUBSCRIBE_CLICKED', buttonText: text, url: window.location.href }));
                    }
                  }, true);
                })();
                true;
              `}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data && data.type === 'STRIPE_SUBSCRIBE_CLICKED') {
                    console.log(`💳 [STRIPE UI LOG] User clicked "${data.buttonText}" button on Stripe Checkout Page! Processing payment...`);
                  } else if (data && data.type === 'STRIPE_COMPLETE_CLICKED') {
                    console.log('⚡ [AUTO-DETECTED COMPLETE CLICK] Proceeding to activate subscription...');
                    setTimeout(() => {
                      handleWebViewNavigation({ url: 'https://checkout.stripe.dev/success' });
                    }, 1200);
                  }
                } catch (e) {}
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              originWhitelist={['*']}
              mixedContentMode="always"
              thirdPartyCookiesEnabled={true}
              allowFileAccess={true}
              setSupportMultipleWindows={false}
              javaScriptCanOpenWindowsAutomatically={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F121A' }}>
                  <ActivityIndicator size="large" color="#FE3C72" />
                  <Text style={{ color: '#94A3B8', marginTop: 12 }}>Loading Stripe Checkout...</Text>
                </View>
              )}
              style={{ flex: 1 }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
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
