import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Use localhost:5000 (works for physical real devices with adb reverse & iOS) or local network IP http://10.0.3.87:5000
const BASE_URL = Platform.OS === 'android' ? 'http://localhost:5000' : 'http://localhost:5000';

const request = async (url, options = {}) => {
  try {
    const token = await AsyncStorage.getItem('token');
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

    const response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      headers,
    });

    const data = await response.json();
    if (!response.ok) {
      throw { data };
    }
    return data;
  } catch (error) {
    console.error(`API Error on ${url}:`, error);
    throw error;
  }
};

export const apiClient = {
  // Auth endpoints
  register: async (userData) => {
    return await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },
  login: async (credentials) => {
    return await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  logoutBackend: async () => {
    return await request('/api/auth/logout', {
      method: 'POST',
    });
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
  updateLocation: async (locationData) => {
    return await request('/api/profile/location', {
      method: 'PUT',
      body: JSON.stringify(locationData),
    });
  },
  getProfile: async () => {
    return await request('/api/profile/profile', {
      method: 'GET',
    });
  },
  getQuestionnaires: async () => {
    return await request('/api/profile/questionnaire', {
      method: 'GET',
    });
  },
  getOnlineUsers: async () => {
    return await request('/api/profile/online-users', {
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
  getLikes: async () => {
    return await request('/api/match/likes', {
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
};
