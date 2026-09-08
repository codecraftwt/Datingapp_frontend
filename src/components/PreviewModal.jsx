import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Alert,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getImageUrl, getVideoThumbnailUrl, isVideoUrl as checkIsVideoUrl } from '../api/config';

export const formatMediaUploadTime = (photoItem, uploadTimes, index, uploadTime, fallbackTime, mediaTimestamps) => {
  let timeVal = null;

  // Extract URL string from photoItem
  let urlStr = '';
  if (typeof photoItem === 'string') {
    urlStr = photoItem;
  } else if (photoItem && typeof photoItem === 'object') {
    urlStr = photoItem.url || photoItem.uri || photoItem.secure_url || photoItem.path || photoItem.mediaUrl || '';
  }

  // 1. Try matching against mediaTimestamps dictionary
  if (mediaTimestamps && typeof mediaTimestamps === 'object') {
    if (urlStr) {
      const trimmedUrl = urlStr.trim();
      const cleanUrl = trimmedUrl.split('?')[0];

      // Direct exact match or clean URL match
      timeVal = mediaTimestamps[urlStr] || mediaTimestamps[trimmedUrl] || mediaTimestamps[cleanUrl];

      // Match without protocol or host
      if (!timeVal) {
        const urlWithoutProtocol = cleanUrl.replace(/^https?:\/\//i, '');
        const matchKey = Object.keys(mediaTimestamps).find((k) => {
          if (!k) return false;
          const cleanK = String(k).split('?')[0].replace(/^https?:\/\//i, '');
          return cleanK === urlWithoutProtocol || cleanUrl.includes(cleanK) || String(k).includes(cleanUrl);
        });
        if (matchKey) timeVal = mediaTimestamps[matchKey];
      }

      // Match by filename / basename (e.g. photo_123.jpg or upload_123.mp4)
      if (!timeVal) {
        const filename = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1);
        if (filename && filename.length > 3) {
          const matchKey = Object.keys(mediaTimestamps).find((k) => {
            if (!k) return false;
            const keyStr = String(k);
            const keyFilename = keyStr.substring(keyStr.lastIndexOf('/') + 1);
            return keyStr.includes(filename) || filename.includes(keyFilename);
          });
          if (matchKey) timeVal = mediaTimestamps[matchKey];
        }
      }
    }

    // Index-based lookup fallback in mediaTimestamps
    if (!timeVal && typeof index === 'number') {
      const keys = Object.keys(mediaTimestamps);
      if (keys[index] && mediaTimestamps[keys[index]]) {
        timeVal = mediaTimestamps[keys[index]];
      } else if (mediaTimestamps[index] || mediaTimestamps[String(index)]) {
        timeVal = mediaTimestamps[index] || mediaTimestamps[String(index)];
      }
    }
  }

  // 2. Try object fields in photoItem
  if (!timeVal && photoItem && typeof photoItem === 'object') {
    timeVal = photoItem.uploadedAt || photoItem.createdAt || photoItem.timestamp || photoItem.updatedAt || photoItem.time;
  }

  // 3. Try uploadTimes array
  if (!timeVal && Array.isArray(uploadTimes) && uploadTimes[index]) {
    timeVal = uploadTimes[index];
  }

  // 4. Try uploadTime prop
  if (!timeVal && uploadTime) {
    timeVal = uploadTime;
  }

  // 5. Try extracting timestamp embedded in Cloudinary / File URL (e.g. /v1725789000/ or file_1725789000)
  if (!timeVal && urlStr) {
    // Cloudinary version tag match: /v(\d{9,13})/
    const vMatch = urlStr.match(/\/v(\d{9,13})\//);
    if (vMatch && vMatch[1]) {
      const sec = parseInt(vMatch[1], 10);
      if (!isNaN(sec) && sec > 1000000000) {
        timeVal = sec < 10000000000 ? sec * 1000 : sec;
      }
    }

    // Generic UNIX timestamp in filename: 1725789000000
    if (!timeVal) {
      const tsMatch = urlStr.match(/(\d{10,13})/);
      if (tsMatch && tsMatch[1]) {
        const ts = parseInt(tsMatch[1], 10);
        if (!isNaN(ts) && ts > 1500000000) {
          timeVal = ts < 10000000000 ? ts * 1000 : ts;
        }
      }
    }
  }

  // 6. Try fallbackTime (e.g. user createdAt / updatedAt)
  if (!timeVal && fallbackTime) {
    timeVal = fallbackTime;
  }

  // If no date timestamp is available, return 'Uploaded recently' instead of current clock time
  if (!timeVal) {
    return 'Uploaded recently';
  }

  try {
    const d = new Date(timeVal);
    if (isNaN(d.getTime())) {
      return String(timeVal);
    }

    const now = new Date();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Yesterday at ${timeStr}`;
    }

    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr} at ${timeStr}`;
  } catch (e) {
    return 'Uploaded recently';
  }
};

export const PreviewModal = ({
  visible,
  photos = [],
  initialIndex = 0,
  userName = 'My Status',
  userAvatar,
  onClose,
  onHideMedia,
  onUnhideMedia,
  isHiddenMode = false,
  isOwnProfile = false,
  mediaTimestamps,
  uploadTimes,
  uploadTime,
  userUpdatedAt,
  updatedAt,
  createdAt,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0;
  const topInset = Math.max(insets.top || 0, statusBarHeight) + 10;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  const [detectedDuration, setDetectedDuration] = useState(null);

  // WhatsApp Status Smooth Animated Progress Value
  const progressAnim = useRef(new Animated.Value(0)).current;
  const currentAnimValueRef = useRef(0);
  const pausedValueRef = useRef(0);
  const currentDurationRef = useRef(5000);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    const listenerId = progressAnim.addListener(({ value }) => {
      currentAnimValueRef.current = value;
    });
    return () => {
      progressAnim.removeListener(listenerId);
    };
  }, [progressAnim]);

  // Three Dots options menu state & hidden media set
  const [menuVisible, setMenuVisible] = useState(false);
  const [hiddenIndices, setHiddenIndices] = useState(new Set());

  const showHideOptionsBtn = isOwnProfile && (typeof onHideMedia === 'function' || typeof onUnhideMedia === 'function');

  const IMAGE_DURATION = 5000; // 5 seconds smooth fill for status photos
  const DEFAULT_VIDEO_DURATION = 15000; // fallback max 15 seconds for video status items

  const rawPhoto = photos[currentIndex] || photos[0];
  const isCurrentVideo = checkIsVideoUrl(rawPhoto);

  const startAnimation = (fromValue = 0, durationMs = IMAGE_DURATION) => {
    progressAnim.stopAnimation();
    progressAnim.setValue(fromValue);
    currentDurationRef.current = durationMs;
    pausedValueRef.current = fromValue;
    currentAnimValueRef.current = fromValue;
    isAnimatingRef.current = true;

    const remainingMs = Math.max(0, (1 - fromValue) * durationMs);
    if (remainingMs <= 10) {
      handleNextStory();
      return;
    }

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: remainingMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        isAnimatingRef.current = false;
        handleNextStory();
      }
    });
  };

  const pauseAnimation = () => {
    progressAnim.stopAnimation((val) => {
      pausedValueRef.current = val;
      currentAnimValueRef.current = val;
      isAnimatingRef.current = false;
    });
  };

  const resumeAnimation = () => {
    const val = currentAnimValueRef.current || pausedValueRef.current;
    if (val < 0.99) {
      startAnimation(val, currentDurationRef.current);
    } else {
      handleNextStory();
    }
  };

  useEffect(() => {
    setCurrentIndex(initialIndex);
    progressAnim.setValue(0);
    pausedValueRef.current = 0;
    setMediaError(false);
    setIsPaused(false);
    setDetectedDuration(null);
    setMenuVisible(false);
    setHiddenIndices(new Set());
  }, [initialIndex, visible]);

  useEffect(() => {
    setMediaError(false);
    progressAnim.setValue(0);
    pausedValueRef.current = 0;
    setIsPaused(false);
    setDetectedDuration(null);

    if (visible && photos.length > 0) {
      const dur = isCurrentVideo ? (detectedDuration || DEFAULT_VIDEO_DURATION) : IMAGE_DURATION;
      startAnimation(0, dur);
    }

    return () => {
      progressAnim.stopAnimation();
    };
  }, [currentIndex, visible]);

  const handleNextStory = () => {
    progressAnim.stopAnimation();
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrevStory = () => {
    progressAnim.stopAnimation();
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      const dur = isCurrentVideo ? (detectedDuration || DEFAULT_VIDEO_DURATION) : IMAGE_DURATION;
      startAnimation(0, dur);
    }
  };

  const handleHideCurrentMedia = () => {
    setMenuVisible(false);
    setIsPaused(false);

    const targetMedia = rawPhoto;
    const targetIdx = currentIndex;

    const nextHidden = new Set(hiddenIndices);
    nextHidden.add(targetIdx);
    setHiddenIndices(nextHidden);

    if (onHideMedia) {
      onHideMedia(targetMedia, targetIdx);
    }

    const remainingIndices = photos
      .map((_, i) => i)
      .filter((i) => !nextHidden.has(i));

    if (remainingIndices.length === 0) {
      onClose();
    } else {
      const nextTarget = remainingIndices.find((i) => i >= targetIdx) ?? remainingIndices[0];
      setCurrentIndex(nextTarget);
    }
  };

  const handleUnhideCurrentMedia = () => {
    setMenuVisible(false);
    setIsPaused(false);

    const targetMedia = rawPhoto;
    const targetIdx = currentIndex;

    const nextHidden = new Set(hiddenIndices);
    nextHidden.add(targetIdx);
    setHiddenIndices(nextHidden);

    if (onUnhideMedia) {
      onUnhideMedia(targetMedia, targetIdx);
    }

    const remainingIndices = photos
      .map((_, i) => i)
      .filter((i) => !nextHidden.has(i));

    if (remainingIndices.length === 0) {
      onClose();
    } else {
      const nextTarget = remainingIndices.find((i) => i >= targetIdx) ?? remainingIndices[0];
      setCurrentIndex(nextTarget);
    }
  };

  const pressStartTimeRef = React.useRef(0);

  const handlePressIn = () => {
    pressStartTimeRef.current = Date.now();
    setIsPaused(true);
    pauseAnimation();
  };

  const handlePressOut = () => {
    setIsPaused(false);
    resumeAnimation();
  };

  const handleScreenPress = (evt) => {
    const pressDuration = Date.now() - pressStartTimeRef.current;
    // If user held down on screen (> 250ms), releasing is just ending the hold -- DO NOT skip or advance story!
    if (pressDuration > 250) {
      return;
    }

    const xLocation = evt.nativeEvent.locationX;
    if (xLocation < windowWidth * 0.3) {
      handlePrevStory();
    } else if (xLocation > windowWidth * 0.7) {
      handleNextStory();
    }
  };

  const formatImageUri = (url) => {
    if (!url) return '';
    if (typeof url === 'object') {
      const extracted = url.url || url.uri || url.path || url.secure_url || url.mediaUrl || '';
      return getImageUrl(extracted);
    }
    return getImageUrl(url);
  };

  if (!visible || photos.length === 0) return null;

  const currentMediaUri = formatImageUri(rawPhoto);
  const avatarUri = getVideoThumbnailUrl(
    typeof userAvatar === 'object'
      ? (userAvatar.url || userAvatar.uri || userAvatar.path || '')
      : (userAvatar || rawPhoto)
  );

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Status Image / Video Touch Controller */}
        <TouchableWithoutFeedback
          onPress={handleScreenPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View style={styles.imageWrapper}>
            {isCurrentVideo ? (
              <View style={[styles.fullImage, { width: windowWidth, height: windowHeight }]} pointerEvents="none">
                <Video
                  source={{ uri: currentMediaUri }}
                  style={{ width: windowWidth, height: windowHeight }}
                  resizeMode="contain"
                  paused={isPaused}
                  repeat={false}
                  controls={false}
                  onLoad={(meta) => {
                    if (meta && meta.duration && meta.duration > 0) {
                      const durMs = Math.min(15000, meta.duration * 1000);
                      setDetectedDuration(durMs);
                      if (!isPaused) {
                        startAnimation(0, durMs);
                      }
                    }
                  }}
                  onProgress={(data) => {
                    if (!isPaused && data && data.seekableDuration && data.seekableDuration > 0) {
                      const totalDurMs = Math.min(15000, data.seekableDuration * 1000);
                      const ratio = data.currentTime / data.seekableDuration;
                      if (!isAnimatingRef.current || Math.abs(currentAnimValueRef.current - ratio) > 0.2) {
                        startAnimation(ratio, totalDurMs);
                      }
                    }
                  }}
                  onEnd={() => {
                    progressAnim.stopAnimation();
                    handleNextStory();
                  }}
                  onError={(err) => {
                    console.log('Error playing in-app video:', err);
                    setMediaError(true);
                  }}
                />
              </View>
            ) : (
              <Image
                source={{ uri: currentMediaUri }}
                style={[styles.fullImage, { width: windowWidth, height: windowHeight }]}
                resizeMode="contain"
                onError={() => setMediaError(true)}
              />
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* Top Header Overlay Bar - Fades out on Long Press like WhatsApp Status */}
        <View style={[styles.topHeaderContainer, { paddingTop: topInset, opacity: isPaused ? 0 : 1 }]} pointerEvents="box-none">
          {/* Segmented Progress Bar */}
          <View style={styles.progressRow}>
            {photos.map((_, idx) => {
              let animatedWidth;
              if (idx < currentIndex) {
                animatedWidth = '100%';
              } else if (idx === currentIndex) {
                animatedWidth = progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                });
              } else {
                animatedWidth = '0%';
              }

              return (
                <View key={idx} style={styles.progressSegmentBg}>
                  <Animated.View
                    style={[
                      styles.progressSegmentFill,
                      { width: animatedWidth },
                    ]}
                  />
                </View>
              );
            })}
          </View>

          <View style={styles.userInfoRow} pointerEvents="box-none">
            <View style={styles.userProfileGroup}>
              <View style={styles.statusAvatarRing}>
                <Image source={{ uri: avatarUri }} style={styles.userAvatar} />
              </View>
              <View style={styles.userTextCol}>
                <Text style={styles.userNameText}>{userName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={isCurrentVideo ? "videocam-outline" : "camera-outline"} size={13} color="rgba(255, 255, 255, 0.7)" style={{ marginRight: 4 }} />
                  <Text style={styles.statusTimeText}>
                    {currentIndex + 1} of {photos.length} • {formatMediaUploadTime(rawPhoto, uploadTimes, currentIndex, uploadTime, userUpdatedAt || updatedAt || createdAt, mediaTimestamps)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.headerRightControls}>
              {showHideOptionsBtn && (
                <TouchableOpacity style={styles.threeDotsBtn} onPress={() => { setIsPaused(true); setMenuVisible(true); }}>
                  <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.bottomCaptionContainer, { paddingBottom: Math.max(insets.bottom || 0, 20), opacity: isPaused ? 0 : 1 }]} pointerEvents="none">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {currentIndex === 0 && <Ionicons name="star" size={14} color="#FFD700" style={{ marginRight: 5 }} />}
            <Text style={styles.captionText}>
              {currentIndex === 0 ? 'Main Profile Picture' : `${isCurrentVideo ? 'Video' : 'Profile Photo'} #${currentIndex + 1}`}
            </Text>
          </View>
        </View>

        {showHideOptionsBtn && (
          <Modal
            visible={menuVisible}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setMenuVisible(false);
              setIsPaused(false);
            }}
          >
            <TouchableWithoutFeedback
              onPress={() => {
                setMenuVisible(false);
                setIsPaused(false);
              }}
            >
              <View style={styles.menuOverlay}>
                <TouchableWithoutFeedback>
                  <View style={styles.menuCard}>
                    <View style={styles.menuHeaderRow}>
                      <Text style={styles.menuHeaderTitle}>Media Options</Text>
                    </View>

                    {isHiddenMode ? (
                      <TouchableOpacity
                        style={styles.menuOptionBtn}
                        onPress={handleUnhideCurrentMedia}
                        activeOpacity={0.8}
                      >
                        <View style={styles.menuOptionIconBox}>
                          <Text style={styles.menuOptionIcon}>👁️</Text>
                        </View>
                        <View style={styles.menuOptionTextCol}>
                          <Text style={styles.menuOptionText}>Unhide {isCurrentVideo ? 'Video' : 'Image'}</Text>
                          <Text style={styles.menuOptionSubText}>Restore this {isCurrentVideo ? 'video clip' : 'image'} to your public profile</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.menuOptionBtn}
                        onPress={handleHideCurrentMedia}
                        activeOpacity={0.8}
                      >

                        <View style={styles.menuOptionTextCol}>
                          <Text style={styles.menuOptionText}>Hide {isCurrentVideo ? 'Video' : 'Image'}</Text>
                          <Text style={styles.menuOptionSubText}>Remove this {isCurrentVideo ? 'video clip' : 'image'} from preview</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.menuCancelBtn}
                      onPress={() => {
                        setMenuVisible(false);
                        setIsPaused(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.menuCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  topHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 10,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressSegmentBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    marginHorizontal: 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressSegmentFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  userProfileGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusAvatarRing: {
    padding: 2,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FE3C72',
    marginRight: 10,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  userTextCol: {
    justifyContent: 'center',
  },
  userNameText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  statusTimeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  bottomCaptionContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  videoOverlayContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
  },
  playIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF4458',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  playIconText: {
    color: '#FFFFFF',
    fontSize: 24,
    marginLeft: 4,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  videoFallbackBox: {
    width: '80%',
    height: 300,
    backgroundColor: '#1E1E2C',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3897F0',
  },
  whatsappCenterPlayOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  whatsappPlayRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FE3C72',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 12,
  },
  whatsappPlayIcon: {
    color: '#FFFFFF',
    fontSize: 32,
    marginLeft: 6,
  },
  whatsappBadgePill: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FE3C72',
  },
  whatsappBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  whatsappTapHint: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginTop: 6,
  },
  whatsappVideoCard: {
    width: '85%',
    paddingVertical: 36,
    paddingHorizontal: 24,
    backgroundColor: '#181824',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FE3C72',
  },
  whatsappVideoTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  whatsappVideoSub: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  whatsappPlayBtn: {
    marginTop: 20,
    backgroundColor: '#FE3C72',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  whatsappPlayBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  threeDotsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  threeDotsText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  menuCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1C1C26',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  menuHeaderRow: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 10,
  },
  menuHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  menuOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 77, 77, 0.12)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 77, 0.3)',
    marginBottom: 12,
  },
  menuOptionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 77, 77, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuOptionIcon: {
    fontSize: 20,
  },
  menuOptionTextCol: {
    flex: 1,
  },
  menuOptionText: {
    color: '#FF4D4D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuOptionSubText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  menuCancelBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCancelText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default PreviewModal;
