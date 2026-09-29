import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { BASE_URL, CANDIDATE_URLS, LIVE_URL, LOCAL_URL, EMULATOR_URL, NETWORK_URL, getBaseUrl, setBaseUrl } from './config';

let isResolving = false;
let activeResolvedUrl = null;

export const resetResolvedUrl = () => {
  activeResolvedUrl = null;
};

const resolveWorkingBaseUrl = async (forceRecheck = false) => {
  if (activeResolvedUrl && !forceRecheck && (!__DEV__ || activeResolvedUrl !== LIVE_URL)) {
    return activeResolvedUrl;
  }
  if (isResolving) return getBaseUrl();
  isResolving = true;

  const candidateList = __DEV__ ? [LOCAL_URL, NETWORK_URL, EMULATOR_URL, LIVE_URL] : [LIVE_URL, LOCAL_URL, NETWORK_URL, EMULATOR_URL];

  for (const candidate of candidateList) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${candidate}/health`, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok || res.status < 500) {
        activeResolvedUrl = candidate;
        setBaseUrl(candidate);
        isResolving = false;
        console.log(`[apiClient] Auto-resolved working backend URL: ${candidate}`);
        return candidate;
      }
    } catch (err) {
      // try next candidate
    }
  }

  activeResolvedUrl = LIVE_URL;
  setBaseUrl(LIVE_URL);
  isResolving = false;
  return activeResolvedUrl;
};

let authTokenInMemory = null;
let lastKnownUserEmail = null;
let lastKnownUserId = null;

export const setLastKnownUser = (userData) => {
  if (!userData) return;
  if (userData.email) {
    lastKnownUserEmail = userData.email.toString().trim().toLowerCase();
    AsyncStorage.setItem('persistent_user_email', lastKnownUserEmail).catch(() => {});
  }
  const uId = userData.id || userData._id;
  if (uId) {
    lastKnownUserId = uId.toString();
    AsyncStorage.setItem('persistent_user_id', lastKnownUserId).catch(() => {});
  }
};

export const getLastKnownUser = () => ({
  email: lastKnownUserEmail,
  userId: lastKnownUserId,
});

// Eagerly pre-load auth token and user from AsyncStorage into memory
AsyncStorage.getItem('token').then((token) => {
  if (token && token !== 'null' && token !== 'undefined') {
    authTokenInMemory = token;
  }
}).catch(() => {});

AsyncStorage.getItem('persistent_user_email').then((em) => {
  if (em) lastKnownUserEmail = em.trim().toLowerCase();
}).catch(() => {});

AsyncStorage.getItem('persistent_user_id').then((id) => {
  if (id) lastKnownUserId = id.toString();
}).catch(() => {});

AsyncStorage.getItem('user').then((userStr) => {
  if (userStr) {
    try {
      const parsed = JSON.parse(userStr);
      setLastKnownUser(parsed);
    } catch (e) {}
  }
}).catch(() => {});

let onSessionTerminatedCallback = null;
let isManualLogoutInProgress = false;
let isDeactivationAlertShowing = false;

export const setManualLogoutInProgress = (val) => {
  isManualLogoutInProgress = !!val;
};

export const getIsManualLogoutInProgress = () => isManualLogoutInProgress;

export const getIsDeactivationAlertShowing = () => isDeactivationAlertShowing;
export const setIsDeactivationAlertShowing = (val) => {
  isDeactivationAlertShowing = !!val;
};

export const setOnSessionTerminatedHandler = (cb) => {
  onSessionTerminatedCallback = cb;
};

export const setAuthToken = (token) => {
  authTokenInMemory = token;
};

const request = async (url, options = {}, isRetry = false) => {
  try {
    let token = authTokenInMemory;
    if (!token || token === 'null' || token === 'undefined') {
      token = await AsyncStorage.getItem('token');
      if (token && token !== 'null' && token !== 'undefined') {
        authTokenInMemory = token;
      } else {
        token = null;
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const isFormData =
      options.body &&
      (options.body instanceof FormData ||
        (options.body._parts && Array.isArray(options.body._parts)) ||
        typeof options.body.append === 'function');

    if (isFormData) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }

    let currentBase = activeResolvedUrl || getBaseUrl();
    const formatFullUrl = (base, path) => {
      const b = (base || '').replace(/\/+$/, '');
      const p = path.startsWith('/') ? path : `/${path}`;
      return `${b}${p}`;
    };

    const defaultTimeout = isFormData ? 600000 : 20000;
    let response;
    try {
      const controller = new AbortController();
      const reqTimeout = setTimeout(() => controller.abort(), options.timeout || defaultTimeout);

      const targetUrl = formatFullUrl(currentBase, url);
      console.log(`🌐 [API_CLIENT TARGET] ${options.method || 'GET'} ${targetUrl} (Active Base: ${currentBase})`);
      response = await fetch(targetUrl, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
      clearTimeout(reqTimeout);
    } catch (networkErr) {
      if (options.signal && options.signal.aborted) {
        throw networkErr;
      }

      // Check device network connectivity to avoid noisy retries when user turned network off
      try {
        const netState = await NetInfo.fetch();
        if (netState && netState.isConnected === false) {
          const offlineErr = new Error('Network request failed: Device is offline');
          offlineErr.isOffline = true;
          throw offlineErr;
        }
      } catch (checkErr) {
        if (checkErr.isOffline) throw checkErr;
      }

      if (networkErr.name === 'AbortError') {
        console.warn(`[apiClient] Request to ${formatFullUrl(currentBase, url)} timed out. Retrying...`);
      } else {
        console.warn(`[apiClient] Network request failed on ${formatFullUrl(currentBase, url)}. Retrying with auto-resolution...`);
      }
      activeResolvedUrl = null;
      currentBase = await resolveWorkingBaseUrl();
      try {
        const retryController = new AbortController();
        const retryTimeoutMs = options.timeout || defaultTimeout;
        const retryTimeout = setTimeout(() => retryController.abort(), retryTimeoutMs);
        const retryUrl = formatFullUrl(currentBase, url);
        response = await fetch(retryUrl, {
          ...options,
          headers,
          signal: retryController.signal,
        });
        clearTimeout(retryTimeout);
      } catch (retryErr) {
        if (retryErr.name === 'AbortError') {
          console.warn(`[apiClient] Connection retry timed out on ${currentBase}${url}`);
        } else {
          console.warn(`[apiClient] Connection retry on ${currentBase}${url} failed:`, retryErr.message);
        }
        throw retryErr;
      }
    }

    // Auto-fallback to candidate backend URLs if current backend returns 404
    if (!response.ok && response.status === 404 && !isRetry) {
      console.warn(`[apiClient] Current backend (${currentBase}) returned 404 for ${url}. Trying candidate backend URLs...`);
      for (const fallbackUrl of [LOCAL_URL, NETWORK_URL, EMULATOR_URL, LIVE_URL]) {
        if (fallbackUrl === currentBase) continue;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const testRes = await fetch(`${fallbackUrl}${url}`, { ...options, headers, signal: controller.signal });
          clearTimeout(timeoutId);
          if (testRes.ok || (testRes.status < 500 && testRes.status !== 404)) {
            activeResolvedUrl = fallbackUrl;
            setBaseUrl(fallbackUrl);
            const responseText = await testRes.text();
            try {
              return JSON.parse(responseText);
            } catch (e) {
              return { success: true };
            }
          }
        } catch (fErr) {
          // try next local fallback candidate
        }
      }
    }

    // Auto-retry 1 time on 500 Cold Start errors
    if (!response.ok && response.status >= 500 && !isRetry) {
      console.warn(`[apiClient] Cold start 500 error on ${url}. Retrying once after 1s...`);
      await new Promise((res) => setTimeout(res, 1000));
      return await request(url, options, true);
    }

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (jsonErr) {
      console.error(`[apiClient] Non-JSON response received from ${url} (status ${response.status}):`, responseText.substring(0, 150));
      if (response.status === 413) {
        throw new Error('File Size Limit Exceeded: The uploaded video file is too large (max 1GB allowed). Please select a video clip under 1GB.');
      }
      if (response.status === 404) {
        throw new Error(`Endpoint Not Found (404): ${url}`);
      }
      throw new Error(`Server Error (${response.status}): Request failed for ${url}.`);
    }

    if (!response.ok) {
      if (url.includes('/api/auth/logout')) {
        authTokenInMemory = null;
        AsyncStorage.removeItem('token').catch(() => {});
        AsyncStorage.removeItem('user').catch(() => {});
        return { success: true, message: 'Logged out successfully' };
      }

      let isAccountDeactivated =
        data?.status === 'deactivated' ||
        data?.code === 'ACCOUNT_DEACTIVATED' ||
        data?.isInactive === true ||
        data?.isDeactivated === true ||
        data?.message?.toLowerCase().includes('deactivated');

      let deactReason = data?.reason || data?.deactivationReason || '';

      const isIgnoredUrl =
        url.includes('/api/auth/login') ||
        url.includes('/api/profile/account-status');

      // If response is 401 or single device conflict, always verify if the account was actually deactivated before declaring session termination!
      if (!isAccountDeactivated && !isIgnoredUrl) {
        try {
          let checkPath = '/api/profile/account-status';
          let emailForCheck = lastKnownUserEmail;
          let userForCheck = lastKnownUserId;
          if (!emailForCheck) {
            try { emailForCheck = await AsyncStorage.getItem('persistent_user_email'); } catch (e) {}
          }
          if (!userForCheck) {
            try { userForCheck = await AsyncStorage.getItem('persistent_user_id'); } catch (e) {}
          }
          if (emailForCheck) {
            checkPath += `?email=${encodeURIComponent(emailForCheck)}`;
          } else if (userForCheck) {
            checkPath += `?userId=${encodeURIComponent(userForCheck)}`;
          }
          const tokenForCheck = authTokenInMemory;
          const statusCheckRes = await fetch(formatFullUrl(currentBase, checkPath), {
            headers: {
              'Content-Type': 'application/json',
              ...(tokenForCheck ? { 'authorization': `Bearer ${tokenForCheck}` } : {}),
            },
          });
          const statusCheckText = await statusCheckRes.text();
          try {
            const statusCheckJson = JSON.parse(statusCheckText);
            if (
              statusCheckJson?.status === 'deactivated' ||
              statusCheckJson?.isDeactivated === true ||
              statusCheckJson?.isActive === false
            ) {
              isAccountDeactivated = true;
              deactReason = statusCheckJson.reason || deactReason;
            }
          } catch (parseE) {}
        } catch (checkErr) {
          console.log('[apiClient] Pre-check account-status error:', checkErr);
        }
      }

      if (
        response.status === 401 ||
        response.status === 403 ||
        isAccountDeactivated ||
        data?.code === 'SINGLE_DEVICE_CONFLICT' ||
        data?.code === 'ACCOUNT_DEACTIVATED' ||
        data?.code === 'SESSION_TERMINATED' ||
        data?.message?.includes('authorization denied') ||
        data?.message?.includes('invalid or expired') ||
        data?.message?.includes('accessed on another device') ||
        data?.message?.includes('logged out from all devices')
      ) {
        console.warn('[apiClient] Stale, expired, deactivated or terminated session detected. Clearing token cache...');
        authTokenInMemory = null;
        AsyncStorage.removeItem('token').catch(() => {});
        AsyncStorage.removeItem('user').catch(() => {});

        const isExplicitRemoteTermination =
          isAccountDeactivated ||
          data?.code === 'SINGLE_DEVICE_CONFLICT' ||
          data?.code === 'ACCOUNT_DEACTIVATED' ||
          data?.code === 'SESSION_TERMINATED' ||
          data?.message?.includes('accessed on another device') ||
          data?.message?.includes('logged out from all devices');

        if (!isIgnoredUrl && isExplicitRemoteTermination && !isManualLogoutInProgress && !isDeactivationAlertShowing && onSessionTerminatedCallback) {
          isDeactivationAlertShowing = true;
          const finalReason = deactReason || data?.reason || data?.deactivationReason || '';
          onSessionTerminatedCallback({
            isDeactivated: isAccountDeactivated,
            reason: finalReason,
            code: isAccountDeactivated ? 'ACCOUNT_DEACTIVATED' : (data?.code || 'SESSION_TERMINATED'),
            status: isAccountDeactivated ? 'deactivated' : (data?.status || 'terminated'),
            message: isAccountDeactivated
              ? `Your account has been deactivated by the admin.${finalReason ? `\n\nReason: ${finalReason}` : ''}`
              : (data?.message || 'Your session has been terminated because your account was accessed on another device or logged out from all devices.'),
            email: lastKnownUserEmail,
            userId: lastKnownUserId,
          });
        }
      }
      throw { data, status: response.status };
    }
    return data;
  } catch (error) {
    if (url.includes('/api/auth/logout')) {
      authTokenInMemory = null;
      AsyncStorage.removeItem('token').catch(() => {});
      AsyncStorage.removeItem('user').catch(() => {});
      return { success: true, message: 'Logged out successfully' };
    }
    if (error?.name === 'AbortError' || error?.message?.includes('Aborted') || error?.message?.includes('abort')) {
      console.warn(`[apiClient] Request to ${url} was aborted or timed out.`);
      const timeoutError = new Error('Request timed out. Please check your network connection and try again.');
      timeoutError.name = 'TimeoutError';
      timeoutError.status = 408;
      throw timeoutError;
    }
    if (!isRetry && (error?.data?.message?.includes('Server error') || error?.message?.includes('500'))) {
      console.warn(`[apiClient] Retrying failed API call on ${url}...`);
      await new Promise((res) => setTimeout(res, 1000));
      return await request(url, options, true);
    }
    console.error(`API Error on ${url}:`, error);
    throw error;
  }
};

export const apiClient = {
  // Auth endpoints
  register: async (userData) => {
    let payload = { ...userData };
    if (!payload.fcmToken) {
      try {
        const { getFcmTokenOnly } = require('../services/notificationService');
        const fcm = await getFcmTokenOnly();
        if (fcm) payload.fcmToken = fcm;
      } catch (e) {}
    }
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const token = res.token || res.data?.token;
    if (token) {
      setAuthToken(token);
      await AsyncStorage.setItem('token', token);
    }
    return res;
  },
  login: async (credentials) => {
    let payload = { ...credentials };
    if (!payload.fcmToken) {
      try {
        const { getFcmTokenOnly } = require('../services/notificationService');
        const fcm = await getFcmTokenOnly();
        if (fcm) payload.fcmToken = fcm;
      } catch (e) {}
    }
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const token = res.token || res.data?.token;
    if (token) {
      setAuthToken(token);
      await AsyncStorage.setItem('token', token);
    }
    return res;
  },
  logoutBackend: async () => {
    isManualLogoutInProgress = true;
    try {
      return await request('/api/auth/logout', {
        method: 'POST',
      });
    } catch (e) {
      console.log('[apiClient] logoutBackend handled gracefully:', e?.message || e);
      return { success: true, message: 'Logged out successfully' };
    } finally {
      authTokenInMemory = null;
      setAuthToken(null);
      await AsyncStorage.removeItem('token').catch(() => {});
      await AsyncStorage.removeItem('user').catch(() => {});
    }
  },
  logoutAllDevices: async (credentials = {}) => {
    try {
      return await request('/api/auth/logout-all-devices', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
    } finally {
      setAuthToken(null);
      await AsyncStorage.removeItem('token');
    }
  },
  forgotPassword: async (body) => {
    return await request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  verifyResetOtp: async (body) => {
    return await request('/api/auth/verify-reset-otp', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  resetPassword: async (body) => {
    return await request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  changePassword: async (body) => {
    const payload = {
      oldPassword: body.oldPassword || body.currentPassword,
      newPassword: body.newPassword,
    };
    return await request('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  deleteAccount: async () => {
    return await request('/api/auth/delete-account', {
      method: 'DELETE',
    });
  },
  sendMobileOtp: async () => {
    return await request('/api/auth/send-mobile-otp', {
      method: 'POST',
    });
  },
  verifyMobileOtp: async (body) => {
    return await request('/api/auth/verify-mobile-otp', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Profile endpoints
  saveQuestionnaire: async (profileData) => {
    return await request('/api/profile/questionnaire', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },
  updateFcmToken: async (fcmToken) => {
    console.log('[API-CLIENT] Sending PUT /api/profile/fcm-token with token:', fcmToken ? (fcmToken.substring(0, 20) + '...') : 'EMPTY');
    const res = await request('/api/profile/fcm-token', {
      method: 'PUT',
      body: JSON.stringify({ fcmToken }),
    });
    console.log('[API-CLIENT] PUT /api/profile/fcm-token server response:', res);
    return res;
  },
  getMyReports: async () => {
    return await request('/api/profile/my-reports', {
      method: 'GET',
    });
  },
  getActiveWarning: async () => {
    return await request('/api/profile/active-warning', {
      method: 'GET',
    });
  },
  acknowledgeWarning: async (warningId) => {
    return await request('/api/profile/acknowledge-warning', {
      method: 'POST',
      body: JSON.stringify({ warningId }),
    });
  },
  checkAccountStatus: async (params = {}) => {
    try {
      let email = params?.email || lastKnownUserEmail;
      let userId = params?.userId || lastKnownUserId;
      if (!email) {
        try { email = await AsyncStorage.getItem('persistent_user_email'); } catch (e) {}
      }
      if (!userId) {
        try { userId = await AsyncStorage.getItem('persistent_user_id'); } catch (e) {}
      }
      let queryString = '';
      if (email) {
        queryString = `?email=${encodeURIComponent(email)}`;
      } else if (userId) {
        queryString = `?userId=${encodeURIComponent(userId)}`;
      }
      return await request(`/api/profile/account-status${queryString}`, {
        method: 'GET',
      });
    } catch (err) {
      if (
        err?.data?.status === 'deactivated' ||
        err?.data?.code === 'ACCOUNT_DEACTIVATED' ||
        err?.data?.isInactive ||
        err?.data?.isDeactivated
      ) {
        return {
          success: true,
          status: 'deactivated',
          isActive: false,
          isDeactivated: true,
          reason: err?.data?.reason || err?.data?.message || 'Your account has been deactivated by the admin.',
        };
      }
      return null;
    }
  },
  updateLocation: async (locationData) => {
    return await request('/api/profile/location', {
      method: 'PUT',
      body: JSON.stringify(locationData),
    });
  },
  clearCurrentLocation: async () => {
    return await request('/api/profile/location', {
      method: 'DELETE',
    });
  },
  getProfile: async () => {
    return await request('/api/profile/profile', {
      method: 'GET',
    });
  },
  getUserById: async (userId) => {
    if (!userId) return { message: 'No userId provided', user: null };
    try {
      return await request(`/api/profile/user/${userId}`, {
        method: 'GET',
      });
    } catch (err) {
      console.log('[apiClient] getUserById gracefully handled error:', err?.message || err);
      return { message: err?.message || 'Error', user: null };
    }
  },
  getQuestionnaires: async () => {
    return await request('/api/profile/questionnaire', {
      method: 'GET',
    });
  },
  getQuestionnaireOptions: async () => {
    try {
      return await request('/api/questionnaire/options', {
        method: 'GET',
      });
    } catch (e) {
      try {
        return await request('/api/profile/questionnaire-options', {
          method: 'GET',
        });
      } catch (err2) {
        console.warn('Fallback to local questionnaire options dataset:', err2);
        return { success: true, options: null };
      }
    }
  },
  getOnlineUsers: async () => {
    return await request('/api/profile/online-users', {
      method: 'GET',
    });
  },
  updatePresence: async (presenceData) => {
    try {
      return await request('/api/profile/presence', {
        method: 'POST',
        body: JSON.stringify(presenceData || { isOnline: true }),
      });
    } catch (err) {
      return { success: false };
    }
  },
  getOnlineStatusMap: async () => {
    return await request('/api/profile/online-status', {
      method: 'GET',
    });
  },
  getUserOnlineStatus: async (userId) => {
    return await request(`/api/profile/online-status/${userId}`, {
      method: 'GET',
    });
  },
  hideProfileMedia: async (mediaUrl) => {
    return await request('/api/profile/hide-media', {
      method: 'PUT',
      body: JSON.stringify({ mediaUrl }),
    });
  },
  unhideProfileMedia: async (mediaUrl) => {
    return await request('/api/profile/unhide-media', {
      method: 'PUT',
      body: JSON.stringify({ mediaUrl }),
    });
  },
  getHiddenProfileMedia: async () => {
    return await request('/api/profile/hidden-media', {
      method: 'GET',
    });
  },
  uploadImage: async (formData) => {
    return await request('/api/profile/upload', {
      method: 'POST',
      body: formData,
    });
  },
  removeProfilePhoto: async (body) => {
    return await request('/api/profile/remove-photo', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  removeProfile: async () => {
    return await request('/api/profile/remove-profile', {
      method: 'POST',
    });
  },

  // Chat endpoints
  getMessages: async () => {
    try {
      return await request('/api/chat/messages', {
        method: 'GET',
      });
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('Aborted') || err.message?.includes('abort')) {
        console.warn('[apiClient] getMessages request aborted or timed out.');
      }
      throw err;
    }
  },
  sendMessage: async (body) => {
    return await request('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  getChatMessages: async (selectedUserId) => {
    try {
      return await request(`/api/chat/messages/${selectedUserId}`, {
        method: 'GET',
      });
    } catch (err) {
      if (err?.name === 'AbortError' || err?.message?.includes('Aborted') || err?.message?.includes('abort')) {
        console.warn(`[apiClient] getChatMessages request for ${selectedUserId} was aborted or timed out.`);
      }
      throw err;
    }
  },
  editMessage: async ({ messageId, text }) => {
    return await request(`/api/chat/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    });
  },
  deleteMessage: async (messageId, deleteForEveryone = false) => {
    return await request(`/api/chat/messages/${messageId}`, {
      method: 'DELETE',
      body: JSON.stringify({ deleteForEveryone }),
    });
  },
  clearChat: async (selectedUserId) => {
    return await request(`/api/chat/messages/clear/${selectedUserId}`, {
      method: 'DELETE',
    });
  },
  clearAllChats: async () => {
    return await request('/api/chat/messages/clear-all', {
      method: 'DELETE',
    });
  },
  uploadChatMedia: async (formData) => {
    return await request('/api/chat/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // Match endpoints
  likeUser: async (body) => {
    return await request('/api/match/like', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  superLikeUser: async (body) => {
    return await request('/api/match/superlike', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  getLikes: async () => {
    return await request('/api/match/likes', {
      method: 'GET',
    });
  },
  getSuperLikeStatus: async () => {
    return await request('/api/match/superlike-status', {
      method: 'GET',
    });
  },
  getMatches: async () => {
    return await request('/api/match/matches', {
      method: 'GET',
    });
  },
  rejectLike: async (body) => {
    return await request('/api/match/reject-like', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  getSwipedIds: async () => {
    return await request('/api/match/swiped-ids', {
      method: 'GET',
    });
  },
  unmatchUser: async (body) => {
    return await request('/api/match/unmatch', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateProfileVisibility: async (body) => {
    return await request('/api/profile/visibility', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  blockUser: async (body) => {
    try {
      return await request('/api/match/block', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (err?.status === 404 || err?.message?.includes('404') || err?.data?.message?.includes('404')) {
        try {
          return await request('/api/profile/block', {
            method: 'POST',
            body: JSON.stringify(body),
          });
        } catch (err2) {
          return await request('/api/user/block', {
            method: 'POST',
            body: JSON.stringify(body),
          });
        }
      }
      throw err;
    }
  },
  getBlockedUsers: async (userId) => {
    try {
      const endpoint = userId ? `/api/match/blocked-users/${userId}` : '/api/match/blocked-users';
      return await request(endpoint, {
        method: 'GET',
      });
    } catch (err) {
      if (err?.status === 404 || err?.message?.includes('404') || err?.data?.message?.includes('404')) {
        const altEndpoint = userId ? `/api/profile/blocked-users/${userId}` : '/api/profile/blocked-users';
        return await request(altEndpoint, { method: 'GET' });
      }
      throw err;
    }
  },
  unblockUser: async (body) => {
    try {
      return await request('/api/match/unblock', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (err?.status === 404 || err?.message?.includes('404') || err?.data?.message?.includes('404')) {
        return await request('/api/profile/unblock', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      throw err;
    }
  },
  reportUser: async (body) => {
    return await request('/api/user/report', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  undoSwipe: async (body) => {
    return await request('/api/match/undo-swipe', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Notification endpoints
  getUnreadNotifications: async () => {
    return await request('/api/notifications/unread', {
      method: 'GET',
    });
  },
  markNotificationsAsRead: async (body = { markAll: true }) => {
    return await request('/api/notifications/mark-read', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  markLikesAsRead: async () => {
    return await request('/api/notifications/mark-likes-read', {
      method: 'PUT',
    });
  },
  markMatchesAsRead: async () => {
    return await request('/api/notifications/mark-matches-read', {
      method: 'PUT',
    });
  },
  getAllNotifications: async () => {
    return await request('/api/notifications/all', {
      method: 'GET',
    });
  },

  // Advanced Search endpoints
  advancedSearch: async (filters = {}) => {
    return await request('/api/search', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  },
  getFilterOptions: async () => {
    return await request('/api/search/options', {
      method: 'GET',
    });
  },
  getSearchPreferences: async () => {
    return await request('/api/search/preferences', {
      method: 'GET',
    });
  },
  updateSearchPreferences: async (preferences = {}) => {
    return await request('/api/search/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },
  // Main Profile Photo endpoints (Slot #1)
  uploadMainPhoto: async (data) => {
    const isForm = data instanceof FormData || (data && data._parts) || typeof data?.append === 'function';
    return await request('/api/profile/main-photo', {
      method: 'POST',
      body: isForm ? data : JSON.stringify(data),
      timeout: 180000,
    });
  },
  updateMainPhoto: async (data) => {
    const isForm = data instanceof FormData || (data && data._parts) || typeof data?.append === 'function';
    return await request('/api/profile/main-photo', {
      method: 'PUT',
      body: isForm ? data : JSON.stringify(data),
      timeout: 180000,
    });
  },
  removeMainPhoto: async () => {
    return await request('/api/profile/main-photo', {
      method: 'DELETE',
    });
  },

  // Gallery & Preview Media endpoints (Slots #2 - #9)
  uploadGalleryMedia: async (data, slotIndex) => {
    const query = slotIndex !== undefined ? `?slotIndex=${slotIndex}` : '';
    const isForm = data instanceof FormData || (data && data._parts) || typeof data?.append === 'function';
    return await request(`/api/profile/gallery-media${query}`, {
      method: 'POST',
      body: isForm ? data : JSON.stringify(data),
      timeout: 180000,
    });
  },
  updateGalleryMedia: async (data, slotIndex) => {
    const query = slotIndex !== undefined ? `?slotIndex=${slotIndex}` : '';
    const isForm = data instanceof FormData || (data && data._parts) || typeof data?.append === 'function';
    return await request(`/api/profile/gallery-media${query}`, {
      method: 'PUT',
      body: isForm ? data : JSON.stringify(data),
      timeout: 180000,
    });
  },
  removeGalleryMedia: async (slotIndex) => {
    return await request(`/api/profile/gallery-media/${slotIndex}`, {
      method: 'DELETE',
    });
  },
  getGalleryPreview: async () => {
    return await request('/api/profile/gallery-preview', {
      method: 'GET',
    });
  },

  // Subscription API endpoints with dual route fallback (plural & singular)
  getSubscriptionPlans: async () => {
    console.log('📡 [SUBSCRIPTION API CALL] GET /api/subscriptions/plans');
    console.log('   ↳ Trigger: Fetching available subscription plans');
    console.log('   ↳ Request Payload: None');
    if (__DEV__ && activeResolvedUrl === LIVE_URL) {
      await resolveWorkingBaseUrl(true);
    }
    try {
      const res = await request('/api/subscriptions/plans', { method: 'GET' });
      console.log('✅ [SUBSCRIPTION API RESPONSE] GET /api/subscriptions/plans SUCCESS:', res);
      return res;
    } catch (err) {
      if (err?.status === 404 || err?.message?.includes('404') || err?.data?.message?.includes('404')) {
        console.warn('⚠️ [SUBSCRIPTION API RETRY] Fallback to GET /api/subscription/plans');
        const resFallback = await request('/api/subscription/plans', { method: 'GET' });
        console.log('✅ [SUBSCRIPTION API RESPONSE] GET /api/subscription/plans SUCCESS:', resFallback);
        return resFallback;
      }
      console.error('❌ [SUBSCRIPTION API ERROR] GET /api/subscriptions/plans ERROR:', err);
      throw err;
    }
  },
  createSubscriptionCheckout: async (planType) => {
    const payload = { planType };
    console.log('📡 [SUBSCRIPTION API CALL] POST /api/subscriptions/create-checkout-session');
    console.log('   ↳ Trigger: User clicked Subscribe button');
    console.log('   ↳ Request Payload:', JSON.stringify(payload, null, 2));
    try {
      const res = await request('/api/subscriptions/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      console.log('✅ [SUBSCRIPTION API RESPONSE] POST /api/subscriptions/create-checkout-session SUCCESS:', res);
      return res;
    } catch (err) {
      if (err?.status === 404 || err?.message?.includes('404') || err?.data?.message?.includes('404')) {
        console.warn('⚠️ [SUBSCRIPTION API RETRY] Fallback to POST /api/subscription/create-checkout-session');
        const resFallback = await request('/api/subscription/create-checkout-session', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        console.log('✅ [SUBSCRIPTION API RESPONSE] POST /api/subscription/create-checkout-session SUCCESS:', resFallback);
        return resFallback;
      }
      console.error('❌ [SUBSCRIPTION API ERROR] POST /api/subscriptions/create-checkout-session ERROR:', err);
      throw err;
    }
  },
  confirmSubscription: async (subscriptionId, planType) => {
    const payload = { subscriptionId, planType };
    console.log('📡 [SUBSCRIPTION API CALL] POST /api/subscriptions/confirm');
    console.log('   ↳ Trigger: Payment completed (WebView auto-success or Manual "I Have Paid" click)');
    console.log('   ↳ Request Payload:', JSON.stringify(payload, null, 2));
    try {
      const res = await request('/api/subscriptions/confirm', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      console.log('✅ [SUBSCRIPTION API RESPONSE] POST /api/subscriptions/confirm SUCCESS:', res);
      return res;
    } catch (err) {
      if (err?.status === 404 || err?.message?.includes('404') || err?.data?.message?.includes('404')) {
        console.warn('⚠️ [SUBSCRIPTION API RETRY] Fallback to POST /api/subscription/confirm');
        const resFallback = await request('/api/subscription/confirm', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        console.log('✅ [SUBSCRIPTION API RESPONSE] POST /api/subscription/confirm SUCCESS:', resFallback);
        return resFallback;
      }
      console.error('❌ [SUBSCRIPTION API ERROR] POST /api/subscriptions/confirm ERROR:', err);
      throw err;
    }
  },
  getMySubscription: async () => {
    console.log('📡 [SUBSCRIPTION API CALL] GET /api/subscriptions/my-subscription');
    console.log('   ↳ Trigger: Opening Subscription Modal / checking active tier');
    console.log('   ↳ Request Payload: None');
    if (__DEV__ && activeResolvedUrl === LIVE_URL) {
      await resolveWorkingBaseUrl(true);
    }
    try {
      const res = await request('/api/subscriptions/my-subscription', { method: 'GET' });
      console.log('✅ [SUBSCRIPTION API RESPONSE] GET /api/subscriptions/my-subscription SUCCESS:', res);
      return res;
    } catch (err) {
      if (err?.status === 404 || err?.message?.includes('404') || err?.data?.message?.includes('404')) {
        console.warn('⚠️ [SUBSCRIPTION API RETRY] Fallback to GET /api/subscription/my-subscription');
        const resFallback = await request('/api/subscription/my-subscription', { method: 'GET' });
        console.log('✅ [SUBSCRIPTION API RESPONSE] GET /api/subscription/my-subscription SUCCESS:', resFallback);
        return resFallback;
      }
      console.error('❌ [SUBSCRIPTION API ERROR] GET /api/subscriptions/my-subscription ERROR:', err);
      throw err;
    }
  },
  cancelSubscription: async () => {
    console.log('📡 [SUBSCRIPTION API CALL] POST /api/subscriptions/cancel');
    console.log('   ↳ Trigger: User confirmed cancellation of active subscription');
    console.log('   ↳ Request Payload: None (Empty body)');
    try {
      const res = await request('/api/subscriptions/cancel', { method: 'POST' });
      console.log('✅ [SUBSCRIPTION API RESPONSE] POST /api/subscriptions/cancel SUCCESS:', res);
      return res;
    } catch (err) {
      if (err?.status === 404 || err?.message?.includes('404') || err?.data?.message?.includes('404')) {
        console.warn('⚠️ [SUBSCRIPTION API RETRY] Fallback to POST /api/subscription/cancel');
        const resFallback = await request('/api/subscription/cancel', { method: 'POST' });
        console.log('✅ [SUBSCRIPTION API RESPONSE] POST /api/subscription/cancel SUCCESS:', resFallback);
        return resFallback;
      }
      console.error('❌ [SUBSCRIPTION API ERROR] POST /api/subscriptions/cancel ERROR:', err);
      throw err;
    }
  },
  checkSessionStatus: async (sessionId) => {
    console.log(`📡 [SUBSCRIPTION API CALL] GET /api/subscriptions/check-session-status?sessionId=${sessionId}`);
    try {
      const res = await request(`/api/subscriptions/check-session-status?sessionId=${sessionId}`, { method: 'GET' });
      console.log('✅ [SUBSCRIPTION API RESPONSE] GET /api/subscriptions/check-session-status SUCCESS:', res);
      return res;
    } catch (err) {
      console.error('❌ [SUBSCRIPTION API ERROR] GET /api/subscriptions/check-session-status ERROR:', err);
      throw err;
    }
  },
  resetResolvedUrl: () => {
    resetResolvedUrl();
  },
  request: async (endpoint, options) => {
    return await request(endpoint, options);
  },
};
