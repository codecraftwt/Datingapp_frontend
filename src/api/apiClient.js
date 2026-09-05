import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, CANDIDATE_URLS, LIVE_URL, LOCAL_URL, EMULATOR_URL, NETWORK_URL, getBaseUrl, setBaseUrl } from './config';

let isResolving = false;
let activeResolvedUrl = null;

export const resetResolvedUrl = () => {
  activeResolvedUrl = null;
};

const resolveWorkingBaseUrl = async () => {
  if (activeResolvedUrl) return activeResolvedUrl;
  if (isResolving) return getBaseUrl();
  isResolving = true;

  const candidateList = [NETWORK_URL, LOCAL_URL, EMULATOR_URL, LIVE_URL];

  for (const candidate of candidateList) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
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

// Eagerly pre-load auth token from AsyncStorage into memory
AsyncStorage.getItem('token').then((token) => {
  if (token && token !== 'null' && token !== 'undefined') {
    authTokenInMemory = token;
  }
}).catch(() => {});

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

    let response;
    try {
      const controller = new AbortController();
      const defaultTimeout = isFormData ? 60000 : 15000;
      const reqTimeout = setTimeout(() => controller.abort(), options.timeout || defaultTimeout);

      const targetUrl = formatFullUrl(currentBase, url);
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
      if (networkErr.name === 'AbortError') {
        console.warn(`[apiClient] Request to ${formatFullUrl(currentBase, url)} timed out. Retrying...`);
      } else {
        console.warn(`[apiClient] Network request failed on ${formatFullUrl(currentBase, url)}. Retrying with auto-resolution...`);
      }
      activeResolvedUrl = null;
      currentBase = await resolveWorkingBaseUrl();
      try {
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 15000);
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

    // Auto-fallback to local backend candidates if remote backend returns 404
    if (!response.ok && response.status === 404 && currentBase === LIVE_URL && !isRetry) {
      console.warn(`[apiClient] Remote LIVE_URL returned 404 for ${url}. Trying local backend candidates...`);
      for (const fallbackUrl of [LOCAL_URL, EMULATOR_URL, NETWORK_URL]) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const testRes = await fetch(`${fallbackUrl}${url}`, { ...options, headers, signal: controller.signal });
          clearTimeout(timeoutId);
          if (testRes.ok || testRes.status < 500) {
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
        throw new Error('File Size Limit Exceeded: The uploaded video file is too large (max 100MB allowed).');
      }
      if (response.status === 404) {
        throw new Error(`Endpoint Not Found (404): ${url}`);
      }
      throw new Error(`Server Error (${response.status}): Request failed for ${url}.`);
    }

    if (!response.ok) {
      if (response.status === 401 || data?.message?.includes('authorization denied') || data?.message?.includes('invalid or expired')) {
        console.warn('[apiClient] Stale or expired token detected (401). Clearing token cache...');
        authTokenInMemory = null;
        AsyncStorage.removeItem('token').catch(() => {});
      }
      throw { data, status: response.status };
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError' || error?.message?.includes('Aborted') || error?.message?.includes('abort')) {
      console.warn(`[apiClient] Request to ${url} was aborted or timed out.`);
      throw error;
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
    try {
      return await request('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      setAuthToken(null);
      await AsyncStorage.removeItem('token');
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
  updatePresence: async () => {
    try {
      return await request('/api/profile/presence', {
        method: 'POST',
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
        console.warn('[apiClient] getMessages request aborted or timed out. Returning empty list.');
        return [];
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
        return { success: true, messages: [], isBlockedByMe: false, isBlockedByOther: false };
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
  deleteMessage: async (messageId) => {
    return await request(`/api/chat/messages/${messageId}`, {
      method: 'DELETE',
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
    return await request('/api/match/block', {
      method: 'POST',
      body: JSON.stringify(body),
    });
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
  uploadMainPhoto: async (formData) => {
    return await request('/api/profile/main-photo', {
      method: 'POST',
      body: formData,
    });
  },
  updateMainPhoto: async (formData) => {
    return await request('/api/profile/main-photo', {
      method: 'PUT',
      body: formData,
    });
  },
  removeMainPhoto: async () => {
    return await request('/api/profile/main-photo', {
      method: 'DELETE',
    });
  },

  // Gallery & Preview Media endpoints (Slots #2 - #9)
  uploadGalleryMedia: async (formData, slotIndex) => {
    const query = slotIndex !== undefined ? `?slotIndex=${slotIndex}` : '';
    return await request(`/api/profile/gallery-media${query}`, {
      method: 'POST',
      body: formData,
    });
  },
  updateGalleryMedia: async (formData, slotIndex) => {
    const query = slotIndex !== undefined ? `?slotIndex=${slotIndex}` : '';
    return await request(`/api/profile/gallery-media${query}`, {
      method: 'PUT',
      body: formData,
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

  resetResolvedUrl: () => {
    resetResolvedUrl();
  },
  request: async (endpoint, options) => {
    return await request(endpoint, options);
  },
};
