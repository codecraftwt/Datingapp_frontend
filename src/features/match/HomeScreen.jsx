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
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices
} from 'react-native-webrtc';

import { CustomButton } from '../components/CustomButton';
import { Profile } from './Profile';
import { ChatScreen } from './ChatScreen';
import { BlockReportModal } from '../components/BlockReportModal';
import { useDispatch, useSelector } from 'react-redux';
import { apiClient } from '../api/apiClient';
import { selectCurrentUser } from '../redux/slices/authSlice';
import { syncUserLocationService } from '../../services/locationService';
import {
  setOtherProfiles,
  setLikes,
  setMatches,
  setSwipedIds,
  fetchQuestionnairesThunk,
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
  fetchAllMessagesThunk,
} from '../redux/slices/chatSlice';
import {
  fetchLikesThunk,
  fetchMatchesThunk,
  fetchSwipedIdsThunk,
} from '../redux/slices/matchSlice';
import io from 'socket.io-client';
import { createSound } from 'react-native-nitro-sound';

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
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600';
  }
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('file://') ||
    url.startsWith('content://') ||
    url.startsWith('data:')
  ) {
    if (Platform.OS === 'android') {
      return url.replace('localhost:5000', '10.0.2.2:5000').replace('127.0.0.1:5000', '10.0.2.2:5000');
    }
    return url;
  }
  const host = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
  if (url.startsWith('/')) {
    return `${host}${url}`;
  }
  return `${host}/${url}`;
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

export const HomeScreen = ({ userProfile, onUpdateProfile, onLogout, onRemoveProfile }) => {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);

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

  // Async Redux Thunk Actions
  const fetchQuestionnaires = () => dispatch(fetchQuestionnairesThunk());
  const fetchMessages = () => dispatch(fetchAllMessagesThunk());
  const fetchLikes = () => dispatch(fetchLikesThunk());
  const fetchMatchesList = () => dispatch(fetchMatchesThunk());
  const fetchSwipedIds = () => dispatch(fetchSwipedIdsThunk());

  const syncUserLocation = async () => {
    console.log('📍 [GPS STEP 1] syncUserLocation started...');
    try {
      await syncUserLocationService();
    } catch (err) {
      console.log('❌ [GPS ERROR] Exception inside syncUserLocation:', err);
    } finally {
      fetchQuestionnaires();
    }
  };

  // Run fetches on mount
  useEffect(() => {
    syncUserLocation();
    fetchMessages();
    fetchLikes();
    fetchMatchesList();
    fetchSwipedIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [reportTargetUser, setReportTargetUser] = useState(null);
  const [selectedReportReason, setSelectedReportReason] = useState('Inappropriate Photos or Content');
  const [reportDetails, setReportDetails] = useState('');
  const [alsoBlockOnReport, setAlsoBlockOnReport] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

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
    if (!activeChat?.id) return;
    try {
      const res = await apiClient.getChatMessages(activeChat.id);
      dispatch(setMessages(res || []));
    } catch (err) {
      console.log('Error fetching chat messages:', err);
    }
  };

  useEffect(() => {
    fetchChatMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  const refetchChatMessages = fetchChatMessages;
  const chatMessagesData = messages;

  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isCurrentlyTypingRef = useRef(false);
  const socketUrl = Platform.OS === 'android' ? 'http://localhost:5000' : 'http://localhost:5000';
  const handleIncomingMessageRef = useRef(null);

  // --- Voice Call WebRTC Setup ---
  const [callState, setCallState] = useState('idle'); // idle, calling, incoming, connected
  const [callSession, setCallSession] = useState(null); // { id, name, image, isCaller, incomingOffer }
  const [callDuration, setCallDuration] = useState(0);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callTimerRef = useRef(null);

  const callStateRef = useRef(callState);
  const callSessionRef = useRef(callSession);
  
  useEffect(() => {
    callStateRef.current = callState;
    callSessionRef.current = callSession;
  }, [callState, callSession]);

  const getLocalStream = async () => {
    try {
      console.log('--- getLocalStream Diagnostic ---');
      console.log('mediaDevices type:', typeof mediaDevices);
      console.log('mediaDevices keys:', mediaDevices ? Object.keys(mediaDevices) : 'null');
      console.log('mediaDevices.getUserMedia type:', mediaDevices ? typeof mediaDevices.getUserMedia : 'undefined');
      
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;
      return stream;
    } catch (e) {
      console.log('Error getting local stream:', e);
      Alert.alert(
        'Microphone Error',
        `Error details: ${e.toString()}\n\nStack trace: ${e.stack ? e.stack.substring(0, 250) : 'No stack trace available'}`
      );
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

    pc.onaddstream = (event) => {
      console.log('WebRTC remote audio stream added');
      remoteStreamRef.current = event.stream;
    };

    const localStream = localStreamRef.current || await getLocalStream();
    if (localStream) {
      pc.addStream(localStream);
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

    const localStream = await getLocalStream();
    if (!localStream) {
      rejectVoiceCall();
      return;
    }

    const pc = await createPeerConnection(callSession.id);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(callSession.incomingOffer));
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

  useEffect(() => {
    if (questionnairesData?.users) {
      const initialOnlineMap = {};
      const initialLastSeenMap = {};
      questionnairesData.users.forEach((u) => {
        if (u.isOnline) {
          initialOnlineMap[u.id.toString()] = true;
        }
        if (u.lastSeen) {
          initialLastSeenMap[u.id.toString()] = u.lastSeen;
        }
      });
      setOnlineUsersMap((prev) => ({ ...initialOnlineMap, ...prev }));
      setLastSeenMap((prev) => ({ ...initialLastSeenMap, ...prev }));
    }
  }, [questionnairesData]);

  useEffect(() => {
    if (likesData?.users) {
      setLikesList(likesData.users);
    }
  }, [likesData]);

  useEffect(() => {
    if (matchesData?.matches) {
      setMatchedUserIds(matchesData.matches.map((m) => m.id));
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
      setSwipeHistory((prev) => [...prev, { candidate, action: 'like' }]);

      try {
        const result = await apiClient.likeUser({ likedId: candidate.id });

        if (!likedByMe.includes(candidate.id)) {
          setLikedByMe([...likedByMe, candidate.id]);
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

    if (lastItem && lastItem.candidate) {
      try {
        await apiClient.undoSwipe({ targetUserId: lastItem.candidate.id });
      } catch (err) {
        console.log('Error undoing swipe on backend:', err);
      }
    }

    setSwipeHistory((prev) => prev.slice(0, -1));
    position.setValue({ x: 0, y: 0 });
    setSwipeIndex((prev) => Math.max(0, prev - 1));
    Alert.alert('Swipe Rewound ⏪', 'Restored previous profile onto your card deck!');
  };

  useEffect(() => {
    handleSwipeLeftRef.current = handleSwipeLeft;
    handleSwipeRightRef.current = handleSwipeRight;
  }); // Runs on every render to prevent PanResponder stale closures

  const handleLikeMatch = async (user) => {
    try {
      const result = await apiClient.likeUser({ likedId: user.id });

      if (!likedByMe.includes(user.id)) {
        setLikedByMe([...likedByMe, user.id]);
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
      socketRef.current = io(socketUrl);

      socketRef.current.on('connect', () => {
        console.log('Socket.IO connected successfully, emitting join with:', currentId);
        socketRef.current.emit('join', currentId);

        // Flush offline queue on reconnection
        const currentQueue = offlineQueueRef.current;
        if (currentQueue && currentQueue.length > 0) {
          console.log(`Reconnected! Flushing ${currentQueue.length} offline messages...`);
          currentQueue.forEach((item) => {
            socketRef.current.emit('send_message', item.payload);
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

      socketRef.current.on('message_delivered', ({ messageId, receiverId }) => {
        console.log(`Socket.IO message_delivered: ${messageId}`);
        setChats((prevChats) =>
          prevChats.map((c) => {
            if (c.id === receiverId) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? { ...m, status: 'delivered' } : m
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
                m.id === messageId ? { ...m, status: 'delivered' } : m
              ),
            };
          }
          return prevActive;
        });
      });

      socketRef.current.on('messages_seen', ({ receiverId }) => {
        console.log(`Socket.IO messages_seen: User ${receiverId} read our messages`);
        setChats((prevChats) =>
          prevChats.map((c) => {
            if (c.id === receiverId) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.sender === 'you' ? { ...m, status: 'seen' } : m
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
                m.sender === 'you' ? { ...m, status: 'seen' } : m
              ),
            };
          }
          return prevActive;
        });
      });

      socketRef.current.on('receive_message', (msg) => {
        console.log('Socket.IO received message:', msg);
        if (handleIncomingMessageRef.current) {
          handleIncomingMessageRef.current(msg);
        }
        refetchMessages();
        refetchChatMessages();
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
              if (c.id === otherId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msg.tempId ? actualMsg : m
                  ),
                };
              }
              return c;
            })
          );
          setActiveChat((prevActive) => {
            if (prevActive && prevActive.id === otherId) {
              return {
                ...prevActive,
                messages: prevActive.messages.map((m) =>
                  m.id === msg.tempId ? actualMsg : m
                ),
              };
            }
            return prevActive;
          });
          setOfflineQueue((prev) => prev.filter((item) => item.tempId !== msg.tempId));
        } else {
          if (handleIncomingMessageRef.current) {
            handleIncomingMessageRef.current(msg);
          }
        }
        refetchMessages();
        refetchChatMessages();
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
        if (peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
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
        Alert.alert('Call Declined', 'The user declined your voice call.');
        cleanUpWebRTCSession();
        setCallState('idle');
        setCallSession(null);
      });

      socketRef.current.on('call_ended', ({ by }) => {
        console.log('Socket.IO call_ended received, ended by:', by);
        cleanUpWebRTCSession();
        setCallState('idle');
        setCallSession(null);
      });

      socketRef.current.on('webrtc_ice_candidate', async ({ senderId, candidate }) => {
        console.log('Socket.IO ice candidate received from:', senderId);
        if (peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.log('Error adding ICE candidate:', e);
          }
        }
      });

      socketRef.current.on('call_failed', ({ message }) => {
        console.log('Socket.IO call_failed received:', message);
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

  // Sync database messages with state
  useEffect(() => {
    if (!messagesData || !currentUser) return;

    const currentId = (currentUser.id || currentUser._id)?.toString();
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
        if (found) return found;
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

    // Maintain any active temp messages
    setActiveChat((prev) => {
      if (prev && prev.id === activeChat.id) {
        const tempMessages = prev.messages.filter((m) => String(m.id).startsWith('temp-'));
        // If there are no messages, check if there's a match-init placeholder we want to keep
        if (formatted.length === 0 && prev.messages.some(m => m.id === 'match-init')) {
          return prev;
        }
        return {
          ...prev,
          messages: [...formatted, ...tempMessages],
        };
      }
      return prev;
    });

    setChats((prevChats) =>
      prevChats.map((c) => {
        if (c.id === activeChat.id) {
          const tempMessages = c.messages.filter((m) => String(m.id).startsWith('temp-'));
          if (formatted.length === 0 && c.messages.some(m => m.id === 'match-init')) {
            return c;
          }
          return {
            ...c,
            messages: [...formatted, ...tempMessages],
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
      const otherId = activeChat.id;

      const hasUnread = activeChat.messages.some(
        (m) => m.sender === 'them' && m.status !== 'seen'
      );

      if (hasUnread) {
        console.log(`Emitting mark_seen for messages from ${otherId} to ${currentId}`);
        socketRef.current.emit('mark_seen', {
          senderId: otherId,
          receiverId: currentId,
        });

        // Optimistically set the status of their messages to seen locally
        setChats((prevChats) =>
          prevChats.map((c) => {
            if (c.id === otherId) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.sender === 'them' ? { ...m, status: 'seen' } : m
                ),
              };
            }
            return c;
          })
        );
        setActiveChat((prevActive) => {
          if (prevActive && prevActive.id === otherId) {
            return {
              ...prevActive,
              messages: prevActive.messages.map((m) =>
                m.sender === 'them' ? { ...m, status: 'seen' } : m
              ),
            };
          }
          return prevActive;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.messages?.length, activeChat?.id, currentUser]);

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

    setChats((prevChats) =>
      prevChats.map((c) => {
        if (c.id === receiverId) {
          return {
            ...c,
            messages: [...c.messages, localMsg],
          };
        }
        return c;
      })
    );
    setActiveChat((prevActive) => {
      if (prevActive && prevActive.id === receiverId) {
        return {
          ...prevActive,
          messages: [...prevActive.messages, localMsg],
        };
      }
      return prevActive;
    });

    if (!customPayload) {
      setTypedMessage('');
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send_message', payload);
    } else {
      console.log('Client is offline: Queueing message locally.');
      setOfflineQueue((prev) => [...prev, { tempId, payload }]);
    }
  };

  const startRecording = async () => {
    try {
      setRecordTime('0:00');
      setRecordingSeconds(0);
      setIsRecording(true);

      // Start simulated duration timer
      let seconds = 0;
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = setInterval(() => {
        seconds += 1;
        setRecordingSeconds(seconds);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        setRecordTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }, 1000);

      // Try actual recording if instance is available
      if (audioRecorderPlayerRef.current) {
        try {
          const uri = await audioRecorderPlayerRef.current.startRecorder();
          console.log('Started voice recording: ', uri);
        } catch (err) {
          console.log('Error starting native recorder, fallback will be used:', err);
        }
      }
    } catch (e) {
      console.log('Error inside startRecording:', e);
    }
  };

  const stopRecording = async (shouldSend = true) => {
    try {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
      setIsRecording(false);

      let localUri = null;
      if (audioRecorderPlayerRef.current) {
        try {
          localUri = await audioRecorderPlayerRef.current.stopRecorder();
          console.log('Stopped voice recording: ', localUri);
        } catch (err) {
          console.log('Error stopping native recorder:', err);
        }
      }

      if (!shouldSend) {
        console.log('Recording cancelled by user.');
        return;
      }

      // Check duration
      if (recordingSeconds < 1) {
        Alert.alert('Too Short', 'Hold or record for at least 1 second.');
        return;
      }

      let audioUrl = '';
      let fileName = 'voice_note_' + Date.now() + '.mp4';
      let fileSize = 45000;

      // Try uploading actual recording
      let uploadSuccess = false;
      if (localUri) {
        try {
          const formattedUri = localUri.startsWith('file://') || localUri.startsWith('content://') ? localUri : `file://${localUri}`;
          const formData = new FormData();
          formData.append('file', {
            uri: formattedUri,
            name: fileName,
            type: 'audio/mp4',
          });
          const res = await apiClient.uploadChatMedia(formData);
          audioUrl = res.url;
          fileName = res.fileName || fileName;
          fileSize = res.fileSize || fileSize;
          uploadSuccess = true;
          console.log('Voice note uploaded successfully:', audioUrl);
        } catch (uploadErr) {
          console.log('Failed to upload native audio file, falling back to simulated:', uploadErr);
        }
      }

      // Fallback if simulation or upload failed
      if (!uploadSuccess) {
        const backendHost = 'localhost:5000';
        audioUrl = `http://${backendHost}/uploads/sample_voice.mp3`;
        fileName = 'sample_voice.mp3';
        fileSize = 32000;
        console.log('Using simulated fallback audio URL:', audioUrl);
      }

      // Send message
      handleSendMessage({
        messageType: 'voice',
        mediaUrl: audioUrl,
        fileName: fileName,
        fileSize: fileSize,
      });

    } catch (e) {
      console.log('Error inside stopRecording:', e);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  const playVoiceNote = async (messageId, audioUrl) => {
    try {
      if (playingMessageId === messageId) {
        // Toggle play/pause (stop playing if clicked on same message)
        await stopVoicePlayback();
        return;
      }

      // Stop current playback if active
      if (playingMessageId) {
        await stopVoicePlayback();
      }

      setPlayingMessageId(messageId);
      setPlaybackPosition(0);
      setPlaybackDuration(0);

      const resolvedUrl = getImageUrl(audioUrl);
      let startedNativePlayer = false;

      if (audioRecorderPlayerRef.current) {
        try {
          await audioRecorderPlayerRef.current.startPlayer(resolvedUrl);
          startedNativePlayer = true;
          audioRecorderPlayerRef.current.addPlayBackListener((e) => {
            setPlaybackPosition(e.currentPosition);
            setPlaybackDuration(e.duration);
            if (e.currentPosition >= e.duration) {
              stopVoicePlayback();
            }
          });
          console.log('Playing native voice note:', resolvedUrl);
        } catch (playerErr) {
          console.log('Native playback start failed, falling back to simulation:', playerErr);
        }
      }

      if (!startedNativePlayer) {
        console.log('Simulating playback for voice note:', resolvedUrl);
        let cur = 0;
        const dur = 5; // simulated 5 seconds duration
        setPlaybackDuration(dur * 1000);
        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = setInterval(() => {
          cur += 0.2;
          if (cur >= dur) {
            stopVoicePlayback();
          } else {
            setPlaybackPosition(cur * 1000);
          }
        }, 200);
      }
    } catch (e) {
      console.log('Error playing voice note:', e);
    }
  };

  const stopVoicePlayback = async () => {
    try {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      setPlayingMessageId(null);
      setPlaybackPosition(0);
      setPlaybackDuration(0);

      if (audioRecorderPlayerRef.current) {
        try {
          await audioRecorderPlayerRef.current.stopPlayer();
          audioRecorderPlayerRef.current.removePlayBackListener();
        } catch (_) {}
      }
    } catch (e) {
      console.log('Error stopping voice note playback:', e);
    }
  };

  const handleMessageLongPress = (msg) => {
    if (msg.sender !== 'you' || msg.id === 'match-init') return;

    const options = [];
    if (msg.messageType === 'text') {
      options.push({
        text: 'Edit Message',
        onPress: () => {
          setEditingMessage(msg);
          setTypedMessage(msg.text);
        },
      });
    }
    options.push({
      text: 'Delete Message',
      style: 'destructive',
      onPress: () => {
        Alert.alert(
          'Delete Message',
          'Are you sure you want to delete this message permanently?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await apiClient.deleteMessage(msg.id);
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

    Alert.alert('Message Options', 'Choose an action:', options, { cancelable: true });
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
              setMatchedUserIds((prevIds) => prevIds.filter((id) => id.toString() !== targetUserId.toString()));
              setProfiles((prevProfiles) => prevProfiles.filter((p) => p.id.toString() !== targetUserId.toString()));
              setLikedUsers((prevLikes) => prevLikes.filter((u) => u.id.toString() !== targetUserId.toString()));

              refetchQuestionnaires();
              refetchMatchesList();
              refetchMessages();
              refetchLikes();

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
        setMatchedUserIds((prevIds) => prevIds.filter((id) => id.toString() !== reportTargetUser.id.toString()));
        setProfiles((prevProfiles) => prevProfiles.filter((p) => p.id.toString() !== reportTargetUser.id.toString()));
        setLikedUsers((prevLikes) => prevLikes.filter((u) => u.id.toString() !== reportTargetUser.id.toString()));

        refetchQuestionnaires();
        refetchMatchesList();
        refetchMessages();
        refetchLikes();
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

  const handleSelectMockDocument = async (docName) => {
    setShowAttachmentModal(false);
    const formData = new FormData();
    formData.append('file', {
      uri: 'file:///android_asset/document.pdf',
      name: docName,
      type: 'application/pdf',
    });

    try {
      let docUrl = '';
      let fileSize = 15420;
      try {
        const res = await apiClient.uploadChatMedia(formData);
        docUrl = res.url;
        fileSize = res.fileSize;
      } catch (uploadErr) {
        console.log('Using static fallback for mock document:', uploadErr);
        const backendHost = '10.0.2.2:5000';
        docUrl = `http://${backendHost}/uploads/sample_document.pdf`;
      }

      handleSendMessage({
        messageType: 'document',
        mediaUrl: docUrl,
        fileName: docName,
        fileSize: fileSize,
      });
    } catch (err) {
      console.log('Document send failed:', err);
      Alert.alert('Error', 'Failed to send document.');
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <View style={styles.container}>
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

        {/* Tab Content Area */}
        <View style={styles.contentArea}>
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
              {swipeIndex < MOCK_MATCHES.length && (
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.actionCircle, styles.actionRewind, (swipeIndex === 0 && swipeHistory.length === 0) && { opacity: 0.5 }]}
                    onPress={handleUndoSwipe}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.actionIconText, styles.actionRewindText]}>⏪</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionCircle, styles.actionDislike]}
                    onPress={triggerSwipeLeft}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.actionIconText, styles.actionDislikeText]}>✖</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionCircle, styles.actionSuperLike]}
                    onPress={triggerSwipeRight}
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
                </View>
              )}
            </View>
          )}

          {activeTab === 'likes' && (
            <View style={styles.likesContainer}>
              <Text style={styles.sectionTitle}>People Who Liked You</Text>
              <Text style={styles.sectionSubtitle}>Tap a profile card to match instantly!</Text>
              {likesList.length > 0 ? (
                <ScrollView style={styles.likesGridScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.likesGrid}>
                    {likesList.map((item) => (
                      <View key={item.id} style={styles.likeGridCard}>
                        <View style={{ position: 'relative' }}>
                          <Image source={{ uri: getImageUrl(item.image) }} style={styles.likeGridImage} />
                          {!!onlineUsersMap[item.id.toString()] && (
                            <View style={[styles.onlineDotOverlay, { top: 8, left: 8, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#1E1E1E' }]} />
                          )}
                        </View>
                        <View style={styles.likeGridInfo}>
                          <Text style={styles.likeGridName}>{item.name}, {item.age}</Text>
                          <Text style={styles.likeGridDistance}>{item.distance}</Text>
                          
                          {/* Reject / Accept buttons */}
                          <View style={styles.likeGridCardActionRow}>
                            <TouchableOpacity
                              style={[styles.likeGridCardActionBtn, styles.likeGridCardActionBtnDislike]}
                              onPress={() => handleRejectLike(item)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.likeGridCardActionText, styles.likeGridCardActionTextDislike]}>✖</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                              style={[styles.likeGridCardActionBtn, styles.likeGridCardActionBtnLike]}
                              onPress={() => handleLikeMatch(item)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.likeGridCardActionText, styles.likeGridCardActionTextLike]}>♥</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.likeGridHeartBadge}>
                          <Text style={styles.likeGridHeartEmoji}>❤️</Text>
                        </View>
                      </View>
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
                <ChatScreen
                  activeChat={activeChat}
                  currentUser={currentUser}
                  messages={chatMessagesData || activeChat.messages || []}
                  isOnline={!!onlineUsersMap[activeChat.id.toString()]}
                  lastSeen={lastSeenMap[activeChat.id.toString()] || activeChat.lastSeen}
                  isTyping={isTyping}
                  onBack={() => setActiveChat(null)}
                  onSendMessage={async ({ text, type, imageUri }) => {
                    try {
                      if (type === 'image' && imageUri) {
                        const formData = new FormData();
                        formData.append('file', {
                          uri: imageUri,
                          name: 'chat_photo.jpg',
                          type: 'image/jpeg',
                        });
                        const uploadRes = await apiClient.uploadChatMedia(formData);
                        socketRef.current?.emit('send_message', {
                          senderId: currentUser.id || currentUser._id,
                          receiverId: activeChat.id,
                          text: uploadRes.url,
                          messageType: 'image',
                        });
                      } else {
                        socketRef.current?.emit('send_message', {
                          senderId: currentUser.id || currentUser._id,
                          receiverId: activeChat.id,
                          text,
                          messageType: type || 'text',
                        });
                      }
                      fetchMessages();
                    } catch (err) {
                      console.log('Error sending message:', err);
                    }
                  }}
                  onEditMessage={async (messageId, text) => {
                    try {
                      await apiClient.editMessage({ messageId, text });
                      fetchMessages();
                    } catch (err) {
                      console.log('Edit message error:', err);
                    }
                  }}
                  onDeleteMessage={async (messageId) => {
                    try {
                      await apiClient.deleteMessage(messageId);
                      fetchMessages();
                    } catch (err) {
                      console.log('Delete message error:', err);
                    }
                  }}
                  onClearChat={async () => {
                    try {
                      await apiClient.clearChat(activeChat.id);
                      setActiveChat(null);
                      fetchMessages();
                      Alert.alert('Cleared', 'Chat history cleared.');
                    } catch (err) {
                      console.log('Clear chat error:', err);
                    }
                  }}
                  onMakeVoiceCall={makeVoiceCall}
                  onOpenReportModal={(user) => {
                    setReportTargetUser(user);
                    setShowReportModal(true);
                  }}
                  onOpenBlockModal={(user) => {
                    setReportTargetUser(user);
                    setShowBlockModal(true);
                  }}
                  onUnmatchUser={async (user) => {
                    try {
                      await apiClient.unmatchUser({ targetUserId: user.id || user._id });
                      setActiveChat(null);
                      fetchMatchesList();
                      fetchQuestionnaires();
                      Alert.alert('Unmatched', `You have unmatched ${user.name}.`);
                    } catch (err) {
                      console.log('Unmatch error:', err);
                    }
                  }}
                />
              ) : (
                /* Chat List view */
                <View style={styles.chatListWrapper}>
                  <View style={styles.chatListHeaderRow}>
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
                      {chats.map((chat) => (
                        <TouchableOpacity
                          key={chat.id}
                          style={styles.chatRow}
                          onPress={() => setActiveChat(chat)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.avatarWrapper}>
                            <Image source={{ uri: getImageUrl(chat.image) }} style={styles.chatRowAvatar} />
                            {!!onlineUsersMap[chat.id.toString()] && (
                              <View style={styles.onlineDotOverlay} />
                            )}
                          </View>
                          <View style={styles.chatRowInfo}>
                            <Text style={styles.chatRowName}>{chat.name}</Text>
                            <Text style={styles.chatRowLastMessage} numberOfLines={1}>
                              {(() => {
                                const lastMsg = chat.messages[chat.messages.length - 1];
                                if (!lastMsg) return '';
                                if (lastMsg.messageType === 'voice') return '🎤 Voice Note';
                                if (lastMsg.messageType === 'image') return '📷 Image';
                                if (lastMsg.messageType === 'document') return '📄 Document';
                                if (lastMsg.messageType === 'sticker') return '😊 Sticker';
                                return lastMsg.text || '';
                              })()}
                            </Text>
                          </View>
                          <Text style={styles.chatRowTime}>Now</Text>
                        </TouchableOpacity>
                      ))}
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
            />
          )}
        </View>

        {/* Home Screen Navigation Bar */}
        <View style={styles.navigationBar}>
          <TouchableOpacity
            style={[styles.navigationTab, activeTab === 'swipe' && styles.navigationTabActive]}
            onPress={() => {
              setActiveTab('swipe');
              setActiveChat(null);
            }}
          >
            <Text style={styles.navigationIcon}>🔥</Text>
            <Text style={[styles.navigationLabel, activeTab === 'swipe' && styles.navigationLabelActive]}>
              Swipe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navigationTab, activeTab === 'likes' && styles.navigationTabActive]}
            onPress={() => {
              setActiveTab('likes');
              setActiveChat(null);
            }}
          >
            <Text style={styles.navigationIcon}>❤️</Text>
            <Text style={[styles.navigationLabel, activeTab === 'likes' && styles.navigationLabelActive]}>
              Likes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navigationTab, activeTab === 'chat' && styles.navigationTabActive]}
            onPress={() => {
              setActiveTab('chat');
            }}
          >
            <Text style={styles.navigationIcon}>💬</Text>
            <Text style={[styles.navigationLabel, activeTab === 'chat' && styles.navigationLabelActive]}>
              Chat
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navigationTab, activeTab === 'profile' && styles.navigationTabActive]}
            onPress={() => {
              setActiveTab('profile');
              setActiveChat(null);
            }}
          >
            <Text style={styles.navigationIcon}>👤</Text>
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
            <View style={styles.candidateDetailsWrapper}>
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
                {/* Image at the top */}
                <Image
                  source={{ uri: getImageUrl(MOCK_MATCHES[swipeIndex].image) }}
                  style={styles.cardExpandedTopImageFull}
                />

                {/* Details below image */}
                <View style={styles.cardExpandedContentPadding}>
                  <View style={styles.matchNameRow}>
                    <Text style={styles.matchNameTextLarge}>
                      {MOCK_MATCHES[swipeIndex].name}, {MOCK_MATCHES[swipeIndex].age}
                    </Text>
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
                          setReportTargetUser(targetCandidate);
                          setShowReportModal(true);
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
                          setReportTargetUser(targetCandidate);
                          setShowBlockModal(true);
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
                  <Text style={styles.voiceCallStatus}>Calling...</Text>
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
                      {/* Mute Button */}
                      {callState === 'connected' && (
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
                      )}

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
                      {callState === 'connected' && (
                        <TouchableOpacity
                          style={[styles.voiceCallRoundButton, isSpeakerOn && styles.voiceCallRoundButtonActive]}
                          onPress={toggleSpeaker}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.voiceCallRoundButtonEmoji}>🔊</Text>
                          <Text style={styles.voiceCallRoundButtonText}>Speaker</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        )}

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

        {/* Reusable Block & Report User Modals */}
        <BlockReportModal
          visible={showReportModal}
          type="report"
          targetUser={reportTargetUser}
          isSubmitting={isSubmittingReport}
          onClose={() => setShowReportModal(false)}
          onConfirmReport={async ({ targetUserId, reason, details, alsoBlock }) => {
            try {
              setIsSubmittingReport(true);
              await apiClient.reportUser({ targetUserId, reason, details });
              if (alsoBlock) {
                await apiClient.blockUser({ targetUserId });
              }
              setShowReportModal(false);
              setReportTargetUser(null);
              setActiveChat(null);
              refetchMatchesList();
              refetchQuestionnaires();
              Alert.alert('Report Submitted', 'Thank you for helping keep our community safe.');
            } catch (err) {
              console.log('Report user error:', err);
              Alert.alert('Error', 'Failed to submit report.');
            } finally {
              setIsSubmittingReport(false);
            }
          }}
        />

        <BlockReportModal
          visible={showBlockModal}
          type="block"
          targetUser={reportTargetUser}
          isSubmitting={isSubmittingReport}
          onClose={() => setShowBlockModal(false)}
          onConfirmBlock={async (targetUserId) => {
            try {
              setIsSubmittingReport(true);
              await apiClient.blockUser({ targetUserId });
              setShowBlockModal(false);
              setReportTargetUser(null);
              setActiveChat(null);
              refetchMatchesList();
              refetchQuestionnaires();
              Alert.alert('User Blocked', 'This user has been blocked.');
            } catch (err) {
              console.log('Block user error:', err);
              Alert.alert('Error', 'Failed to block user.');
            } finally {
              setIsSubmittingReport(false);
            }
          }}
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
    height: 65,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 10 : 0,
  },
  navigationTab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
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
  navigationLabelActive: {
    color: '#FE3C72',
    fontWeight: '800',
  },

  // Swipe Tab Styles
  swipeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    position: 'relative',
  },
  stackContainer: {
    width: '100%',
    height: '90%',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  interestMiniText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  commonInterestHighlightBadge: {
    backgroundColor: '#FE3C72',
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
    backgroundColor: 'rgba(254, 60, 114, 0.35)',
    borderWidth: 1,
    borderColor: '#FE3C72',
  },
  commonInterestTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  actionButtonsRow: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    width: (SCREEN_WIDTH - 50) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  detailCardEmoji: {
    fontSize: 16,
    marginRight: 10,
  },
  detailCardText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: 'rgba(254, 60, 114, 0.18)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginVertical: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
  },
  cardDetailToggleArrow: {
    color: '#FE3C72',
    fontSize: 11,
    marginRight: 5,
    fontWeight: 'bold',
  },
  cardDetailToggleLabel: {
    color: '#FE3C72',
    fontSize: 10,
    fontWeight: '700',
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
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    flex: 1,
  },
  recordingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingPulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingTimeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelRecordButton: {
    marginRight: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  cancelRecordText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  sendRecordButton: {
    backgroundColor: '#FE3C72',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  sendRecordIcon: {
    color: '#FFF',
    fontSize: 13,
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
});
