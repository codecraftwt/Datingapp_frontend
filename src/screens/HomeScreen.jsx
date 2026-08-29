import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
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
import Video from 'react-native-video';
import { useDispatch, useSelector } from 'react-redux';
import { apiClient } from '../api/apiClient';
import { BASE_URL, getBaseUrl, getImageUrl as formatConfigUrl, isVideoUrl, getVideoThumbnailUrl } from '../api/config';
import { selectCurrentUser } from '../redux/slices/authSlice';
import {
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
  setTyping,
} from '../redux/slices/chatSlice';
import io from 'socket.io-client';
import { createSound } from 'react-native-nitro-sound';
import soundService from '../services/soundService';
import { registerFcmToken } from '../services/notificationService';
import { WarningModal } from '../components/WarningModal';

const MOCK_STICKERS = [
  { id: 'heart', char: '❤️', label: 'Heart' },
  { id: 'thumbs_up', char: '👍', label: 'Thumbs Up' },
  { id: 'fire', char: '🔥', label: 'Fire' },
  { id: 'lol', char: '😂', label: 'LOL' },
  { id: 'cry', char: '😢', label: 'Cry' },
  { id: 'celebrate', char: '🎉', label: 'Celebrate' },
  { id: 'cool', char: '😎', label: 'Cool' },
  { id: 'wink', char: '😉', label: 'Wink' },
  { id: 'wow', char: '😮', label: 'Wow' },
  { id: 'blow_kiss', char: '😘', label: 'Kiss' },
  { id: 'star_eyes', char: '🤩', label: 'Star' },
  { id: 'mind_blown', char: '🤯', label: 'Explode' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getImageUrl = (url) => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return '';
  }
  return formatConfigUrl(url);
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
  if (!filename) return '📄 PDF';
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄 PDF';
  if (ext === 'doc' || ext === 'docx') return '📝 DOC';
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return '📊 XLS';
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') return '🖼️ IMG';
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return '📁 ZIP';
  if (ext === 'txt') return '📜 TXT';
  return '📄 FILE';
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

export const HomeScreen = ({ userProfile, onUpdateProfile, onLogout, onRemoveProfile, onNavigate, onGoBack }) => {
  const insets = useSafeAreaInsets();
  const safeBottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8);
  const safeTopPadding = Math.max(insets.top, Platform.OS === 'ios' ? 40 : 25);

  const dispatch = useDispatch();
  const reduxUser = useSelector(selectCurrentUser);
  const currentUser = reduxUser || userProfile;

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

  const fetchMessages = async () => {
    try {
      setIsMessagesLoading(true);
      const res = await apiClient.getMessages();
      dispatch(setAllMessages(res || []));
    } catch (err) {
      console.log('Error fetching messages:', err);
    } finally {
      setIsMessagesLoading(false);
    }
  };

  const [unreadLikesCount, setUnreadLikesCount] = useState(0);
  const [selectedLikesProfile, setSelectedLikesProfile] = useState(null);
  const [likesActivePhotoIndex, setLikesActivePhotoIndex] = useState(0);
  const [likesPreviewStoryIndex, setLikesPreviewStoryIndex] = useState(null);
  const [viewMediaModal, setViewMediaModal] = useState({ visible: false, type: 'image', url: '', fileName: '', fileSize: 0 });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const chatScrollViewRef = useRef(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const height = e.endCoordinates ? e.endCoordinates.height : 250;
        setKeyboardHeight(height);
        setTimeout(() => {
          chatScrollViewRef.current?.scrollToEnd({ animated: true });
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

  const fetchUnreadLikesCount = async () => {
    try {
      const res = await apiClient.getUnreadNotifications();
      if (res && Array.isArray(res.notifications)) {
        const likeNotifs = res.notifications.filter((n) => (n.type === 'like' || n.type === 'superlike') && !n.isRead);
        setUnreadLikesCount(likeNotifs.length);
      }
    } catch (err) {
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

  // Run fetches on mount and when currentUser is available
  useEffect(() => {
    fetchQuestionnaires();
    fetchMessages();
    fetchLikes();
    fetchUnreadLikesCount();
    fetchMatchesList();
    fetchSwipedIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const uId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();
    if (uId) {
      fetchMessages();
      fetchUnreadLikesCount();
      fetchMatchesList();
      fetchLikes();
    }
  }, [currentUser?.id, currentUser?._id, userProfile?.id, userProfile?._id]);

  useEffect(() => {
    const badgeSyncInterval = setInterval(() => {
      try { fetchUnreadLikesCount(); } catch (e) {}
      try { fetchMessages(); } catch (e) {}
    }, 4000);
    return () => clearInterval(badgeSyncInterval);
  }, []);

  const refetch = fetchQuestionnaires;
  const refetchMessages = fetchMessages;
  const refetchLikes = fetchLikes;
  const refetchMatchesList = fetchMatchesList;
  const refetchSwipedIds = fetchSwipedIds;

  const questionnairesData = useMemo(() => ({ users: otherProfiles }), [otherProfiles]);
  const messagesData = allMessages;
  const likesData = useMemo(() => ({ users: likes }), [likes]);
  const matchesData = useMemo(() => ({ matches: matches }), [matches]);
  const swipedIdsData = swipedIds;

  console.log('--- HomeScreen Swipe Stack Debug ---');
  console.log('Logged-in user (currentUser):', JSON.stringify(currentUser));
  console.log('All Users from API:', JSON.stringify(questionnairesData?.users?.map(u => ({ id: u.id, name: u.name }))));

  const swipedIdsList = swipedIdsData || [];

  const MOCK_MATCHES = (questionnairesData?.users || []).filter(
    (u) =>
      u.id !== currentUser?.id &&
      u.id !== currentUser?._id &&
      u.email !== currentUser?.email &&
      !swipedIdsList.includes(u.id) &&
      !swipedIdsList.includes(u._id)
  );

  console.log('Filtered Swipe Cards (MOCK_MATCHES):', JSON.stringify(MOCK_MATCHES.map(u => ({ id: u.id, name: u.name }))));

  const [activeTab, setActiveTab] = useState('swipe'); // swipe, likes, chat, profile
  const [unreadChatPushCount, setUnreadChatPushCount] = useState(0);

  // Android / Emulator Hardware Back Button Handler for HomeScreen Tabs, Modals, and Active Chat
  useEffect(() => {
    const onHardwareBackPress = () => {
      // 1. Close active media preview modal if open
      if (viewMediaModal && viewMediaModal.visible) {
        setViewMediaModal({ visible: false, type: 'image', url: '', fileName: '', fileSize: 0 });
        return true;
      }

      // 2. Close active chat conversation view if open
      if (activeChat) {
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
  }, [activeTab, activeChat, viewMediaModal, onGoBack]);

  useEffect(() => {
    if (activeTab === 'likes') {
      fetchLikes();
      setUnreadLikesCount(0);
      if (typeof apiClient.markLikesAsRead === 'function') {
        apiClient.markLikesAsRead().catch(() => {});
      }
    } else if (activeTab === 'chat') {
      fetchMatchesList();
      fetchMessages();
      setUnreadChatPushCount(0);
      if (typeof apiClient.markMatchesAsRead === 'function') {
        apiClient.markMatchesAsRead().catch(() => {});
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
  const [typedMessage, setTypedMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [onlineUsersMap, setOnlineUsersMap] = useState({});
  const [lastSeenMap, setLastSeenMap] = useState({});
  const [offlineQueue, setOfflineQueue] = useState([]);
  const offlineQueueRef = useRef([]);
  useEffect(() => {
    offlineQueueRef.current = offlineQueue;
  }, [offlineQueue]);

  const [editingMessage, setEditingMessage] = useState(null);
  const [showChatOptionsMenuModal, setShowChatOptionsMenuModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetUser, setReportTargetUser] = useState(null);
  const [selectedReportReason, setSelectedReportReason] = useState('Inappropriate Photos or Content');
  const [reportDetails, setReportDetails] = useState('');
  const [alsoBlockOnReport, setAlsoBlockOnReport] = useState(false);
  // Admin Warning Modal States
  const [activeWarningData, setActiveWarningData] = useState(null);
  const [showAdminWarningModal, setShowAdminWarningModal] = useState(false);
  const [warningAckLoading, setWarningAckLoading] = useState(false);

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

  const handleTabPress = (tabName) => {
    if (activeWarningData && !activeWarningData.isAcknowledged) {
      setShowAdminWarningModal(true);
      return;
    }
    setActiveTab(tabName);
    if (tabName !== 'chat') {
      setActiveChat(null);
    }
  };

  useEffect(() => {
    if (currentUser && (currentUser.id || currentUser._id)) {
      checkActiveWarning();
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
        } catch (_) {}
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
      dispatch(setMessages(res || []));
    } catch (err) {
      console.log('Error fetching chat messages:', err);
    }
  };

  useEffect(() => {
    fetchChatMessages();
    let pollInterval;
    const partnerId = (activeChat?.id || activeChat?._id || activeChat?.userId)?.toString();
    if (partnerId) {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('check_online_status', { targetUserId: partnerId });
      }
      pollInterval = setInterval(() => {
        fetchChatMessages();
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('check_online_status', { targetUserId: partnerId });
        }
      }, 3000);
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
  const socketUrl = getBaseUrl();
  const handleIncomingMessageRef = useRef(null);

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
      const currentId = currentUser.id || currentUser._id;
      socketRef.current.emit('stop_typing', { senderId: currentId, receiverId: activeChat.id });
    }
    isCurrentlyTypingRef.current = false;
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  // Edit Profile States
  const [matchedUserIds, setMatchedUserIds] = useState([]);
  const [likesList, setLikesList] = useState([]);
  const [showActiveCardDetails, setShowActiveCardDetails] = useState(false);
  const [candidateStoryIndex, setCandidateStoryIndex] = useState(null);

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
      setSwipeHistory((prev) => [...prev, { candidate, action: 'like' }]);

      try {
        const result = await apiClient.likeUser({ likedId: targetId });

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
            `You liked ${candidate.name}! If they like you back, it's a match!`,
            [{ text: 'OK' }]
          );
        }
      } catch (err) {
        console.error('Error saving like to backend:', err);
      }

      setSwipeIndex(swipeIndex + 1);
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

      if (result.isMatch || result.message.includes('match') || result.message.includes('Match')) {
        setMatchedUser(user);
        setShowMatchPopup(true);
      }

      refetchMatchesList();
      refetchLikes();
      refetchSwipedIds();
    } catch (err) {
      console.error('Error matching from Likes tab:', err);
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
    const sId = msg.senderId.toString();
    const rId = msg.receiverId.toString();
    const currentId = (currentUser?.id || currentUser?._id)?.toString();
    if (!currentId) return;
    const otherId = sId === currentId ? rId : sId;
    const isMe = sId === currentId;

    const formattedMsg = {
      id: msg._id || String(Date.now() + Math.random()),
      sender: isMe ? 'you' : 'them',
      text: msg.text,
      messageType: msg.messageType || 'text',
      mediaUrl: msg.mediaUrl,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      stickerId: msg.stickerId,
      status: msg.status || 'sent',
      createdAt: msg.createdAt,
    };

    setChats((prevChats) => {
      let chatExists = false;
      const updated = prevChats.map((c) => {
        if (c.id === otherId) {
          chatExists = true;
          if (c.messages.some((m) => m.id === formattedMsg.id)) {
            return c;
          }
          return {
            ...c,
            messages: [...c.messages, formattedMsg],
          };
        }
        return c;
      });

      if (!chatExists) {
        const otherUser = questionnairesData?.users?.find(
          (u) => u.id.toString() === otherId
        );
        if (otherUser) {
          updated.push({
            id: otherId,
            name: otherUser.name,
            image: otherUser.image,
            messages: [formattedMsg],
          });
        }
      }
      return updated;
    });

    setActiveChat((prevActiveChat) => {
      if (prevActiveChat && prevActiveChat.id === otherId) {
        if (prevActiveChat.messages.some((m) => m.id === formattedMsg.id)) {
          return prevActiveChat;
        }
        return {
          ...prevActiveChat,
          messages: [...prevActiveChat.messages, formattedMsg],
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
      console.log('Connecting to Socket.IO at:', socketUrl);
      socketRef.current = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000,
        timeout: 30000,
        pingTimeout: 30000,
        pingInterval: 25000,
        autoConnect: true,
      });

      socketRef.current.on('connect', () => {
        console.log('🟢 [FRONTEND SOCKET CONNECT] Connected to:', socketUrl, '| Emitting join & ping_presence for currentId:', currentId);
        socketRef.current.emit('join', currentId);
        socketRef.current.emit('ping_presence', currentId);

        // Flush offline queue on reconnection
        const currentQueue = offlineQueueRef.current;
        if (currentQueue && currentQueue.length > 0) {
          console.log(`Reconnected! Flushing ${currentQueue.length} offline messages...`);
          currentQueue.forEach((item) => {
            socketRef.current.emit('send_message', item.payload);
          });
        }
      });

      socketRef.current.on('connect_error', (err) => {
        console.warn('⚠️ [FRONTEND SOCKET CONNECT_ERROR] Connection error to', socketUrl, ':', err.message);
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
        console.log(`Socket.IO user_status: ${userId} is ${status}, lastSeen: ${lastSeen}`);
        setOnlineUsersMap((prev) => ({
          ...prev,
          [userId.toString()]: status === 'online',
        }));
        if (status === 'offline' && lastSeen) {
          setLastSeenMap((prev) => ({
            ...prev,
            [userId.toString()]: lastSeen,
          }));
        }
      });

      socketRef.current.on('online_status_response', ({ targetUserId, isOnline, lastSeen }) => {
        console.log(`Socket.IO online_status_response: targetUserId=${targetUserId}, isOnline=${isOnline}, lastSeen=${lastSeen}`);
        if (targetUserId) {
          setOnlineUsersMap((prev) => ({
            ...prev,
            [targetUserId.toString()]: !!isOnline,
          }));
          if (lastSeen) {
            setLastSeenMap((prev) => ({
              ...prev,
              [targetUserId.toString()]: lastSeen,
            }));
          }
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

      socketRef.current.on('receive_message', (msg) => {
        console.log('Socket.IO received message:', msg);

        const senderIdStr = (msg.senderId || msg.sender)?.toString();
        const activePartnerId = (activeChatRef.current?.id || activeChatRef.current?._id || activeChatRef.current?.userId)?.toString();
        const isCurrentlyViewingChat = activePartnerId && activePartnerId === senderIdStr;

        const formattedMsg = {
          id: (msg._id || msg.id || Date.now()).toString(),
          sender: 'them',
          text: msg.text || '',
          time: new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          messageType: msg.messageType || 'text',
          mediaUrl: msg.mediaUrl,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          stickerId: msg.stickerId,
          status: isCurrentlyViewingChat ? 'seen' : (msg.status || 'delivered'),
          createdAt: msg.createdAt || new Date().toISOString(),
        };

        // 1. Instantly update activeChat state if user is currently chatting with sender
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          const activeId = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
          if (activeId === senderIdStr) {
            const existingMsgs = prevActive.messages || [];
            if (existingMsgs.some((m) => (m.id || m._id)?.toString() === formattedMsg.id)) {
              return prevActive;
            }
            return {
              ...prevActive,
              messages: [...existingMsgs, formattedMsg],
            };
          }
          return prevActive;
        });

        // 2. Instantly update chats list state
        setChats((prevChats) => {
          if (!Array.isArray(prevChats)) return prevChats;
          const existsInChats = prevChats.some((c) => (c.id || c._id || c.userId)?.toString() === senderIdStr);
          if (!existsInChats) {
            const newChat = {
              id: senderIdStr,
              name: msg.senderName || 'Matched User',
              image: msg.senderImage || null,
              lastMessage: formattedMsg.text || 'Message',
              lastMessageTime: formattedMsg.time,
              messages: [formattedMsg],
            };
            return [newChat, ...prevChats];
          }
          return prevChats.map((c) => {
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
        });

        if (handleIncomingMessageRef.current) {
          try { handleIncomingMessageRef.current(msg); } catch (e) { console.log('Error handling incoming msg:', e); }
        }

        try {
          fetchMessages();
        } catch (e) {}

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
          let bodyText = msg.text || '💬 Sent a message';
          if (msg.messageType === 'image') bodyText = '📷 Sent a photo';
          else if (msg.messageType === 'video') bodyText = '🎬 Sent a video';
          else if (msg.messageType === 'voice') bodyText = '🎤 Sent a voice message';
          else if (msg.messageType === 'sticker') bodyText = '😊 Sent a sticker';
          else if (msg.messageType === 'document') bodyText = '📄 Sent a document';

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
        try { if (typeof refetchMatchesList === 'function') refetchMatchesList(); } catch (e) {}
        try { if (typeof refetchLikes === 'function') refetchLikes(); } catch (e) {}
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
            }).catch(() => {});
          }
        }
      });

      socketRef.current.on('new_like', (data) => {
        console.log('Socket.IO received new_like event:', data);
        try { if (typeof refetchLikes === 'function') refetchLikes(); } catch (e) {}
        try { if (typeof fetchUnreadLikesCount === 'function') fetchUnreadLikesCount(); } catch (e) {}
        setUnreadLikesCount((prev) => prev + 1);
        if (data?.title && data?.body) {
          if (typeof displayLocalSystemNotification === 'function') {
            displayLocalSystemNotification({
              title: data.title,
              body: data.body,
              data: { type: 'like', userId: data.likerUser?.id || data.likerUser?._id },
            }).catch(() => {});
          }
        }
      });

      socketRef.current.on('message_sent', (msg) => {
        console.log('Socket.IO message sent confirmation:', msg);
        if (msg.tempId) {
          const actualMsg = {
            id: msg._id,
            sender: 'you',
            text: msg.text,
            messageType: msg.messageType || 'text',
            mediaUrl: msg.mediaUrl,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            stickerId: msg.stickerId,
            status: msg.status || 'sent',
            createdAt: msg.createdAt,
          };
          const otherId = msg.receiverId.toString();

          setChats((prevChats) =>
            prevChats.map((c) => {
              const cIdStr = (c.id || c._id || c.userId)?.toString();
              if (cIdStr === otherId) {
                return {
                  ...c,
                  messages: (c.messages || []).map((m) =>
                    m.id === msg.tempId ? actualMsg : m
                  ),
                };
              }
              return c;
            })
          );
          setActiveChat((prevActive) => {
            if (!prevActive) return prevActive;
            const activeIdStr = (prevActive.id || prevActive._id || prevActive.userId)?.toString();
            if (activeIdStr === otherId) {
              return {
                ...prevActive,
                messages: (prevActive.messages || []).map((m) =>
                  m.id === msg.tempId ? actualMsg : m
                ),
              };
            }
            return prevActive;
          });
          setOfflineQueue((prev) => prev.filter((item) => item.tempId !== msg.tempId));
        }
      });

      socketRef.current.on('message_delivered', ({ messageId, tempId, receiverId, status }) => {
        console.log('Socket.IO message_delivered event received:', messageId, status);
        const newStatus = status || 'delivered';
        const rIdStr = receiverId?.toString();
        setChats((prevChats) =>
          prevChats.map((c) => {
            if (!rIdStr || c.id === rIdStr) {
              return {
                ...c,
                messages: (c.messages || []).map((m) =>
                  m.id === messageId || (tempId && m.id === tempId) ? { ...m, status: newStatus } : m
                ),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          const activeId = (prevActive.id || prevActive._id)?.toString();
          if (!rIdStr || activeId === rIdStr) {
            return {
              ...prevActive,
              messages: (prevActive.messages || []).map((m) =>
                m.id === messageId || (tempId && m.id === tempId) ? { ...m, status: newStatus } : m
              ),
            };
          }
          return prevActive;
        });
      });

      socketRef.current.on('messages_seen', ({ senderId, receiverId, status }) => {
        console.log('Socket.IO messages_seen event received for sender/receiver:', senderId, receiverId);
        const sIdStr = senderId?.toString();
        const rIdStr = receiverId?.toString();
        setChats((prevChats) =>
          prevChats.map((c) => {
            const partnerId = c.id?.toString();
            if (!rIdStr || partnerId === rIdStr || partnerId === sIdStr) {
              return {
                ...c,
                messages: (c.messages || []).map((m) => (m.sender === 'you' ? { ...m, status: 'seen' } : m)),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (!prevActive) return prevActive;
          const activeId = (prevActive.id || prevActive._id)?.toString();
          if (!rIdStr || activeId === rIdStr || activeId === sIdStr) {
            return {
              ...prevActive,
              messages: (prevActive.messages || []).map((m) => (m.sender === 'you' ? { ...m, status: 'seen' } : m)),
            };
          }
          return prevActive;
        });
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

      socketRef.current.on('message_deleted', ({ messageId, senderId, receiverId }) => {
        console.log('Socket.IO message deleted:', messageId);
        setChats((prevChats) =>
          prevChats.map((c) => {
            if (c.id === senderId || c.id === receiverId) {
              return {
                ...c,
                messages: c.messages.filter((m) => m.id !== messageId),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (prevActive && (prevActive.id === senderId || prevActive.id === receiverId)) {
            return {
              ...prevActive,
              messages: prevActive.messages.filter((m) => m.id !== messageId),
            };
          }
          return prevActive;
        });
        refetchChatMessages();
      });

      socketRef.current.on('user_typing', ({ senderId }) => {
        console.log('Socket.IO user_typing received:', senderId);
        setActiveChat((prevActive) => {
          if (prevActive && prevActive.id.toString() === senderId.toString()) {
            setIsTyping(true);
          }
          return prevActive;
        });
      });

      socketRef.current.on('user_stop_typing', ({ senderId }) => {
        console.log('Socket.IO user_stop_typing received:', senderId);
        setActiveChat((prevActive) => {
          if (prevActive && prevActive.id.toString() === senderId.toString()) {
            setIsTyping(false);
          }
          return prevActive;
        });
      });

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

      socketRef.current.on('disconnect', () => {
        console.log('Socket.IO disconnected');
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

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

      const checkStatus = () => {
        if (socketRef.current && socketRef.current.connected) {
          if (partnerId) socketRef.current.emit('check_online_status', { targetUserId: partnerId });
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
        apiClient.getChatMessages(partnerId).catch(() => {});
      }

      // Periodically refresh partner's online status every 5 seconds while chatting
      intervalId = setInterval(checkStatus, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeChat, currentUser]);

  // AppState change listener & global presence ping: reconnect socket & re-emit join on foreground, going_offline on background
  useEffect(() => {
    const currentId = (currentUser?.id || currentUser?._id)?.toString();

    if (currentId) {
      registerFcmToken().catch((e) => console.log('[HomeScreen] FCM token registration error:', e));
    }

    let pingInterval;
    if (currentId) {
      pingInterval = setInterval(() => {
        if (AppState.currentState === 'active' && socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('ping_presence', currentId);
        }
      }, 15000);
    }

    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && currentId) {
        // Instantly refresh badge counts on app active
        try { fetchUnreadLikesCount(); } catch (e) {}
        try { fetchLikes(); } catch (e) {}
        try { fetchMessages(); } catch (e) {}
        try { fetchMatchesList(); } catch (e) {}
        try { checkActiveWarning(); } catch (e) {}

        if (socketRef.current) {
          if (!socketRef.current.connected) {
            console.log('[AppState] Socket disconnected. Reconnecting...');
            socketRef.current.connect();
          } else {
            console.log('[AppState] App in foreground. Re-emitting join and ping_presence for user:', currentId);
            socketRef.current.emit('join', currentId);
            socketRef.current.emit('ping_presence', currentId);
          }
        }
        if (activeChat && socketRef.current) {
          const partnerId = (activeChat.id || activeChat._id || activeChat.userId)?.toString();
          if (partnerId && socketRef.current.connected) {
            socketRef.current.emit('check_online_status', { targetUserId: partnerId });
          }
        }
      } else if ((nextAppState === 'background' || nextAppState === 'inactive') && currentId) {
        if (socketRef.current) {
          console.log('[AppState] App in background/inactive. Emitting going_offline and disconnecting synchronously for user:', currentId);
          try { socketRef.current.emit('going_offline', currentId); } catch (e) {}
          try { socketRef.current.disconnect(); } catch (e) {}
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
  }, [currentUser, activeChat]);

  // NetInfo network & Wi-Fi connectivity listener for strict online/offline status
  useEffect(() => {
    const currentId = (currentUser?.id || currentUser?._id || userProfile?.id || userProfile?._id)?.toString();

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const hasNetwork = !!(state.isConnected && state.isInternetReachable !== false);
      console.log(`[NetInfo] Connectivity state change: isConnected=${state.isConnected}, isInternetReachable=${state.isInternetReachable}`);

      if (!hasNetwork) {
        console.log('[NetInfo] Network/Wi-Fi disconnected. Disconnecting socket and going offline...');
        if (socketRef.current) {
          try { if (currentId) socketRef.current.emit('going_offline', currentId); } catch (e) {}
          try { socketRef.current.disconnect(); } catch (e) {}
        }
      } else {
        console.log('[NetInfo] Network/Wi-Fi connected.');
        if (AppState.currentState === 'active' && currentId && socketRef.current) {
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
  }, [currentUser, userProfile]);

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
            try { fetchLikes(); } catch (e) {}
            try { fetchUnreadLikesCount(); } catch (e) {}
          }

          if (isChatNotif) {
            console.log('[HomeScreen] Real-time Push Notification: Updating Chat tab badge & active conversation messages instantly!');
            setUnreadChatPushCount((prev) => prev + 1);
            try { fetchMessages(); } catch (e) {}
            try { fetchMatchesList(); } catch (e) {}
            
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

            try { fetchMessages(); } catch (e) {}
            try { fetchMatchesList(); } catch (e) {}

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

    setOnlineUsersMap((prev) => ({ ...initialOnlineMap, ...prev }));
    setLastSeenMap((prev) => ({ ...initialLastSeenMap, ...prev }));

    const messagesByOtherUser = {};
    messagesData.forEach((msg) => {
      const sId = msg.senderId.toString();
      const rId = msg.receiverId.toString();
      const otherId = sId === currentId ? rId : sId;

      if (!messagesByOtherUser[otherId]) {
        messagesByOtherUser[otherId] = [];
      }
      messagesByOtherUser[otherId].push({
        id: msg._id,
        sender: sId === currentId ? 'you' : 'them',
        text: msg.text,
        messageType: msg.messageType || 'text',
        mediaUrl: msg.mediaUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        stickerId: msg.stickerId,
        status: msg.status || 'sent',
        createdAt: msg.createdAt,
        isEdited: msg.isEdited || false,
      });
    });

    const chatsList = [];
    Object.keys(messagesByOtherUser).forEach((otherId) => {
      const otherUser = otherUsersMap.get(otherId) || { id: otherId, name: 'Matched User', image: null };
      chatsList.push({
        id: otherId,
        name: otherUser.name || otherUser.firstName || 'Matched User',
        image: otherUser.image || otherUser.profileImage,
        lastSeen: otherUser.lastSeen,
        messages: messagesByOtherUser[otherId],
      });
    });

    // Add matches that have no chat history yet
    matchedUserIds.forEach((mId) => {
      const matchedUserStr = mId.toString();
      if (!messagesByOtherUser[matchedUserStr]) {
        const otherUser = otherUsersMap.get(matchedUserStr) || { id: matchedUserStr, name: 'Matched User', image: null };
        chatsList.push({
          id: matchedUserStr,
          name: otherUser.name || otherUser.firstName || 'Matched User',
          image: otherUser.image || otherUser.profileImage,
          lastSeen: otherUser.lastSeen,
          messages: [
            {
              id: 'match-init',
              sender: 'them',
              text: `It's a Match! Say hi to ${otherUser.name || otherUser.firstName || 'Matched User'}! 👋`,
            },
          ],
        });
      }
    });

    setChats(chatsList);

    // Keep activeChat updated if open
    setActiveChat((prevActiveChat) => {
      if (prevActiveChat) {
        const found = chatsList.find((c) => c.id === prevActiveChat.id);
        if (found) {
          const extraMsgs = (prevActiveChat.messages || []).filter(
            (m) => !found.messages.some((f) => String(f.id) === String(m.id))
          );
          return {
            ...found,
            messages: [...found.messages, ...extraMsgs],
          };
        }
      }
      return prevActiveChat;
    });
  }, [messagesData, questionnairesData, matches, currentUser, matchedUserIds]);

  // Sync individual chat messages query data into local chats and activeChat states
  useEffect(() => {
    if (!chatMessagesData || !activeChat || !currentUser) return;

    const currentId = (currentUser.id || currentUser._id)?.toString();

    // Map DB messages to UI message structure
    const formatted = chatMessagesData.map((msg) => ({
      id: msg._id,
      sender: msg.senderId.toString() === currentId ? 'you' : 'them',
      text: msg.text,
      messageType: msg.messageType || 'text',
      mediaUrl: msg.mediaUrl,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      stickerId: msg.stickerId,
      status: msg.status || 'sent',
      createdAt: msg.createdAt,
      isEdited: msg.isEdited || false,
    }));

    // Maintain any active temp messages & real-time received messages
    setActiveChat((prev) => {
      if (prev && prev.id === activeChat.id) {
        const extraMsgs = (prev.messages || []).filter(
          (m) => String(m.id).startsWith('temp-') || !formatted.some((f) => String(f.id) === String(m.id))
        );
        if (formatted.length === 0 && prev.messages.some(m => m.id === 'match-init')) {
          return prev;
        }
        return {
          ...prev,
          messages: [...formatted, ...extraMsgs],
        };
      }
      return prev;
    });

    setChats((prevChats) =>
      prevChats.map((c) => {
        if (c.id === activeChat.id) {
          const extraMsgs = (c.messages || []).filter(
            (m) => String(m.id).startsWith('temp-') || !formatted.some((f) => String(f.id) === String(m.id))
          );
          if (formatted.length === 0 && c.messages.some(m => m.id === 'match-init')) {
            return c;
          }
          return {
            ...c,
            messages: [...formatted, ...extraMsgs],
          };
        }
        return c;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessagesData, currentUser]);

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

    const exists = chats.some((c) => c.id === candidateId);
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
      setActiveChat(newChat);
    } else {
      const foundChat = chats.find((c) => c.id === candidateId);
      setActiveChat(foundChat);
    }
    setShowMatchPopup(false);
    setActiveTab('chat');
  };

  const handleInputChange = (text) => {
    setTypedMessage(text);
    if (showStickerPicker) setShowStickerPicker(false);

    if (!socketRef.current || !currentUser || !activeChat) return;

    const currentId = currentUser.id || currentUser._id;
    const receiverId = activeChat.id;

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
        if (socketRef.current && activeChat) {
          socketRef.current.emit('stop_typing', { senderId: currentId, receiverId });
        }
        isCurrentlyTypingRef.current = false;
      }, 2000);
    }
  };

  const handleSendMessage = async (customPayload = null) => {
    if (!activeChat || !currentUser) return;

    const currentId = currentUser.id || currentUser._id;
    const receiverId = activeChat.id;

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
      const textToEdit = typedMessage.trim();
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
          if (prevActive && prevActive.id === receiverId) {
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
        setTypedMessage('');
        refetchChatMessages();
      } catch (err) {
        console.error('Failed to edit message:', err);
        Alert.alert('Error', 'Failed to edit message.');
      }
      return;
    }

    const tempId = 'temp-' + Date.now() + Math.random();

    let payload = {
      senderId: currentId,
      receiverId: receiverId,
      tempId: tempId,
    };

    if (customPayload) {
      payload = { ...payload, ...customPayload };
    } else {
      if (!typedMessage.trim()) return;
      payload.text = typedMessage.trim();
      payload.messageType = 'text';
    }

    const localMsg = {
      id: tempId,
      sender: 'you',
      text: payload.text,
      messageType: payload.messageType || 'text',
      mediaUrl: payload.mediaUrl,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      stickerId: payload.stickerId,
      status: 'sending',
      createdAt: new Date().toISOString(),
    };

    const isIdMatch = (obj, targetId) => {
      if (!obj || !targetId) return false;
      const targetStr = targetId.toString();
      const objIdStr = (obj.id || obj._id || obj.userId)?.toString();
      return objIdStr === targetStr;
    };

    setChats((prevChats) =>
      prevChats.map((c) => {
        if (isIdMatch(c, receiverId)) {
          return {
            ...c,
            messages: [...(c.messages || []), localMsg],
          };
        }
        return c;
      })
    );
    setActiveChat((prevActive) => {
      if (isIdMatch(prevActive, receiverId)) {
        return {
          ...prevActive,
          messages: [...(prevActive.messages || []), localMsg],
        };
      }
      return prevActive;
    });

    if (!customPayload) {
      setTypedMessage('');
    }

    let hasConfirmed = false;
    const handleServerConfirmation = (serverMsg) => {
      if (!serverMsg || hasConfirmed) return;
      hasConfirmed = true;
      const actualMsg = {
        id: serverMsg._id || serverMsg.id,
        sender: 'you',
        text: serverMsg.text,
        messageType: serverMsg.messageType || 'text',
        mediaUrl: serverMsg.mediaUrl,
        fileName: serverMsg.fileName,
        fileSize: serverMsg.fileSize,
        stickerId: serverMsg.stickerId,
        status: serverMsg.status || 'sent',
        createdAt: serverMsg.createdAt || new Date().toISOString(),
      };
      setChats((prevChats) =>
        prevChats.map((c) => {
          if (isIdMatch(c, receiverId)) {
            return {
              ...c,
              messages: (c.messages || []).map((m) => (m.id === tempId ? actualMsg : m)),
            };
          }
          return c;
        })
      );
      setActiveChat((prevActive) => {
        if (isIdMatch(prevActive, receiverId)) {
          return {
            ...prevActive,
            messages: (prevActive.messages || []).map((m) => (m.id === tempId ? actualMsg : m)),
          };
        }
        return prevActive;
      });
      setOfflineQueue((prev) => prev.filter((item) => item.tempId !== tempId));
    };

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send_message', payload, (res) => {
        if (res && res.status === 'ok' && res.data) {
          handleServerConfirmation(res.data);
        }
      });

      // 2.5s Fallback timer if socket confirmation lags or drops
      setTimeout(() => {
        if (!hasConfirmed) {
          console.log('Socket confirmation delayed, triggering REST API sync fallback for tempId:', tempId);
          apiClient.sendMessage(payload).then((res) => {
            if (res?.data?._id) {
              handleServerConfirmation(res.data);
            }
          }).catch((err) => {
            console.error('REST API sendMessage fallback error:', err);
          });
        }
      }, 2500);
    } else {
      console.log('Socket offline: Sending message via REST API Fallback:', payload);
      apiClient.sendMessage(payload).then((res) => {
        if (res?.data?._id) {
          handleServerConfirmation(res.data);
        }
      }).catch((err) => {
        console.error('REST API sendMessage error:', err);
        setOfflineQueue((prev) => [...prev, { tempId, payload }]);
      });
    }
  };

  const handleMessageLongPress = (msg) => {
    if (!msg || msg.id === 'match-init') return;

    const isMyMessage = msg.sender === 'you';
    const options = [];

    if (isMyMessage && (msg.messageType === 'text' || (!msg.messageType && msg.text && !msg.mediaUrl))) {
      options.push({
        text: 'Edit Message',
        onPress: () => {
          setEditingMessage(msg);
          setTypedMessage(msg.text || '');
        },
      });
    }

    options.push({
      text: 'Delete Message',
      style: 'destructive',
      onPress: () => {
        Alert.alert(
          'Delete Message',
          `Are you sure you want to delete this ${msg.fileName ? 'document' : (msg.messageType || 'message')}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  if (msg.id && !msg.id.toString().startsWith('temp-')) {
                    await apiClient.deleteMessage(msg.id);
                  }
                  console.log('Message deleted successfully:', msg.id);
                  const receiverId = activeChat.id;
                  setChats((prevChats) =>
                    prevChats.map((c) => {
                      if (c.id === receiverId) {
                        return {
                          ...c,
                          messages: c.messages.filter((m) => m.id !== msg.id),
                        };
                      }
                      return c;
                    })
                  );
                  setActiveChat((prevActive) => {
                    if (prevActive && prevActive.id === receiverId) {
                      return {
                        ...prevActive,
                        messages: prevActive.messages.filter((m) => m.id !== msg.id),
                      };
                    }
                    return prevActive;
                  });
                  refetchChatMessages();
                } catch (err) {
                  console.error('Failed to delete message:', err);
                  Alert.alert('Error', 'Failed to delete message.');
                }
              },
            },
          ]
        );
      },
    });

    options.push({
      text: 'Cancel',
      style: 'cancel',
    });

    Alert.alert(
      msg.fileName ? `Document Options` : 'Message Options',
      msg.fileName ? `${msg.fileName}` : 'Choose an action:',
      options,
      { cancelable: true }
    );
  };

  const handleClearChat = () => {
    if (!activeChat) return;

    Alert.alert(
      'Clear Chat',
      `Are you sure you want to clear all messages in your chat with ${activeChat.name}? This will only delete it for you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const selectedUserId = activeChat.id;
              await apiClient.clearChat(selectedUserId);
              console.log('Chat cleared successfully for user:', selectedUserId);

              // Update local state
              setChats((prevChats) =>
                prevChats.map((c) => {
                  if (c.id === selectedUserId) {
                    return {
                      ...c,
                      messages: [
                        {
                          id: 'match-init',
                          sender: 'them',
                          text: `It's a Match! Say hi to ${c.name}! 👋`,
                        },
                      ],
                    };
                  }
                  return c;
                })
              );

              setActiveChat((prevActive) => {
                if (prevActive && prevActive.id === selectedUserId) {
                  return {
                    ...prevActive,
                    messages: [
                      {
                        id: 'match-init',
                        sender: 'them',
                        text: `It's a Match! Say hi to ${prevActive.name}! 👋`,
                      },
                    ],
                  };
                }
                return prevActive;
              });

              refetchMessages();
              refetchChatMessages();
            } catch (err) {
              console.error('Failed to clear chat:', err);
              Alert.alert('Error', 'Failed to clear chat history.');
            }
          },
        },
      ]
    );
  };

  const handleUnmatch = (targetUserIdParam, targetUserNameParam) => {
    const currentCandidate = swipeIndex < MOCK_MATCHES.length ? MOCK_MATCHES[swipeIndex] : null;
    const targetUserId = targetUserIdParam || (activeChat && activeChat.id) || (currentCandidate && currentCandidate.id);
    const targetUserName = targetUserNameParam || (activeChat && activeChat.name) || (currentCandidate && (currentCandidate.name || currentCandidate.firstName)) || 'this user';

    if (!targetUserId) return;

    Alert.alert(
      'Unmatch User',
      `Are you sure you want to unmatch ${targetUserName}? This will permanently delete your match and chat history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.unmatchUser({ targetUserId });
              console.log('Unmatched user successfully:', targetUserId);

              if (activeChat && activeChat.id.toString() === targetUserId.toString()) {
                setActiveChat(null);
              }
              setShowActiveCardDetails(false);
              setChats((prevChats) => prevChats.filter((c) => c.id.toString() !== targetUserId.toString()));
              setMatchedUserIds((prevIds) => prevIds.filter((id) => id.toString() !== targetUserId.toString()));

              refetchMatchesList();
              refetchMessages();

              Alert.alert('Success', `You have unmatched ${targetUserName}.`);
            } catch (err) {
              console.error('Failed to unmatch user:', err);
              Alert.alert('Error', 'Failed to unmatch user.');
            }
          },
        },
      ]
    );
  };

  const handleSuperLikeSwipe = async () => {
    if (swipeIndex >= MOCK_MATCHES.length) return;
    const currentCandidate = MOCK_MATCHES[swipeIndex];
    const targetUserId = currentCandidate._id || currentCandidate.id;

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
      const msg = err?.data?.message || err?.message || 'Daily Super Like limit reached (1 per day)!';
      Alert.alert('Super Like Limit', msg);
    }
  };

  const handleBlockUser = (targetUserIdParam, targetUserNameParam) => {
    const currentCandidate = swipeIndex < MOCK_MATCHES.length ? MOCK_MATCHES[swipeIndex] : null;
    const targetUserId = targetUserIdParam || (activeChat && activeChat.id) || (currentCandidate && currentCandidate.id);
    const targetUserName = targetUserNameParam || (activeChat && activeChat.name) || (currentCandidate && (currentCandidate.name || currentCandidate.firstName)) || 'this user';

    if (!targetUserId) return;

    Alert.alert(
      'Block User',
      `Are you sure you want to block ${targetUserName}? They will no longer be able to message you or see your profile.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.blockUser({ targetUserId });
              console.log('Blocked user successfully:', targetUserId);

              if (activeChat && activeChat.id.toString() === targetUserId.toString()) {
                setActiveChat(null);
              }
              setShowActiveCardDetails(false);
              setChats((prevChats) => prevChats.filter((c) => c.id.toString() !== targetUserId.toString()));

              if (typeof fetchQuestionnaires === 'function') fetchQuestionnaires();
              if (typeof fetchMatchesList === 'function') fetchMatchesList();
              if (typeof fetchMessages === 'function') fetchMessages();
              if (typeof fetchLikes === 'function') fetchLikes();

              Alert.alert('User Blocked', `You have blocked ${targetUserName}.`);
            } catch (err) {
              console.error('Failed to block user:', err);
              Alert.alert('Error', 'Failed to block user.');
            }
          },
        },
      ]
    );
  };

  const openReportForm = (idParam, nameParam) => {
    const currentCandidate = swipeIndex < MOCK_MATCHES.length ? MOCK_MATCHES[swipeIndex] : null;
    const targetUserId = idParam || (activeChat && activeChat.id) || (currentCandidate && currentCandidate.id);
    const targetUserName = nameParam || (activeChat && activeChat.name) || (currentCandidate && (currentCandidate.name || currentCandidate.firstName)) || 'User';

    if (!targetUserId) return;

    setReportTargetUser({ id: targetUserId, name: targetUserName });
    setSelectedReportReason('Inappropriate Photos or Content');
    setReportDetails('');
    setAlsoBlockOnReport(false);
    setShowReportModal(true);
  };

  const handleFormSubmitReport = async () => {
    if (!reportTargetUser || !reportTargetUser.id) return;

    try {
      setIsSubmittingReport(true);
      await apiClient.reportUser({
        reportedId: reportTargetUser.id,
        reason: selectedReportReason,
        details: reportDetails,
      });

      if (alsoBlockOnReport) {
        await apiClient.blockUser({ targetUserId: reportTargetUser.id });
      }

      setShowReportModal(false);
      setIsSubmittingReport(false);

      Alert.alert(
        'Report Submitted',
        `Thank you for reporting ${reportTargetUser.name}. Our admin moderation team will review this profile.`
      );

      if (alsoBlockOnReport) {
        if (activeChat && activeChat.id.toString() === reportTargetUser.id.toString()) {
          setActiveChat(null);
        }
        setShowActiveCardDetails(false);
        setChats((prevChats) => prevChats.filter((c) => c.id.toString() !== reportTargetUser.id.toString()));

        if (typeof fetchQuestionnaires === 'function') fetchQuestionnaires();
        if (typeof fetchMatchesList === 'function') fetchMatchesList();
        if (typeof fetchMessages === 'function') fetchMessages();
        if (typeof fetchLikes === 'function') fetchLikes();
      }
    } catch (err) {
      console.error('Failed to submit report:', err);
      setIsSubmittingReport(false);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  const handleReportUser = (targetUserIdParam, targetUserNameParam) => {
    openReportForm(targetUserIdParam, targetUserNameParam);
  };

  const handleChatMenu = () => {
    if (!activeChat) return;

    Alert.alert(
      'Chat Options',
      'Choose an action:',
      [
        {
          text: 'Clear Chat History',
          onPress: handleClearChat,
        },
        {
          text: 'Unmatch / Block User',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Unmatch or Block',
              `Select an action for ${activeChat.name}:`,
              [
                {
                  text: 'Unmatch User',
                  style: 'destructive',
                  onPress: () => handleUnmatch(activeChat.id, activeChat.name),
                },
                {
                  text: 'Block User',
                  style: 'destructive',
                  onPress: () => handleBlockUser(activeChat.id, activeChat.name),
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
              ]
            );
          },
        },
        {
          text: 'Report User ⚠️',
          onPress: () => openReportForm(activeChat.id, activeChat.name),
        },
      ],
      { cancelable: true }
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
    setShowAttachmentModal(true);
  };

  const handleStickerPress = () => {
    Keyboard.dismiss();
    setShowStickerPicker(!showStickerPicker);
  };

  const selectSticker = (sticker) => {
    handleSendMessage({
      messageType: 'sticker',
      stickerId: sticker.id,
      mediaUrl: sticker.char,
    });
    setShowStickerPicker(false);
  };

  const handlePickImage = () => {
    setShowAttachmentModal(false);
    const options = {
      mediaType: 'photo',
      quality: 0.8,
    };
    launchImageLibrary(options, async (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        Alert.alert('Error', response.errorMessage);
        return;
      }
      if (response.assets && response.assets.length > 0) {
        const selectedUri = response.assets[0].uri;
        const formData = new FormData();
        formData.append('file', {
          uri: Platform.OS === 'android' ? selectedUri : selectedUri.replace('file://', ''),
          name: response.assets[0].fileName || 'photo.jpg',
          type: response.assets[0].type || 'image/jpeg',
        });

        try {
          const res = await apiClient.uploadChatMedia(formData);
          handleSendMessage({
            messageType: 'image',
            mediaUrl: res.url,
            fileName: res.fileName,
            fileSize: res.fileSize,
          });
        } catch (err) {
          console.log('Chat photo upload failed:', err);
          Alert.alert('Upload Error', 'Failed to upload photo to server.');
        }
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

      if (!asset) return;

      // Validate max file size (100 MB)
      const maxSizeBytes = 100 * 1024 * 1024;
      if (asset.fileSize && asset.fileSize > maxSizeBytes) {
        Alert.alert('File Too Large', 'The selected file/video exceeds the 100MB limit. Please select a smaller file.');
        return;
      }

      const pickedFileName = asset.fileName || `document_${Date.now()}.${asset.type ? asset.type.split('/')[1] || 'pdf' : 'pdf'}`;
      const pickedFileType = asset.type || '';
      const lowerName = pickedFileName.toLowerCase();

      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
        name: pickedFileName,
        type: pickedFileType || 'application/pdf',
      });

      let docUrl = '';
      let fileSize = asset.fileSize || 0;

      try {
        const res = await apiClient.uploadChatMedia(formData);
        docUrl = res.url;
        fileSize = res.fileSize || fileSize;
      } catch (uploadErr) {
        console.log('Upload error:', uploadErr);
        Alert.alert('Upload Error', 'Failed to upload file to server.');
        return;
      }

      const isVideo = pickedFileType.startsWith('video/') || lowerName.endsWith('.mp4') || lowerName.endsWith('.mov') || lowerName.endsWith('.avi') || lowerName.endsWith('.mkv');
      const isImage = pickedFileType.startsWith('image/') || lowerName.endsWith('.jpg') || lowerName.endsWith('.png') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp');

      let messageType = 'document';
      if (isVideo) messageType = 'video';
      else if (isImage) messageType = 'image';

      handleSendMessage({
        text: pickedFileName,
        messageType: messageType,
        mediaUrl: docUrl,
        fileName: pickedFileName,
        fileSize: fileSize,
      });
    } catch (err) {
      console.error('Pick document error:', err);
      Alert.alert('Error', 'Failed to pick file from device.');
    }
  };

  // --- Voice Note Recording & Playback Implementation ---
  const startRecording = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission 🎤',
            message: 'Dating App needs microphone access to record voice notes.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Microphone permission is required to record voice notes.');
          return;
        }
      }

      // Stop any audio currently playing
      if (audioRecorderPlayerRef.current) {
        try { await audioRecorderPlayerRef.current.stopPlayer(); } catch (_) {}
      }
      setPlayingMessageId(null);

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
        recordedPath = await audioRecorderPlayerRef.current.stopRecorder();
      }

      if (!shouldSend) {
        setRecordingSeconds(0);
        setRecordTime('0:00');
        return;
      }

      if (recordingSeconds < 1 && !recordedPath) {
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

      const ext = Platform.OS === 'ios' ? 'm4a' : 'mp4';
      const fileName = `voice_${Date.now()}.${ext}`;

      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'android' ? audioUri : audioUri.replace('file://', ''),
        name: fileName,
        type: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4',
      });

      try {
        const uploadRes = await apiClient.uploadChatMedia(formData);
        const voiceUrl = uploadRes.url || uploadRes.data?.url || audioUri;

        handleSendMessage({
          text: '🎤 Voice Note',
          messageType: 'voice',
          mediaUrl: voiceUrl,
          fileName: fileName,
          fileSize: uploadRes.fileSize || 0,
        });
      } catch (uploadErr) {
        console.error('Error uploading voice note audio:', uploadErr);
        Alert.alert('Upload Error', 'Failed to upload voice note to server.');
      }
    } catch (e) {
      console.error('Error stopping voice note recording:', e);
    } finally {
      setRecordingSeconds(0);
      setRecordTime('0:00');
    }
  };

  const playVoiceNote = async (msgId, rawMediaUrl) => {
    try {
      const fullAudioUrl = getImageUrl(rawMediaUrl);
      if (!fullAudioUrl) {
        Alert.alert('Playback Error', 'Voice note audio URL is missing or invalid.');
        return;
      }

      // If user taps play on currently playing voice note, pause/stop it
      if (playingMessageId === msgId) {
        if (audioRecorderPlayerRef.current) {
          try { await audioRecorderPlayerRef.current.stopPlayer(); } catch (_) {}
        }
        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        setPlayingMessageId(null);
        setPlaybackPosition(0);
        return;
      }

      // Stop any existing audio playing first
      if (audioRecorderPlayerRef.current) {
        try {
          audioRecorderPlayerRef.current.removePlaybackEndListener();
          await audioRecorderPlayerRef.current.stopPlayer();
        } catch (_) {}
      }
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);

      setPlayingMessageId(msgId);
      setPlaybackPosition(0);
      setPlaybackDuration(5000);

      const sound = audioRecorderPlayerRef.current || createSound();
      audioRecorderPlayerRef.current = sound;

      sound.removePlaybackEndListener();
      sound.addPlaybackEndListener(() => {
        setPlayingMessageId(null);
        setPlaybackPosition(0);
        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
      });

      console.log('🔊 Playing voice note from URL:', fullAudioUrl);
      await sound.startPlayer(fullAudioUrl);

      // Start position progress timer
      let posMs = 0;
      playbackIntervalRef.current = setInterval(() => {
        posMs += 250;
        setPlaybackPosition(posMs);
        if (posMs >= 5000) {
          if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        }
      }, 250);
    } catch (e) {
      console.error('Error playing voice note:', e);
      setPlayingMessageId(null);
      setPlaybackPosition(0);
      Alert.alert('Playback Error', 'Unable to play voice note audio.');
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <View style={[styles.container, { paddingTop: safeTopPadding }]}>
        {/* App Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoIconText}>🔥</Text>
            </View>
            <Text style={styles.logoText}>FlameMatch</Text>
          </View>
          {activeTab === 'profile' && (
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Top Warning Banner (Displays at top of HomeScreen when reported user receives warning) */}
        {activeWarningData && !activeWarningData.isAcknowledged && (
          <View style={styles.topWarningBanner}>
            <TouchableOpacity
              style={styles.topWarningBannerContent}
              onPress={() => setShowAdminWarningModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.topWarningEmoji}>⚠️</Text>
              <View style={styles.topWarningTextWrapper}>
                <Text style={styles.topWarningTitle}>Account Guideline Warning</Text>
                <Text style={styles.topWarningSub} numberOfLines={1}>
                  {activeWarningData.category || 'Policy violation flagged'} • Tap ⓘ info to expand notice
                </Text>
              </View>
            </TouchableOpacity>

            {/* Information (i) icon button that expands the full warning modal */}
            <TouchableOpacity
              style={styles.topWarningInfoBtn}
              onPress={() => setShowAdminWarningModal(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.topWarningInfoIcon}>ⓘ</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Content Area */}
        <View style={styles.contentArea}>
          {activeTab === 'search' && (
            <SearchScreen
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
              {swipeIndex < MOCK_MATCHES.length ? (
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
                          {!!(MOCK_MATCHES[swipeIndex + 1] && (MOCK_MATCHES[swipeIndex + 1].isOnline || onlineUsersMap[(MOCK_MATCHES[swipeIndex + 1].id || MOCK_MATCHES[swipeIndex + 1]._id || MOCK_MATCHES[swipeIndex + 1].userId)?.toString()])) && (
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
                        {!!(MOCK_MATCHES[swipeIndex] && (MOCK_MATCHES[swipeIndex].isOnline || onlineUsersMap[(MOCK_MATCHES[swipeIndex].id || MOCK_MATCHES[swipeIndex]._id || MOCK_MATCHES[swipeIndex].userId)?.toString()])) && (
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
                  <Text style={styles.noMatchesEmoji}>🎉</Text>
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
                    {likesList.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.instaRowCard, item.isSuperLike && { borderColor: '#3897F0', borderWidth: 1.5 }]}
                        activeOpacity={0.85}
                        onPress={() => {
                          setSelectedLikesProfile(item);
                          setLikesActivePhotoIndex(0);
                        }}
                      >
                        {/* Left: Avatar with Online Dot */}
                        <View style={styles.instaAvatarWrapper}>
                          <Image
                            source={{
                              uri: item.profileImage
                                ? getImageUrl(item.profileImage)
                                : getImageUrl(item.image)
                            }}
                            style={styles.instaAvatar}
                          />
                          {!!onlineUsersMap[item.id.toString()] && (
                            <View style={styles.instaOnlineDot} />
                          )}
                        </View>

                        {/* Middle: Name, Age, Subtitle */}
                        <View style={styles.instaInfoCol}>
                          <View style={styles.instaNameRow}>
                            <Text style={styles.instaNameText} numberOfLines={1}>
                              {item.name}{item.age ? `, ${item.age}` : ''}
                            </Text>
                            {item.isSuperLike && (
                              <Text style={styles.instaSuperStar}>⭐</Text>
                            )}
                          </View>
                          <Text style={styles.instaSubtitleText} numberOfLines={1}>
                            {item.isSuperLike
                              ? '⭐ Super Liked you!'
                              : item.distance
                              ? `📍 ${item.distance}`
                              : 'Liked your profile'}
                          </Text>
                        </View>

                        {/* Right: Instagram-Style Action Buttons (Pass ✖ & Like ♥) */}
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
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View style={styles.emptyLikesContainer}>
                  <Text style={styles.emptyLikesEmoji}>❤️</Text>
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
                  <View style={styles.chatHeader}>
                    <TouchableOpacity
                      style={styles.chatBackButton}
                      onPress={() => setActiveChat(null)}
                    >
                      <Text style={styles.chatBackArrow}>←</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      activeOpacity={0.8}
                      onPress={async () => {
                        const partnerId = activeChat.id || activeChat._id || activeChat.userId;
                        setLikesActivePhotoIndex(0);

                        const localCandidate =
                          (Array.isArray(MOCK_MATCHES) ? MOCK_MATCHES : []).find(m => (m?.id || m?._id || m?.userId)?.toString() === partnerId?.toString()) ||
                          (Array.isArray(likesList) ? likesList : []).find(m => (m?.id || m?._id || m?.userId)?.toString() === partnerId?.toString()) ||
                          (Array.isArray(chats) ? chats : []).find(m => (m?.id || m?._id || m?.userId)?.toString() === partnerId?.toString()) ||
                          {};

                        let enrichedProfile = { ...localCandidate, ...activeChat };

                        try {
                          if (partnerId) {
                            const res = await apiClient.getUserById(partnerId);
                            if (res && res.user) {
                              enrichedProfile = { ...enrichedProfile, ...res.user };
                            }
                          }
                        } catch (e) {
                          console.log('Error fetching chat partner full profile by ID:', e);
                        }

                        setSelectedLikesProfile(enrichedProfile);
                      }}
                    >
                      {(() => {
                        const partnerId = (activeChat.id || activeChat._id || activeChat.userId || activeChat.senderId || activeChat.sender)?.toString();
                        const isPartnerOnline = partnerId && onlineUsersMap[partnerId] !== undefined
                          ? !!onlineUsersMap[partnerId]
                          : !!(activeChat.isOnline || activeChat.user?.isOnline);
                        return (
                          <>
                            <View style={styles.avatarWrapper}>
                              <Image source={{ uri: getImageUrl(activeChat.image || activeChat.profileImage) }} style={styles.chatHeaderAvatar} />
                              {isPartnerOnline && (
                                <View style={styles.onlineDotOverlay} />
                              )}
                            </View>
                            <View style={styles.chatHeaderTitleContainer}>
                              <Text style={styles.chatHeaderName}>{activeChat.name || activeChat.firstName}</Text>
                              <Text style={styles.chatHeaderStatusText}>
                                {isPartnerOnline
                                  ? 'Online'
                                  : formatLastSeen((partnerId && lastSeenMap[partnerId]) || activeChat.lastSeen)}
                              </Text>
                            </View>
                          </>
                        );
                      })()}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.callChatHeaderButton}
                      onPress={makeVoiceCall}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.callChatHeaderText}>📞 Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.chatThreeDotsButton}
                      onPress={handleChatMenu}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chatThreeDotsText}>⋮</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    ref={chatScrollViewRef}
                    style={styles.messageBubbleContainer}
                    contentContainerStyle={{ paddingVertical: 15 }}
                    onContentSizeChange={() => chatScrollViewRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => chatScrollViewRef.current?.scrollToEnd({ animated: true })}
                  >
                    {activeChat.messages.map((msg) => {
                      const isMe = msg.sender === 'you';
                      const isSticker = msg.messageType === 'sticker';
                      const isImage =
                        msg.messageType === 'image' ||
                        (msg.mediaUrl &&
                          typeof msg.mediaUrl === 'string' &&
                          (msg.mediaUrl.startsWith('data:image') ||
                           msg.mediaUrl.includes('cloudinary') ||
                           msg.mediaUrl.endsWith('.jpg') ||
                           msg.mediaUrl.endsWith('.jpeg') ||
                           msg.mediaUrl.endsWith('.png') ||
                           msg.mediaUrl.endsWith('.webp') ||
                           msg.mediaUrl.endsWith('.gif'))) ||
                        (msg.text &&
                          typeof msg.text === 'string' &&
                          (msg.text.startsWith('http') || msg.text.startsWith('data:image')) &&
                          (msg.text.includes('cloudinary') || msg.text.endsWith('.jpg') || msg.text.endsWith('.jpeg') || msg.text.endsWith('.png')));

                      const isDocument = msg.messageType === 'document';
                      const isVideo = msg.messageType === 'video' || (msg.mediaUrl && (msg.mediaUrl.endsWith('.mp4') || msg.mediaUrl.endsWith('.mov') || msg.mediaUrl.endsWith('.avi')));
                      const isVoice = msg.messageType === 'voice';
                      const isCall = msg.messageType === 'call';

                      const imageUrlToRender = getImageUrl(msg.mediaUrl || (isImage ? msg.text : ''));

                      return (
                        <View
                          key={msg.id}
                          style={[
                            styles.messageBubbleWrapper,
                            isMe ? styles.bubbleWrapperMe : styles.bubbleWrapperThem
                          ]}
                        >
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onLongPress={() => handleMessageLongPress(msg)}
                            style={[
                              isSticker || isImage ? styles.transparentBubble : styles.messageBubble,
                              isMe ? ((isSticker || isImage) ? null : styles.bubbleMe) : ((isSticker || isImage) ? null : styles.bubbleThem)
                            ]}
                          >
                            {isSticker && (
                              <Text style={styles.stickerText}>{msg.mediaUrl || msg.text}</Text>
                            )}

                            {isImage && (
                              <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => setViewMediaModal({
                                  visible: true,
                                  type: 'image',
                                  url: imageUrlToRender,
                                  fileName: msg.fileName || 'Photo',
                                  fileSize: msg.fileSize || 0
                                })}
                                onLongPress={() => handleMessageLongPress(msg)}
                                style={styles.imageMessageContainer}
                              >
                                <Image
                                  source={{ uri: imageUrlToRender }}
                                  style={styles.imageMessage}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            )}

                            {isDocument && (
                              <TouchableOpacity
                                style={styles.documentMessageCard}
                                activeOpacity={0.85}
                                onPress={() => {
                                  if (msg.mediaUrl) {
                                    setViewMediaModal({
                                      visible: true,
                                      type: 'document',
                                      url: getImageUrl(msg.mediaUrl),
                                      fileName: msg.fileName || 'document.pdf',
                                      fileSize: msg.fileSize || 0,
                                    });
                                  }
                                }}
                                onLongPress={() => handleMessageLongPress(msg)}
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
                                  if (msg.mediaUrl) {
                                    Linking.openURL(getImageUrl(msg.mediaUrl)).catch(() =>
                                      Alert.alert('Error', 'Unable to play video.')
                                    );
                                  }
                                }}
                                onLongPress={() => handleMessageLongPress(msg)}
                              >
                                <View style={styles.videoIconContainer}>
                                  <Text style={styles.videoIconText}>🎬</Text>
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
                              <View style={styles.voiceMessageContainer}>
                                <TouchableOpacity
                                  style={styles.voicePlayButton}
                                  onPress={() => playVoiceNote(msg.id, msg.mediaUrl)}
                                >
                                  <Text style={styles.voicePlayIcon}>
                                    {playingMessageId === msg.id ? '⏸' : '▶'}
                                  </Text>
                                </TouchableOpacity>
                                <View style={styles.voiceTimelineContainer}>
                                  <View style={styles.voiceProgressBarBg}>
                                    <View
                                      style={[
                                        styles.voiceProgressBarFill,
                                        playingMessageId === msg.id
                                          ? {
                                              width: `${
                                                playbackDuration > 0
                                                  ? (playbackPosition / playbackDuration) * 100
                                                  : 0
                                              }%`,
                                            }
                                          : { width: '0%' },
                                      ]}
                                    />
                                  </View>
                                  <View style={styles.soundWaveBars}>
                                    <View style={[styles.waveBar, { height: 10 }]} />
                                    <View style={[styles.waveBar, { height: 16 }]} />
                                    <View style={[styles.waveBar, { height: 12 }]} />
                                    <View style={[styles.waveBar, { height: 20 }]} />
                                    <View style={[styles.waveBar, { height: 14 }]} />
                                    <View style={[styles.waveBar, { height: 8 }]} />
                                  </View>
                                </View>
                                <Text style={[styles.voiceDurationText, isMe ? { color: '#fff' } : { color: 'rgba(255,255,255,0.7)' }]}>
                                  {playingMessageId === msg.id
                                    ? `${Math.floor(playbackPosition / 1000)}s`
                                    : '0:05'}
                                </Text>
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
                                  <Text style={{ fontSize: 18 }}>
                                    {(msg.mediaUrl === 'missed' || msg.mediaUrl === 'declined' || (msg.text && (msg.text.includes('Missed') || msg.text.includes('declined') || msg.text.includes('No answer')))) ? '📵' : '📞'}
                                  </Text>
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

                            {(!isSticker && !isImage && !isDocument && !isVoice && !isCall) && (
                              <Text
                                style={[
                                  styles.messageText,
                                  isMe ? styles.messageTextMe : styles.messageTextThem
                                ]}
                              >
                                {msg.text}
                              </Text>
                            )}

                            <View style={styles.messageMetaRow}>
                              {msg.isEdited && (
                                <Text
                                  style={[
                                    styles.messageTimeText,
                                    isMe ? styles.messageTimeTextMe : styles.messageTimeTextThem,
                                    { marginRight: 4, fontStyle: 'italic' },
                                    isSticker && { color: 'rgba(255,255,255,0.6)' }
                                  ]}
                                >
                                  (edited)
                                </Text>
                              )}
                              {msg.createdAt && msg.createdAt !== 'match-init' && (
                                <Text
                                  style={[
                                    styles.messageTimeText,
                                    isMe ? styles.messageTimeTextMe : styles.messageTimeTextThem,
                                    isSticker && { color: 'rgba(255,255,255,0.6)' }
                                  ]}
                                >
                                  {formatMessageTime(msg.createdAt)}
                                </Text>
                              )}
                              {isMe && msg.createdAt !== 'match-init' && (
                                <Text
                                  style={[
                                    styles.statusTicks,
                                    msg.status === 'seen' ? styles.ticksSeen : styles.ticksSent
                                  ]}
                                >
                                  {msg.status === 'sending' ? ' 🕒' : msg.status === 'seen' ? ' ✓✓' : msg.status === 'delivered' ? ' ✓✓' : ' ✓'}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    {isTyping && (
                      <View style={[styles.messageBubbleWrapper, styles.bubbleWrapperThem]}>
                        <View style={[styles.messageBubble, styles.bubbleThem, { paddingVertical: 10 }]}>
                          <Text style={[styles.messageText, styles.messageTextThem, { opacity: 0.6, fontStyle: 'italic' }]}>
                            Typing
                          </Text>
                        </View>
                      </View>
                    )}
                  </ScrollView>

                  {showStickerPicker && (
                    <View style={styles.stickerPickerContainer}>
                      <Text style={styles.stickerPickerTitle}>Send a sticker</Text>
                      <ScrollView contentContainerStyle={styles.stickerGrid} showsVerticalScrollIndicator={false}>
                        {MOCK_STICKERS.map((st) => (
                          <TouchableOpacity
                            key={st.id}
                            style={styles.stickerItem}
                            onPress={() => selectSticker(st)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.stickerItemText}>{st.char}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
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
                          setTypedMessage('');
                        }}
                      >
                        <Text style={styles.cancelEditButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                    {isRecording ? (
                      <View style={styles.recordingRow}>
                        <View style={styles.recordingIndicatorRow}>
                          <View style={styles.recordingPulsingDot} />
                          <Text style={styles.recordingTimeText}>Recording: {recordTime}</Text>
                        </View>
                        <View style={styles.recordingControls}>
                          <TouchableOpacity
                            style={styles.cancelRecordButton}
                            onPress={() => stopRecording(false)}
                          >
                            <Text style={styles.cancelRecordText}>Cancel ✕</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.sendRecordButton}
                            onPress={() => stopRecording(true)}
                          >
                            <Text style={styles.sendRecordIcon}>📤 Send</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.chatInputRow}>
                        <TouchableOpacity
                          style={styles.chatActionButton}
                          onPress={handleAttachPress}
                        >
                          <Text style={styles.chatActionIcon}>📎</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.chatActionButton}
                          onPress={handleStickerPress}
                        >
                          <Text style={styles.chatActionIcon}>😊</Text>
                        </TouchableOpacity>

                        <TextInput
                          style={styles.chatInput}
                          placeholder={editingMessage ? "Edit message..." : "Type a message..."}
                          placeholderTextColor="rgba(255, 255, 255, 0.4)"
                          value={typedMessage}
                          onChangeText={handleInputChange}
                          onFocus={() => {
                            setShowStickerPicker(false);
                            setTimeout(() => {
                              chatScrollViewRef.current?.scrollToEnd({ animated: true });
                            }, 150);
                          }}
                        />

                        {typedMessage.trim() === '' && !editingMessage ? (
                          <TouchableOpacity
                            style={styles.chatMicButton}
                            onPress={startRecording}
                          >
                            <Text style={styles.chatActionIcon}>🎤</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.chatSendButton}
                            onPress={() => handleSendMessage()}
                          >
                            <Text style={styles.chatSendButtonText}>
                              {editingMessage ? 'Save' : 'Send'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

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
                              <Text style={styles.attachOptionIconText}>📷</Text>
                            </View>
                            <Text style={styles.attachOptionLabel}>Photo / Gallery</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.attachOptionBtn}
                            onPress={handlePickRealDocument}
                          >
                            <View style={styles.attachOptionIconBg}>
                              <Text style={styles.attachOptionIconText}>📁</Text>
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
                </KeyboardAvoidingView>
              ) : (
                /* Chat List view */
                <View style={styles.chatListWrapper}>
                  <View style={styles.chatListHeaderRow}>
                    <TouchableOpacity
                      style={styles.headerBackBtn}
                      onPress={() => setActiveTab('swipe')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.headerBackBtnText}>←</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionTitle}>Conversations</Text>
                      <Text style={styles.sectionSubtitle}>Start talking with your matches.</Text>
                    </View>
                    {chats.length > 0 && (
                      <TouchableOpacity
                        style={styles.deleteAllChatsBtn}
                        onPress={handleClearAllConversations}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.deleteAllChatsBtnText}>Delete All</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {chats.length > 0 ? (
                    <ScrollView style={styles.chatsList} showsVerticalScrollIndicator={false}>
                      {chats.map((chat) => {
                        const currentId = currentUser?.id || currentUser?._id;
                        const unreadCount = (chat.messages || []).filter(
                          (m) => (m.sender !== 'you' && m.senderId !== currentId?.toString()) && m.id !== 'match-init' && m.status !== 'seen'
                        ).length;

                        const lastMsg = chat.messages ? chat.messages[chat.messages.length - 1] : null;

                        return (
                          <TouchableOpacity
                            key={chat.id}
                            style={[styles.chatRow, unreadCount > 0 && styles.chatRowUnread]}
                            onPress={() => setActiveChat(chat)}
                            activeOpacity={0.8}
                          >
                            <View style={styles.avatarWrapper}>
                              <Image source={{ uri: getImageUrl(chat.image) }} style={styles.chatRowAvatar} />
                              {(() => {
                                const cId = (chat.id || chat._id || chat.userId)?.toString();
                                const isOnline = cId && onlineUsersMap[cId] !== undefined ? !!onlineUsersMap[cId] : !!(chat.isOnline || chat.user?.isOnline);
                                return isOnline ? <View style={styles.onlineDotOverlay} /> : null;
                              })()}
                            </View>
                            <View style={styles.chatRowInfo}>
                              <Text style={[styles.chatRowName, unreadCount > 0 && styles.chatRowNameUnread]}>
                                {chat.name}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                {(() => {
                                  const currentId = (currentUser?.id || currentUser?._id)?.toString();
                                  const isLastMsgSentByMe = !!(lastMsg && (lastMsg.sender === 'you' || lastMsg.senderId?.toString() === currentId));
                                  if (!isLastMsgSentByMe || !lastMsg) return null;
                                  const isSeen = lastMsg.status === 'seen';
                                  const isDelivered = lastMsg.status === 'delivered';
                                  return (
                                    <Text style={[styles.chatStatusTicks, isSeen && styles.chatStatusTicksSeen]}>
                                      {isSeen ? '✓✓' : isDelivered ? '✓✓' : '✓'}
                                    </Text>
                                  );
                                })()}
                                <Text style={[styles.chatRowLastMessage, unreadCount > 0 && styles.chatRowLastMessageUnread, { flex: 1 }]} numberOfLines={1}>
                                  {(() => {
                                    if (!lastMsg) return '';
                                    if (lastMsg.messageType === 'voice') return '🎤 Voice Note';
                                    if (lastMsg.messageType === 'call') return lastMsg.text || '📞 Voice Call';
                                    if (lastMsg.messageType === 'image') return '📷 Image';
                                    if (lastMsg.messageType === 'video') return '🎬 Video';
                                    if (lastMsg.messageType === 'document') return '📄 Document';
                                    if (lastMsg.messageType === 'sticker') return '😊 Sticker';
                                    return lastMsg.text || '';
                                  })()}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.chatRowRightMeta}>
                              <Text style={[styles.chatRowTime, unreadCount > 0 && styles.chatRowTimeUnread]}>
                                {lastMsg && lastMsg.createdAt && lastMsg.createdAt !== 'match-init'
                                  ? formatMessageTime(lastMsg.createdAt)
                                  : 'Now'}
                              </Text>
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
                  ) : (
                    <View style={styles.emptyChatsContainer}>
                      <Text style={styles.emptyChatsEmoji}>💬</Text>
                      <Text style={styles.emptyChatsTitle}>No Conversations Yet</Text>
                      <Text style={styles.emptyChatsSubtitle}>
                        Your matches will show up here. Swipe right to match and start chatting!
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {activeTab === 'profile' && (
            <Profile
              userProfile={userProfile}
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
            <Ionicons
              name={activeTab === 'search' ? "search" : "search-outline"}
              size={24}
              color={activeTab === 'search' ? "#FE3C72" : "rgba(255, 255, 255, 0.6)"}
              style={{ marginBottom: 2 }}
            />
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
                    {!!(MOCK_MATCHES[swipeIndex] && (MOCK_MATCHES[swipeIndex].isOnline || onlineUsersMap[(MOCK_MATCHES[swipeIndex].id || MOCK_MATCHES[swipeIndex]._id || MOCK_MATCHES[swipeIndex].userId)?.toString()])) && (
                      <View style={styles.swipeOnlineBadge}>
                        <View style={styles.swipeOnlineDot} />
                        <Text style={styles.swipeOnlineText}>Online</Text>
                      </View>
                    )}
                    <View style={styles.distanceBadgeLarge}>
                      <Text style={styles.distanceBadgeTextLarge}>
                        {MOCK_MATCHES[swipeIndex].distance}
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
                        <Text style={styles.cardExpandedEmoji}>👤</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].gender}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].orientation && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🏳️‍🌈</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].orientation}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].lookingFor && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🎯</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].lookingFor}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].drinkHabit && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🍷</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].drinkHabit}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].smokeHabit && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🚭</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].smokeHabit}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].exercise && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>💪</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].exercise}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].pets && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🐕</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].pets}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].educationLevel && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🎓</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].educationLevel}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].height && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>📏</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].height}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].weight && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>⚖️</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].weight}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].job && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>💼</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].job}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].college && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🏛️</Text>
                        <Text style={styles.cardExpandedText}>{MOCK_MATCHES[swipeIndex].college}</Text>
                      </View>
                    )}
                    {MOCK_MATCHES[swipeIndex].zodiac && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🌌</Text>
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
        {!!selectedLikesProfile && (
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
                    const photos = [
                      selectedLikesProfile.profileImage || selectedLikesProfile.image,
                      ...(selectedLikesProfile.profileImages || []),
                      ...(selectedLikesProfile.photos || []),
                      ...(selectedLikesProfile.videos || []),
                      ...(selectedLikesProfile.media || []),
                    ].filter(Boolean);
                    const uniquePhotos = Array.from(new Set(photos));
                    const displayPhotos = uniquePhotos.length > 0 ? uniquePhotos : ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'];
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
                    {!!(selectedLikesProfile && (selectedLikesProfile.isOnline || onlineUsersMap[(selectedLikesProfile.id || selectedLikesProfile._id || selectedLikesProfile.userId)?.toString()])) && (
                      <View style={styles.swipeOnlineBadge}>
                        <View style={styles.swipeOnlineDot} />
                        <Text style={styles.swipeOnlineText}>Online</Text>
                      </View>
                    )}
                    {selectedLikesProfile.distance ? (
                      <View style={styles.distanceBadgeLarge}>
                        <Text style={styles.distanceBadgeTextLarge}>
                          📍 {selectedLikesProfile.distance}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {selectedLikesProfile.bio ? (
                    <Text style={styles.matchBioTextLarge}>
                      {selectedLikesProfile.bio}
                    </Text>
                  ) : null}

                  <Text style={styles.cardDetailSectionTitleLarge}>About Me & Habits</Text>
                  <View style={styles.cardExpandedGrid}>
                    {selectedLikesProfile.gender && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>👤</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.gender}</Text>
                      </View>
                    )}
                    {selectedLikesProfile.orientation && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🏳️‍🌈</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.orientation}</Text>
                      </View>
                    )}
                    {selectedLikesProfile.lookingFor && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🎯</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.lookingFor}</Text>
                      </View>
                    )}
                    {selectedLikesProfile.drinkHabit && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🍷</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.drinkHabit}</Text>
                      </View>
                    )}
                    {selectedLikesProfile.smokeHabit && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🚭</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.smokeHabit}</Text>
                      </View>
                    )}
                    {selectedLikesProfile.exercise && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>💪</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.exercise}</Text>
                      </View>
                    )}
                    {selectedLikesProfile.pets && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🐕</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.pets}</Text>
                      </View>
                    )}
                    {selectedLikesProfile.educationLevel && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🎓</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.educationLevel}</Text>
                      </View>
                    )}
                    {selectedLikesProfile.height && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>📏</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.height}</Text>
                      </View>
                    )}
                    {selectedLikesProfile.weight && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>⚖️</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.weight}</Text>
                      </View>
                    )}
                    {(selectedLikesProfile.job || selectedLikesProfile.profession) && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>💼</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.job || selectedLikesProfile.profession}</Text>
                      </View>
                    )}
                    {selectedLikesProfile.college && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🏛️</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.college}</Text>
                      </View>
                    )}
                    {selectedLikesProfile.zodiac && (
                      <View style={styles.cardExpandedItem}>
                        <Text style={styles.cardExpandedEmoji}>🌌</Text>
                        <Text style={styles.cardExpandedText}>{selectedLikesProfile.zodiac}</Text>
                      </View>
                    )}
                  </View>

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
                          <View key={`lang-${idx}`} style={[styles.cardExpandedInterestBadge, { backgroundColor: '#262630' }]}>
                            <Text style={styles.cardExpandedInterestText}>🗣️ {lang}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Safety & Moderation Actions */}
                  <View style={{ marginTop: 24, gap: 10 }}>
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
                        setSelectedLikesProfile(null);
                        handleReportUser ? handleReportUser(target.id || target._id, target.firstName || target.name) : handleReportProfile(target);
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
                        setSelectedLikesProfile(null);
                        handleBlockUser(target.id || target._id, target.firstName || target.name);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#aaa', fontWeight: '600', fontSize: 14 }}>
                        🔒 Block Profile
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Horizontal Pass & Like Action Option Buttons */}
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
                </View>
              </ScrollView>
            </SafeAreaView>
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
              ].filter(Boolean)
            }
            initialIndex={likesPreviewStoryIndex || 0}
            userName={selectedLikesProfile.firstName || selectedLikesProfile.name || 'Candidate'}
            userAvatar={selectedLikesProfile.profileImage || selectedLikesProfile.image}
            isOwnProfile={false}
            onClose={() => setLikesPreviewStoryIndex(null)}
          />
        )}

        {/* Candidate Full Story / Video Status Preview Modal */}
        {candidateStoryIndex !== null && swipeIndex < MOCK_MATCHES.length && (
          <PreviewModal
            visible={candidateStoryIndex !== null}
            photos={
              (MOCK_MATCHES[swipeIndex]?.profileImages && MOCK_MATCHES[swipeIndex].profileImages.length > 0)
                ? MOCK_MATCHES[swipeIndex].profileImages
                : (MOCK_MATCHES[swipeIndex]?.photos && MOCK_MATCHES[swipeIndex].photos.length > 0)
                ? MOCK_MATCHES[swipeIndex].photos
                : [MOCK_MATCHES[swipeIndex]?.profileImage || MOCK_MATCHES[swipeIndex]?.image].filter(Boolean)
            }
            initialIndex={candidateStoryIndex || 0}
            userName={MOCK_MATCHES[swipeIndex]?.name || MOCK_MATCHES[swipeIndex]?.firstName || 'Suggested Match'}
            userAvatar={MOCK_MATCHES[swipeIndex]?.profileImage || MOCK_MATCHES[swipeIndex]?.image}
            isOwnProfile={false}
            onClose={() => setCandidateStoryIndex(null)}
          />
        )}

        {/* Voice Call Overlay Modal */}
        {callState !== 'idle' && callSession && (
          <Modal
            visible={callState !== 'idle'}
            transparent={true}
            animationType="slide"
            onRequestClose={endVoiceCall}
          >
            <View style={styles.voiceCallOverlay}>
              <View style={styles.voiceCallContent}>
                {/* Peer Profile Card */}
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

                {/* Call Controls */}
                <View style={styles.voiceCallControlsRow}>
                  {callState === 'incoming' ? (
                    <>
                      {/* Decline Call */}
                      <TouchableOpacity
                        style={[styles.voiceCallButton, styles.voiceCallDeclineButton]}
                        onPress={rejectVoiceCall}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.voiceCallButtonEmoji}>✕</Text>
                        <Text style={styles.voiceCallButtonText}>Decline</Text>
                      </TouchableOpacity>
                      
                      {/* Accept Call */}
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
                      {/* Mute / Unmute Button */}
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

                      {/* End Call Button */}
                      <TouchableOpacity
                        style={[styles.voiceCallButton, styles.voiceCallEndButton]}
                        onPress={endVoiceCall}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.voiceCallButtonEmoji}>📞</Text>
                        <Text style={styles.voiceCallButtonText}>End Call</Text>
                      </TouchableOpacity>

                      {/* Speaker Button */}
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
        )}

        {/* Fullscreen Photo & Document Preview Modal */}
        <Modal
          visible={viewMediaModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setViewMediaModal({ visible: false, type: 'image', url: '', fileName: '', fileSize: 0 })}
        >
          <View style={styles.mediaViewerOverlay}>
            <SafeAreaView style={styles.mediaViewerSafeArea}>
              {/* Viewer Header */}
              <View style={styles.mediaViewerHeader}>
                <View style={styles.mediaViewerTitleContainer}>
                  <Text style={styles.mediaViewerTitle} numberOfLines={1}>
                    {viewMediaModal.fileName || (viewMediaModal.type === 'image' ? 'Photo Preview' : 'Document Preview')}
                  </Text>
                  {viewMediaModal.fileSize > 0 && (
                    <Text style={styles.mediaViewerSubTitle}>
                      {formatFileSize(viewMediaModal.fileSize)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.mediaViewerCloseButton}
                  onPress={() => setViewMediaModal({ visible: false, type: 'image', url: '', fileName: '', fileSize: 0 })}
                >
                  <Text style={styles.mediaViewerCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Viewer Content Body */}
              <View style={styles.mediaViewerBody}>
                {viewMediaModal.type === 'image' ? (
                  <Image
                    source={{ uri: viewMediaModal.url }}
                    style={styles.mediaViewerFullImage}
                    resizeMode="contain"
                  />
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

        {/* Chat Options Bottom Sheet Modal */}
        {showChatOptionsMenuModal && activeChat && (
          <Modal
            visible={showChatOptionsMenuModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowChatOptionsMenuModal(false)}
          >
            <TouchableOpacity
              style={styles.attachDialogOverlay}
              activeOpacity={1}
              onPress={() => setShowChatOptionsMenuModal(false)}
            >
              <View style={styles.attachDialogContent}>
                <Text style={styles.attachDialogTitle}>Options for {activeChat.name}</Text>
                
                <TouchableOpacity
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setShowChatOptionsMenuModal(false);
                    setTimeout(() => handleClearChat(), 200);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 18, marginRight: 12 }}>💬</Text>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Clear Chat History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setShowChatOptionsMenuModal(false);
                    setTimeout(() => handleUnmatch(activeChat.id, activeChat.name), 200);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 18, marginRight: 12 }}>🚫</Text>
                  <Text style={{ color: '#FF453A', fontSize: 16, fontWeight: '600' }}>Unmatch User</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setShowChatOptionsMenuModal(false);
                    setTimeout(() => handleBlockUser(activeChat.id, activeChat.name), 200);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 18, marginRight: 12 }}>🔒</Text>
                  <Text style={{ color: '#FF453A', fontSize: 16, fontWeight: '600' }}>Block User</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 59, 48, 0.15)',
                    marginBottom: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setShowChatOptionsMenuModal(false);
                    setTimeout(() => handleReportUser(activeChat.id, activeChat.name), 200);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 18, marginRight: 12 }}>⚠️</Text>
                  <Text style={{ color: '#FF3B30', fontSize: 16, fontWeight: '600' }}>Report User</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachCancelBtn}
                  onPress={() => setShowChatOptionsMenuModal(false)}
                >
                  <Text style={styles.attachCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
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
                        {reportTargetUser.name ? reportTargetUser.name[0].toUpperCase() : 'U'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                        Reporting {reportTargetUser.name}
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

        {/* Admin Warning Modal Popup - Non-Dismissible Mandatory App Lock */}
        <WarningModal
          visible={showAdminWarningModal}
          warning={activeWarningData}
          onAcknowledge={handleAcknowledgeWarningCall}
          onClose={activeWarningData && !activeWarningData.isAcknowledged ? null : () => setShowAdminWarningModal(false)}
          loading={warningAckLoading}
          isMandatory={!!(activeWarningData && !activeWarningData.isAcknowledged)}
        />
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
    marginBottom: 10,
    width: '100%',
  },
  bubbleWrapperMe: {
    justifyContent: 'flex-end',
  },
  bubbleWrapperThem: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '75%',
  },
  bubbleMe: {
    backgroundColor: '#FE3C72',
    borderTopRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19,
  },
  messageTextMe: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  messageTextThem: {
    color: '#FFFFFF',
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
    height: 180,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  stickerPickerTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 8,
    marginBottom: 8,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  stickerItem: {
    width: '16.6%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerItemText: {
    fontSize: 34,
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
    padding: 10,
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
    backgroundColor: '#0F0F1A',
  },
  messageBubbleContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  statusTicks: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  ticksSent: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  ticksSeen: {
    color: '#00E5FF',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  messageTimeTextMe: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  messageTimeTextThem: {
    color: 'rgba(255, 255, 255, 0.75)',
  },

  // --- Direct Chat Image Preview Styles ---
  transparentBubble: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageMessageContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    maxWidth: 240,
    maxHeight: 240,
    marginVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  imageMessage: {
    width: 220,
    height: 180,
    borderRadius: 12,
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
});
