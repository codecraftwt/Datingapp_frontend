import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, CANDIDATE_URLS, LIVE_URL, getBaseUrl, setBaseUrl } from './config';

let isResolving = false;
let activeResolvedUrl = null;

const resolveWorkingBaseUrl = async () => {
  if (activeResolvedUrl) return activeResolvedUrl;
  if (isResolving) return getBaseUrl();
  isResolving = true;

  let fallbackUrl = null;

  for (const candidate of CANDIDATE_URLS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${candidate}/`, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok || res.status < 500) {
        const bodyText = await res.text().catch(() => '');
        let healthData = {};
        try { healthData = JSON.parse(bodyText); } catch (e) {}

        if (healthData.database === 'Connected' || !healthData.database) {
          console.log(`[apiClient] Connected to healthy backend server at: ${candidate}`);
          activeResolvedUrl = candidate;
          setBaseUrl(candidate);
          isResolving = false;
          return candidate;
        } else {
          if (!fallbackUrl) fallbackUrl = candidate;
        }
      }
    } catch (err) {
      // ignore and try next candidate URL
    }
  }

  const finalUrl = fallbackUrl || getBaseUrl();
  activeResolvedUrl = finalUrl;
  setBaseUrl(finalUrl);
  isResolving = false;
  return finalUrl;
};

let authTokenInMemory = null;

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

    let currentBase = activeResolvedUrl || (await resolveWorkingBaseUrl());

    let response;
    try {
      response = await fetch(`${currentBase}${url}`, {
        ...options,
        headers,
      });
    } catch (networkErr) {
      console.warn(`[apiClient] Network request failed on ${currentBase}${url}. Retrying with auto-resolution...`);
      activeResolvedUrl = null;
      currentBase = await resolveWorkingBaseUrl();
      try {
        response = await fetch(`${currentBase}${url}`, {
          ...options,
          headers,
        });
      } catch (retryErr) {
        console.warn(`[apiClient] Retry on ${currentBase} failed. Falling back to LIVE_URL...`);
        response = await fetch(`${LIVE_URL}${url}`, {
          ...options,
          headers,
        });
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
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    const token = res.token || res.data?.token;
    if (token) {
      setAuthToken(token);
      await AsyncStorage.setItem('token', token);
    }
    return res;
  },
  login: async (credentials) => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
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

  // Profile endpoints
  saveQuestionnaire: async (profileData) => {
    return await request('/api/profile/questionnaire', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },
  updateFcmToken: async (fcmToken) => {
    return await request('/api/profile/fcm-token', {
      method: 'PUT',
      body: JSON.stringify({ fcmToken }),
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
    return await request('/api/chat/messages', {
      method: 'GET',
    });
  },
  sendMessage: async (body) => {
    return await request('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  getChatMessages: async (selectedUserId) => {
    return await request(`/api/chat/messages/${selectedUserId}`, {
      method: 'GET',
    });
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
  blockUser: async (body) => {
    return await request('/api/match/block', {
      method: 'POST',
      body: JSON.stringify(body),
    });
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
};
