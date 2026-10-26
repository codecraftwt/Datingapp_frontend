import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  Image,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Animated,
  PanResponder,
  Keyboard,
  PermissionsAndroid,
  Linking,
  NativeModules,
  SafeAreaView,
  BackHandler,
  AppState,
  ActivityIndicator,
  ToastAndroid,
  Clipboard,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { pick as pickDocument, types as documentTypes, isCancel as isDocumentCancel } from '@react-native-documents/picker';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices
} from 'react-native-webrtc';

import { CustomButton } from '../components/CustomButton';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Profile } from './Profile';
import { SearchScreen } from './SearchScreen';
import { PreviewModal } from '../components/PreviewModal';
import { SubscriptionModal } from '../components/SubscriptionModal';
import Video from 'react-native-video';
import { useDispatch, useSelector } from 'react-redux';
import { apiClient, getIsManualLogoutInProgress, getIsDeactivationAlertShowing, setIsDeactivationAlertShowing, setAuthToken, subscribeBaseUrlChanged, getActiveResolvedUrl } from '../api/apiClient';
import { BASE_URL, getBaseUrl, getImageUrl as formatConfigUrl, getAudioUrl, isVideoUrl, getVideoThumbnailUrl } from '../api/config';
import { selectCurrentUser, logout } from '../redux/slices/authSlice';
import {
  setProfileDetails,
  setOtherProfiles,
  setLikes,
  setMatches,
  setSwipedIds,
} from '../redux/slices/profileSlice';
import {
  setMessages,
  setAllMessages,
  clearChat,
  addMessage,
  updateMessageStatus,
  editMessageInState,
  deleteMessageInState,
  deleteForEveryoneInState,
  deleteForMeInState,
  setActiveChatUser,
  setTyping,
  updateMessageReactions,
  updateMessagePinned,
  updateMessageStarred,
} from '../redux/slices/chatSlice';
import io from 'socket.io-client';
import { createSound } from 'react-native-nitro-sound';
import soundService from '../services/soundService';
import { registerFcmToken } from '../services/notificationService';
import { WarningModal } from '../components/WarningModal';
import { DeactivatedModal } from '../components/DeactivatedModal';
import EmojiPicker from 'rn-emoji-keyboard';

const STICKER_CATEGORIES = [
  { id: 'romance', label: 'Love', icon: 'heart', emoji: '❤️' },
  { id: 'flirt', label: 'Flirt', icon: 'flame', emoji: '🔥' },
  { id: 'moods', label: 'Moods', icon: 'happy', emoji: '😂' },
  { id: 'cute', label: 'Cute', icon: 'paw', emoji: '🧸' },
  { id: 'party', label: 'Party', icon: 'sparkles', emoji: '🎉' },
];

const STICKER_PACKS = {
  romance: [
    { id: 'stk_heart', char: '❤️', label: 'Heart', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2764.png' },
    { id: 'stk_sparkle_heart', char: '💖', label: 'Sparkle Heart', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f496.png' },
    { id: 'stk_arrow_heart', char: '💘', label: 'Love Arrow', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f498.png' },
    { id: 'stk_heart_eyes', char: '😍', label: 'Heart Eyes', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f60d.png' },
    { id: 'stk_blow_kiss', char: '😘', label: 'Blow Kiss', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f618.png' },
    { id: 'stk_rose', char: '🌹', label: 'Red Rose', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f339.png' },
    { id: 'stk_bouquet', char: '💐', label: 'Bouquet', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f490.png' },
    { id: 'stk_love_letter', char: '💌', label: 'Love Letter', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f48c.png' },
    { id: 'stk_warm_smile', char: '🥰', label: 'Adore', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f970.png' },
    { id: 'stk_kiss_mark', char: '💋', label: 'Kiss Mark', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f48b.png' },
    { id: 'stk_ring', char: '💍', label: 'Diamond Ring', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f48d.png' },
    { id: 'stk_couple_love', char: '👩‍❤️‍👨', label: 'In Love', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f491.png' },
  ],
  flirt: [
    { id: 'stk_fire', char: '🔥', label: 'On Fire', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png' },
    { id: 'stk_wink', char: '😉', label: 'Wink', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f609.png' },
    { id: 'stk_smirk', char: '😏', label: 'Smirk', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f60f.png' },
    { id: 'stk_hot_face', char: '🥵', label: 'Hot', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f975.png' },
    { id: 'stk_tongue_wink', char: '😜', label: 'Cheeky', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f61c.png' },
    { id: 'stk_drool', char: '🤤', label: 'Drooling', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f924.png' },
    { id: 'stk_clinking_wine', char: '🥂', label: 'Cheers', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f942.png' },
    { id: 'stk_cocktail', char: '🍸', label: 'Cocktail', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f378.png' },
    { id: 'stk_chocolate', char: '🍫', label: 'Chocolate', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f36b.png' },
    { id: 'stk_strawberry', char: '🍓', label: 'Sweet Strawberry', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f353.png' },
    { id: 'stk_cherry', char: '🍒', label: 'Cherries', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f352.png' },
    { id: 'stk_sparkles', char: '✨', label: 'Sparks', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2728.png' },
  ],
  moods: [
    { id: 'stk_lol', char: '😂', label: 'LOL', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f602.png' },
    { id: 'stk_rofl', char: '🤣', label: 'ROFL', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f923.png' },
    { id: 'stk_cool', char: '😎', label: 'Cool', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f60e.png' },
    { id: 'stk_star_eyes', char: '🤩', label: 'Starstruck', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f929.png' },
    { id: 'stk_mind_blown', char: '🤯', label: 'Mind Blown', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f92f.png' },
    { id: 'stk_shy_blush', char: '🥺', label: 'Pleading', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f97a.png' },
    { id: 'stk_see_no_evil', char: '🙈', label: 'Shy Monkey', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f648.png' },
    { id: 'stk_thumbs_up', char: '👍', label: 'Thumbs Up', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44d.png' },
    { id: 'stk_clap', char: '👏', label: 'Applause', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44f.png' },
    { id: 'stk_hundred', char: '💯', label: '100% Real', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4af.png' },
    { id: 'stk_cry', char: '😢', label: 'Sad Cry', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f622.png' },
    { id: 'stk_screaming', char: '😱', label: 'Shocked', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f631.png' },
  ],
  cute: [
    { id: 'stk_teddy', char: '🧸', label: 'Teddy Bear', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f9f8.png' },
    { id: 'stk_puppy', char: '🐶', label: 'Cute Pup', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f436.png' },
    { id: 'stk_kitty', char: '🐱', label: 'Sweet Kitty', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f431.png' },
    { id: 'stk_panda', char: '🐼', label: 'Panda Hug', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43c.png' },
    { id: 'stk_bunny', char: '🐰', label: 'Bunny Love', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f430.png' },
    { id: 'stk_butterfly', char: '🦋', label: 'Butterfly', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f98b.png' },
    { id: 'stk_blossom', char: '🌸', label: 'Blossom', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f338.png' },
    { id: 'stk_sunflower', char: '🌻', label: 'Sunflower', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f33b.png' },
    { id: 'stk_coffee', char: '☕', label: 'Coffee Date', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2615.png' },
    { id: 'stk_boba', char: '🧋', label: 'Boba Tea', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f9cb.png' },
    { id: 'stk_icecream', char: '🍦', label: 'Ice Cream', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f366.png' },
    { id: 'stk_cupcake', char: '🧁', label: 'Cupcake', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f9c1.png' },
  ],
  party: [
    { id: 'stk_party_popper', char: '🎉', label: 'Party Popper', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f389.png' },
    { id: 'stk_celebrate', char: '🥳', label: 'Celebrate', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f973.png' },
    { id: 'stk_balloons', char: '🎈', label: 'Balloons', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f388.png' },
    { id: 'stk_confetti_ball', char: '🎊', label: 'Confetti', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f38a.png' },
    { id: 'stk_gift', char: '🎁', label: 'Special Gift', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f381.png' },
    { id: 'stk_star', char: '⭐', label: 'Gold Star', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2b50.png' },
    { id: 'stk_rainbow', char: '🌈', label: 'Rainbow', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f308.png' },
    { id: 'stk_music_notes', char: '🎶', label: 'Melody', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3b6.png' },
    { id: 'stk_disco', char: '🪩', label: 'Mirror Ball', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1fa99.png' },
    { id: 'stk_cake', char: '🎂', label: 'Birthday Cake', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f382.png' },
    { id: 'stk_crown', char: '👑', label: 'Royalty Crown', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f451.png' },
    { id: 'stk_trophy', char: '🏆', label: 'Winner Trophy', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3c6.png' },
  ],
};

const MOCK_STICKERS = STICKER_PACKS.romance;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getImageUrl = (url) => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return '';
  }
  return formatConfigUrl(url);
};

const formatPlayerSeconds = (sec) => {
  if (!sec || isNaN(sec) || sec < 0) return '0:00';
  const totalSecs = Math.floor(sec);
  const mins = Math.floor(totalSecs / 60);
  const remainingSecs = totalSecs % 60;
  return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
};

const parseReplyTo = (replyObj) => {
  if (!replyObj) return null;
  let parsed = replyObj;
  if (typeof replyObj === 'string') {
    try {
      parsed = JSON.parse(replyObj);
    } catch (_) {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const text = (parsed.text || parsed.content || parsed.body || '').trim();
  const mediaUrl = parsed.mediaUrl || parsed.url || parsed.audioUrl || parsed.fileUrl || null;
  const msgId = parsed.messageId || parsed.id || parsed._id || null;
  const sName = parsed.senderName || parsed.name || null;
  const sId = parsed.senderId || parsed.sender || null;
  const mType = parsed.messageType || parsed.type || (mediaUrl ? 'image' : 'text');
  const fileName = parsed.fileName || null;
  const stickerId = parsed.stickerId || null;

  if (!text && !mediaUrl && !fileName && !stickerId) {
    return null;
  }

  return {
    ...parsed,
    messageId: msgId ? msgId.toString() : null,
    senderId: sId ? sId.toString() : null,
    text: text || (fileName ? fileName : (stickerId ? 'Sticker' : 'Media')),
    senderName: sName || 'Contact',
    messageType: mType,
    mediaUrl: mediaUrl,
    fileName: fileName,
  };
};

const isValidReplyTo = (replyObj) => !!parseReplyTo(replyObj);

const getQuotedSnippetText = (replyObj) => {
  if (!replyObj) return 'Media';
  const type = replyObj.messageType || (replyObj.mediaUrl ? 'image' : 'text');

  if (type === 'image') {
    if (replyObj.text && typeof replyObj.text === 'string' && replyObj.text.trim().length > 0 && !replyObj.text.startsWith('http') && !replyObj.text.startsWith('data:image')) {
      return replyObj.text.trim();
    }
    return 'Photo';
  }
  if (type === 'video') return 'Video';
  if (type === 'voice' || type === 'audio') return 'Voice message';
  if (type === 'document') return replyObj.fileName || 'Document';
  if (type === 'sticker') return 'Sticker';
  if (type === 'call' || type === 'voice_call') return 'Voice call';
  if (type === 'location') return 'Location';

  if (replyObj.text && typeof replyObj.text === 'string' && replyObj.text.trim().length > 0) {
    return replyObj.text;
  }
  return 'Media';
};

const getQuotedSenderName = (replyObj, isMeMsg, activeChatName = '', currentUserIdStr = '') => {
  if (!replyObj) return 'Message';
  const sIdStr = replyObj.senderId?.toString();
  const cIdStr = currentUserIdStr?.toString();
  if (sIdStr && cIdStr && sIdStr === cIdStr) {
    return 'You';
  }
  if (replyObj.senderName === 'You' || replyObj.senderName === 'you') {
    return isMeMsg ? 'You' : (activeChatName || 'Contact');
  }
  return replyObj.senderName || (isMeMsg ? activeChatName : 'Contact');
};

const getCandidateAge = (user) => {
  if (!user) return '';
  if (user.bdayYear && user.bdayYear.toString().trim().length === 4) {
    const year = parseInt(user.bdayYear, 10);
    const month = parseInt(user.bdayMonth, 10) || 1;
    const day = parseInt(user.bdayDay, 10) || 1;

    const today = new Date();
    let calculatedAge = today.getFullYear() - year;
    const monthDiff = (today.getMonth() + 1) - month;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
      calculatedAge--;
    }
    if (calculatedAge >= 18 && calculatedAge <= 120) {
      return calculatedAge;
    }
  }
  return user.age || '';
};

const REPORT_REASONS = [
  'Inappropriate Photos or Content',
  'Harassment, Bullying, or Hate Speech',
  'Fake Profile, Scam, or Spam',
  'Inappropriate Messaging',
  'Other / Something Else',
];

const formatFileSize = (bytes) => {
  if (!bytes) return 'File';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getDocExtensionBadge = (filename) => {
  if (!filename) return ' PDF';
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'pdf') return ' PDF';
  if (ext === 'doc' || ext === 'docx') return '📝 DOC';
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return ' XLS';
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') return ' IMG';
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return ' ZIP';
  if (ext === 'txt') return ' TXT';
  return ' FILE';
};

const getDocTypeStyle = (filename) => {
  if (!filename) return { backgroundColor: '#E63946' };
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'pdf') return { backgroundColor: '#E63946' };
  if (ext === 'doc' || ext === 'docx') return { backgroundColor: '#2A9D8F' };
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return { backgroundColor: '#38EF7D' };
  if (ext === 'zip' || ext === 'rar') return { backgroundColor: '#F4A261' };
  return { backgroundColor: '#FE3C72' };
};

const deduplicateMessages = (msgList) => {
  if (!Array.isArray(msgList) || msgList.length === 0) return [];
  const seenIds = new Set();
  const seenTemps = new Set();
  const seenPendingKeys = new Map();
  const result = [];

  for (const m of msgList) {
    if (!m) continue;
    if (m.id === 'match-init' || m.id === 'blocked-init') {
      result.push(m);
      continue;
    }
    const mId = m.id ? String(m.id) : (m._id ? String(m._id) : null);
    const mTemp = m.tempId ? String(m.tempId) : (mId && mId.startsWith('temp-') ? mId : null);

    // If ID already seen, skip duplicate
    if (mId && seenIds.has(mId)) continue;
    // If tempId already seen, skip duplicate
    if (mTemp && (seenTemps.has(mTemp) || seenIds.has(mTemp))) continue;
    // If real ID matches a seen tempId, skip
    if (mId && seenTemps.has(mId)) continue;

    if (mId) seenIds.add(mId);
    if (mTemp) seenTemps.add(mTemp);
    result.push(m);
  }
  return result;
};

const extractIdStr = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'object') {
    const id = val._id || val.id || val.userId;
    if (id) return id.toString();
  }
  return null;
};

const doesMessageBelongToPartner = (m, partnerId) => {
  if (!m || !partnerId) return false;
  if (m.id === 'match-init' || m.id === 'blocked-init') return false;
  const pIdStr = extractIdStr(partnerId);
  if (!pIdStr || pIdStr === 'undefined' || pIdStr === 'null' || pIdStr === '[object Object]') return false;
  const mReceiver = extractIdStr(m.receiverId) || extractIdStr(m.receiver);
  const mSender = extractIdStr(m.senderId) || extractIdStr(m.sender);
  return (mReceiver && mReceiver === pIdStr) || (mSender && mSender === pIdStr);
};

const formatMessageTime = (dateString) => {
  if (!dateString || dateString === 'match-init') return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
};

const formatLastSeen = (lastSeenTime) => {
  if (!lastSeenTime) return 'Offline';
  try {
    const date = new Date(lastSeenTime);
    if (isNaN(date.getTime())) return 'Offline';

    const now = new Date();

    const timeStr = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isToday) {
      return `last seen today at ${timeStr}`;
    }

    if (isYesterday) {
      return `last seen yesterday at ${timeStr}`;
    }

    const isSameYear = date.getFullYear() === now.getFullYear();
    if (isSameYear) {
      const dateStr = date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      });
      return `last seen ${dateStr} at ${timeStr}`;
    }

    const fullDateStr = date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `last seen ${fullDateStr} at ${timeStr}`;
  } catch (e) {
    return 'Offline';
  }
};

const getLatestMessageTime = (chat) => {
  if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
    if (chat?.updatedAt) {
      const t = new Date(chat.updatedAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (chat?.createdAt) {
      const t = new Date(chat.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  }

  // Filter out placeholder init messages if real messages exist
  const realMsgs = chat.messages.filter(
    (m) => m && m.id !== 'match-init' && m.id !== 'blocked-init'
  );
  const targetMsgs = realMsgs.length > 0 ? realMsgs : chat.messages;

  let maxTime = 0;
  targetMsgs.forEach((m) => {
    if (!m) return;
    let t = 0;
    if (m.createdAt && m.createdAt !== 'match-init') {
      t = new Date(m.createdAt).getTime();
    } else if (m.time && typeof m.time === 'number') {
      t = m.time;
    }
    if (!isNaN(t) && t > maxTime) {
      maxTime = t;
    }
  });

  if (maxTime === 0 && chat.updatedAt) {
    const t = new Date(chat.updatedAt).getTime();
    if (!isNaN(t)) maxTime = t;
  }
  if (maxTime === 0 && chat.createdAt) {
    const t = new Date(chat.createdAt).getTime();
    if (!isNaN(t)) maxTime = t;
  }
  return maxTime;
};

const sortChatsByRecent = (chatsArr) => {
  if (!Array.isArray(chatsArr)) return chatsArr;
  return [...chatsArr].sort((a, b) => getLatestMessageTime(b) - getLatestMessageTime(a));
};

export const HomeScreen = ({ userProfile, onUpdateProfile, onLogout, onRemoveProfile, onNavigate, onGoBack }) => {
  const insets = useSafeAreaInsets();
  const safeBottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8);
  const safeTopPadding = Math.max(insets.top, Platform.OS === 'ios' ? 40 : 25);

  const dispatch = useDispatch();
  const reduxUser = useSelector(selectCurrentUser);
  const reduxProfileDetails = useSelector((state) => state.profile.profileDetails);

  const currentUserId = (
    reduxUser?.id ||
    reduxUser?._id ||
    reduxProfileDetails?.id ||
    reduxProfileDetails?._id ||
    userProfile?.id ||
    userProfile?._id
  )?.toString();

  const activeUserProfile = useMemo(() => {
    return reduxProfileDetails || userProfile || reduxUser;
  }, [reduxProfileDetails, userProfile, reduxUser]);

  const currentUser = useMemo(() => {
    return { ...(reduxUser || {}), ...(reduxProfileDetails || {}), ...(userProfile || {}) };
  }, [reduxUser, reduxProfileDetails, userProfile]);

  // Stably capture latest onLogout and onNavigate props via refs
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  // Redux Selectors
  const otherProfiles = useSelector((state) => state.profile.otherProfiles);
  const likes = useSelector((state) => state.profile.likes);
  const matches = useSelector((state) => state.profile.matches);
  const swipedIds = useSelector((state) => state.profile.swipedIds);
  const messages = useSelector((state) => state.chat.messages);
  const allMessages = useSelector((state) => state.chat.allMessages);

  // Custom Loading states for queries
  const [isQuestionnairesLoading, setIsQuestionnairesLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isLikesLoading, setIsLikesLoading] = useState(false);
  const [isMatchesLoading, setIsMatchesLoading] = useState(false);
  const [isSwipedIdsLoading, setIsSwipedIdsLoading] = useState(false);

  // Async API Fetch Functions
  const fetchQuestionnaires = async () => {
    try {
      setIsQuestionnairesLoading(true);
      const res = await apiClient.getQuestionnaires();
      dispatch(setOtherProfiles(res.users || []));
    } catch (err) {
      console.log('Error fetching questionnaires:', err);
    } finally {
      setIsQuestionnairesLoading(false);
    }
  };

  // Load cached messages and persistent unsent/failed messages from AsyncStorage on startup so history & pending messages appear instantly
  useEffect(() => {
    const userId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
    if (!userId) return;
    recentStarActionRef.current = {};
    recentPinActionRef.current = {};
    AsyncStorage.getItem(`cached_chat_messages_${userId}`)
      .then((cachedStr) => {
        if (cachedStr) {
          try {
            const cachedMsgs = JSON.parse(cachedStr);
            if (Array.isArray(cachedMsgs) && cachedMsgs.length > 0) {
              if (!allMessages || allMessages.length === 0) {
                dispatch(setAllMessages(cachedMsgs));
              }
            }
          } catch (_) { }
        }
      })
      .catch(() => { });

    AsyncStorage.getItem(`persistent_unsent_messages_${userId}`)
      .then((str) => {
        if (str) {
          try {
            const unsentItems = JSON.parse(str);
            if (Array.isArray(unsentItems) && unsentItems.length > 0) {
              setChats((prevChats) => {
                let updated = [...(prevChats || [])];
                unsentItems.forEach(({ partnerId, msg }) => {
                  const idx = updated.findIndex((c) => (c.id || c._id || c.userId)?.toString() === partnerId.toString());
                  if (idx > -1) {
                    const msgs = updated[idx].messages || [];
                    if (!msgs.some((m) => m.id === msg.id || (msg.tempId && m.tempId === msg.tempId))) {
                      updated[idx] = {
                        ...updated[idx],
                        messages: [...msgs, msg].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)),
                      };
                    }
                  }
                });
                return updated;
              });
            }
          } catch (_) { }
        }
      })
      .catch(() => { });
  }, [currentUserId]);

  // Persist any pending/sending/failed messages to AsyncStorage so they survive app restarts & navigation
  useEffect(() => {
    const userId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
    if (!userId || !Array.isArray(chats)) return;
    try {
      const unsentItems = [];
      chats.forEach((c) => {
        const cPartnerId = (c.id || c._id || c.userId)?.toString();
        if (!cPartnerId) return;
        (c.messages || []).forEach((m) => {
          if (m && (m.status === 'pending' || m.status === 'sending' || m.status === 'failed' || m.status === 'queued')) {
            unsentItems.push({ partnerId: cPartnerId, msg: m });
          }
        });
      });
      AsyncStorage.setItem(`persistent_unsent_messages_${userId}`, JSON.stringify(unsentItems)).catch(() => { });
    } catch (_) { }
  }, [chats, currentUserId]);

  const fetchMessages = async () => {
    try {
      setIsMessagesLoading(true);
      const res = await apiClient.getMessages();
      // Backend now returns { messages, conversationPartners } — extract each part
      const rawMessages = Array.isArray(res) ? res : (res?.messages || res || []);
      const partners = (!Array.isArray(res) && res?.conversationPartners) ? res.conversationPartners : {};
      if (Array.isArray(rawMessages)) {
        dispatch(setAllMessages(rawMessages));
        const userId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
        if (userId && rawMessages.length > 0) {
          AsyncStorage.setItem(`cached_chat_messages_${userId}`, JSON.stringify(rawMessages)).catch(() => { });
        }
      }
      if (partners && Object.keys(partners).length > 0) {
        setConversationPartners((prev) => ({ ...prev, ...partners }));
      }
    } catch (err) {
      console.log('Error fetching messages (retaining cached messages):', err);
    } finally {
      setIsMessagesLoading(false);
    }
  };

  const [blockedUsersList, setBlockedUsersList] = useState([]);
  const [blockedByOtherList, setBlockedByOtherList] = useState([]);
  // Real names/images of all chat partners — fetched directly from User collection, unaffected by block status
  const [conversationPartners, setConversationPartners] = useState({});


  const fetchBlockedUsers = async () => {
    try {
      const res = await apiClient.getBlockedUsers();
      const list = (res && res.blockedUsers) || (res && res.data) || (Array.isArray(res) ? res : []);
      const blockedByOther = (res && res.blockedByOtherUserIds) || [];
      setBlockedUsersList(list);
      setBlockedByOtherList(blockedByOther);
    } catch (err) {
      console.log('Error fetching blocked users:', err);
    }
  };

  const [unreadLikesCount, setUnreadLikesCount] = useState(0);
  const [selectedLikesProfile, setSelectedLikesProfile] = useState(null);
  const [likesActivePhotoIndex, setLikesActivePhotoIndex] = useState(0);
  const [likesPreviewStoryIndex, setLikesPreviewStoryIndex] = useState(null);
  const [reactionDetailsModalMsg, setReactionDetailsModalMsg] = useState(null);
  const [reactionModalActiveTab, setReactionModalActiveTab] = useState('all');
  const [viewMediaModal, setViewMediaModal] = useState({ visible: false, type: 'image', url: '', fileName: '', fileSize: 0 });
  const [imageZoomScale, setImageZoomScale] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [isAudioModalPaused, setIsAudioModalPaused] = useState(false);
  const [audioModalPosition, setAudioModalPosition] = useState(0);
  const [audioModalDuration, setAudioModalDuration] = useState(0);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState(1.0);
  const [isAudioModalMuted, setIsAudioModalMuted] = useState(false);
  const modalAudioPlayerRef = useRef(null);
  const audioScrubberWidthRef = useRef(280);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const chatScrollViewRef = useRef(null);
  const messageYPositionsRef = useRef({});
  const isSendingMessageRef = useRef(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const height = e.endCoordinates ? e.endCoordinates.height : 250;
        setKeyboardHeight(height);
        setTimeout(() => {
          if (chatScrollViewRef.current) {
            chatScrollViewRef.current.scrollToEnd({ animated: true });
          }
        }, 50);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!isSearchInChatActive || !chatSearchQuery.trim() || !activeChat?.messages) return;
    const qTrim = chatSearchQuery.trim().toLowerCase();
    const matches = activeChat.messages.filter((m) => !m.isDeletedForEveryone && m.text && m.text.toLowerCase().includes(qTrim));
    if (matches.length > 0 && matches[chatSearchMatchIndex]) {
      const targetMsg = matches[chatSearchMatchIndex];
      const targetKey = (targetMsg.id || targetMsg._id || targetMsg.createdAt)?.toString();
      const targetY = messageYPositionsRef.current[targetKey];
      if (targetY !== undefined && chatScrollViewRef.current) {
        chatScrollViewRef.current.scrollTo({ y: Math.max(0, targetY - 70), animated: true });
      }
    }
  }, [isSearchInChatActive, chatSearchQuery, chatSearchMatchIndex, activeChat]);

  const fetchUnreadLikesCount = async () => {
    try {
      const netState = await NetInfo.fetch();
      if (netState && netState.isConnected === false) return;
      const res = await apiClient.getUnreadNotifications();
      if (res && Array.isArray(res.notifications)) {
        const likeNotifs = res.notifications.filter((n) => (n.type === 'like' || n.type === 'superlike') && !n.isRead);
        setUnreadLikesCount(likeNotifs.length);
      }
    } catch (err) {
      if (err?.isOffline || err?.message?.includes('offline') || err?.message?.includes('Network request failed')) {
        return;
      }
      console.log('Error fetching unread likes count:', err);
    }
  };

  const fetchLikes = async () => {
    try {
      setIsLikesLoading(true);
      const res = await apiClient.getLikes();
      dispatch(setLikes(res.users || []));
    } catch (err) {
      console.log('Error fetching likes:', err);
    } finally {
      setIsLikesLoading(false);
    }
  };

  const fetchMatchesList = async () => {
    try {
      setIsMatchesLoading(true);
      const res = await apiClient.getMatches();
      dispatch(setMatches(res.matches || []));
    } catch (err) {
      console.log('Error fetching matches list:', err);
    } finally {
      setIsMatchesLoading(false);
    }
  };

  const fetchSwipedIds = async () => {
    try {
      setIsSwipedIdsLoading(true);
      const res = await apiClient.getSwipedIds();
      dispatch(setSwipedIds(res || []));
    } catch (err) {
      console.log('Error fetching swiped IDs:', err);
    } finally {
      setIsSwipedIdsLoading(false);
    }
  };

  // Sync active subscription status and dynamic permissions helper
  const lastSyncedSubTierRef = useRef(null);
  const syncSubscriptionStatus = useCallback(async () => {
    try {
      const res = await apiClient.getMySubscription();
      if (res && res.success) {
        if (res.permissions) {
          setSubscriptionPermissions(res.permissions);
        }
        if (typeof onUpdateProfile === 'function' && lastSyncedSubTierRef.current !== res.subscriptionTier) {
          lastSyncedSubTierRef.current = res.subscriptionTier;
          onUpdateProfile({
            subscriptionTier: res.subscriptionTier,
            subscriptionStatus: res.subscriptionStatus || 'active',
            subscriptionPermissions: res.permissions,
          });
        }
        return res;
      }
    } catch (err) {
      console.log('[HomeScreen] syncSubscriptionStatus error:', err);
    }
    return null;
  }, [onUpdateProfile]);

  // Run fetches once on mount and sync subscription
  const activeLoggedInUserId = currentUserId;
  const initialFetchDoneRef = useRef(false);

  useEffect(() => {
    fetchQuestionnaires();
    fetchMessages();
    fetchLikes();
    fetchUnreadLikesCount();
    fetchMatchesList();
    fetchSwipedIds();
    fetchBlockedUsers();
    initialFetchDoneRef.current = true;

    // Sync active subscription status and dynamic permissions once on mount
    syncSubscriptionStatus().catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch only if the actual logged-in user ID changes (e.g. account switch)
  const prevUserIdRef = useRef(activeLoggedInUserId);
  useEffect(() => {
    if (activeLoggedInUserId && initialFetchDoneRef.current && activeLoggedInUserId !== prevUserIdRef.current) {
      prevUserIdRef.current = activeLoggedInUserId;
      fetchQuestionnaires();
      fetchSwipedIds();
      fetchMessages();
      fetchUnreadLikesCount();
      fetchMatchesList();
      fetchLikes();
      fetchBlockedUsers();
    }
  }, [activeLoggedInUserId]);

  useEffect(() => {
    // Poll unread likes count periodically without blocking JS bridge with messages
    const badgeSyncInterval = setInterval(async () => {
      try {
        const netState = await NetInfo.fetch();
        if (netState && netState.isConnected === false) return;
        fetchUnreadLikesCount();
      } catch (e) { }
    }, 25000);
    // Poll blocked/unblocked status every 45 seconds as a fallback for missed socket events
    const blockedSyncInterval = setInterval(async () => {
      try {
        const netState = await NetInfo.fetch();
        if (netState && netState.isConnected === false) return;
        fetchBlockedUsers();
      } catch (e) { }
    }, 45000);
    return () => {
      clearInterval(badgeSyncInterval);
      clearInterval(blockedSyncInterval);
    };
  }, []);

  const refetch = fetchQuestionnaires;
  const refetchMessages = fetchMessages;
  const refetchLikes = fetchLikes;
  const refetchMatchesList = fetchMatchesList;
  const refetchSwipedIds = fetchSwipedIds;

  const [isRefreshingHome, setIsRefreshingHome] = useState(false);

  const handleRefreshAllHomeData = async () => {
    if (isRefreshingHome) return;
    try {
      setIsRefreshingHome(true);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Refreshing page...', ToastAndroid.SHORT);
      }
      await Promise.all([
        checkAccountStatus(),
        fetchQuestionnaires(),
        fetchSwipedIds(),
        fetchMessages(),
        fetchLikes(),
        fetchUnreadLikesCount(),
        fetchMatchesList(),
        fetchBlockedUsers(),
        checkActiveWarning(),
      ]);
      setTopToast({ visible: true, message: 'All page data refreshed successfully! ✨', type: 'success' });
      if (Platform.OS === 'android') {
        ToastAndroid.show('Refreshed successfully! ✨', ToastAndroid.SHORT);
      }
    } catch (err) {
      console.log('Error refreshing Home page data:', err);
    } finally {
      setIsRefreshingHome(false);
    }
  };

  const questionnairesData = useMemo(() => ({ users: otherProfiles }), [otherProfiles]);
  const messagesData = allMessages;
  const likesData = useMemo(() => ({ users: likes }), [likes]);
  const matchesData = useMemo(() => ({ matches: matches }), [matches]);
  const swipedIdsData = swipedIds;

  const qUsersList = (questionnairesData && questionnairesData.users) ? questionnairesData.users : [];
  console.log('--- HomeScreen Swipe Stack Debug ---');
  console.log('Logged-in user (currentUser):', JSON.stringify(currentUser));
  console.log('All Users from API:', JSON.stringify(qUsersList.map(u => ({ id: u.id, name: u.name }))));

  const swipedIdsList = swipedIdsData || [];

  const curUserId = currentUser ? (currentUser.id || currentUser._id) : null;
  const curUserEmail = currentUser ? currentUser.email : null;

  const MOCK_MATCHES = qUsersList.filter(
    (u) =>
      u.id !== curUserId &&
      u._id !== curUserId &&
      u.email !== curUserEmail &&
      !swipedIdsList.includes(u.id) &&
      !swipedIdsList.includes(u._id)
  );

  console.log('Filtered Swipe Cards (MOCK_MATCHES):', JSON.stringify(MOCK_MATCHES.map(u => ({ id: u.id, name: u.name }))));

  const [activeTab, setActiveTab] = useState('swipe'); // swipe, likes, chat, profile
  const [unreadChatPushCount, setUnreadChatPushCount] = useState(0);

  // Android / Emulator Hardware Back Button Handler for HomeScreen Tabs, Modals, and Active Chat
  useEffect(() => {
    const onHardwareBackPress = () => {
      // 0. Close WhatsApp media preview modal if open
      if (pendingMediaSend) {
        setPendingMediaSend(null);
        setMediaCaptionText('');
        setIsMediaUploading(false);
        return true;
      }

      // 0.2. Close likes story preview modal if open
      if (likesPreviewStoryIndex !== null) {
        setLikesPreviewStoryIndex(null);
        return true;
      }

      // 0.3. Close reaction details modal if open
      if (reactionDetailsModalMsg) {
        setReactionDetailsModalMsg(null);
        return true;
      }

      // 1. Close active media preview modal if open
      if (viewMediaModal && viewMediaModal.visible) {
        setIsAudioModalPaused(true);
        setImageZoomScale(1);
        setImageRotation(0);
        setViewMediaModal({ visible: false, type: 'image', url: '', fileName: '', fileSize: 0 });
        return true;
      }

      // 1.4. Cancel conversation multi-select mode if active
      if (selectedChatIds.length > 0) {
        setSelectedChatIds([]);
        return true;
      }

      // 1.5. Cancel multi-select mode if active
      if (isMultiSelectMode) {
        setIsMultiSelectMode(false);
        setSelectedMultiMessageIds([]);
        return true;
      }

      // 2. Close active chat conversation view if open (persisting messages into chats state)
      if (activeChat) {
        const activeId = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
        if (activeId && Array.isArray(activeChat.messages) && activeChat.messages.length > 0) {
          const cleanActiveMsgs = activeChat.messages.filter((m) => m.id === 'match-init' || doesMessageBelongToPartner(m, activeId));
          setChats((prevChats) =>
            (prevChats || []).map((c) => {
              const cId = (c.id || c._id || c.userId)?.toString();
              if (cId === activeId) {
                return {
                  ...c,
                  messages: cleanActiveMsgs,
                };
              }
              return c;
            })
          );
        }
        typedMessageRef.current = '';
        setTypedMessage('');
        setIsSearchInChatActive(false);
        setChatSearchQuery('');
        setChatSearchMatchIndex(0);
        dispatch(setMessages([]));
        dispatch(setActiveChatUser(null));
        setActiveChat(null);
        return true;
      }

      // 3. Switch active tab back to 'swipe' if currently on 'search', 'likes', 'chat', or 'profile'
      if (activeTab !== 'swipe') {
        setActiveTab('swipe');
        return true;
      }

      // 4. If on main swipe tab, trigger parent back navigation if available
      if (onGoBack && typeof onGoBack === 'function') {
        const handled = onGoBack();
        if (handled) return true;
      }

      return false;
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => backSubscription.remove();
  }, [activeTab, activeChat, viewMediaModal, pendingMediaSend, onGoBack, selectedChatIds]);

  useEffect(() => {
    if (activeTab === 'likes') {
      (async () => {
        const freshSub = await syncSubscriptionStatus();
        if (freshSub?.permissions) {
          setSubscriptionPermissions(freshSub.permissions);
        }
        await fetchLikes();
      })().catch(() => {
        fetchLikes();
      });
      setUnreadLikesCount(0);
      if (typeof apiClient.markLikesAsRead === 'function') {
        apiClient.markLikesAsRead().catch(() => { });
      }
    } else if (activeTab === 'chat') {
      fetchMatchesList();
      fetchMessages();
      setUnreadChatPushCount(0);
      if (typeof apiClient.markMatchesAsRead === 'function') {
        apiClient.markMatchesAsRead().catch(() => { });
      }
    }
  }, [activeTab]);
  // Swipe Stack States
  const [swipeIndex, setSwipeIndex] = useState(0);

  // Gesture & Animation Refs for Profile Swiping
  const position = useRef(new Animated.ValueXY()).current;
  const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4;

  // Refs to track current state handlers to bypass PanResponder stale closures
  const handleSwipeLeftRef = useRef(null);
  const handleSwipeRightRef = useRef(null);

  useLayoutEffect(() => {
    position.setValue({ x: 0, y: 0 });
  }, [swipeIndex, position]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (event, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (event, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          forceSwipe('right');
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          forceSwipe('left');
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const forceSwipe = (direction) => {
    const x = direction === 'right' ? SCREEN_WIDTH + 150 : -SCREEN_WIDTH - 150;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  };

  const onSwipeComplete = (direction) => {
    if (direction === 'right') {
      if (handleSwipeRightRef.current) {
        handleSwipeRightRef.current();
      } else {
        handleSwipeRight();
      }
    } else {
      if (handleSwipeLeftRef.current) {
        handleSwipeLeftRef.current();
      } else {
        handleSwipeLeft();
      }
    }
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 4,
      useNativeDriver: false,
    }).start();
  };

  const getCardStyle = () => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
      outputRange: ['-30deg', '0deg', '30deg'],
    });

    return {
      transform: [
        { translateX: position.x },
        { translateY: position.y },
        { rotate },
      ],
    };
  };

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD / 2],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD / 2, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const triggerSwipeRight = () => {
    forceSwipe('right');
  };

  const triggerSwipeLeft = () => {
    forceSwipe('left');
  };

  // Likes Grid States
  const [showMatchPopup, setShowMatchPopup] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  // IDs of profiles the current user has swiped right on (liked)
  const [likedByMe, setLikedByMe] = useState([]);

  // Chat Tab States
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // chat object when conversation is open
  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // WhatsApp-like instant scroll to recent chats without unnecessary scrolling animation
  const isInitialChatScrollDoneRef = useRef(false);
  const prevActiveChatIdRef = useRef(null);
  const prevMessagesCountRef = useRef(0);
  const isUserNearBottomRef = useRef(true);
  const [isChatReadyForDisplay, setIsChatReadyForDisplay] = useState(false);

  const activeChatId = (activeChat?.id || activeChat?._id || activeChat?.userId)?.toString() || null;

  useEffect(() => {
    if (activeChatId) {
      if (prevActiveChatIdRef.current !== activeChatId) {
        prevActiveChatIdRef.current = activeChatId;
        isInitialChatScrollDoneRef.current = false;
        setIsChatReadyForDisplay(false);
        prevMessagesCountRef.current = activeChat?.messages?.length || 0;
        isUserNearBottomRef.current = true;
      }
    } else {
      prevActiveChatIdRef.current = null;
      isInitialChatScrollDoneRef.current = false;
      setIsChatReadyForDisplay(false);
      prevMessagesCountRef.current = 0;
      isUserNearBottomRef.current = true;
    }
  }, [activeChatId]);

  useEffect(() => {
    if (activeChatId && !isChatReadyForDisplay) {
      const timer = setTimeout(() => {
        if (chatScrollViewRef.current && !isInitialChatScrollDoneRef.current) {
          chatScrollViewRef.current.scrollToEnd({ animated: false });
          isInitialChatScrollDoneRef.current = true;
        }
        setIsChatReadyForDisplay(true);
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [activeChatId, isChatReadyForDisplay]);

  const handleChatContentSizeChange = () => {
    if (!chatScrollViewRef.current) return;

    if (!isInitialChatScrollDoneRef.current) {
      // First layout: jump directly to latest messages without visible scrolling animation (WhatsApp style)
      chatScrollViewRef.current.scrollToEnd({ animated: false });
      isInitialChatScrollDoneRef.current = true;
      setIsChatReadyForDisplay(true);
      return;
    }

    const currentCount = activeChat?.messages?.length || 0;
    if (currentCount > prevMessagesCountRef.current) {
      prevMessagesCountRef.current = currentCount;
      if (isSendingMessageRef.current || isUserNearBottomRef.current) {
        chatScrollViewRef.current.scrollToEnd({ animated: true });
      }
    } else {
      prevMessagesCountRef.current = currentCount;
      if (isUserNearBottomRef.current) {
        chatScrollViewRef.current.scrollToEnd({ animated: false });
      }
    }
  };

  const handleChatLayout = () => {
    if (!chatScrollViewRef.current) return;
    if (!isInitialChatScrollDoneRef.current) {
      chatScrollViewRef.current.scrollToEnd({ animated: false });
    }
  };

  const handleChatScroll = (event) => {
    if (!event || !event.nativeEvent) return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement && contentOffset && contentSize) {
      const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
      isUserNearBottomRef.current = distanceFromBottom < 100;
    }
  };
  const [typedMessage, setTypedMessage] = useState('');
  const typedMessageRef = useRef('');
  const [isSearchInChatActive, setIsSearchInChatActive] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchMatchIndex, setChatSearchMatchIndex] = useState(0);

  // Conversations List View Search & Options Menu States
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');
  const [isConversationSearchActive, setIsConversationSearchActive] = useState(false);
  const [showConversationsMenuModal, setShowConversationsMenuModal] = useState(false);
  const [showAllStarredModal, setShowAllStarredModal] = useState(false);

  const [isTyping, setIsTyping] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeStickerCategory, setActiveStickerCategory] = useState('romance');
  const [recentStickers, setRecentStickers] = useState([]);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [pendingMediaSend, setPendingMediaSend] = useState(null); // { uri, fileName, fileSize, type, mediaType, asset }
  const [mediaCaptionText, setMediaCaptionText] = useState('');
  const [isMediaUploading, setIsMediaUploading] = useState(false);
  const [onlineUsersMap, setOnlineUsersMap] = useState({});
  const [lastSeenMap, setLastSeenMap] = useState({});
  const [offlineQueue, setOfflineQueue] = useState([]);
  const offlineQueueRef = useRef([]);
  useEffect(() => {
    offlineQueueRef.current = offlineQueue;
  }, [offlineQueue]);

  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [reactingToMessageForEmoji, setReactingToMessageForEmoji] = useState(null);
  const chatInputRef = useRef(null);
  const recentPinActionRef = useRef({}); // { [messageIdOrTempId]: { isPinned: boolean, timestamp: number } }
  const recentStarActionRef = useRef({}); // { [messageIdOrTempId]: { isStarred: boolean, timestamp: number } }

  const resolveIsPinned = (msgId, tempId, incomingVal, existingVal) => {
    const mIdStr = msgId?.toString();
    const mTempStr = tempId?.toString();
    const recentAction =
      (mIdStr && recentPinActionRef.current[mIdStr]) ||
      (mTempStr && recentPinActionRef.current[mTempStr]);

    // Local user's recent pin/unpin action within 8 seconds is authoritative against background polling lag
    if (recentAction && Date.now() - recentAction.timestamp < 8000) {
      return recentAction.isPinned;
    }

    if (incomingVal !== undefined && incomingVal !== null) {
      return Boolean(incomingVal);
    }
    return Boolean(existingVal);
  };

  const isMessageStarredByMe = (m) => {
    if (!m) return false;
    const myId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
    if (Array.isArray(m.starredBy) && myId) {
      return m.starredBy.some((id) => (id?._id || id)?.toString() === myId);
    }
    return Boolean(m.isStarred);
  };

  const resolveIsStarred = (msgId, tempId, incomingVal, existingVal, starredBy = null) => {
    const mIdStr = msgId?.toString();
    const mTempStr = tempId?.toString();
    const recentAction =
      (mIdStr && recentStarActionRef.current[mIdStr]) ||
      (mTempStr && recentStarActionRef.current[mTempStr]);

    // Local user's recent star/unstar action within 8 seconds is authoritative against background polling lag
    if (recentAction && Date.now() - recentAction.timestamp < 8000) {
      return recentAction.isStarred;
    }

    const myId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
    if (Array.isArray(starredBy) && myId) {
      return starredBy.some((id) => (id?._id || id)?.toString() === myId);
    }

    if (incomingVal !== undefined && incomingVal !== null) {
      return Boolean(incomingVal);
    }
    return Boolean(existingVal);
  };

  const enforceSinglePin = (msgs) => {
    if (!Array.isArray(msgs)) return [];
    let foundPinned = false;
    return [...msgs]
      .reverse()
      .map((m) => {
        if (m && m.isPinned) {
          if (!foundPinned) {
            foundPinned = true;
            return m;
          }
          return { ...m, isPinned: false };
        }
        return m;
      })
      .reverse();
  };

  // Automatically sync pinnedMessage whenever activeChat or its messages update
  useEffect(() => {
    if (activeChat && Array.isArray(activeChat.messages)) {
      const pinned = [...activeChat.messages].reverse().find((m) => m && m.isPinned && !m.isDeletedForEveryone);
      setPinnedMessage(pinned || null);
    } else {
      setPinnedMessage(null);
    }
  }, [activeChat?.id, activeChat?.messages]);
  const [selectedMessageForAction, setSelectedMessageForAction] = useState(null);
  const [showMessageActionModal, setShowMessageActionModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messagesToForward, setMessagesToForward] = useState([]);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');
  const [selectedForwardUserIds, setSelectedForwardUserIds] = useState([]);
  const [isSendingForward, setIsSendingForward] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMultiMessageIds, setSelectedMultiMessageIds] = useState([]);
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const deletedMessageIdsRef = useRef(new Set());
  const [showChatOptionsMenuModal, setShowChatOptionsMenuModal] = useState(false);
  const [showStarredModal, setShowStarredModal] = useState(false);
  const [showMediaDocsModal, setShowMediaDocsModal] = useState(false);
  const [mediaDocsTab, setMediaDocsTab] = useState('media'); // 'media' | 'docs' | 'links'
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetUser, setReportTargetUser] = useState(null);
  const [selectedReportReason, setSelectedReportReason] = useState('Inappropriate Photos or Content');
  const [reportDetails, setReportDetails] = useState('');
  const [alsoBlockOnReport, setAlsoBlockOnReport] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  // Admin Warning Modal States
  const [activeWarningData, setActiveWarningData] = useState(null);
  const [showAdminWarningModal, setShowAdminWarningModal] = useState(false);
  const [warningAckLoading, setWarningAckLoading] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [subscriptionPermissions, setSubscriptionPermissions] = useState(null);

  // Admin Deactivated Modal States (API Reference like Warning / Report)
  const [deactivatedData, setDeactivatedData] = useState(null);
  const [showDeactivatedModal, setShowDeactivatedModal] = useState(false);

  const handleAccountDeactivatedAlert = (reason) => {
    if (getIsDeactivationAlertShowing()) return;
    setIsDeactivationAlertShowing(true);
    const reasonText = reason || 'Account deactivated by admin moderation team';
    const targetUserId = currentUser?.id || currentUser?._id;
    Alert.alert(
      'Account Deactivated 🚫',
      `Your account has been deactivated by the admin.\n\nReason: ${reasonText}`,
      [
        {
          text: 'OK',
          onPress: async () => {
            try {
              if (socketRef.current) {
                try {
                  socketRef.current.emit('going_offline', targetUserId);
                } catch (e) { }
                socketRef.current.disconnect();
              }
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('user');
              setAuthToken(null);
            } catch (e) { }

            dispatch(logout());

            if (typeof onLogoutRef.current === 'function') {
              try {
                onLogoutRef.current(reasonText, true);
              } catch (e) { }
            }

            if (typeof onNavigateRef.current === 'function') {
              try {
                onNavigateRef.current('LOGIN');
              } catch (e) { }
            }

            setTimeout(() => {
              setIsDeactivationAlertShowing(false);
            }, 1500);
          },
        },
      ],
      { cancelable: false }
    );
  };

  const checkAccountStatus = async (fallbackReason = null) => {
    try {
      let email = currentUser?.email || userProfile?.email;
      let userId = currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id;
      if (!email) {
        try { email = await AsyncStorage.getItem('persistent_user_email'); } catch (e) { }
      }
      if (!userId) {
        try { userId = await AsyncStorage.getItem('persistent_user_id'); } catch (e) { }
      }
      const res = await apiClient.checkAccountStatus({ email, userId });
      if (res && (res.status === 'deactivated' || res.isDeactivated || res.isActive === false)) {
        setDeactivatedData(res);
        const reasonText = res.reason || fallbackReason || 'Account deactivated by admin moderation team';
        handleAccountDeactivatedAlert(reasonText);
        return true;
      }
      return false;
    } catch (err) {
      console.log('[HomeScreen] checkAccountStatus notice:', err);
      return false;
    }
  };

  const checkActiveWarning = async () => {
    try {
      const res = await apiClient.getActiveWarning();
      if (res && res.success && res.hasWarning && res.warning) {
        setActiveWarningData(res.warning);
      } else {
        setActiveWarningData(null);
      }
    } catch (err) {
      console.log('[HomeScreen] Active warning check notice:', err);
    }
  };

  const handleAcknowledgeWarningCall = async () => {
    try {
      setWarningAckLoading(true);
      const warningId = activeWarningData?._id;
      await apiClient.acknowledgeWarning(warningId);
      setShowAdminWarningModal(false);
      setActiveWarningData(null);
    } catch (err) {
      console.log('[HomeScreen] Error acknowledging warning:', err);
      setShowAdminWarningModal(false);
      setActiveWarningData(null);
    } finally {
      setWarningAckLoading(false);
    }
  };

  const handleTabPress = async (tabName) => {
    // API Check: Verify if account was deactivated whenever user switches or navigates tabs
    checkAccountStatus();

    if (showDeactivatedModal || (deactivatedData && deactivatedData.isDeactivated)) {
      setShowDeactivatedModal(true);
      return;
    }

    if (activeWarningData && !activeWarningData.isAcknowledged) {
      setShowAdminWarningModal(true);
      return;
    }

    if (tabName === 'search') {
      const activeUserObj = userProfile || currentUser;
      let perms = subscriptionPermissions || activeUserObj?.subscriptionPermissions;
      let canAccessSearch = Boolean(perms?.search?.isAllowed);

      // If local state doesn't have permissions or says false, verify live immediately before blocking!
      if (!canAccessSearch) {
        try {
          const freshSub = await apiClient.getMySubscription();
          if (freshSub && freshSub.success && freshSub.permissions) {
            perms = freshSub.permissions;
            setSubscriptionPermissions(freshSub.permissions);
            canAccessSearch = Boolean(freshSub.permissions?.search?.isAllowed);
            if (typeof onUpdateProfile === 'function') {
              onUpdateProfile({
                subscriptionTier: freshSub.subscriptionTier,
                subscriptionStatus: freshSub.subscriptionStatus || 'active',
                subscriptionPermissions: freshSub.permissions,
              });
            }
          }
        } catch (subErr) {
          console.log('[HomeScreen] Live subscription verification on tab press:', subErr);
        }
      }

      if (!canAccessSearch) {
        Alert.alert(
          '🔒 Feature Not Included',
          'Advanced Search is not included in your current plan. Upgrade to a plan with Advanced Search to unlock!',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'View Plans',
              onPress: () => setIsSubscriptionModalOpen(true),
            },
          ]
        );
        return;
      }
    }

    setActiveTab(tabName);
    if (tabName !== 'chat') {
      dispatch(setMessages([]));
      dispatch(setActiveChatUser(null));
      setActiveChat(null);
    }
  };

  useEffect(() => {
    if (currentUser && (currentUser.id || currentUser._id)) {
      checkActiveWarning();
      checkAccountStatus();
    }
  }, [currentUser, activeTab]);

  // Voice Notes States & Refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('0:00');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  const recordIntervalRef = useRef(null);
  const playbackIntervalRef = useRef(null);
  const audioRecorderPlayerRef = useRef(null);
  const lastPlaybackUpdateRef = useRef(0);

  useEffect(() => {
    try {
      audioRecorderPlayerRef.current = createSound();
    } catch (e) {
      console.log('Could not instantiate Sound:', e);
    }
    return () => {
      // Clean up any playing audio when screen unmounts
      if (audioRecorderPlayerRef.current) {
        try {
          audioRecorderPlayerRef.current.stopPlayer();
        } catch (_) { }
      }
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
      cleanUpWebRTCSession();
    };
  }, []);

  const fetchChatMessages = async () => {
    const currentActive = activeChatRef.current || activeChat;
    const partnerId = (currentActive?.id || currentActive?._id || currentActive?.userId)?.toString();
    if (!partnerId) return;
    try {
      const res = await apiClient.getChatMessages(partnerId);
      const rawMsgs = Array.isArray(res) ? res : (res?.messages || []);
      const isBlockedByMe = !Array.isArray(res) && res?.isBlockedByMe !== undefined ? !!res.isBlockedByMe : undefined;
      const isBlockedByOther = !Array.isArray(res) && res?.isBlockedByOther !== undefined ? !!res.isBlockedByOther : undefined;

      if (isBlockedByOther !== undefined) {
        if (isBlockedByOther) {
          setBlockedByOtherList((prev) => Array.from(new Set([...(prev || []).map((id) => id.toString()), partnerId])));
          setSelectedLikesProfile((prev) => {
            if (!prev) return prev;
            const pId = (prev.id || prev._id || prev.userId)?.toString();
            if (pId === partnerId) return null;
            return prev;
          });
        } else {
          setBlockedByOtherList((prev) => (prev || []).filter((id) => id.toString() !== partnerId));
        }
      }

      if (res?.partner) {
        setOnlineUsersMap((prev) => ({
          ...prev,
          [partnerId]: !!res.partner.isOnline,
        }));
        if (res.partner.lastSeen) {
          setLastSeenMap((prev) => ({
            ...prev,
            [partnerId]: res.partner.lastSeen,
          }));
        }
      }

      const currentUserId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
      const formattedMsgs = rawMsgs.map((m) => {
        const sId = (m.senderId || m.sender)?._id?.toString() || (m.senderId || m.sender)?.toString();
        return {
          id: (m._id || m.id).toString(),
          sender: sId === currentUserId ? 'you' : 'them',
          senderId: sId,
          receiverId: (m.receiverId || m.receiver)?._id?.toString() || (m.receiverId || m.receiver)?.toString(),
          text: m.text,
          messageType: (m.messageType && m.messageType !== 'text') ? m.messageType : (m.mediaUrl ? 'image' : (m.messageType || 'text')),
          mediaUrl: m.mediaUrl,
          fileName: m.fileName,
          fileSize: m.fileSize,
          stickerId: m.stickerId,
          replyTo: parseReplyTo(m.replyTo),
          reactions: Array.isArray(m.reactions) ? m.reactions : [],
          isEdited: Boolean(m.isEdited),
          isPinned: m.isPinned || false,
          starredBy: Array.isArray(m.starredBy) ? m.starredBy : [],
          isStarred: Array.isArray(m.starredBy) && currentUserId
            ? m.starredBy.some((id) => (id?._id || id)?.toString() === currentUserId)
            : Boolean(m.isStarred),
          isDeletedForEveryone: Boolean(
            m.isDeletedForEveryone ||
            m.text === 'This message was deleted' ||
            (m._id && deletedMessageIdsRef.current.has(m._id.toString())) ||
            (m.id && deletedMessageIdsRef.current.has(m.id.toString())) ||
            (m.tempId && deletedMessageIdsRef.current.has(m.tempId.toString()))
          ),
          status: m.status || 'sent',
          createdAt: m.createdAt,
        };
      });

      setActiveChat((prev) => {
        if (!prev) return prev;
        const pId = (prev.id || prev._id || prev.userId)?.toString();
        if (pId === partnerId) {
          const prevMsgs = prev.messages || [];
          const isBlockedByMeVal = isBlockedByMe !== undefined ? isBlockedByMe : prev.isBlocked;
          const isBlockedByOtherVal = isBlockedByOther !== undefined ? isBlockedByOther : prev.isBlockedByOther;

          // Preserve any local optimistic messages (pending, sending, failed, or with tempId not yet in formattedMsgs)
          const pendingMsgs = prevMsgs.filter(
            (m) => {
              if (!m) return false;
              const isPending = m.status === 'pending' ||
                m.status === 'sending' ||
                m.status === 'failed' ||
                (m.tempId && !formattedMsgs.some((f) => f.tempId === m.tempId || f.id === m.tempId || f.id === m.id));
              if (!isPending) return false;
              return doesMessageBelongToPartner(m, partnerId);
            }
          );

          // Merge server messages with local messages to preserve replyTo and reactions
          const mergedMsgs = formattedMsgs.map((fMsg) => {
            const existing = prevMsgs.find(
              (p) =>
                String(p.id) === String(fMsg.id) ||
                (p.tempId && (String(p.tempId) === String(fMsg.id) || String(p.tempId) === String(fMsg.tempId))) ||
                (fMsg.tempId && String(p.id) === String(fMsg.tempId))
            );
            if (!existing) return fMsg;
            const isDel = Boolean(
              existing.isDeletedForEveryone ||
              fMsg.isDeletedForEveryone ||
              existing.text === 'This message was deleted' ||
              fMsg.text === 'This message was deleted' ||
              (existing.id && deletedMessageIdsRef.current.has(String(existing.id))) ||
              (existing.tempId && deletedMessageIdsRef.current.has(String(existing.tempId))) ||
              (fMsg.id && deletedMessageIdsRef.current.has(String(fMsg.id))) ||
              (fMsg.tempId && deletedMessageIdsRef.current.has(String(fMsg.tempId)))
            );
            return {
              ...existing,
              ...fMsg,
              isDeletedForEveryone: isDel,
              text: isDel ? 'This message was deleted' : (fMsg.text || existing.text),
              messageType: (fMsg.messageType && fMsg.messageType !== 'text') ? fMsg.messageType : (existing.messageType || fMsg.messageType || (existing.mediaUrl || fMsg.mediaUrl ? 'image' : 'text')),
              mediaUrl: isDel ? null : (fMsg.mediaUrl || existing.mediaUrl),
              fileName: isDel ? null : (fMsg.fileName || existing.fileName),
              fileSize: isDel ? null : (fMsg.fileSize || existing.fileSize),
              reactions: isDel ? [] : (Array.isArray(fMsg.reactions)
                ? fMsg.reactions
                : (Array.isArray(existing.reactions) ? existing.reactions : [])),
              tempId: fMsg.tempId || existing.tempId || null,
              replyTo: isDel ? null : (parseReplyTo(fMsg.replyTo) || parseReplyTo(existing.replyTo) || null),
              isPinned: isDel ? false : resolveIsPinned(fMsg.id, fMsg.tempId || existing.tempId, fMsg.isPinned, existing.isPinned),
              starredBy: Array.isArray(fMsg.starredBy) ? fMsg.starredBy : (Array.isArray(existing.starredBy) ? existing.starredBy : []),
              isStarred: resolveIsStarred(fMsg.id, fMsg.tempId || existing.tempId, fMsg.isStarred, existing.isStarred, fMsg.starredBy),
              isEdited: Boolean(fMsg.isEdited || existing.isEdited),
            };
          });

          pendingMsgs.forEach((pMsg) => {
            if (!mergedMsgs.some((m) => m.id === pMsg.id || (pMsg.tempId && (m.tempId === pMsg.tempId || m.id === pMsg.tempId)))) {
              mergedMsgs.push(pMsg);
            }
          });

          // Keep chronologically sorted
          mergedMsgs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

          return {
            ...prev,
            messages: enforceSinglePin(mergedMsgs),
            isBlocked: isBlockedByMeVal,
            isBlockedByOther: isBlockedByOtherVal,
            name: isBlockedByOtherVal ? 'Matched User' : prev.name,
            image: isBlockedByOtherVal ? null : prev.image,
            profileImage: isBlockedByOtherVal ? null : prev.profileImage,
          };
        }
        return prev;
      });

      setChats((prevChats) =>
        prevChats.map((c) => {
          const cId = (c.id || c._id || c.userId)?.toString();
          if (cId === partnerId) {
            const prevMsgs = c.messages || [];
            const mergedChatMsgs = formattedMsgs.map((fMsg) => {
              const existing = prevMsgs.find(
                (p) =>
                  String(p.id) === String(fMsg.id) ||
                  (p.tempId && (String(p.tempId) === String(fMsg.id) || String(p.tempId) === String(fMsg.tempId))) ||
                  (fMsg.tempId && String(p.id) === String(fMsg.tempId))
              );
              if (!existing) return fMsg;
              const isDel = Boolean(
                existing.isDeletedForEveryone ||
                fMsg.isDeletedForEveryone ||
                existing.text === 'This message was deleted' ||
                fMsg.text === 'This message was deleted' ||
                (existing.id && deletedMessageIdsRef.current.has(String(existing.id))) ||
                (existing.tempId && deletedMessageIdsRef.current.has(String(existing.tempId))) ||
                (fMsg.id && deletedMessageIdsRef.current.has(String(fMsg.id))) ||
                (fMsg.tempId && deletedMessageIdsRef.current.has(String(fMsg.tempId)))
              );
              return {
                ...existing,
                ...fMsg,
                isDeletedForEveryone: isDel,
                text: isDel ? 'This message was deleted' : (fMsg.text || existing.text),
                mediaUrl: isDel ? null : (fMsg.mediaUrl || existing.mediaUrl),
                fileName: isDel ? null : (fMsg.fileName || existing.fileName),
                fileSize: isDel ? null : (fMsg.fileSize || existing.fileSize),
                reactions: isDel ? [] : (Array.isArray(fMsg.reactions)
                  ? fMsg.reactions
                  : (Array.isArray(existing.reactions) ? existing.reactions : [])),
                tempId: fMsg.tempId || existing.tempId || null,
                replyTo: isDel ? null : (parseReplyTo(fMsg.replyTo) || parseReplyTo(existing.replyTo) || null),
                isPinned: isDel ? false : resolveIsPinned(fMsg.id, fMsg.tempId || existing.tempId, fMsg.isPinned, existing.isPinned),
                starredBy: Array.isArray(fMsg.starredBy) ? fMsg.starredBy : (Array.isArray(existing.starredBy) ? existing.starredBy : []),
                isStarred: resolveIsStarred(fMsg.id, fMsg.tempId || existing.tempId, fMsg.isStarred, existing.isStarred, fMsg.starredBy),
                isEdited: Boolean(fMsg.isEdited || existing.isEdited),
              };
            });
            const filteredPrevMsgs = prevMsgs.filter((m) => doesMessageBelongToPartner(m, partnerId));
            const finalMsgs = enforceSinglePin((mergedChatMsgs.length === 0 && filteredPrevMsgs.length > 0) ? filteredPrevMsgs : mergedChatMsgs);
            const msgsEqual = prevMsgs.length === finalMsgs.length &&
              prevMsgs.every((m, i) =>
                m.id === finalMsgs[i]?.id &&
                m.text === finalMsgs[i]?.text &&
                m.isEdited === finalMsgs[i]?.isEdited &&
                Boolean(m.isPinned) === Boolean(finalMsgs[i]?.isPinned) &&
                Boolean(m.isStarred) === Boolean(finalMsgs[i]?.isStarred) &&
                JSON.stringify(m.replyTo || null) === JSON.stringify(finalMsgs[i]?.replyTo || null) &&
                JSON.stringify(m.reactions || []) === JSON.stringify(finalMsgs[i]?.reactions || [])
              );
            const isBlockedByMeVal = isBlockedByMe !== undefined ? isBlockedByMe : c.isBlocked;
            const isBlockedByOtherVal = isBlockedByOther !== undefined ? isBlockedByOther : c.isBlockedByOther;
            if (msgsEqual && isBlockedByMeVal === c.isBlocked && isBlockedByOtherVal === c.isBlockedByOther) {
              return c;
            }
            return {
              ...c,
              messages: finalMsgs,
              isBlocked: isBlockedByMeVal,
              isBlockedByOther: isBlockedByOtherVal,
              name: isBlockedByOtherVal ? 'Matched User' : c.name,
              image: isBlockedByOtherVal ? null : c.image,
            };
          }
          return c;
        })
      );
      dispatch(setMessages(formattedMsgs));
    } catch (err) {
      if (err?.name === 'AbortError' || err?.message?.includes('Aborted') || err?.message?.includes('abort')) {
        return; // Silently ignore cancelled/aborted request
      }
      console.log('Error fetching chat messages:', err);
    }
  };

  useEffect(() => {
    fetchChatMessages();
    let pollInterval;
    const partnerId = (activeChat?.id || activeChat?._id || activeChat?.userId)?.toString();
    const currentUserId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
    if (partnerId) {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('check_online_status', { targetUserId: partnerId, viewerUserId: currentUserId });
      }
      pollInterval = setInterval(() => {
        fetchChatMessages();
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('check_online_status', { targetUserId: partnerId, viewerUserId: currentUserId });
        }
      }, 7000);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id, activeChat?._id, activeChat?.userId]);

  const refetchChatMessages = fetchChatMessages;
  const chatMessagesData = messages;

  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isCurrentlyTypingRef = useRef(false);
  const [resolvedSocketUrl, setResolvedSocketUrl] = useState(getActiveResolvedUrl());
  const socketUrl = resolvedSocketUrl || getActiveResolvedUrl() || getBaseUrl();
  const handleIncomingMessageRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeBaseUrlChanged((newUrl) => {
      if (newUrl) setResolvedSocketUrl(newUrl);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // --- Voice Call WebRTC Setup ---
  const [callState, setCallState] = useState('idle'); // idle, calling, incoming, connected
  const [callSession, setCallSession] = useState(null); // { id, name, image, isCaller, incomingOffer }
  const [callDuration, setCallDuration] = useState(0);
  const [callStatusText, setCallStatusText] = useState('Calling...');
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callTimerRef = useRef(null);
  const callingTimeoutRef = useRef(null);

  const callStateRef = useRef(callState);
  const callSessionRef = useRef(callSession);
  const callDurationRef = useRef(callDuration);
  const handleSendMessageRef = useRef(null);

  useEffect(() => {
    callStateRef.current = callState;
    callSessionRef.current = callSession;
    callDurationRef.current = callDuration;
  }, [callState, callSession, callDuration]);

  const recordCallLogMessage = (targetUserId, callText, statusType = 'completed') => {
    if (!targetUserId || !handleSendMessageRef.current) return;
    handleSendMessageRef.current({
      receiverId: targetUserId,
      text: callText,
      messageType: 'call',
      mediaUrl: statusType,
    });
  };

  const getLocalStream = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Please allow access to your microphone to make voice calls.',
            buttonPositive: 'Allow',
            buttonNegative: 'Cancel',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Microphone permission is required to make voice calls.');
          return null;
        }
      }

      if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
        console.log('mediaDevices or getUserMedia unavailable');
        Alert.alert('WebRTC Error', 'Audio device is not supported on this platform.');
        return null;
      }

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;
      return stream;
    } catch (e) {
      console.log('Error getting local audio stream:', e);
      Alert.alert('Microphone Error', e?.message || 'Unable to access microphone.');
      return null;
    }
  };

  const createPeerConnection = async (targetUserId) => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && currentUser) {
        const currentId = currentUser.id || currentUser._id;
        socketRef.current.emit('webrtc_ice_candidate', {
          senderId: currentId,
          receiverId: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    if ('ontrack' in pc) {
      pc.ontrack = (event) => {
        console.log('WebRTC remote audio track added');
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
        }
      };
    }
    pc.onaddstream = (event) => {
      console.log('WebRTC remote audio stream added');
      remoteStreamRef.current = event.stream;
    };

    const localStream = localStreamRef.current || await getLocalStream();
    if (localStream) {
      if (typeof pc.addTrack === 'function') {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      } else if (typeof pc.addStream === 'function') {
        pc.addStream(localStream);
      }
    }

    return pc;
  };

  const makeVoiceCall = async () => {
    if (!activeChat || !currentUser || !socketRef.current) return;
    const currentId = currentUser.id || currentUser._id;

    setCallSession({
      id: activeChat.id,
      name: activeChat.name,
      image: activeChat.image,
      isCaller: true,
    });
    setCallState('calling');
    setCallStatusText('Calling...');

    // Start Outgoing Ringback Tone for Caller (User A)
    soundService.playOutgoingRingback();

    if (callingTimeoutRef.current) clearTimeout(callingTimeoutRef.current);
    callingTimeoutRef.current = setTimeout(() => {
      console.log('Voice call 45s ringing timeout reached with no answer');
      Alert.alert('No Answer', 'No answer from user.');
      endVoiceCall();
    }, 45000);

    const localStream = await getLocalStream();
    if (!localStream) {
      endVoiceCall();
      return;
    }

    const pc = await createPeerConnection(activeChat.id);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current.emit('make_call', {
        callerId: currentId,
        callerName: currentUser.firstName || currentUser.name,
        callerImage: currentUser.profileImage,
        receiverId: activeChat.id,
        offer,
      });
      console.log('Voice call offer emitted via socket');
    } catch (e) {
      console.log('Error creating WebRTC offer:', e);
      endVoiceCall();
    }
  };

  const acceptVoiceCall = async () => {
    if (!callSession || !socketRef.current || !currentUser) return;
    const currentId = currentUser.id || currentUser._id;

    // Stop incoming ringtone on answer
    soundService.stopAllRingtones();

    if (callingTimeoutRef.current) {
      clearTimeout(callingTimeoutRef.current);
      callingTimeoutRef.current = null;
    }

    const localStream = await getLocalStream();
    if (!localStream) {
      rejectVoiceCall();
      return;
    }

    const pc = await createPeerConnection(callSession.id);

    try {
      const offerDesc = typeof RTCSessionDescription === 'function' && callSession.incomingOffer
        ? new RTCSessionDescription(callSession.incomingOffer)
        : callSession.incomingOffer;

      await pc.setRemoteDescription(offerDesc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('accept_call', {
        callerId: callSession.id,
        receiverId: currentId,
        answer,
      });

      setCallState('connected');
      startCallTimer();
    } catch (e) {
      console.log('Error accepting voice call:', e);
      endVoiceCall();
    }
  };

  const rejectVoiceCall = () => {
    soundService.playCallEndedTone();
    if (callSessionRef.current) {
      recordCallLogMessage(callSessionRef.current.id, '📞 Missed voice call', 'declined');
    }
    if (!callSession || !socketRef.current || !currentUser) return;
    const currentId = currentUser.id || currentUser._id;

    socketRef.current.emit('reject_call', {
      callerId: callSession.id,
      receiverId: currentId,
    });

    setCallState('idle');
    setCallSession(null);
  };

  const cleanUpWebRTCSession = () => {
    soundService.stopAllRingtones();

    if (callingTimeoutRef.current) {
      clearTimeout(callingTimeoutRef.current);
      callingTimeoutRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    remoteStreamRef.current = null;
    setIsCallMuted(false);
    setIsSpeakerOn(false);
  };

  const endVoiceCall = () => {
    soundService.stopAllRingtones();

    if (callSessionRef.current) {
      const targetId = callSessionRef.current.id;
      const duration = callDurationRef.current || 0;
      const isCaller = callSessionRef.current.isCaller;

      let callText = '';
      let statusType = 'completed';

      if (duration > 0) {
        const durStr = formatDuration(duration);
        callText = `📞 Voice call, ${durStr}`;
        statusType = 'completed';
      } else {
        callText = isCaller ? '📞 Voice call (No answer)' : '📞 Missed voice call';
        statusType = 'missed';
      }

      recordCallLogMessage(targetId, callText, statusType);
    }

    if (socketRef.current && currentUser && callSession) {
      const currentId = currentUser.id || currentUser._id;
      socketRef.current.emit('end_call', {
        callerId: callSession.isCaller ? currentId : callSession.id,
        receiverId: callSession.isCaller ? callSession.id : currentId,
      });
    }
    cleanUpWebRTCSession();
    setCallState('idle');
    setCallSession(null);
  };

  const startCallTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleCallMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsCallMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => !prev);
  };

  // Reset typing state when active chat changes
  useEffect(() => {
    setIsTyping(false);
    if (isCurrentlyTypingRef.current && socketRef.current && currentUser && activeChat) {
      const currentId = (currentUser.id || currentUser._id)?.toString();
      const partnerId = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
      if (currentId && partnerId) {
        socketRef.current.emit('stop_typing', { senderId: currentId, receiverId: partnerId });
      }
    }
    isCurrentlyTypingRef.current = false;
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id, activeChat?._id, activeChat?.userId]);

  // Edit Profile States
  const [matchedUserIds, setMatchedUserIds] = useState([]);
  const [likesList, setLikesList] = useState([]);
  const [showActiveCardDetails, setShowActiveCardDetails] = useState(false);
  const [candidateStoryIndex, setCandidateStoryIndex] = useState(null);

  useEffect(() => {
    const fetchOnlineUsers = async () => {
      try {
        const res = await apiClient.getOnlineUsers();
        if (res && (res.users || Array.isArray(res))) {
          const userList = res.users || res;
          const map = {};
          userList.forEach((u) => {
            const uId = (u._id || u.id)?.toString();
            if (uId) map[uId] = true;
          });
          setOnlineUsersMap((prev) => ({ ...prev, ...map }));
        }
      } catch (e) {
        console.log('Error fetching online users API:', e);
      }
    };
    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 35000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (questionnairesData?.users) {
      const initialOnlineMap = {};
      const initialLastSeenMap = {};
      questionnairesData.users.forEach((u) => {
        const uId = (u.id || u._id || u.userId)?.toString();
        if (uId) {
          if (u.isOnline !== undefined) initialOnlineMap[uId] = !!u.isOnline;
          if (u.lastSeen) initialLastSeenMap[uId] = u.lastSeen;
        }
      });
      setOnlineUsersMap((prev) => ({ ...prev, ...initialOnlineMap }));
      setLastSeenMap((prev) => ({ ...prev, ...initialLastSeenMap }));
    }
  }, [questionnairesData]);

  useEffect(() => {
    if (likesData?.users && Array.isArray(likesData.users)) {
      setLikesList(likesData.users);
      const likesOnlineMap = {};
      const likesLastSeenMap = {};
      likesData.users.forEach((u) => {
        const uId = (u.id || u._id || u.userId)?.toString();
        if (uId) {
          if (u.isOnline !== undefined) likesOnlineMap[uId] = !!u.isOnline;
          if (u.lastSeen) likesLastSeenMap[uId] = u.lastSeen;
        }
      });
      setOnlineUsersMap((prev) => ({ ...prev, ...likesOnlineMap }));
      setLastSeenMap((prev) => ({ ...prev, ...likesLastSeenMap }));
    }
  }, [likesData]);

  useEffect(() => {
    if (matchesData?.matches && Array.isArray(matchesData.matches)) {
      setMatchedUserIds(matchesData.matches.map((m) => m.id || m._id));
      const matchOnlineMap = {};
      const matchLastSeenMap = {};
      matchesData.matches.forEach((u) => {
        const uId = (u.id || u._id || u.userId)?.toString();
        if (uId) {
          if (u.isOnline !== undefined) matchOnlineMap[uId] = !!u.isOnline;
          if (u.lastSeen) matchLastSeenMap[uId] = u.lastSeen;
        }
      });
      setOnlineUsersMap((prev) => ({ ...prev, ...matchOnlineMap }));
      setLastSeenMap((prev) => ({ ...prev, ...matchLastSeenMap }));
    }
  }, [matchesData]);

  useEffect(() => {
    setShowActiveCardDetails(false);
  }, [swipeIndex]);



  const [swipeHistory, setSwipeHistory] = useState([]);

  const handleSwipeLeft = () => {
    if (swipeIndex < MOCK_MATCHES.length) {
      const candidate = MOCK_MATCHES[swipeIndex];
      setSwipeHistory((prev) => [...prev, { candidate, action: 'pass' }]);
      setSwipeIndex(swipeIndex + 1);
    }
  };

  const handleSwipeRight = async () => {
    if (swipeIndex < MOCK_MATCHES.length) {
      const candidate = MOCK_MATCHES[swipeIndex];
      const targetId = candidate?.id || candidate?._id;

      try {
        const result = await apiClient.likeUser({ likedId: targetId });

        setSwipeHistory((prev) => [...prev, { candidate, action: 'like' }]);
        if (targetId && !likedByMe.includes(targetId)) {
          setLikedByMe([...likedByMe, targetId]);
        }

        if (result.isMatch) {
          setMatchedUser(candidate);
          setShowMatchPopup(true);
          refetchMatchesList();
          refetchLikes();
        } else {
          Alert.alert(
            '❤️ Liked!',
            `You liked ${candidate.name || candidate.firstName}! If they like you back, it's a match!`,
            [{ text: 'OK' }]
          );
        }
        setSwipeIndex((prev) => prev + 1);
      } catch (err) {
        console.error('Error saving like to backend:', err);

        // Reset card smoothly back to center on deck so card is not lost off-screen
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          tension: 40,
          useNativeDriver: false,
        }).start();

        const errMsg = err?.data?.message || err?.message || '';
        Alert.alert(
          '🔒 Daily Like Limit Reached',
          errMsg || 'You have reached your daily like limit! Upgrade your plan for higher or unlimited swipes.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'View Plans',
              onPress: () => setIsSubscriptionModalOpen(true),
            },
          ]
        );
      }
    }
  };

  const handleUndoSwipe = async () => {
    if (swipeHistory.length === 0 && swipeIndex === 0) {
      Alert.alert('No Swipe to Rewind', 'You have not swiped on any candidate profile yet.');
      return;
    }

    const lastItem = swipeHistory[swipeHistory.length - 1] || (swipeIndex > 0 ? { candidate: MOCK_MATCHES[swipeIndex - 1] } : null);
    const targetId = lastItem?.candidate?.id || lastItem?.candidate?._id;
    const candidateName = lastItem?.candidate?.name || lastItem?.candidate?.firstName || 'previous profile';

    if (lastItem && lastItem.candidate && targetId) {
      try {
        await apiClient.undoSwipe({ targetUserId: targetId });
      } catch (err) {
        console.log('Error undoing swipe on backend:', err);
      }
    }

    setSwipeHistory((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
    position.setValue({ x: 0, y: 0 });
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      tension: 40,
      useNativeDriver: false,
    }).start();

    setShowActiveCardDetails(false);
    setSwipeIndex((prev) => Math.max(0, prev - 1));
    Alert.alert('Swipe Rewound ⏪', `Restored ${candidateName}'s profile onto your card deck!`);
  };

  useEffect(() => {
    handleSwipeLeftRef.current = handleSwipeLeft;
    handleSwipeRightRef.current = handleSwipeRight;
  }); // Runs on every render to prevent PanResponder stale closures

  const handleLikeMatch = async (user) => {
    const targetId = user?.id || user?._id;
    try {
      const result = await apiClient.likeUser({ likedId: targetId });

      if (targetId && !likedByMe.includes(targetId)) {
        setLikedByMe([...likedByMe, targetId]);
      }

      if (result.isMatch || result.message?.includes('match') || result.message?.includes('Match')) {
        setMatchedUser(user);
        setShowMatchPopup(true);
      }

      refetchMatchesList();
      refetchLikes();
      refetchSwipedIds();
    } catch (err) {
      console.error('Error matching from Likes tab:', err);
      const errMsg = err?.data?.message || err?.message || '';
      Alert.alert(
        '🔒 Daily Like Limit Reached',
        errMsg || 'You have reached your daily like limit! Upgrade your plan for higher or unlimited swipes.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Plans',
            onPress: () => setIsSubscriptionModalOpen(true),
          },
        ]
      );
    }
  };

  const handleRejectLike = async (user) => {
    try {
      await apiClient.rejectLike({ likerId: user.id });
      Alert.alert('Dismissed', `You passed on ${user.name}.`);
      refetchLikes();
      refetchSwipedIds();
    } catch (err) {
      console.error('Error rejecting like:', err);
    }
  };

  const handleIncomingMessage = (msg) => {
    if (!msg || !msg.senderId || !msg.receiverId) return;
    const sId = msg.senderId.toString();
    const rId = msg.receiverId.toString();
    const currentId = (currentUser?.id || currentUser?._id)?.toString();
    if (!currentId) return;
    const otherId = sId === currentId ? rId : sId;
    const isMe = sId === currentId;

    const formattedMsg = {
      id: (msg._id || msg.id || String(Date.now() + Math.random())).toString(),
      sender: isMe ? 'you' : 'them',
      senderId: sId,
      receiverId: rId,
      text: msg.text,
      messageType: msg.messageType || 'text',
      mediaUrl: msg.mediaUrl,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      stickerId: msg.stickerId,
      replyTo: parseReplyTo(msg.replyTo),
      reactions: Array.isArray(msg.reactions) ? msg.reactions : [],
      isEdited: Boolean(msg.isEdited),
      status: msg.status || 'sent',
      createdAt: msg.createdAt || new Date().toISOString(),
    };

    const matchId = (obj, targetIdStr) => {
      if (!obj || !targetIdStr) return false;
      const cId = (obj.id || obj._id || obj.userId)?.toString();
      return cId === targetIdStr.toString();
    };

    setChats((prevChats) => {
      let chatExists = false;
      const updated = prevChats.map((c) => {
        if (matchId(c, otherId)) {
          chatExists = true;
          const msgList = (c.messages || []).filter((m) => m.id !== 'match-init');
          if (msgList.some((m) => (m.id || m._id)?.toString() === formattedMsg.id)) {
            return c;
          }
          return {
            ...c,
            messages: [...msgList, formattedMsg],
          };
        }
        return c;
      });

      if (!chatExists) {
        const otherUser = questionnairesData?.users?.find(
          (u) => matchId(u, otherId)
        );
        updated.push({
          id: otherId,
          _id: otherId,
          userId: otherId,
          name: otherUser ? otherUser.name : 'Match',
          image: otherUser ? otherUser.image : '',
          messages: [formattedMsg],
        });
      }
      return updated;
    });

    setActiveChat((prevActiveChat) => {
      if (matchId(prevActiveChat, otherId)) {
        const msgList = (prevActiveChat.messages || []).filter((m) => m.id !== 'match-init');
        if (msgList.some((m) => (m.id || m._id)?.toString() === formattedMsg.id)) {
          return prevActiveChat;
        }
        return {
          ...prevActiveChat,
          messages: [...msgList, formattedMsg],
        };
      }
      return prevActiveChat;
    });
  };

  useEffect(() => {
    handleIncomingMessageRef.current = handleIncomingMessage;
  });

  // Socket.IO connection setup
  useEffect(() => {
    if (currentUser && (currentUser.id || currentUser._id)) {
      const currentId = currentUser.id || currentUser._id;
      const targetSocketUrl = resolvedSocketUrl || getActiveResolvedUrl() || getBaseUrl();
      const isVercelHost = typeof targetSocketUrl === 'string' && targetSocketUrl.includes('vercel.app');
      console.log('Connecting to Socket.IO at:', targetSocketUrl, '| isVercelHost:', isVercelHost);
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch (_) {}
      }
      socketRef.current = io(targetSocketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: !isVercelHost,
        reconnectionAttempts: isVercelHost ? 2 : 5,
        reconnectionDelay: 3000,
        reconnectionDelayMax: 15000,
        timeout: 10000,
        pingTimeout: 30000,
        pingInterval: 25000,
        autoConnect: true,
      });

      socketRef.current.on('connect', () => {
        console.log('🟢 [FRONTEND SOCKET CONNECT] Connected to:', targetSocketUrl, '| Emitting join & ping_presence for currentId:', currentId);
        socketRef.current.emit('join', currentId);
        socketRef.current.emit('ping_presence', currentId);

        // Flush offline queue on reconnection with server acknowledgement
        const currentQueue = offlineQueueRef.current || [];
        if (currentQueue && currentQueue.length > 0) {
          console.log(`⚡ [OFFLINE QUEUE] Reconnected! Flushing ${currentQueue.length} pending messages...`);
          currentQueue.forEach((item) => {
            if (item && item.payload) {
              socketRef.current.emit('send_message', item.payload, (res) => {
                if (res && res.status === 'ok' && res.data) {
                  handleServerConfirmation(res.data);
                }
              });
            }
          });
        }
      });

      socketRef.current.on('connect_error', (err) => {
        console.warn('⚠️ [FRONTEND SOCKET CONNECT_ERROR] Connection error to', targetSocketUrl, ':', err.message);
        if (isVercelHost && socketRef.current) {
          try { socketRef.current.disconnect(); } catch (_) {}
        }
      });

      socketRef.current.on('online_users_list', ({ onlineUserIds }) => {
        console.log('Socket.IO online_users_list received:', onlineUserIds);
        if (Array.isArray(onlineUserIds)) {
          setOnlineUsersMap((prev) => {
            const updated = { ...prev };
            onlineUserIds.forEach((id) => {
              updated[id.toString()] = true;
            });
            return updated;
          });
        }
      });

      socketRef.current.on('user_status', ({ userId, status, lastSeen }) => {
        const isOnline = status === 'online';
        const uIdStr = userId?.toString();
        console.log(`🔄 [FRONTEND STATUS CHANGE] User "${uIdStr}" status changed to -> ${isOnline ? 'Online 🟢' : 'Offline 🔴'} (via socket event user_status, lastSeen: ${lastSeen || 'N/A'})`);
        if (uIdStr) {
          setOnlineUsersMap((prev) => ({
            ...prev,
            [uIdStr]: isOnline,
          }));
          if (status === 'offline') {
            const effectiveLastSeen = lastSeen || new Date().toISOString();
            setLastSeenMap((prev) => ({
              ...prev,
              [uIdStr]: effectiveLastSeen,
            }));
            setActiveChat((prevActive) => {
              if (!prevActive) return null;
              const pIdStr = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
              if (pIdStr === uIdStr) {
                return {
                  ...prevActive,
                  isOnline: false,
                  lastSeen: effectiveLastSeen,
                };
              }
              return prevActive;
            });
          } else if (isOnline) {
            setActiveChat((prevActive) => {
              if (!prevActive) return null;
              const pIdStr = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
              if (pIdStr === uIdStr) {
                return {
                  ...prevActive,
                  isOnline: true,
                };
              }
              return prevActive;
            });
          }
        }
      });

      socketRef.current.on('online_status_response', ({ targetUserId, isOnline, lastSeen }) => {
        const tIdStr = targetUserId?.toString();
        console.log(`🔄 [FRONTEND STATUS CHANGE] Target User "${tIdStr}" status updated to -> ${isOnline ? 'Online 🟢' : 'Offline 🔴'} (via online_status_response, lastSeen: ${lastSeen || 'N/A'})`);
        if (tIdStr) {
          setOnlineUsersMap((prev) => ({
            ...prev,
            [tIdStr]: !!isOnline,
          }));
          if (lastSeen) {
            setLastSeenMap((prev) => ({
              ...prev,
              [tIdStr]: lastSeen,
            }));
          }
          setActiveChat((prevActive) => {
            if (!prevActive) return null;
            const pIdStr = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
            if (pIdStr === tIdStr) {
              return {
                ...prevActive,
                isOnline: !!isOnline,
                lastSeen: lastSeen || prevActive.lastSeen,
              };
            }
            return prevActive;
          });
        }
      });

      socketRef.current.on('message_delivered', ({ messageId, receiverId }) => {
        console.log(`Socket.IO message_delivered: ${messageId}`);
        const rIdStr = receiverId?.toString();
        setChats((prevChats) =>
          prevChats.map((c) => {
            const cIdStr = (c.id || c._id || c.userId)?.toString();
            if (!rIdStr || cIdStr === rIdStr) {
              return {
                ...c,
                messages: (c.messages || []).map((m) =>
                  m.id === messageId ? { ...m, status: 'delivered' } : m
                ),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          const activeIdStr = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
          if (!rIdStr || activeIdStr === rIdStr) {
            return {
              ...prevActive,
              messages: (prevActive.messages || []).map((m) =>
                m.id === messageId ? { ...m, status: 'delivered' } : m
              ),
            };
          }
          return prevActive;
        });
      });

      socketRef.current.on('messages_seen', (data) => {
        console.log(`Socket.IO messages_seen received:`, data);
        const currentId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
        const rId = (data?.receiverId || data?.senderId || data?.userId)?.toString();
        const sId = (data?.senderId || data?.receiverId)?.toString();

        setChats((prevChats) =>
          prevChats.map((c) => {
            const chatPartnerId = (c.id || c._id || c.userId)?.toString();
            if (chatPartnerId === rId || chatPartnerId === sId) {
              return {
                ...c,
                messages: (c.messages || []).map((m) =>
                  (m.sender === 'you' || m.senderId === currentId)
                    ? { ...m, status: 'seen' }
                    : m
                ),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          const activePartnerId = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
          if (activePartnerId === rId || activePartnerId === sId) {
            return {
              ...prevActive,
              messages: (prevActive.messages || []).map((m) =>
                (m.sender === 'you' || m.senderId === currentId)
                  ? { ...m, status: 'seen' }
                  : m
              ),
            };
          }
          return prevActive;
        });
      });

      socketRef.current.on('message_sent', (msgData) => {
        if (!msgData) return;
        console.log('Socket.IO message_sent received:', msgData);
        const tempId = msgData.tempId;
        const actualMsg = {
          id: (msgData._id || msgData.id).toString(),
          tempId: tempId,
          sender: 'you',
          senderId: (msgData.senderId || msgData.sender)?.toString(),
          receiverId: (msgData.receiverId || msgData.receiver)?.toString(),
          text: msgData.text || '',
          time: new Date(msgData.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          messageType: msgData.messageType || 'text',
          mediaUrl: msgData.mediaUrl,
          fileName: msgData.fileName,
          fileSize: msgData.fileSize,
          stickerId: msgData.stickerId,
          replyTo: parseReplyTo(msgData.replyTo),
          reactions: Array.isArray(msgData.reactions) ? msgData.reactions : [],
          isEdited: Boolean(msgData.isEdited),
          status: msgData.status || 'sent',
          createdAt: msgData.createdAt || new Date().toISOString(),
        };
        const rIdStr = (msgData.receiverId || msgData.receiver)?.toString();

        setChats((prevChats) => {
          if (!Array.isArray(prevChats)) return prevChats;
          const updated = prevChats.map((c) => {
            const cIdStr = (c.id || c._id || c.userId)?.toString();
            if (cIdStr === rIdStr) {
              const msgs = c.messages || [];
              const exists = msgs.some((m) => m.id === actualMsg.id || (tempId && (m.id === tempId || m.tempId === tempId)));
              return {
                ...c,
                messages: exists
                  ? msgs.map((m) => (m.id === tempId || m.tempId === tempId || m.id === actualMsg.id ? actualMsg : m))
                  : [...msgs, actualMsg],
              };
            }
            return c;
          });
          return sortChatsByRecent(updated);
        });
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          const activeIdStr = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
          if (activeIdStr === rIdStr) {
            const msgs = prevActive.messages || [];
            const exists = msgs.some((m) => m.id === actualMsg.id || (tempId && (m.id === tempId || m.tempId === tempId)));
            return {
              ...prevActive,
              messages: exists
                ? msgs.map((m) => (m.id === tempId || m.tempId === tempId || m.id === actualMsg.id ? actualMsg : m))
                : [...msgs, actualMsg],
            };
          }
          return prevActive;
        });
        setOfflineQueue((prev) => prev.filter((item) => item.tempId !== tempId));
      });

      socketRef.current.on('receive_message', (msg) => {
        console.log('Socket.IO received message:', msg);

        const senderIdStr = (msg.senderId || msg.sender)?.toString();
        const activePartnerId = (activeChatRef.current?.id || activeChatRef.current?._id || activeChatRef.current?.userId)?.toString();
        const isCurrentlyViewingChat = activePartnerId && activePartnerId === senderIdStr;

        const formattedMsg = {
          id: (msg._id || msg.id || Date.now()).toString(),
          sender: 'them',
          senderId: senderIdStr,
          receiverId: (msg.receiverId || msg.receiver)?.toString(),
          text: msg.text || '',
          time: new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          messageType: msg.messageType || 'text',
          mediaUrl: msg.mediaUrl,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          stickerId: msg.stickerId,
          replyTo: parseReplyTo(msg.replyTo),
          reactions: Array.isArray(msg.reactions) ? msg.reactions : [],
          isEdited: Boolean(msg.isEdited),
          status: isCurrentlyViewingChat ? 'seen' : (msg.status || 'delivered'),
          createdAt: msg.createdAt || new Date().toISOString(),
        };

        // 1. Instantly update activeChat state if user is currently chatting with sender
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          const activeId = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
          if (activeId === senderIdStr) {
            const existingMsgs = prevActive.messages || [];
            const isDup = existingMsgs.some(
              (m) =>
                (m.id || m._id)?.toString() === formattedMsg.id ||
                (m.text === formattedMsg.text && m.sender === 'them' && Math.abs(new Date(m.createdAt || Date.now()) - new Date(formattedMsg.createdAt)) < 5000)
            );
            if (isDup) {
              return prevActive;
            }
            return {
              ...prevActive,
              messages: [...existingMsgs, formattedMsg],
            };
          }
          return prevActive;
        });

        // 2. Instantly update chats list state & sort most recent to top!
        setChats((prevChats) => {
          if (!Array.isArray(prevChats)) return prevChats;
          const existsInChats = prevChats.some((c) => (c.id || c._id || c.userId)?.toString() === senderIdStr);
          let updatedChats;
          if (!existsInChats) {
            const newChat = {
              id: senderIdStr,
              name: msg.senderName || 'Matched User',
              image: msg.senderImage || null,
              lastMessage: formattedMsg.text || 'Message',
              lastMessageTime: formattedMsg.time,
              messages: [formattedMsg],
            };
            updatedChats = [newChat, ...prevChats];
          } else {
            updatedChats = prevChats.map((c) => {
              const chatPartnerId = (c.id || c._id || c.userId)?.toString();
              if (chatPartnerId === senderIdStr) {
                const msgs = c.messages || [];
                const exists = msgs.some((m) => (m.id || m._id)?.toString() === formattedMsg.id);
                return {
                  ...c,
                  lastMessage: formattedMsg.text || 'Message',
                  lastMessageTime: formattedMsg.time,
                  messages: exists ? msgs : [...msgs, formattedMsg],
                };
              }
              return c;
            });
          }
          return sortChatsByRecent(updatedChats);
        });

        if (handleIncomingMessageRef.current) {
          try { handleIncomingMessageRef.current(msg); } catch (e) { console.log('Error handling incoming msg:', e); }
        }

        try {
          fetchMessages();
        } catch (e) { }

        // If user is currently viewing active chat conversation with sender, emit mark_seen back immediately
        if (isCurrentlyViewingChat) {
          if (socketRef.current && socketRef.current.connected && currentUser) {
            const currentId = (currentUser.id || currentUser._id)?.toString();
            socketRef.current.emit('mark_seen', {
              senderId: senderIdStr,
              receiverId: currentId,
            });
          }
        } else {
          // If user is not currently in active chat, increment instant bottom tab chat badge & show pop-up banner notification
          setUnreadChatPushCount((prev) => prev + 1);
          const senderDisplayName = msg.senderName || 'Someone';
          let bodyText = msg.text || ' Sent a message';
          if (msg.messageType === 'image') bodyText = ' Sent a photo';
          else if (msg.messageType === 'video') bodyText = ' Sent a video';
          else if (msg.messageType === 'voice') bodyText = ' Sent a voice message';
          else if (msg.messageType === 'sticker') bodyText = ' Sent a sticker';
          else if (msg.messageType === 'document') bodyText = 'Sent a document';

          if (typeof displayLocalSystemNotification === 'function') {
            displayLocalSystemNotification({
              title: `💬 ${senderDisplayName}`,
              body: bodyText,
              data: {
                type: 'chat',
                senderId: senderIdStr,
                messageId: formattedMsg.id,
              },
            }).catch((e) => console.log('Instant message notification display note:', e));
          }
        }
      });

      socketRef.current.on('new_match', (data) => {
        console.log('Socket.IO received new_match event:', data);
        try { if (typeof refetchMatchesList === 'function') refetchMatchesList(); } catch (e) { }
        try { if (typeof refetchLikes === 'function') refetchLikes(); } catch (e) { }
        if (data?.matchedUser) {
          setMatchedUser(data.matchedUser);
          setShowMatchPopup(true);
        }
        if (data?.title && data?.body) {
          if (typeof displayLocalSystemNotification === 'function') {
            displayLocalSystemNotification({
              title: data.title,
              body: data.body,
              data: { type: 'match', userId: data.matchedUser?.id || data.matchedUser?._id },
            }).catch(() => { });
          }
        }
      });

      socketRef.current.on('new_like', (data) => {
        console.log('Socket.IO received new_like event:', data);
        try { if (typeof refetchLikes === 'function') refetchLikes(); } catch (e) { }
        try { if (typeof fetchUnreadLikesCount === 'function') fetchUnreadLikesCount(); } catch (e) { }
        setUnreadLikesCount((prev) => prev + 1);
        if (data?.title && data?.body) {
          if (typeof displayLocalSystemNotification === 'function') {
            displayLocalSystemNotification({
              title: data.title,
              body: data.body,
              data: { type: 'like', userId: data.likerUser?.id || data.likerUser?._id },
            }).catch(() => { });
          }
        }
      });

      socketRef.current.on('account_deactivated', async (data) => {
        console.warn('⚠️ [SOCKET] Account deactivated event received:', data);
        let reason = data?.reason || data?.message;
        if (!reason || reason === 'Account deactivated by admin moderation team') {
          try {
            let email = currentUser?.email || userProfile?.email;
            let userId = currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id;
            if (!email) {
              try { email = await AsyncStorage.getItem('persistent_user_email'); } catch (e) { }
            }
            if (!userId) {
              try { userId = await AsyncStorage.getItem('persistent_user_id'); } catch (e) { }
            }
            const statusRes = await apiClient.checkAccountStatus({ email, userId });
            if (statusRes?.reason) {
              reason = statusRes.reason;
            }
          } catch (e) { }
        }
        handleAccountDeactivatedAlert(reason);
      });

      socketRef.current.on('account_status_changed', async (data) => {
        console.warn('⚠️ [SOCKET] Account status changed event received:', data);
        if (data && (data.isActive === false || data.status === 'deactivated' || data.isDeactivated === true)) {
          let reason = data?.reason;
          if (!reason) {
            try {
              let email = currentUser?.email || userProfile?.email;
              let userId = currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id;
              if (!email) {
                try { email = await AsyncStorage.getItem('persistent_user_email'); } catch (e) { }
              }
              if (!userId) {
                try { userId = await AsyncStorage.getItem('persistent_user_id'); } catch (e) { }
              }
              const statusRes = await apiClient.checkAccountStatus({ email, userId });
              if (statusRes?.reason) reason = statusRes.reason;
            } catch (e) { }
          }
          handleAccountDeactivatedAlert(reason);
        }
      });



      socketRef.current.on('message_edited', ({ messageId, text, isEdited, senderId, receiverId }) => {
        console.log('Socket.IO message edited:', messageId, text);
        setChats((prevChats) =>
          prevChats.map((c) => {
            if (c.id === senderId || c.id === receiverId) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? { ...m, text, isEdited: isEdited || true } : m
                ),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (prevActive && (prevActive.id === senderId || prevActive.id === receiverId)) {
            return {
              ...prevActive,
              messages: prevActive.messages.map((m) =>
                m.id === messageId ? { ...m, text, isEdited: isEdited || true } : m
              ),
            };
          }
          return prevActive;
        });
        refetchChatMessages();
      });

      socketRef.current.on('message_reaction_updated', ({ messageId, tempId, reactions, senderId, receiverId }) => {
        console.log('Socket.IO message_reaction_updated received:', messageId, tempId, reactions);
        const rIdStr = receiverId?.toString();
        const sIdStr = senderId?.toString();
        const targetIdStr = messageId?.toString();
        const targetTempStr = tempId?.toString();

        const updateReactions = (m) => {
          const mIdStr = (m.id || m._id)?.toString();
          const mTempStr = m.tempId?.toString();
          if (
            (targetIdStr && (mIdStr === targetIdStr || mTempStr === targetIdStr)) ||
            (targetTempStr && (mIdStr === targetTempStr || mTempStr === targetTempStr))
          ) {
            return { ...m, reactions: Array.isArray(reactions) ? reactions : [] };
          }
          return m;
        };

        setChats((prevChats) =>
          prevChats.map((c) => {
            const hasMsg = (c.messages || []).some(
              (m) => (m.id && (String(m.id) === targetIdStr || String(m.id) === targetTempStr)) ||
                (m.tempId && (String(m.tempId) === targetIdStr || String(m.tempId) === targetTempStr))
            );
            const cIdStr = (c.id || c._id || c.userId)?.toString();
            if (hasMsg || !rIdStr || cIdStr === rIdStr || cIdStr === sIdStr) {
              return {
                ...c,
                messages: (c.messages || []).map(updateReactions),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          return {
            ...prevActive,
            messages: (prevActive.messages || []).map(updateReactions),
          };
        });
        dispatch(updateMessageReactions({ messageId: targetIdStr, tempId: targetTempStr, reactions }));
      });

      socketRef.current.on('message_pinned_updated', ({ messageId, tempId, isPinned, text, senderId, receiverId }) => {
        console.log('Socket.IO message_pinned_updated received:', messageId, isPinned);
        const rIdStr = receiverId?.toString();
        const sIdStr = senderId?.toString();
        const targetIdStr = messageId?.toString();
        const targetTempStr = tempId?.toString();

        if (targetIdStr) {
          recentPinActionRef.current[targetIdStr] = {
            isPinned: !!isPinned,
            timestamp: Date.now(),
          };
        }
        if (targetTempStr) {
          recentPinActionRef.current[targetTempStr] = {
            isPinned: !!isPinned,
            timestamp: Date.now(),
          };
        }

        const updatePin = (m) => {
          const mIdStr = (m.id || m._id)?.toString();
          const mTempStr = m.tempId?.toString();
          if (
            (targetIdStr && (mIdStr === targetIdStr || mTempStr === targetIdStr)) ||
            (targetTempStr && (mIdStr === targetTempStr || mTempStr === targetTempStr))
          ) {
            return { ...m, isPinned: !!isPinned };
          }
          if (isPinned) {
            return { ...m, isPinned: false };
          }
          return m;
        };

        setChats((prevChats) =>
          prevChats.map((c) => {
            const hasMsg = (c.messages || []).some(
              (m) => (m.id && (String(m.id) === targetIdStr || String(m.id) === targetTempStr)) ||
                (m.tempId && (String(m.tempId) === targetIdStr || String(m.tempId) === targetTempStr))
            );
            const cIdStr = (c.id || c._id || c.userId)?.toString();
            if (hasMsg || !rIdStr || cIdStr === rIdStr || cIdStr === sIdStr) {
              return {
                ...c,
                messages: enforceSinglePin((c.messages || []).map(updatePin)),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          return {
            ...prevActive,
            messages: enforceSinglePin((prevActive.messages || []).map(updatePin)),
          };
        });
        dispatch(updateMessagePinned({ messageId: targetIdStr, tempId: targetTempStr, isPinned: !!isPinned }));
      });

      socketRef.current.on('message_star_updated', ({ messageId, tempId, isStarred, senderId, receiverId, userId, starredBy, mediaUrl, messageType, fileName, fileSize }) => {
        console.log('Socket.IO message_star_updated received:', messageId, isStarred);
        const actionUserId = (userId || senderId)?.toString();
        const myUserId = (currentId || currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();

        // In WhatsApp, starring is strictly private to the user who starred the message.
        // If this star event was initiated by another user, ignore it so it never alters our chat screen!
        if (actionUserId && myUserId && actionUserId !== myUserId) {
          console.log('Ignoring message_star_updated for another user:', actionUserId, 'current:', myUserId);
          return;
        }

        const rIdStr = receiverId?.toString();
        const sIdStr = senderId?.toString();
        const targetIdStr = messageId?.toString();
        const targetTempStr = tempId?.toString();

        if (targetIdStr) {
          recentStarActionRef.current[targetIdStr] = {
            isStarred: !!isStarred,
            timestamp: Date.now(),
          };
        }
        if (targetTempStr) {
          recentStarActionRef.current[targetTempStr] = {
            isStarred: !!isStarred,
            timestamp: Date.now(),
          };
        }

        const updateStar = (m) => {
          const mIdStr = (m.id || m._id)?.toString();
          const mTempStr = m.tempId?.toString();
          if (
            (targetIdStr && (mIdStr === targetIdStr || mTempStr === targetIdStr)) ||
            (targetTempStr && (mIdStr === targetTempStr || mTempStr === targetTempStr))
          ) {
            let nextStarredBy = Array.isArray(starredBy)
              ? [...starredBy]
              : (Array.isArray(m.starredBy) ? [...m.starredBy] : []);
            if (myUserId && !Array.isArray(starredBy)) {
              if (isStarred) {
                if (!nextStarredBy.some(id => (id?._id || id)?.toString() === myUserId)) {
                  nextStarredBy.push(myUserId);
                }
              } else {
                nextStarredBy = nextStarredBy.filter(id => (id?._id || id)?.toString() !== myUserId);
              }
            }
            return {
              ...m,
              isStarred: !!isStarred,
              starredBy: nextStarredBy,
              mediaUrl: m.mediaUrl || mediaUrl,
              messageType: (m.messageType && m.messageType !== 'text')
                ? m.messageType
                : (messageType || (m.mediaUrl || mediaUrl ? 'image' : 'text')),
              fileName: m.fileName || fileName,
              fileSize: m.fileSize || fileSize,
            };
          }
          return m;
        };

        setChats((prevChats) =>
          prevChats.map((c) => {
            const hasMsg = (c.messages || []).some(
              (m) => (m.id && (String(m.id) === targetIdStr || String(m.id) === targetTempStr)) ||
                (m.tempId && (String(m.tempId) === targetIdStr || String(m.tempId) === targetTempStr))
            );
            const cIdStr = (c.id || c._id || c.userId)?.toString();
            if (hasMsg || !rIdStr || cIdStr === rIdStr || cIdStr === sIdStr) {
              return {
                ...c,
                messages: (c.messages || []).map(updateStar),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          return {
            ...prevActive,
            messages: (prevActive.messages || []).map(updateStar),
          };
        });
        dispatch(updateMessageStarred({
          messageId: targetIdStr,
          tempId: targetTempStr,
          isStarred: !!isStarred,
          currentUserId: myUserId,
          starredBy,
          mediaUrl,
          messageType,
          fileName,
          fileSize,
        }));
      });

      socketRef.current.on('message_deleted', ({ messageId, tempId, deleteType, text, senderId, receiverId, deletedForEveryone }) => {
        console.log('Socket.IO message deleted:', messageId, deleteType, deletedForEveryone);
        if (!messageId) return;
        const msgIdStr = messageId.toString();
        const isEveryone = deleteType === 'everyone' || deletedForEveryone === true;
        const rIdStr = receiverId?.toString();
        const sIdStr = senderId?.toString();

        if (isEveryone) {
          deletedMessageIdsRef.current.add(msgIdStr);
          if (tempId) deletedMessageIdsRef.current.add(tempId.toString());
        }

        const matchMsg = (m) => {
          if (!m) return false;
          const mId = (m.id || m._id)?.toString();
          const mTemp = m.tempId?.toString();
          return mId === msgIdStr || mTemp === msgIdStr || (tempId && (mId === tempId.toString() || mTemp === tempId.toString()));
        };

        if (isEveryone) {
          const updateDel = (m) =>
            matchMsg(m)
              ? {
                ...m,
                text: text || 'This message was deleted',
                mediaUrl: null,
                fileName: null,
                fileSize: null,
                reactions: [],
                isDeletedForEveryone: true,
              }
              : m;

          setChats((prevChats) =>
            (prevChats || []).map((c) => {
              const cIdStr = (c.id || c._id || c.userId)?.toString();
              if (!rIdStr || cIdStr === rIdStr || cIdStr === sIdStr) {
                return {
                  ...c,
                  messages: (c.messages || []).map(updateDel),
                };
              }
              return c;
            })
          );
          setActiveChat((prevActive) => {
            if (!prevActive) return prevActive;
            const activeIdStr = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
            if (!rIdStr || activeIdStr === rIdStr || activeIdStr === sIdStr) {
              return {
                ...prevActive,
                messages: (prevActive.messages || []).map(updateDel),
              };
            }
            return prevActive;
          });
          dispatch(deleteForEveryoneInState(msgIdStr));
        } else {
          setChats((prevChats) =>
            (prevChats || []).map((c) => {
              const cIdStr = (c.id || c._id || c.userId)?.toString();
              if (!rIdStr || cIdStr === rIdStr || cIdStr === sIdStr) {
                return {
                  ...c,
                  messages: (c.messages || []).filter((m) => !matchMsg(m)),
                };
              }
              return c;
            })
          );
          setActiveChat((prevActive) => {
            if (!prevActive) return prevActive;
            const activeIdStr = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
            if (!rIdStr || activeIdStr === rIdStr || activeIdStr === sIdStr) {
              return {
                ...prevActive,
                messages: (prevActive.messages || []).filter((m) => !matchMsg(m)),
              };
            }
            return prevActive;
          });
          dispatch(deleteForMeInState(msgIdStr));
        }
      });

      socketRef.current.on('user_typing', ({ senderId }) => {
        console.log('🟢 Socket.IO user_typing received for senderId:', senderId);
        if (!senderId) return;
        const senderStr = senderId.toString();
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          const partnerIdStr = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
          if (partnerIdStr === senderStr) {
            setIsTyping(true);
          }
          return prevActive;
        });
      });

      socketRef.current.on('user_stop_typing', ({ senderId }) => {
        console.log('🔴 Socket.IO user_stop_typing received for senderId:', senderId);
        if (!senderId) return;
        const senderStr = senderId.toString();
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          const partnerIdStr = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
          if (partnerIdStr === senderStr) {
            setIsTyping(false);
          }
          return prevActive;
        });
      });

      socketRef.current.on('session_terminated', async (data) => {
        console.log('🔴 [FRONTEND SOCKET] session_terminated event received:', data);
        if (typeof getIsManualLogoutInProgress === 'function' && getIsManualLogoutInProgress()) {
          console.log('[FRONTEND SOCKET] Manual logout in progress, suppressing session_terminated popup.');
          return;
        }

        // Query GET /api/profile/account-status first to verify if this is an admin deactivation
        let email = currentUser?.email || userProfile?.email;
        let userId = currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id;
        if (!email) {
          try { email = await AsyncStorage.getItem('persistent_user_email'); } catch (e) { }
        }
        if (!userId) {
          try { userId = await AsyncStorage.getItem('persistent_user_id'); } catch (e) { }
        }
        let statusRes = null;
        try {
          statusRes = await apiClient.checkAccountStatus({ email, userId });
        } catch (e) { }

        const isDeactMsg =
          data?.status === 'deactivated' ||
          data?.code === 'ACCOUNT_DEACTIVATED' ||
          data?.isDeactivated === true ||
          (typeof data?.message === 'string' && data.message.toLowerCase().includes('deactivated')) ||
          Boolean(data?.reason);

        if (statusRes?.status === 'deactivated' || statusRes?.isDeactivated || statusRes?.isActive === false || isDeactMsg) {
          const reasonText = statusRes?.reason || data?.reason || 'Account deactivated by admin moderation team';
          handleAccountDeactivatedAlert(reasonText);
          return;
        }

        if (getIsDeactivationAlertShowing()) return;
        setIsDeactivationAlertShowing(true);
        const msg = data?.message || 'Your session has been terminated because your account was accessed on another device or logged out from all devices.';
        Alert.alert(
          'Session Terminated ⚠️',
          msg,
          [
            {
              text: 'OK',
              onPress: async () => {
                console.log('🔴 [SESSION TERMINATED] User acknowledged alert. Disconnecting socket, logging out, and redirecting to LOGIN...');
                try {
                  if (socketRef.current) {
                    try {
                      socketRef.current.emit('going_offline', currentId);
                    } catch (e) { }
                    socketRef.current.disconnect();
                  }
                  await AsyncStorage.removeItem('token');
                  await AsyncStorage.removeItem('user');
                  setAuthToken(null);
                } catch (e) {
                  console.log('Error clearing session storage:', e);
                }

                // 1. Dispatch Redux logout action
                dispatch(logout());

                // 2. Invoke parent onLogout handler
                if (typeof onLogoutRef.current === 'function') {
                  try {
                    onLogoutRef.current(null, true);
                  } catch (e) {
                    console.log('Error calling onLogout:', e);
                  }
                }

                // 3. Immediately transition navigation to LOGIN screen
                if (typeof onNavigateRef.current === 'function') {
                  try {
                    onNavigateRef.current('LOGIN');
                  } catch (e) {
                    console.log('Error calling onNavigate:', e);
                  }
                }

                setTimeout(() => {
                  setIsDeactivationAlertShowing(false);
                }, 1500);
              },
            },
          ],
          { cancelable: false }
        );
      });

      const handleBlockedByOtherSocket = (data) => {
        const blockerId = data?.blockerId || data?.blockedBy;
        const targetUserId = data?.targetUserId;
        const currentUserId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();

        if (targetUserId && currentUserId && targetUserId.toString() !== currentUserId) {
          return;
        }

        if (blockerId) {
          const bIdStr = blockerId.toString();
          console.log('Socket.IO user_blocked_by_other received for blocker:', bIdStr);

          // 1. Add to blockedByOtherList
          setBlockedByOtherList((prev) => Array.from(new Set([...(prev || []).map((id) => id.toString()), bIdStr])));

          // 2. Update activeChat if currently chatting with the blocker
          setActiveChat((prevActive) => {
            if (!prevActive) return prevActive;
            const pId = (prevActive.id || prevActive._id || prevActive.userId || prevActive.senderId || prevActive.sender)?.toString();
            if (pId === bIdStr) {
              return {
                ...prevActive,
                isBlockedByOther: true,
                name: 'Matched User',
                image: null,
                profileImage: null,
              };
            }
            return prevActive;
          });

          // 3. Immediately close expanded profile modal if currently viewing blocker's profile!
          setSelectedLikesProfile((prev) => {
            if (!prev) return prev;
            const pId = (prev.id || prev._id || prev.userId)?.toString();
            if (pId === bIdStr) {
              if (Platform.OS === 'android') {
                ToastAndroid.show('This profile is unavailable.', ToastAndroid.SHORT);
              }
              return null;
            }
            return prev;
          });

          // 4. Update chats list
          setChats((prevChats) =>
            (prevChats || []).map((c) => {
              const cId = (c.id || c._id || c.userId)?.toString();
              if (cId === bIdStr) {
                return {
                  ...c,
                  isBlockedByOther: true,
                  name: 'Matched User',
                  image: null,
                };
              }
              return c;
            })
          );
        }
      };

      const handleUnblockedByOtherSocket = (data) => {
        const blockerId = data?.blockerId || data?.unblockedBy;
        const targetUserId = data?.targetUserId;
        const currentUserId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();

        if (targetUserId && currentUserId && targetUserId.toString() !== currentUserId) {
          return;
        }

        if (blockerId) {
          const bIdStr = blockerId.toString();
          console.log('Socket.IO user_unblocked_by_other received for blocker:', bIdStr);
          setBlockedByOtherList((prev) => (prev || []).filter((id) => id.toString() !== bIdStr));

          setActiveChat((prevActive) => {
            if (!prevActive) return prevActive;
            const pId = (prevActive.id || prevActive._id || prevActive.userId || prevActive.senderId || prevActive.sender)?.toString();
            if (pId === bIdStr) {
              return {
                ...prevActive,
                isBlockedByOther: false,
              };
            }
            return prevActive;
          });

          fetchBlockedUsers();
          fetchMatchesList();
          fetchChatMessages();
        }
      };

      socketRef.current.on('user_blocked_by_other', handleBlockedByOtherSocket);
      socketRef.current.on('user_blocked', handleBlockedByOtherSocket);
      socketRef.current.on('user_unblocked_by_other', handleUnblockedByOtherSocket);
      socketRef.current.on('user_unblocked', handleUnblockedByOtherSocket);

      socketRef.current.on('unmatched', ({ unmatchedBy }) => {
        console.log('Socket.IO unmatched event received:', unmatchedBy);

        // Close the active chat if it's with the user who unmatched us
        setActiveChat((prevActive) => {
          if (prevActive && prevActive.id.toString() === unmatchedBy.toString()) {
            Alert.alert('Conversation Ended', 'The other user has unmatched this profile.');
            return null;
          }
          return prevActive;
        });

        // Remove from local states
        setChats((prevChats) => prevChats.filter((c) => c.id.toString() !== unmatchedBy.toString()));
        setMatchedUserIds((prevIds) => prevIds.filter((id) => id.toString() !== unmatchedBy.toString()));

        // Refetch matches & messages lists
        refetchMatchesList();
        refetchMessages();
      });

      socketRef.current.on('incoming_call', ({ callerId, callerName, callerImage, offer }) => {
        console.log('Socket.IO incoming_call received from:', callerId);
        if (callStateRef.current !== 'idle') {
          if (socketRef.current) {
            socketRef.current.emit('reject_call', { callerId, receiverId: currentId });
          }
          return;
        }

        // Start playing incoming ringtone & vibration for Recipient (User B)
        soundService.playIncomingRingtone();

        setCallSession({
          id: callerId,
          name: callerName,
          image: callerImage,
          isCaller: false,
          incomingOffer: offer,
        });
        setCallState('incoming');
      });

      socketRef.current.on('call_accepted', async ({ receiverId, answer }) => {
        console.log('Socket.IO call_accepted received from:', receiverId);

        // Stop caller's outgoing ringback tone immediately when recipient answers
        soundService.stopAllRingtones();

        if (peerConnectionRef.current) {
          try {
            const answerDesc = typeof RTCSessionDescription === 'function' && answer
              ? new RTCSessionDescription(answer)
              : answer;
            await peerConnectionRef.current.setRemoteDescription(answerDesc);
            setCallState('connected');
            startCallTimer();
          } catch (e) {
            console.log('Error setting remote description answer:', e);
            endVoiceCall();
          }
        }
      });

      socketRef.current.on('call_rejected', ({ receiverId }) => {
        console.log('Socket.IO call_rejected received from:', receiverId);
        soundService.playCallEndedTone();
        Alert.alert('Call Declined', 'The user declined your voice call.');
        cleanUpWebRTCSession();
        setCallState('idle');
        setCallSession(null);
      });

      socketRef.current.on('call_ringing', ({ status }) => {
        console.log('Socket.IO call_ringing received:', status);
        soundService.playOutgoingRingback();
        setCallStatusText('Ringing...');
      });

      socketRef.current.on('call_ended', ({ by }) => {
        console.log('Socket.IO call_ended received, ended by:', by);
        soundService.stopAllRingtones();
        cleanUpWebRTCSession();
        setCallState('idle');
        setCallSession(null);
      });

      socketRef.current.on('user_warning', (warnData) => {
        console.log('[Socket] Live user_warning received:', warnData);
        if (warnData) {
          setActiveWarningData(warnData);
          setShowAdminWarningModal(true);
        }
      });

      socketRef.current.on('webrtc_ice_candidate', async ({ senderId, candidate }) => {
        console.log('Socket.IO ice candidate received from:', senderId);
        if (peerConnectionRef.current && candidate) {
          try {
            const candidateObj = typeof RTCIceCandidate === 'function'
              ? new RTCIceCandidate(candidate)
              : candidate;
            await peerConnectionRef.current.addIceCandidate(candidateObj);
          } catch (e) {
            console.log('Error adding ICE candidate:', e);
          }
        }
      });

      socketRef.current.on('call_offline', ({ message }) => {
        console.log('Socket.IO call_offline received:', message);
        soundService.stopAllRingtones();
        Alert.alert('User Offline', message || 'User is offline. A missed call notification has been sent.');
        cleanUpWebRTCSession();
        setCallState('idle');
        setCallSession(null);
      });

      socketRef.current.on('call_failed', ({ message }) => {
        console.log('Socket.IO call_failed received:', message);
        soundService.stopAllRingtones();
        Alert.alert('Call Failed', message || 'Could not connect the call.');
        cleanUpWebRTCSession();
        setCallState('idle');
        setCallSession(null);
      });

      const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        console.log('[HomeScreen AppState] State changed to:', nextAppState);
        if (nextAppState === 'active') {
          syncSubscriptionStatus().catch(() => { });
          if (socketRef.current) {
            if (!socketRef.current.connected) {
              socketRef.current.connect();
            } else {
              socketRef.current.emit('ping_presence', currentId);
            }
          }
        } else if (nextAppState === 'background' || nextAppState === 'inactive') {
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('going_offline', currentId);
          }
        }
      });

      // Send continuous presence ping every 30 seconds while user is active in app
      const presencePingInterval = setInterval(() => {
        if (socketRef.current && socketRef.current.connected && currentId) {
          socketRef.current.emit('ping_presence', currentId);
        }
      }, 30000);

      return () => {
        clearInterval(presencePingInterval);
        appStateSubscription.remove();
        if (socketRef.current) {
          try {
            socketRef.current.emit('going_offline', currentId);
          } catch (e) { }
          socketRef.current.disconnect();
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, resolvedSocketUrl]);

  // Emit mark_seen & check_online_status & mark notifications read when activeChat changes / opens
  useEffect(() => {
    let intervalId;
    if (activeChat && currentUser) {
      const partnerId = (activeChat.id || activeChat._id || activeChat.userId || activeChat.senderId || activeChat.sender)?.toString();
      const currentId = (currentUser.id || currentUser._id)?.toString();

      if (partnerId && activeChat.isOnline !== undefined) {
        setOnlineUsersMap((prev) => {
          if (prev[partnerId] !== undefined) return prev;
          return {
            ...prev,
            [partnerId]: !!activeChat.isOnline,
          };
        });
      }

      if (partnerId && (activeChat.lastSeen || activeChat.user?.lastSeen)) {
        setLastSeenMap((prev) => {
          if (prev[partnerId]) return prev;
          return {
            ...prev,
            [partnerId]: activeChat.lastSeen || activeChat.user?.lastSeen,
          };
        });
      }

      const checkStatus = () => {
        if (socketRef.current && socketRef.current.connected) {
          if (partnerId) socketRef.current.emit('check_online_status', { targetUserId: partnerId, viewerUserId: currentId });
          if (currentId) socketRef.current.emit('ping_presence', currentId);
        }
      };

      checkStatus();

      if (socketRef.current && partnerId && socketRef.current.connected && currentId) {
        socketRef.current.emit('mark_seen', {
          senderId: partnerId,
          receiverId: currentId,
        });
      }

      if (partnerId && typeof apiClient.getChatMessages === 'function') {
        apiClient.getChatMessages(partnerId).catch(() => { });
      }

      // Periodically refresh partner's online status every 12 seconds while chatting
      intervalId = setInterval(checkStatus, 12000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeChat?.id, currentUser?.id || currentUser?._id]);

  // AppState change listener & global presence ping: reconnect socket & re-emit join on foreground, going_offline on background
  useEffect(() => {
    const currentId = (currentUser?.id || currentUser?._id)?.toString();

    if (currentId) {
      registerFcmToken().catch((e) => console.log('[HomeScreen] FCM token registration error:', e));
    }

    let pingInterval;
    if (currentId) {
      // Send initial presence update on mount/login
      const evaluateAndEmitPresence = async () => {
        const netState = await NetInfo.fetch().catch(() => ({ isConnected: true, isInternetReachable: true }));
        const cond1_loggedIn = !!currentId;
        const cond2_appActive = AppState.currentState === 'active';
        const cond3_networkOn = !!(netState.isConnected && netState.isInternetReachable !== false);
        const finalOnlineStatus = cond1_loggedIn && cond2_appActive && cond3_networkOn;

        console.log('🟢 [ONLINE STATUS CHECK]', {
          Condition1_LoggedIn: cond1_loggedIn,
          Condition2_AppActive: cond2_appActive,
          Condition3_NetworkOn: cond3_networkOn,
          FINAL_STATUS: finalOnlineStatus ? 'Online 🟢' : 'Offline 🔴'
        });

        if (finalOnlineStatus) {
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('ping_presence', currentId);
          }
          try { apiClient.updatePresence({ isOnline: true }).catch(() => { }); } catch (e) { }
        } else {
          try { apiClient.updatePresence({ isOnline: false }).catch(() => { }); } catch (e) { }
        }
      };

      evaluateAndEmitPresence();

      pingInterval = setInterval(() => {
        evaluateAndEmitPresence();
      }, 40000);
    }

    const handleAppStateChange = async (nextAppState) => {
      const netState = await NetInfo.fetch().catch(() => ({ isConnected: true, isInternetReachable: true }));
      const cond1_loggedIn = !!currentId;
      const cond2_appActive = nextAppState === 'active';
      const cond3_networkOn = !!(netState.isConnected && netState.isInternetReachable !== false);
      const finalOnlineStatus = cond1_loggedIn && cond2_appActive && cond3_networkOn;

      console.log('🟢 [AppState Change - ONLINE STATUS CHECK]', {
        nextAppState,
        Condition1_LoggedIn: cond1_loggedIn,
        Condition2_AppActive: cond2_appActive,
        Condition3_NetworkOn: cond3_networkOn,
        FINAL_STATUS: finalOnlineStatus ? 'Online 🟢' : 'Offline 🔴'
      });

      if (finalOnlineStatus) {
        // Instantly refresh badge counts on app active
        try { fetchUnreadLikesCount(); } catch (e) { }
        try { fetchLikes(); } catch (e) { }
        try { fetchMessages(); } catch (e) { }
        try { fetchMatchesList(); } catch (e) { }
        try { checkActiveWarning(); } catch (e) { }

        try { apiClient.updatePresence({ isOnline: true }).catch(() => { }); } catch (e) { }

        if (socketRef.current) {
          if (!socketRef.current.connected) {
            console.log('[AppState] Socket disconnected. Reconnecting...');
            socketRef.current.connect();
          } else {
            console.log('[AppState] App in foreground & online. Re-emitting join and ping_presence for user:', currentId);
            socketRef.current.emit('join', currentId);
            socketRef.current.emit('ping_presence', currentId);
          }
        }
        if (activeChat && socketRef.current) {
          const partnerId = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
          if (partnerId && socketRef.current.connected) {
            socketRef.current.emit('check_online_status', { targetUserId: partnerId, viewerUserId: currentId });
          }
        }
      } else if ((nextAppState === 'background' || nextAppState === 'inactive') && currentId) {
        console.log('[AppState] App in background/inactive/locked screen. Updating presence API to offline...');
        try { apiClient.updatePresence({ isOnline: false }).catch(() => { }); } catch (e) { }
        if (socketRef.current) {
          console.log('[AppState] Emitting going_offline for user:', currentId);
          try { socketRef.current.emit('going_offline', currentId); } catch (e) { }
          setTimeout(() => {
            try {
              if (socketRef.current && AppState.currentState !== 'active') {
                socketRef.current.disconnect();
              }
            } catch (e) { }
          }, 300);
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (appStateSubscription && typeof appStateSubscription.remove === 'function') {
        appStateSubscription.remove();
      }
    };
  }, [currentUserId]);

  // NetInfo network & Wi-Fi connectivity listener for strict online/offline status
  useEffect(() => {
    const currentId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const cond1_loggedIn = !!currentId;
      const cond2_appActive = AppState.currentState === 'active';
      const cond3_networkOn = !!(state.isConnected && state.isInternetReachable !== false);
      const finalOnlineStatus = cond1_loggedIn && cond2_appActive && cond3_networkOn;

      console.log('🟢 [NetInfo Change - ONLINE STATUS CHECK]', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        Condition1_LoggedIn: cond1_loggedIn,
        Condition2_AppActive: cond2_appActive,
        Condition3_NetworkOn: cond3_networkOn,
        FINAL_STATUS: finalOnlineStatus ? 'Online 🟢' : 'Offline 🔴'
      });

      if (!finalOnlineStatus) {
        console.log('[NetInfo] Conditions not met (network/Wi-Fi off or inactive). Calling offline presence API and disconnecting socket...');
        try { apiClient.updatePresence({ isOnline: false }).catch(() => { }); } catch (e) { }
        if (socketRef.current) {
          try { if (currentId) socketRef.current.emit('going_offline', currentId); } catch (e) { }
          try { socketRef.current.disconnect(); } catch (e) { }
        }
      } else {
        console.log('[NetInfo] All 3 conditions met (Network + App Active + Logged In). Calling online presence API & reconnecting socket.');
        try { apiClient.updatePresence({ isOnline: true }).catch(() => { }); } catch (e) { }

        // Attempt REST API flush for any pending offline queue items
        const currentQueue = offlineQueueRef.current || [];
        if (currentQueue && currentQueue.length > 0) {
          console.log(`🌐 [NetInfo] Online detected! Flushing ${currentQueue.length} pending offline messages via REST API fallback...`);
          currentQueue.forEach((item) => {
            if (item && item.payload) {
              apiClient.sendMessage(item.payload).then((res) => {
                const sMsg = res?.data || res;
                if (sMsg?._id || sMsg?.id) {
                  handleServerConfirmation(sMsg);
                }
              }).catch((e) => { });
            }
          });
        }

        if (socketRef.current) {
          if (!socketRef.current.connected) {
            console.log('[NetInfo] Reconnecting socket for active user:', currentId);
            socketRef.current.connect();
          } else {
            socketRef.current.emit('join', currentId);
            socketRef.current.emit('ping_presence', currentId);
          }
        }
      }
    });

    return () => {
      if (typeof unsubscribeNetInfo === 'function') unsubscribeNetInfo();
    };
  }, [currentUserId, resolvedSocketUrl]);

  // Real-time Push Notification Listener for instant bottom tab badge updates
  useEffect(() => {
    let unsubscribeFcm;
    if (typeof setupNotificationListeners === 'function') {
      unsubscribeFcm = setupNotificationListeners(
        (data) => {
          // On notification clicked/tapped
          const rawType = (data?.type || '').toLowerCase();
          if (rawType === 'like' || rawType === 'superlike') {
            setActiveTab('likes');
          } else if (rawType === 'chat' || rawType === 'message' || rawType === 'match') {
            setActiveTab('chat');
          }
        },
        (data, remoteMessage) => {
          console.log('[HomeScreen] Real-time Push Notification received:', data, remoteMessage);
          const rawType = (data?.type || '').toLowerCase();
          const titleText = (remoteMessage?.notification?.title || data?.title || '').toLowerCase();
          const bodyText = (remoteMessage?.notification?.body || data?.body || '').toLowerCase();

          const isLikeNotif = rawType === 'like' || rawType === 'superlike' || titleText.includes('like') || bodyText.includes('like');
          const isChatNotif = rawType === 'chat' || rawType === 'message' || rawType === 'match' || titleText.includes('message') || titleText.includes('chat') || bodyText.includes('message') || bodyText.includes('chat') || !!(data?.senderId || data?.userId);

          if (isLikeNotif) {
            console.log('[HomeScreen] Real-time Push Notification: Updating Likes tab badge count instantly!');
            setUnreadLikesCount((prev) => Math.max(1, prev + 1));
            try { fetchLikes(); } catch (e) { }
            try { fetchUnreadLikesCount(); } catch (e) { }
          }

          if (isChatNotif) {
            console.log('[HomeScreen] Real-time Push Notification: Updating Chat tab badge & active conversation messages instantly!');
            setUnreadChatPushCount((prev) => prev + 1);
            try { fetchMessages(); } catch (e) { }
            try { fetchMatchesList(); } catch (e) { }

            const senderIdStr = (data?.senderId || data?.userId)?.toString();
            const bodyMessageText = remoteMessage?.notification?.body || data?.body || data?.text || 'Sent a message';
            const notificationMsgId = data?.messageId || ('notif-' + Date.now());

            if (senderIdStr) {
              const notifMsgObj = {
                id: notificationMsgId,
                sender: 'them',
                senderId: senderIdStr,
                text: bodyMessageText,
                status: 'delivered',
                createdAt: new Date().toISOString(),
              };

              setChats((prevChats) => {
                if (!Array.isArray(prevChats)) return prevChats;
                const existsInChats = prevChats.some((c) => (c.id || c._id || c.userId)?.toString() === senderIdStr);
                if (!existsInChats) {
                  const newChat = {
                    id: senderIdStr,
                    name: data?.senderName || remoteMessage?.notification?.title || 'Matched User',
                    image: data?.senderImage || null,
                    lastMessage: bodyMessageText,
                    lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    messages: [notifMsgObj],
                  };
                  return [newChat, ...prevChats];
                }
                return prevChats.map((c) => {
                  const chatPartnerId = (c.id || c._id || c.userId)?.toString();
                  if (chatPartnerId === senderIdStr) {
                    const msgs = c.messages || [];
                    const exists = msgs.some((m) => (m.id || m._id)?.toString() === notifMsgObj.id);
                    return {
                      ...c,
                      lastMessage: bodyMessageText,
                      lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      messages: exists ? msgs : [...msgs, notifMsgObj],
                    };
                  }
                  return c;
                });
              });
            }

            try { fetchMessages(); } catch (e) { }
            try { fetchMatchesList(); } catch (e) { }

            const activePartnerId = (activeChatRef.current?.id || activeChatRef.current?._id || activeChatRef.current?.userId)?.toString();
            const targetPartnerId = activePartnerId || senderIdStr;

            if (targetPartnerId) {
              apiClient.getChatMessages(targetPartnerId).then((res) => {
                if (res && Array.isArray(res)) {
                  dispatch(setMessages(res));
                }
              }).catch((e) => console.log('Error refreshing active chat messages on push notification:', e));
            }
          }
        }
      );
    }
    return () => {
      if (typeof unsubscribeFcm === 'function') unsubscribeFcm();
    };
  }, []);

  // Sync database messages with state
  useEffect(() => {
    const activeUser = currentUser || userProfile;
    if (!messagesData || !activeUser) return;

    const currentId = (activeUser.id || activeUser._id)?.toString();
    const otherUsersMap = new Map();

    const initialOnlineMap = {};
    const initialLastSeenMap = {};

    if (questionnairesData?.users) {
      questionnairesData.users.forEach((u) => {
        const uId = (u.id || u._id)?.toString();
        if (uId) {
          otherUsersMap.set(uId, u);
          initialOnlineMap[uId] = !!u.isOnline;
          if (u.lastSeen) initialLastSeenMap[uId] = u.lastSeen;
        }
      });
    }

    if (matches) {
      matches.forEach((u) => {
        const uId = (u.id || u._id)?.toString();
        if (uId) {
          otherUsersMap.set(uId, u);
          initialOnlineMap[uId] = !!u.isOnline;
          if (u.lastSeen) initialLastSeenMap[uId] = u.lastSeen;
        }
      });
    }

    // Overlay conversationPartners (fetched directly from User collection, unaffected by block status)
    // Applied LAST so real names always win over stale match/questionnaire data
    if (conversationPartners && Object.keys(conversationPartners).length > 0) {
      Object.entries(conversationPartners).forEach(([uId, partner]) => {
        if (partner && partner.name) {
          const existing = otherUsersMap.get(uId) || {};
          otherUsersMap.set(uId, {
            ...existing,
            id: uId,
            name: partner.name,
            image: partner.image || existing.image || existing.profileImage,
            isOnline: partner.isOnline !== undefined ? partner.isOnline : existing.isOnline,
            lastSeen: partner.lastSeen || existing.lastSeen,
          });
          if (partner.isOnline !== undefined) initialOnlineMap[uId] = partner.isOnline;
          if (partner.lastSeen) initialLastSeenMap[uId] = partner.lastSeen;
        }
      });
    }

    const blockedUserIdsSet = new Set();
    if (Array.isArray(blockedUsersList)) {
      blockedUsersList.forEach((b) => {
        const uId = (b.id || b._id || b.userId)?.toString();
        if (uId) {
          blockedUserIdsSet.add(uId);
          if (!otherUsersMap.has(uId)) {
            otherUsersMap.set(uId, {
              id: uId,
              name: b.name || b.firstName || 'Blocked User',
              image: b.profileImage || b.image,
              isBlocked: true,
            });
          }
        }
      });
    }

    setOnlineUsersMap((prev) => ({ ...initialOnlineMap, ...prev }));
    setLastSeenMap((prev) => ({ ...initialLastSeenMap, ...prev }));

    const messagesByOtherUser = {};
    messagesData.forEach((msg) => {
      if (!msg) return;
      const sId = (msg.senderId?._id || msg.senderId || msg.sender)?.toString();
      const rId = (msg.receiverId?._id || msg.receiverId || msg.receiver)?.toString();
      const isSentByMe = sId === currentId || msg.sender === 'you';
      const otherId = isSentByMe ? rId : sId;

      if (!otherId || otherId === currentId || otherId === 'you' || otherId === 'them' || otherId === 'undefined' || otherId === 'null') {
        return;
      }

      if (!messagesByOtherUser[otherId]) {
        messagesByOtherUser[otherId] = [];
      }
      const rawId = (msg._id || msg.id)?.toString();
      const rawTempId = (msg.tempId || (rawId && rawId.startsWith('temp-') ? rawId : null))?.toString();
      messagesByOtherUser[otherId].push({
        id: rawId,
        tempId: rawTempId,
        sender: isSentByMe ? 'you' : 'them',
        senderId: isSentByMe ? currentId : sId,
        receiverId: isSentByMe ? otherId : currentId,
        text: msg.text,
        messageType: (msg.messageType && msg.messageType !== 'text') ? msg.messageType : (msg.mediaUrl ? 'image' : (msg.messageType || 'text')),
        mediaUrl: msg.mediaUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        stickerId: msg.stickerId,
        replyTo: parseReplyTo(msg.replyTo),
        reactions: Array.isArray(msg.reactions) ? msg.reactions : [],
        isPinned: msg.isPinned || false,
        starredBy: Array.isArray(msg.starredBy) ? msg.starredBy : [],
        isStarred: Array.isArray(msg.starredBy) && currentId
          ? msg.starredBy.some((id) => (id?._id || id)?.toString() === currentId)
          : Boolean(msg.isStarred),
        isDeletedForEveryone: Boolean(
          msg.isDeletedForEveryone ||
          msg.text === 'This message was deleted' ||
          (rawId && deletedMessageIdsRef.current.has(rawId)) ||
          (rawTempId && deletedMessageIdsRef.current.has(rawTempId))
        ),
        status: msg.status || 'sent',
        createdAt: msg.createdAt,
        isEdited: Boolean(msg.isEdited),
      });
    });

    // Build blockedByOtherSet from both the dedicated blocked list AND the match-level isBlockedByOther flags
    const blockedByOtherSet = new Set(Array.isArray(blockedByOtherList) ? blockedByOtherList.map(id => id.toString()) : []);
    // Augment with per-match isBlockedByOther flags returned by the updated getMatches API
    if (matches) {
      matches.forEach((u) => {
        const uId = (u.id || u._id)?.toString();
        if (uId && u.isBlockedByOther) {
          blockedByOtherSet.add(uId);
        }
      });
    }


    const chatsList = [];
    Object.keys(messagesByOtherUser).forEach((otherId) => {
      const otherUser = otherUsersMap.get(otherId) || { id: otherId, name: 'Matched User', image: null };
      const isBlocked = blockedUserIdsSet.has(otherId) || !!otherUser.isBlocked;
      const isBlockedByOther = blockedByOtherSet.has(otherId);
      // If the other user has blocked ME, hide their real name until they unblock
      const displayName = isBlockedByOther
        ? 'Matched User'
        : (otherUser.name || otherUser.firstName || 'Matched User');

      // Preserve local state messages and merge non-destructively with DB messages
      const existingChatInState = (chats || []).find(
        (c) => (c.id || c._id || c.userId)?.toString() === otherId
      );
      const existingMsgs = (existingChatInState?.messages || []).filter((m) => doesMessageBelongToPartner(m, otherId));

      // Non-destructively merge messages from DB with local state so replyTo and reactions are NEVER wiped out
      const mergedDbMsgs = (messagesByOtherUser[otherId] || []).map((dbMsg) => {
        const existing = existingMsgs.find(
          (p) =>
            (p.id && dbMsg.id && String(p.id) === String(dbMsg.id)) ||
            (p.tempId && (String(p.tempId) === String(dbMsg.id) || (dbMsg.tempId && String(p.tempId) === String(dbMsg.tempId)))) ||
            (dbMsg.tempId && p.id && String(p.id) === String(dbMsg.tempId))
        );
        if (!existing) return dbMsg;
        const isDel = Boolean(
          existing.isDeletedForEveryone ||
          dbMsg.isDeletedForEveryone ||
          existing.text === 'This message was deleted' ||
          dbMsg.text === 'This message was deleted' ||
          (existing.id && deletedMessageIdsRef.current.has(String(existing.id))) ||
          (existing.tempId && deletedMessageIdsRef.current.has(String(existing.tempId))) ||
          (dbMsg.id && deletedMessageIdsRef.current.has(String(dbMsg.id))) ||
          (dbMsg.tempId && deletedMessageIdsRef.current.has(String(dbMsg.tempId)))
        );
        return {
          ...existing,
          ...dbMsg,
          isDeletedForEveryone: isDel,
          text: isDel ? 'This message was deleted' : (dbMsg.text || existing.text),
          messageType: (dbMsg.messageType && dbMsg.messageType !== 'text') ? dbMsg.messageType : (existing.messageType || dbMsg.messageType || (existing.mediaUrl || dbMsg.mediaUrl ? 'image' : 'text')),
          mediaUrl: isDel ? null : (dbMsg.mediaUrl || existing.mediaUrl),
          fileName: isDel ? null : (dbMsg.fileName || existing.fileName),
          fileSize: isDel ? null : (dbMsg.fileSize || existing.fileSize),
          reactions: isDel ? [] : (Array.isArray(dbMsg.reactions)
            ? dbMsg.reactions
            : (Array.isArray(existing.reactions) ? existing.reactions : [])),
          tempId: dbMsg.tempId || existing.tempId || null,
          replyTo: isDel ? null : (parseReplyTo(dbMsg.replyTo) || parseReplyTo(existing.replyTo) || null),
          isPinned: isDel ? false : resolveIsPinned(dbMsg.id, dbMsg.tempId || existing.tempId, dbMsg.isPinned, existing.isPinned),
          starredBy: Array.isArray(dbMsg.starredBy) ? dbMsg.starredBy : (Array.isArray(existing.starredBy) ? existing.starredBy : []),
          isStarred: resolveIsStarred(dbMsg.id, dbMsg.tempId || existing.tempId, dbMsg.isStarred, existing.isStarred, dbMsg.starredBy),
          isEdited: Boolean(dbMsg.isEdited || existing.isEdited),
        };
      });

      // Preserve local optimistic, pending, or recently sent messages that aren't yet in DB array
      const extraLocalMsgs = existingMsgs.filter(
        (m) =>
          m &&
          m.id !== 'match-init' &&
          !mergedDbMsgs.some(
            (f) =>
              (f.id && m.id && String(f.id) === String(m.id)) ||
              (m.tempId && (String(f.id) === String(m.tempId) || (f.tempId && String(f.tempId) === String(m.tempId)))) ||
              (f.tempId && m.id && String(m.id) === String(f.tempId))
          )
      );

      const allMerged = deduplicateMessages(enforceSinglePin([...mergedDbMsgs, ...extraLocalMsgs]));
      allMerged.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

      chatsList.push({
        id: otherId,
        name: displayName,
        image: otherUser.image || otherUser.profileImage,
        lastSeen: otherUser.lastSeen,
        isBlocked: isBlocked,
        isBlockedByOther: isBlockedByOther,
        messages: allMerged,
      });
    });

    // Add matches that have no chat history yet
    matchedUserIds.forEach((mId) => {
      const matchedUserStr = mId.toString();
      if (!messagesByOtherUser[matchedUserStr]) {
        const otherUser = otherUsersMap.get(matchedUserStr) || { id: matchedUserStr, name: 'Matched User', image: null };
        const isBlocked = blockedUserIdsSet.has(matchedUserStr) || !!otherUser.isBlocked;
        const isBlockedByOther = blockedByOtherSet.has(matchedUserStr);
        // If the other user has blocked ME, hide their real name until they unblock
        const displayName = isBlockedByOther
          ? 'Matched User'
          : (otherUser.name || otherUser.firstName || 'Matched User');

        // Preserve any real messages that already exist in local state
        const existingChatInState = (chats || []).find((c) => (c.id || c._id || c.userId)?.toString() === matchedUserStr);
        const existingRealMsgs = (existingChatInState?.messages || []).filter((m) => doesMessageBelongToPartner(m, matchedUserStr));

        chatsList.push({
          id: matchedUserStr,
          name: displayName,
          image: otherUser.image || otherUser.profileImage,
          lastSeen: otherUser.lastSeen,
          isBlocked: isBlocked,
          isBlockedByOther: isBlockedByOther,
          messages: existingRealMsgs.length > 0 ? existingRealMsgs : [
            {
              id: 'match-init',
              sender: 'them',
              text: `It's a Match! Say hi to ${displayName}! 👋`,
            },
          ],
        });
      }
    });

    // Ensure all blocked users remain in chatsList even if no message history exists or match record was removed
    blockedUserIdsSet.forEach((bId) => {
      const alreadyInList = chatsList.some((c) => (c.id || c._id || c.userId)?.toString() === bId);
      if (!alreadyInList) {
        const otherUser = otherUsersMap.get(bId) || { id: bId, name: 'Blocked User', image: null };
        chatsList.push({
          id: bId,
          name: otherUser.name || otherUser.firstName || 'Blocked User',
          image: otherUser.image || otherUser.profileImage,
          lastSeen: otherUser.lastSeen,
          isBlocked: true,
          isBlockedByOther: false,
          messages: [
            {
              id: 'blocked-init',
              sender: 'them',
              text: 'You blocked this person.',
            },
          ],
        });
      }
    });

    setChats(sortChatsByRecent(chatsList));

    // Keep activeChat updated if open
    setActiveChat((prevActiveChat) => {
      if (prevActiveChat) {
        const found = chatsList.find((c) =>
          c.id === prevActiveChat.id ||
          (c.id || c._id || c.userId)?.toString() === (prevActiveChat.id || prevActiveChat._id || prevActiveChat.userId)?.toString()
        );
        if (found) {
          const prevMsgs = prevActiveChat.messages || [];
          const mergedFoundMsgs = (found.messages || []).map((fMsg) => {
            const existing = prevMsgs.find(
              (p) =>
                (p.id && fMsg.id && String(p.id) === String(fMsg.id)) ||
                (p.tempId && (String(p.tempId) === String(fMsg.id) || (fMsg.tempId && String(p.tempId) === String(fMsg.tempId)))) ||
                (fMsg.tempId && p.id && String(p.id) === String(fMsg.tempId))
            );
            if (!existing) return fMsg;
            const isDel = Boolean(
              existing.isDeletedForEveryone ||
              fMsg.isDeletedForEveryone ||
              existing.text === 'This message was deleted' ||
              fMsg.text === 'This message was deleted' ||
              (existing.id && deletedMessageIdsRef.current.has(String(existing.id))) ||
              (existing.tempId && deletedMessageIdsRef.current.has(String(existing.tempId))) ||
              (fMsg.id && deletedMessageIdsRef.current.has(String(fMsg.id))) ||
              (fMsg.tempId && deletedMessageIdsRef.current.has(String(fMsg.tempId)))
            );
            return {
              ...existing,
              ...fMsg,
              isDeletedForEveryone: isDel,
              text: isDel ? 'This message was deleted' : (fMsg.text || existing.text),
              messageType: (fMsg.messageType && fMsg.messageType !== 'text') ? fMsg.messageType : (existing.messageType || fMsg.messageType || (existing.mediaUrl || fMsg.mediaUrl ? 'image' : 'text')),
              mediaUrl: isDel ? null : (fMsg.mediaUrl || existing.mediaUrl),
              fileName: isDel ? null : (fMsg.fileName || existing.fileName),
              fileSize: isDel ? null : (fMsg.fileSize || existing.fileSize),
              reactions: isDel ? [] : (Array.isArray(fMsg.reactions)
                ? fMsg.reactions
                : (Array.isArray(existing.reactions) ? existing.reactions : [])),
              tempId: fMsg.tempId || existing.tempId || null,
              replyTo: isDel ? null : (parseReplyTo(fMsg.replyTo) || parseReplyTo(existing.replyTo) || null),
              isPinned: isDel ? false : resolveIsPinned(fMsg.id, fMsg.tempId || existing.tempId, fMsg.isPinned, existing.isPinned),
              starredBy: Array.isArray(fMsg.starredBy) ? fMsg.starredBy : (Array.isArray(existing.starredBy) ? existing.starredBy : []),
              isStarred: resolveIsStarred(fMsg.id, fMsg.tempId || existing.tempId, fMsg.isStarred, existing.isStarred, fMsg.starredBy),
              isEdited: Boolean(fMsg.isEdited || existing.isEdited),
            };
          });

          const extraMsgs = prevMsgs.filter((m) => {
            if (!doesMessageBelongToPartner(m, found.id)) return false;
            return !mergedFoundMsgs.some(
              (f) =>
                (f.id && m.id && String(f.id) === String(m.id)) ||
                (m.tempId && (String(f.id) === String(m.tempId) || (f.tempId && String(f.tempId) === String(m.tempId)))) ||
                (f.tempId && m.id && String(m.id) === String(f.tempId))
            );
          });
          const combined = deduplicateMessages([...mergedFoundMsgs, ...extraMsgs]);
          const hasRealMessages = combined.some((m) => m.id !== 'match-init');
          const cleanMessages = deduplicateMessages(enforceSinglePin(hasRealMessages ? combined.filter((m) => m.id !== 'match-init') : combined));
          cleanMessages.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

          const isBlocked = found.isBlocked || prevActiveChat.isBlocked || false;
          const isBlockedByOther = found.isBlockedByOther || prevActiveChat.isBlockedByOther || false;

          const isSameLength = cleanMessages.length === prevMsgs.length;
          const isSameContent = isSameLength && cleanMessages.every((m, idx) => {
            const p = prevMsgs[idx];
            return (
              p &&
              String(m.id || m._id) === String(p.id || p._id) &&
              m.text === p.text &&
              m.status === p.status &&
              m.createdAt === p.createdAt &&
              Boolean(m.isPinned) === Boolean(p.isPinned) &&
              Boolean(m.isStarred) === Boolean(p.isStarred) &&
              JSON.stringify(m.replyTo || null) === JSON.stringify(p.replyTo || null) &&
              JSON.stringify(m.reactions || []) === JSON.stringify(p.reactions || [])
            );
          });

          if (
            isSameContent &&
            isBlocked === prevActiveChat.isBlocked &&
            isBlockedByOther === prevActiveChat.isBlockedByOther &&
            found.name === prevActiveChat.name &&
            found.image === prevActiveChat.image
          ) {
            return prevActiveChat;
          }

          return {
            ...prevActiveChat,
            ...found,
            isBlocked: isBlocked,
            isBlockedByOther: isBlockedByOther,
            messages: cleanMessages,
          };
        }
      }
      return prevActiveChat;
    });
  }, [messagesData, questionnairesData, matches, currentUser, matchedUserIds, blockedUsersList, blockedByOtherList, conversationPartners]);

  // Sync individual chat messages query data into local chats and activeChat states
  useEffect(() => {
    if (!chatMessagesData || !activeChat || !currentUser) return;

    const currentId = (currentUser.id || currentUser._id || userProfile?.id || userProfile?._id)?.toString();
    const activePartnerId = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
    if (!activePartnerId) return;

    // Filter messages specifically for the active chat conversation so messages sent to other users never leak here
    const relevantChatMsgs = chatMessagesData.filter((msg) => {
      if (!msg) return false;
      const sId = (msg.senderId?._id || msg.senderId || msg.sender)?.toString();
      const rId = (msg.receiverId?._id || msg.receiverId || msg.receiver)?.toString();
      const isSentByMe = sId === currentId || msg.sender === 'you';
      if (isSentByMe) {
        return rId === activePartnerId;
      }
      return sId === activePartnerId;
    });

    // Map DB messages to UI message structure
    const formatted = relevantChatMsgs.map((msg) => {
      const rawId = (msg._id || msg.id)?.toString();
      const rawTemp = msg.tempId?.toString();
      const isDel = Boolean(
        msg.isDeletedForEveryone ||
        msg.text === 'This message was deleted' ||
        (rawId && deletedMessageIdsRef.current.has(rawId)) ||
        (rawTemp && deletedMessageIdsRef.current.has(rawTemp))
      );
      return {
        id: (msg._id || msg.id).toString(),
        sender: (msg.senderId?._id || msg.senderId || msg.sender)?.toString() === currentId ? 'you' : 'them',
        senderId: (msg.senderId?._id || msg.senderId || msg.sender)?.toString(),
        receiverId: (msg.receiverId?._id || msg.receiverId || msg.receiver)?.toString(),
        text: isDel ? 'This message was deleted' : (msg.text || ''),
        messageType: (msg.messageType && msg.messageType !== 'text') ? msg.messageType : (msg.mediaUrl ? 'image' : (msg.messageType || 'text')),
        mediaUrl: isDel ? null : msg.mediaUrl,
        fileName: isDel ? null : msg.fileName,
        fileSize: isDel ? null : msg.fileSize,
        stickerId: msg.stickerId,
        replyTo: isDel ? null : parseReplyTo(msg.replyTo),
        reactions: isDel ? [] : (Array.isArray(msg.reactions) ? msg.reactions : []),
        isEdited: Boolean(msg.isEdited),
        isPinned: isDel ? false : Boolean(msg.isPinned),
        starredBy: Array.isArray(msg.starredBy) ? msg.starredBy : [],
        isStarred: Array.isArray(msg.starredBy) && currentId
          ? msg.starredBy.some((id) => (id?._id || id)?.toString() === currentId)
          : Boolean(msg.isStarred),
        isDeletedForEveryone: isDel,
        status: msg.status || 'sent',
        createdAt: msg.createdAt,
      };
    });

    // Maintain any active temp messages & real-time received messages
    setActiveChat((prev) => {
      const prevPartnerId = (prev?.id || prev?._id || prev?.userId)?.toString();
      if (prev && prevPartnerId && prevPartnerId === activePartnerId) {
        if (formatted.length === 0 && prev.messages.some(m => m.id === 'match-init')) {
          return prev;
        }
        const prevMsgs = prev.messages || [];
        const mergedFormatted = formatted.map((fMsg) => {
          const existing = prevMsgs.find(
            (p) =>
              String(p.id) === String(fMsg.id) ||
              (p.tempId && (String(p.tempId) === String(fMsg.id) || String(p.tempId) === String(fMsg.tempId))) ||
              (fMsg.tempId && String(p.id) === String(fMsg.tempId))
          );
          if (!existing) return fMsg;
          const isDel = Boolean(
            existing.isDeletedForEveryone ||
            fMsg.isDeletedForEveryone ||
            existing.text === 'This message was deleted' ||
            fMsg.text === 'This message was deleted' ||
            (existing.id && deletedMessageIdsRef.current.has(String(existing.id))) ||
            (existing.tempId && deletedMessageIdsRef.current.has(String(existing.tempId))) ||
            (fMsg.id && deletedMessageIdsRef.current.has(String(fMsg.id))) ||
            (fMsg.tempId && deletedMessageIdsRef.current.has(String(fMsg.tempId)))
          );
          return {
            ...existing,
            ...fMsg,
            isDeletedForEveryone: isDel,
            text: isDel ? 'This message was deleted' : (fMsg.text || existing.text),
            messageType: (fMsg.messageType && fMsg.messageType !== 'text') ? fMsg.messageType : (existing.messageType || fMsg.messageType || (existing.mediaUrl || fMsg.mediaUrl ? 'image' : 'text')),
            mediaUrl: isDel ? null : (fMsg.mediaUrl || existing.mediaUrl),
            fileName: isDel ? null : (fMsg.fileName || existing.fileName),
            fileSize: isDel ? null : (fMsg.fileSize || existing.fileSize),
            reactions: isDel ? [] : (Array.isArray(fMsg.reactions)
              ? fMsg.reactions
              : (Array.isArray(existing.reactions) ? existing.reactions : [])),
            tempId: fMsg.tempId || existing.tempId || null,
            replyTo: isDel ? null : (parseReplyTo(fMsg.replyTo) || parseReplyTo(existing.replyTo) || null),
            isPinned: isDel ? false : resolveIsPinned(fMsg.id, fMsg.tempId || existing.tempId, fMsg.isPinned, existing.isPinned),
            starredBy: Array.isArray(fMsg.starredBy) ? fMsg.starredBy : (Array.isArray(existing.starredBy) ? existing.starredBy : []),
            isStarred: resolveIsStarred(fMsg.id, fMsg.tempId || existing.tempId, fMsg.isStarred, existing.isStarred, fMsg.starredBy),
            isEdited: Boolean(fMsg.isEdited || existing.isEdited),
          };
        });
        const extraMsgs = prevMsgs.filter((m) => {
          if (!doesMessageBelongToPartner(m, activePartnerId)) return false;
          return !mergedFormatted.some(
            (f) =>
              (f.id && m.id && String(f.id) === String(m.id)) ||
              (m.tempId && (String(f.id) === String(m.tempId) || (f.tempId && String(f.tempId) === String(m.tempId)))) ||
              (f.tempId && m.id && String(m.id) === String(f.tempId))
          );
        });
        const nextMsgs = deduplicateMessages(enforceSinglePin([...mergedFormatted, ...extraMsgs]));
        nextMsgs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

        if (
          nextMsgs.length === prevMsgs.length &&
          nextMsgs.every((m, i) =>
            m.id === prevMsgs[i]?.id &&
            m.text === prevMsgs[i]?.text &&
            m.isEdited === prevMsgs[i]?.isEdited &&
            Boolean(m.isPinned) === Boolean(prevMsgs[i]?.isPinned) &&
            Boolean(m.isStarred) === Boolean(prevMsgs[i]?.isStarred) &&
            JSON.stringify(m.replyTo || null) === JSON.stringify(prevMsgs[i]?.replyTo || null) &&
            JSON.stringify(m.reactions || []) === JSON.stringify(prevMsgs[i]?.reactions || [])
          )
        ) {
          return prev;
        }
        return {
          ...prev,
          messages: nextMsgs,
        };
      }
      return prev;
    });

    setChats((prevChats) =>
      prevChats.map((c) => {
        const cPartnerId = (c?.id || c?._id || c?.userId)?.toString();
        if (cPartnerId && cPartnerId === activePartnerId) {
          if (formatted.length === 0 && c.messages.some(m => m.id === 'match-init')) {
            return c;
          }
          const prevMsgs = c.messages || [];
          const mergedFormatted = formatted.map((fMsg) => {
            const existing = prevMsgs.find(
              (p) =>
                (p.id && fMsg.id && String(p.id) === String(fMsg.id)) ||
                (p.tempId && (String(p.tempId) === String(fMsg.id) || (fMsg.tempId && String(p.tempId) === String(fMsg.tempId)))) ||
                (fMsg.tempId && p.id && String(p.id) === String(fMsg.tempId))
            );
            if (!existing) return fMsg;
            const isDel = Boolean(
              existing.isDeletedForEveryone ||
              fMsg.isDeletedForEveryone ||
              existing.text === 'This message was deleted' ||
              fMsg.text === 'This message was deleted' ||
              (existing.id && deletedMessageIdsRef.current.has(String(existing.id))) ||
              (existing.tempId && deletedMessageIdsRef.current.has(String(existing.tempId))) ||
              (fMsg.id && deletedMessageIdsRef.current.has(String(fMsg.id))) ||
              (fMsg.tempId && deletedMessageIdsRef.current.has(String(fMsg.tempId)))
            );
            return {
              ...existing,
              ...fMsg,
              isDeletedForEveryone: isDel,
              text: isDel ? 'This message was deleted' : (fMsg.text || existing.text),
              messageType: (fMsg.messageType && fMsg.messageType !== 'text') ? fMsg.messageType : (existing.messageType || fMsg.messageType || (existing.mediaUrl || fMsg.mediaUrl ? 'image' : 'text')),
              mediaUrl: isDel ? null : (fMsg.mediaUrl || existing.mediaUrl),
              fileName: isDel ? null : (fMsg.fileName || existing.fileName),
              fileSize: isDel ? null : (fMsg.fileSize || existing.fileSize),
              reactions: isDel ? [] : (Array.isArray(fMsg.reactions)
                ? fMsg.reactions
                : (Array.isArray(existing.reactions) ? existing.reactions : [])),
              tempId: fMsg.tempId || existing.tempId || null,
              replyTo: isDel ? null : (parseReplyTo(fMsg.replyTo) || parseReplyTo(existing.replyTo) || null),
              isPinned: isDel ? false : resolveIsPinned(fMsg.id, fMsg.tempId || existing.tempId, fMsg.isPinned, existing.isPinned),
              starredBy: Array.isArray(fMsg.starredBy) ? fMsg.starredBy : (Array.isArray(existing.starredBy) ? existing.starredBy : []),
              isStarred: resolveIsStarred(fMsg.id, fMsg.tempId || existing.tempId, fMsg.isStarred, existing.isStarred, fMsg.starredBy),
              isEdited: Boolean(fMsg.isEdited || existing.isEdited),
            };
          });
          const extraMsgs = prevMsgs.filter((m) => {
            if (!doesMessageBelongToPartner(m, activePartnerId)) return false;
            return !mergedFormatted.some(
              (f) =>
                (f.id && m.id && String(f.id) === String(m.id)) ||
                (m.tempId && (String(f.id) === String(m.tempId) || (f.tempId && String(f.tempId) === String(m.tempId)))) ||
                (f.tempId && m.id && String(m.id) === String(f.tempId))
            );
          });
          const nextMsgs = deduplicateMessages(enforceSinglePin([...mergedFormatted, ...extraMsgs]));
          nextMsgs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

          if (
            nextMsgs.length === prevMsgs.length &&
            nextMsgs.every((m, i) =>
              m.id === prevMsgs[i]?.id &&
              m.text === prevMsgs[i]?.text &&
              m.isEdited === prevMsgs[i]?.isEdited &&
              Boolean(m.isPinned) === Boolean(prevMsgs[i]?.isPinned) &&
              Boolean(m.isStarred) === Boolean(prevMsgs[i]?.isStarred) &&
              JSON.stringify(m.replyTo || null) === JSON.stringify(prevMsgs[i]?.replyTo || null) &&
              JSON.stringify(m.reactions || []) === JSON.stringify(prevMsgs[i]?.reactions || [])
            )
          ) {
            return c;
          }
          return {
            ...c,
            messages: nextMsgs,
          };
        }
        return c;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessagesData, currentUser, activeChat?.id, activeChat?._id, activeChat?.userId]);

  // Emit mark_seen when activeChat is opened or when new messages arrive in it
  useEffect(() => {
    if (activeChat && currentUser && socketRef.current && socketRef.current.connected) {
      const currentId = (currentUser.id || currentUser._id)?.toString();
      const otherId = (activeChat.id || activeChat._id || activeChat.userId)?.toString();

      const hasUnread = (activeChat.messages || []).some(
        (m) => m.sender === 'them' && m.status !== 'seen'
      );

      if (hasUnread && otherId) {
        console.log(`Emitting mark_seen for messages from ${otherId} to ${currentId}`);
        socketRef.current.emit('mark_seen', {
          senderId: otherId,
          receiverId: currentId,
        });

        // Optimistically set the status of their messages to seen locally
        setChats((prevChats) =>
          prevChats.map((c) => {
            const partnerId = (c.id || c._id || c.userId)?.toString();
            if (partnerId === otherId) {
              return {
                ...c,
                messages: (c.messages || []).map((m) =>
                  m.sender === 'them' ? { ...m, status: 'seen' } : m
                ),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          const activePartnerId = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
          if (activePartnerId === otherId) {
            return {
              ...prevActive,
              messages: (prevActive.messages || []).map((m) =>
                m.sender === 'them' ? { ...m, status: 'seen' } : m
              ),
            };
          }
          return prevActive;
        });
      }
    }
  }, [activeChat, currentUser]);

  const handleCreateNewChat = (user) => {
    const candidateId = (user.id || user._id)?.toString();
    if (!candidateId) return;

    if (!matchedUserIds.includes(candidateId)) {
      Alert.alert(
        'Not Matched Yet',
        'You can only chat after two users have matched!'
      );
      return;
    }

    const exists = chats.some((c) => (c.id || c._id || c.userId)?.toString() === candidateId);
    if (!exists) {
      const newChat = {
        id: candidateId,
        name: user.name,
        image: user.image,
        messages: [
          {
            id: 'match-init',
            sender: 'them',
            text: `It's a Match! Say hi to ${user.name}! 👋`,
          },
        ],
      };
      setChats([newChat, ...chats]);
      dispatch(setMessages([]));
      dispatch(setActiveChatUser(newChat));
      setActiveChat(newChat);
    } else {
      const foundChat = chats.find((c) => (c.id || c._id || c.userId)?.toString() === candidateId);
      const sanitizedFoundChat = foundChat ? {
        ...foundChat,
        messages: (foundChat.messages || []).filter((m) => m.id === 'match-init' || doesMessageBelongToPartner(m, candidateId)),
      } : null;
      dispatch(setMessages([]));
      dispatch(setActiveChatUser(sanitizedFoundChat));
      setActiveChat(sanitizedFoundChat);
    }
    setShowMatchPopup(false);
    setActiveTab('chat');
  };

  const handleInputChange = (text) => {
    typedMessageRef.current = text;
    setTypedMessage(text);
    if (showStickerPicker) setShowStickerPicker(false);

    if (!socketRef.current || !currentUser || !activeChat) return;

    const currentId = (currentUser.id || currentUser._id)?.toString();
    const receiverId = (activeChat.id || activeChat._id || activeChat.userId)?.toString();

    if (!currentId || !receiverId) return;

    if (text.trim() === '') {
      if (isCurrentlyTypingRef.current) {
        socketRef.current.emit('stop_typing', { senderId: currentId, receiverId });
        isCurrentlyTypingRef.current = false;
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    } else {
      if (!isCurrentlyTypingRef.current) {
        socketRef.current.emit('typing', { senderId: currentId, receiverId });
        isCurrentlyTypingRef.current = true;
      }

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      typingTimerRef.current = setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.emit('stop_typing', { senderId: currentId, receiverId });
        }
        isCurrentlyTypingRef.current = false;
      }, 2500);
    }
  };

  const handleSendMessage = async (customPayload = null) => {
    if (!activeChat || !currentUser || isSendingMessageRef.current) return;

    const currentId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
    const receiverId = (customPayload?.receiverId || activeChat.id || activeChat._id || activeChat.userId)?.toString();
    if (!currentId || !receiverId) return;

    // Set sending lock to prevent rapid double-tap duplicate triggers
    isSendingMessageRef.current = true;
    setTimeout(() => {
      isSendingMessageRef.current = false;
    }, 600);

    // Reset typing status on send
    if (isCurrentlyTypingRef.current) {
      if (socketRef.current) {
        socketRef.current.emit('stop_typing', { senderId: currentId, receiverId: receiverId });
      }
      isCurrentlyTypingRef.current = false;
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (editingMessage) {
      if (customPayload) return; // Do not edit if sending a sticker/file
      const textToEdit = (typedMessageRef.current !== undefined && typedMessageRef.current !== null && typedMessageRef.current !== '' ? typedMessageRef.current : typedMessage).trim();
      if (!textToEdit) return;

      try {
        const res = await apiClient.editMessage({ messageId: editingMessage.id, text: textToEdit });
        console.log('Message edited successfully:', res);
        setChats((prevChats) =>
          prevChats.map((c) => {
            if (c.id === receiverId) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === editingMessage.id ? { ...m, text: textToEdit, isEdited: true } : m
                ),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (prevActive && (prevActive.id || prevActive._id || prevActive.userId)?.toString() === receiverId) {
            return {
              ...prevActive,
              messages: prevActive.messages.map((m) =>
                m.id === editingMessage.id ? { ...m, text: textToEdit, isEdited: true } : m
              ),
            };
          }
          return prevActive;
        });
        setEditingMessage(null);
        typedMessageRef.current = '';
        setTypedMessage('');
        if (chatInputRef.current) {
          try { chatInputRef.current.clear(); } catch (_) { }
        }
        refetchChatMessages();
      } catch (err) {
        console.error('Failed to edit message:', err);
        Alert.alert('Error', 'Failed to edit message.');
      }
      return;
    }

    const partnerIdStr = receiverId?.toString();
    const isBlockedByMe = activeChat?.isBlocked || (partnerIdStr && blockedUsersList.some((b) => (b.id || b._id || b.userId)?.toString() === partnerIdStr));
    const isBlockedByOther = partnerIdStr && blockedByOtherList.includes(partnerIdStr);

    if (isBlockedByMe || isBlockedByOther) {
      Alert.alert(
        'Cannot Send Message 🔒',
        isBlockedByOther
          ? 'You cannot send messages to this user because you are blocked.'
          : 'You blocked this person. Unblock them to resume conversation.'
      );
      return;
    }

    const currentText = (typedMessageRef.current !== undefined && typedMessageRef.current !== null && typedMessageRef.current !== '' ? typedMessageRef.current : typedMessage);
    if (!customPayload) {
      if (!currentText.trim()) return;
      typedMessageRef.current = '';
      setTypedMessage('');
      if (chatInputRef.current) {
        try { chatInputRef.current.clear(); } catch (_) { }
      }
    }

    if (editingMessage) {
      const newText = currentText.trim();
      const targetId = (editingMessage.id || editingMessage._id)?.toString();
      setEditingMessage(null);
      if (!newText || !targetId) return;

      const updateEdited = (m) => (m.id === targetId || m._id === targetId ? { ...m, text: newText, isEdited: true } : m);

      setActiveChat((prev) => prev ? { ...prev, messages: (prev.messages || []).map(updateEdited) } : null);
      setChats((prev) => prev.map((c) => (isIdMatch(c, receiverId) ? { ...c, messages: (c.messages || []).map(updateEdited) } : c)));

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('edit_message', { messageId: targetId, receiverId, text: newText });
      }
      apiClient.editMessage({ messageId: targetId, text: newText }).catch((e) => console.log('Edit message API error:', e));
      return;
    }

    const tempId = 'temp-' + Date.now() + '-' + Math.floor(Math.random() * 10000);

    let payload = {
      senderId: currentId,
      receiverId: receiverId,
      tempId: tempId,
    };

    if (customPayload) {
      payload = { ...payload, ...customPayload };
    } else {
      payload.text = currentText.trim();
      payload.messageType = 'text';
    }

    if (replyingToMessage) {
      const currentUserIdStr = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
      const qText = replyingToMessage.text ? replyingToMessage.text.trim() : getQuotedSnippetText(replyingToMessage);
      const isReplyingToMe = replyingToMessage.sender === 'you' || (replyingToMessage.senderId && replyingToMessage.senderId.toString() === currentUserIdStr);
      const replyData = {
        messageId: (replyingToMessage.id || replyingToMessage._id)?.toString(),
        senderId: (replyingToMessage.senderId || (isReplyingToMe ? currentUserIdStr : (activeChat?.id || activeChat?._id)?.toString()))?.toString(),
        text: qText,
        senderName: isReplyingToMe ? 'You' : (activeChat?.name || activeChat?.firstName || 'Contact'),
        messageType: replyingToMessage.messageType || (replyingToMessage.mediaUrl ? 'image' : 'text'),
        mediaUrl: replyingToMessage.mediaUrl || null,
        fileName: replyingToMessage.fileName || null,
      };
      payload.replyTo = replyData;
      setReplyingToMessage(null);
    }

    const localMsg = {
      id: tempId,
      tempId: tempId,
      sender: 'you',
      senderId: currentId,
      receiverId: receiverId,
      text: payload.text,
      messageType: payload.messageType || 'text',
      mediaUrl: payload.mediaUrl,
      localAudioUri: payload.localAudioUri || null,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      replyTo: payload.replyTo || null,
      stickerId: payload.stickerId,
      status: 'sent',
      createdAt: new Date().toISOString(),
    };

    const isIdMatch = (obj, targetId) => {
      if (!obj || !targetId) return false;
      const targetStr = targetId.toString();
      const objIdStr = (obj.id || obj._id || obj.userId)?.toString();
      return objIdStr === targetStr;
    };

    setChats((prevChats) => {
      if (!Array.isArray(prevChats)) return [{ id: receiverId, messages: [localMsg] }];
      let found = false;
      const updated = prevChats.map((c) => {
        if (isIdMatch(c, receiverId)) {
          found = true;
          const msgs = (c.messages || []).filter((m) => m.id !== 'match-init');
          const exists = msgs.some((m) => m.id === tempId || m.tempId === tempId);
          return {
            ...c,
            messages: exists ? msgs : deduplicateMessages([...msgs, localMsg]),
          };
        }
        return c;
      });
      if (!found && receiverId) {
        updated.push({
          id: receiverId,
          name: activeChat.name || activeChat.firstName || 'User',
          image: activeChat.image || activeChat.profileImage,
          messages: [localMsg],
        });
      }
      return sortChatsByRecent(updated);
    });

    setActiveChat((prevActive) => {
      if (!prevActive) return prevActive;
      const prevActivePartnerId = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
      if (prevActivePartnerId !== receiverId) return prevActive;
      const msgs = (prevActive.messages || []).filter((m) => m.id !== 'match-init');
      const exists = msgs.some((m) => m.id === tempId || m.tempId === tempId);
      return {
        ...prevActive,
        messages: exists ? msgs : deduplicateMessages([...msgs, localMsg]),
      };
    });

    dispatch(addMessage(localMsg));
    setTimeout(() => {
      if (chatScrollViewRef.current) {
        chatScrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 40);

    let hasConfirmed = false;
    const handleServerConfirmation = (serverMsg) => {
      if (!serverMsg || hasConfirmed) return;
      hasConfirmed = true;
      const actualMsg = {
        id: (serverMsg._id || serverMsg.id).toString(),
        tempId: tempId,
        sender: 'you',
        senderId: currentId,
        receiverId: receiverId,
        text: serverMsg.text,
        messageType: serverMsg.messageType || 'text',
        mediaUrl: serverMsg.mediaUrl,
        localAudioUri: payload.localAudioUri || null,
        fileName: serverMsg.fileName,
        fileSize: serverMsg.fileSize,
        stickerId: serverMsg.stickerId,
        replyTo: parseReplyTo(serverMsg?.replyTo) || parseReplyTo(payload?.replyTo) || null,
        reactions: Array.isArray(serverMsg.reactions) ? serverMsg.reactions : (Array.isArray(localMsg?.reactions) ? localMsg.reactions : []),
        isEdited: Boolean(serverMsg.isEdited),
        status: serverMsg.status || 'sent',
        createdAt: serverMsg.createdAt || new Date().toISOString(),
      };
      dispatch(addMessage(actualMsg));
      setChats((prevChats) =>
        prevChats.map((c) => {
          if (isIdMatch(c, receiverId)) {
            const msgs = c.messages || [];
            const hasTemp = msgs.some((m) => m.id === tempId || m.tempId === tempId);
            return {
              ...c,
              messages: hasTemp
                ? msgs.map((m) => (m.id === tempId || m.tempId === tempId ? actualMsg : m))
                : msgs.some((m) => m.id === actualMsg.id) ? msgs : [...msgs, actualMsg],
            };
          }
          return c;
        })
      );
      setActiveChat((prevActive) => {
        if (!prevActive) return prevActive;
        const prevActivePartnerId = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
        if (prevActivePartnerId !== receiverId) return prevActive;
        const msgs = prevActive.messages || [];
        const hasTemp = msgs.some((m) => m.id === tempId || m.tempId === tempId);
        return {
          ...prevActive,
          messages: hasTemp
            ? msgs.map((m) => (m.id === tempId || m.tempId === tempId ? actualMsg : m))
            : msgs.some((m) => m.id === actualMsg.id) ? msgs : [...msgs, actualMsg],
        };
      });
      setOfflineQueue((prev) => prev.filter((item) => item.tempId !== tempId));
    };

    const handleSendError = (errMsg) => {
      // Mark optimistic message as failed (never delete automatically; user can tap to retry or manually delete)
      const markFailed = (m) => (m.id === tempId || m.tempId === tempId ? { ...m, status: 'failed', errorMessage: errMsg } : m);
      setChats((prevChats) =>
        prevChats.map((c) => {
          if (isIdMatch(c, receiverId)) {
            return {
              ...c,
              messages: (c.messages || []).map(markFailed),
            };
          }
          return c;
        })
      );
      setActiveChat((prevActive) => {
        if (!prevActive) return prevActive;
        return {
          ...prevActive,
          messages: (prevActive.messages || []).map(markFailed),
        };
      });
      Alert.alert('Cannot Send Message', errMsg || 'Failed to send message. Tap the message to retry.');
    };

    const handleRetrySendMessage = (failedMsg) => {
      if (!failedMsg || !activeChat || !currentUser) return;
      const currentId = (currentUser.id || currentUser._id)?.toString();
      const receiverId = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
      const tempId = failedMsg.tempId || failedMsg.id;

      const resetPending = (m) => (m.id === tempId || m.tempId === tempId ? { ...m, status: 'pending', errorMessage: null } : m);
      setActiveChat((prev) => {
        if (!prev) return null;
        const prevPartnerId = (prev.id || prev._id || prev.userId)?.toString();
        if (prevPartnerId !== receiverId) return prev;
        return { ...prev, messages: (prev.messages || []).map(resetPending) };
      });
      setChats((prev) => prev.map((c) => (isIdMatch(c, receiverId) ? { ...c, messages: (c.messages || []).map(resetPending) } : c)));

      const payload = {
        senderId: currentId,
        receiverId: receiverId,
        tempId: tempId,
        text: failedMsg.text || '',
        messageType: failedMsg.messageType || 'text',
        mediaUrl: failedMsg.mediaUrl || null,
        fileName: failedMsg.fileName || null,
        fileSize: failedMsg.fileSize || null,
        replyTo: failedMsg.replyTo || null,
        stickerId: failedMsg.stickerId || null,
      };

      if (socketRef.current && socketRef.current.connected) {
        console.log('⚡ Retrying send_message via Socket:', payload);
        socketRef.current.emit('send_message', payload, (res) => {
          if (res && res.status === 'ok' && res.data) {
            const actualMsg = {
              id: (res.data._id || res.data.id).toString(),
              tempId: tempId,
              sender: 'you',
              senderId: currentId,
              receiverId: receiverId,
              text: res.data.text,
              messageType: res.data.messageType || 'text',
              mediaUrl: res.data.mediaUrl,
              fileName: res.data.fileName,
              fileSize: res.data.fileSize,
              stickerId: res.data.stickerId,
              replyTo: parseReplyTo(res?.data?.replyTo) || parseReplyTo(failedMsg?.replyTo) || parseReplyTo(payload?.replyTo) || null,
              reactions: Array.isArray(res?.data?.reactions) ? res.data.reactions : [],
              isEdited: Boolean(res?.data?.isEdited),
              status: res.data.status || 'sent',
              createdAt: res.data.createdAt || new Date().toISOString(),
            };
            dispatch(addMessage(actualMsg));
            const confirmUpdate = (m) => (m.id === tempId || m.tempId === tempId ? actualMsg : m);
            setActiveChat((prev) => {
              if (!prev) return null;
              const prevPartnerId = (prev.id || prev._id || prev.userId)?.toString();
              if (prevPartnerId !== receiverId) return prev;
              return { ...prev, messages: (prev.messages || []).map(confirmUpdate) };
            });
            setChats((prev) => prev.map((c) => (isIdMatch(c, receiverId) ? { ...c, messages: (c.messages || []).map(confirmUpdate) } : c)));
          } else if (res && res.status === 'error') {
            const markFailed = (m) => (m.id === tempId || m.tempId === tempId ? { ...m, status: 'failed', errorMessage: res.message } : m);
            setActiveChat((prev) => {
              if (!prev) return null;
              const prevPartnerId = (prev.id || prev._id || prev.userId)?.toString();
              if (prevPartnerId !== receiverId) return prev;
              return { ...prev, messages: (prev.messages || []).map(markFailed) };
            });
            setChats((prev) => prev.map((c) => (isIdMatch(c, receiverId) ? { ...c, messages: (c.messages || []).map(markFailed) } : c)));
            Alert.alert('Cannot Send Message', res?.message || 'Failed to resend message.');
          }
        });
      } else {
        apiClient.sendMessage(payload).then((res) => {
          const sMsg = res?.data || res;
          if (sMsg?._id || sMsg?.id) {
            const actualMsg = {
              id: (sMsg._id || sMsg.id).toString(),
              tempId: tempId,
              sender: 'you',
              senderId: currentId,
              receiverId: receiverId,
              text: sMsg.text,
              messageType: sMsg.messageType || 'text',
              mediaUrl: sMsg.mediaUrl,
              fileName: sMsg.fileName,
              fileSize: sMsg.fileSize,
              stickerId: sMsg.stickerId,
              replyTo: parseReplyTo(sMsg?.replyTo) || parseReplyTo(failedMsg?.replyTo) || parseReplyTo(payload?.replyTo) || null,
              reactions: Array.isArray(sMsg?.reactions) ? sMsg.reactions : [],
              isEdited: Boolean(sMsg?.isEdited),
              status: sMsg.status || 'sent',
              createdAt: sMsg.createdAt || new Date().toISOString(),
            };
            dispatch(addMessage(actualMsg));
            const confirmUpdate = (m) => (m.id === tempId || m.tempId === tempId ? actualMsg : m);
            setActiveChat((prev) => {
              if (!prev) return null;
              const prevPartnerId = (prev.id || prev._id || prev.userId)?.toString();
              if (prevPartnerId !== receiverId) return prev;
              return { ...prev, messages: (prev.messages || []).map(confirmUpdate) };
            });
            setChats((prev) => prev.map((c) => (isIdMatch(c, receiverId) ? { ...c, messages: (c.messages || []).map(confirmUpdate) } : c)));
          }
        }).catch((err) => {
          const errMsg = err?.data?.message || err?.message || 'Failed to resend message.';
          const markFailed = (m) => (m.id === tempId || m.tempId === tempId ? { ...m, status: 'failed', errorMessage: errMsg } : m);
          setActiveChat((prev) => {
            if (!prev) return null;
            const prevPartnerId = (prev.id || prev._id || prev.userId)?.toString();
            if (prevPartnerId !== receiverId) return prev;
            return { ...prev, messages: (prev.messages || []).map(markFailed) };
          });
          setChats((prev) => prev.map((c) => (isIdMatch(c, receiverId) ? { ...c, messages: (c.messages || []).map(markFailed) } : c)));
          Alert.alert('Cannot Send Message', errMsg);
        });
      }
    };

    if (socketRef.current && socketRef.current.connected) {
      console.log('⚡ [PURE SOCKET EVENT] Emitting send_message socket event:', payload);
      socketRef.current.emit('send_message', payload, (res) => {
        if (res && res.status === 'ok' && res.data) {
          handleServerConfirmation(res.data);
        } else if (res && res.status === 'error') {
          handleSendError(res.message);
        }
      });
    } else {
      console.log('Socket offline: Sending message via REST API Fallback:', payload);
      apiClient.sendMessage(payload).then((res) => {
        const sMsg = res?.data || res;
        if (sMsg?._id || sMsg?.id) {
          handleServerConfirmation(sMsg);
        }
      }).catch((err) => {
        console.error('REST API sendMessage error:', err);
        const errMsg = err?.data?.message || err?.message || '';
        if (err?.status === 403 || errMsg.includes('blocked')) {
          handleSendError(errMsg);
        } else {
          setOfflineQueue((prev) => [...prev, { tempId, payload }]);
        }
      });
    }
  };

  const handleMessageLongPress = (msg) => {
    if (!msg) return;
    const msgId = (msg.id || msg._id)?.toString();
    if (!msgId || msgId === 'match-init' || msgId === 'blocked-init') return;

    setSelectedMessageForAction(msg);
    setIsMultiSelectMode(true);
    setSelectedMultiMessageIds((prev) => {
      if (prev.includes(msgId)) return prev;
      return [...prev, msgId];
    });
  };

  const handleEmojiReaction = (emoji, targetMsg = null, explicitAction = null) => {
    const msg = targetMsg || selectedMessageForAction;
    if (!msg || !activeChat || !currentUser) return;
    const sIdStr = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
    const rIdStr = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
    const targetIdStr = (msg.id || msg._id)?.toString();
    if (!sIdStr || !targetIdStr) return;

    const currentReactions = Array.isArray(msg.reactions) ? msg.reactions : [];
    const existingIdx = currentReactions.findIndex((r) => {
      const rUid = (r.userId?.toString() || r.userId);
      if (rUid && sIdStr) return rUid === sIdStr;
      return typeof r === 'string' ? r === emoji : r?.emoji === emoji;
    });
    const isRemoving = existingIdx > -1 && (typeof currentReactions[existingIdx] === 'string' ? currentReactions[existingIdx] === emoji : currentReactions[existingIdx]?.emoji === emoji);
    const action = explicitAction || (isRemoving ? 'remove' : 'set');

    // 1. Socket real-time broadcast
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('react_message', {
        messageId: targetIdStr,
        senderId: sIdStr,
        receiverId: rIdStr,
        emoji,
        action,
      });
    }

    // 2. HTTP REST persistence with deterministic action to guarantee MongoDB save without toggle conflict
    apiClient.reactToMessage(targetIdStr, emoji, rIdStr, action).catch((err) => {
      console.warn('apiClient.reactToMessage notice:', err?.message || err);
    });

    let calculatedReactions = [];
    const updateMsgReactions = (m) => {
      const mIdStr = (m.id || m._id)?.toString();
      const mTempStr = m.tempId?.toString();
      if (mIdStr !== targetIdStr && mTempStr !== targetIdStr) return m;
      const reactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
      let userIdx = reactions.findIndex((r) => (r.userId?.toString() || r.userId) === sIdStr);
      if (userIdx === -1) {
        userIdx = reactions.findIndex((r) => (typeof r === 'string' ? r === emoji : r?.emoji === emoji));
      }
      if (action === 'remove') {
        if (userIdx > -1) {
          reactions.splice(userIdx, 1);
        }
      } else {
        if (userIdx > -1) {
          reactions[userIdx] = { ...reactions[userIdx], emoji, userId: sIdStr };
        } else {
          reactions.push({ userId: sIdStr, emoji });
        }
      }
      calculatedReactions = reactions;
      return { ...m, reactions };
    };

    setActiveChat((prev) => prev ? { ...prev, messages: (prev.messages || []).map(updateMsgReactions) } : null);
    setChats((prev) =>
      prev.map((c) => {
        const cId = (c.id || c._id || c.userId)?.toString();
        return cId === rIdStr ? { ...c, messages: (c.messages || []).map(updateMsgReactions) } : c;
      })
    );

    dispatch(updateMessageReactions({ messageId: targetIdStr, tempId: msg.tempId, reactions: calculatedReactions }));

    setShowMessageActionModal(false);
    setIsMultiSelectMode(false);
    setSelectedMultiMessageIds([]);
    setSelectedMessageForAction(null);
  };

  const handleCopyMessageText = (msg) => {
    const targetMsg = msg || selectedMessageForAction;
    if (!targetMsg) return;
    const textToCopy = targetMsg.text || targetMsg.mediaUrl || '';
    if (textToCopy) {
      Clipboard.setString(textToCopy);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Message copied to clipboard', ToastAndroid.SHORT);
      } else {
        Alert.alert('Copied', 'Message copied to clipboard');
      }
    }
    setShowMessageActionModal(false);
  };

  const handlePinMessageAction = (msg) => {
    const targetMsg = msg || selectedMessageForAction;
    if (!targetMsg || !activeChat || !currentUser) return;
    const sIdStr = (currentUser.id || currentUser._id)?.toString();
    const rIdStr = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
    const targetIdStr = (targetMsg.id || targetMsg._id)?.toString();
    if (!targetIdStr) return;
    const newIsPinned = !targetMsg.isPinned;

    // Immediately register in recentPinActionRef to protect optimistic state against background polling lag
    recentPinActionRef.current[targetIdStr] = {
      isPinned: newIsPinned,
      timestamp: Date.now(),
    };
    if (targetMsg.tempId) {
      recentPinActionRef.current[targetMsg.tempId.toString()] = {
        isPinned: newIsPinned,
        timestamp: Date.now(),
      };
    }
    if (newIsPinned) {
      // Unpin any other records in recentPinActionRef for this chat
      Object.keys(recentPinActionRef.current).forEach((k) => {
        if (k !== targetIdStr && (!targetMsg.tempId || k !== targetMsg.tempId.toString())) {
          recentPinActionRef.current[k] = { isPinned: false, timestamp: Date.now() };
        }
      });
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('pin_message', {
        messageId: targetIdStr,
        senderId: sIdStr,
        receiverId: rIdStr,
        isPinned: newIsPinned,
      });
    }

    // Persist via HTTP REST endpoint as well to guarantee save in MongoDB
    apiClient.pinMessage(targetIdStr, newIsPinned, rIdStr).catch((err) => {
      console.warn('apiClient.pinMessage notice:', err?.message || err);
    });

    const updatePin = (m) => {
      const mId = (m.id || m._id)?.toString();
      const mTemp = m.tempId?.toString();
      if (mId === targetIdStr || mTemp === targetIdStr) {
        return { ...m, isPinned: newIsPinned };
      }
      if (newIsPinned) {
        return { ...m, isPinned: false };
      }
      return m;
    };

    setActiveChat((prev) => prev ? { ...prev, messages: enforceSinglePin((prev.messages || []).map(updatePin)) } : null);
    setChats((prev) =>
      prev.map((c) => {
        const cId = (c.id || c._id || c.userId)?.toString();
        return cId === rIdStr ? { ...c, messages: enforceSinglePin((c.messages || []).map(updatePin)) } : c;
      })
    );

    dispatch(updateMessagePinned({ messageId: targetIdStr, tempId: targetMsg.tempId, isPinned: newIsPinned }));

    setSelectedMessageForAction(null);
    setShowMessageActionModal(false);
    if (Platform.OS === 'android') {
      ToastAndroid.show(newIsPinned ? 'Message pinned 📌' : 'Message unpinned', ToastAndroid.SHORT);
    }
  };

  const handleToggleStarAction = (msg) => {
    const targetMsg = msg || selectedMessageForAction;
    if (!targetMsg || !activeChat || !currentUser) return;
    const sIdStr = (currentUser.id || currentUser._id)?.toString();
    const rIdStr = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
    const targetIdStr = (targetMsg.id || targetMsg._id)?.toString();
    if (!targetIdStr) return;
    const newStarred = !isMessageStarredByMe(targetMsg);

    recentStarActionRef.current[targetIdStr] = {
      isStarred: newStarred,
      timestamp: Date.now(),
    };
    if (targetMsg.tempId) {
      recentStarActionRef.current[targetMsg.tempId.toString()] = {
        isStarred: newStarred,
        timestamp: Date.now(),
      };
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('star_message', {
        messageId: targetIdStr,
        senderId: sIdStr,
        receiverId: rIdStr,
        isStarred: newStarred,
      });
    }

    // Persist to MongoDB via REST API
    apiClient.starMessage(targetIdStr, newStarred, rIdStr).catch((err) => {
      console.warn('apiClient.starMessage notice:', err?.message || err);
    });

    const updateStar = (m) => {
      const mId = (m.id || m._id)?.toString();
      const mTemp = m.tempId?.toString();
      if (mId === targetIdStr || mTemp === targetIdStr) {
        let nextStarredBy = Array.isArray(m.starredBy) ? [...m.starredBy] : [];
        if (sIdStr) {
          if (newStarred) {
            if (!nextStarredBy.some(id => (id?._id || id)?.toString() === sIdStr)) {
              nextStarredBy.push(sIdStr);
            }
          } else {
            nextStarredBy = nextStarredBy.filter(id => (id?._id || id)?.toString() !== sIdStr);
          }
        }
        return {
          ...m,
          isStarred: newStarred,
          starredBy: nextStarredBy,
          mediaUrl: m.mediaUrl || targetMsg.mediaUrl,
          messageType: (m.messageType && m.messageType !== 'text')
            ? m.messageType
            : (targetMsg.messageType || (m.mediaUrl || targetMsg.mediaUrl ? 'image' : 'text')),
          fileName: m.fileName || targetMsg.fileName,
          fileSize: m.fileSize || targetMsg.fileSize,
        };
      }
      return m;
    };

    setActiveChat((prev) => prev ? { ...prev, messages: (prev.messages || []).map(updateStar) } : null);
    setChats((prev) =>
      prev.map((c) => {
        const cId = (c.id || c._id || c.userId)?.toString();
        const hasMsg = (c.messages || []).some(
          (m) => (m.id || m._id)?.toString() === targetIdStr || m.tempId?.toString() === targetIdStr
        );
        return (cId === rIdStr || hasMsg) ? { ...c, messages: (c.messages || []).map(updateStar) } : c;
      })
    );

    dispatch(updateMessageStarred({
      messageId: targetIdStr,
      tempId: targetMsg.tempId,
      isStarred: newStarred,
      currentUserId: sIdStr,
      mediaUrl: targetMsg.mediaUrl,
      messageType: targetMsg.messageType,
      fileName: targetMsg.fileName,
      fileSize: targetMsg.fileSize,
    }));

    setSelectedMessageForAction(null);
    setShowMessageActionModal(false);
    if (Platform.OS === 'android') {
      ToastAndroid.show(newStarred ? 'Starred message ⭐' : 'Unstarred message', ToastAndroid.SHORT);
    }
  };

  const handleViewPartnerProfile = async (targetPartnerId = null) => {
    const partnerId = (
      targetPartnerId ||
      activeChat?.id ||
      activeChat?._id ||
      activeChat?.userId ||
      activeChat?.senderId ||
      activeChat?.sender
    )?.toString();

    if (!partnerId) return;

    // Check fast local state first
    const isPartnerBlockedMe = Boolean(
      activeChat?.isBlockedByOther ||
      activeChat?.name === 'Matched User' ||
      (partnerId && Array.isArray(blockedByOtherList) && blockedByOtherList.some((id) => id?.toString() === partnerId)) ||
      (partnerId && Array.isArray(chats) && chats.some((c) => (c.id || c._id || c.userId)?.toString() === partnerId && c.isBlockedByOther)) ||
      (partnerId && Array.isArray(matches) && matches.some((m) => (m.id || m._id || m.userId)?.toString() === partnerId && m.isBlockedByOther))
    );

    if (isPartnerBlockedMe) {
      console.log('[handleViewPartnerProfile] Cannot expand profile: User is blocked by partner:', partnerId);
      if (Platform.OS === 'android') {
        ToastAndroid.show('This profile is unavailable.', ToastAndroid.SHORT);
      } else {
        Alert.alert('Unavailable', 'This profile is currently unavailable.');
      }
      return;
    }

    setLikesActivePhotoIndex(0);

    const matchCandidate =
      (Array.isArray(matches) ? matches : []).find(m => (m?.id || m?._id || m?.userId)?.toString() === partnerId) ||
      (Array.isArray(likesList) ? likesList : []).find(m => (m?.id || m?._id || m?.userId)?.toString() === partnerId) ||
      (Array.isArray(chats) ? chats : []).find(m => (m?.id || m?._id || m?.userId)?.toString() === partnerId) ||
      (Array.isArray(MOCK_MATCHES) ? MOCK_MATCHES : []).find(m => (m?.id || m?._id || m?.userId)?.toString() === partnerId) ||
      {};

    let profileData = {
      ...matchCandidate,
      ...activeChat,
      id: partnerId,
      _id: partnerId,
      isFromChat: true,
      isLoadingFullProfile: true,
    };

    try {
      const res = await apiClient.getUserById(partnerId);

      // Check if backend confirmed that the partner blocked the current user
      if (res?.isBlocked || res?.status === 403 || (res?.message && res.message.toLowerCase().includes('blocked'))) {
        console.log('[handleViewPartnerProfile] Target user has blocked current user (403/isBlocked). Profile expansion blocked.');
        setBlockedByOtherList((prev) => Array.from(new Set([...(prev || []).map((id) => id.toString()), partnerId])));
        setActiveChat((prev) => prev ? { ...prev, isBlockedByOther: true, name: 'Matched User', image: null } : null);
        setSelectedLikesProfile(null);
        if (Platform.OS === 'android') {
          ToastAndroid.show('This profile is unavailable.', ToastAndroid.SHORT);
        } else {
          Alert.alert('Unavailable', 'This profile is currently unavailable.');
        }
        return;
      }

      if (res && res.user) {
        delete profileData.profileImages;
        delete profileData.photos;
        delete profileData.videos;
        delete profileData.media;
        profileData = {
          ...profileData,
          ...res.user,
          id: partnerId,
          _id: partnerId,
          isFromChat: true,
          isLoadingFullProfile: false,
        };
        setSelectedLikesProfile(profileData);
      } else if (!res?.message?.toLowerCase().includes('unavailable') && !res?.message?.toLowerCase().includes('hidden')) {
        setSelectedLikesProfile(profileData);
      } else {
        setSelectedLikesProfile(null);
        if (Platform.OS === 'android') {
          ToastAndroid.show(res?.message || 'Profile is unavailable.', ToastAndroid.SHORT);
        }
      }
    } catch (e) {
      console.log('Error fetching partner full profile by ID:', e);
      if (e?.status === 403 || e?.data?.message?.toLowerCase().includes('blocked')) {
        setSelectedLikesProfile(null);
        setBlockedByOtherList((prev) => Array.from(new Set([...(prev || []).map((id) => id.toString()), partnerId])));
        setActiveChat((prev) => prev ? { ...prev, isBlockedByOther: true, name: 'Matched User', image: null } : null);
        if (Platform.OS === 'android') {
          ToastAndroid.show('This profile is unavailable.', ToastAndroid.SHORT);
        } else {
          Alert.alert('Unavailable', 'This profile is currently unavailable.');
        }
        return;
      }
      setSelectedLikesProfile((prev) => prev ? { ...prev, isLoadingFullProfile: false } : prev);
    }
  };

  const handleCloseForwardModal = () => {
    setShowForwardModal(false);
    setSelectedForwardUserIds([]);
    setForwardSearchQuery('');
    setIsSendingForward(false);
    setMessagesToForward([]);
    setSelectedMessageForAction(null);
  };

  const toggleSelectForwardUser = (userId) => {
    if (!userId) return;
    const strId = userId.toString();
    setSelectedForwardUserIds((prev) => {
      if (prev.includes(strId)) {
        return prev.filter((id) => id !== strId);
      } else {
        return [...prev, strId];
      }
    });
  };

  const handleExecuteForward = async () => {
    const msgsToSend = (messagesToForward && messagesToForward.length > 0)
      ? messagesToForward
      : (selectedMessageForAction ? [selectedMessageForAction] : []);

    if (msgsToSend.length === 0 || !currentUser) return;
    if (!selectedForwardUserIds || selectedForwardUserIds.length === 0) return;
    if (isSendingForward) return;

    setIsSendingForward(true);

    const currentId = (currentUser.id || currentUser._id || userProfile?.id || userProfile?._id)?.toString();
    const currentActivePartnerId = (activeChatRef.current?.id || activeChatRef.current?._id || activeChatRef.current?.userId)?.toString();

    const targetUsers = forwardCandidates.filter((u) => {
      const uId = (u.id || u._id || u.userId)?.toString();
      return selectedForwardUserIds.includes(uId);
    });

    if (targetUsers.length === 0) {
      setIsSendingForward(false);
      return;
    }

    const recipientNames = targetUsers.map((u) => u.name || 'User').join(', ');

    for (const targetChatUser of targetUsers) {
      const receiverId = (targetChatUser.id || targetChatUser._id || targetChatUser.userId)?.toString();
      if (!receiverId) continue;
      const receiverName = targetChatUser.name || targetChatUser.firstName || 'User';

      for (const msg of msgsToSend) {
        const tempId = 'temp-fwd-' + Date.now() + '-' + Math.floor(Math.random() * 100000) + '-' + receiverId;

        const forwardPayload = {
          senderId: currentId,
          receiverId: receiverId,
          tempId: tempId,
          text: msg.text || '',
          messageType: msg.messageType || (msg.mediaUrl ? 'image' : 'text'),
          mediaUrl: msg.mediaUrl || null,
          fileName: msg.fileName || null,
          fileSize: msg.fileSize || null,
          stickerId: msg.stickerId || null,
          isForwarded: true,
        };

        const localForwardMsg = {
          id: tempId,
          tempId: tempId,
          sender: 'you',
          senderId: currentId,
          receiverId: receiverId,
          text: forwardPayload.text,
          messageType: forwardPayload.messageType,
          mediaUrl: forwardPayload.mediaUrl,
          fileName: forwardPayload.fileName,
          fileSize: forwardPayload.fileSize,
          stickerId: forwardPayload.stickerId,
          replyTo: null,
          status: 'pending',
          createdAt: new Date().toISOString(),
          isForwarded: true,
        };

        // 1. Optimistically update recipient's conversation in chats list
        setChats((prevChats) => {
          let found = false;
          const updated = (prevChats || []).map((c) => {
            const cId = (c.id || c._id || c.userId)?.toString();
            if (cId === receiverId) {
              found = true;
              return {
                ...c,
                lastMessage: localForwardMsg.text || (localForwardMsg.messageType === 'image' ? '📷 Photo' : 'Forwarded message'),
                lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                messages: deduplicateMessages([...(c.messages || []).filter((m) => m.id !== 'match-init'), localForwardMsg]),
              };
            }
            return c;
          });
          if (!found) {
            updated.push({
              id: receiverId,
              name: receiverName,
              image: targetChatUser.image || targetChatUser.profileImage,
              lastMessage: localForwardMsg.text || (localForwardMsg.messageType === 'image' ? '📷 Photo' : 'Forwarded message'),
              lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              messages: [localForwardMsg],
            });
          }
          return sortChatsByRecent(updated);
        });

        // 2. ONLY update activeChat and Redux messages if the recipient IS the currently open chat!
        if (currentActivePartnerId && currentActivePartnerId === receiverId) {
          setActiveChat((prevActive) => {
            if (!prevActive) return prevActive;
            return {
              ...prevActive,
              messages: deduplicateMessages([...(prevActive.messages || []).filter((m) => m.id !== 'match-init'), localForwardMsg]),
            };
          });
          dispatch(addMessage(localForwardMsg));
        }

        // 3. Send normally over live Socket or REST API fallback
        const onSentSuccess = (serverMsg) => {
          const actualMsg = {
            id: (serverMsg._id || serverMsg.id).toString(),
            tempId: tempId,
            sender: 'you',
            senderId: currentId,
            receiverId: receiverId,
            text: serverMsg.text !== undefined ? serverMsg.text : forwardPayload.text,
            messageType: serverMsg.messageType || forwardPayload.messageType,
            mediaUrl: serverMsg.mediaUrl || forwardPayload.mediaUrl,
            fileName: serverMsg.fileName || forwardPayload.fileName,
            fileSize: serverMsg.fileSize || forwardPayload.fileSize,
            stickerId: serverMsg.stickerId || forwardPayload.stickerId,
            status: serverMsg.status || 'sent',
            createdAt: serverMsg.createdAt || new Date().toISOString(),
            isForwarded: true,
          };

          const replaceTemp = (m) => (m.id === tempId || m.tempId === tempId ? actualMsg : m);

          setChats((prev) => (prev || []).map((c) => {
            const cId = (c.id || c._id || c.userId)?.toString();
            return cId === receiverId ? { ...c, messages: (c.messages || []).map(replaceTemp) } : c;
          }));

          if (currentActivePartnerId && currentActivePartnerId === receiverId) {
            dispatch(addMessage(actualMsg));
            setActiveChat((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: (prev.messages || []).map(replaceTemp),
              };
            });
          }
        };

        if (socketRef.current && socketRef.current.connected) {
          console.log('⚡ Sending forwarded message via Socket:', forwardPayload);
          socketRef.current.emit('send_message', forwardPayload, (res) => {
            if (res && res.status === 'ok' && res.data) {
              onSentSuccess(res.data);
            } else if (res && res.status === 'error') {
              console.log('Socket forward send error, falling back to REST:', res.message);
              apiClient.sendMessage(forwardPayload).then((apiRes) => {
                const sMsg = apiRes?.data || apiRes;
                if (sMsg?._id || sMsg?.id) onSentSuccess(sMsg);
              }).catch((e) => {
                console.log('Forward REST fallback failed, queuing offline:', e);
                setOfflineQueue((prev) => [...prev, { tempId, payload: forwardPayload }]);
              });
            }
          });
        } else {
          console.log('Sending forwarded message via REST API:', forwardPayload);
          apiClient.sendMessage(forwardPayload).then((res) => {
            const sMsg = res?.data || res;
            if (sMsg?._id || sMsg?.id) {
              onSentSuccess(sMsg);
            }
          }).catch((err) => {
            console.log('REST sendMessage forward error, queuing offline:', err);
            setOfflineQueue((prev) => [...prev, { tempId, payload: forwardPayload }]);
          });
        }
      }
    }

    setIsSendingForward(false);
    setShowForwardModal(false);
    setShowMessageActionModal(false);
    setSelectedMessageForAction(null);
    setMessagesToForward([]);
    setSelectedForwardUserIds([]);
    setForwardSearchQuery('');

    if (Platform.OS === 'android') {
      ToastAndroid.show(`Forwarded to ${recipientNames}`, ToastAndroid.SHORT);
    } else {
      Alert.alert('Message Forwarded', `Forwarded to ${recipientNames}`);
    }
  };

  const handleForwardMessageAction = (targetChatUser) => {
    if (!targetChatUser) return;
    const tId = (targetChatUser.id || targetChatUser._id || targetChatUser.userId)?.toString();
    if (tId) {
      setSelectedForwardUserIds([tId]);
    }
  };

  const forwardCandidates = useMemo(() => {
    const currentId = (currentUser?.id || currentUser?._id)?.toString();
    const list = [];
    const seenIds = new Set();

    // 1. Matched users from matches
    if (Array.isArray(matches)) {
      matches.forEach((m) => {
        if (!m) return;
        const mId = (m.id || m._id || m.userId)?.toString();
        if (!mId || mId === currentId || seenIds.has(mId)) return;
        if (blockedUsersList && blockedUsersList.some((b) => (b.id || b._id || b.userId)?.toString() === mId)) return;
        seenIds.add(mId);
        list.push({
          id: mId,
          _id: mId,
          name: m.firstName || m.name || 'Matched User',
          image: m.profileImage || m.image || (Array.isArray(m.photos) ? m.photos[0] : null),
          bio: m.bio || '',
          isOnline: onlineUsersMap[mId] !== undefined ? Boolean(onlineUsersMap[mId]) : Boolean(m.isOnline),
        });
      });
    }

    // 2. Existing chats
    if (Array.isArray(chats)) {
      chats.forEach((c) => {
        if (!c) return;
        const cId = (c.id || c._id || c.userId)?.toString();
        if (!cId || cId === currentId || seenIds.has(cId)) return;
        if (c.isBlocked) return;
        if (blockedUsersList && blockedUsersList.some((b) => (b.id || b._id || b.userId)?.toString() === cId)) return;
        seenIds.add(cId);
        list.push({
          id: cId,
          _id: cId,
          name: c.name || c.firstName || 'Matched User',
          image: c.image || c.profileImage,
          bio: c.bio || '',
          isOnline: onlineUsersMap[cId] !== undefined ? Boolean(onlineUsersMap[cId]) : Boolean(c.isOnline),
        });
      });
    }

    return list;
  }, [matches, chats, currentUser, blockedUsersList, onlineUsersMap]);

  const handleExecuteDeleteAction = async (deleteType) => {
    const msg = selectedMessageForAction;
    if (!msg || !activeChat || !currentUser) return;
    const targetMsgId = (msg.id || msg._id || msg.tempId)?.toString();
    if (!targetMsgId) return;

    const sIdStr = (currentUser.id || currentUser._id || userProfile?.id || userProfile?._id)?.toString();
    const rIdStr = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
    const isEveryone = deleteType === 'everyone';

    // 1. INSTANT (0ms) UI updates - close modals immediately
    setShowDeleteConfirmModal(false);
    setShowMessageActionModal(false);
    setSelectedMessageForAction(null);

    const matchTarget = (m) => {
      if (!m || !targetMsgId) return false;
      const mId = (m.id || m._id)?.toString();
      const mTemp = m.tempId?.toString();
      return mId === targetMsgId || mTemp === targetMsgId;
    };

    // 2. Instant local activeChat & chats state update & Redux update
    if (isEveryone) {
      if (msg.id) deletedMessageIdsRef.current.add(String(msg.id));
      if (msg._id) deletedMessageIdsRef.current.add(String(msg._id));
      if (msg.tempId) deletedMessageIdsRef.current.add(String(msg.tempId));
      deletedMessageIdsRef.current.add(String(targetMsgId));

      const updateDeleted = (m) =>
        matchTarget(m)
          ? {
            ...m,
            text: 'This message was deleted',
            mediaUrl: null,
            fileName: null,
            fileSize: null,
            reactions: [],
            isDeletedForEveryone: true,
          }
          : m;

      setActiveChat((prev) => (prev ? { ...prev, messages: (prev.messages || []).map(updateDeleted) } : null));
      setChats((prev) =>
        (prev || []).map((c) => {
          const cId = (c.id || c._id || c.userId)?.toString();
          if (!rIdStr || cId === rIdStr) {
            return { ...c, messages: (c.messages || []).map(updateDeleted) };
          }
          return c;
        })
      );
      dispatch(deleteForEveryoneInState(targetMsgId));
    } else {
      const removeMsg = (m) => !matchTarget(m);

      setActiveChat((prev) => (prev ? { ...prev, messages: (prev.messages || []).filter(removeMsg) } : null));
      setChats((prev) =>
        (prev || []).map((c) => {
          const cId = (c.id || c._id || c.userId)?.toString();
          if (!rIdStr || cId === rIdStr) {
            return { ...c, messages: (c.messages || []).filter(removeMsg) };
          }
          return c;
        })
      );
      dispatch(deleteForMeInState(targetMsgId));
    }

    // 3. Socket real-time broadcast to partner
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('delete_message', {
        messageId: targetMsgId,
        senderId: sIdStr,
        receiverId: rIdStr,
        deleteType: deleteType,
      });
    }

    // 4. Background REST API call (non-blocking)
    if (!targetMsgId.startsWith('temp-')) {
      apiClient.deleteMessage(targetMsgId, isEveryone).catch((err) => {
        console.warn('API delete message error:', err);
      });
    }
  };

  const toggleSelectMessage = (msg) => {
    if (!msg) return;
    const msgId = (msg.id || msg._id)?.toString();
    if (!msgId || msgId === 'match-init') return;

    setSelectedMultiMessageIds((prev) => {
      let updated;
      if (prev.includes(msgId)) {
        updated = prev.filter((id) => id !== msgId);
      } else {
        updated = [...prev, msgId];
      }
      if (updated.length === 0) {
        setIsMultiSelectMode(false);
        setSelectedMessageForAction(null);
      } else if (updated.length === 1) {
        const found = (activeChat?.messages || []).find((m) => (m.id || m._id)?.toString() === updated[0]);
        if (found) setSelectedMessageForAction(found);
      } else {
        setSelectedMessageForAction(null);
      }
      return updated;
    });
  };

  const handleExecuteMultiDeleteAction = async (deleteType) => {
    if (!activeChat || !currentUser || selectedMultiMessageIds.length === 0) return;
    const sIdStr = (currentUser.id || currentUser._id || userProfile?.id || userProfile?._id)?.toString();
    const rIdStr = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
    const idsToDelete = [...selectedMultiMessageIds];
    const isEveryone = deleteType === 'everyone';
    const idsSet = new Set(idsToDelete.map(String));

    // 1. Instant local state update for 0ms UI responsiveness - close modal immediately
    setIsMultiSelectMode(false);
    setSelectedMultiMessageIds([]);
    setShowDeleteConfirmModal(false);
    setShowMessageActionModal(false);
    setSelectedMessageForAction(null);

    // 2. Instant local activeChat & chats state update
    if (isEveryone) {
      idsToDelete.forEach((id) => deletedMessageIdsRef.current.add(String(id)));

      const updateDeleted = (m) => {
        const mId = (m.id || m._id)?.toString();
        const mTemp = m.tempId?.toString();
        const isTarget = idsSet.has(mId) || (mTemp && idsSet.has(mTemp));
        return isTarget
          ? {
            ...m,
            text: 'This message was deleted',
            mediaUrl: null,
            fileName: null,
            fileSize: null,
            reactions: [],
            isDeletedForEveryone: true,
          }
          : m;
      };
      setActiveChat((prev) => (prev ? { ...prev, messages: (prev.messages || []).map(updateDeleted) } : null));
      setChats((prev) =>
        (prev || []).map((c) => {
          const cId = (c.id || c._id || c.userId)?.toString();
          return !rIdStr || cId === rIdStr ? { ...c, messages: (c.messages || []).map(updateDeleted) } : c;
        })
      );
      idsToDelete.forEach((id) => dispatch(deleteForEveryoneInState(id)));
    } else {
      const removeMsgs = (m) => {
        const mId = (m.id || m._id)?.toString();
        const mTemp = m.tempId?.toString();
        return !idsSet.has(mId) && (!mTemp || !idsSet.has(mTemp));
      };
      setActiveChat((prev) => (prev ? { ...prev, messages: (prev.messages || []).filter(removeMsgs) } : null));
      setChats((prev) =>
        (prev || []).map((c) => {
          const cId = (c.id || c._id || c.userId)?.toString();
          return !rIdStr || cId === rIdStr ? { ...c, messages: (c.messages || []).filter(removeMsgs) } : c;
        })
      );
      idsToDelete.forEach((id) => dispatch(deleteForMeInState(id)));
    }

    // 3. Emit socket delete event & REST API call for each message in background
    for (const msgId of idsToDelete) {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('delete_message', {
          messageId: msgId,
          senderId: sIdStr,
          receiverId: rIdStr,
          deleteType: deleteType,
        });
      }

      if (!msgId.startsWith('temp-')) {
        apiClient.deleteMessage(msgId, isEveryone).catch((err) => {
          console.warn('API deleteMessage notice for ID', msgId, err?.message || err);
        });
      }
    }
  };

  const handleCopyMultiMessages = () => {
    if (!activeChat || selectedMultiMessageIds.length === 0) return;
    const selectedMsgs = (activeChat.messages || []).filter((m) => {
      const mId = (m.id || m._id)?.toString();
      return selectedMultiMessageIds.includes(mId);
    });
    const combinedText = selectedMsgs
      .map((m) => m.text)
      .filter(Boolean)
      .join('\n');
    if (combinedText) {
      Clipboard.setString(combinedText);
      if (Platform.OS === 'android') {
        ToastAndroid.show(`${selectedMsgs.length} message${selectedMsgs.length > 1 ? 's' : ''} copied`, ToastAndroid.SHORT);
      } else {
        Alert.alert('Copied', `${selectedMsgs.length} message${selectedMsgs.length > 1 ? 's' : ''} copied to clipboard`);
      }
    }
    setIsMultiSelectMode(false);
    setSelectedMultiMessageIds([]);
  };

  const handleForwardMultiMessages = () => {
    if (!activeChat || selectedMultiMessageIds.length === 0) return;
    const selectedMsgs = (activeChat.messages || []).filter((m) => {
      const mId = (m.id || m._id)?.toString();
      const mTempId = m.tempId?.toString();
      return selectedMultiMessageIds.includes(mId) || (mTempId && selectedMultiMessageIds.includes(mTempId));
    });
    if (selectedMsgs.length > 0) {
      setMessagesToForward(selectedMsgs);
      setSelectedMessageForAction(selectedMsgs[0]);
      setIsMultiSelectMode(false);
      setSelectedMultiMessageIds([]);
      setSelectedForwardUserIds([]);
      setForwardSearchQuery('');
      setShowForwardModal(true);
    }
  };


  const handleClearChat = () => {
    if (!activeChat) return;

    const selectedUserId = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
    const targetName = activeChat.name || activeChat.firstName || 'this chat';

    Alert.alert(
      'Clear this chat?',
      `Are you sure you want to clear all messages in your chat with ${targetName}? This action will delete the messages from your screen only.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Chat',
          style: 'destructive',
          onPress: async () => {
            if (!selectedUserId) return;

            // 1. Immediately track all message IDs in deletedMessageIdsRef so background sync never restores them
            const currentMsgs = activeChat?.messages || [];
            currentMsgs.forEach((m) => {
              if (m.id && m.id !== 'match-init') deletedMessageIdsRef.current.add(String(m.id));
              if (m._id) deletedMessageIdsRef.current.add(String(m._id));
              if (m.tempId) deletedMessageIdsRef.current.add(String(m.tempId));
            });

            // 2. Reset UI sub-states (pins, selections, reply, edit, search)
            setPinnedMessage(null);
            setSelectedMessageForAction(null);
            setIsMultiSelectMode(false);
            setSelectedMultiMessageIds([]);
            setIsSearchInChatActive(false);
            setChatSearchQuery('');
            setChatSearchMatchIndex(0);
            setReplyingToMessage(null);
            setEditingMessage(null);
            typedMessageRef.current = '';
            setTypedMessage('');

            const placeholderMsg = [
              {
                id: 'match-init',
                sender: 'them',
                text: `It's a Match! Say hi to ${targetName}! 👋`,
              },
            ];

            // 3. Instant local state update on user's screen (0ms UI latency)
            setActiveChat((prevActive) => {
              if (!prevActive) return prevActive;
              const pId = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
              if (pId === selectedUserId) {
                return {
                  ...prevActive,
                  messages: placeholderMsg,
                };
              }
              return prevActive;
            });

            setChats((prevChats) =>
              prevChats.map((c) => {
                const cId = (c.id || c._id || c.userId)?.toString();
                if (cId === selectedUserId) {
                  return {
                    ...c,
                    messages: placeholderMsg,
                    lastMessage: '',
                    lastMessageTime: '',
                  };
                }
                return c;
              })
            );

            // 4. Update Redux store (clears active thread & purges partner messages from allMessages)
            dispatch(clearChat(selectedUserId));
            dispatch(setMessages([]));

            // 5. Clean local storage cache (both persistent_unsent_messages and cached_chat_messages)
            try {
              const currentUserIdStr = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
              if (currentUserIdStr) {
                const unsentStr = await AsyncStorage.getItem(`persistent_unsent_messages_${currentUserIdStr}`);
                if (unsentStr) {
                  const unsentList = JSON.parse(unsentStr);
                  if (Array.isArray(unsentList)) {
                    const filtered = unsentList.filter((item) => item.partnerId?.toString() !== selectedUserId);
                    await AsyncStorage.setItem(`persistent_unsent_messages_${currentUserIdStr}`, JSON.stringify(filtered));
                  }
                }
                const cachedStr = await AsyncStorage.getItem(`cached_chat_messages_${currentUserIdStr}`);
                if (cachedStr) {
                  const cachedList = JSON.parse(cachedStr);
                  if (Array.isArray(cachedList)) {
                    const filteredCache = cachedList.filter((m) => {
                      const rId = (m.receiverId?._id || m.receiverId || m.receiver)?.toString();
                      const sId = (m.senderId?._id || m.senderId || m.sender)?.toString();
                      return rId !== selectedUserId && sId !== selectedUserId;
                    });
                    await AsyncStorage.setItem(`cached_chat_messages_${currentUserIdStr}`, JSON.stringify(filteredCache));
                  }
                }
              }
            } catch (e) { }

            // 6. Call server API to mark deletedBySender / deletedByReceiver for this user
            try {
              await apiClient.clearChat(selectedUserId);
              console.log('Chat cleared successfully on server for user:', selectedUserId);
              if (typeof refetchMessages === 'function') {
                refetchMessages();
              }
            } catch (err) {
              console.error('Failed to clear chat on server:', err);
              Alert.alert('Error', 'Failed to clear chat history on server.');
            }
          },
        },
      ]
    );
  };

  const handleUnmatch = (targetUserIdParam, targetUserNameParam) => {
    const currentCandidate = swipeIndex < MOCK_MATCHES.length ? MOCK_MATCHES[swipeIndex] : null;
    const targetUserId = (targetUserIdParam || (activeChat && (activeChat.id || activeChat._id || activeChat.userId)) || (currentCandidate && (currentCandidate.id || currentCandidate._id)))?.toString();
    const targetUserName = targetUserNameParam || (activeChat && (activeChat.name || activeChat.firstName)) || (currentCandidate && (currentCandidate.name || currentCandidate.firstName)) || 'this user';

    if (!targetUserId) return;

    Alert.alert(
      'Unmatch User',
      `Are you sure you want to unmatch ${targetUserName}? This will permanently delete your match and chat history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: () => {
            // ⚡ 1. Instant local state update & close chat (0ms UI latency)
            if (activeChat && (activeChat.id || activeChat._id || activeChat.userId)?.toString() === targetUserId) {
              dispatch(setMessages([]));
              dispatch(setActiveChatUser(null));
              setActiveChat(null);
            }
            setShowActiveCardDetails(false);
            setChats((prevChats) => prevChats.filter((c) => (c.id || c._id || c.userId)?.toString() !== targetUserId));
            setMatchedUserIds((prevIds) => prevIds.filter((id) => id.toString() !== targetUserId));

            // ⚡ 2. Execute API in background
            apiClient.unmatchUser({ targetUserId })
              .then(() => {
                console.log('Unmatched user successfully:', targetUserId);
                if (typeof refetchMatchesList === 'function') refetchMatchesList();
                if (typeof refetchMessages === 'function') refetchMessages();
              })
              .catch((err) => {
                console.error('Failed to unmatch user on server:', err);
                Alert.alert('Error', 'Failed to unmatch user on server.');
                if (typeof refetchMatchesList === 'function') refetchMatchesList();
              });
          },
        },
      ]
    );
  };

  const handleSuperLikeSwipe = async () => {
    if (swipeIndex >= MOCK_MATCHES.length) return;
    const currentCandidate = MOCK_MATCHES[swipeIndex];
    const targetUserId = currentCandidate._id || currentCandidate.id;

    const activeUserObj = userProfile || currentUser;
    let perms = subscriptionPermissions || activeUserObj?.subscriptionPermissions;

    if (!perms) {
      try {
        const freshSub = await apiClient.getMySubscription();
        if (freshSub && freshSub.success && freshSub.permissions) {
          perms = freshSub.permissions;
          setSubscriptionPermissions(freshSub.permissions);
        }
      } catch (_) { }
    }

    const isSuperLikeAllowed = Boolean(perms?.superLikes?.isAllowed);

    if (!isSuperLikeAllowed) {
      Alert.alert(
        '⭐ Super Likes Locked',
        'Super Likes are not included in your current subscription. Upgrade your plan to get Super Likes!',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Plans',
            onPress: () => setIsSubscriptionModalOpen(true),
          },
        ]
      );
      return;
    }

    try {
      const res = await apiClient.superLikeUser({
        targetUserId,
      });

      if (res?.isMatch) {
        Alert.alert("It's a Match! 🎉", `You and ${currentCandidate.firstName || currentCandidate.name} Super Liked each other!`);
      } else {
        Alert.alert('Super Liked! ⭐', `You Super Liked ${currentCandidate.firstName || currentCandidate.name}!`);
      }
      setSwipeIndex((prev) => prev + 1);
    } catch (err) {
      console.log('Superlike swipe error:', err);

      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        friction: 5,
        tension: 40,
        useNativeDriver: false,
      }).start();

      const msg = err?.response?.data?.message || err?.data?.message || err?.message || 'Your super likes limit have reached';
      Alert.alert(
        '⭐ Limit Reached',
        msg,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade Now',
            onPress: () => setIsSubscriptionModalOpen(true),
          },
        ]
      );
    }
  };

  const handleBlockUser = (targetUserIdParam, targetUserNameParam) => {
    const currentCandidate = (Array.isArray(MOCK_MATCHES) && swipeIndex >= 0 && swipeIndex < MOCK_MATCHES.length) ? MOCK_MATCHES[swipeIndex] : null;
    const resolvedTargetId = targetUserIdParam || (activeChat && (activeChat.id || activeChat._id || activeChat.userId)) || (currentCandidate && (currentCandidate.id || currentCandidate._id || currentCandidate.userId));
    const targetUserName = targetUserNameParam || (activeChat && (activeChat.name || activeChat.firstName)) || (currentCandidate && (currentCandidate.name || currentCandidate.firstName)) || 'this user';

    if (!resolvedTargetId) {
      console.warn('[handleBlockUser] Could not resolve valid targetUserId.');
      Alert.alert('Block User', 'Unable to find user details to block.');
      return;
    }

    const targetIdStr = (typeof resolvedTargetId === 'object' ? (resolvedTargetId.id || resolvedTargetId._id) : resolvedTargetId).toString();

    Alert.alert(
      `Block ${targetUserName}?`,
      `Blocked contacts will no longer be able to call you or send you messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            // ⚡ 1. Instant local state update (0ms UI latency)
            setBlockedUsersList((prev) => [
              ...prev,
              { id: targetIdStr, _id: targetIdStr, name: targetUserName }
            ]);

            if (activeChat && (activeChat.id || activeChat._id || activeChat.userId)?.toString() === targetIdStr) {
              setActiveChat((prev) => prev ? { ...prev, isBlocked: true } : null);
            }
            setShowActiveCardDetails(false);
            setChats((prevChats) => prevChats.map((c) => {
              const cId = (c.id || c._id || c.userId)?.toString();
              if (cId === targetIdStr) {
                return { ...c, isBlocked: true };
              }
              return c;
            }));

            // ⚡ 2. Execute API in background
            apiClient.blockUser({ targetUserId: targetIdStr, targetId: targetIdStr, userId: targetIdStr })
              .then((res) => {
                console.log('Blocked user successfully:', res || targetIdStr);
                if (typeof fetchBlockedUsers === 'function') fetchBlockedUsers();
                if (typeof fetchQuestionnaires === 'function') fetchQuestionnaires();
                if (typeof fetchMatchesList === 'function') fetchMatchesList();
                if (typeof fetchMessages === 'function') fetchMessages();
                if (typeof fetchLikes === 'function') fetchLikes();
              })
              .catch((err) => {
                console.error('Failed to block user on server:', err);
                const errMsg = err?.data?.message || (err?.message && err.message !== 'Aborted' ? err.message : 'Request failed. Please try again.');
                Alert.alert('Block Error', errMsg);
              });
          },
        },
      ]
    );
  };

  const handleUnblockUser = (targetUserIdParam, targetUserNameParam) => {
    const currentCandidate = (Array.isArray(MOCK_MATCHES) && swipeIndex >= 0 && swipeIndex < MOCK_MATCHES.length) ? MOCK_MATCHES[swipeIndex] : null;
    const resolvedTargetId = targetUserIdParam || (activeChat && (activeChat.id || activeChat._id || activeChat.userId)) || (currentCandidate && (currentCandidate.id || currentCandidate._id || currentCandidate.userId));
    const targetUserName = targetUserNameParam || (activeChat && (activeChat.name || activeChat.firstName)) || (currentCandidate && (currentCandidate.name || currentCandidate.firstName)) || 'this user';

    if (!resolvedTargetId) {
      console.warn('[handleUnblockUser] Could not resolve valid targetUserId.');
      Alert.alert('Unblock User', 'Unable to find user details to unblock.');
      return;
    }

    const targetIdStr = (typeof resolvedTargetId === 'object' ? (resolvedTargetId.id || resolvedTargetId._id) : resolvedTargetId).toString();

    Alert.alert(
      `Unblock ${targetUserName}?`,
      `Unblock ${targetUserName} to send a message.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () => {
            // ⚡ 1. Instant local state update (0ms UI latency)
            setBlockedUsersList((prev) => prev.filter((b) => (b.id || b._id || b.userId)?.toString() !== targetIdStr));

            if (activeChat && (activeChat.id || activeChat._id || activeChat.userId)?.toString() === targetIdStr) {
              setActiveChat((prev) => prev ? { ...prev, isBlocked: false } : null);
            }
            setChats((prevChats) => prevChats.map((c) => {
              const cId = (c.id || c._id || c.userId)?.toString();
              if (cId === targetIdStr) {
                return { ...c, isBlocked: false };
              }
              return c;
            }));

            // ⚡ 2. Execute API in background
            apiClient.unblockUser({ targetUserId: targetIdStr, targetId: targetIdStr, userId: targetIdStr })
              .then(() => {
                console.log('Unblocked user successfully:', targetIdStr);
                if (typeof fetchBlockedUsers === 'function') fetchBlockedUsers();
                if (typeof fetchQuestionnaires === 'function') fetchQuestionnaires();
                if (typeof fetchMatchesList === 'function') fetchMatchesList();
                if (typeof fetchMessages === 'function') fetchMessages();
                if (typeof fetchLikes === 'function') fetchLikes();
              })
              .catch((err) => {
                console.error('Failed to unblock user on server:', err);
                Alert.alert('Error', 'Failed to unblock user on server.');
              });
          },
        },
      ]
    );
  };

  const openReportForm = (idParam, nameParam) => {
    try {
      const currentCandidate = (Array.isArray(MOCK_MATCHES) && swipeIndex >= 0 && swipeIndex < MOCK_MATCHES.length) ? MOCK_MATCHES[swipeIndex] : null;
      const targetUserId = idParam || (activeChat && (activeChat.id || activeChat._id || activeChat.userId)) || (currentCandidate && (currentCandidate.id || currentCandidate._id || currentCandidate.userId));
      const targetUserName = nameParam || (activeChat && (activeChat.name || activeChat.firstName)) || (currentCandidate && (currentCandidate.name || currentCandidate.firstName)) || 'User';

      if (!targetUserId) {
        console.warn('[openReportForm] Could not resolve valid targetUserId.');
        Alert.alert('Report Profile', 'Unable to find user details for reporting.');
        return;
      }

      setReportTargetUser({ id: targetUserId.toString(), name: targetUserName });
      setSelectedReportReason('Inappropriate Photos or Content');
      setReportDetails('');
      setAlsoBlockOnReport(false);
      setShowReportModal(true);
    } catch (err) {
      console.error('Error opening report form:', err);
      Alert.alert('Error', 'Unable to open report window.');
    }
  };

  const handleFormSubmitReport = async () => {
    if (!reportTargetUser || !reportTargetUser.id) return;

    try {
      setIsSubmittingReport(true);
      const targetIdStr = reportTargetUser.id.toString();

      await apiClient.reportUser({
        reportedId: targetIdStr,
        reason: selectedReportReason,
        details: reportDetails,
      });

      if (alsoBlockOnReport) {
        try {
          await apiClient.blockUser({ targetUserId: targetIdStr });
        } catch (bErr) {
          console.warn('Block on report notice:', bErr);
        }
      }

      setShowReportModal(false);
      setIsSubmittingReport(false);

      Alert.alert(
        'Report Submitted 🛡️',
        `Thank you for reporting ${reportTargetUser.name || 'this user'}. Our admin moderation team will review this profile.`
      );

      if (alsoBlockOnReport) {
        setBlockedUsersList((prev) => [
          ...prev,
          { id: targetIdStr, _id: targetIdStr, name: reportTargetUser?.name || 'User' }
        ]);

        if (activeChat && (activeChat.id || activeChat._id || activeChat.userId)?.toString() === targetIdStr) {
          setActiveChat((prev) => prev ? { ...prev, isBlocked: true } : null);
        }
        setShowActiveCardDetails(false);
        setChats((prevChats) => prevChats.map((c) => {
          const cId = (c.id || c._id || c.userId)?.toString();
          if (cId === targetIdStr) {
            return { ...c, isBlocked: true };
          }
          return c;
        }));

        if (typeof fetchBlockedUsers === 'function') fetchBlockedUsers();
        if (typeof fetchQuestionnaires === 'function') fetchQuestionnaires();
        if (typeof fetchMatchesList === 'function') fetchMatchesList();
        if (typeof fetchMessages === 'function') fetchMessages();
        if (typeof fetchLikes === 'function') fetchLikes();
      }
    } catch (err) {
      console.error('Failed to submit report:', err);
      setIsSubmittingReport(false);
      const errMsg = err?.data?.message || err?.message || 'Failed to submit report. Please try again.';
      Alert.alert('Report Error', errMsg);
    }
  };

  const handleReportUser = (targetUserIdParam, targetUserNameParam) => {
    openReportForm(targetUserIdParam, targetUserNameParam);
  };

  const handleChatMenu = () => {
    if (!activeChat) return;
    setShowChatOptionsMenuModal(true);
  };

  const toggleSelectChat = (chat) => {
    const cId = (chat.id || chat._id || chat.userId)?.toString();
    if (!cId) return;
    setSelectedChatIds((prev) =>
      prev.includes(cId) ? prev.filter((id) => id !== cId) : [...prev, cId]
    );
  };

  const handleSelectAllChats = () => {
    if (selectedChatIds.length === chats.length) {
      setSelectedChatIds([]);
    } else {
      setSelectedChatIds(chats.map((c) => (c.id || c._id || c.userId)?.toString()).filter(Boolean));
    }
  };

  const handleDeleteSelectedChats = () => {
    if (selectedChatIds.length === 0) return;
    const count = selectedChatIds.length;
    Alert.alert(
      `Delete ${count} Conversation${count > 1 ? 's' : ''}?`,
      `Are you sure you want to delete ${count === 1 ? 'this conversation' : `these ${count} conversations`}? This will delete the chat history for you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const idsToDelete = [...selectedChatIds];
            setSelectedChatIds([]);
            try {
              setChats((prev) =>
                (prev || []).filter((c) => !idsToDelete.includes((c.id || c._id || c.userId)?.toString()))
              );
              if (activeChat && idsToDelete.includes((activeChat.id || activeChat._id || activeChat.userId)?.toString())) {
                dispatch(setMessages([]));
                dispatch(setActiveChatUser(null));
                setActiveChat(null);
              }

              await Promise.allSettled(
                idsToDelete.map((targetId) => apiClient.clearChat(targetId))
              );
              console.log(`[handleDeleteSelectedChats] Deleted ${idsToDelete.length} conversations`);
              refetchMessages();
            } catch (err) {
              console.error('Error deleting selected conversations:', err);
              Alert.alert('Error', 'Failed to delete some conversations.');
            }
          },
        },
      ]
    );
  };

  const handleClearAllConversations = () => {
    Alert.alert(
      'Delete All Conversations',
      'Are you sure you want to clear all your conversations? This will only delete them for you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.clearAllChats();
              console.log('All conversations cleared successfully');

              // Clear activeChat if open, and empty chats list
              dispatch(setMessages([]));
              dispatch(setActiveChatUser(null));
              setActiveChat(null);
              setChats([]);
              refetchMessages();
            } catch (err) {
              console.error('Failed to delete all conversations:', err);
              Alert.alert('Error', 'Failed to clear conversations.');
            }
          },
        },
      ]
    );
  };

  const handleAttachPress = () => {
    Keyboard.dismiss();
    setShowStickerPicker(false);
    setShowEmojiPicker(false);
    setShowAttachmentModal(true);
  };

  const handleEmojiPress = () => {
    Keyboard.dismiss();
    setShowStickerPicker(false);
    setShowEmojiPicker(!showEmojiPicker);
  };

  const handleEmojiSelected = (emojiObj) => {
    const char = emojiObj?.emoji;
    if (!char) return;
    if (reactingToMessageForEmoji) {
      handleEmojiReaction(char, reactingToMessageForEmoji);
      setReactingToMessageForEmoji(null);
      setShowEmojiPicker(false);
    } else {
      typedMessageRef.current = (typedMessageRef.current || '') + char;
      setTypedMessage((prev) => (prev || '') + char);
    }
  };

  const handleStickerPress = () => {
    Keyboard.dismiss();
    setShowEmojiPicker(false);
    setShowStickerPicker(!showStickerPicker);
  };

  const selectSticker = (sticker) => {
    if (reactingToMessageForEmoji) {
      handleEmojiReaction(sticker.char, reactingToMessageForEmoji);
      setReactingToMessageForEmoji(null);
    } else {
      handleSendMessage({
        messageType: 'sticker',
        stickerId: sticker.id,
        mediaUrl: sticker.url || sticker.char,
        text: sticker.label || 'Sticker',
      });
      setRecentStickers((prev) => {
        const filtered = prev.filter((s) => s.id !== sticker.id);
        return [sticker, ...filtered].slice(0, 16);
      });
    }
    setShowStickerPicker(false);
  };

  const detectChatMediaType = (fileName = '', mimeType = '') => {
    const lowerName = (fileName || '').toLowerCase();
    const lowerMime = (mimeType || '').toLowerCase();
    if (
      lowerMime.startsWith('audio/') ||
      /\.(mp3|m4a|wav|aac|ogg|opus)$/i.test(lowerName) ||
      lowerName.startsWith('voice_')
    ) {
      return 'voice';
    }
    if (lowerMime.startsWith('video/') || /\.(mp4|mov|mkv|avi|webm|3gp|m4v|flv)$/i.test(lowerName)) {
      return 'video';
    }
    if (lowerMime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(lowerName)) {
      return 'image';
    }
    return 'document';
  };

  const resolveChatMimeType = (fileName = '', rawType = '', mediaType = 'document') => {
    if (rawType && rawType !== 'application/octet-stream' && rawType !== '*/*') {
      return rawType;
    }
    const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
    if (['mp3'].includes(ext)) return 'audio/mpeg';
    if (['m4a', 'aac'].includes(ext)) return 'audio/m4a';
    if (['wav'].includes(ext)) return 'audio/wav';
    if (['ogg', 'opus'].includes(ext)) return 'audio/ogg';
    if (['mp4', 'm4v'].includes(ext)) return (mediaType === 'voice' || mediaType === 'audio') ? 'audio/mp4' : 'video/mp4';
    if (['mov', 'qt'].includes(ext)) return 'video/quicktime';
    if (['mkv'].includes(ext)) return 'video/x-matroska';
    if (['avi'].includes(ext)) return 'video/x-msvideo';
    if (['webm'].includes(ext)) return 'video/webm';
    if (['3gp'].includes(ext)) return 'video/3gpp';
    if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
    if (['png'].includes(ext)) return 'image/png';
    if (['webp'].includes(ext)) return 'image/webp';
    if (['gif'].includes(ext)) return 'image/gif';
    if (['pdf'].includes(ext)) return 'application/pdf';
    if (['doc', 'docx'].includes(ext)) return 'application/msword';
    if (['xls', 'xlsx'].includes(ext)) return 'application/vnd.ms-excel';
    if (['txt'].includes(ext)) return 'text/plain';
    if (mediaType === 'voice' || mediaType === 'audio') return 'audio/mp4';
    if (mediaType === 'video') return 'video/mp4';
    if (mediaType === 'image') return 'image/jpeg';
    return 'application/pdf';
  };

  const handlePickImage = () => {
    setShowAttachmentModal(false);
    const options = {
      mediaType: 'mixed',
      quality: 0.85,
    };
    launchImageLibrary(options, (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        Alert.alert('Error', response.errorMessage);
        return;
      }
      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        const selectedUri = asset.uri;
        if (!selectedUri) return;

        // Validate max file size (100 MB)
        const maxSizeBytes = 100 * 1024 * 1024;
        if (asset.fileSize && asset.fileSize > maxSizeBytes) {
          Alert.alert('File Too Large', 'The selected file/video exceeds the 100MB limit. Please select a smaller file.');
          return;
        }

        const rawFileName = asset.fileName || '';
        const detectedType = detectChatMediaType(rawFileName, asset.type);
        const fallbackExt = detectedType === 'video' ? 'mp4' : 'jpg';
        const pickedFileName = rawFileName || `media_${Date.now()}.${fallbackExt}`;
        const mimeType = resolveChatMimeType(pickedFileName, asset.type, detectedType);

        // Open WhatsApp-style preview modal; do not send immediately
        setPendingMediaSend({
          uri: selectedUri,
          fileName: pickedFileName,
          fileSize: asset.fileSize || 0,
          type: mimeType,
          mediaType: detectedType,
          asset: asset,
        });
        setMediaCaptionText('');
        setIsMediaUploading(false);
      }
    });
  };

  const handlePickRealDocument = async () => {
    setShowAttachmentModal(false);
    try {
      let asset = null;
      if (typeof pickDocument === 'function') {
        try {
          const pickerRes = await pickDocument({
            type: [documentTypes.pdf, documentTypes.video, documentTypes.docx, documentTypes.doc, documentTypes.plainText, documentTypes.images, documentTypes.allFiles],
          });
          if (pickerRes && pickerRes.length > 0) {
            asset = {
              uri: pickerRes[0].uri,
              fileName: pickerRes[0].name,
              type: pickerRes[0].type,
              fileSize: pickerRes[0].size,
            };
          }
        } catch (docErr) {
          if (isDocumentCancel && isDocumentCancel(docErr)) {
            return;
          }
          console.log('DocumentPicker error, falling back:', docErr);
        }
      }

      if (!asset) {
        const options = { mediaType: 'mixed', selectionLimit: 1, includeBase64: false };
        const response = await launchImageLibrary(options);
        if (response.didCancel || !response.assets || response.assets.length === 0) return;
        asset = response.assets[0];
      }

      if (!asset || !asset.uri) return;

      // Validate max file size (100 MB)
      const maxSizeBytes = 100 * 1024 * 1024;
      if (asset.fileSize && asset.fileSize > maxSizeBytes) {
        Alert.alert('File Too Large', 'The selected file/video exceeds the 100MB limit. Please select a smaller file.');
        return;
      }

      const rawFileName = asset.fileName || '';
      const detectedType = detectChatMediaType(rawFileName, asset.type);
      const fallbackExt = detectedType === 'video' ? 'mp4' : detectedType === 'image' ? 'jpg' : 'pdf';
      const pickedFileName = rawFileName || `document_${Date.now()}.${fallbackExt}`;
      const mimeType = resolveChatMimeType(pickedFileName, asset.type, detectedType);

      // Open WhatsApp-style preview modal; do not send immediately
      setPendingMediaSend({
        uri: asset.uri,
        fileName: pickedFileName,
        fileSize: asset.fileSize || 0,
        type: mimeType,
        mediaType: detectedType,
        asset: asset,
      });
      setMediaCaptionText('');
      setIsMediaUploading(false);
    } catch (err) {
      console.error('Pick document error:', err);
      Alert.alert('Error', 'Failed to pick file from device.');
    }
  };

  const handleConfirmSendMedia = async () => {
    if (!pendingMediaSend || isMediaUploading) return;
    setIsMediaUploading(true);

    try {
      const { uri, fileName, fileSize, type, mediaType } = pendingMediaSend;
      const formData = new FormData();

      let uploadUri = uri;
      if (Platform.OS === 'android') {
        uploadUri = uri.startsWith('file://') || uri.startsWith('content://') ? uri : `file://${uri}`;
      } else {
        uploadUri = uri.replace('file://', '');
      }

      formData.append('file', {
        uri: uploadUri,
        name: fileName,
        type: type,
      });

      console.log(`[handleConfirmSendMedia] Uploading ${mediaType} to server:`, fileName, type, uploadUri);
      const res = await apiClient.uploadChatMedia(formData);

      const uploadedUrl = res?.url || res?.data?.url;
      const finalFileName = res?.fileName || fileName;
      const finalFileSize = res?.fileSize || fileSize;

      if (!uploadedUrl) {
        throw new Error('Server did not return a valid media URL.');
      }

      const isVoiceOrAudio = mediaType === 'voice' || mediaType === 'audio';
      const caption = mediaCaptionText.trim();
      const messageText = caption || finalFileName || (mediaType === 'image' ? '📷 Photo' : mediaType === 'video' ? '🎬 Video' : isVoiceOrAudio ? '🎤 Voice Note' : '📄 Document');

      handleSendMessage({
        text: messageText,
        messageType: isVoiceOrAudio ? 'voice' : mediaType,
        mediaUrl: uploadedUrl,
        fileName: finalFileName,
        fileSize: finalFileSize,
      });

      setPendingMediaSend(null);
      setMediaCaptionText('');
    } catch (uploadErr) {
      console.error('Confirm send media failed:', uploadErr);
      const errMsg = uploadErr?.message || 'Failed to upload file to server. Please try again.';
      Alert.alert('Upload Error', errMsg);
    } finally {
      setIsMediaUploading(false);
    }
  };

  const handleCancelSendMedia = () => {
    if (isMediaUploading) return;
    setPendingMediaSend(null);
    setMediaCaptionText('');
    setIsMediaUploading(false);
  };

  // --- Voice Note Recording & Playback Implementation ---
  const startRecording = async () => {
    try {
      if (Platform.OS === 'android') {
        const hasMicPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (!hasMicPerm) {
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Microphone permission is required to record voice notes.');
            return;
          }
        }
      }

      // Stop any audio currently playing
      if (audioRecorderPlayerRef.current) {
        try { await audioRecorderPlayerRef.current.stopPlayer(); } catch (_) { }
      }
      setPlayingMessageId(null);

      if (!audioRecorderPlayerRef.current) {
        audioRecorderPlayerRef.current = createSound();
      }

      // Start recording via nitro-sound
      if (audioRecorderPlayerRef.current && typeof audioRecorderPlayerRef.current.startRecorder === 'function') {
        await audioRecorderPlayerRef.current.startRecorder();
      }

      setIsRecording(true);
      setRecordingSeconds(0);
      setRecordTime('0:00');

      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const nextSec = prev + 1;
          const mins = Math.floor(nextSec / 60);
          const secs = nextSec % 60;
          setRecordTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
          return nextSec;
        });
      }, 1000);
    } catch (e) {
      console.error('Error starting voice note recording:', e);
      Alert.alert('Recording Error', 'Unable to start recording voice note.');
    }
  };

  const stopRecording = async (shouldSend = true) => {
    try {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
      setIsRecording(false);

      let recordedPath = '';
      if (audioRecorderPlayerRef.current && typeof audioRecorderPlayerRef.current.stopRecorder === 'function') {
        try {
          recordedPath = await audioRecorderPlayerRef.current.stopRecorder();
        } catch (stopErr) {
          console.warn('stopRecorder exception caught gracefully:', stopErr);
        }
      }

      if (!shouldSend) {
        setRecordingSeconds(0);
        setRecordTime('0:00');
        return;
      }

      if (recordingSeconds < 1 || !recordedPath) {
        Alert.alert('Voice Note Too Short', 'Please hold or tap record for at least 1 second.');
        setRecordingSeconds(0);
        setRecordTime('0:00');
        return;
      }

      // Prepare audio upload payload
      const audioUri = recordedPath || '';
      if (!audioUri) {
        Alert.alert('Recording Error', 'No voice recording audio found.');
        return;
      }

      let formattedUri = audioUri;
      if (Platform.OS === 'android') {
        const cleanPath = audioUri.replace(/^file:\/*/, '');
        formattedUri = `file:///${cleanPath}`;
      } else {
        formattedUri = audioUri.replace(/^file:\/*/, '');
      }

      const ext = Platform.OS === 'ios' ? 'm4a' : 'mp4';
      const fileName = `voice_${Date.now()}.${ext}`;

      const formData = new FormData();
      formData.append('file', {
        uri: formattedUri,
        name: fileName,
        type: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4',
      });

      try {
        const uploadRes = await apiClient.uploadChatMedia(formData);
        const voiceUrl = uploadRes.url || uploadRes.data?.url || audioUri;

        handleSendMessage({
          text: 'Voice message',
          messageType: 'voice',
          mediaUrl: voiceUrl,
          localAudioUri: audioUri,
          fileName: fileName,
          fileSize: uploadRes.fileSize || 0,
        });
      } catch (uploadErr) {
        console.error('Error uploading voice note audio:', uploadErr);
        Alert.alert('Upload Error', 'Failed to upload voice note to server. Please check your internet connection.');
      }
    } catch (e) {
      console.error('Error stopping voice note recording:', e);
    } finally {
      setRecordingSeconds(0);
      setRecordTime('0:00');
    }
  };

  const playVoiceNote = async (msgId, rawMediaUrl, messageObj = null) => {
    try {
      // If user taps play on currently playing voice note, pause/stop it
      if (playingMessageId === msgId) {
        if (audioRecorderPlayerRef.current) {
          try {
            audioRecorderPlayerRef.current.removePlayBackListener();
            audioRecorderPlayerRef.current.removePlaybackEndListener();
            await audioRecorderPlayerRef.current.stopPlayer();
          } catch (_) { }
        }
        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        setPlayingMessageId(null);
        setPlaybackPosition(0);
        setPlaybackDuration(0);
        return;
      }

      // Stop any existing audio playing first
      if (audioRecorderPlayerRef.current) {
        try {
          audioRecorderPlayerRef.current.removePlayBackListener();
          audioRecorderPlayerRef.current.removePlaybackEndListener();
          await audioRecorderPlayerRef.current.stopPlayer();
        } catch (_) { }
      }
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);

      setPlayingMessageId(msgId);
      setPlaybackPosition(0);
      setPlaybackDuration(0);

      const sound = createSound();
      audioRecorderPlayerRef.current = sound;

      if (typeof sound.setSubscriptionDuration === 'function') {
        try { sound.setSubscriptionDuration(0.1); } catch (_) { }
      }

      try {
        sound.removePlayBackListener();
        sound.addPlayBackListener((e) => {
          if (e && typeof e.currentPosition === 'number') {
            const now = Date.now();
            if (now - lastPlaybackUpdateRef.current > 150) {
              lastPlaybackUpdateRef.current = now;
              setPlaybackPosition(e.currentPosition);
              if (e.duration && e.duration > 0) {
                setPlaybackDuration(e.duration);
              }
            }
          }
        });
      } catch (listenerErr) {
        console.warn('Playback listener attach warning:', listenerErr);
      }

      try {
        sound.removePlaybackEndListener();
        sound.addPlaybackEndListener(() => {
          console.log('🔊 Voice note playback finished for message:', msgId);
          try {
            sound.removePlayBackListener();
            sound.removePlaybackEndListener();
          } catch (_) { }
          setPlayingMessageId(null);
          setPlaybackPosition(0);
          setPlaybackDuration(0);
          if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        });
      } catch (endErr) {
        console.warn('Playback end listener attach warning:', endErr);
      }

      // Gather candidate playback URLs
      const candidates = [];

      // 1. Check local audio file on device if recorded by current user
      const localAudio = messageObj?.localAudioUri || (typeof rawMediaUrl === 'string' && (rawMediaUrl.startsWith('file://') || rawMediaUrl.startsWith('/')) ? rawMediaUrl : null);
      if (localAudio && typeof localAudio === 'string' && localAudio.trim().length > 0) {
        candidates.push(localAudio.trim());
      }

      // 2. Resolve remote media URL via getAudioUrl
      const rawUrl = rawMediaUrl || messageObj?.mediaUrl || messageObj?.audioUrl || messageObj?.url;
      if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim().length > 0) {
        const resolvedAudioUrl = getAudioUrl(rawUrl);
        if (resolvedAudioUrl && !candidates.includes(resolvedAudioUrl)) {
          candidates.push(resolvedAudioUrl);
        }

        // HTTPS fallback for HTTP URLs on remote domains
        if (resolvedAudioUrl.startsWith('http://') && !resolvedAudioUrl.includes('localhost') && !resolvedAudioUrl.includes('10.0.2.') && !resolvedAudioUrl.includes('192.168.')) {
          const httpsUrl = resolvedAudioUrl.replace('http://', 'https://');
          if (!candidates.includes(httpsUrl)) candidates.push(httpsUrl);
        } else if (resolvedAudioUrl.startsWith('https://')) {
          const httpUrl = resolvedAudioUrl.replace('https://', 'http://');
          if (!candidates.includes(httpUrl)) candidates.push(httpUrl);
        }
      }

      if (candidates.length === 0) {
        Alert.alert('Playback Error', 'Voice note audio URL is missing or invalid.');
        setPlayingMessageId(null);
        return;
      }

      let playedSuccessfully = false;
      let lastPlayErr = null;

      for (const targetUrl of candidates) {
        console.log('🔊 Attempting to play voice note from candidate URL:', targetUrl);
        try {
          await sound.startPlayer(targetUrl);
          playedSuccessfully = true;
          console.log('✅ Voice note playback started successfully from:', targetUrl);
          break;
        } catch (playErr) {
          console.warn('Playback attempt failed for candidate:', targetUrl, playErr?.message || playErr);
          lastPlayErr = playErr;
        }
      }

      if (!playedSuccessfully) {
        throw (lastPlayErr || new Error('All audio playback attempts failed'));
      }
    } catch (e) {
      console.error('Error playing voice note:', e);
      setPlayingMessageId(null);
      setPlaybackPosition(0);
      setPlaybackDuration(0);
      Alert.alert(
        'Playback Error',
        'Unable to play voice note audio. The audio file is unreachable or still processing.'
      );
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <View style={[styles.container, { paddingTop: safeTopPadding }]}>
        {/* App Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Ionicons name="flame" size={26} color="#FE3C72" />
            </View>
            <Text style={styles.logoText}>FlameMatch</Text>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.refreshHeaderBtn}
              onPress={handleRefreshAllHomeData}
              activeOpacity={0.7}
              disabled={isRefreshingHome}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isRefreshingHome ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>

            {activeTab === 'profile' && (
              <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
                <Text style={styles.logoutButtonText}>Log Out</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tab Content Area */}
        <View style={styles.contentArea}>
          {activeTab === 'search' && (
            <SearchScreen
              currentUser={currentUser}
              userProfile={userProfile}
              subscriptionPermissions={subscriptionPermissions}
              onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
              onSelectProfile={(profile) => {
                console.log('Selected Profile from Search:', profile);
              }}
              onGoBack={() => {
                setActiveTab('swipe');
                return true;
              }}
              onBack={() => setActiveTab('swipe')}
            />
          )}

          {activeTab === 'swipe' && (
            <View style={styles.swipeContainer}>
              {isRefreshingHome || isQuestionnairesLoading ? (
                <View style={styles.homeCenterLoadingContainer}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.homeCenterLoadingText}>Finding matches for you...</Text>
                </View>
              ) : swipeIndex < MOCK_MATCHES.length ? (
                <View style={styles.stackContainer}>
                  {/* Background Card */}
                  {swipeIndex + 1 < MOCK_MATCHES.length && (
                    <View style={[styles.matchCard, styles.nextCard]}>
                      <Image
                        source={{ uri: getImageUrl(MOCK_MATCHES[swipeIndex + 1].image) }}
                        style={styles.matchCardImage}
                      />
                      <View style={styles.matchCardOverlay} />
                      <View style={styles.matchDetails}>
                        <View style={styles.matchNameRow}>
                          <Text style={styles.matchNameText}>
                            {MOCK_MATCHES[swipeIndex + 1].name}
                            {getCandidateAge(MOCK_MATCHES[swipeIndex + 1]) ? `, ${getCandidateAge(MOCK_MATCHES[swipeIndex + 1])}` : ''}
                          </Text>
                          {!!(MOCK_MATCHES[swipeIndex + 1] && MOCK_MATCHES[swipeIndex + 1].isEmailVerified) && (
                            <Ionicons name="checkmark-circle" size={18} color="#0084FF" style={{ marginLeft: 4, marginRight: 4 }} />
                          )}
                          {!!(MOCK_MATCHES[swipeIndex + 1] && (onlineUsersMap[(MOCK_MATCHES[swipeIndex + 1].id || MOCK_MATCHES[swipeIndex + 1]._id || MOCK_MATCHES[swipeIndex + 1].userId)?.toString()] || MOCK_MATCHES[swipeIndex + 1].isOnline)) && (
                            <View style={styles.swipeOnlineBadge}>
                              <View style={styles.swipeOnlineDot} />
                              <Text style={styles.swipeOnlineText}>Online</Text>
                            </View>
                          )}
                          <View style={styles.distanceBadge}>
                            <Text style={styles.distanceBadgeText}>
                              {MOCK_MATCHES[swipeIndex + 1].distance}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.matchBioText}>{MOCK_MATCHES[swipeIndex + 1].bio}</Text>
                        <View style={styles.interestsRow}>
                          {MOCK_MATCHES[swipeIndex + 1].interests.map((interest, idx) => (
                            <View key={idx} style={styles.interestMiniBadge}>
                              <Text style={styles.interestMiniText}>{interest}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Active Card with Gesture Handling */}
                  <Animated.View
                    key={swipeIndex}
                    style={[styles.matchCard, getCardStyle()]}
                    {...panResponder.panHandlers}
                  >
                    <Image
                      source={{ uri: getImageUrl(MOCK_MATCHES[swipeIndex].image) }}
                      style={styles.matchCardImage}
                    />
                    <View style={styles.matchCardOverlay} />

                    {/* Dynamic Action Badges */}
                    <Animated.View style={[styles.swipeBadge, styles.likeBadge, { opacity: likeOpacity }]}>
                      <Text style={styles.likeBadgeText}>♥</Text>
                    </Animated.View>
                    <Animated.View style={[styles.swipeBadge, styles.nopeBadge, { opacity: nopeOpacity }]}>
                      <Text style={styles.nopeBadgeText}>✖</Text>
                    </Animated.View>

                    <View style={styles.matchDetails}>
                      <View style={styles.matchNameRow}>
                        <Text style={styles.matchNameText}>
                          {MOCK_MATCHES[swipeIndex].name}
                          {getCandidateAge(MOCK_MATCHES[swipeIndex]) ? `, ${getCandidateAge(MOCK_MATCHES[swipeIndex])}` : ''}
                        </Text>
                        {!!(MOCK_MATCHES[swipeIndex] && MOCK_MATCHES[swipeIndex].isEmailVerified) && (
                          <Ionicons name="checkmark-circle" size={18} color="#0084FF" style={{ marginLeft: 4, marginRight: 4 }} />
                        )}
                        {!!(MOCK_MATCHES[swipeIndex] && (onlineUsersMap[(MOCK_MATCHES[swipeIndex].id || MOCK_MATCHES[swipeIndex]._id || MOCK_MATCHES[swipeIndex].userId)?.toString()] || MOCK_MATCHES[swipeIndex].isOnline)) && (
                          <View style={styles.swipeOnlineBadge}>
                            <View style={styles.swipeOnlineDot} />
                            <Text style={styles.swipeOnlineText}>Online</Text>
                          </View>
                        )}
                        <View style={styles.distanceBadge}>
                          <Text style={styles.distanceBadgeText}>
                            {MOCK_MATCHES[swipeIndex].distance}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.matchBioText} numberOfLines={2}>
                        {MOCK_MATCHES[swipeIndex].bio}
                      </Text>

                      {/* Collapsed state trigger: Upward direction arrow icon */}
                      <TouchableOpacity
                        style={styles.cardDetailToggleBtn}
                        onPress={() => setShowActiveCardDetails(true)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.cardDetailToggleArrow}>▲</Text>
                        <Text style={styles.cardDetailToggleLabel}>Show All Details</Text>
                      </TouchableOpacity>

                      <View style={styles.interestsRow}>
                        {MOCK_MATCHES[swipeIndex].commonInterestsCount > 0 && (
                          <View style={styles.commonInterestHighlightBadge}>
                            <Text style={styles.commonInterestHighlightText}>
                              ✨ {MOCK_MATCHES[swipeIndex].commonInterestsCount} Shared Interest{MOCK_MATCHES[swipeIndex].commonInterestsCount > 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                        {MOCK_MATCHES[swipeIndex].interests.map((interest, idx) => {
                          const isCommon = (MOCK_MATCHES[swipeIndex].commonInterests || []).includes(interest);
                          return (
                            <View key={idx} style={[styles.interestMiniBadge, isCommon && styles.commonInterestBadgeActive]}>
                              <Text style={[styles.interestMiniText, isCommon && styles.commonInterestTextActive]}>
                                {isCommon ? `★ ${interest}` : interest}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </Animated.View>
                </View>
              ) : (
                <View style={styles.noMatchesCard}>
                  <Ionicons name="sparkles" size={56} color="#FFD700" style={{ marginBottom: 16 }} />
                  <Text style={styles.noMatchesTitle}>You've Swiped Everyone!</Text>
                  <Text style={styles.noMatchesSubtitle}>
                    Check back later or expand your distance preference sliders to find more candidates near you.
                  </Text>
                  <CustomButton
                    title="RESET SWIPE DECK"
                    variant="outline"
                    onPress={() => {
                      setSwipeIndex(0);
                      refetch();
                    }}
                  />
                </View>
              )}

              {/* Action Buttons (static relative to swipeContainer) */}
              {(swipeIndex < MOCK_MATCHES.length || swipeIndex > 0 || swipeHistory.length > 0) && (
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.actionCircle, styles.actionRewind, (swipeIndex === 0 && swipeHistory.length === 0) && { opacity: 0.5 }]}
                    onPress={handleUndoSwipe}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.actionIconText, styles.actionRewindText]}>⏪</Text>
                  </TouchableOpacity>
                  {swipeIndex < MOCK_MATCHES.length && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionCircle, styles.actionDislike]}
                        onPress={triggerSwipeLeft}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.actionIconText, styles.actionDislikeText]}>✖</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionCircle, styles.actionSuperLike]}
                        onPress={handleSuperLikeSwipe}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.actionIconText}>★</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionCircle, styles.actionLike]}
                        onPress={triggerSwipeRight}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.actionIconText}>♥</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {activeTab === 'likes' && (
            <View style={styles.likesContainer}>
              <View style={styles.tabHeaderWithBack}>
                <TouchableOpacity
                  style={styles.headerBackBtn}
                  onPress={() => setActiveTab('swipe')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.headerBackBtnText}>←</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>People Who Liked You</Text>
                  <Text style={styles.sectionSubtitle}>Tap any profile to view details & expand!</Text>
                </View>
              </View>
              {likesList.length > 0 ? (
                <ScrollView style={styles.likesGridScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.likesListContainer}>
                    {likesList.map((item) => {
                      const activeUserObj = userProfile || currentUser;
                      const perms = subscriptionPermissions || activeUserObj?.subscriptionPermissions;
                      const canSeeLikes = perms ? Boolean(perms?.likes?.isAllowed) : !item.isBlurred;
                      const isItemBlurred = !canSeeLikes;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.instaRowCard,
                            item.isSuperLike && { borderColor: '#3897F0', borderWidth: 1.5 },
                            isItemBlurred && { borderColor: 'rgba(255, 215, 0, 0.4)', borderWidth: 1, backgroundColor: 'rgba(255, 215, 0, 0.04)' }
                          ]}
                          activeOpacity={0.85}
                          onPress={async () => {
                            if (isItemBlurred) {
                              setIsSubscriptionModalOpen(true);
                            } else {
                              setLikesActivePhotoIndex(0);
                              let freshProfile = { ...item, isFromChat: false };
                              const targetId = (item.id || item._id || item.userId)?.toString();
                              if (targetId) {
                                try {
                                  const res = await apiClient.getUserById(targetId);
                                  if (res && res.user) {
                                    freshProfile = { ...freshProfile, ...res.user };
                                  }
                                } catch (e) {
                                  console.log('Error fetching fresh profile by ID:', e);
                                }
                              }
                              setSelectedLikesProfile(freshProfile);
                            }
                          }}
                        >
                          {/* Left: Avatar with Online Dot or Blur */}
                          <View style={styles.instaAvatarWrapper}>
                            <Image
                              source={{
                                uri: item.profileImage
                                  ? getImageUrl(item.profileImage)
                                  : getImageUrl(item.image)
                              }}
                              style={styles.instaAvatar}
                              blurRadius={isItemBlurred ? (Platform.OS === 'ios' ? 14 : 22) : 0}
                            />
                            {!isItemBlurred && !!onlineUsersMap[item.id.toString()] && (
                              <View style={styles.instaOnlineDot} />
                            )}
                            {isItemBlurred && (
                              <View style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: 'rgba(15, 18, 26, 0.4)',
                                borderRadius: 25,
                              }}>
                                <Ionicons name="lock-closed" size={16} color="#FFD700" />
                              </View>
                            )}
                          </View>

                          {/* Middle: Name, Age, Subtitle */}
                          <View style={styles.instaInfoCol}>
                            <View style={styles.instaNameRow}>
                              <Text style={[styles.instaNameText, isItemBlurred && { color: '#FFD700' }]} numberOfLines={1}>
                                {isItemBlurred ? 'Someone Liked You' : `${item.name}${item.age ? `, ${item.age}` : ''}`}
                              </Text>
                              {!isItemBlurred && item.isSuperLike && (
                                <Ionicons name="star" size={12} color="#FFD700" style={{ marginLeft: 4 }} />
                              )}
                            </View>
                            <Text style={styles.instaSubtitleText} numberOfLines={1}>
                              {isItemBlurred
                                ? '✨ Upgrade to Gold to unblur'
                                : item.isSuperLike
                                  ? '⭐ Super Liked you!'
                                  : item.distance
                                    ? `📍 ${item.distance}`
                                    : 'Liked your profile'}
                            </Text>
                          </View>

                          {/* Right: Action Buttons or UNBLUR Lock Badge */}
                          {isItemBlurred ? (
                            <TouchableOpacity
                              style={{
                                backgroundColor: '#FFD700',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 14,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                              onPress={() => setIsSubscriptionModalOpen(true)}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="lock-closed" size={12} color="#0F121A" style={{ marginRight: 4 }} />
                              <Text style={{ color: '#0F121A', fontSize: 11, fontWeight: '900' }}>UNBLUR</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.instaActionsGroup}>
                              <TouchableOpacity
                                style={styles.instaPassBtn}
                                onPress={(e) => {
                                  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                                  handleRejectLike(item);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.instaPassText}>✖</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.instaLikeBtn}
                                onPress={(e) => {
                                  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                                  handleLikeMatch(item);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.instaLikeIcon}>♥</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              ) : (
                <View style={styles.emptyLikesContainer}>
                  <Ionicons name="heart-dislike-outline" size={56} color="#FE3C72" style={{ marginBottom: 16 }} />
                  <Text style={styles.emptyLikesTitle}>No Likes Yet</Text>
                  <Text style={styles.emptyLikesSubtitle}>
                    Keep swiping! When someone likes you back, they will appear here.
                  </Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'chat' && (
            <View style={styles.chatTabContainer}>
              {activeChat ? (
                /* Active Chat Conversation view */
                <KeyboardAvoidingView
                  style={styles.activeChatWrapper}
                  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                  {isSearchInChatActive ? (
                    <View style={styles.chatSearchHeaderBar}>
                      <TouchableOpacity
                        style={styles.chatBackButton}
                        onPress={() => {
                          setIsSearchInChatActive(false);
                          setChatSearchQuery('');
                          setChatSearchMatchIndex(0);
                        }}
                      >
                        <Ionicons name="arrow-back" size={24} color="#AEBAC1" />
                      </TouchableOpacity>

                      <View style={styles.chatSearchInputContainer}>
                        <TextInput
                          style={styles.chatSearchInput}
                          placeholder="Search messages..."
                          placeholderTextColor="#8696A0"
                          value={chatSearchQuery}
                          onChangeText={(val) => {
                            setChatSearchQuery(val);
                            setChatSearchMatchIndex(0);
                          }}
                          autoFocus={true}
                        />
                        {chatSearchQuery.trim().length > 0 && (
                          <TouchableOpacity
                            onPress={() => {
                              setChatSearchQuery('');
                              setChatSearchMatchIndex(0);
                            }}
                            style={{ padding: 4, marginRight: 4 }}
                          >
                            <Ionicons name="close" size={18} color="#8696A0" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {(() => {
                        const qTrim = chatSearchQuery.trim().toLowerCase();
                        const matches = qTrim.length > 0 && activeChat?.messages
                          ? activeChat.messages.filter((m) => !m.isDeletedForEveryone && m.text && m.text.toLowerCase().includes(qTrim))
                          : [];
                        return (
                          <View style={styles.chatSearchNavContainer}>
                            {qTrim.length > 0 && (
                              <Text style={styles.chatSearchCountText}>
                                {matches.length > 0 ? `${chatSearchMatchIndex + 1}/${matches.length}` : '0/0'}
                              </Text>
                            )}
                            <TouchableOpacity
                              disabled={matches.length === 0}
                              onPress={() => {
                                if (matches.length > 0) {
                                  setChatSearchMatchIndex((prev) => (prev > 0 ? prev - 1 : matches.length - 1));
                                }
                              }}
                              style={{ padding: 4, opacity: matches.length > 0 ? 1 : 0.3 }}
                            >
                              <Ionicons name="chevron-up" size={22} color="#AEBAC1" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              disabled={matches.length === 0}
                              onPress={() => {
                                if (matches.length > 0) {
                                  setChatSearchMatchIndex((prev) => (prev < matches.length - 1 ? prev + 1 : 0));
                                }
                              }}
                              style={{ padding: 4, opacity: matches.length > 0 ? 1 : 0.3 }}
                            >
                              <Ionicons name="chevron-down" size={22} color="#AEBAC1" />
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>
                  ) : isMultiSelectMode ? (
                    (() => {
                      const isSingle = selectedMultiMessageIds.length === 1;
                      const singleMsg = isSingle
                        ? (activeChat?.messages || []).find(
                          (m) =>
                            (m.id || m._id)?.toString() === selectedMultiMessageIds[0] ||
                            m.tempId?.toString() === selectedMultiMessageIds[0]
                        ) || selectedMessageForAction
                        : null;

                      const currentUserId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
                      const isSentByMe = Boolean(
                        singleMsg &&
                        (singleMsg.sender === 'you' || (currentUserId && singleMsg.senderId?.toString() === currentUserId))
                      );
                      const isStarred = singleMsg ? isMessageStarredByMe(singleMsg) : false;
                      const isPinned = singleMsg ? Boolean(singleMsg.isPinned) : false;
                      const isMyTextMessage = Boolean(
                        isSingle &&
                        singleMsg &&
                        isSentByMe &&
                        !singleMsg.isDeletedForEveryone &&
                        (singleMsg.messageType === 'text' || !singleMsg.messageType)
                      );

                      return (
                        <View style={[styles.chatHeader, { backgroundColor: '#1F2C34', paddingHorizontal: 10, justifyContent: 'space-between' }]}>
                          {/* Left: Back / Close button + Selection Count */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <TouchableOpacity
                              onPress={() => {
                                setIsMultiSelectMode(false);
                                setSelectedMultiMessageIds([]);
                                setSelectedMessageForAction(null);
                              }}
                              style={{ padding: 4, borderRadius: 20 }}
                              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
                              <Ionicons name="arrow-back" size={24} color="#E9EDEF" />
                            </TouchableOpacity>
                            <Text style={{ color: '#E9EDEF', fontSize: 18, fontWeight: '700' }}>
                              {selectedMultiMessageIds.length}
                            </Text>
                          </View>

                          {/* Right: WhatsApp-style Action Bar Icons */}
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 }}
                          >
                            {/* 1. Reply (when 1 message selected) */}
                            {isSingle && (
                              <TouchableOpacity
                                onPress={() => {
                                  if (singleMsg) {
                                    setReplyingToMessage(singleMsg);
                                    setIsMultiSelectMode(false);
                                    setSelectedMultiMessageIds([]);
                                    setTimeout(() => {
                                      chatInputRef.current?.focus();
                                    }, 150);
                                  }
                                }}
                                style={{ padding: 6, borderRadius: 20 }}
                                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                              >
                                <Ionicons name="arrow-undo" size={22} color="#E9EDEF" />
                              </TouchableOpacity>
                            )}

                            {/* 2. Star / Unstar */}
                            <TouchableOpacity
                              onPress={() => {
                                if (isSingle && singleMsg) {
                                  handleToggleStarAction(singleMsg);
                                } else if (selectedMultiMessageIds.length > 0) {
                                  selectedMultiMessageIds.forEach((id) => {
                                    const target = (activeChat?.messages || []).find((m) => (m.id || m._id)?.toString() === id || m.tempId?.toString() === id);
                                    if (target) handleToggleStarAction(target);
                                  });
                                }
                                setIsMultiSelectMode(false);
                                setSelectedMultiMessageIds([]);
                              }}
                              style={{ padding: 6, borderRadius: 20 }}
                              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                            >
                              <Ionicons
                                name={isStarred ? "star" : "star-outline"}
                                size={22}
                                color={isStarred ? "#FFD700" : "#E9EDEF"}
                              />
                            </TouchableOpacity>

                            {/* 3. Pin / Unpin (when 1 message selected) */}
                            {isSingle && (
                              <TouchableOpacity
                                onPress={() => {
                                  if (singleMsg) {
                                    handlePinMessageAction(singleMsg);
                                  }
                                  setIsMultiSelectMode(false);
                                  setSelectedMultiMessageIds([]);
                                }}
                                style={{ padding: 6, borderRadius: 20 }}
                                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                              >
                                <Ionicons
                                  name={isPinned ? "pin" : "pin-outline"}
                                  size={21}
                                  color={isPinned ? "#00A884" : "#E9EDEF"}
                                />
                              </TouchableOpacity>
                            )}

                            {/* 4. Info (only visible for sent messages when 1 message selected) */}
                            {isSingle && isSentByMe && (
                              <TouchableOpacity
                                onPress={() => {
                                  if (singleMsg) {
                                    setSelectedMessageForAction(singleMsg);
                                    setShowInfoModal(true);
                                  }
                                  setIsMultiSelectMode(false);
                                  setSelectedMultiMessageIds([]);
                                }}
                                style={{ padding: 6, borderRadius: 20 }}
                                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                              >
                                <Ionicons name="information-circle-outline" size={23} color="#E9EDEF" />
                              </TouchableOpacity>
                            )}

                            {/* 5. Edit (when 1 text message sent by me is selected) */}
                            {isMyTextMessage && (
                              <TouchableOpacity
                                onPress={() => {
                                  if (singleMsg) {
                                    setEditingMessage(singleMsg);
                                    typedMessageRef.current = singleMsg.text || '';
                                    setTypedMessage(singleMsg.text || '');
                                    setIsMultiSelectMode(false);
                                    setSelectedMultiMessageIds([]);
                                    setTimeout(() => {
                                      chatInputRef.current?.focus();
                                    }, 150);
                                  }
                                }}
                                style={{ padding: 6, borderRadius: 20 }}
                                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                              >
                                <Ionicons name="pencil-outline" size={21} color="#E9EDEF" />
                              </TouchableOpacity>
                            )}

                            {/* 6. Copy */}
                            <TouchableOpacity
                              onPress={handleCopyMultiMessages}
                              style={{ padding: 6, borderRadius: 20 }}
                              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                            >
                              <Ionicons name="copy-outline" size={21} color="#E9EDEF" />
                            </TouchableOpacity>

                            {/* 7. Forward */}
                            <TouchableOpacity
                              onPress={handleForwardMultiMessages}
                              style={{ padding: 6, borderRadius: 20 }}
                              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                            >
                              <Ionicons name="arrow-redo-outline" size={22} color="#E9EDEF" />
                            </TouchableOpacity>

                            {/* 8. Delete */}
                            <TouchableOpacity
                              onPress={() => {
                                if (singleMsg) setSelectedMessageForAction(singleMsg);
                                setShowDeleteConfirmModal(true);
                              }}
                              style={{ padding: 6, borderRadius: 20 }}
                              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                            >
                              <Ionicons name="trash-outline" size={22} color="#F15C6D" />
                            </TouchableOpacity>
                          </ScrollView>
                        </View>
                      );
                    })()
                  ) : (
                    <View style={styles.chatHeader}>
                      <TouchableOpacity
                        style={styles.chatBackButton}
                        onPress={() => {
                          if (activeChat) {
                            const activeId = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
                            if (activeId && Array.isArray(activeChat.messages) && activeChat.messages.length > 0) {
                              const cleanActiveMsgs = activeChat.messages.filter((m) => m.id === 'match-init' || doesMessageBelongToPartner(m, activeId));
                              setChats((prevChats) =>
                                (prevChats || []).map((c) => {
                                  const cId = (c.id || c._id || c.userId)?.toString();
                                  if (cId === activeId) {
                                    return {
                                      ...c,
                                      messages: cleanActiveMsgs,
                                    };
                                  }
                                  return c;
                                })
                              );
                            }
                          }
                          typedMessageRef.current = '';
                          setTypedMessage('');
                          setIsSearchInChatActive(false);
                          setChatSearchQuery('');
                          setChatSearchMatchIndex(0);
                          dispatch(setMessages([]));
                          dispatch(setActiveChatUser(null));
                          setActiveChat(null);
                        }}
                      >
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                      {(() => {
                        const partnerId = (activeChat.id || activeChat._id || activeChat.userId || activeChat.senderId || activeChat.sender)?.toString();
                        const isBlockedByOther = Boolean(
                          activeChat.isBlockedByOther ||
                          activeChat.name === 'Matched User' ||
                          (partnerId && Array.isArray(blockedByOtherList) && blockedByOtherList.some((id) => id?.toString() === partnerId)) ||
                          (partnerId && Array.isArray(chats) && chats.some((c) => (c.id || c._id || c.userId)?.toString() === partnerId && c.isBlockedByOther)) ||
                          (partnerId && Array.isArray(matches) && matches.some((m) => (m.id || m._id || m.userId)?.toString() === partnerId && m.isBlockedByOther))
                        );
                        const isPartnerOnline = !isBlockedByOther && !!(
                          partnerId && (
                            onlineUsersMap[partnerId] !== undefined
                              ? Boolean(onlineUsersMap[partnerId])
                              : Boolean(activeChat.isOnline || activeChat.user?.isOnline)
                          )
                        );
                        const partnerLastSeen = (partnerId && lastSeenMap[partnerId]) || activeChat.lastSeen || activeChat.user?.lastSeen;

                        return (
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                            activeOpacity={isBlockedByOther ? 1 : 0.8}
                            disabled={isBlockedByOther}
                            onPress={() => {
                              if (isBlockedByOther) {
                                if (Platform.OS === 'android') {
                                  ToastAndroid.show('This profile is unavailable.', ToastAndroid.SHORT);
                                } else {
                                  Alert.alert('Unavailable', 'This profile is currently unavailable.');
                                }
                                return;
                              }
                              handleViewPartnerProfile(partnerId);
                            }}
                          >
                            <View style={styles.avatarWrapper}>
                              <Image
                                source={{ uri: isBlockedByOther ? '' : getImageUrl(activeChat.image || activeChat.profileImage) }}
                                style={styles.chatHeaderAvatar}
                              />
                              {isPartnerOnline && (
                                <View style={styles.onlineDotOverlay} />
                              )}
                            </View>
                            <View style={styles.chatHeaderTitleContainer}>
                              <Text style={styles.chatHeaderName}>
                                {isBlockedByOther ? 'Matched User' : (activeChat.name || activeChat.firstName)}
                              </Text>
                              <Text style={[styles.chatHeaderStatusText, isTyping && { color: '#FF4B72', fontWeight: 'bold' }]}>
                                {isBlockedByOther
                                  ? ''
                                  : isTyping
                                    ? 'typing...'
                                    : isPartnerOnline
                                      ? 'Online'
                                      : formatLastSeen(partnerLastSeen)}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })()}
                      <TouchableOpacity
                        style={styles.chatThreeDotsButton}
                        onPress={handleChatMenu}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="ellipsis-vertical" size={20} color="#AEBAC1" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {pinnedMessage && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        const targetMsgId = (pinnedMessage.id || pinnedMessage._id)?.toString();
                        if (targetMsgId && messageYPositionsRef.current[targetMsgId] !== undefined && chatScrollViewRef.current) {
                          chatScrollViewRef.current.scrollTo({
                            y: Math.max(0, messageYPositionsRef.current[targetMsgId] - 70),
                            animated: true,
                          });
                          setHighlightedMessageId(targetMsgId);
                          setTimeout(() => setHighlightedMessageId(null), 1500);
                        }
                      }}
                      style={styles.pinnedBannerContainer}
                    >
                      <Ionicons name="pin" size={16} color="#00A884" style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pinnedBannerTitle}>Pinned Message</Text>
                        <Text style={styles.pinnedBannerText} numberOfLines={1}>
                          {pinnedMessage.text || (pinnedMessage.mediaUrl ? 'Media message' : 'Message')}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => {
                          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                          handlePinMessageAction(pinnedMessage);
                        }}
                        style={{ padding: 6 }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  )}

                  <ScrollView
                    ref={chatScrollViewRef}
                    style={[
                      styles.messageBubbleContainer,
                      { opacity: isChatReadyForDisplay ? 1 : 0 }
                    ]}
                    contentContainerStyle={{ paddingVertical: 15 }}
                    onContentSizeChange={handleChatContentSizeChange}
                    onLayout={handleChatLayout}
                    onScroll={handleChatScroll}
                    scrollEventThrottle={16}
                  >
                    {deduplicateMessages(
                      (activeChat.messages || []).filter(
                        (msg) => msg.id === 'match-init' || doesMessageBelongToPartner(msg, activeChat.id || activeChat._id || activeChat.userId)
                      )
                    ).map((msg, index) => {
                      const isDeletedForEveryone = Boolean(msg.isDeletedForEveryone || msg.text === 'This message was deleted');
                      const isMe = msg.sender === 'you';
                      const isSticker = !isDeletedForEveryone && msg.messageType === 'sticker';
                      const isVoice =
                        !isDeletedForEveryone &&
                        (msg.messageType === 'voice' ||
                          msg.messageType === 'audio' ||
                          (msg.mediaUrl &&
                            typeof msg.mediaUrl === 'string' &&
                            (msg.mediaUrl.includes('voice_') ||
                              msg.mediaUrl.endsWith('.m4a') ||
                              msg.mediaUrl.endsWith('.mp3') ||
                              msg.mediaUrl.endsWith('.wav') ||
                              msg.mediaUrl.endsWith('.aac') ||
                              msg.mediaUrl.endsWith('.ogg') ||
                              (msg.fileName &&
                                typeof msg.fileName === 'string' &&
                                (msg.fileName.includes('voice_') ||
                                  msg.fileName.endsWith('.mp3') ||
                                  msg.fileName.endsWith('.m4a') ||
                                  msg.fileName.endsWith('.wav') ||
                                  msg.fileName.endsWith('.aac') ||
                                  msg.fileName.endsWith('.ogg'))))));

                      const isVideo =
                        !isDeletedForEveryone &&
                        !isVoice &&
                        (msg.messageType === 'video' ||
                          (msg.mediaUrl &&
                            typeof msg.mediaUrl === 'string' &&
                            (msg.mediaUrl.includes('/video/upload/') ||
                              msg.mediaUrl.endsWith('.mp4') ||
                              msg.mediaUrl.endsWith('.mov') ||
                              msg.mediaUrl.endsWith('.avi'))));

                      const isDocument = !isDeletedForEveryone && !isVoice && !isVideo && msg.messageType === 'document';
                      const isCall = !isDeletedForEveryone && !isVoice && (msg.messageType === 'voice_call' || msg.messageType === 'call');

                      const isImage =
                        !isDeletedForEveryone &&
                        !isVoice &&
                        !isVideo &&
                        !isDocument &&
                        (msg.messageType === 'image' ||
                          msg.type === 'image' ||
                          msg.text === '📷 Photo' ||
                          (msg.fileName && typeof msg.fileName === 'string' && /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(msg.fileName)) ||
                          (msg.mediaUrl &&
                            typeof msg.mediaUrl === 'string' &&
                            (msg.mediaUrl.startsWith('data:image') ||
                              /\.(jpg|jpeg|png|webp|gif|bmp|heic)($|\?)/i.test(msg.mediaUrl) ||
                              msg.mediaUrl.includes('/image/upload/') ||
                              (!isVideo && (msg.mediaUrl.includes('/chat/media/') || msg.mediaUrl.includes('/uploads/')) && (!msg.fileName || /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(msg.fileName))))) ||
                          (msg.text &&
                            typeof msg.text === 'string' &&
                            (msg.text.startsWith('http') || msg.text.startsWith('data:image')) &&
                            /\.(jpg|jpeg|png|webp|gif|bmp|heic)($|\?)/i.test(msg.text)));

                      const rawImgUrl = msg.mediaUrl || msg.localUri || (isImage && msg.text && msg.text !== '📷 Photo' ? msg.text : '') || '';
                      const imageUrlToRender = getImageUrl(rawImgUrl || msg.mediaUrl || '');
                      const replyToObj = !isDeletedForEveryone ? parseReplyTo(msg.replyTo) : null;
                      const hasValidReplyTo = !!replyToObj;
                      const hasMediaCaption = Boolean(
                        !isDeletedForEveryone &&
                        (isImage || isVideo || isDocument) &&
                        msg.text &&
                        typeof msg.text === 'string' &&
                        msg.text.trim() !== '' &&
                        msg.text !== msg.mediaUrl &&
                        msg.text !== msg.fileName &&
                        !msg.text.startsWith('http://') &&
                        !msg.text.startsWith('https://') &&
                        !msg.text.startsWith('data:') &&
                        msg.text !== '📷 Photo' &&
                        msg.text !== '🎬 Video' &&
                        msg.text !== '📄 Document' &&
                        msg.text !== '🎤 Voice Note'
                      );
                      const isTransparentContainer = !isDeletedForEveryone && isSticker;

                      const qTrim = isSearchInChatActive ? chatSearchQuery.trim().toLowerCase() : '';
                      const searchMatches = qTrim.length > 0 && activeChat?.messages
                        ? activeChat.messages.filter((m) => !m.isDeletedForEveryone && m.text && m.text.toLowerCase().includes(qTrim))
                        : [];
                      const isMatched = qTrim.length > 0 && msg.text && msg.text.toLowerCase().includes(qTrim);
                      const activeMatchedMsg = searchMatches[chatSearchMatchIndex];
                      const isActiveFocusedMatch = isMatched && activeMatchedMsg && (msg.id === activeMatchedMsg.id || msg._id === activeMatchedMsg._id);
                      const msgIdStr = (msg.id || msg._id)?.toString();
                      const isSelectedInMultiMode = isMultiSelectMode && msgIdStr && selectedMultiMessageIds.includes(msgIdStr);

                      return (
                        <View
                          key={String(msg.id || msg._id || msg.tempId || index)}
                          onLayout={(e) => {
                            const y = e.nativeEvent.layout.y;
                            const k = (msg.id || msg._id || msg.createdAt)?.toString();
                            if (k && messageYPositionsRef.current) {
                              messageYPositionsRef.current[k] = y;
                            }
                          }}
                          style={[
                            styles.messageBubbleWrapper,
                            isMe ? styles.bubbleWrapperMe : styles.bubbleWrapperThem,
                            (Array.isArray(msg.reactions) && msg.reactions.length > 0) && { marginBottom: 16 },
                            isSelectedInMultiMode && {
                              backgroundColor: 'rgba(0, 168, 132, 0.18)',
                              borderRadius: 10,
                              marginHorizontal: -8,
                              paddingHorizontal: 8,
                            }
                          ]}
                        >
                          <View style={{ flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                            {/* WhatsApp Floating Emoji Reaction Bar when message is selected */}
                            {isSelectedInMultiMode && selectedMultiMessageIds.length === 1 && !isDeletedForEveryone && (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  backgroundColor: '#202C33',
                                  borderRadius: 24,
                                  paddingVertical: 5,
                                  paddingHorizontal: 8,
                                  marginBottom: 6,
                                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                                  borderWidth: 1,
                                  borderColor: 'rgba(255, 255, 255, 0.12)',
                                  elevation: 10,
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: 0.45,
                                  shadowRadius: 8,
                                  zIndex: 100,
                                }}
                              >
                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => {
                                  const sIdStr = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
                                  const currentReactions = Array.isArray(msg.reactions) ? msg.reactions : [];
                                  const isUserReacted = currentReactions.some((r) =>
                                    (r.userId?.toString() || r.userId) === sIdStr && (typeof r === 'string' ? r === emoji : r.emoji === emoji)
                                  );

                                  return (
                                    <TouchableOpacity
                                      key={emoji}
                                      onPress={() => {
                                        handleEmojiReaction(emoji, msg);
                                      }}
                                      style={[
                                        {
                                          paddingHorizontal: 6,
                                          paddingVertical: 3,
                                          borderRadius: 16,
                                        },
                                        isUserReacted && {
                                          backgroundColor: 'rgba(0, 168, 132, 0.35)',
                                          borderWidth: 1,
                                          borderColor: '#00A884',
                                        }
                                      ]}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                    </TouchableOpacity>
                                  );
                                })}
                                <TouchableOpacity
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginLeft: 4,
                                    marginRight: 2,
                                  }}
                                  onPress={() => {
                                    setReactingToMessageForEmoji(msg);
                                    setShowEmojiPicker(true);
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="add" size={18} color="#AEBAC1" />
                                </TouchableOpacity>
                              </View>
                            )}

                            <Pressable
                              delayLongPress={180}
                              onPress={() => {
                                if (isMultiSelectMode) {
                                  toggleSelectMessage(msg);
                                }
                              }}
                              onLongPress={() => {
                                if (isMultiSelectMode) {
                                  toggleSelectMessage(msg);
                                } else {
                                  handleMessageLongPress(msg);
                                }
                              }}
                              style={({ pressed }) => [
                                { opacity: pressed ? 0.85 : 1 },
                                isTransparentContainer
                                  ? styles.transparentBubble
                                  : isImage
                                    ? [styles.imageBubble, isMe ? styles.imageBubbleMe : styles.imageBubbleThem]
                                    : styles.messageBubble,
                                !isTransparentContainer && !isImage && (isMe ? styles.bubbleMe : styles.bubbleThem),
                                isVoice && styles.waVoiceBubble,
                                { alignSelf: isMe ? 'flex-end' : 'flex-start' },
                                isSelectedInMultiMode && {
                                  borderWidth: 1.5,
                                  borderColor: '#00A884',
                                },
                                isMatched && {
                                  borderWidth: 1.5,
                                  borderColor: isActiveFocusedMatch ? '#00A884' : 'rgba(0, 168, 132, 0.45)',
                                  backgroundColor: isActiveFocusedMatch ? 'rgba(0, 168, 132, 0.22)' : undefined,
                                },
                                (highlightedMessageId && (msg.id === highlightedMessageId || msg._id === highlightedMessageId || msg.id?.toString() === highlightedMessageId)) && {
                                  borderWidth: 2,
                                  borderColor: '#00A884',
                                  backgroundColor: 'rgba(0, 168, 132, 0.28)',
                                }
                              ]}
                            >
                              {isSelectedInMultiMode && !isImage && (
                                <View
                                  style={{
                                    position: 'absolute',
                                    top: -5,
                                    right: isMe ? -5 : undefined,
                                    left: !isMe ? -5 : undefined,
                                    backgroundColor: '#00A884',
                                    borderRadius: 10,
                                    width: 20,
                                    height: 20,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 10,
                                    borderWidth: 1.5,
                                    borderColor: '#121B22',
                                  }}
                                >
                                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                                </View>
                              )}

                              {Boolean(msg.isForwarded) && !isDeletedForEveryone && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3, opacity: 0.85 }}>
                                  <Ionicons name="arrow-redo" size={12} color={isMe ? "#E9EDEF" : "#8696A0"} style={{ marginRight: 4 }} />
                                  <Text style={{ fontSize: 11, fontStyle: 'italic', color: isMe ? "#E9EDEF" : "#8696A0" }}>
                                    Forwarded
                                  </Text>
                                </View>
                              )}
                              {hasValidReplyTo && (
                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  onPress={() => {
                                    if (isMultiSelectMode) {
                                      toggleSelectMessage(msg);
                                      return;
                                    }
                                    const targetMsgId = replyToObj.messageId?.toString();
                                    if (targetMsgId && messageYPositionsRef.current[targetMsgId] !== undefined && chatScrollViewRef.current) {
                                      chatScrollViewRef.current.scrollTo({
                                        y: Math.max(0, messageYPositionsRef.current[targetMsgId] - 70),
                                        animated: true,
                                      });
                                      setHighlightedMessageId(targetMsgId);
                                      setTimeout(() => setHighlightedMessageId(null), 1500);
                                    }
                                  }}
                                  style={[styles.quotedMessageCard, isMe ? styles.quotedCardMe : styles.quotedCardThem]}
                                >
                                  <View style={[styles.quotedAccentLine, isMe ? styles.quotedLineMe : styles.quotedLineThem]} />
                                  <View style={styles.quotedTextContainer}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginBottom: 2 }}>
                                      <Ionicons name="return-down-forward" size={13} color={isMe ? "#06D755" : "#38BDF8"} style={{ marginRight: 4 }} />
                                      <Text
                                        style={[styles.quotedSenderName, isMe ? styles.quotedSenderNameMe : styles.quotedSenderNameThem, { flexShrink: 1 }]}
                                        numberOfLines={1}
                                      >
                                        {getQuotedSenderName(replyToObj, isMe, activeChat?.name, activeLoggedInUserId)}
                                      </Text>
                                    </View>
                                    <Text
                                      style={[styles.quotedSnippetText, isMe ? styles.quotedSnippetMe : styles.quotedSnippetThem, { flexShrink: 1 }]}
                                      numberOfLines={2}
                                    >
                                      {getQuotedSnippetText(replyToObj)}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              )}
                              {isSticker && (
                                Boolean(msg.mediaUrl && typeof msg.mediaUrl === 'string' && (msg.mediaUrl.startsWith('http') || msg.mediaUrl.startsWith('data:image'))) ? (
                                  <Image
                                    source={{ uri: msg.mediaUrl }}
                                    style={styles.chatStickerImage}
                                    resizeMode="contain"
                                  />
                                ) : (
                                  <Text style={styles.stickerText}>{msg.mediaUrl || msg.text}</Text>
                                )
                              )}

                              {isImage && (
                                <TouchableOpacity
                                  activeOpacity={0.9}
                                  onPress={() => {
                                    if (isMultiSelectMode) {
                                      toggleSelectMessage(msg);
                                    } else {
                                      setImageZoomScale(1);
                                      setImageRotation(0);
                                      setViewMediaModal({
                                        visible: true,
                                        type: 'image',
                                        url: imageUrlToRender,
                                        fileName: msg.fileName || 'Photo',
                                        fileSize: msg.fileSize || 0
                                      });
                                    }
                                  }}
                                  onLongPress={() => {
                                    if (isMultiSelectMode) {
                                      toggleSelectMessage(msg);
                                    } else {
                                      handleMessageLongPress(msg);
                                    }
                                  }}
                                  style={[
                                    styles.imageMessageContainer,
                                    isMe ? styles.imageContainerMe : styles.imageContainerThem,
                                    hasMediaCaption && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
                                    isSelectedInMultiMode && {
                                      borderWidth: 2.5,
                                      borderColor: '#00A884',
                                    }
                                  ]}
                                >
                                  <Image
                                    source={{ uri: imageUrlToRender }}
                                    style={[
                                      styles.imageMessage,
                                      isMe ? styles.imageMe : styles.imageThem,
                                      hasMediaCaption && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
                                    ]}
                                    resizeMode="cover"
                                  />

                                  {/* WhatsApp Translucent Bottom-Right Pill for Sent Time & Status when no caption */}
                                  {!hasMediaCaption && !isDeletedForEveryone && (
                                    <View style={styles.imageTimeOverlayPill}>
                                      {msg.isPinned && (
                                        <Ionicons name="pin" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                                      )}
                                      {isMessageStarredByMe(msg) && (
                                        <Ionicons name="star" size={10} color="#FFD700" style={{ marginRight: 3 }} />
                                      )}
                                      {msg.isEdited && (
                                        <Text style={styles.imageTimeOverlayEditedText}>Edited </Text>
                                      )}
                                      {(msg.createdAt || msg.time) && msg.createdAt !== 'match-init' && (
                                        <Text style={styles.imageTimeOverlayText}>
                                          {formatMessageTime(msg.createdAt) || msg.time || ''}
                                        </Text>
                                      )}
                                      {isMe && msg.createdAt !== 'match-init' && (
                                        <Text
                                          style={[
                                            styles.imageTimeOverlayTicks,
                                            msg.status === 'seen'
                                              ? styles.imageTicksSeen
                                              : (msg.status === 'pending' || msg.status === 'sending' || msg.status === 'queued')
                                                ? styles.imageTicksPending
                                                : styles.imageTicksSent
                                          ]}
                                        >
                                          {(msg.status === 'pending' || msg.status === 'sending' || msg.status === 'queued')
                                            ? ' 🕒'
                                            : msg.status === 'seen'
                                              ? ' ✓✓'
                                              : msg.status === 'delivered'
                                                ? ' ✓✓'
                                                : ' ✓'}
                                        </Text>
                                      )}
                                    </View>
                                  )}

                                  {isSelectedInMultiMode && (
                                    <View
                                      style={{
                                        ...StyleSheet.absoluteFillObject,
                                        backgroundColor: 'rgba(0, 168, 132, 0.28)',
                                        padding: 8,
                                        alignItems: isMe ? 'flex-end' : 'flex-start',
                                        justifyContent: 'flex-start',
                                      }}
                                    >
                                      <View
                                        style={{
                                          backgroundColor: '#00A884',
                                          borderRadius: 13,
                                          width: 26,
                                          height: 26,
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          borderWidth: 2,
                                          borderColor: '#FFFFFF',
                                          elevation: 6,
                                          shadowColor: '#000',
                                          shadowOffset: { width: 0, height: 2 },
                                          shadowOpacity: 0.35,
                                          shadowRadius: 3,
                                        }}
                                      >
                                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                                      </View>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              )}

                              {isDocument && (
                                <TouchableOpacity
                                  style={styles.documentMessageCard}
                                  activeOpacity={0.85}
                                  onPress={() => {
                                    if (isMultiSelectMode) {
                                      toggleSelectMessage(msg);
                                    } else if (msg.mediaUrl) {
                                      const isAudioDoc = Boolean(
                                        (msg.fileName && /\.(mp3|m4a|wav|aac|ogg|opus)$/i.test(msg.fileName)) ||
                                        (msg.mediaUrl && /\.(mp3|m4a|wav|aac|ogg|opus)$/i.test(msg.mediaUrl))
                                      );
                                      if (isAudioDoc) {
                                        setIsAudioModalPaused(false);
                                        setAudioModalPosition(0);
                                        setAudioModalDuration(0);
                                        setAudioPlaybackRate(1.0);
                                        setIsAudioModalMuted(false);
                                        setViewMediaModal({
                                          visible: true,
                                          type: 'audio',
                                          url: getImageUrl(msg.mediaUrl),
                                          fileName: msg.fileName || 'Audio File',
                                          fileSize: msg.fileSize || 0,
                                        });
                                      } else {
                                        setViewMediaModal({
                                          visible: true,
                                          type: 'document',
                                          url: getImageUrl(msg.mediaUrl),
                                          fileName: msg.fileName || 'document.pdf',
                                          fileSize: msg.fileSize || 0,
                                        });
                                      }
                                    }
                                  }}
                                  onLongPress={() => {
                                    if (isMultiSelectMode) {
                                      toggleSelectMessage(msg);
                                    } else {
                                      handleMessageLongPress(msg);
                                    }
                                  }}
                                >
                                  <View style={styles.documentCardTop}>
                                    <View style={[styles.documentBadge, getDocTypeStyle(msg.fileName)]}>
                                      <Text style={styles.documentBadgeText}>{getDocExtensionBadge(msg.fileName)}</Text>
                                    </View>
                                    <View style={styles.documentTextContainer}>
                                      <Text style={styles.documentNameText} numberOfLines={1}>
                                        {msg.fileName || 'document.pdf'}
                                      </Text>
                                      <Text style={styles.documentSizeText}>
                                        {formatFileSize(msg.fileSize)} • Tap to Preview
                                      </Text>
                                    </View>
                                  </View>
                                </TouchableOpacity>
                              )}

                              {isVideo && (
                                <TouchableOpacity
                                  style={styles.videoMessageContainer}
                                  activeOpacity={0.8}
                                  onPress={() => {
                                    if (isMultiSelectMode) {
                                      toggleSelectMessage(msg);
                                    } else if (msg.mediaUrl) {
                                      setViewMediaModal({
                                        visible: true,
                                        type: 'video',
                                        url: getImageUrl(msg.mediaUrl),
                                        fileName: msg.fileName || 'video.mp4',
                                        fileSize: msg.fileSize || 0,
                                      });
                                    }
                                  }}
                                  onLongPress={() => {
                                    if (isMultiSelectMode) {
                                      toggleSelectMessage(msg);
                                    } else {
                                      handleMessageLongPress(msg);
                                    }
                                  }}
                                >
                                  <View style={styles.videoIconContainer}>
                                    <Ionicons name="videocam" size={20} color="#00A884" />
                                  </View>
                                  <View style={styles.videoTextContainer}>
                                    <Text style={styles.videoNameText} numberOfLines={1}>
                                      {msg.fileName || 'video.mp4'}
                                    </Text>
                                    <Text style={styles.videoSizeText}>
                                      {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : 'Video'} • Tap to Play
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              )}

                              {isVoice && (
                                <View style={styles.waVoiceContainer}>
                                  {/* Top Row: Play/Pause Button + Dot Line Progress + Mic Icon */}
                                  <View style={styles.waVoiceMainRow}>
                                    <TouchableOpacity
                                      style={[styles.waVoicePlayBtn, isMe ? styles.waVoicePlayBtnMe : styles.waVoicePlayBtnThem]}
                                      onPress={() => {
                                        if (isMultiSelectMode) {
                                          toggleSelectMessage(msg);
                                        } else {
                                          playVoiceNote(msg.id, msg.mediaUrl, msg);
                                        }
                                      }}
                                      onLongPress={() => {
                                        if (isMultiSelectMode) {
                                          toggleSelectMessage(msg);
                                        } else {
                                          handleMessageLongPress(msg);
                                        }
                                      }}
                                      activeOpacity={0.75}
                                    >
                                      <Ionicons
                                        name={playingMessageId === msg.id ? "pause" : "play"}
                                        size={16}
                                        color={isMe ? "#00A884" : "#FFFFFF"}
                                      />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                      style={styles.waVoiceTrackWrapper}
                                      activeOpacity={0.75}
                                      onPress={() => {
                                        if (isMultiSelectMode) {
                                          toggleSelectMessage(msg);
                                        } else {
                                          if (playingMessageId) {
                                            if (audioRecorderPlayerRef.current) {
                                              try {
                                                audioRecorderPlayerRef.current.removePlayBackListener();
                                                audioRecorderPlayerRef.current.removePlaybackEndListener();
                                                audioRecorderPlayerRef.current.stopPlayer();
                                              } catch (_) { }
                                            }
                                            setPlayingMessageId(null);
                                          }
                                          setIsAudioModalPaused(false);
                                          setAudioModalPosition(0);
                                          setAudioModalDuration(0);
                                          setAudioPlaybackRate(1.0);
                                          setIsAudioModalMuted(false);
                                          setViewMediaModal({
                                            visible: true,
                                            type: 'audio',
                                            url: msg.localAudioUri || getAudioUrl(msg.mediaUrl),
                                            fileName: msg.fileName || (msg.messageType === 'voice' ? 'Voice Message' : 'Audio Message'),
                                            fileSize: msg.fileSize || 0
                                          });
                                        }
                                      }}
                                      onLongPress={() => {
                                        if (isMultiSelectMode) {
                                          toggleSelectMessage(msg);
                                        } else {
                                          handleMessageLongPress(msg);
                                        }
                                      }}
                                    >
                                      {/* Track Line */}
                                      <View style={[styles.waVoiceTrackLine, isMe ? styles.waVoiceTrackLineMe : styles.waVoiceTrackLineThem]} />

                                      {/* Slider Dot Thumb */}
                                      <View
                                        style={[
                                          styles.waVoiceDotThumb,
                                          isMe ? styles.waVoiceDotThumbMe : styles.waVoiceDotThumbThem,
                                          {
                                            left: `${playingMessageId === msg.id && playbackDuration > 0
                                              ? Math.min(Math.max((playbackPosition / playbackDuration) * 92, 0), 92)
                                              : 0
                                              }%`,
                                          },
                                        ]}
                                      />
                                    </TouchableOpacity>
                                  </View>

                                  {/* Bottom Sub-row: Duration (Left) & Timestamp + Checkmarks (Right) */}
                                  <View style={styles.waVoiceSubRow}>
                                    <TouchableOpacity
                                      activeOpacity={0.7}
                                      onPress={() => {
                                        if (isMultiSelectMode) {
                                          toggleSelectMessage(msg);
                                        } else {
                                          if (playingMessageId) {
                                            if (audioRecorderPlayerRef.current) {
                                              try {
                                                audioRecorderPlayerRef.current.removePlayBackListener();
                                                audioRecorderPlayerRef.current.removePlaybackEndListener();
                                                audioRecorderPlayerRef.current.stopPlayer();
                                              } catch (_) { }
                                            }
                                            setPlayingMessageId(null);
                                          }
                                          setIsAudioModalPaused(false);
                                          setAudioModalPosition(0);
                                          setAudioModalDuration(0);
                                          setAudioPlaybackRate(1.0);
                                          setIsAudioModalMuted(false);
                                          setViewMediaModal({
                                            visible: true,
                                            type: 'audio',
                                            url: msg.localAudioUri || getAudioUrl(msg.mediaUrl),
                                            fileName: msg.fileName || (msg.messageType === 'voice' ? 'Voice Message' : 'Audio Message'),
                                            fileSize: msg.fileSize || 0
                                          });
                                        }
                                      }}
                                      style={{ flexDirection: 'row', alignItems: 'center' }}
                                    >
                                      <Text style={[styles.waVoiceDurationText, isMe ? styles.waVoiceMetaTextMe : styles.waVoiceMetaTextThem]}>
                                        {playingMessageId === msg.id && playbackPosition > 0
                                          ? `${Math.floor(playbackPosition / 1000 / 60)}:${(Math.floor((playbackPosition / 1000) % 60) < 10 ? '0' : '')}${Math.floor((playbackPosition / 1000) % 60)}`
                                          : (msg.fileSize && msg.fileSize > 0 ? `0:0${Math.min(Math.max(Math.floor(msg.fileSize / 1000), 2), 59)}` : '0:04')}
                                      </Text>
                                      <Ionicons name="expand-outline" size={11} color={isMe ? "#00A884" : "#8696A0"} style={{ marginLeft: 5 }} />
                                    </TouchableOpacity>

                                    <View style={styles.waVoiceMetaRight}>
                                      {isMessageStarredByMe(msg) && (
                                        <Ionicons name="star" size={11} color="#FFD700" style={{ marginRight: 4 }} />
                                      )}
                                      {msg.createdAt && msg.createdAt !== 'match-init' && (
                                        <Text style={[styles.waVoiceTimeText, isMe ? styles.waVoiceMetaTextMe : styles.waVoiceMetaTextThem]}>
                                          {formatMessageTime(msg.createdAt)}
                                        </Text>
                                      )}
                                      {isMe && msg.createdAt !== 'match-init' && (
                                        <Text style={[styles.statusTicks, (msg.status === 'pending' || msg.status === 'sending' || msg.status === 'queued') ? { color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' } : msg.status === 'seen' ? styles.ticksSeen : styles.ticksSent]}>
                                          {msg.status === 'failed' ? ' ⚠️ Failed (Tap to retry)' : (msg.status === 'pending' || msg.status === 'sending' || msg.status === 'queued') ? ' 🕒' : msg.status === 'seen' ? ' ✓✓' : msg.status === 'delivered' ? ' ✓✓' : ' ✓'}
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                </View>
                              )}

                              {isCall && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6, minWidth: 160 }}>
                                  <View
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: 18,
                                      backgroundColor: (msg.mediaUrl === 'missed' || msg.mediaUrl === 'declined' || (msg.text && (msg.text.includes('Missed') || msg.text.includes('declined') || msg.text.includes('No answer'))))
                                        ? 'rgba(255, 59, 48, 0.25)'
                                        : 'rgba(52, 199, 89, 0.25)',
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      marginRight: 10,
                                    }}
                                  >
                                    <Ionicons
                                      name={(msg.mediaUrl === 'missed' || msg.mediaUrl === 'declined' || (msg.text && (msg.text.includes('Missed') || msg.text.includes('declined') || msg.text.includes('No answer')))) ? "call-outline" : "call-outline"}
                                      size={18}
                                      color={(msg.mediaUrl === 'missed' || msg.mediaUrl === 'declined' || (msg.text && (msg.text.includes('Missed') || msg.text.includes('declined') || msg.text.includes('No answer')))) ? "#FF3B30" : "#34C759"}
                                    />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={[
                                        styles.messageText,
                                        isMe ? styles.messageTextMe : styles.messageTextThem,
                                        { fontWeight: '700', fontSize: 14 }
                                      ]}
                                    >
                                      {msg.text || (isMe ? 'Outgoing voice call' : 'Incoming voice call')}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                                      Voice Call
                                    </Text>
                                  </View>
                                </View>
                              )}

                              {isDeletedForEveryone ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingRight: 4 }}>
                                  <Ionicons
                                    name="ban-outline"
                                    size={15}
                                    color={isMe ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)'}
                                    style={{ marginRight: 6 }}
                                  />
                                  <Text
                                    style={[
                                      styles.messageText,
                                      {
                                        fontStyle: 'italic',
                                        color: isMe ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.6)',
                                        fontSize: 14.5,
                                      }
                                    ]}
                                  >
                                    {isMe ? 'You deleted this message' : 'This message was deleted'}
                                  </Text>
                                </View>
                              ) : hasMediaCaption ? (
                                <Text
                                  style={[
                                    styles.messageText,
                                    isMe ? styles.messageTextMe : styles.messageTextThem,
                                    { marginTop: 4, marginBottom: 2, paddingHorizontal: 4 }
                                  ]}
                                >
                                  {msg.text}
                                </Text>
                              ) : (!isSticker && !isImage && !isDocument && !isVideo && !isVoice && !isCall) ? (
                                <Text
                                  style={[
                                    styles.messageText,
                                    isMe ? styles.messageTextMe : styles.messageTextThem
                                  ]}
                                >
                                  {msg.text}
                                </Text>
                              ) : null}

                              {!isVoice && (!isImage || hasMediaCaption) && (
                                <View style={styles.messageMetaRow}>
                                  {msg.isPinned && !isDeletedForEveryone && (
                                    <Ionicons name="pin" size={11} color={isMe ? "rgba(255,255,255,0.85)" : "#38BDF8"} style={{ marginRight: 4 }} />
                                  )}
                                  {isMessageStarredByMe(msg) && !isDeletedForEveryone && (
                                    <Ionicons name="star" size={11} color="#FFD700" style={{ marginRight: 4 }} />
                                  )}
                                  {msg.isEdited && !isDeletedForEveryone && (
                                    <Text
                                      style={[
                                        styles.messageTimeText,
                                        isMe ? styles.messageTimeTextMe : styles.messageTimeTextThem,
                                        { marginRight: 4, fontStyle: 'italic', fontSize: 10, opacity: 0.85 },
                                        isSticker && { color: 'rgba(255,255,255,0.6)' }
                                      ]}
                                    >
                                      Edited
                                    </Text>
                                  )}
                                  {(msg.createdAt || msg.time) && msg.createdAt !== 'match-init' && (
                                    <Text
                                      style={[
                                        styles.messageTimeText,
                                        isMe ? styles.messageTimeTextMe : styles.messageTimeTextThem,
                                        isSticker && { color: 'rgba(255,255,255,0.6)' }
                                      ]}
                                    >
                                      {formatMessageTime(msg.createdAt) || msg.time || ''}
                                    </Text>
                                  )}
                                  {isMe && !isDeletedForEveryone && msg.createdAt !== 'match-init' && (
                                    <Text
                                      style={[
                                        styles.statusTicks,
                                        (msg.status === 'pending' || msg.status === 'sending' || msg.status === 'queued') ? { color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' } : msg.status === 'seen' ? styles.ticksSeen : styles.ticksSent
                                      ]}
                                    >
                                      {(msg.status === 'pending' || msg.status === 'sending' || msg.status === 'queued') ? ' 🕒' : msg.status === 'seen' ? ' ✓✓' : msg.status === 'delivered' ? ' ✓✓' : ' ✓'}
                                    </Text>
                                  )}
                                </View>
                              )}

                              {Array.isArray(msg.reactions) && msg.reactions.length > 0 && !isDeletedForEveryone && (() => {
                                const emojiList = Array.from(new Set(msg.reactions.map(r => typeof r === 'string' ? r : (r?.emoji || r?.char || '')).filter(Boolean)));
                                if (emojiList.length === 0) return null;
                                return (
                                  <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => {
                                      setReactionModalActiveTab('all');
                                      setReactionDetailsModalMsg(msg);
                                    }}
                                    style={[styles.reactionBadgePill, isMe ? styles.reactionPillMe : styles.reactionPillThem]}
                                  >
                                    {emojiList.map((emoji, idx) => (
                                      <Text key={idx} style={styles.reactionBadgeEmoji}>{emoji}</Text>
                                    ))}
                                    {msg.reactions.length > 1 && (
                                      <Text style={styles.reactionBadgeCount}>{msg.reactions.length}</Text>
                                    )}
                                  </TouchableOpacity>
                                );
                              })()}
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                    {isTyping && (
                      <View style={[styles.messageBubbleWrapper, styles.bubbleWrapperThem]}>
                        <View style={[styles.messageBubble, styles.bubbleThem, { paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }]}>
                          <Text style={[styles.messageText, styles.messageTextThem, { opacity: 0.9, fontStyle: 'italic', color: '#FF4B72', fontWeight: 'bold' }]}>
                            typing... 💬
                          </Text>
                        </View>
                      </View>
                    )}

                    {(() => {
                      const partnerId = (activeChat.id || activeChat._id || activeChat.userId || activeChat.senderId || activeChat.sender)?.toString();
                      const isBlockedByMe = Boolean(
                        activeChat.isBlocked ||
                        (partnerId && blockedUsersList && blockedUsersList.some((b) => (b.id || b._id || b.userId)?.toString() === partnerId))
                      );
                      const isBlockedByOther = Boolean(
                        activeChat.isBlockedByOther ||
                        (partnerId && blockedByOtherList && blockedByOtherList.map((id) => id.toString()).includes(partnerId))
                      );

                      if (isBlockedByMe) {
                        return (
                          <View style={{ width: '100%', alignItems: 'center', marginVertical: 14, paddingHorizontal: 20 }}>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => handleUnblockUser(activeChat.id || activeChat._id || activeChat.userId, activeChat.name || activeChat.firstName)}
                              style={{
                                backgroundColor: '#182229',
                                borderRadius: 8,
                                paddingVertical: 8,
                                paddingHorizontal: 16,
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.08)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                maxWidth: '92%',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.2,
                                shadowRadius: 2,
                                elevation: 2,
                              }}
                            >
                              <Text style={{ color: '#FFEEC3', fontSize: 12.5, textAlign: 'center', fontWeight: '500', lineHeight: 17 }}>
                                You blocked this contact. Tap to unblock.
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      if (isBlockedByOther) {
                        return (
                          <View style={{ width: '100%', alignItems: 'center', marginVertical: 14, paddingHorizontal: 20 }}>
                            <View
                              style={{
                                backgroundColor: '#182229',
                                borderRadius: 8,
                                paddingVertical: 8,
                                paddingHorizontal: 16,
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.08)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                maxWidth: '92%',
                              }}
                            >
                              <Text style={{ color: '#8696A0', fontSize: 12.5, textAlign: 'center', fontWeight: '500', lineHeight: 17 }}>
                                You cannot message this contact.
                              </Text>
                            </View>
                          </View>
                        );
                      }

                      return null;
                    })()}
                  </ScrollView>

                  {showStickerPicker && (
                    <View style={styles.stickerPickerContainer}>
                      {/* Category Navigation Tabs */}
                      <View style={styles.stickerCategoryTabBar}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                          {recentStickers.length > 0 && (
                            <TouchableOpacity
                              style={[styles.stickerCategoryTab, activeStickerCategory === 'recents' && styles.stickerCategoryTabActive]}
                              onPress={() => setActiveStickerCategory('recents')}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="time-outline" size={15} color={activeStickerCategory === 'recents' ? '#00A884' : '#8696A0'} style={{ marginRight: 4 }} />
                              <Text style={[styles.stickerCategoryTabText, activeStickerCategory === 'recents' && styles.stickerCategoryTabTextActive]}>Recent</Text>
                            </TouchableOpacity>
                          )}
                          {STICKER_CATEGORIES.map((cat) => {
                            const isActive = activeStickerCategory === cat.id;
                            return (
                              <TouchableOpacity
                                key={cat.id}
                                style={[styles.stickerCategoryTab, isActive && styles.stickerCategoryTabActive]}
                                onPress={() => setActiveStickerCategory(cat.id)}
                                activeOpacity={0.7}
                              >
                                <Text style={{ fontSize: 13, marginRight: 5 }}>{cat.emoji}</Text>
                                <Text style={[styles.stickerCategoryTabText, isActive && styles.stickerCategoryTabTextActive]}>
                                  {cat.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                        <TouchableOpacity
                          style={styles.stickerPickerCloseBtn}
                          onPress={() => setShowStickerPicker(false)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={20} color="#8696A0" />
                        </TouchableOpacity>
                      </View>

                      {/* Sticker Grid */}
                      <ScrollView contentContainerStyle={styles.stickerGrid} showsVerticalScrollIndicator={false}>
                        {(activeStickerCategory === 'recents' ? recentStickers : (STICKER_PACKS[activeStickerCategory] || STICKER_PACKS.romance)).map((st) => (
                          <TouchableOpacity
                            key={st.id}
                            style={styles.stickerItem}
                            onPress={() => selectSticker(st)}
                            activeOpacity={0.65}
                          >
                            {st.url ? (
                              <Image
                                source={{ uri: st.url }}
                                style={styles.stickerItemImage}
                                resizeMode="contain"
                              />
                            ) : (
                              <Text style={styles.stickerItemText}>{st.char}</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {replyingToMessage && (
                    <View style={styles.replyPreviewBanner}>
                      <View style={styles.replyPreviewBar} />
                      <View style={{ flex: 1, paddingLeft: 8 }}>
                        <Text style={styles.replyPreviewTitle}>
                          Replying to {replyingToMessage.sender === 'you' || (replyingToMessage.senderId && replyingToMessage.senderId === (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString()) ? 'yourself' : (activeChat?.name || 'them')}
                        </Text>
                        <Text style={styles.replyPreviewText} numberOfLines={1}>
                          {getQuotedSnippetText(replyingToMessage)}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setReplyingToMessage(null)} style={styles.closeReplyBtn}>
                        <Ionicons name="close" size={18} color="#AEBAC1" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {editingMessage && (
                    <View style={styles.editingMessageBanner}>
                      <Text style={styles.editingMessageBannerText} numberOfLines={1}>
                        Editing: "{editingMessage.text}"
                      </Text>
                      <TouchableOpacity
                        style={styles.cancelEditButton}
                        onPress={() => {
                          setEditingMessage(null);
                          typedMessageRef.current = '';
                          setTypedMessage('');
                        }}
                      >
                        <Text style={styles.cancelEditButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {(() => {
                    const partnerId = (activeChat.id || activeChat._id || activeChat.userId || activeChat.senderId || activeChat.sender)?.toString();
                    const isBlockedByMe = Boolean(
                      activeChat.isBlocked ||
                      (partnerId && blockedUsersList && blockedUsersList.some((b) => (b.id || b._id || b.userId)?.toString() === partnerId))
                    );
                    const isBlockedByOther = Boolean(
                      activeChat.isBlockedByOther ||
                      (partnerId && blockedByOtherList && blockedByOtherList.map((id) => id.toString()).includes(partnerId))
                    );

                    if (isBlockedByMe) {
                      return (
                        <View style={{
                          paddingVertical: 14,
                          paddingHorizontal: 16,
                          backgroundColor: '#111B21',
                          borderTopWidth: 1,
                          borderTopColor: '#202C33',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => handleUnblockUser(activeChat.id || activeChat._id || activeChat.userId, activeChat.name || activeChat.firstName)}
                            style={{ width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}
                          >
                            <Text style={{ color: '#8696A0', fontSize: 13.5, fontWeight: '500', textAlign: 'center' }}>
                              You blocked this contact. <Text style={{ color: '#00A884', fontWeight: '700', textDecorationLine: 'underline' }}>Tap to unblock.</Text>
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    }

                    if (isBlockedByOther) {
                      return (
                        <View style={{
                          paddingVertical: 14,
                          paddingHorizontal: 16,
                          backgroundColor: '#111B21',
                          borderTopWidth: 1,
                          borderTopColor: '#202C33',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Text style={{ color: '#8696A0', fontSize: 13.5, fontWeight: '500', textAlign: 'center' }}>
                            You cannot send messages to this contact.
                          </Text>
                        </View>
                      );
                    }

                    return isRecording ? (
                      <View style={styles.recordingRow}>
                        <View style={styles.recordingIndicatorRow}>
                          <View style={styles.recordingPulsingDot} />
                          <Text style={styles.recordingTimeText}>Recording: {recordTime}</Text>
                        </View>
                        <View style={styles.recordingControls}>
                          <TouchableOpacity
                            style={[styles.cancelRecordButton, { flexDirection: 'row', alignItems: 'center' }]}
                            onPress={() => stopRecording(false)}
                          >
                            <Ionicons name="close-circle" size={16} color="#FF3B30" style={{ marginRight: 4 }} />
                            <Text style={styles.cancelRecordText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.sendRecordButton, { flexDirection: 'row', alignItems: 'center' }]}
                            onPress={() => stopRecording(true)}
                          >
                            <Ionicons name="send" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.sendRecordIcon}>Send</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.chatInputRow}>
                        <TouchableOpacity
                          style={styles.chatActionButton}
                          onPress={handleAttachPress}
                        >
                          <Ionicons name="attach-outline" size={24} color="#8696A0" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.chatActionButton}
                          onPress={handleEmojiPress}
                        >
                          <Ionicons name={showEmojiPicker ? "happy" : "happy-outline"} size={24} color={showEmojiPicker ? "#00A884" : "#8696A0"} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.chatActionButton}
                          onPress={handleStickerPress}
                        >
                          <Ionicons name={showStickerPicker ? "sparkles" : "sparkles-outline"} size={22} color={showStickerPicker ? "#00A884" : "#8696A0"} />
                        </TouchableOpacity>

                        <TextInput
                          ref={chatInputRef}
                          style={styles.chatInput}
                          placeholder={editingMessage ? "Edit message..." : "Type a message..."}
                          placeholderTextColor="rgba(255, 255, 255, 0.4)"
                          value={typedMessage}
                          onChangeText={handleInputChange}
                          autoCorrect={false}
                          autoCapitalize="sentences"
                          spellCheck={false}
                          keyboardType="default"
                          returnKeyType="send"
                          blurOnSubmit={false}
                          onSubmitEditing={() => {
                            if (!editingMessage && ((typedMessageRef.current && typedMessageRef.current.trim()) || typedMessage.trim())) {
                              handleSendMessage();
                            }
                          }}
                          onFocus={() => {
                            setShowStickerPicker(false);
                            setShowEmojiPicker(false);
                            setTimeout(() => {
                              if (chatScrollViewRef.current) {
                                chatScrollViewRef.current.scrollToEnd({ animated: true });
                              }
                            }, 150);
                          }}
                        />

                        {typedMessage.trim() === '' && !editingMessage ? (
                          <TouchableOpacity
                            style={styles.chatMicButton}
                            onPress={startRecording}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="mic" size={20} color="#FFFFFF" />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.chatSendButton}
                            onPress={() => handleSendMessage()}
                          >
                            <Ionicons name="send" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })()}

                  <Modal
                    visible={showAttachmentModal}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowAttachmentModal(false)}
                  >
                    <TouchableOpacity
                      style={styles.attachDialogOverlay}
                      activeOpacity={1}
                      onPress={() => setShowAttachmentModal(false)}
                    >
                      <View style={styles.attachDialogContent}>
                        <Text style={styles.attachDialogTitle}>Share Media / Document</Text>

                        <View style={styles.attachOptionsRow}>
                          <TouchableOpacity
                            style={styles.attachOptionBtn}
                            onPress={handlePickImage}
                          >
                            <View style={styles.attachOptionIconBg}>
                              <Ionicons name="images-outline" size={26} color="#00A884" />
                            </View>
                            <Text style={styles.attachOptionLabel}>Photos & Videos</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.attachOptionBtn}
                            onPress={handlePickRealDocument}
                          >
                            <View style={styles.attachOptionIconBg}>
                              <Ionicons name="document-text-outline" size={26} color="#7F66FF" />
                            </View>
                            <Text style={styles.attachOptionLabel}>Document / File</Text>
                          </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                          style={styles.attachCancelBtn}
                          onPress={() => setShowAttachmentModal(false)}
                        >
                          <Text style={styles.attachCancelText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </Modal>

                  <EmojiPicker
                    open={showEmojiPicker}
                    onClose={() => {
                      setShowEmojiPicker(false);
                      setReactingToMessageForEmoji(null);
                    }}
                    onEmojiSelected={handleEmojiSelected}
                    enableSearchBar={true}
                    enableRecentlyUsed={true}
                    categoryPosition="top"
                    theme={{
                      backdrop: 'rgba(0, 0, 0, 0.55)',
                      knob: '#00A884',
                      container: '#1F2C34',
                      header: '#E9EDEF',
                      skinTonesContainer: '#121B22',
                      category: {
                        icon: '#8696A0',
                        iconActive: '#00A884',
                        container: '#121B22',
                        containerActive: 'rgba(0, 168, 132, 0.22)',
                      },
                      search: {
                        background: '#121B22',
                        text: '#E9EDEF',
                        placeholder: '#8696A0',
                        icon: '#8696A0',
                      },
                    }}
                  />

                  {/* WhatsApp-Style Media Preview and Send Modal */}
                  <Modal
                    visible={Boolean(pendingMediaSend)}
                    transparent={false}
                    animationType="slide"
                    onRequestClose={handleCancelSendMedia}
                  >
                    <SafeAreaView style={styles.waPreviewModalOverlay}>
                      <StatusBar barStyle="light-content" backgroundColor="#0B141A" />

                      {/* Header */}
                      <View style={styles.waPreviewHeader}>
                        <TouchableOpacity
                          style={styles.waPreviewBackBtn}
                          onPress={handleCancelSendMedia}
                          disabled={isMediaUploading}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close" size={26} color="#FFFFFF" />
                        </TouchableOpacity>

                        <View style={styles.waPreviewHeaderTitleContainer}>
                          <Text style={styles.waPreviewHeaderTitle} numberOfLines={1}>
                            {activeChat?.name || 'Send Media'}
                          </Text>
                          <Text style={styles.waPreviewHeaderSubtitle} numberOfLines={1}>
                            {pendingMediaSend?.mediaType === 'image'
                              ? 'Photo'
                              : pendingMediaSend?.mediaType === 'video'
                                ? `Video • ${formatFileSize(pendingMediaSend?.fileSize)}`
                                : (pendingMediaSend?.mediaType === 'voice' || pendingMediaSend?.mediaType === 'audio')
                                  ? `Audio • ${formatFileSize(pendingMediaSend?.fileSize)}`
                                  : `${pendingMediaSend?.fileName || 'Document'} • ${formatFileSize(pendingMediaSend?.fileSize)}`}
                          </Text>
                        </View>

                        {isMediaUploading ? (
                          <ActivityIndicator size="small" color="#00A884" style={{ marginRight: 8 }} />
                        ) : (
                          <TouchableOpacity
                            onPress={handleCancelSendMedia}
                            style={{ padding: 6 }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: '#8696A0', fontSize: 14 }}>Discard</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Media Body Preview */}
                      <View style={styles.waPreviewContentArea}>
                        {pendingMediaSend?.mediaType === 'image' ? (
                          <Image
                            source={{ uri: pendingMediaSend.uri }}
                            style={styles.waPreviewImage}
                            resizeMode="contain"
                          />
                        ) : pendingMediaSend?.mediaType === 'video' ? (
                          <View style={styles.waPreviewVideoContainer}>
                            <Video
                              source={{ uri: pendingMediaSend.uri }}
                              style={styles.waPreviewVideoPlayer}
                              resizeMode="contain"
                              controls={true}
                              paused={false}
                              repeat={true}
                            />
                            <View style={styles.waPreviewVideoBadge}>
                              <Ionicons name="videocam" size={14} color="#00A884" style={{ marginRight: 5 }} />
                              <Text style={styles.waPreviewVideoBadgeText}>
                                {formatFileSize(pendingMediaSend.fileSize)}
                              </Text>
                            </View>
                          </View>
                        ) : (pendingMediaSend?.mediaType === 'voice' || pendingMediaSend?.mediaType === 'audio') ? (
                          <View style={styles.waPreviewDocCard}>
                            <View style={[styles.waPreviewDocIcon, { backgroundColor: '#00A884' }]}>
                              <Ionicons name="mic" size={28} color="#FFFFFF" />
                            </View>
                            <Text style={styles.waPreviewDocName} numberOfLines={2}>
                              {pendingMediaSend?.fileName || 'voice_note.mp4'}
                            </Text>
                            <Text style={styles.waPreviewDocMeta}>
                              Voice / Audio Note • {formatFileSize(pendingMediaSend?.fileSize)}
                            </Text>
                            <View style={styles.waPreviewDocPill}>
                              <Ionicons name="paper-plane-outline" size={15} color="#00A884" />
                              <Text style={styles.waPreviewDocPillText}>Tap send button below to share</Text>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.waPreviewDocCard}>
                            <View style={[styles.waPreviewDocIcon, getDocTypeStyle(pendingMediaSend?.fileName)]}>
                              <Text style={styles.waPreviewDocIconText}>
                                {getDocExtensionBadge(pendingMediaSend?.fileName)}
                              </Text>
                            </View>
                            <Text style={styles.waPreviewDocName} numberOfLines={2}>
                              {pendingMediaSend?.fileName || 'document.pdf'}
                            </Text>
                            <Text style={styles.waPreviewDocMeta}>
                              {formatFileSize(pendingMediaSend?.fileSize)} • Ready to send
                            </Text>
                            <View style={styles.waPreviewDocPill}>
                              <Ionicons name="paper-plane-outline" size={15} color="#00A884" />
                              <Text style={styles.waPreviewDocPillText}>Tap send button below to share</Text>
                            </View>
                          </View>
                        )}
                      </View>

                      {/* Uploading Status Banner */}
                      {isMediaUploading && (
                        <View style={styles.waPreviewUploadingBanner}>
                          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.waPreviewUploadingText}>
                            Uploading...
                          </Text>
                        </View>
                      )}

                      {/* Bottom Caption Input & WhatsApp Send Button */}
                      <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                      >
                        <View style={styles.waPreviewBottomBar}>
                          <View style={styles.waPreviewInputWrapper}>
                            <Ionicons name="happy-outline" size={22} color="#8696A0" style={{ marginRight: 8 }} />
                            <TextInput
                              style={styles.waPreviewInput}
                              placeholder="Add a caption..."
                              placeholderTextColor="#8696A0"
                              value={mediaCaptionText}
                              onChangeText={setMediaCaptionText}
                              multiline={true}
                              maxLength={500}
                              editable={!isMediaUploading}
                            />
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.waPreviewSendBtn,
                              isMediaUploading && { backgroundColor: '#0B8065', opacity: 0.85 }
                            ]}
                            onPress={handleConfirmSendMedia}
                            disabled={isMediaUploading}
                            activeOpacity={0.8}
                          >
                            {isMediaUploading ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Ionicons name="send" size={20} color="#FFFFFF" style={{ marginLeft: 3 }} />
                            )}
                          </TouchableOpacity>
                        </View>
                      </KeyboardAvoidingView>
                    </SafeAreaView>
                  </Modal>
                </KeyboardAvoidingView>
              ) : (
                /* Chat List view */
                <View style={styles.chatListWrapper}>
                  {isConversationSearchActive ? (
                    <View style={[styles.chatSearchHeaderBar, { marginBottom: 12 }]}>
                      <TouchableOpacity
                        style={styles.chatBackButton}
                        onPress={() => {
                          setIsConversationSearchActive(false);
                          setConversationSearchQuery('');
                        }}
                      >
                        <Ionicons name="arrow-back" size={24} color="#AEBAC1" />
                      </TouchableOpacity>

                      <View style={styles.chatSearchInputContainer}>
                        <TextInput
                          style={styles.chatSearchInput}
                          placeholder="Search matches or messages..."
                          placeholderTextColor="#8696A0"
                          value={conversationSearchQuery}
                          onChangeText={(val) => setConversationSearchQuery(val)}
                          autoFocus={true}
                        />
                        {conversationSearchQuery.trim().length > 0 && (
                          <TouchableOpacity
                            onPress={() => setConversationSearchQuery('')}
                            style={{ padding: 4, marginRight: 4 }}
                          >
                            <Ionicons name="close" size={18} color="#8696A0" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ) : selectedChatIds.length > 0 ? (
                    <View style={styles.chatSelectionHeaderRow}>
                      <View style={styles.chatSelectionLeftGroup}>
                        <TouchableOpacity
                          style={styles.chatSelectionCloseBtn}
                          onPress={() => setSelectedChatIds([])}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.chatSelectionCountText}>
                          {selectedChatIds.length}
                        </Text>
                      </View>
                      <View style={styles.chatSelectionRightGroup}>
                        <TouchableOpacity
                          style={styles.chatSelectionActionBtn}
                          onPress={handleSelectAllChats}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={selectedChatIds.length === chats.length ? "checkbox" : "checkbox-outline"}
                            size={22}
                            color="#00A884"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.chatSelectionActionBtn, { marginLeft: 16 }]}
                          onPress={handleDeleteSelectedChats}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={22} color="#FF4D4D" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.chatListHeaderRow}>
                      <TouchableOpacity
                        style={styles.headerBackBtn}
                        onPress={() => setActiveTab('swipe')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                      </TouchableOpacity>
                      <View style={styles.chatHeaderTitleWrapper}>
                        <Text style={styles.chatSectionTitle} numberOfLines={1}>Conversations</Text>
                        <Text style={styles.chatSectionSubtitle} numberOfLines={1}>Start talking with your matches.</Text>
                      </View>
                      <View style={styles.chatHeaderActionsRow}>
                        <TouchableOpacity
                          style={styles.chatHeaderIconButton}
                          onPress={() => {
                            setIsConversationSearchActive(true);
                            setConversationSearchQuery('');
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="search-outline" size={20} color="#AEBAC1" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.chatThreeDotsButton, { marginLeft: 8 }]}
                          onPress={() => setShowConversationsMenuModal(true)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="ellipsis-vertical" size={20} color="#AEBAC1" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {(() => {
                    const filteredChats = (chats || []).filter((chat) => {
                      if (!isConversationSearchActive || !conversationSearchQuery.trim()) return true;
                      const qTrim = conversationSearchQuery.trim().toLowerCase();
                      const nameMatch = (chat.name || chat.firstName || '').toLowerCase().includes(qTrim);
                      const lastMsg = Array.isArray(chat.messages) && chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
                      const msgMatch = !!(lastMsg && lastMsg.text && lastMsg.text.toLowerCase().includes(qTrim));
                      return nameMatch || msgMatch;
                    });

                    if (chats.length === 0) {
                      return (
                        <View style={styles.emptyChatsContainer}>
                          <Ionicons name="chatbubbles-outline" size={56} color="#38BDF8" style={{ marginBottom: 16 }} />
                          <Text style={styles.emptyChatsTitle}>No Conversations Yet</Text>
                          <Text style={styles.emptyChatsSubtitle}>
                            Your matches will show up here. Swipe right to match and start chatting!
                          </Text>
                        </View>
                      );
                    }

                    if (filteredChats.length === 0) {
                      return (
                        <View style={{ paddingVertical: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
                          <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 12 }} />
                          <Text style={{ color: '#8696A0', fontSize: 16, fontWeight: '700' }}>
                            No conversations found
                          </Text>
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                            No matches or messages matching "{conversationSearchQuery}"
                          </Text>
                        </View>
                      );
                    }

                    return (
                      <ScrollView style={styles.chatsList} showsVerticalScrollIndicator={false}>
                        {sortChatsByRecent(filteredChats).map((chat) => {
                          const currentId = currentUser?.id || currentUser?._id;
                          const unreadCount = (chat.messages || []).filter(
                            (m) => (m.sender !== 'you' && m.senderId !== currentId?.toString()) && m.id !== 'match-init' && m.status !== 'seen'
                          ).length;

                          const lastMsg = chat.messages ? chat.messages[chat.messages.length - 1] : null;

                          const cId = (chat.id || chat._id || chat.userId)?.toString();
                          const isSelected = cId && selectedChatIds.includes(cId);

                          return (
                            <TouchableOpacity
                              key={chat.id || chat._id}
                              style={[
                                styles.chatRow,
                                unreadCount > 0 && styles.chatRowUnread,
                                isSelected && styles.chatRowSelected
                              ]}
                              onPress={() => {
                                if (selectedChatIds.length > 0) {
                                  toggleSelectChat(chat);
                                } else {
                                  typedMessageRef.current = '';
                                  setTypedMessage('');
                                  const cPartnerId = (chat.id || chat._id || chat.userId)?.toString();
                                  const sanitizedChat = {
                                    ...chat,
                                    messages: (chat.messages || []).filter((m) => m.id === 'match-init' || doesMessageBelongToPartner(m, cPartnerId)),
                                  };
                                  dispatch(setMessages([]));
                                  dispatch(setActiveChatUser(sanitizedChat));
                                  setActiveChat(sanitizedChat);
                                }
                              }}
                              onLongPress={() => toggleSelectChat(chat)}
                              delayLongPress={200}
                              activeOpacity={0.75}
                            >
                              <View style={styles.avatarWrapper}>
                                <Image source={{ uri: getImageUrl(chat.image) }} style={styles.chatRowAvatar} />
                                {isSelected ? (
                                  <View style={styles.selectedChatCheckmarkOverlay}>
                                    <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                                  </View>
                                ) : (() => {
                                  const isOnline = cId && onlineUsersMap[cId] !== undefined ? !!onlineUsersMap[cId] : !!(chat.isOnline || chat.user?.isOnline);
                                  return isOnline ? <View style={styles.onlineDotOverlay} /> : null;
                                })()}
                              </View>
                              <View style={styles.chatRowInfo}>
                                <Text style={[styles.chatRowName, unreadCount > 0 && styles.chatRowNameUnread]} numberOfLines={1}>
                                  {chat.name}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                  {(() => {
                                    const currentId = (currentUser?.id || currentUser?._id)?.toString();
                                    const isLastMsgSentByMe = !!(lastMsg && (lastMsg.sender === 'you' || lastMsg.senderId?.toString() === currentId));
                                    if (!isLastMsgSentByMe || !lastMsg) return null;
                                    const isPending = lastMsg.status === 'pending' || lastMsg.status === 'sending' || lastMsg.status === 'queued' || String(lastMsg.id || '').startsWith('temp-');
                                    const isFailed = lastMsg.status === 'failed';
                                    const isSeen = lastMsg.status === 'seen';
                                    const isDelivered = lastMsg.status === 'delivered';

                                    if (isFailed) {
                                      return (
                                        <Ionicons name="alert-circle" size={13} color="#FF3B30" style={{ marginRight: 3 }} />
                                      );
                                    }
                                    if (isPending) {
                                      return (
                                        <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.4)" style={{ marginRight: 3 }} />
                                      );
                                    }
                                    if (isSeen) {
                                      return (
                                        <Ionicons name="checkmark-done" size={15} color="#53BDEB" style={{ marginRight: 3 }} />
                                      );
                                    }
                                    if (isDelivered) {
                                      return (
                                        <Ionicons name="checkmark-done" size={15} color="#8696A0" style={{ marginRight: 3 }} />
                                      );
                                    }
                                    return (
                                      <Ionicons name="checkmark" size={14} color="#8696A0" style={{ marginRight: 3 }} />
                                    );
                                  })()}
                                  {(() => {
                                    if (!lastMsg) {
                                      return (
                                        <Text style={[styles.chatRowLastMessage, unreadCount > 0 && styles.chatRowLastMessageUnread, { flex: 1 }]} numberOfLines={1}>
                                          Tap to chat
                                        </Text>
                                      );
                                    }

                                    const isDeleted = Boolean(lastMsg.isDeletedForEveryone || lastMsg.text === 'This message was deleted');
                                    if (isDeleted) {
                                      const currentId = (currentUser?.id || currentUser?._id)?.toString();
                                      const isMe = lastMsg.sender === 'you' || lastMsg.senderId?.toString() === currentId;
                                      return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                          <Ionicons name="ban-outline" size={13} color="#8696A0" style={{ marginRight: 4 }} />
                                          <Text style={[styles.chatRowLastMessage, { fontStyle: 'italic', flex: 1 }]} numberOfLines={1}>
                                            {isMe ? 'You deleted this message' : 'This message was deleted'}
                                          </Text>
                                        </View>
                                      );
                                    }

                                    const type = lastMsg.messageType || (lastMsg.mediaUrl ? 'image' : 'text');
                                    const iconColor = unreadCount > 0 ? '#00A884' : '#8696A0';

                                    if (type === 'voice' || type === 'audio') {
                                      const durationText = (lastMsg.fileSize && lastMsg.fileSize > 0)
                                        ? `0:0${Math.min(Math.max(Math.floor(lastMsg.fileSize / 1000), 2), 59)}`
                                        : 'Voice message';
                                      return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                          <Ionicons name="mic" size={15} color={iconColor} style={{ marginRight: 4 }} />
                                          <Text style={[styles.chatRowLastMessage, unreadCount > 0 && styles.chatRowLastMessageUnread, { flex: 1 }]} numberOfLines={1}>
                                            {durationText}
                                          </Text>
                                        </View>
                                      );
                                    }

                                    if (type === 'image') {
                                      const hasCaption = Boolean(
                                        lastMsg.text &&
                                        typeof lastMsg.text === 'string' &&
                                        lastMsg.text.trim().length > 0 &&
                                        !lastMsg.text.startsWith('http') &&
                                        !lastMsg.text.startsWith('data:') &&
                                        lastMsg.text !== '📷 Image' &&
                                        lastMsg.text !== 'Photo'
                                      );
                                      return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                          <Ionicons name="camera" size={15} color={iconColor} style={{ marginRight: 4 }} />
                                          <Text style={[styles.chatRowLastMessage, unreadCount > 0 && styles.chatRowLastMessageUnread, { flex: 1 }]} numberOfLines={1}>
                                            {hasCaption ? lastMsg.text.trim() : 'Photo'}
                                          </Text>
                                        </View>
                                      );
                                    }

                                    if (type === 'video') {
                                      const hasCaption = Boolean(
                                        lastMsg.text &&
                                        typeof lastMsg.text === 'string' &&
                                        lastMsg.text.trim().length > 0 &&
                                        !lastMsg.text.startsWith('http') &&
                                        lastMsg.text !== '🎬 Video' &&
                                        lastMsg.text !== 'Video'
                                      );
                                      return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                          <Ionicons name="videocam" size={15} color={iconColor} style={{ marginRight: 4 }} />
                                          <Text style={[styles.chatRowLastMessage, unreadCount > 0 && styles.chatRowLastMessageUnread, { flex: 1 }]} numberOfLines={1}>
                                            {hasCaption ? lastMsg.text.trim() : 'Video'}
                                          </Text>
                                        </View>
                                      );
                                    }

                                    if (type === 'document') {
                                      return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                          <Ionicons name="document-text" size={15} color={iconColor} style={{ marginRight: 4 }} />
                                          <Text style={[styles.chatRowLastMessage, unreadCount > 0 && styles.chatRowLastMessageUnread, { flex: 1 }]} numberOfLines={1}>
                                            {lastMsg.fileName || lastMsg.text || 'Document'}
                                          </Text>
                                        </View>
                                      );
                                    }

                                    if (type === 'call' || type === 'voice_call') {
                                      const isMissed = lastMsg.text && (lastMsg.text.includes('Missed') || lastMsg.text.includes('declined') || lastMsg.text.includes('No answer'));
                                      return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                          <Ionicons name="call" size={14} color={isMissed ? '#FF3B30' : iconColor} style={{ marginRight: 4 }} />
                                          <Text style={[styles.chatRowLastMessage, unreadCount > 0 && styles.chatRowLastMessageUnread, { flex: 1 }]} numberOfLines={1}>
                                            {lastMsg.text || (isMissed ? 'Missed voice call' : 'Voice call')}
                                          </Text>
                                        </View>
                                      );
                                    }

                                    if (type === 'sticker') {
                                      return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                          <Ionicons name="happy-outline" size={15} color={iconColor} style={{ marginRight: 4 }} />
                                          <Text style={[styles.chatRowLastMessage, unreadCount > 0 && styles.chatRowLastMessageUnread, { flex: 1 }]} numberOfLines={1}>
                                            Sticker
                                          </Text>
                                        </View>
                                      );
                                    }

                                    return (
                                      <Text style={[styles.chatRowLastMessage, unreadCount > 0 && styles.chatRowLastMessageUnread, { flex: 1 }]} numberOfLines={1}>
                                        {lastMsg.text || ''}
                                      </Text>
                                    );
                                  })()}
                                </View>
                              </View>
                              <View style={styles.chatRowRightMeta}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  {chat.isBlocked && (
                                    <View style={{ backgroundColor: 'rgba(255,59,48,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 6 }}>
                                      <Text style={{ color: '#FF3B30', fontSize: 10, fontWeight: '700' }}>Blocked</Text>
                                    </View>
                                  )}
                                  <Text style={[styles.chatRowTime, unreadCount > 0 && styles.chatRowTimeUnread]}>
                                    {lastMsg && lastMsg.createdAt && lastMsg.createdAt !== 'match-init'
                                      ? formatMessageTime(lastMsg.createdAt)
                                      : 'Now'}
                                  </Text>
                                </View>
                                {unreadCount > 0 && (
                                  <View style={styles.whatsappUnreadBadge}>
                                    <Text style={styles.whatsappUnreadBadgeText}>
                                      {unreadCount > 99 ? '99+' : unreadCount}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    );
                  })()}
                </View>
              )}
            </View>
          )}

          {activeTab === 'profile' && (
            <Profile
              userProfile={activeUserProfile}
              onUpdateProfile={onUpdateProfile}
              onLogout={onLogout}
              onRemoveProfile={onRemoveProfile}
              onGoBack={() => {
                handleTabPress('swipe');
                return true;
              }}
              onBack={() => handleTabPress('swipe')}
            />
          )}
        </View>

        {/* Home Screen Navigation Bar */}
        <View style={[styles.navigationBar, { paddingBottom: safeBottomPadding, height: 56 + safeBottomPadding }]}>
          <TouchableOpacity
            style={[styles.navigationTab, activeTab === 'swipe' && styles.navigationTabActive]}
            onPress={() => handleTabPress('swipe')}
          >
            <Ionicons
              name={activeTab === 'swipe' ? "flame" : "flame-outline"}
              size={24}
              color={activeTab === 'swipe' ? "#FE3C72" : "rgba(255, 255, 255, 0.6)"}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.navigationLabel, activeTab === 'swipe' && styles.navigationLabelActive]}>
              Swipe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navigationTab, activeTab === 'search' && styles.navigationTabActive]}
            onPress={() => handleTabPress('search')}
          >
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={activeTab === 'search' ? "search" : "search-outline"}
                size={24}
                color={activeTab === 'search' ? "#FE3C72" : "rgba(255, 255, 255, 0.6)"}
                style={{ marginBottom: 2 }}
              />
              {(!userProfile?.subscriptionTier || userProfile?.subscriptionTier?.toLowerCase() === 'free') && (
                <View style={{
                  position: 'absolute',
                  top: -3,
                  right: -6,
                  backgroundColor: '#FFD700',
                  borderRadius: 6,
                  paddingHorizontal: 3,
                  paddingVertical: 1,
                }}>
                  <Ionicons name="lock-closed" size={9} color="#0F121A" />
                </View>
              )}
            </View>
            <Text style={[styles.navigationLabel, activeTab === 'search' && styles.navigationLabelActive]}>
              Search
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navigationTab, activeTab === 'likes' && styles.navigationTabActive]}
            onPress={() => handleTabPress('likes')}
          >
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={activeTab === 'likes' ? "heart" : "heart-outline"}
                size={24}
                color={activeTab === 'likes' ? "#FE3C72" : "rgba(255, 255, 255, 0.6)"}
                style={{ marginBottom: 2 }}
              />
              {unreadLikesCount > 0 && (
                <View style={styles.navBadgeContainer}>
                  <Text style={styles.navBadgeText}>
                    {unreadLikesCount > 99 ? '99+' : unreadLikesCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.navigationLabel, activeTab === 'likes' && styles.navigationLabelActive]}>
              Likes
            </Text>
          </TouchableOpacity>

          {(() => {
            const currentId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();

            const chatsUnread = chats.reduce((total, c) => {
              const count = (c.messages || []).filter(
                (m) => (m.sender !== 'you' && (m.senderId || m.sender)?.toString() !== currentId) && m.id !== 'match-init' && m.status !== 'seen'
              ).length;
              return total + count;
            }, 0);

            const rawUnread = (allMessages || []).filter((msg) => {
              if (!msg || !currentId) return false;
              const rId = (msg.receiverId || msg.receiver)?._id?.toString() || (msg.receiverId || msg.receiver)?.toString();
              const sId = (msg.senderId || msg.sender)?._id?.toString() || (msg.senderId || msg.sender)?._id?.toString();
              return rId === currentId && sId !== currentId && msg.status !== 'seen';
            }).length;

            const totalUnreadChatCount = Math.max(chatsUnread, rawUnread) + unreadChatPushCount;

            return (
              <TouchableOpacity
                style={[styles.navigationTab, activeTab === 'chat' && styles.navigationTabActive]}
                onPress={() => {
                  handleTabPress('chat');
                  setUnreadChatPushCount(0);
                }}
              >
                <View style={{ position: 'relative' }}>
                  <Ionicons
                    name={activeTab === 'chat' ? "chatbubbles" : "chatbubbles-outline"}
                    size={24}
                    color={activeTab === 'chat' ? "#FE3C72" : "rgba(255, 255, 255, 0.6)"}
                    style={{ marginBottom: 2 }}
                  />
                  {totalUnreadChatCount > 0 && (
                    <View style={styles.navBadgeContainer}>
                      <Text style={styles.navBadgeText}>
                        {totalUnreadChatCount > 99 ? '99+' : totalUnreadChatCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.navigationLabel, activeTab === 'chat' && styles.navigationLabelActive]}>
                  Chat
                </Text>
              </TouchableOpacity>
            );
          })()}

          <TouchableOpacity
            style={[styles.navigationTab, activeTab === 'profile' && styles.navigationTabActive]}
            onPress={() => handleTabPress('profile')}
          >
            <Ionicons
              name={activeTab === 'profile' ? "person" : "person-outline"}
              size={24}
              color={activeTab === 'profile' ? "#FE3C72" : "rgba(255, 255, 255, 0.6)"}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.navigationLabel, activeTab === 'profile' && styles.navigationLabelActive]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>

        {/* Modal: Full Page Candidate Profile details */}
        {showActiveCardDetails && swipeIndex < MOCK_MATCHES.length && (
          <Modal
            visible={showActiveCardDetails}
            animationType="slide"
            onRequestClose={() => setShowActiveCardDetails(false)}
          >
            <View style={[styles.candidateDetailsWrapper, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 15 : 0) }]}>
              <View style={styles.cardExpandedHeader}>
                <TouchableOpacity
                  style={styles.cardDetailMinimizeHeaderBtn}
                  onPress={() => setShowActiveCardDetails(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cardDetailMinimizeArrow}>▼</Text>
                  <Text style={styles.cardDetailMinimizeLabel}>Minimize Profile</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.cardExpandedScrollBody} showsVerticalScrollIndicator={false}>
                {/* Image or Video Preview at the top of Maximized Profile */}
                {(() => {
                  const candidateObj = MOCK_MATCHES[swipeIndex] || {};
                  const candidateMedia = candidateObj.profileImage || candidateObj.image || (candidateObj.profileImages && candidateObj.profileImages[0]) || '';
                  const isVidMedia = isVideoUrl(candidateMedia);

                  return (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setCandidateStoryIndex(0)}
                      style={styles.cardExpandedTopImageFull}
                    >
                      {isVidMedia ? (
                        <View style={styles.cardExpandedTopImageFull} pointerEvents="none">
                          <Video
                            source={{ uri: getImageUrl(candidateMedia) }}
                            style={styles.cardExpandedTopImageFull}
                            resizeMode="cover"
                            paused={false}
                            repeat={true}
                            controls={false}
                            muted={true}
                          />
                        </View>
                      ) : (
                        <Image
                          source={{ uri: getImageUrl(candidateMedia) }}
                          style={styles.cardExpandedTopImageFull}
                        />
                      )}

                      {isVidMedia && (
                        <View style={styles.candidateVideoBadgeOverlay}>
                          <Text style={styles.candidateVideoBadgeText}>🎬 Video Preview (Tap for Fullscreen)</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })()}

                {/* Details below image */}
                <View style={styles.cardExpandedContentPadding}>
                  <View style={styles.matchNameRow}>
                    <Text style={styles.matchNameTextLarge}>
                      {MOCK_MATCHES[swipeIndex].name}, {MOCK_MATCHES[swipeIndex].age}
                    </Text>
                    {!!(MOCK_MATCHES[swipeIndex] && MOCK_MATCHES[swipeIndex].isEmailVerified) && (
                      <Ionicons name="checkmark-circle" size={20} color="#0084FF" style={{ marginLeft: 6, marginRight: 4 }} />
                    )}
                    {!!(MOCK_MATCHES[swipeIndex] && onlineUsersMap[(MOCK_MATCHES[swipeIndex].id || MOCK_MATCHES[swipeIndex]._id || MOCK_MATCHES[swipeIndex].userId)?.toString()]) && (
                      <View style={styles.swipeOnlineBadge}>
                        <View style={styles.swipeOnlineDot} />
                        <Text style={styles.swipeOnlineText}>Online</Text>
                      </View>
                    )}
                    <View style={[styles.distanceBadgeLarge, { flexDirection: 'row', alignItems: 'center' }]}>
                      <Ionicons name="location-outline" size={13} color="#0084FF" style={{ marginRight: 3 }} />
                      <Text style={styles.distanceBadgeTextLarge}>
                        {String(MOCK_MATCHES[swipeIndex].distance || '').replace(/^📍\s*/, '')}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.matchBioTextLarge}>
                    {MOCK_MATCHES[swipeIndex].bio}
                  </Text>

                  <Text style={styles.cardDetailSectionTitleLarge}>About Me & Habits</Text>
                  <View style={styles.cardExpandedGrid}>
                    {MOCK_MATCHES[swipeIndex].gender && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="person-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].gender}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].orientation && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="heart-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].orientation}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].lookingFor && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="compass-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].lookingFor}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].drinkHabit && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="wine-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].drinkHabit}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].smokeHabit && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="flame-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].smokeHabit}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].exercise && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="barbell-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].exercise}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].pets && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="paw-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].pets}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].educationLevel && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="school-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].educationLevel}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].height && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="resize-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].height}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].weight && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="scale-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].weight}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].job && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="briefcase-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].job}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].college && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="business-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].college}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].zodiac && (
                      <View style={styles.cardExpandedItem}>
                        <Ionicons name="moon-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].zodiac}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.cardDetailSectionTitleLarge, { marginTop: 16 }]}>Interests</Text>
                  <View style={styles.cardExpandedInterests}>
                    {MOCK_MATCHES[swipeIndex].interests.map((interest, idx) => (
                      <View key={idx} style={styles.cardExpandedInterestBadge}>
                        <Text style={styles.cardExpandedInterestText}>{interest}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Safety & Moderation Actions */}
                  <View style={{ marginTop: 24, paddingBottom: 30, gap: 10 }}>
                    <TouchableOpacity
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255, 59, 48, 0.15)',
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        const targetCandidate = MOCK_MATCHES[swipeIndex];
                        if (targetCandidate) {
                          handleReportUser(targetCandidate.id, targetCandidate.name);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#FF3B30', fontWeight: '600', fontSize: 15 }}>
                        ⚠️ Report Profile
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        const targetCandidate = MOCK_MATCHES[swipeIndex];
                        if (targetCandidate) {
                          handleBlockUser(targetCandidate.id, targetCandidate.name);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#aaa', fontWeight: '600', fontSize: 14 }}>
                        🔒 Block Profile
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </Modal>
        )}

        {/* Expanded Profile Details Modal for Likes Screen Candidate */}
        {!!selectedLikesProfile && (() => {
          const candidateId = (selectedLikesProfile.id || selectedLikesProfile._id || selectedLikesProfile.userId)?.toString();
          const isBlockedByTarget = Boolean(
            selectedLikesProfile.isBlockedByOther ||
            (candidateId && Array.isArray(blockedByOtherList) && blockedByOtherList.some(id => id?.toString() === candidateId))
          );
          if (isBlockedByTarget) return null;

          return (
            <Modal
              visible={!!selectedLikesProfile}
              animationType="slide"
              onRequestClose={() => setSelectedLikesProfile(null)}
            >
              <SafeAreaView style={[styles.candidateDetailsWrapper, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 15 : 0) }]}>
                <View style={styles.cardExpandedHeader}>
                  <TouchableOpacity
                    style={styles.cardDetailMinimizeHeaderBtn}
                    onPress={() => setSelectedLikesProfile(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cardDetailMinimizeArrow}>▼</Text>
                    <Text style={styles.cardDetailMinimizeLabel}>Minimize Profile</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.cardExpandedScrollBody} showsVerticalScrollIndicator={false}>
                  {/* Photo Preview Carousel Header (Above) */}
                  <View style={{ position: 'relative', width: '100%', height: 420 }}>
                    {(() => {
                      const photos = (() => {
                        const hiddenSet = new Set(Array.isArray(selectedLikesProfile.hiddenMedia) ? selectedLikesProfile.hiddenMedia : []);
                        const allList = [
                          selectedLikesProfile.profileImage || selectedLikesProfile.image,
                          ...(selectedLikesProfile.profileImages || []),
                          ...(selectedLikesProfile.photos || []),
                          ...(selectedLikesProfile.videos || []),
                          ...(selectedLikesProfile.media || []),
                        ].filter((item) => item && typeof item === 'string' && item.trim().length > 0 && item !== 'null' && item !== 'undefined' && !hiddenSet.has(item));
                        return Array.from(new Set(allList));
                      })();
                      const displayPhotos = photos.length > 0 ? photos : [selectedLikesProfile.profileImage || selectedLikesProfile.image].filter(Boolean);
                      const activePhoto = displayPhotos[likesActivePhotoIndex % displayPhotos.length];

                      return (
                        <View style={{ width: '100%', height: 420, position: 'relative' }}>
                          <TouchableOpacity
                            activeOpacity={0.9}
                            style={{ width: '100%', height: '100%' }}
                            onPress={() => setLikesPreviewStoryIndex(likesActivePhotoIndex)}
                          >
                            <Image
                              source={{ uri: getImageUrl(activePhoto) }}
                              style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                            />
                          </TouchableOpacity>
                          {displayPhotos.length > 1 && (
                            <View style={{ position: 'absolute', bottom: 15, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                              {displayPhotos.map((_, idx) => (
                                <TouchableOpacity
                                  key={idx}
                                  style={{
                                    width: idx === likesActivePhotoIndex ? 22 : 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: idx === likesActivePhotoIndex ? '#FF4458' : 'rgba(255,255,255,0.5)',
                                  }}
                                  onPress={() => setLikesActivePhotoIndex(idx)}
                                />
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>

                  {/* Profile Identity & Detailed Info Section (Below) */}
                  <View style={styles.cardExpandedContentPadding}>
                    <View style={styles.matchNameRow}>
                      <Text style={styles.matchNameTextLarge}>
                        {selectedLikesProfile.firstName || selectedLikesProfile.name}
                        {selectedLikesProfile.age ? `, ${selectedLikesProfile.age}` : ''}
                      </Text>
                      {!!(selectedLikesProfile && selectedLikesProfile.isEmailVerified) && (
                        <Ionicons name="checkmark-circle" size={20} color="#0084FF" style={{ marginLeft: 6, marginRight: 4 }} />
                      )}
                      {!!(selectedLikesProfile && onlineUsersMap[(selectedLikesProfile.id || selectedLikesProfile._id || selectedLikesProfile.userId)?.toString()]) && (
                        <View style={styles.swipeOnlineBadge}>
                          <View style={styles.swipeOnlineDot} />
                          <Text style={styles.swipeOnlineText}>Online</Text>
                        </View>
                      )}
                      {selectedLikesProfile.distance ? (
                        <View style={[styles.distanceBadgeLarge, { flexDirection: 'row', alignItems: 'center' }]}>
                          <Ionicons name="location-outline" size={13} color="#0084FF" style={{ marginRight: 3 }} />
                          <Text style={styles.distanceBadgeTextLarge}>
                            {selectedLikesProfile.distance}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {selectedLikesProfile.isLoadingFullProfile && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 8 }}>
                        <ActivityIndicator size="small" color="#FE3C72" />
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Loading profile details from server...</Text>
                      </View>
                    )}

                    {selectedLikesProfile.bio ? (
                      <Text style={styles.matchBioTextLarge}>
                        {selectedLikesProfile.bio}
                      </Text>
                    ) : null}

                    <Text style={styles.cardDetailSectionTitleLarge}>About Me & Habits</Text>
                    {(() => {
                      const hasHabits = Boolean(
                        selectedLikesProfile.gender ||
                        selectedLikesProfile.orientation ||
                        selectedLikesProfile.lookingFor ||
                        selectedLikesProfile.drinkHabit ||
                        selectedLikesProfile.smokeHabit ||
                        selectedLikesProfile.exercise ||
                        selectedLikesProfile.pets ||
                        selectedLikesProfile.educationLevel ||
                        selectedLikesProfile.height ||
                        selectedLikesProfile.weight ||
                        selectedLikesProfile.job ||
                        selectedLikesProfile.profession ||
                        selectedLikesProfile.college ||
                        selectedLikesProfile.zodiac
                      );

                      if (!hasHabits) {
                        return !selectedLikesProfile.isLoadingFullProfile ? (
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginVertical: 6, fontStyle: 'italic' }}>
                            No lifestyle habits added yet.
                          </Text>
                        ) : null;
                      }

                      return (
                        <View style={styles.cardExpandedGrid}>
                          {selectedLikesProfile.gender && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="person-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.gender}</Text>
                            </View>
                          )}
                          {selectedLikesProfile.orientation && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="heart-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.orientation}</Text>
                            </View>
                          )}
                          {selectedLikesProfile.lookingFor && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="compass-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.lookingFor}</Text>
                            </View>
                          )}
                          {selectedLikesProfile.drinkHabit && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="wine-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.drinkHabit}</Text>
                            </View>
                          )}
                          {selectedLikesProfile.smokeHabit && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="flame-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.smokeHabit}</Text>
                            </View>
                          )}
                          {selectedLikesProfile.exercise && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="barbell-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.exercise}</Text>
                            </View>
                          )}
                          {selectedLikesProfile.pets && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="paw-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.pets}</Text>
                            </View>
                          )}
                          {selectedLikesProfile.educationLevel && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="school-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.educationLevel}</Text>
                            </View>
                          )}
                          {selectedLikesProfile.height && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="resize-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.height}</Text>
                            </View>
                          )}
                          {selectedLikesProfile.weight && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="scale-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.weight}</Text>
                            </View>
                          )}
                          {(selectedLikesProfile.job || selectedLikesProfile.profession) && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="briefcase-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.job || selectedLikesProfile.profession}</Text>
                            </View>
                          )}
                          {selectedLikesProfile.college && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="business-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.college}</Text>
                            </View>
                          )}
                          {selectedLikesProfile.zodiac && (
                            <View style={styles.cardExpandedItem}>
                              <Ionicons name="moon-outline" size={15} color="#FE3C72" style={{ marginRight: 6 }} />
                              <Text style={styles.cardExpandedText}>{selectedLikesProfile.zodiac}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    {((selectedLikesProfile.interests && selectedLikesProfile.interests.length > 0) ||
                      (selectedLikesProfile.languages && selectedLikesProfile.languages.length > 0)) && (
                        <>
                          <Text style={[styles.cardDetailSectionTitleLarge, { marginTop: 16 }]}>Interests & Languages</Text>
                          <View style={styles.cardExpandedInterests}>
                            {(selectedLikesProfile.interests || []).map((interest, idx) => (
                              <View key={`int-${idx}`} style={styles.cardExpandedInterestBadge}>
                                <Text style={styles.cardExpandedInterestText}>{interest}</Text>
                              </View>
                            ))}
                            {(selectedLikesProfile.languages || []).map((lang, idx) => (
                              <View key={`lang-${idx}`} style={[styles.cardExpandedInterestBadge, { backgroundColor: '#262630', flexDirection: 'row', alignItems: 'center' }]}>
                                <Ionicons name="language-outline" size={12} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                                <Text style={styles.cardExpandedInterestText}>{lang}</Text>
                              </View>
                            ))}
                          </View>
                        </>
                      )}

                    {/* Safety & Moderation Actions */}
                    <View style={{ marginTop: 24, gap: 10, marginBottom: (selectedLikesProfile?.isFromChat || !!activeChat || activeTab === 'chat') ? 40 : 0 }}>
                      <TouchableOpacity
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          backgroundColor: 'rgba(255, 59, 48, 0.15)',
                          alignItems: 'center',
                        }}
                        onPress={() => {
                          const target = selectedLikesProfile;
                          if (!target) return;
                          const targetId = target.id || target._id || target.userId;
                          const targetName = target.firstName || target.name || 'User';
                          setSelectedLikesProfile(null);
                          if (targetId) {
                            handleReportUser(targetId, targetName);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#FF3B30', fontWeight: '600', fontSize: 15 }}>
                          ⚠️ Report Profile
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          paddingVertical: 12,
                          borderRadius: 12,
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          alignItems: 'center',
                        }}
                        onPress={() => {
                          const target = selectedLikesProfile;
                          if (!target) return;
                          const targetId = target.id || target._id || target.userId;
                          const targetName = target.firstName || target.name || 'User';
                          setSelectedLikesProfile(null);
                          if (targetId) {
                            handleBlockUser(targetId, targetName);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#aaa', fontWeight: '600', fontSize: 14 }}>
                          🔒 Block Profile
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Horizontal Pass & Like Action Option Buttons - Hidden when profile is expanded from Chat screen */}
                    {!(selectedLikesProfile?.isFromChat || !!activeChat || activeTab === 'chat') && (
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 30 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            height: 52,
                            borderRadius: 26,
                            backgroundColor: '#262630',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            borderWidth: 1,
                            borderColor: '#3A3A48',
                          }}
                          onPress={() => {
                            const target = selectedLikesProfile;
                            setSelectedLikesProfile(null);
                            handleRejectLike(target);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 18, color: '#FF4A4A' }}>✖</Text>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FF4A4A' }}>Pass</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            flex: 1,
                            height: 52,
                            borderRadius: 26,
                            backgroundColor: '#FF4458',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                          onPress={() => {
                            const target = selectedLikesProfile;
                            setSelectedLikesProfile(null);
                            handleLikeMatch(target);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 18, color: '#FFF' }}>♥</Text>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFF' }}>Like Back</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </ScrollView>
              </SafeAreaView>
            </Modal>
          );
        })()}

        {/* WhatsApp-Style Message Reaction Details Modal */}
        {reactionDetailsModalMsg && (
          <Modal
            visible={!!reactionDetailsModalMsg}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setReactionDetailsModalMsg(null)}
          >
            <TouchableOpacity
              style={styles.reactionModalOverlay}
              activeOpacity={1}
              onPress={() => setReactionDetailsModalMsg(null)}
            >
              <TouchableOpacity
                style={styles.reactionModalSheet}
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                {/* Drag Handle Indicator */}
                <View style={styles.reactionModalHandle} />

                {(() => {
                  const reactions = Array.isArray(reactionDetailsModalMsg.reactions) ? reactionDetailsModalMsg.reactions : [];
                  const uniqueEmojis = Array.from(new Set(reactions.map((r) => (typeof r === 'string' ? r : r?.emoji)).filter(Boolean)));
                  const filteredReactions = reactionModalActiveTab === 'all'
                    ? reactions
                    : reactions.filter((r) => (typeof r === 'string' ? r : r?.emoji) === reactionModalActiveTab);

                  return (
                    <>
                      {/* Top Tabs Row */}
                      <View style={styles.reactionModalTabsRow}>
                        <TouchableOpacity
                          style={[
                            styles.reactionModalTab,
                            reactionModalActiveTab === 'all' && styles.reactionModalTabActive
                          ]}
                          onPress={() => setReactionModalActiveTab('all')}
                        >
                          <Text
                            style={[
                              styles.reactionModalTabText,
                              reactionModalActiveTab === 'all' && styles.reactionModalTabTextActive
                            ]}
                          >
                            All {reactions.length}
                          </Text>
                        </TouchableOpacity>

                        {uniqueEmojis.map((em) => {
                          const count = reactions.filter((r) => (typeof r === 'string' ? r : r?.emoji) === em).length;
                          const isActive = reactionModalActiveTab === em;
                          return (
                            <TouchableOpacity
                              key={em}
                              style={[
                                styles.reactionModalTab,
                                isActive && styles.reactionModalTabActive
                              ]}
                              onPress={() => setReactionModalActiveTab(em)}
                            >
                              <Text style={styles.reactionModalTabEmoji}>{em}</Text>
                              <Text
                                style={[
                                  styles.reactionModalTabText,
                                  isActive && styles.reactionModalTabTextActive,
                                  { marginLeft: 4 }
                                ]}
                              >
                                {count}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Reactions User List */}
                      <ScrollView style={styles.reactionModalList} showsVerticalScrollIndicator={false}>
                        {filteredReactions.map((r, index) => {
                          const emoji = typeof r === 'string' ? r : r?.emoji;
                          const rUserId = typeof r === 'string' ? null : (r?.userId?.toString() || r?.userId);
                          const currentUserId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
                          const isCurrentUserReaction = Boolean((currentUserId && rUserId === currentUserId) || (!rUserId));

                          const partnerName = activeChat?.name || activeChat?.firstName || 'Match';
                          const partnerAvatar = activeChat?.profileImage || activeChat?.image || activeChat?.photos?.[0];

                          const displayName = isCurrentUserReaction ? 'You' : partnerName;
                          const displayAvatar = isCurrentUserReaction
                            ? (userProfile?.profileImage || userProfile?.photos?.[0] || currentUser?.profileImage)
                            : partnerAvatar;

                          return (
                            <TouchableOpacity
                              key={index}
                              style={styles.reactionModalUserRow}
                              activeOpacity={isCurrentUserReaction ? 0.7 : 1}
                              onPress={() => {
                                if (isCurrentUserReaction) {
                                  // Tab again to remove reacted emoji!
                                  handleEmojiReaction(emoji, reactionDetailsModalMsg, 'remove');
                                  setReactionDetailsModalMsg(null);
                                  if (Platform.OS === 'android') {
                                    ToastAndroid.show('Reaction removed', ToastAndroid.SHORT);
                                  }
                                }
                              }}
                            >
                              <View style={styles.reactionModalUserLeft}>
                                {displayAvatar ? (
                                  <Image source={{ uri: getImageUrl(displayAvatar) }} style={styles.reactionModalAvatar} />
                                ) : (
                                  <View style={styles.reactionModalAvatarPlaceholder}>
                                    <Text style={styles.reactionModalAvatarText}>
                                      {displayName?.[0]?.toUpperCase() || 'U'}
                                    </Text>
                                  </View>
                                )}
                                <View style={{ marginLeft: 12 }}>
                                  <Text style={styles.reactionModalUserName}>{displayName}</Text>
                                  {isCurrentUserReaction && (
                                    <Text style={styles.reactionModalRemoveHint}>Tap to remove</Text>
                                  )}
                                </View>
                              </View>

                              <Text style={styles.reactionModalUserEmoji}>{emoji}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </>
                  );
                })()}
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Full-Screen Story & Video Preview Modal for Likes Candidate */}
        {likesPreviewStoryIndex !== null && selectedLikesProfile && (
          <PreviewModal
            visible={likesPreviewStoryIndex !== null}
            photos={
              [
                selectedLikesProfile.profileImage || selectedLikesProfile.image,
                ...(selectedLikesProfile.profileImages || []),
                ...(selectedLikesProfile.photos || []),
                ...(selectedLikesProfile.videos || []),
                ...(selectedLikesProfile.media || []),
              ].filter((item, idx, arr) => {
                if (!item || typeof item !== 'string' || item === 'null' || item === 'undefined' || item.trim() === '') return false;
                const hiddenSet = new Set(Array.isArray(selectedLikesProfile.hiddenMedia) ? selectedLikesProfile.hiddenMedia : []);
                if (hiddenSet.has(item)) return false;
                return arr.indexOf(item) === idx;
              })
            }
            initialIndex={likesPreviewStoryIndex || 0}
            userName={selectedLikesProfile.firstName || selectedLikesProfile.name || 'Candidate'}
            userAvatar={selectedLikesProfile.profileImage || selectedLikesProfile.image}
            isOwnProfile={false}
            createdAt={selectedLikesProfile.createdAt}
            updatedAt={selectedLikesProfile.updatedAt || selectedLikesProfile.createdAt}
            mediaTimestamps={selectedLikesProfile.mediaTimestamps}
            onClose={() => setLikesPreviewStoryIndex(null)}
          />
        )}

        {/* Candidate Full Story / Video Status Preview Modal */}
        {candidateStoryIndex !== null && swipeIndex < MOCK_MATCHES.length && (
          <PreviewModal
            visible={candidateStoryIndex !== null}
            photos={
              [
                MOCK_MATCHES[swipeIndex]?.profileImage || MOCK_MATCHES[swipeIndex]?.image,
                ...(MOCK_MATCHES[swipeIndex]?.profileImages || []),
                ...(MOCK_MATCHES[swipeIndex]?.photos || []),
                ...(MOCK_MATCHES[swipeIndex]?.videos || []),
                ...(MOCK_MATCHES[swipeIndex]?.media || []),
              ].filter((item, idx, arr) => {
                if (!item || typeof item !== 'string' || item === 'null' || item === 'undefined' || item.trim() === '') return false;
                const hiddenSet = new Set(Array.isArray(MOCK_MATCHES[swipeIndex]?.hiddenMedia) ? MOCK_MATCHES[swipeIndex].hiddenMedia : []);
                if (hiddenSet.has(item)) return false;
                return arr.indexOf(item) === idx;
              })
            }
            initialIndex={candidateStoryIndex || 0}
            userName={MOCK_MATCHES[swipeIndex]?.name || MOCK_MATCHES[swipeIndex]?.firstName || 'Suggested Match'}
            userAvatar={MOCK_MATCHES[swipeIndex]?.profileImage || MOCK_MATCHES[swipeIndex]?.image}
            isOwnProfile={false}
            createdAt={MOCK_MATCHES[swipeIndex]?.createdAt}
            updatedAt={MOCK_MATCHES[swipeIndex]?.updatedAt || MOCK_MATCHES[swipeIndex]?.createdAt}
            mediaTimestamps={MOCK_MATCHES[swipeIndex]?.mediaTimestamps}
            onClose={() => setCandidateStoryIndex(null)}
          />
        )}

        {/* [VOICE CALLING HIDDEN AS REQUESTED]: Voice Call Overlay Modal commented out
        callState !== 'idle' && callSession && (
          <Modal
            visible={callState !== 'idle'}
            transparent={true}
            animationType="slide"
            onRequestClose={endVoiceCall}
          >
            <View style={styles.voiceCallOverlay}>
              <View style={styles.voiceCallContent}>
                <View style={styles.voiceCallAvatarContainer}>
                  {callSession.image ? (
                    <Image source={{ uri: getImageUrl(callSession.image) }} style={styles.voiceCallAvatar} />
                  ) : (
                    <View style={styles.voiceCallAvatarPlaceholder}>
                      <Text style={styles.voiceCallAvatarLetter}>
                        {callSession.name ? callSession.name[0].toUpperCase() : 'U'}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.voiceCallName}>{callSession.name}</Text>
                
                {callState === 'calling' && (
                  <Text style={styles.voiceCallStatus}>{callStatusText || 'Calling...'}</Text>
                )}
                {callState === 'incoming' && (
                  <Text style={styles.voiceCallStatus}>Incoming Voice Call...</Text>
                )}
                {callState === 'connected' && (
                  <Text style={styles.voiceCallDuration}>
                    {formatDuration(callDuration)}
                  </Text>
                )}

                <View style={styles.voiceCallControlsRow}>
                  {callState === 'incoming' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.voiceCallButton, styles.voiceCallDeclineButton]}
                        onPress={rejectVoiceCall}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.voiceCallButtonEmoji}>✕</Text>
                        <Text style={styles.voiceCallButtonText}>Decline</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.voiceCallButton, styles.voiceCallAcceptButton]}
                        onPress={acceptVoiceCall}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.voiceCallButtonEmoji}>📞</Text>
                        <Text style={styles.voiceCallButtonText}>Accept</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.voiceCallRoundButton, isCallMuted && styles.voiceCallRoundButtonActive]}
                        onPress={toggleCallMute}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.voiceCallRoundButtonEmoji}>
                          {isCallMuted ? '🎙️❌' : '🎙️'}
                        </Text>
                        <Text style={styles.voiceCallRoundButtonText}>
                          {isCallMuted ? 'Unmute' : 'Mute'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.voiceCallButton, styles.voiceCallEndButton]}
                        onPress={endVoiceCall}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.voiceCallButtonEmoji}>📞</Text>
                        <Text style={styles.voiceCallButtonText}>End Call</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.voiceCallRoundButton, isSpeakerOn && styles.voiceCallRoundButtonActive]}
                        onPress={toggleSpeaker}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.voiceCallRoundButtonEmoji}>
                          {isSpeakerOn ? '🔊' : '🔈'}
                        </Text>
                        <Text style={styles.voiceCallRoundButtonText}>
                          Speaker
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        )
        */}

        {/* Fullscreen Photo, Audio, Video & Document Preview Modal */}
        <Modal
          visible={viewMediaModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setIsAudioModalPaused(true);
            setImageZoomScale(1);
            setImageRotation(0);
            setViewMediaModal({ visible: false, type: 'image', url: '', fileName: '', fileSize: 0 });
          }}
        >
          <View style={styles.mediaViewerOverlay}>
            <SafeAreaView style={styles.mediaViewerSafeArea}>
              {/* Viewer Header */}
              <View style={styles.mediaViewerHeader}>
                <View style={styles.mediaViewerTitleContainer}>
                  <Text style={styles.mediaViewerTitle} numberOfLines={1}>
                    {viewMediaModal.fileName || (viewMediaModal.type === 'image' ? 'Photo Preview' : viewMediaModal.type === 'video' ? 'Video Player' : viewMediaModal.type === 'audio' ? 'Audio Player' : 'Document Preview')}
                  </Text>
                  {viewMediaModal.type === 'image' ? (
                    <Text style={styles.mediaViewerSubTitle}>
                      {Math.round(imageZoomScale * 100)}% • {imageRotation}°{viewMediaModal.fileSize > 0 ? ` • ${formatFileSize(viewMediaModal.fileSize)}` : ''}
                    </Text>
                  ) : viewMediaModal.type === 'audio' ? (
                    <Text style={styles.mediaViewerSubTitle}>
                      {formatPlayerSeconds(audioModalPosition)} / {formatPlayerSeconds(audioModalDuration || 0)} • {audioPlaybackRate}x{viewMediaModal.fileSize > 0 ? ` • ${formatFileSize(viewMediaModal.fileSize)}` : ''}
                    </Text>
                  ) : viewMediaModal.fileSize > 0 ? (
                    <Text style={styles.mediaViewerSubTitle}>
                      {formatFileSize(viewMediaModal.fileSize)}
                    </Text>
                  ) : null}
                </View>

                {/* Header Action: Quick rotate for image */}
                {viewMediaModal.type === 'image' && (
                  <TouchableOpacity
                    style={[styles.mediaViewerCloseButton, { marginRight: 8 }]}
                    onPress={() => setImageRotation((r) => (r + 90) % 360)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh" size={18} color="#00A884" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.mediaViewerCloseButton}
                  onPress={() => {
                    setIsAudioModalPaused(true);
                    setImageZoomScale(1);
                    setImageRotation(0);
                    setViewMediaModal({ visible: false, type: 'image', url: '', fileName: '', fileSize: 0 });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.mediaViewerCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Viewer Content Body */}
              <View style={styles.mediaViewerBody}>
                {viewMediaModal.type === 'image' ? (
                  <View style={styles.imageViewerContainer}>
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => {
                        setImageZoomScale((prev) => (prev > 1 ? 1 : 2));
                      }}
                      style={styles.imageViewerCanvas}
                    >
                      <Image
                        source={{ uri: viewMediaModal.url }}
                        style={[
                          styles.mediaViewerFullImage,
                          {
                            transform: [
                              { scale: imageZoomScale },
                              { rotate: `${imageRotation}deg` }
                            ]
                          }
                        ]}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>

                    {/* WhatsApp-style Image Controller Pill Toolbar */}
                    <View style={styles.imageViewerControlPill}>
                      {/* Zoom Out Button */}
                      <TouchableOpacity
                        style={[styles.imageViewerControlBtn, imageZoomScale <= 1 && styles.imageViewerControlBtnDisabled]}
                        disabled={imageZoomScale <= 1}
                        onPress={() => setImageZoomScale((s) => Math.max(1, +(s - 0.35).toFixed(2)))}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={20} color={imageZoomScale <= 1 ? '#536471' : '#FFFFFF'} />
                      </TouchableOpacity>

                      {/* Zoom Scale Badge (tap to reset scale) */}
                      <TouchableOpacity
                        style={styles.imageViewerScaleBadge}
                        onPress={() => {
                          setImageZoomScale(1);
                          setImageRotation(0);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.imageViewerScaleText}>
                          {Math.round(imageZoomScale * 100)}%
                        </Text>
                      </TouchableOpacity>

                      {/* Zoom In Button */}
                      <TouchableOpacity
                        style={[styles.imageViewerControlBtn, imageZoomScale >= 3.5 && styles.imageViewerControlBtnDisabled]}
                        disabled={imageZoomScale >= 3.5}
                        onPress={() => setImageZoomScale((s) => Math.min(3.5, +(s + 0.35).toFixed(2)))}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={20} color={imageZoomScale >= 3.5 ? '#536471' : '#FFFFFF'} />
                      </TouchableOpacity>

                      <View style={styles.imageViewerDivider} />

                      {/* 90° Rotate Clockwise Button */}
                      <TouchableOpacity
                        style={styles.imageViewerControlBtn}
                        onPress={() => setImageRotation((r) => (r + 90) % 360)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="reload" size={18} color="#00A884" />
                      </TouchableOpacity>

                      {/* Reset Fit View Button */}
                      <TouchableOpacity
                        style={styles.imageViewerControlBtn}
                        onPress={() => {
                          setImageZoomScale(1);
                          setImageRotation(0);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="scan-outline" size={18} color="#E9EDEF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : viewMediaModal.type === 'audio' ? (
                  <View style={styles.audioViewerContainer}>
                    {/* Invisible Video Component used as Audio Engine */}
                    <Video
                      ref={modalAudioPlayerRef}
                      source={{ uri: viewMediaModal.url }}
                      style={{ width: 0, height: 0, position: 'absolute' }}
                      paused={isAudioModalPaused}
                      rate={audioPlaybackRate}
                      muted={isAudioModalMuted}
                      onLoad={(meta) => {
                        if (meta && meta.duration) {
                          setAudioModalDuration(meta.duration);
                        }
                      }}
                      onProgress={(prog) => {
                        if (prog && typeof prog.currentTime === 'number') {
                          setAudioModalPosition(prog.currentTime);
                        }
                      }}
                      onEnd={() => {
                        setIsAudioModalPaused(true);
                        setAudioModalPosition(0);
                        modalAudioPlayerRef.current?.seek(0);
                      }}
                      onError={(err) => {
                        console.log('Audio Player Error:', err);
                      }}
                    />

                    {/* WhatsApp-Style Center Audio Visualizer Card */}
                    <View style={styles.audioViewerCard}>
                      <View style={styles.audioViewerVisualizerCircle}>
                        <View style={styles.audioViewerInnerCircle}>
                          <Ionicons
                            name={viewMediaModal.fileName?.toLowerCase().includes('voice') ? "mic" : "musical-notes"}
                            size={52}
                            color="#00A884"
                          />
                        </View>
                      </View>

                      <Text style={styles.audioViewerTitle} numberOfLines={1}>
                        {viewMediaModal.fileName || 'Audio Message'}
                      </Text>
                      <Text style={styles.audioViewerSubtitle}>
                        {viewMediaModal.fileSize > 0 ? `${formatFileSize(viewMediaModal.fileSize)} • ` : ''}
                        {isAudioModalPaused ? 'Paused' : 'Playing'}
                      </Text>

                      {/* Interactive Progress Scrubber */}
                      <TouchableOpacity
                        style={styles.audioViewerScrubberWrapper}
                        activeOpacity={0.9}
                        onLayout={(e) => {
                          audioScrubberWidthRef.current = e.nativeEvent.layout.width;
                        }}
                        onPress={(e) => {
                          const { locationX } = e.nativeEvent;
                          if (audioScrubberWidthRef.current > 0 && audioModalDuration > 0) {
                            const fraction = Math.max(0, Math.min(1, locationX / audioScrubberWidthRef.current));
                            const seekSec = fraction * audioModalDuration;
                            modalAudioPlayerRef.current?.seek(seekSec);
                            setAudioModalPosition(seekSec);
                          }
                        }}
                      >
                        <View style={styles.audioViewerTrackBar}>
                          <View
                            style={[
                              styles.audioViewerTrackFill,
                              {
                                width: `${audioModalDuration > 0 ? Math.min(100, Math.max(0, (audioModalPosition / audioModalDuration) * 100)) : 0}%`
                              }
                            ]}
                          />
                        </View>
                        <View
                          style={[
                            styles.audioViewerThumb,
                            {
                              left: `${audioModalDuration > 0 ? Math.min(96, Math.max(0, (audioModalPosition / audioModalDuration) * 96)) : 0}%`
                            }
                          ]}
                        />
                      </TouchableOpacity>

                      {/* Time Row */}
                      <View style={styles.audioViewerTimeRow}>
                        <Text style={styles.audioViewerTimeText}>
                          {formatPlayerSeconds(audioModalPosition)}
                        </Text>
                        <Text style={styles.audioViewerTimeText}>
                          {formatPlayerSeconds(audioModalDuration > 0 ? audioModalDuration : 0)}
                        </Text>
                      </View>

                      {/* Audio Controls Row: -5s, Play/Pause, +5s */}
                      <View style={styles.audioViewerControlsRow}>
                        <TouchableOpacity
                          style={styles.audioViewerSecBtn}
                          onPress={() => {
                            const newSec = Math.max(0, audioModalPosition - 5);
                            modalAudioPlayerRef.current?.seek(newSec);
                            setAudioModalPosition(newSec);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="play-back" size={22} color="#E9EDEF" />
                          <Text style={styles.audioViewerSecBtnText}>-5s</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.audioViewerPlayBtn}
                          onPress={() => setIsAudioModalPaused(!isAudioModalPaused)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={isAudioModalPaused ? "play" : "pause"}
                            size={34}
                            color="#FFFFFF"
                            style={isAudioModalPaused ? { marginLeft: 3 } : null}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.audioViewerSecBtn}
                          onPress={() => {
                            const newSec = Math.min(audioModalDuration || 9999, audioModalPosition + 5);
                            modalAudioPlayerRef.current?.seek(newSec);
                            setAudioModalPosition(newSec);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="play-forward" size={22} color="#E9EDEF" />
                          <Text style={styles.audioViewerSecBtnText}>+5s</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Speed, Restart, Mute Row */}
                      <View style={styles.audioViewerBottomRow}>
                        <TouchableOpacity
                          style={styles.audioViewerSpeedBtn}
                          onPress={() => {
                            setAudioPlaybackRate((prev) => (prev === 1.0 ? 1.5 : prev === 1.5 ? 2.0 : 1.0));
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.audioViewerSpeedText}>{audioPlaybackRate}x</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.audioViewerRestartBtn}
                          onPress={() => {
                            modalAudioPlayerRef.current?.seek(0);
                            setAudioModalPosition(0);
                            setIsAudioModalPaused(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="refresh" size={20} color="#8696A0" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.audioViewerMuteBtn}
                          onPress={() => setIsAudioModalMuted(!isAudioModalMuted)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isAudioModalMuted ? "volume-mute" : "volume-high"}
                            size={22}
                            color={isAudioModalMuted ? "#FF6B6B" : "#8696A0"}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : viewMediaModal.type === 'video' ? (
                  <View style={{ width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' }}>
                    <Video
                      source={{ uri: viewMediaModal.url }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                      controls={true}
                      paused={false}
                    />
                  </View>
                ) : (
                  <View style={styles.documentViewerCard}>
                    <View style={[styles.documentViewerIconCircle, getDocTypeStyle(viewMediaModal.fileName)]}>
                      <Text style={styles.documentViewerIconText}>
                        {getDocExtensionBadge(viewMediaModal.fileName)}
                      </Text>
                    </View>
                    <Text style={styles.documentViewerFileName}>
                      {viewMediaModal.fileName || 'document.pdf'}
                    </Text>
                    <Text style={styles.documentViewerFileMeta}>
                      {formatFileSize(viewMediaModal.fileSize)} • Ready for view / download
                    </Text>
                    <CustomButton
                      title="📥 OPEN DOCUMENT LINK"
                      variant="primary"
                      style={{ width: '85%', marginTop: 24 }}
                      onPress={() => {
                        if (viewMediaModal.url) {
                          Linking.openURL(viewMediaModal.url).catch(() =>
                            Alert.alert('Error', 'Unable to open document.')
                          );
                        }
                      }}
                    />
                  </View>
                )}
              </View>

              {/* Viewer Footer Actions */}
              <View style={styles.mediaViewerFooter}>
                <TouchableOpacity
                  style={styles.mediaViewerFooterButton}
                  onPress={() => {
                    if (viewMediaModal.url) {
                      Linking.openURL(viewMediaModal.url).catch(() =>
                        Alert.alert('Error', 'Unable to open link.')
                      );
                    }
                  }}
                >
                  <Text style={styles.mediaViewerFooterButtonText}>🌐 Open in Device Browser / External App</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </Modal>

        {/* Modal: Match Screen Overlay Popup */}
        {matchedUser && (
          <Modal
            visible={showMatchPopup}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowMatchPopup(false)}
          >
            <View style={styles.matchPopupOverlay}>
              <View style={styles.matchPopupCard}>
                <Text style={styles.matchPopupTitle}>It's a Match! 🎉</Text>
                <Text style={styles.matchPopupSubtitle}>
                  You and {matchedUser.name} liked each other.
                </Text>
                <View style={styles.matchPopupAvatarsRow}>
                  <View style={styles.matchPopupAvatarWrapper}>
                    {userProfile?.profileImage ? (
                      <Image source={{ uri: getImageUrl(userProfile?.profileImage) }} style={styles.matchPopupAvatar} />
                    ) : (
                      <View style={[styles.matchPopupAvatar, styles.matchPopupAvatarPlaceholder]}>
                        <Text style={styles.matchPopupLetter}>{userProfile?.firstName ? userProfile.firstName[0].toUpperCase() : 'U'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.matchPopupConnector}>🔥</Text>
                  <Image source={{ uri: getImageUrl(matchedUser.image) }} style={styles.matchPopupAvatar} />
                </View>
                <CustomButton
                  title={`SEND MESSAGE TO ${matchedUser.name.toUpperCase()}`}
                  variant="primary"
                  style={{ marginBottom: 12 }}
                  onPress={() => handleCreateNewChat(matchedUser)}
                />
                <CustomButton
                  title="KEEP SWIPING"
                  variant="outline"
                  onPress={() => setShowMatchPopup(false)}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Authentic WhatsApp Dark Mode Top-Right Header Overflow Menu Modal */}
        {showChatOptionsMenuModal && activeChat && (
          <Modal
            visible={showChatOptionsMenuModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowChatOptionsMenuModal(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                justifyContent: 'flex-start',
                alignItems: 'flex-end',
                paddingTop: Platform.OS === 'ios' ? (safeTopPadding + 50) : (safeTopPadding + 40),
                paddingRight: 12,
              }}
              activeOpacity={1}
              onPress={() => setShowChatOptionsMenuModal(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{
                  width: 220,
                  backgroundColor: '#232D36',
                  borderRadius: 14,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  elevation: 15,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.5,
                  shadowRadius: 10,
                }}
              >
                {(() => {
                  const partnerId = (activeChat?.id || activeChat?._id || activeChat?.userId || activeChat?.senderId || activeChat?.sender)?.toString();
                  const isBlockedByOther = Boolean(
                    activeChat?.isBlockedByOther ||
                    activeChat?.name === 'Matched User' ||
                    (partnerId && Array.isArray(blockedByOtherList) && blockedByOtherList.some((id) => id?.toString() === partnerId)) ||
                    (partnerId && Array.isArray(chats) && chats.some((c) => (c.id || c._id || c.userId)?.toString() === partnerId && c.isBlockedByOther)) ||
                    (partnerId && Array.isArray(matches) && matches.some((m) => (m.id || m._id || m.userId)?.toString() === partnerId && m.isBlockedByOther))
                  );

                  return (
                    <TouchableOpacity
                      style={[styles.waContextMenuItem, isBlockedByOther && { opacity: 0.4 }]}
                      disabled={isBlockedByOther}
                      onPress={() => {
                        setShowChatOptionsMenuModal(false);
                        if (isBlockedByOther) {
                          if (Platform.OS === 'android') {
                            ToastAndroid.show('This profile is unavailable.', ToastAndroid.SHORT);
                          } else {
                            Alert.alert('Unavailable', 'This profile is currently unavailable.');
                          }
                          return;
                        }
                        handleViewPartnerProfile();
                      }}
                    >
                      <Ionicons name="person-outline" size={19} color={isBlockedByOther ? '#556066' : '#AEBAC1'} style={{ marginRight: 14 }} />
                      <Text style={[styles.waContextMenuText, isBlockedByOther && { color: '#687782' }]}>View profile</Text>
                    </TouchableOpacity>
                  );
                })()}

                <TouchableOpacity
                  style={styles.waContextMenuItem}
                  onPress={() => {
                    setShowChatOptionsMenuModal(false);
                    setMediaDocsTab('media');
                    setShowMediaDocsModal(true);
                  }}
                >
                  <Ionicons name="images-outline" size={19} color="#AEBAC1" style={{ marginRight: 14 }} />
                  <Text style={styles.waContextMenuText}>Media, links, and docs</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.waContextMenuItem}
                  onPress={() => {
                    setShowChatOptionsMenuModal(false);
                    setShowStarredModal(true);
                  }}
                >
                  <Ionicons name="star-outline" size={19} color="#FFD700" style={{ marginRight: 14 }} />
                  <Text style={styles.waContextMenuText}>Starred messages</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.waContextMenuItem}
                  onPress={() => {
                    setShowChatOptionsMenuModal(false);
                    setIsSearchInChatActive(true);
                    setChatSearchQuery('');
                    setChatSearchMatchIndex(0);
                  }}
                >
                  <Ionicons name="search-outline" size={19} color="#AEBAC1" style={{ marginRight: 14 }} />
                  <Text style={styles.waContextMenuText}>Search</Text>
                </TouchableOpacity>


                <TouchableOpacity
                  style={styles.waContextMenuItem}
                  onPress={() => {
                    setShowChatOptionsMenuModal(false);
                    requestAnimationFrame(() => handleClearChat());
                  }}
                >
                  <Ionicons name="trash-outline" size={19} color="#AEBAC1" style={{ marginRight: 14 }} />
                  <Text style={styles.waContextMenuText}>Clear chat</Text>
                </TouchableOpacity>

                <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', marginVertical: 4 }} />

                <TouchableOpacity
                  style={styles.waContextMenuItem}
                  onPress={() => {
                    setShowChatOptionsMenuModal(false);
                    requestAnimationFrame(() => handleUnmatch(activeChat.id, activeChat.name));
                  }}
                >
                  <Ionicons name="ban-outline" size={19} color="#F15C6D" style={{ marginRight: 14 }} />
                  <Text style={[styles.waContextMenuText, { color: '#F15C6D' }]}>Unmatch user</Text>
                </TouchableOpacity>

                {(() => {
                  const targetActiveId = (activeChat?.id || activeChat?._id || activeChat?.userId)?.toString();
                  const isBlocked = Boolean(
                    activeChat?.isBlocked ||
                    (Array.isArray(blockedUsersList) && blockedUsersList.some((b) => (b.id || b._id || b.userId)?.toString() === targetActiveId))
                  );

                  return (
                    <TouchableOpacity
                      style={styles.waContextMenuItem}
                      onPress={() => {
                        setShowChatOptionsMenuModal(false);
                        if (isBlocked) {
                          requestAnimationFrame(() => handleUnblockUser(activeChat.id, activeChat.name));
                        } else {
                          requestAnimationFrame(() => handleBlockUser(activeChat.id, activeChat.name));
                        }
                      }}
                    >
                      <Ionicons
                        name={isBlocked ? "lock-open-outline" : "lock-closed-outline"}
                        size={19}
                        color={isBlocked ? "#00A884" : "#F15C6D"}
                        style={{ marginRight: 14 }}
                      />
                      <Text style={[styles.waContextMenuText, { color: isBlocked ? "#00A884" : "#F15C6D" }]}>
                        {isBlocked ? 'Unblock user' : 'Block user'}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}

                <TouchableOpacity
                  style={styles.waContextMenuItem}
                  onPress={() => {
                    setShowChatOptionsMenuModal(false);
                    openReportForm(activeChat.id, activeChat.name);
                  }}
                >
                  <Ionicons name="alert-circle-outline" size={19} color="#F15C6D" style={{ marginRight: 14 }} />
                  <Text style={[styles.waContextMenuText, { color: '#F15C6D' }]}>Report user</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {/* WhatsApp Dark Mode Starred Messages Modal */}
        {showStarredModal && activeChat && (
          <Modal
            visible={showStarredModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowStarredModal(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
              <View style={{
                maxHeight: '80%',
                backgroundColor: '#1F2C34',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 24,
              }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="star" size={22} color="#FFD700" style={{ marginRight: 10 }} />
                    <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>Starred Messages</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowStarredModal(false)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={22} color="#8696A0" />
                  </TouchableOpacity>
                </View>

                {/* Message List */}
                {(() => {
                  const starredMsgs = (activeChat.messages || []).filter((m) => isMessageStarredByMe(m));
                  if (starredMsgs.length === 0) {
                    return (
                      <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="star-outline" size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 12 }} />
                        <Text style={{ color: '#8696A0', fontSize: 15, textAlign: 'center', paddingHorizontal: 20 }}>
                          No starred messages yet.
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 30 }}>
                          Long press any message in the chat and tap Star to bookmark it here.
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <ScrollView style={{ maxHeight: 420 }}>
                      {starredMsgs.map((sMsg) => {
                        const isMe = sMsg.sender === 'you';
                        return (
                          <View
                            key={sMsg.id}
                            style={{
                              backgroundColor: isMe ? '#005C4B' : '#202C33',
                              borderRadius: 10,
                              padding: 12,
                              marginBottom: 10,
                              borderLeftWidth: 3,
                              borderLeftColor: '#FFD700',
                            }}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <Text style={{ color: '#00A884', fontSize: 12, fontWeight: '700' }}>
                                {isMe ? 'You' : (activeChat.name || 'Contact')}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="star" size={12} color="#FFD700" style={{ marginRight: 8 }} />
                                <TouchableOpacity
                                  onPress={() => handleToggleStarAction(sMsg)}
                                  style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 4 }}
                                >
                                  <Text style={{ color: '#E9EDEF', fontSize: 11, fontWeight: '600' }}>Unstar</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                            <Text style={{ color: '#E9EDEF', fontSize: 14, marginVertical: 4 }}>
                              {sMsg.text || (sMsg.mediaUrl ? (sMsg.messageType === 'image' ? '📷 Photo' : sMsg.messageType === 'voice' ? '🎤 Voice message' : '📄 Document') : 'Media')}
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, textAlign: 'right', marginTop: 2 }}>
                              {sMsg.createdAt ? new Date(sMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  );
                })()}
              </View>
            </View>
          </Modal>
        )}

        {/* WhatsApp Dark Mode Media, Links & Docs Modal */}
        {showMediaDocsModal && activeChat && (
          <Modal
            visible={showMediaDocsModal}
            transparent={false}
            animationType="slide"
            onRequestClose={() => setShowMediaDocsModal(false)}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: '#0B141A' }}>
              {/* WhatsApp Header */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#1F2C34',
                paddingHorizontal: 12,
                paddingVertical: 14,
                elevation: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3,
              }}>
                <TouchableOpacity
                  onPress={() => setShowMediaDocsModal(false)}
                  style={{ padding: 6, marginRight: 12, borderRadius: 20 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="arrow-back" size={24} color="#E9EDEF" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#E9EDEF', fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
                    {activeChat.name || activeChat.firstName || 'Chat'}
                  </Text>
                  <Text style={{ color: '#8696A0', fontSize: 13, marginTop: 1 }}>
                    Media, links and docs
                  </Text>
                </View>
              </View>

              {(() => {
                const allChatMsgs = (activeChat?.messages || []).filter(
                  (m) => !m.isDeletedForEveryone && m.text !== 'This message was deleted'
                );

                // Media items (Photos & Videos)
                const mediaList = allChatMsgs.filter((m) => {
                  const isVid = m.messageType === 'video' ||
                    (m.mediaUrl && typeof m.mediaUrl === 'string' && (m.mediaUrl.includes('/video/upload/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(m.mediaUrl)));
                  const isImg = m.messageType === 'image' ||
                    m.type === 'image' ||
                    m.text === '📷 Photo' ||
                    (m.fileName && typeof m.fileName === 'string' && /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(m.fileName)) ||
                    (m.mediaUrl && typeof m.mediaUrl === 'string' && (
                      m.mediaUrl.startsWith('data:image') ||
                      /\.(jpg|jpeg|png|webp|gif|bmp|heic)($|\?)/i.test(m.mediaUrl) ||
                      m.mediaUrl.includes('/image/upload/') ||
                      (!isVid && (m.mediaUrl.includes('/chat/media/') || m.mediaUrl.includes('/uploads/')) && (!m.fileName || /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(m.fileName)))
                    ));
                  return isImg || isVid;
                });

                // Document items
                const docsList = allChatMsgs.filter((m) => {
                  if (m.messageType === 'document') return true;
                  const fName = (m.fileName || '').toLowerCase();
                  const mUrl = (m.mediaUrl || '').toLowerCase();
                  return /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|tar|7z|epub)$/i.test(fName) ||
                    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|tar|7z|epub)($|\?)/i.test(mUrl);
                });

                // Links items
                const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
                const linksList = [];
                allChatMsgs.forEach((m) => {
                  if (m.text && typeof m.text === 'string') {
                    const matches = m.text.match(urlRegex);
                    if (matches && matches.length > 0) {
                      matches.forEach((extractedUrl) => {
                        let fullUrl = extractedUrl;
                        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
                          fullUrl = `https://${fullUrl}`;
                        }
                        linksList.push({
                          msg: m,
                          url: fullUrl,
                          rawUrl: extractedUrl,
                        });
                      });
                    }
                  }
                });

                return (
                  <View style={{ flex: 1 }}>
                    {/* Top Tab Bar */}
                    <View style={{
                      flexDirection: 'row',
                      backgroundColor: '#1F2C34',
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255,255,255,0.08)',
                    }}>
                      <TouchableOpacity
                        onPress={() => setMediaDocsTab('media')}
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          alignItems: 'center',
                          borderBottomWidth: 3,
                          borderBottomColor: mediaDocsTab === 'media' ? '#00A884' : 'transparent',
                        }}
                      >
                        <Text style={{
                          color: mediaDocsTab === 'media' ? '#00A884' : '#8696A0',
                          fontSize: 13,
                          fontWeight: '700',
                          letterSpacing: 0.5,
                        }}>
                          MEDIA ({mediaList.length})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setMediaDocsTab('docs')}
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          alignItems: 'center',
                          borderBottomWidth: 3,
                          borderBottomColor: mediaDocsTab === 'docs' ? '#00A884' : 'transparent',
                        }}
                      >
                        <Text style={{
                          color: mediaDocsTab === 'docs' ? '#00A884' : '#8696A0',
                          fontSize: 13,
                          fontWeight: '700',
                          letterSpacing: 0.5,
                        }}>
                          DOCS ({docsList.length})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setMediaDocsTab('links')}
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          alignItems: 'center',
                          borderBottomWidth: 3,
                          borderBottomColor: mediaDocsTab === 'links' ? '#00A884' : 'transparent',
                        }}
                      >
                        <Text style={{
                          color: mediaDocsTab === 'links' ? '#00A884' : '#8696A0',
                          fontSize: 13,
                          fontWeight: '700',
                          letterSpacing: 0.5,
                        }}>
                          LINKS ({linksList.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Tab 1: MEDIA (Grid View) */}
                    {mediaDocsTab === 'media' && (
                      mediaList.length === 0 ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                          <Ionicons name="images-outline" size={60} color="#3B4A54" style={{ marginBottom: 14 }} />
                          <Text style={{ color: '#E9EDEF', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                            No media found
                          </Text>
                          <Text style={{ color: '#8696A0', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
                            Photos and videos shared in this chat will appear here.
                          </Text>
                        </View>
                      ) : (
                        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 2 }}>
                          {mediaList.map((item, idx) => {
                            const isVid = item.messageType === 'video' || (item.mediaUrl && /\.(mp4|mov|avi)$/i.test(item.mediaUrl));
                            const mediaUri = getImageUrl(item.mediaUrl || item.text);
                            return (
                              <TouchableOpacity
                                key={String(item.id || item._id || idx)}
                                style={{
                                  width: '32.6%',
                                  aspectRatio: 1,
                                  margin: '0.36%',
                                  backgroundColor: '#1F2C34',
                                  position: 'relative',
                                  borderRadius: 4,
                                  overflow: 'hidden',
                                }}
                                activeOpacity={0.82}
                                onPress={() => {
                                  setImageZoomScale(1);
                                  setImageRotation(0);
                                  setViewMediaModal({
                                    visible: true,
                                    type: isVid ? 'video' : 'image',
                                    url: mediaUri,
                                    fileName: item.fileName || (isVid ? 'Video' : 'Photo'),
                                    fileSize: item.fileSize || 0,
                                  });
                                }}
                              >
                                <Image
                                  source={{ uri: mediaUri }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="cover"
                                />
                                {isVid && (
                                  <View style={{
                                    position: 'absolute',
                                    bottom: 6,
                                    left: 6,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(11, 20, 26, 0.75)',
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 10,
                                  }}>
                                    <Ionicons name="videocam" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>Video</Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )
                    )}

                    {/* Tab 2: DOCS (List View) */}
                    {mediaDocsTab === 'docs' && (
                      docsList.length === 0 ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                          <Ionicons name="document-text-outline" size={60} color="#3B4A54" style={{ marginBottom: 14 }} />
                          <Text style={{ color: '#E9EDEF', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                            No documents found
                          </Text>
                          <Text style={{ color: '#8696A0', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
                            Documents and files shared in this chat will appear here.
                          </Text>
                        </View>
                      ) : (
                        <ScrollView contentContainerStyle={{ padding: 12 }}>
                          {docsList.map((item, idx) => {
                            const ext = (item.fileName || '').split('.').pop()?.toUpperCase() || 'DOC';
                            const fileUri = getImageUrl(item.mediaUrl);
                            const iconColor = ext === 'PDF' ? '#E53935' : (ext === 'DOC' || ext === 'DOCX') ? '#1E88E5' : (ext === 'XLS' || ext === 'XLSX') ? '#43A047' : '#FB8C00';
                            return (
                              <TouchableOpacity
                                key={String(item.id || item._id || idx)}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  backgroundColor: '#1F2C34',
                                  padding: 12,
                                  borderRadius: 10,
                                  marginBottom: 8,
                                }}
                                activeOpacity={0.75}
                                onPress={() => {
                                  if (fileUri) {
                                    Linking.openURL(fileUri).catch(() => {
                                      setViewMediaModal({
                                        visible: true,
                                        type: 'document',
                                        url: fileUri,
                                        fileName: item.fileName || 'Document',
                                        fileSize: item.fileSize || 0,
                                      });
                                    });
                                  }
                                }}
                              >
                                <View style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 8,
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginRight: 12,
                                  borderLeftWidth: 3,
                                  borderLeftColor: iconColor,
                                }}>
                                  <Ionicons name="document-text" size={22} color={iconColor} />
                                  <Text style={{ color: iconColor, fontSize: 8, fontWeight: '700', marginTop: -2 }}>
                                    {ext}
                                  </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: '#E9EDEF', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                                    {item.fileName || item.text || 'Document'}
                                  </Text>
                                  <Text style={{ color: '#8696A0', fontSize: 12, marginTop: 2 }}>
                                    {item.fileSize ? formatFileSize(item.fileSize) : 'Document'} • {item.createdAt ? new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                                  </Text>
                                </View>
                                <Ionicons name="download-outline" size={20} color="#00A884" style={{ marginLeft: 8 }} />
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )
                    )}

                    {/* Tab 3: LINKS (List View) */}
                    {mediaDocsTab === 'links' && (
                      linksList.length === 0 ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                          <Ionicons name="link-outline" size={60} color="#3B4A54" style={{ marginBottom: 14 }} />
                          <Text style={{ color: '#E9EDEF', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                            No links found
                          </Text>
                          <Text style={{ color: '#8696A0', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
                            Web links and URLs shared in this chat will appear here.
                          </Text>
                        </View>
                      ) : (
                        <ScrollView contentContainerStyle={{ padding: 12 }}>
                          {linksList.map((linkItem, idx) => {
                            let domain = '';
                            try {
                              const parts = linkItem.url.split('/');
                              domain = (parts[2] || linkItem.rawUrl).replace('www.', '');
                            } catch {
                              domain = linkItem.rawUrl;
                            }
                            return (
                              <TouchableOpacity
                                key={`${linkItem.msg.id || idx}_${idx}`}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  backgroundColor: '#1F2C34',
                                  padding: 12,
                                  borderRadius: 10,
                                  marginBottom: 8,
                                }}
                                activeOpacity={0.75}
                                onPress={() => {
                                  Linking.openURL(linkItem.url).catch(() => {
                                    Alert.alert('Unable to open link', linkItem.url);
                                  });
                                }}
                              >
                                <View style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 22,
                                  backgroundColor: '#2A3942',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginRight: 12,
                                }}>
                                  <Ionicons name="link" size={20} color="#00A884" />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: '#53BDEB', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                                    {domain}
                                  </Text>
                                  <Text style={{ color: '#8696A0', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                                    {linkItem.url}
                                  </Text>
                                  {Boolean(linkItem.msg.text && linkItem.msg.text !== linkItem.rawUrl) && (
                                    <Text style={{ color: '#E9EDEF', fontSize: 12, marginTop: 4, fontStyle: 'italic' }} numberOfLines={1}>
                                      "{linkItem.msg.text.trim()}"
                                    </Text>
                                  )}
                                  <Text style={{ color: '#687782', fontSize: 11, marginTop: 3 }}>
                                    {linkItem.msg.createdAt ? new Date(linkItem.msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                                  </Text>
                                </View>
                                <Ionicons name="open-outline" size={18} color="#8696A0" style={{ marginLeft: 8 }} />
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )
                    )}
                  </View>
                );
              })()}
            </SafeAreaView>
          </Modal>
        )}

        {/* Conversations Tab Top-Right 3-Dots Menu Modal */}
        {showConversationsMenuModal && (
          <Modal
            visible={showConversationsMenuModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowConversationsMenuModal(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                justifyContent: 'flex-start',
                alignItems: 'flex-end',
                paddingTop: Platform.OS === 'ios' ? (safeTopPadding + 50) : (safeTopPadding + 40),
                paddingRight: 16,
              }}
              activeOpacity={1}
              onPress={() => setShowConversationsMenuModal(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{
                  width: 195,
                  backgroundColor: '#232D36',
                  borderRadius: 14,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  elevation: 15,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.5,
                  shadowRadius: 10,
                }}
              >
                <TouchableOpacity
                  style={styles.waContextMenuItem}
                  onPress={() => {
                    setShowConversationsMenuModal(false);
                    setIsConversationSearchActive(true);
                    setConversationSearchQuery('');
                  }}
                >
                  <Ionicons name="search-outline" size={19} color="#AEBAC1" style={{ marginRight: 14 }} />
                  <Text style={styles.waContextMenuText}>Search</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.waContextMenuItem}
                  onPress={() => {
                    setShowConversationsMenuModal(false);
                    setShowAllStarredModal(true);
                  }}
                >
                  <Ionicons name="star-outline" size={19} color="#FFD700" style={{ marginRight: 14 }} />
                  <Text style={styles.waContextMenuText}>Starred</Text>
                </TouchableOpacity>

                {chats.length > 0 && (
                  <TouchableOpacity
                    style={styles.waContextMenuItem}
                    onPress={() => {
                      setShowConversationsMenuModal(false);
                      // Start selection mode with the first chat
                      const firstId = (chats[0]?.id || chats[0]?._id || chats[0]?.userId)?.toString();
                      if (firstId) setSelectedChatIds([firstId]);
                    }}
                  >
                    <Ionicons name="checkbox-outline" size={19} color="#00A884" style={{ marginRight: 14 }} />
                    <Text style={styles.waContextMenuText}>Select chats</Text>
                  </TouchableOpacity>
                )}

                {chats.length > 0 && (
                  <TouchableOpacity
                    style={[styles.waContextMenuItem, { borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)', marginTop: 2, paddingTop: 10 }]}
                    onPress={() => {
                      setShowConversationsMenuModal(false);
                      handleClearAllConversations();
                    }}
                  >
                    <Ionicons name="trash-outline" size={19} color="#FF4D4D" style={{ marginRight: 14 }} />
                    <Text style={[styles.waContextMenuText, { color: '#FF4D4D' }]}>Delete all chats</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Global All Starred Messages Modal (Across All Conversations) */}
        {showAllStarredModal && (
          <Modal
            visible={showAllStarredModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowAllStarredModal(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
              <View style={{
                maxHeight: '85%',
                backgroundColor: '#1F2C34',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 24,
              }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="star" size={22} color="#FFD700" style={{ marginRight: 10 }} />
                    <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>All Starred Messages</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowAllStarredModal(false)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={22} color="#8696A0" />
                  </TouchableOpacity>
                </View>

                {/* Starred Messages List across all chats */}
                {(() => {
                  const allStarredMsgs = [];
                  (chats || []).forEach((c) => {
                    if (Array.isArray(c.messages)) {
                      c.messages.forEach((m) => {
                        if (m && isMessageStarredByMe(m) && !m.isDeletedForEveryone) {
                          allStarredMsgs.push({
                            ...m,
                            chatPartnerName: c.name || c.firstName || 'Contact',
                            chatPartnerImage: c.image || c.profileImage,
                            chatObject: c,
                          });
                        }
                      });
                    }
                  });

                  if (allStarredMsgs.length === 0) {
                    return (
                      <View style={{ paddingVertical: 45, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="star-outline" size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 12 }} />
                        <Text style={{ color: '#8696A0', fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
                          No starred messages found
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 30 }}>
                          Long press any message in a chat and tap Star to bookmark it here.
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                      {allStarredMsgs.map((item) => {
                        const isMe = item.sender === 'you';
                        return (
                          <TouchableOpacity
                            key={`${item.chatObject.id || item.chatObject._id}_${item.id || item._id}`}
                            activeOpacity={0.8}
                            onPress={() => {
                              setShowAllStarredModal(false);
                              const starredPartnerId = (item.chatObject.id || item.chatObject._id || item.chatObject.userId)?.toString();
                              const sanitizedStarredChat = {
                                ...item.chatObject,
                                messages: (item.chatObject.messages || []).filter((m) => m.id === 'match-init' || doesMessageBelongToPartner(m, starredPartnerId)),
                              };
                              dispatch(setMessages([]));
                              dispatch(setActiveChatUser(sanitizedStarredChat));
                              setActiveChat(sanitizedStarredChat);
                              const targetMsgId = (item.id || item._id)?.toString();
                              if (targetMsgId) {
                                setTimeout(() => {
                                  if (messageYPositionsRef.current[targetMsgId] !== undefined && chatScrollViewRef.current) {
                                    chatScrollViewRef.current.scrollTo({
                                      y: Math.max(0, messageYPositionsRef.current[targetMsgId] - 70),
                                      animated: true,
                                    });
                                    setHighlightedMessageId(targetMsgId);
                                    setTimeout(() => setHighlightedMessageId(null), 1500);
                                  }
                                }, 400);
                              }
                            }}
                            style={{
                              backgroundColor: '#202C33',
                              borderRadius: 12,
                              padding: 12,
                              marginBottom: 10,
                              borderLeftWidth: 3,
                              borderLeftColor: '#FFD700',
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                              <Image source={{ uri: getImageUrl(item.chatPartnerImage) }} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }} />
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                                  {item.chatPartnerName}
                                </Text>
                                <Text style={{ color: '#00A884', fontSize: 11, fontWeight: '600' }}>
                                  {isMe ? 'You' : item.chatPartnerName}
                                </Text>
                              </View>
                              <Ionicons name="star" size={14} color="#FFD700" />
                            </View>

                            <Text style={{ color: '#E9EDEF', fontSize: 14, marginVertical: 2 }}>
                              {item.text || (item.mediaUrl ? (item.messageType === 'image' ? '📷 Photo' : item.messageType === 'voice' ? '🎤 Voice message' : '📄 Document') : 'Media')}
                            </Text>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                              <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '600' }}>Tap to view message ➔</Text>
                              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                                {item.createdAt ? formatMessageTime(item.createdAt) : ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  );
                })()}
              </View>
            </View>
          </Modal>
        )}

        {/* Full Screen Report Form Page */}
        {showReportModal && reportTargetUser && (
          <Modal
            visible={showReportModal}
            transparent={false}
            animationType="slide"
            onRequestClose={() => setShowReportModal(false)}
          >
            <View style={{ flex: 1, backgroundColor: '#121212', paddingTop: Platform.OS === 'ios' ? 40 : 25 }}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
              >
                {/* Header */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                }}>
                  <TouchableOpacity
                    style={{ padding: 6 }}
                    onPress={() => setShowReportModal(false)}
                  >
                    <Text style={{ color: '#FE3C72', fontSize: 24, fontWeight: 'bold' }}>←</Text>
                  </TouchableOpacity>
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>Report Profile</Text>
                  <View style={{ width: 30 }} />
                </View>

                <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                  {/* Reported User Info Banner */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 14,
                    padding: 14,
                    marginTop: 16,
                    marginBottom: 20,
                  }}>
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: '#FE3C72',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 14,
                    }}>
                      <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>
                        {reportTargetUser && reportTargetUser.name && typeof reportTargetUser.name === 'string' && reportTargetUser.name.length > 0
                          ? reportTargetUser.name[0].toUpperCase()
                          : 'U'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                        Reporting {reportTargetUser?.name || 'User'}
                      </Text>
                      <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 12, marginTop: 2 }}>
                        Your report is confidential. Admin team will review this.
                      </Text>
                    </View>
                  </View>

                  {/* Section 1: Reasons */}
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 10 }}>
                    Why are you reporting this user?
                  </Text>

                  {REPORT_REASONS.map((reason) => {
                    const isSelected = selectedReportReason === reason;
                    return (
                      <TouchableOpacity
                        key={reason}
                        style={{
                          paddingVertical: 14,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          backgroundColor: isSelected ? '#FE3C72' : 'rgba(255, 255, 255, 0.07)',
                          marginBottom: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderWidth: 1,
                          borderColor: isSelected ? '#FE3C72' : 'rgba(255, 255, 255, 0.1)',
                        }}
                        onPress={() => setSelectedReportReason(reason)}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: isSelected ? '700' : '400' }}>
                          {reason}
                        </Text>
                        <View style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: isSelected ? '#FFF' : 'rgba(255, 255, 255, 0.4)',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF' }} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Section 2: Text input for details */}
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 15, marginBottom: 8 }}>
                    Additional Details / Comments (Optional)
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.07)',
                      borderRadius: 12,
                      padding: 14,
                      color: '#FFF',
                      fontSize: 14,
                      minHeight: 90,
                      textAlignVertical: 'top',
                      marginBottom: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                    }}
                    placeholder="Describe what happened or provide details for the admin team..."
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    multiline={true}
                    numberOfLines={4}
                    value={reportDetails}
                    onChangeText={setReportDetails}
                  />

                  {/* Section 3: Also block toggle */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      padding: 14,
                      borderRadius: 12,
                      marginBottom: 25,
                    }}
                    onPress={() => setAlsoBlockOnReport(!alsoBlockOnReport)}
                    activeOpacity={0.8}
                  >
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: alsoBlockOnReport ? '#FE3C72' : 'rgba(255,255,255,0.4)',
                      backgroundColor: alsoBlockOnReport ? '#FE3C72' : 'transparent',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}>
                      {alsoBlockOnReport && <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
                        Also block {reportTargetUser.name}
                      </Text>
                      <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12, marginTop: 2 }}>
                        Prevents future matching and messaging immediately.
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Submit Button */}
                  <CustomButton
                    title={isSubmittingReport ? "SUBMITTING..." : "SUBMIT REPORT"}
                    variant="primary"
                    disabled={isSubmittingReport}
                    style={{ marginBottom: 12 }}
                    onPress={handleFormSubmitReport}
                  />

                  <CustomButton
                    title="CANCEL"
                    variant="outline"
                    style={{ marginBottom: 35 }}
                    onPress={() => setShowReportModal(false)}
                  />
                </ScrollView>
              </KeyboardAvoidingView>
            </View>
          </Modal>
        )}

        {/* Admin Deactivation Modal Popup - Non-Dismissible Mandatory App Lock */}
        <DeactivatedModal
          visible={showDeactivatedModal}
          deactivatedData={deactivatedData}
          onLogout={(reason) => {
            setShowDeactivatedModal(false);
            if (typeof onLogoutRef.current === 'function') {
              onLogoutRef.current(reason || deactivatedData?.reason);
            }
            if (typeof onNavigateRef.current === 'function') {
              onNavigateRef.current('LOGIN');
            }
          }}
        />

        {/* Admin Warning Modal Popup - Non-Dismissible Mandatory App Lock */}
        <WarningModal
          visible={showAdminWarningModal}
          warning={activeWarningData}
          onAcknowledge={handleAcknowledgeWarningCall}
          onClose={activeWarningData && !activeWarningData.isAcknowledged ? null : () => setShowAdminWarningModal(false)}
          loading={warningAckLoading}
          isMandatory={!!(activeWarningData && !activeWarningData.isAcknowledged)}
        />

        {/* Global Subscription Modal Triggered from Likes Tab / Advanced Search / Swipes */}
        <SubscriptionModal
          visible={isSubscriptionModalOpen}
          onClose={() => {
            setIsSubscriptionModalOpen(false);
            syncSubscriptionStatus().catch(() => { });
          }}
          currentTier={userProfile?.subscriptionTier || currentUser?.subscriptionTier || 'Free'}
          onSubscriptionUpdated={async (newTier, newPerms) => {
            if (newPerms) {
              setSubscriptionPermissions(newPerms);
            }
            const res = await syncSubscriptionStatus();
            const activePerms = newPerms || res?.permissions;
            if (typeof onUpdateProfile === 'function') {
              onUpdateProfile({
                subscriptionTier: newTier,
                subscriptionStatus: 'active',
                subscriptionPermissions: activePerms,
              });
            }
            await fetchLikes();
            fetchQuestionnaires();
          }}
        />

        {/* Authentic WhatsApp Dark Mode Message Context Popover Modal */}
        {showMessageActionModal && selectedMessageForAction && (
          <Modal
            visible={showMessageActionModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowMessageActionModal(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(11, 20, 26, 0.85)',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 20,
              }}
              activeOpacity={1}
              onPress={() => setShowMessageActionModal(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{
                  width: '100%',
                  maxWidth: 300,
                  alignItems: selectedMessageForAction.sender === 'you' ? 'flex-end' : 'flex-start',
                }}
              >
                {/* Floating Top Emoji Reaction Bar Pill */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#202C33',
                    borderRadius: 25,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                  }}
                >
                  {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => handleEmojiReaction(emoji)}
                      style={{
                        paddingHorizontal: 5,
                        paddingVertical: 2,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 24 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginLeft: 4,
                    }}
                    onPress={() => {
                      setReactingToMessageForEmoji(selectedMessageForAction);
                      setShowMessageActionModal(false);
                      setShowEmojiPicker(true);
                    }}
                  >
                    <Ionicons name="add" size={18} color="#AEBAC1" />
                  </TouchableOpacity>
                </View>

                {/* Selected Message Bubble Highlighted Preview */}
                <View
                  style={{
                    maxWidth: '90%',
                    backgroundColor: selectedMessageForAction.sender === 'you' ? '#005C4B' : '#202C33',
                    borderRadius: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    alignSelf: selectedMessageForAction.sender === 'you' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Text style={{ color: '#E9EDEF', fontSize: 15, lineHeight: 20 }}>
                    {selectedMessageForAction.text || selectedMessageForAction.mediaUrl || 'Media Message'}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ color: '#8696A0', fontSize: 11, marginRight: 4 }}>
                      {selectedMessageForAction.createdAt ? formatMessageTime(selectedMessageForAction.createdAt) : 'Just now'}
                    </Text>
                    {selectedMessageForAction.sender === 'you' && (
                      <Text style={{ color: selectedMessageForAction.status === 'seen' ? '#53BDEB' : '#8696A0', fontSize: 12 }}>
                        ✓✓
                      </Text>
                    )}
                  </View>
                </View>

                {/* Vertical WhatsApp Context Menu Card */}
                <View
                  style={{
                    width: 230,
                    backgroundColor: '#232D36',
                    borderRadius: 16,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    elevation: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.45,
                    shadowRadius: 10,
                    alignSelf: selectedMessageForAction.sender === 'you' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {(selectedMessageForAction.sender === 'you' || selectedMessageForAction.senderId === (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString()) && (
                    <TouchableOpacity
                      style={styles.waContextMenuItem}
                      onPress={() => {
                        setShowMessageActionModal(false);
                        setShowInfoModal(true);
                      }}
                    >
                      <Ionicons name="information-circle-outline" size={20} color="#AEBAC1" style={{ marginRight: 16 }} />
                      <Text style={styles.waContextMenuText}>Message info</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.waContextMenuItem}
                    onPress={() => {
                      setShowMessageActionModal(false);
                      setReplyingToMessage(selectedMessageForAction);
                      setTimeout(() => {
                        chatInputRef.current?.focus();
                      }, 150);
                    }}
                  >
                    <Ionicons name="arrow-undo-outline" size={20} color="#AEBAC1" style={{ marginRight: 16 }} />
                    <Text style={styles.waContextMenuText}>Reply</Text>
                  </TouchableOpacity>

                  {selectedMessageForAction.sender === 'you' && !selectedMessageForAction.isDeletedForEveryone && (selectedMessageForAction.messageType === 'text' || !selectedMessageForAction.messageType || selectedMessageForAction.text) && (
                    <TouchableOpacity
                      style={styles.waContextMenuItem}
                      onPress={() => {
                        setShowMessageActionModal(false);
                        setEditingMessage(selectedMessageForAction);
                        typedMessageRef.current = selectedMessageForAction.text || '';
                        setTypedMessage(selectedMessageForAction.text || '');
                      }}
                    >
                      <Ionicons name="pencil-outline" size={20} color="#AEBAC1" style={{ marginRight: 16 }} />
                      <Text style={styles.waContextMenuText}>Edit</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.waContextMenuItem}
                    onPress={() => handleCopyMessageText(selectedMessageForAction)}
                  >
                    <Ionicons name="copy-outline" size={20} color="#AEBAC1" style={{ marginRight: 16 }} />
                    <Text style={styles.waContextMenuText}>Copy</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.waContextMenuItem}
                    onPress={() => {
                      setShowMessageActionModal(false);
                      setSelectedForwardUserIds([]);
                      setForwardSearchQuery('');
                      setMessagesToForward(selectedMessageForAction ? [selectedMessageForAction] : []);
                      setShowForwardModal(true);
                    }}
                  >
                    <Ionicons name="arrow-redo-outline" size={20} color="#AEBAC1" style={{ marginRight: 16 }} />
                    <Text style={styles.waContextMenuText}>Forward</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.waContextMenuItem}
                    onPress={() => handlePinMessageAction(selectedMessageForAction)}
                  >
                    <Ionicons name="push-outline" size={20} color="#AEBAC1" style={{ marginRight: 16 }} />
                    <Text style={styles.waContextMenuText}>
                      {selectedMessageForAction.isPinned ? 'Unpin' : 'Pin'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.waContextMenuItem}
                    onPress={() => handleToggleStarAction(selectedMessageForAction)}
                  >
                    <Ionicons
                      name={isMessageStarredByMe(selectedMessageForAction) ? 'star' : 'star-outline'}
                      size={20}
                      color={isMessageStarredByMe(selectedMessageForAction) ? '#FFD700' : '#AEBAC1'}
                      style={{ marginRight: 16 }}
                    />
                    <Text style={styles.waContextMenuText}>
                      {isMessageStarredByMe(selectedMessageForAction) ? 'Unstar' : 'Star'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.waContextMenuItem}
                    onPress={() => {
                      setShowMessageActionModal(false);
                      const targetId = (selectedMessageForAction?.id || selectedMessageForAction?._id)?.toString();
                      if (targetId) {
                        setSelectedMultiMessageIds([targetId]);
                        setIsMultiSelectMode(true);
                      }
                    }}
                  >
                    <Ionicons name="checkbox-outline" size={20} color="#AEBAC1" style={{ marginRight: 16 }} />
                    <Text style={styles.waContextMenuText}>Select</Text>
                  </TouchableOpacity>

                  <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', marginVertical: 4 }} />

                  <TouchableOpacity
                    style={styles.waContextMenuItem}
                    onPress={() => {
                      setShowMessageActionModal(false);
                      setShowDeleteConfirmModal(true);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#F15C6D" style={{ marginRight: 16 }} />
                    <Text style={[styles.waContextMenuText, { color: '#F15C6D' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Authentic WhatsApp Dark Delete Confirmation Modal */}
        {showDeleteConfirmModal && (selectedMessageForAction || (isMultiSelectMode && selectedMultiMessageIds.length > 0)) && (
          <Modal
            visible={showDeleteConfirmModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowDeleteConfirmModal(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(11, 20, 26, 0.85)',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 24,
              }}
              activeOpacity={1}
              onPress={() => setShowDeleteConfirmModal(false)}
            >
              {(() => {
                const isMulti = isMultiSelectMode && selectedMultiMessageIds.length > 0;
                const count = isMulti ? selectedMultiMessageIds.length : 1;
                const selectedMsgs = isMulti
                  ? (activeChat?.messages || []).filter((m) => {
                    const mId = (m.id || m._id)?.toString();
                    return selectedMultiMessageIds.includes(mId);
                  })
                  : [selectedMessageForAction].filter(Boolean);

                const canDeleteForEveryone =
                  selectedMsgs.length > 0 &&
                  selectedMsgs.every((m) => {
                    const currentId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
                    const isSentByMe = m.sender === 'you' || (m.senderId && m.senderId.toString() === currentId);
                    return isSentByMe && !m.isDeletedForEveryone;
                  });

                return (
                  <TouchableOpacity
                    activeOpacity={1}
                    style={{
                      width: '100%',
                      maxWidth: 320,
                      backgroundColor: '#202C33',
                      borderRadius: 22,
                      padding: 24,
                      elevation: 8,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.35,
                      shadowRadius: 10,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <Text style={{ color: '#E9EDEF', fontSize: 17, fontWeight: '700', marginBottom: 22 }}>
                      {count > 1 ? `Delete ${count} messages?` : 'Delete message?'}
                    </Text>

                    <View style={{ alignItems: 'flex-end', gap: 10 }}>
                      {canDeleteForEveryone && (
                        <TouchableOpacity
                          onPress={() => (isMulti ? handleExecuteMultiDeleteAction('everyone') : handleExecuteDeleteAction('everyone'))}
                          style={{ paddingVertical: 8, paddingHorizontal: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#00A884', fontWeight: '700', fontSize: 15 }}>
                            Delete for everyone
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => (isMulti ? handleExecuteMultiDeleteAction('me') : handleExecuteDeleteAction('me'))}
                        style={{ paddingVertical: 8, paddingHorizontal: 10 }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: '#00A884', fontWeight: '700', fontSize: 15 }}>
                          Delete for me
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setShowDeleteConfirmModal(false)}
                        style={{ paddingVertical: 8, paddingHorizontal: 10 }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: '#00A884', fontWeight: '600', fontSize: 15 }}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })()}
            </TouchableOpacity>
          </Modal>
        )}

        {/* WhatsApp Message Info Modal */}
        {showInfoModal && selectedMessageForAction && (
          <Modal
            visible={showInfoModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowInfoModal(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.7)',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 24,
              }}
              activeOpacity={1}
              onPress={() => setShowInfoModal(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{
                  width: '100%',
                  maxWidth: 320,
                  backgroundColor: '#1E222B',
                  borderRadius: 20,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                }}
              >
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 14 }}>
                  Message Details ℹ️
                </Text>

                <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                  <Text style={{ color: '#FFF', fontSize: 14 }}>
                    {selectedMessageForAction.text || selectedMessageForAction.mediaUrl || 'Media'}
                  </Text>
                </View>

                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Sender:</Text>
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>
                      {selectedMessageForAction.sender === 'you' ? 'You' : activeChat?.name || 'Partner'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Status:</Text>
                    <Text style={{ color: selectedMessageForAction.status === 'seen' ? '#00E676' : '#FFD700', fontSize: 13, fontWeight: '600' }}>
                      {selectedMessageForAction.status ? selectedMessageForAction.status.toUpperCase() : 'SENT'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Timestamp:</Text>
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>
                      {selectedMessageForAction.createdAt ? formatMessageTime(selectedMessageForAction.createdAt) : 'Just now'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#FE3C72',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginTop: 20,
                  }}
                  onPress={() => setShowInfoModal(false)}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Close</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {/* WhatsApp Full Screen Forward Message Screen */}
        {showForwardModal && selectedMessageForAction && (
          <Modal
            visible={showForwardModal}
            transparent={false}
            animationType="slide"
            onRequestClose={handleCloseForwardModal}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: '#0B141A', paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 10 : 0) }}>
              {/* WhatsApp App Bar */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#1F2C34',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <TouchableOpacity
                  onPress={handleCloseForwardModal}
                  style={{ padding: 6, marginRight: 12, borderRadius: 20 }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="arrow-back" size={24} color="#E9EDEF" />
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#E9EDEF', fontSize: 18, fontWeight: '700' }}>
                    Forward to...
                  </Text>
                  <Text
                    style={{
                      color: selectedForwardUserIds.length > 0 ? '#00A884' : '#8696A0',
                      fontSize: 13,
                      marginTop: 2,
                      fontWeight: selectedForwardUserIds.length > 0 ? '600' : '400',
                    }}
                    numberOfLines={1}
                  >
                    {selectedForwardUserIds.length > 0
                      ? `${selectedForwardUserIds.length} contact${selectedForwardUserIds.length > 1 ? 's' : ''} selected`
                      : (messagesToForward && messagesToForward.length > 1)
                        ? `${messagesToForward.length} messages selected to forward`
                        : selectedMessageForAction?.text
                          ? `"${selectedMessageForAction.text}"`
                          : selectedMessageForAction?.mediaUrl
                            ? 'Media message'
                            : 'Select contact to forward'}
                  </Text>
                </View>
              </View>

              {/* WhatsApp Search Bar */}
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: '#0B141A',
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255, 255, 255, 0.05)',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#1F2C34',
                    borderRadius: 22,
                    paddingHorizontal: 14,
                    height: 44,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Ionicons name="search" size={18} color="#8696A0" style={{ marginRight: 8 }} />
                  <TextInput
                    style={{ flex: 1, color: '#E9EDEF', fontSize: 15, paddingVertical: 0 }}
                    placeholder="Search matched users..."
                    placeholderTextColor="#8696A0"
                    value={forwardSearchQuery}
                    onChangeText={setForwardSearchQuery}
                    autoCapitalize="none"
                  />
                  {forwardSearchQuery.trim().length > 0 && (
                    <TouchableOpacity onPress={() => setForwardSearchQuery('')} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={18} color="#8696A0" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Selected Contact Chips (WhatsApp Horizontal Strip) */}
              {selectedForwardUserIds.length > 0 && (
                <View
                  style={{
                    backgroundColor: '#111B21',
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ alignItems: 'center', gap: 12 }}
                  >
                    {forwardCandidates
                      .filter((u) => selectedForwardUserIds.includes((u.id || u._id || u.userId)?.toString()))
                      .map((u) => {
                        const uId = (u.id || u._id || u.userId)?.toString();
                        return (
                          <TouchableOpacity
                            key={`chip-${uId}`}
                            onPress={() => toggleSelectForwardUser(uId)}
                            style={{ alignItems: 'center', width: 62 }}
                            activeOpacity={0.7}
                          >
                            <View style={{ position: 'relative' }}>
                              <Image
                                source={{ uri: getImageUrl(u.image) }}
                                style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#2A3942' }}
                              />
                              <View
                                style={{
                                  position: 'absolute',
                                  bottom: -2,
                                  right: -2,
                                  backgroundColor: '#8696A0',
                                  borderRadius: 9,
                                  width: 18,
                                  height: 18,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderWidth: 1.5,
                                  borderColor: '#111B21',
                                }}
                              >
                                <Ionicons name="close" size={12} color="#0B141A" />
                              </View>
                            </View>
                            <Text
                              style={{ color: '#E9EDEF', fontSize: 11, marginTop: 4, textAlign: 'center' }}
                              numberOfLines={1}
                            >
                              {u.name?.split(' ')[0] || 'User'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </View>
              )}

              {/* Matched Users List */}
              <View style={{ flex: 1, backgroundColor: '#0B141A' }}>
                {(() => {
                  const filtered = forwardCandidates.filter((u) => {
                    if (!forwardSearchQuery.trim()) return true;
                    return (u.name || '').toLowerCase().includes(forwardSearchQuery.trim().toLowerCase());
                  });

                  if (filtered.length === 0) {
                    return (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                        <Ionicons name="people-outline" size={54} color="rgba(255,255,255,0.22)" style={{ marginBottom: 14 }} />
                        <Text style={{ color: '#E9EDEF', fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
                          {forwardSearchQuery.trim() ? 'No matching users found' : 'No matched users available'}
                        </Text>
                        <Text style={{ color: '#8696A0', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
                          {forwardSearchQuery.trim()
                            ? `No matches found for "${forwardSearchQuery}"`
                            : 'Swipe and match with someone to start chatting and forwarding messages!'}
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <ScrollView
                      style={{ flex: 1 }}
                      contentContainerStyle={{ paddingBottom: 110 }}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      <Text
                        style={{
                          color: '#8696A0',
                          fontSize: 12,
                          fontWeight: '600',
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          paddingHorizontal: 16,
                          paddingTop: 14,
                          paddingBottom: 8,
                        }}
                      >
                        Recent chats & matches ({filtered.length})
                      </Text>
                      {filtered.map((c) => {
                        const cId = (c.id || c._id || c.userId)?.toString();
                        const isSelected = selectedForwardUserIds.includes(cId);
                        return (
                          <TouchableOpacity
                            key={cId}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 12,
                              paddingHorizontal: 16,
                              backgroundColor: isSelected ? 'rgba(0, 168, 132, 0.12)' : 'transparent',
                            }}
                            activeOpacity={0.7}
                            onPress={() => toggleSelectForwardUser(cId)}
                          >
                            {/* Avatar with online dot */}
                            <View style={{ position: 'relative', marginRight: 14 }}>
                              <Image
                                source={{ uri: getImageUrl(c.image) }}
                                style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#2A3942' }}
                              />
                              {c.isOnline && (
                                <View
                                  style={{
                                    position: 'absolute',
                                    bottom: 1,
                                    right: 1,
                                    width: 14,
                                    height: 14,
                                    borderRadius: 7,
                                    backgroundColor: '#00A884',
                                    borderWidth: 2,
                                    borderColor: '#0B141A',
                                  }}
                                />
                              )}
                            </View>

                            {/* Name & Bio */}
                            <View style={{ flex: 1, justifyContent: 'center' }}>
                              <Text style={{ color: '#E9EDEF', fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                                {c.name}
                              </Text>
                              <Text style={{ color: '#8696A0', fontSize: 13, marginTop: 3 }} numberOfLines={1}>
                                {c.bio ? c.bio : 'Matched user'}
                              </Text>
                            </View>

                            {/* Selection Indicator Circle */}
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: isSelected ? 0 : 2,
                                borderColor: '#8696A0',
                                backgroundColor: isSelected ? '#00A884' : 'transparent',
                                marginLeft: 12,
                              }}
                            >
                              {isSelected && (
                                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  );
                })()}

                {/* Floating WhatsApp Green Send Button (FAB) */}
                {selectedForwardUserIds.length > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: Math.max(insets.bottom, safeBottomPadding, 16) + 12,
                      right: 20,
                      alignItems: 'center',
                    }}
                  >
                    <TouchableOpacity
                      onPress={handleExecuteForward}
                      disabled={isSendingForward}
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 29,
                        backgroundColor: '#00A884',
                        alignItems: 'center',
                        justifyContent: 'center',
                        elevation: 10,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.35,
                        shadowRadius: 6,
                      }}
                      activeOpacity={0.85}
                    >
                      {isSendingForward ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="send" size={24} color="#FFFFFF" style={{ marginLeft: 3 }} />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </SafeAreaView>
          </Modal>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 40 : 35,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FE3C72',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoIconText: {
    fontSize: 16,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  refreshSpinIcon: {
    opacity: 0.5,
  },
  homeCenterLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  homeCenterLoadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  contentArea: {
    flex: 1,
  },
  navigationBar: {
    flexDirection: 'row',
    backgroundColor: '#0F1115',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 20,
  },
  navigationTab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingTop: 4,
    opacity: 0.6,
  },
  navigationTabActive: {
    opacity: 1,
  },
  navigationIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navigationLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  tabHeaderWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 12,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerBackBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  navigationLabelActive: {
    color: '#FE3C72',
    fontWeight: '800',
  },
  navBadgeContainer: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0F1115',
    elevation: 5,
    zIndex: 10,
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },

  // Swipe Tab Styles
  swipeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 72,
    position: 'relative',
  },
  stackContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  matchCard: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1E222B', // Solid opaque color to prevent behind-card bleed-through
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  nextCard: {
    transform: [{ scale: 0.94 }, { translateY: 15 }],
    opacity: 0.65,
  },
  swipeOnlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 211, 102, 0.18)',
    borderColor: '#25D366',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
  },
  swipeOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#25D366',
    marginRight: 4,
  },
  swipeOnlineText: {
    color: '#25D366',
    fontSize: 11,
    fontWeight: '700',
  },
  swipeBadge: {
    position: 'absolute',
    top: 20,
    borderWidth: 4,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  likeBadge: {
    left: 20,
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    transform: [{ rotate: '-15deg' }],
  },
  likeBadgeText: {
    color: '#4CAF50',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  nopeBadge: {
    right: 20,
    borderColor: '#F44336',
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    transform: [{ rotate: '15deg' }],
  },
  nopeBadgeText: {
    color: '#F44336',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  matchCardImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  matchCardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  matchDetails: {
    padding: 20,
    paddingBottom: 95, // Leave room for float buttons
  },
  matchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchNameText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  distanceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  distanceBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  matchBioText: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.95,
    lineHeight: 20,
    marginBottom: 15,
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestMiniBadge: {
    backgroundColor: 'rgba(20, 22, 28, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
  },
  interestMiniText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  commonInterestHighlightBadge: {
    backgroundColor: '#FF4458',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    width: '100%',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  commonInterestHighlightText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  commonInterestBadgeActive: {
    backgroundColor: '#FF4458',
    borderWidth: 1,
    borderColor: '#FF4458',
  },
  commonInterestTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  actionButtonsRow: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  actionCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  actionRewind: {
    backgroundColor: '#FFB300',
    width: 52,
    height: 52,
    borderRadius: 26,
    marginHorizontal: 8,
  },
  actionRewindText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  actionDislike: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECEFF1',
  },
  actionLike: {
    backgroundColor: '#FFFFFF',
  },
  actionSuperLike: {
    backgroundColor: '#00B0FF',
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  actionIconText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  actionDislikeText: {
    color: '#F44336',
  },
  noMatchesCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    textAlign: 'center',
  },
  noMatchesEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  noMatchesTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  noMatchesSubtitle: {
    color: '#FFFFFF',
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
  },

  // Likes Tab Styles
  likesContainer: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: 16,
  },
  likesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  likesCard: {
    width: (SCREEN_WIDTH - 55) / 2,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  likesCardImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  likesCardBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  likesCardDetails: {
    padding: 12,
  },
  likesCardName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  likesCardSubtitle: {
    color: '#FE3C72',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },

  // Chat Tab Styles
  chatTabContainer: {
    flex: 1,
  },
  chatListWrapper: {
    flex: 1,
    padding: 20,
  },
  chatsList: {
    flex: 1,
    marginTop: 10,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  chatRowAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: 15,
  },
  chatRowInfo: {
    flex: 1,
  },
  chatRowName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  chatRowLastMessage: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
  },
  chatRowTime: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    fontWeight: '600',
  },
  chatRowUnread: {
    backgroundColor: 'rgba(37, 211, 102, 0.06)',
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  chatRowNameUnread: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chatRowLastMessageUnread: {
    fontWeight: '700',
    color: '#E2E8F0',
  },
  chatRowRightMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  chatRowTimeUnread: {
    color: '#25D366',
    fontWeight: '700',
  },
  whatsappUnreadBadge: {
    backgroundColor: '#25D366',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  whatsappUnreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  chatStatusTicks: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#8E8E93',
    marginRight: 4,
  },
  chatStatusTicksSeen: {
    color: '#34B7F1',
  },
  navChatBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#25D366',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#121212',
  },
  navChatBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  navLikesBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#25D366',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#121212',
  },
  navLikesBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },

  editingMessageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 107, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 107, 0.4)',
  },
  editingMessageBannerText: {
    color: '#FF6B6B',
    fontSize: 13,
    flex: 1,
  },
  cancelEditButton: {
    padding: 4,
    marginLeft: 10,
  },
  cancelEditButtonText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Active Chat Screen Styles
  activeChatWrapper: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  chatSearchHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1F2C34',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  chatSearchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A3942',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    marginHorizontal: 8,
  },
  chatSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 4,
  },
  chatSearchNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatSearchCountText: {
    color: '#8696A0',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
  chatBackButton: {
    paddingRight: 15,
  },
  chatBackArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  chatHeaderName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  chatThreeDotsButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatThreeDotsText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  messageBubbleContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  messageBubbleWrapper: {
    flexDirection: 'row',
    marginBottom: 4,
    width: '100%',
  },
  bubbleWrapperMe: {
    justifyContent: 'flex-end',
  },
  bubbleWrapperThem: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingTop: 6,
    paddingBottom: 6,
    minWidth: 75,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  bubbleMe: {
    backgroundColor: '#005C4B',
    borderTopRightRadius: 2,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  bubbleThem: {
    backgroundColor: '#202C33',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#E9EDEF',
  },
  messageTextMe: {
    color: '#E9EDEF',
  },
  messageTextThem: {
    color: '#E9EDEF',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  chatInput: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingHorizontal: 18,
    color: '#FFFFFF',
    fontSize: 14,
    marginRight: 10,
  },
  chatSendButton: {
    backgroundColor: '#FE3C72',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Profile Tab Styles
  profileContainer: {
    flex: 1,
  },
  profileHero: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  profileAvatarBorder: {
    position: 'relative',
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeroAvatar: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileHeroAvatarPlaceholder: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileHeroAvatarLetter: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  completionRingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 70,
    borderWidth: 4,
    backgroundColor: 'transparent',
    opacity: 0.9,
  },
  completionPercentagePill: {
    marginTop: -12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  completionPercentagePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  profileHeroName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 15,
  },
  profileHeroBio: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 30,
    marginTop: 8,
    lineHeight: 18,
  },
  editProfilePillButton: {
    marginTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  editProfilePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  profileDetailsSection: {
    padding: 20,
    paddingBottom: 40,
  },
  detailSectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.85,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 14,
    padding: 12,
    width: (SCREEN_WIDTH - 50) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  detailCardEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  detailCardText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  profileInterestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  profileInterestBadge: {
    backgroundColor: '#FE3C72',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  profileInterestText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Match Screen Popup Layout
  matchPopupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  matchPopupCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    padding: 24,
    alignItems: 'center',
  },
  matchPopupTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  matchPopupSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  matchPopupAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  matchPopupAvatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#FE3C72',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  matchPopupAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  matchPopupAvatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  matchPopupLetter: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  matchPopupConnector: {
    fontSize: 24,
    marginHorizontal: 15,
  },

  // Edit Profile Modal Styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  modalCloseButton: {
    paddingVertical: 5,
  },
  modalCloseText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 15,
    fontWeight: '500',
  },
  modalSaveButton: {
    paddingVertical: 5,
  },
  modalSaveText: {
    color: '#FE3C72',
    fontSize: 15,
    fontWeight: '700',
  },
  modalScrollBody: {
    flex: 1,
    padding: 20,
  },
  photoEditSection: {
    alignItems: 'center',
    marginVertical: 15,
  },
  photoEditCard: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEditPreview: {
    width: '120%',
    height: '120%',
    resizeMode: 'cover',
  },
  photoEditPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEditPlus: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    marginBottom: 2,
  },
  photoEditText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.8,
  },
  clearPhotoPill: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 60, 114, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  clearPhotoText: {
    color: '#FE3C72',
    fontSize: 11,
    fontWeight: '700',
  },
  editFieldsSection: {
    marginTop: 10,
  },
  editFieldLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  editInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 20,
  },
  editBioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  editOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  editOptionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  editOptionButtonActive: {
    backgroundColor: '#FE3C72',
    borderColor: '#FE3C72',
  },
  editOptionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  editOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  editOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  editOptionBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  editOptionBadgeActive: {
    backgroundColor: 'rgba(254, 60, 114, 0.2)',
    borderColor: '#FE3C72',
    borderWidth: 1.5,
  },
  editOptionBadgeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  editOptionBadgeTextActive: {
    color: '#FE3C72',
    fontWeight: '700',
  },
  preferenceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  preferenceSectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  preferenceValueDisplay: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 14,
  },
  adjusterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  adjusterCol: {
    flex: 1,
    marginHorizontal: 4,
  },
  adjusterLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  adjusterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    justifyContent: 'space-between',
    padding: 3,
  },
  adjusterControlsCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    justifyContent: 'space-between',
    padding: 4,
    width: '100%',
  },
  adjusterBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjusterBtnLarge: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjusterBtnLargeText: {
    color: '#FE3C72',
    fontSize: 13,
    fontWeight: '700',
  },
  adjusterBtnText: {
    color: '#FE3C72',
    fontSize: 15,
    fontWeight: '800',
  },
  adjusterNum: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  adjusterNumLarge: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  screenWrapper: {
    flex: 1,
    backgroundColor: '#0F1115', // Sleek solid charcoal dark background for Home
  },
  editModalWrapper: {
    flex: 1,
    backgroundColor: '#0F1115', // Matching sleek solid dark background for Edit Profile Modal
  },
  emptyLikesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 120,
  },
  emptyLikesEmoji: {
    fontSize: 56,
    opacity: 0.8,
    marginBottom: 16,
  },
  emptyLikesTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyLikesSubtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 18,
  },
  emptyChatsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 120,
  },
  emptyChatsEmoji: {
    fontSize: 56,
    opacity: 0.8,
    marginBottom: 16,
  },
  emptyChatsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyChatsSubtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 18,
  },
  interestsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  categoryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  categoryHeaderExpanded: {
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  categoryTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  selectedCountBadge: {
    backgroundColor: '#FE3C72',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  arrowIndicator: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  categoryOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'center',
  },
  interestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 5,
  },
  interestBadgeSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  interestBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  interestBadgeTextSelected: {
    color: '#FE3C72',
    fontWeight: '700',
  },
  photoGridTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.85,
  },
  photoGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  photoGridItem: {
    width: (SCREEN_WIDTH - 60) / 3,
    aspectRatio: 3 / 4,
    marginBottom: 12,
    position: 'relative',
  },
  photoGridCard: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  photoGridCardEmpty: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
    backgroundColor: '#1E222B',
  },
  photoGridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoGridCardPlaceholder: {
    flex: 1,
  },
  photoGridDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FE3C72',
  },
  photoGridActionBtnAdd: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FE3C72',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0F1115',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  photoGridActionBtnEdit: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0F1115',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  photoGridActionBtnTextAdd: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  photoGridActionBtnTextEdit: {
    color: '#333333',
    fontSize: 12,
    lineHeight: 14,
  },
  modalTabSelectorRow: {
    flexDirection: 'row',
    backgroundColor: '#15181F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modalTabButtonActive: {
    borderBottomColor: '#FE3C72',
  },
  modalTabText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalTabTextActive: {
    color: '#FE3C72',
  },
  previewScrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewHeaderName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginRight: 6,
  },
  previewInfoIconWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInfoIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  previewCardWrapper: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E222B',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  previewSegmentIndicatorsRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    zIndex: 10,
  },
  previewSegmentBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    marginHorizontal: 3,
    borderRadius: 1.5,
  },
  previewSegmentBarActive: {
    backgroundColor: '#FFFFFF',
  },
  previewCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewNavArrow: {
    position: 'absolute',
    top: '48%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  previewNavArrowLeft: {
    left: 12,
  },
  previewNavArrowRight: {
    right: 12,
  },
  previewNavArrowText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: -2,
  },
  previewToggleWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 60, 114, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FE3C72',
  },
  previewToggleArrow: {
    color: '#FE3C72',
    fontSize: 12,
    marginRight: 8,
  },
  previewToggleLabel: {
    color: '#FE3C72',
    fontSize: 12,
    fontWeight: '700',
  },
  previewDetailsDrawer: {
    backgroundColor: '#1E222B',
    borderRadius: 20,
    padding: 16,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  previewSectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    opacity: 0.65,
  },
  previewBioText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    fontWeight: '500',
  },
  previewDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  previewDetailCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  previewDetailCardEmoji: {
    fontSize: 14,
    marginRight: 8,
  },
  previewDetailCardText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  previewInterestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  previewInterestBadge: {
    backgroundColor: '#FE3C72',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  previewInterestText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  previewDetailCardLarge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 10,
  },
  previewDetailCardLargeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginVertical: 2,
  },
  matchDetailsExpanded: {
    height: '65%',
    backgroundColor: 'rgba(15, 17, 21, 0.96)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cardDetailToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4458',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginVertical: 8,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  cardDetailToggleArrow: {
    color: '#FFFFFF',
    fontSize: 12,
    marginRight: 6,
    fontWeight: '900',
  },
  cardDetailToggleLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardExpandedScroll: {
    flex: 1,
    marginTop: 4,
  },
  cardDetailSectionTitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardExpandedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardExpandedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    width: '48%',
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardExpandedEmoji: {
    fontSize: 11,
    marginRight: 5,
  },
  cardExpandedText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  cardExpandedInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  cardExpandedInterestBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 4,
  },
  cardExpandedInterestText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  matchCardExpandedFull: {
    padding: 0,
    overflow: 'hidden',
  },
  cardExpandedFullWrapper: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  cardExpandedHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#15181F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardDetailMinimizeHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDetailMinimizeArrow: {
    color: '#FE3C72',
    fontSize: 14,
    marginRight: 6,
    fontWeight: 'bold',
  },
  cardDetailMinimizeLabel: {
    color: '#FE3C72',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardExpandedScrollBody: {
    flex: 1,
  },
  cardExpandedTopImage: {
    width: '100%',
    aspectRatio: 1,
    resizeMode: 'cover',
  },
  cardExpandedContentPadding: {
    padding: 20,
  },
  matchNameTextLarge: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginRight: 8,
  },
  distanceBadgeLarge: {
    backgroundColor: 'rgba(254, 60, 114, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceBadgeTextLarge: {
    color: '#FE3C72',
    fontSize: 11,
    fontWeight: '700',
  },
  matchBioTextLarge: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 14,
    fontWeight: '500',
  },
  cardDetailSectionTitleLarge: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    opacity: 0.7,
  },
  candidateDetailsWrapper: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  cardExpandedTopImageFull: {
    width: '100%',
    aspectRatio: 3 / 4,
    resizeMode: 'cover',
  },
  manageSubscriptionButton: {
    backgroundColor: '#FFD700',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginTop: 12,
    width: '80%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  manageSubscriptionButtonText: {
    color: '#0F1115',
    fontSize: 14,
    fontWeight: '800',
  },
  subscriptionWrapper: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: '#15181F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  subscriptionCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  subscriptionCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
  },
  subscriptionScroll: {
    flex: 1,
  },
  premiumHeroBanner: {
    padding: 24,
    backgroundColor: '#1C1F26',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  premiumHeroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFD700',
    marginBottom: 8,
  },
  premiumHeroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  featuresSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureItemEmoji: {
    fontSize: 22,
    marginRight: 14,
    marginTop: 2,
  },
  featureItemInfo: {
    flex: 1,
  },
  featureItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  featureItemDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 16,
  },
  plansSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  plansSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#15181F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#FFD700',
    backgroundColor: '#1E212A',
    borderWidth: 2,
  },
  planTextSelected: {
    color: '#FFD700',
    fontWeight: '800',
  },
  planLabelTextSelected: {
    color: '#FFD700',
    fontWeight: '600',
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planDuration: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#FFD700',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  popularBadgeText: {
    color: '#0F1115',
    fontSize: 9,
    fontWeight: '900',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#FE3C72',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bestValueBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  purchaseActionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  subscriptionFooterNote: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 15,
  },
  likesGridScroll: {
    flex: 1,
    marginTop: 15,
  },
  likesListContainer: {
    paddingHorizontal: 15,
    paddingBottom: 30,
    gap: 8,
  },
  instaRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C24',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  instaAvatarWrapper: {
    position: 'relative',
  },
  instaAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#FF4458',
  },
  instaOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#1C1C24',
  },
  instaInfoCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: 'center',
  },
  instaNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  instaNameText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  instaSuperStar: {
    fontSize: 12,
  },
  instaSubtitleText: {
    color: '#AAAAAA',
    fontSize: 12,
    marginTop: 2,
  },
  instaActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  instaPassBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A36',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3A4A',
  },
  instaPassText: {
    color: '#FF4A4A',
    fontSize: 13,
    fontWeight: 'bold',
  },
  instaLikeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A36',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3A4A',
  },
  instaLikeIcon: {
    color: '#FF4458',
    fontSize: 15,
    fontWeight: 'bold',
  },
  likeRowCard: {
    backgroundColor: '#1E1E26',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  likeRowTopGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  likeRowAvatarWrapper: {
    position: 'relative',
  },
  likeRowAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#FF4458',
  },
  likeRowOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    borderWidth: 2.5,
    borderColor: '#1E1E26',
  },
  likeRowSuperBadge: {
    position: 'absolute',
    top: -6,
    left: -4,
    backgroundColor: '#3897F0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  likeRowSuperBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  likeRowMetaCol: {
    flex: 1,
    justifyContent: 'center',
  },
  likeRowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  likeRowNameText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  likeRowAgeText: {
    color: '#DDDDDD',
    fontSize: 17,
    fontWeight: '400',
  },
  likeRowDistanceText: {
    color: '#AAAAAA',
    fontSize: 13,
    marginTop: 2,
  },
  likeRowJobText: {
    color: '#CCCCCC',
    fontSize: 13,
    marginTop: 2,
  },
  likeRowBioSnippet: {
    color: '#999999',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  likeRowHorizontalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  likeRowActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  likeRowActionBtnPass: {
    backgroundColor: '#282834',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  likeRowActionPassIcon: {
    fontSize: 14,
    color: '#FF4A4A',
    fontWeight: '700',
  },
  likeRowActionPassLabel: {
    fontSize: 14,
    color: '#FF4A4A',
    fontWeight: '700',
  },
  likeRowActionBtnLike: {
    backgroundColor: '#FF4458',
  },
  likeRowActionLikeIcon: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  likeRowActionLikeLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  likeGridCard: {
    width: '47%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#15181F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    position: 'relative',
  },
  likeGridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  likeGridInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  likeGridName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  likeGridDistance: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  likeGridHeartBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeGridHeartEmoji: {
    fontSize: 12,
  },
  likeGridCardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  likeGridCardActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  likeGridCardActionBtnDislike: {
    borderWidth: 1,
    borderColor: '#ECEFF1',
  },
  likeGridCardActionBtnLike: {
    backgroundColor: '#FFFFFF',
  },
  likeGridCardActionText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  likeGridCardActionTextDislike: {
    color: '#F44336',
  },
  likeGridCardActionTextLike: {
    color: '#FE3C72',
  },
  messageTimeText: {
    fontSize: 9,
    marginTop: 4,
    alignSelf: 'flex-end',
    opacity: 0.6,
  },
  messageTimeTextMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageTimeTextThem: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  chatActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  chatActionIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  stickerBubble: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatStickerImage: {
    width: 125,
    height: 125,
    marginVertical: 4,
  },
  stickerText: {
    fontSize: 50,
  },
  imageMessageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  imageMessage: {
    width: 200,
    height: 150,
    resizeMode: 'cover',
  },
  documentMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 12,
    width: 210,
  },
  documentIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  documentIconText: {
    fontSize: 20,
  },
  documentTextContainer: {
    flex: 1,
  },
  documentNameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  documentSizeText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    marginTop: 2,
  },
  stickerPickerContainer: {
    height: 250,
    backgroundColor: '#1F2C34',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  stickerCategoryTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#121B22',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  stickerCategoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 6,
  },
  stickerCategoryTabActive: {
    backgroundColor: 'rgba(0, 168, 132, 0.22)',
    borderWidth: 1,
    borderColor: '#00A884',
  },
  stickerCategoryTabText: {
    color: '#8696A0',
    fontSize: 12,
    fontWeight: '600',
  },
  stickerCategoryTabTextActive: {
    color: '#00A884',
    fontWeight: '700',
  },
  stickerPickerCloseBtn: {
    padding: 6,
    marginLeft: 6,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  stickerItem: {
    width: '25%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  stickerItemImage: {
    width: 48,
    height: 48,
  },
  stickerItemText: {
    fontSize: 34,
  },
  chatMenuCenterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  chatMenuCenterContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E1E28',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  attachDialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  attachDialogContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  attachDialogTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  attachOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  attachOptionBtn: {
    alignItems: 'center',
    width: 80,
  },
  attachOptionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachOptionIconText: {
    fontSize: 24,
  },
  attachOptionLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  attachCancelBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachCancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  docListSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 16,
    paddingTop: 16,
  },
  docSectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  docItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  docItemIconBg: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(254, 60, 114, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docItemIcon: {
    color: '#FE3C72',
    fontSize: 16,
  },
  docItemName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  avatarWrapper: {
    position: 'relative',
  },
  onlineDotOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#1E1E1E',
  },
  chatHeaderTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  chatHeaderStatusText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    marginTop: 2,
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  statusTicks: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  ticksSent: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  ticksSeen: {
    color: '#34B7F1',
  },
  chatMicButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#00A884',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 8,
    marginVertical: 2,
    minHeight: 40,
    flex: 1,
  },
  recordingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingPulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 6,
  },
  recordingTimeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelRecordButton: {
    marginRight: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelRecordText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  sendRecordButton: {
    backgroundColor: '#FE3C72',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  sendRecordIcon: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    minWidth: 150,
  },
  voicePlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  voicePlayIcon: {
    color: '#FFF',
    fontSize: 12,
    marginLeft: 1,
  },
  voiceTimelineContainer: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    marginRight: 8,
  },
  voiceProgressBarBg: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1.5,
    width: '100%',
    position: 'absolute',
  },
  voiceProgressBarFill: {
    height: 3,
    backgroundColor: '#FFF',
    borderRadius: 1.5,
    width: '0%',
  },
  soundWaveBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    opacity: 0.35,
  },
  waveBar: {
    width: 2.5,
    backgroundColor: '#FFF',
    borderRadius: 1.25,
  },
  voiceDurationText: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  clearChatHeaderButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 75, 75, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 75, 0.3)',
  },
  clearChatHeaderText: {
    color: '#FF4D4D',
    fontSize: 11,
    fontWeight: '700',
  },
  chatListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  chatSelectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 168, 132, 0.35)',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  chatSelectionLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatSelectionCloseBtn: {
    padding: 4,
    marginRight: 14,
  },
  chatSelectionCountText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  chatSelectionRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatSelectionActionBtn: {
    padding: 6,
    borderRadius: 8,
  },
  chatHeaderIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatHeaderTitleWrapper: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 6,
  },
  chatSectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    lineHeight: 25,
    marginBottom: 2,
  },
  chatSectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
    marginBottom: 0,
  },
  chatHeaderActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  chatRowSelected: {
    backgroundColor: 'rgba(0, 168, 132, 0.16)',
    borderRadius: 12,
    marginHorizontal: -6,
    paddingHorizontal: 6,
  },
  selectedChatCheckmarkOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#00A884',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#0F1115',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  deleteAllChatsBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 75, 75, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 75, 0.3)',
    alignSelf: 'center',
  },
  deleteAllChatsBtnText: {
    color: '#FF4D4D',
    fontSize: 11,
    fontWeight: '700',
  },

  // --- Voice Call Styles ---
  callChatHeaderButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(32, 201, 151, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(32, 201, 151, 0.3)',
    marginRight: 8,
  },
  callChatHeaderText: {
    color: '#20C997',
    fontSize: 12,
    fontWeight: '700',
  },
  voiceCallOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceCallContent: {
    width: '85%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    height: '80%',
  },
  voiceCallAvatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 160,
  },
  voiceCallAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#FE3C72',
  },
  voiceCallAvatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FE3C72',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FE3C72',
  },
  voiceCallAvatarLetter: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  voiceCallName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 20,
    letterSpacing: 0.5,
  },
  voiceCallStatus: {
    fontSize: 16,
    color: '#AAA',
    marginTop: 10,
    fontStyle: 'italic',
  },
  voiceCallDuration: {
    fontSize: 22,
    fontWeight: '700',
    color: '#20C997',
    marginTop: 10,
    fontVariant: ['tabular-nums'],
  },
  voiceCallControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    width: '100%',
  },
  voiceCallButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    marginHorizontal: 12,
    minWidth: 120,
  },
  voiceCallAcceptButton: {
    backgroundColor: '#20C997',
  },
  voiceCallDeclineButton: {
    backgroundColor: '#FE3C72',
  },
  voiceCallEndButton: {
    backgroundColor: '#FE3C72',
    paddingHorizontal: 35,
    borderRadius: 30,
  },
  voiceCallButtonEmoji: {
    fontSize: 24,
    color: '#FFF',
    marginBottom: 4,
  },
  voiceCallButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  voiceCallRoundButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
  },
  // --- Voice Note WhatsApp Style Layout ---
  waVoiceBubble: {
    width: 245,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  waVoiceContainer: {
    width: '100%',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  waVoiceMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  waVoicePlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  waVoicePlayBtnMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  waVoicePlayBtnThem: {
    backgroundColor: '#00A884',
  },
  waVoicePlayIcon: {
    fontSize: 15,
    fontWeight: '800',
  },
  waVoicePlayIconMe: {
    color: '#FFFFFF',
  },
  waVoicePlayIconThem: {
    color: '#FFFFFF',
  },
  waVoiceTrackWrapper: {
    flex: 1,
    height: 22,
    justifyContent: 'center',
    position: 'relative',
    marginRight: 6,
  },
  waVoiceTrackLine: {
    height: 3,
    width: '100%',
    borderRadius: 1.5,
  },
  waVoiceTrackLineMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  waVoiceTrackLineThem: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  waVoiceDotThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  waVoiceDotThumbMe: {
    backgroundColor: '#FFFFFF',
  },
  waVoiceDotThumbThem: {
    backgroundColor: '#00A884',
  },
  waMicIconBadge: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waVoiceSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginTop: 1,
  },
  waVoiceDurationText: {
    fontSize: 11,
    fontWeight: '600',
  },
  waVoiceMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waVoiceTimeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  waVoiceMetaTextMe: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  waVoiceMetaTextThem: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  voiceCallRoundButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  voiceCallRoundButtonEmoji: {
    fontSize: 20,
    color: '#FFF',
    marginBottom: 2,
  },
  voiceCallRoundButtonText: {
    color: '#AAA',
    fontSize: 10,
    fontWeight: '600',
    position: 'absolute',
    bottom: -18,
    width: 80,
    textAlign: 'center',
  },

  // --- Voice Note WhatsApp Style Layout ---
  voiceMessageWrapper: {
    minWidth: 190,
    maxWidth: 240,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  voiceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  voicePlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  voicePlayBtnMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  voicePlayBtnThem: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  voicePlayIconText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 2,
  },
  voiceTrackContainer: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  voiceTrackLine: {
    height: 2,
    width: '100%',
    borderRadius: 1,
  },
  voiceTrackLineMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  voiceTrackLineThem: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  voiceTrackDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  voiceTrackDotMe: {
    backgroundColor: '#FFFFFF',
  },
  voiceTrackDotThem: {
    backgroundColor: '#38EF7D',
  },
  voiceBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    paddingHorizontal: 2,
  },
  voiceDurationLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  voiceMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceMetaTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  voiceMetaMe: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  voiceMetaThem: {
    color: 'rgba(255, 255, 255, 0.75)',
  },

  // --- Document & Video Message Styles ---
  documentMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 180,
  },
  documentIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FE3C72',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  documentIconText: {
    fontSize: 18,
  },
  documentTextContainer: {
    flex: 1,
  },
  documentNameText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  documentSizeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  videoMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    minWidth: 180,
  },
  videoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#20C997',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  videoIconText: {
    fontSize: 18,
  },
  videoTextContainer: {
    flex: 1,
  },
  videoNameText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  videoSizeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  chatTabContainer: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  activeChatWrapper: {
    flex: 1,
    backgroundColor: '#0B141A',
  },
  messageBubbleContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  statusTicks: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  ticksSent: {
    color: 'rgba(233, 237, 239, 0.6)',
  },
  ticksSeen: {
    color: '#53BDEB',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    alignSelf: 'flex-end',
    marginLeft: 10,
  },
  messageTimeText: {
    fontSize: 11,
    fontWeight: '400',
  },
  messageTimeTextMe: {
    color: 'rgba(233, 237, 239, 0.85)',
  },
  messageTimeTextThem: {
    color: 'rgba(233, 237, 239, 0.85)',
  },

  // --- Direct Chat Image Preview Styles ---
  transparentBubble: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageBubble: {
    padding: 3,
    minWidth: 75,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  imageBubbleMe: {
    backgroundColor: '#005C4B',
    borderTopRightRadius: 2,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  imageBubbleThem: {
    backgroundColor: '#202C33',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 12,
  },
  imageMessageContainer: {
    overflow: 'hidden',
    position: 'relative',
    maxWidth: 260,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  imageContainerMe: {
    borderTopRightRadius: 2,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  imageContainerThem: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
  imageMessage: {
    width: 240,
    height: 200,
  },
  imageMe: {
    borderTopRightRadius: 2,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  imageThem: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
  imageTimeOverlayPill: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(11, 20, 26, 0.65)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  imageTimeOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  imageTimeOverlayEditedText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    fontStyle: 'italic',
    marginRight: 3,
  },
  imageTimeOverlayTicks: {
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  imageTicksSeen: {
    color: '#53BDEB',
  },
  imageTicksSent: {
    color: '#FFFFFF',
  },
  imageTicksPending: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  waPreviewContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 6,
    minWidth: 220,
    maxWidth: 270,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  waCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    padding: 6,
    marginBottom: 6,
  },
  waThumbnailBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  waThumbnailIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  waThumbnailImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 10,
  },
  waCardContent: {
    flex: 1,
  },
  waCardTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  waCardSubTitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10,
    marginTop: 4,
  },
  waCardUrlText: {
    color: '#38EF7D',
    fontSize: 11,
    paddingHorizontal: 4,
    textDecorationLine: 'underline',
  },

  // --- Rich Media & Document Preview Styles ---
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  imageOverlayBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  documentMessageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    padding: 10,
    minWidth: 210,
    maxWidth: 260,
  },
  documentCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  documentBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  documentBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  documentActionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 8,
    marginTop: 2,
    justifyContent: 'space-between',
  },
  documentActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  documentActionText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  documentActionOpen: {
    backgroundColor: '#FE3C72',
  },
  documentActionTextOpen: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // --- Fullscreen Media & Document Viewer Modal Styles ---
  mediaViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 20, 0.95)',
  },
  mediaViewerSafeArea: {
    flex: 1,
  },
  mediaViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  mediaViewerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  mediaViewerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  mediaViewerSubTitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  mediaViewerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaViewerCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mediaViewerBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  mediaViewerFullImage: {
    width: '100%',
    height: '100%',
  },
  documentViewerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  documentViewerIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  documentViewerIconText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  documentViewerFileName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  documentViewerFileMeta: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  mediaViewerFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  mediaViewerFooterButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  mediaViewerFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  // --- WhatsApp-Style Image & Audio Viewer Styles ---
  imageViewerContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCanvas: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerControlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 34, 41, 0.94)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 8,
  },
  imageViewerControlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 3,
  },
  imageViewerControlBtnDisabled: {
    opacity: 0.35,
  },
  imageViewerScaleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 168, 132, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 168, 132, 0.5)',
    marginHorizontal: 4,
  },
  imageViewerScaleText: {
    color: '#00A884',
    fontSize: 13,
    fontWeight: '700',
  },
  imageViewerDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 6,
  },
  audioViewerContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  audioViewerCard: {
    width: '92%',
    maxWidth: 380,
    backgroundColor: '#111B21',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  audioViewerVisualizerCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(0, 168, 132, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 168, 132, 0.35)',
    marginBottom: 18,
  },
  audioViewerInnerCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(0, 168, 132, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioViewerTitle: {
    color: '#E9EDEF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    maxWidth: '92%',
  },
  audioViewerSubtitle: {
    color: '#8696A0',
    fontSize: 13,
    marginBottom: 20,
  },
  audioViewerScrubberWrapper: {
    width: '100%',
    height: 28,
    justifyContent: 'center',
    marginVertical: 4,
  },
  audioViewerTrackBar: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: '#2A3942',
    overflow: 'hidden',
  },
  audioViewerTrackFill: {
    height: '100%',
    backgroundColor: '#00A884',
    borderRadius: 3,
  },
  audioViewerThumb: {
    position: 'absolute',
    top: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#00A884',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  audioViewerTimeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  audioViewerTimeText: {
    color: '#8696A0',
    fontSize: 12,
    fontWeight: '500',
  },
  audioViewerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    width: '100%',
  },
  audioViewerPlayBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#00A884',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 22,
    shadowColor: '#00A884',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  audioViewerSecBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  audioViewerSecBtnText: {
    color: '#8696A0',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  audioViewerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '80%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 14,
  },
  audioViewerSpeedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  audioViewerSpeedText: {
    color: '#00A884',
    fontSize: 12,
    fontWeight: '700',
  },
  audioViewerRestartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioViewerMuteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // --- WhatsApp-Style Media Preview and Send Modal Styles ---
  waPreviewModalOverlay: {
    flex: 1,
    backgroundColor: '#0B141A',
  },
  waPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0B141A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  waPreviewBackBtn: {
    padding: 6,
    marginRight: 8,
  },
  waPreviewHeaderTitleContainer: {
    flex: 1,
  },
  waPreviewHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  waPreviewHeaderSubtitle: {
    color: '#8696A0',
    fontSize: 12,
    marginTop: 2,
  },
  waPreviewContentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B141A',
    paddingHorizontal: 12,
  },
  waPreviewImage: {
    width: '100%',
    height: '100%',
  },
  waPreviewVideoContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waPreviewVideoPlayer: {
    width: '100%',
    height: '100%',
  },
  waPreviewVideoBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  waPreviewVideoBadgeText: {
    color: '#E9EDEF',
    fontSize: 12,
    fontWeight: '600',
  },
  waPreviewDocCard: {
    width: '88%',
    backgroundColor: '#1F2C34',
    borderRadius: 18,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3942',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  waPreviewDocIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  waPreviewDocIconText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  waPreviewDocName: {
    color: '#E9EDEF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  waPreviewDocMeta: {
    color: '#8696A0',
    fontSize: 13,
    marginBottom: 16,
  },
  waPreviewDocPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121B22',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  waPreviewDocPillText: {
    color: '#8696A0',
    fontSize: 12,
    marginLeft: 6,
  },
  waPreviewUploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A884',
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  waPreviewUploadingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  waPreviewBottomBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0B141A',
  },
  waPreviewInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 24,
    paddingHorizontal: 14,
    minHeight: 48,
    maxHeight: 110,
    marginRight: 8,
  },
  waPreviewInput: {
    flex: 1,
    color: '#E9EDEF',
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 90,
  },
  waPreviewSendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00A884',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  candidateVideoBadgeOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  candidateVideoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  topWarningBanner: {
    backgroundColor: '#FFF1F2',
    borderBottomWidth: 1.5,
    borderBottomColor: '#FECDD3',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 99,
  },
  topWarningBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  topWarningEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  topWarningTextWrapper: {
    flex: 1,
  },
  topWarningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E11D48',
    letterSpacing: 0.2,
  },
  topWarningSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9F1239',
    marginTop: 1,
  },
  topWarningInfoBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  topWarningInfoIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  // --- WhatsApp Rich Messaging Styles ---
  pinnedBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  pinnedBannerTitle: {
    color: '#00A884',
    fontSize: 12,
    fontWeight: '700',
  },
  pinnedBannerText: {
    color: '#E9EDEF',
    fontSize: 13,
    marginTop: 1,
  },
  replyPreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2638',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyPreviewBar: {
    width: 4,
    height: '100%',
    backgroundColor: '#FE3C72',
    borderRadius: 2,
  },
  replyPreviewTitle: {
    color: '#FE3C72',
    fontSize: 12,
    fontWeight: '700',
  },
  replyPreviewText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  closeReplyBtn: {
    padding: 6,
  },
  quotedMessageCard: {
    flexDirection: 'row',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
    overflow: 'hidden',
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 160,
  },
  quotedCardMe: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  quotedCardThem: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  quotedAccentLine: {
    width: 4,
    borderRadius: 2,
    marginRight: 8,
  },
  quotedLineMe: {
    backgroundColor: '#06D755',
  },
  quotedLineThem: {
    backgroundColor: '#38BDF8',
  },
  quotedTextContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  quotedSenderName: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  quotedSenderNameMe: {
    color: '#06D755',
  },
  quotedSenderNameThem: {
    color: '#38BDF8',
  },
  quotedSnippetText: {
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
  quotedSnippetMe: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  quotedSnippetThem: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  reactionBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
    bottom: -11,
    borderWidth: 1.5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    zIndex: 10,
  },
  reactionPillMe: {
    left: 8,
    backgroundColor: '#005C4B',
    borderColor: '#0B141A',
  },
  reactionPillThem: {
    right: 8,
    backgroundColor: '#202C33',
    borderColor: '#0B141A',
  },
  reactionBadgeEmoji: {
    fontSize: 12,
    marginHorizontal: 1,
  },
  reactionBadgeCount: {
    color: '#E9EDEF',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
  },
  // --- WhatsApp-Style Reaction Details Modal Styles ---
  reactionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  reactionModalSheet: {
    backgroundColor: '#1F2C34',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
    maxHeight: '60%',
    minHeight: 220,
  },
  reactionModalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8696A0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  reactionModalTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 8,
  },
  reactionModalTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  reactionModalTabActive: {
    backgroundColor: 'rgba(0, 168, 132, 0.2)',
    borderWidth: 1,
    borderColor: '#00A884',
  },
  reactionModalTabEmoji: {
    fontSize: 16,
  },
  reactionModalTabText: {
    color: '#8696A0',
    fontSize: 13,
    fontWeight: '600',
  },
  reactionModalTabTextActive: {
    color: '#00A884',
  },
  reactionModalList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  reactionModalUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  reactionModalUserLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reactionModalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  reactionModalAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00A884',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionModalAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  reactionModalUserName: {
    color: '#E9EDEF',
    fontSize: 15,
    fontWeight: '600',
  },
  reactionModalRemoveHint: {
    color: '#8696A0',
    fontSize: 12,
    marginTop: 2,
  },
  reactionModalUserEmoji: {
    fontSize: 26,
    marginLeft: 12,
  },

  // --- WhatsApp Action Popover Modal Styles ---
  waActionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  waActionContentContainer: {
    width: '85%',
    maxWidth: 320,
    alignItems: 'flex-end',
  },
  waEmojiReactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232D36',
    borderRadius: 25,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  waEmojiBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  waEmojiText: {
    fontSize: 22,
  },
  waEmojiPlusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  waEmojiPlusText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  waMenuContainer: {
    width: 210,
    backgroundColor: '#232D36',
    borderRadius: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  waMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  waMenuIcon: {
    marginRight: 14,
  },
  waMenuText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  waMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 4,
  },

  // --- WhatsApp Delete Confirmation Modal Styles ---
  waDeleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  waDeleteModalBox: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#232D36',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 10,
  },
  waDeleteModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  waDeleteOptionBtn: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  waDeleteOptionText: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '600',
  },
  waDeleteCancelBtn: {
    paddingVertical: 12,
    marginTop: 6,
    alignItems: 'flex-end',
  },
  waDeleteCancelText: {
    color: '#FE3C72',
    fontSize: 15,
    fontWeight: '700',
  },
  waInfoModalBox: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#232D36',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  waInfoLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  waInfoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  waForwardModalBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#232D36',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  waForwardUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  waForwardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#334155',
  },
  waForwardUserName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  waModalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  waModalOptionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  waContextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  waContextMenuText: {
    color: '#E9EDEF',
    fontSize: 15,
    fontWeight: '400',
  },
});
