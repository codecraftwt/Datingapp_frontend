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

const getFeatureIcon = (text) => {
  const lower = (text || '').toLowerCase();
  if (lower.includes('super like')) {
    return <Ionicons name="star" size={18} color="#FFD700" style={{ marginRight: 10 }} />;
  }
  if (lower.includes('swipe') || lower.includes('like')) {
    return <Ionicons name="heart" size={18} color="#FE3C72" style={{ marginRight: 10 }} />;
  }
  if (lower.includes('see who') || lower.includes('liked your profile')) {
    return <Ionicons name="eye" size={18} color="#FFD700" style={{ marginRight: 10 }} />;
  }
  if (lower.includes('search')) {
    return <Ionicons name="search" size={18} color="#FE3C72" style={{ marginRight: 10 }} />;
  }
  if (lower.includes('boost')) {
    return <Ionicons name="rocket" size={18} color="#FE3C72" style={{ marginRight: 10 }} />;
  }
  return <Ionicons name="sparkles" size={18} color="#FFD700" style={{ marginRight: 10 }} />;
};

export const SubscriptionModal = ({ visible, onClose, onSubscriptionUpdated, currentTier = 'Free' }) => {
  const [selectedPlan, setSelectedPlan] = useState('Gold');
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);

  // Dynamic Plans State from Backend API
  const [availablePlans, setAvailablePlans] = useState([]);
  const [isFetchingPlans, setIsFetchingPlans] = useState(false);

  // In-App Stripe WebView State
  const [showWebView, setShowWebView] = useState(false);
  const [stripeUrl, setStripeUrl] = useState('');
  const [pendingSubId, setPendingSubId] = useState('');
  const [isWebViewLoading, setIsWebViewLoading] = useState(true);

  const pendingSubIdRef = React.useRef('');
  const selectedPlanRef = React.useRef('Gold');
  const isConfirmingRef = React.useRef(false);

  useEffect(() => {
    selectedPlanRef.current = selectedPlan;
  }, [selectedPlan]);

  useEffect(() => {
    if (visible) {
      console.log('📌 [STEP 1: MODAL_OPENED] Subscription Modal opened. Current tier:', currentTier);
      isConfirmingRef.current = false;
      fetchMySubscription();
      fetchSubscriptionPlans();
    }
  }, [visible]);

  const fetchSubscriptionPlans = async () => {
    try {
      console.log('📡 [FETCH_PLANS_REQUEST] Calling API: GET /api/subscriptions/plans...');
      setIsFetchingPlans(true);
      if (typeof apiClient.resetResolvedUrl === 'function') {
        apiClient.resetResolvedUrl();
      }
      const res = await apiClient.getSubscriptionPlans();
      console.log('✅ [FETCH_PLANS_RESPONSE] Received available plans from API:', JSON.stringify(res, null, 2));

      if (res && res.success) {
        let list = res.plansList || [];
        if (!list || list.length === 0) {
          if (res.plans) {
            list = Object.values(res.plans);
          }
        }

        // Filter for paid subscription plans:
        // - All active plans (isActive !== false)
        // - If a plan is hidden by admin, ONLY show it if it is the user's CURRENT active plan ("keep as current, blurred")
        const currentTierUpper = (activeTier || currentTier || '').toUpperCase();
        const paidPlans = (list || []).filter((p) => {
          const tierKey = (p.planKey || p.tier || '').toUpperCase();
          const priceNum = parseFloat(p.price !== undefined ? p.price : (p.priceAmount ? String(p.priceAmount).replace('$', '') : '0'));
          const isPaid = tierKey !== 'FREE' && priceNum > 0;
          if (!isPaid) return false;

          const isPlanActive = p.isActive !== false;
          const isUserCurrent = tierKey === currentTierUpper;
          return isPlanActive || isUserCurrent;
        });

        if (paidPlans.length > 0) {
          setAvailablePlans(paidPlans);
          const hasSelected = paidPlans.find((p) => (p.planKey || p.tier) === selectedPlanRef.current);
          if (!hasSelected) {
            const hasGold = paidPlans.find((p) => (p.planKey || p.tier) === 'Gold');
            setSelectedPlan(hasGold ? 'Gold' : (paidPlans[0].planKey || paidPlans[0].tier));
          }
        }
      }
    } catch (err) {
      console.error('❌ [FETCH_PLANS_ERROR] Error fetching subscription plans:', err);
    } finally {
      setIsFetchingPlans(false);
    }
  };

  const fetchMySubscription = async () => {
    try {
      console.log('📡 [STEP 1.1: FETCH_INFO_REQUEST] Calling API: GET /api/subscriptions/my-subscription...');
      setIsFetchingInfo(true);
      const res = await apiClient.getMySubscription();
      console.log('✅ [STEP 1.2: FETCH_INFO_RESPONSE] Received user subscription details:', JSON.stringify(res, null, 2));
      if (res && res.success) {
        setSubscriptionInfo(res);
      }
    } catch (err) {
      console.error('❌ [STEP 1.3: FETCH_INFO_ERROR] Error fetching subscription info:', err);
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const activeTier = subscriptionInfo?.subscriptionTier || currentTier || 'Free';

  const handleSubscribe = async () => {
    console.log(`\n==================================================`);
    console.log(`💳 [SUBSCRIBE_CLICKED] User clicked Subscribe for "${selectedPlan}"`);
    console.log(`==================================================\n`);

    try {
      setIsLoading(true);
      isConfirmingRef.current = false;

      // Create Hosted Checkout Session with Stripe Backend
      const checkoutRes = await apiClient.createSubscriptionCheckout(selectedPlan);

      if (!checkoutRes || !checkoutRes.success || !checkoutRes.checkoutUrl) {
        console.error('❌ Missing checkoutUrl in response!', checkoutRes);
        Alert.alert('Checkout Error', checkoutRes?.message || 'Failed to initialize subscription checkout.');
        setIsLoading(false);
        return;
      }

      const generatedSubId = checkoutRes.subscriptionId || checkoutRes.sessionId || '';
      pendingSubIdRef.current = generatedSubId;
      selectedPlanRef.current = selectedPlan;

      setPendingSubId(generatedSubId);
      setStripeUrl(checkoutRes.checkoutUrl);
      setIsWebViewLoading(true);

      if (isWebViewAvailable) {
        setShowWebView(true);
      } else {
        launchSystemBrowser(checkoutRes, generatedSubId);
      }
    } catch (err) {
      console.error('❌ Failed during handleSubscribe:', err);
      Alert.alert('Payment Error', err.message || 'Something went wrong while creating checkout session.');
    } finally {
      setIsLoading(false);
    }
  };

  const launchSystemBrowser = async (checkoutRes, generatedSubId) => {
    try {
      await Linking.openURL(checkoutRes.checkoutUrl);
      console.log(`✅ [STEP 3.1: SYSTEM_BROWSER_OPENED] System browser launched successfully.`);
    } catch (linkErr) {
      console.warn('⚠️ [STEP 3.2: BROWSER_OPEN_FAILED] Could not launch system browser:', linkErr);
      Alert.alert('Browser Link Error', 'Failed to launch system browser for payment: ' + linkErr.message);
    }

    // POPUP STEP 3 Fallback Dialog: Instructions & Manual Confirmation
    Alert.alert(
      '💳 Step 3/5: Complete Payment on Stripe',
      '1. Enter test card: 4242 4242 4242 4242 (Exp: 12/30, CVC: 123)\n2. Click "Subscribe" on Stripe page\n3. Tap "I Have Paid" below once done.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => console.log('🔴 [STEP 3.3: MANUAL_CANCEL] User pressed Cancel on Alert.'),
        },
        {
          text: 'I Have Paid',
          onPress: async () => {
            console.log('⚡ [STEP 4: MANUAL_CONFIRM_TRIGGERED] User pressed "I Have Paid" button!');
            try {
              setIsLoading(true);
              const subToConfirm = pendingSubIdRef.current || checkoutRes.subscriptionId;
              const planToConfirm = selectedPlanRef.current || selectedPlan;

              // POPUP STEP 4: Confirming Payment with Backend
              Alert.alert('🚀 Step 4/5: Verifying Payment', `Confirming ${planToConfirm} membership with server...`);

              console.log(`🚀 [STEP 4.1: CONFIRM_REQUEST] Calling API: POST /api/subscriptions/confirm`);
              console.log(`   ↳ Payload:`, JSON.stringify({ subscriptionId: subToConfirm, planType: planToConfirm }));

              const confirmRes = await apiClient.confirmSubscription(subToConfirm, planToConfirm);
              console.log('✅ [STEP 4.2: CONFIRM_RESPONSE] Backend confirm response:', JSON.stringify(confirmRes, null, 2));

              if (confirmRes && confirmRes.success) {
                console.log('🎉 [STEP 5: ACTIVATION_COMPLETE] Subscription successfully activated!');
                if (typeof onSubscriptionUpdated === 'function') {
                  onSubscriptionUpdated(planToConfirm, confirmRes?.permissions);
                }
                // POPUP STEP 5: Activation Complete
                Alert.alert(
                  '👑 Step 5/5: Subscription Activated!',
                  `Congratulations! You are now subscribed to ${planToConfirm} Membership!`,
                  [
                    {
                      text: 'Awesome!',
                      onPress: () => {
                        onClose();
                      },
                    },
                  ]
                );
              } else {
                console.warn('⚠️ [STEP 4.3: MANUAL_CONFIRM_NOTE] Confirm response returned note:', confirmRes);
                Alert.alert('Activation Note', confirmRes?.message || 'Subscription process returned note.');
              }
            } catch (confirmErr) {
              console.error('❌ [STEP 4.4: CONFIRM_ERROR] Subscription confirmation error:', confirmErr);
              Alert.alert('Activation Error', confirmErr.message || 'Failed to confirm subscription activation.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleWebViewNavigation = async (navState) => {
    const { url, title, loading, canGoBack } = navState || {};
    console.log(`\n🌐 [STEP 4: WEBVIEW_NAVIGATED] Page Transition Log:`);
    console.log(`   ↳ URL: ${url}`);
    console.log(`   ↳ Title: "${title || 'N/A'}" | Loading: ${loading} | CanGoBack: ${canGoBack}`);

    if (!url) return;

    // Check if URL indicates payment completion
    const isSuccessUrl =
      url.includes('success-page') ||
      url.includes('checkout.stripe.dev/success') ||
      url.includes('status=success') ||
      url.includes('/success');

    const isCancelUrl =
      url.includes('cancel-page') ||
      url.includes('checkout.stripe.dev/cancel') ||
      url.includes('/cancel');

    if (!isSuccessUrl && !isCancelUrl) {
      console.log(`ℹ️ [STEP 4.1: EVALUATION_NOTE] URL transition does not match success/cancel endpoints yet.`);
      return;
    }

    if (isCancelUrl) {
      console.log('🔴 [STEP 4.2: CANCEL_URL_DETECTED] Cancel URL reached in WebView.');
      setShowWebView(false);
      Alert.alert('❌ Checkout Cancelled', 'Your subscription checkout process was cancelled.');
      return;
    }

    if (isSuccessUrl) {
      if (isConfirmingRef.current) {
        console.log('⚠️ [STEP 4.3: DUPLICATE_CONFIRM_BLOCKED] Success URL hit again, but confirm call is already in progress.');
        return;
      }
      isConfirmingRef.current = true;

      // Extract dynamically from URL if available
      let targetSubId = pendingSubIdRef.current || pendingSubId;
      let targetPlan = selectedPlanRef.current || selectedPlan;

      if (url.includes('planType=')) {
        const matchPlan = url.match(/planType=([^&]+)/);
        if (matchPlan && matchPlan[1]) targetPlan = decodeURIComponent(matchPlan[1]);
      }
      if (url.includes('subscriptionId=')) {
        const matchSub = url.match(/subscriptionId=([^&]+)/);
        if (matchSub && matchSub[1]) targetSubId = decodeURIComponent(matchSub[1]);
      } else if (url.includes('session_id=')) {
        const matchSes = url.match(/session_id=([^&]+)/);
        if (matchSes && matchSes[1] && !targetSubId) targetSubId = decodeURIComponent(matchSes[1]);
      }

      console.log(`\n==================================================`);
      console.log('🎉 [STEP 4: SUCCESS_URL_DETECTED] Success URL matched in WebView!');
      console.log(`   ↳ Matched URL: ${url}`);
      console.log(`   ↳ Target Subscription ID: ${targetSubId}`);
      console.log(`   ↳ Target Plan: ${targetPlan}`);
      console.log(`==================================================\n`);

      // Silently confirm and activate subscription in background without overlapping popups
      try {
        console.log(`🚀 [AUTO_CONFIRM_REQUEST] Invoking API: POST /api/subscriptions/confirm`);
        const confirmRes = await apiClient.confirmSubscription(targetSubId, targetPlan);
        console.log('✅ [AUTO_CONFIRM_RESPONSE] Backend response:', JSON.stringify(confirmRes, null, 2));

        if (confirmRes && confirmRes.success) {
          console.log(`🎉 [ACTIVATION_COMPLETE] Successfully upgraded user to ${targetPlan}!`);
          if (typeof onSubscriptionUpdated === 'function') {
            onSubscriptionUpdated(targetPlan, confirmRes?.permissions);
          }
        }
      } catch (err) {
        console.warn('⚠️ Silent auto-confirm warning:', err?.message || err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCancelSubscription = async () => {
    console.log('📌 [STEP 6: CANCEL_SUBSCRIPTION_INITIATED] User requested to cancel active subscription.');
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your auto-renewal? You will revert to the Free tier at period end.',
      [
        { text: 'Keep Membership', style: 'cancel', onPress: () => console.log('🔴 [STEP 6.1: CANCEL_ABORTED] User kept membership.') },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            console.log('🔴 [STEP 6.2: CANCEL_CONFIRMED] User confirmed cancellation. Calling API: POST /api/subscriptions/cancel...');
            try {
              setIsLoading(true);
              const res = await apiClient.cancelSubscription();
              console.log('✅ [STEP 6.3: CANCEL_RESPONSE] Backend response:', JSON.stringify(res, null, 2));
              if (res && res.success) {
                // POPUP STEP 6: Cancelled Success
                Alert.alert('ℹ️ Step 6/6: Subscription Cancelled', 'Your subscription auto-renewal has been cancelled.');
                if (typeof onSubscriptionUpdated === 'function') {
                  onSubscriptionUpdated('Free');
                }
                fetchMySubscription();
              }
            } catch (err) {
              console.error('❌ [STEP 6.4: CANCEL_ERROR] Error cancelling subscription:', err);
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
            <Ionicons name="ribbon-outline" size={52} color="#FFD700" style={{ marginBottom: 8 }} />
            <Text style={styles.heroTitle}>Unlock Your Dating Superpowers</Text>
            <Text style={styles.heroSubtitle}>
              Get 5x more matches, see who likes you, and stand out from the crowd.
            </Text>

            {activeTier !== 'Free' && (
              <View style={styles.activeBadgeContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="sparkles" size={14} color="#FFD700" style={{ marginRight: 6 }} />
                  <Text style={styles.activeBadgeText}>
                    CURRENT PLAN: {activeTier.toUpperCase()} MEMBER
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Dynamic Plan Selector Cards */}
          <View style={styles.plansContainer}>
            {isFetchingPlans && availablePlans.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#FE3C72" />
                <Text style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: 12, fontSize: 14 }}>
                  Loading membership plans...
                </Text>
              </View>
            ) : availablePlans.length > 0 ? (
              availablePlans.map((plan) => {
                const planKey = plan.planKey || plan.tier;
                const isSelected = selectedPlan === planKey;
                const upperKey = (planKey || '').toUpperCase();
                const isCurrent = upperKey === (activeTier || currentTier || '').toUpperCase();
                const isHidden = plan.isActive === false;
                const isGold = upperKey === 'GOLD';
                const isDiamond = upperKey.includes('DIAMOND') || upperKey.includes('VIP');
                const accentColor = isHidden ? '#94A3B8' : isDiamond ? '#00E5FF' : isGold ? '#FFD700' : '#FE3C72';

                return (
                  <TouchableOpacity
                    key={plan._id || planKey}
                    style={[
                      styles.planCard,
                      isDiamond ? styles.diamondPlanCard : isGold ? styles.goldPlanCard : styles.premiumPlanCard,
                      isSelected && (isDiamond ? styles.selectedDiamondCard : isGold ? styles.selectedGoldCard : styles.selectedPremiumCard),
                      isHidden && styles.blurredPlanCard,
                    ]}
                    onPress={() => setSelectedPlan(planKey)}
                    activeOpacity={0.85}
                  >
                    {isSelected && (
                      <View style={[styles.radioSelectedDot, { backgroundColor: accentColor }]} />
                    )}

                    <View style={styles.planCardHeader}>
                      {isHidden ? (
                        <View style={styles.hiddenBadge}>
                          <Ionicons name="eye-off-outline" size={12} color="#CBD5E1" style={{ marginRight: 5 }} />
                          <Text style={styles.hiddenBadgeText}>
                            {isCurrent ? 'CURRENT PLAN (ARCHIVED)' : 'HIDDEN PLAN'}
                          </Text>
                        </View>
                      ) : plan.highlightBadge ? (
                        <View style={isDiamond ? styles.diamondBadge : isGold ? styles.goldBadge : styles.premiumBadge}>
                          <Text style={isDiamond ? styles.diamondBadgeText : isGold ? styles.goldBadgeText : styles.premiumBadgeText}>
                            {plan.highlightBadge.toUpperCase()}
                          </Text>
                        </View>
                      ) : null}

                      <Text style={[isDiamond ? styles.planNameDiamond : isGold ? styles.planNameGold : styles.planNamePremium, isHidden && { color: '#CBD5E1' }]}>
                        {plan.name ? plan.name.toUpperCase() : planKey.toUpperCase()}
                      </Text>

                      <Text style={[styles.planPrice, isHidden && { color: '#94A3B8' }]}>
                        {plan.priceDisplay || (plan.priceAmount ? `${plan.priceAmount} / month` : `$${plan.price} / month`)}
                      </Text>

                      {isHidden && isCurrent && (
                        <View style={styles.blurredNoticeContainer}>
                          <Text style={styles.blurredNoticeText}>
                            🔒 Kept as your current plan. All features remain fully active!
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.featureList}>
                      {plan.features && plan.features.length > 0 ? (
                        plan.features.map((featStr, idx) => (
                          <View key={idx} style={styles.featureItem}>
                            {getFeatureIcon(featStr)}
                            <Text style={styles.featureText}>{featStr}</Text>
                          </View>
                        ))
                      ) : (
                        <View style={styles.featureItem}>
                          <Ionicons name="sparkles" size={18} color={accentColor} style={{ marginRight: 10 }} />
                          <Text style={styles.featureText}>Full Member Privileges</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              /* Fallback Static Cards */
              <>
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
                    <Text style={styles.planPrice}>$9.99 <Text style={styles.perMonth}>/ month</Text></Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.featureList}>
                    <View style={styles.featureItem}>
                      <Ionicons name="heart" size={18} color="#FFD700" style={{ marginRight: 10 }} />
                      <Text style={styles.featureText}>Unlimited Likes & Swipes</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="eye" size={18} color="#FFD700" style={{ marginRight: 10 }} />
                      <Text style={styles.featureText}>See Who Liked Your Profile</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="star" size={18} color="#FFD700" style={{ marginRight: 10 }} />
                      <Text style={styles.featureText}>5 Super Likes Every Day</Text>
                    </View>
                  </View>
                </TouchableOpacity>

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
                    <Text style={styles.planPrice}>$4.99 <Text style={styles.perMonth}>/ month</Text></Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.featureList}>
                    <View style={styles.featureItem}>
                      <Ionicons name="diamond" size={18} color="#FE3C72" style={{ marginRight: 10 }} />
                      <Text style={styles.featureText}>All Gold Tier Features Included</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="rocket" size={18} color="#FE3C72" style={{ marginRight: 10 }} />
                      <Text style={styles.featureText}>1 Free Monthly Profile Boost</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="search" size={18} color="#FE3C72" style={{ marginRight: 10 }} />
                      <Text style={styles.featureText}>Advanced Search Filters Unlocked</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </>
            )}
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

          {isLoading && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 18, 26, 0.92)',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 99999,
            }}>
              <ActivityIndicator size="large" color="#FE3C72" />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 16 }}>
                Connecting to Stripe...
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 8 }}>
                Preparing your secure checkout session
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* In-App Stripe Checkout WebView Modal */}
      <Modal
        visible={showWebView}
        animationType="slide"
        onRequestClose={() => {
          setShowWebView(false);
          if (isConfirmingRef.current) {
            onClose();
          }
        }}
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="card" size={20} color="#38BDF8" style={{ marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                Secure Stripe Checkout
              </Text>
            </View>
            <TouchableOpacity onPress={() => {
              setShowWebView(false);
              if (isConfirmingRef.current) {
                onClose();
              }
            }}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, position: 'relative' }}>
            {stripeUrl ? (
              <WebView
                source={{ uri: stripeUrl }}
                onLoadStart={() => setIsWebViewLoading(true)}
                onLoadEnd={() => setIsWebViewLoading(false)}
                onNavigationStateChange={handleWebViewNavigation}
                onShouldStartLoadWithRequest={(request) => {
                  console.log('🔍 [WEBVIEW LOAD_REQUEST]:', request.url);
                  if (request.url && (request.url.includes('back-to-app') || request.url.includes('datingapp://'))) {
                    console.log('🎉 [BACK_TO_APP] Intercepted Back to App redirect!');
                    setShowWebView(false);
                    onClose();
                    return false;
                  }
                  if (request.url && (
                    request.url.includes('success-page') ||
                    request.url.includes('checkout.stripe.dev/success') ||
                    request.url.includes('status=success') ||
                    request.url.includes('/success')
                  )) {
                    handleWebViewNavigation(request);
                    return true;
                  }
                  return true;
                }}
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  if (nativeEvent && nativeEvent.url && (
                    nativeEvent.url.includes('success-page') ||
                    nativeEvent.url.includes('checkout.stripe.dev/success') ||
                    nativeEvent.url.includes('status=success') ||
                    nativeEvent.url.includes('/success')
                  )) {
                    handleWebViewNavigation(nativeEvent);
                  }
                }}
                onHttpError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  if (nativeEvent && nativeEvent.url && (
                    nativeEvent.url.includes('success-page') ||
                    nativeEvent.url.includes('checkout.stripe.dev/success') ||
                    nativeEvent.url.includes('status=success') ||
                    nativeEvent.url.includes('/success')
                  )) {
                    handleWebViewNavigation(nativeEvent);
                  }
                }}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data && data.type === 'BACK_TO_APP') {
                      console.log('🎉 [BACK_TO_APP] User tapped Back to App on Success Page!');
                      setShowWebView(false);
                      onClose();
                      return;
                    }
                  } catch (e) { }
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['*']}
                mixedContentMode="always"
                thirdPartyCookiesEnabled={true}
                allowFileAccess={true}
                setSupportMultipleWindows={false}
                javaScriptCanOpenWindowsAutomatically={true}
                style={{ flex: 1 }}
              />
            ) : null}

            {/* Whole-screen loader covering entire WebView until Stripe checkout finishes loading */}
            {isWebViewLoading && (
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#0F121A',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 9999,
              }}>
                <ActivityIndicator size="large" color="#FE3C72" />
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 16 }}>
                  Loading Stripe Checkout...
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 8 }}>
                  Please wait while your secure payment session loads
                </Text>
              </View>
            )}
          </View>
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
  diamondPlanCard: {},
  selectedDiamondCard: {
    borderColor: '#00E5FF',
    backgroundColor: '#0F2027',
  },
  blurredPlanCard: {
    opacity: 0.65,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(20, 25, 35, 0.75)',
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
  hiddenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  hiddenBadgeText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '800',
  },
  blurredNoticeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  blurredNoticeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontStyle: 'italic',
  },
  diamondBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  diamondBadgeText: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: '800',
  },
  planNameGold: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  planNameDiamond: {
    color: '#00E5FF',
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
