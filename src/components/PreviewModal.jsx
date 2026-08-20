import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Video from 'react-native-video';
import { getImageUrl, getVideoThumbnailUrl, isVideoUrl as checkIsVideoUrl } from '../api/config';

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
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  const [detectedDuration, setDetectedDuration] = useState(null);

  // Three Dots options menu state & hidden media set
  const [menuVisible, setMenuVisible] = useState(false);
  const [hiddenIndices, setHiddenIndices] = useState(new Set());

  const showHideOptionsBtn = isOwnProfile && (typeof onHideMedia === 'function' || typeof onUnhideMedia === 'function');

  const IMAGE_DURATION = 4000; // 4 seconds for images
  const DEFAULT_VIDEO_DURATION = 15000; // fallback max 15 seconds for video status items

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
    setMediaError(false);
    setIsPaused(false);
    setDetectedDuration(null);
    setMenuVisible(false);
    setHiddenIndices(new Set());
  }, [initialIndex, visible]);

  useEffect(() => {
    setMediaError(false);
    setProgress(0);
    setIsPaused(false);
    setDetectedDuration(null);
  }, [currentIndex]);

  const rawPhoto = photos[currentIndex] || photos[0];
  const isCurrentVideo = checkIsVideoUrl(rawPhoto);
  const activeDuration = isCurrentVideo
    ? Math.min(15000, Math.max(2000, detectedDuration || DEFAULT_VIDEO_DURATION))
    : IMAGE_DURATION;

  useEffect(() => {
    // Only run setInterval timer for static images (videos use native onProgress/onEnd)
    if (!visible || photos.length === 0 || isPaused || isCurrentVideo) return;

    const intervalTime = 40;
    const stepIncrement = intervalTime / IMAGE_DURATION;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const nextProgress = prev + stepIncrement;
        if (nextProgress >= 1) {
          clearInterval(timer);
          return 1;
        }
        return nextProgress;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [visible, currentIndex, isPaused, photos.length, isCurrentVideo]);

  // Safely trigger story advance for images when progress reaches 100%
  useEffect(() => {
    if (!isCurrentVideo && progress >= 1) {
      handleNextStory();
    }
  }, [progress, isCurrentVideo]);

  const handleNextStory = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    } else {
      setProgress(0);
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
      setProgress(0);
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
      setProgress(0);
    }
  };

  const pressStartTimeRef = React.useRef(0);

  const handlePressIn = () => {
    pressStartTimeRef.current = Date.now();
    setIsPaused(true);
  };

  const handlePressOut = () => {
    setIsPaused(false);
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
    return getImageUrl(url);
  };

  if (!visible || photos.length === 0) return null;

  const currentMediaUri = formatImageUri(rawPhoto);
  const avatarUri = getVideoThumbnailUrl(userAvatar || rawPhoto);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
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
                  onProgress={(data) => {
                    if (!isPaused && data && data.seekableDuration && data.seekableDuration > 0) {
                      const ratio = data.currentTime / data.seekableDuration;
                      setProgress(Math.min(1, Math.max(0, ratio)));
                    }
                  }}
                  onEnd={handleNextStory}
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
        <SafeAreaView style={[styles.topHeaderContainer, { opacity: isPaused ? 0 : 1 }]} pointerEvents="box-none">
          {/* Segmented Progress Bar */}
          <View style={styles.progressRow}>
            {photos.map((_, idx) => {
              let fillWidth = '0%';
              if (idx < currentIndex) {
                fillWidth = '100%';
              } else if (idx === currentIndex) {
                fillWidth = `${Math.min(progress * 100, 100)}%`;
              }
              return (
                <View key={idx} style={styles.progressSegmentBg}>
                  <View style={[styles.progressSegmentFill, { width: fillWidth }]} />
                </View>
              );
            })}
          </View>

          {/* User Info Bar */}
          <View style={styles.userInfoRow} pointerEvents="box-none">
            <View style={styles.userProfileGroup}>
              <View style={styles.statusAvatarRing}>
                <Image source={{ uri: avatarUri }} style={styles.userAvatar} />
              </View>
              <View style={styles.userTextCol}>
                <Text style={styles.userNameText}>{userName}</Text>
                <Text style={styles.statusTimeText}>
                  {isCurrentVideo ? '📹 Video' : '📸 Photo'} {currentIndex + 1} of {photos.length} • Just now
                </Text>
              </View>
            </View>

            <View style={styles.headerRightControls}>
              {showHideOptionsBtn && (
                <TouchableOpacity
                  style={styles.threeDotsBtn}
                  onPress={() => {
                    setIsPaused(true);
                    setMenuVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.threeDotsText}>⋮</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {/* Bottom Caption Banner - Fades out on Long Press like WhatsApp Status */}
        <View style={[styles.bottomCaptionContainer, { opacity: isPaused ? 0 : 1 }]} pointerEvents="none">
          <Text style={styles.captionText}>
            {currentIndex === 0 ? '⭐ Main Profile Picture' : `${isCurrentVideo ? '📹 Video' : '📸 Profile Photo'} #${currentIndex + 1}`}
          </Text>
        </View>

        {/* Three Dots Options Menu Modal (Only visible when managing own profile media) */}
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
