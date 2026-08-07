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
} from 'react-native';
import { getImageUrl } from '../api/config';

export const PreviewModal = ({
  visible,
  photos = [],
  initialIndex = 0,
  userName = 'My Status',
  userAvatar,
  onClose,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const STORY_DURATION = 4000; // 4 seconds per story status photo

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
  }, [initialIndex, visible]);

  useEffect(() => {
    if (!visible || photos.length === 0 || isPaused) return;

    const intervalTime = 40; // update progress every 40ms
    const stepIncrement = intervalTime / STORY_DURATION;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) {
          clearInterval(timer);
          handleNextStory();
          return 0;
        }
        return prev + stepIncrement;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [visible, currentIndex, isPaused, photos.length]);

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

  const handleScreenPress = (evt) => {
    const xLocation = evt.nativeEvent.locationX;
    if (xLocation < windowWidth * 0.35) {
      handlePrevStory();
    } else {
      handleNextStory();
    }
  };

  const formatImageUri = (url) => {
    if (!url) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600';
    return getImageUrl(url);
  };

  const isVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return (
      lower.endsWith('.mp4') ||
      lower.endsWith('.mov') ||
      lower.endsWith('.webm') ||
      lower.endsWith('.3gp') ||
      lower.includes('/video/upload/') ||
      lower.includes('video')
    );
  };

  if (!visible || photos.length === 0) return null;

  const rawPhoto = photos[currentIndex] || photos[0];
  const currentPhoto = formatImageUri(rawPhoto);
  const avatarUri = formatImageUri(userAvatar || rawPhoto);
  const isCurrentVideo = isVideoUrl(rawPhoto || currentPhoto);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Status Image / Video Touch Controller */}
        <TouchableWithoutFeedback
          onPress={handleScreenPress}
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
        >
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: currentPhoto }}
              style={[styles.fullImage, { width: windowWidth, height: windowHeight }]}
              resizeMode="contain"
            />
            {isCurrentVideo && (
              <View style={styles.videoOverlayContainer}>
                <View style={styles.playIconCircle}>
                  <Text style={styles.playIconText}>▶</Text>
                </View>
                <Text style={styles.videoBadgeText}>Preview Video</Text>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* Top Header Overlay Bar */}
        <SafeAreaView style={styles.topHeaderContainer}>
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
          <View style={styles.userInfoRow}>
            <View style={styles.userProfileGroup}>
              <View style={styles.statusAvatarRing}>
                <Image source={{ uri: avatarUri }} style={styles.userAvatar} />
              </View>
              <View style={styles.userTextCol}>
                <Text style={styles.userNameText}>{userName}</Text>
                <Text style={styles.statusTimeText}>
                  Photo {currentIndex + 1} of {photos.length} • Just now
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Bottom Caption Banner */}
        <View style={styles.bottomCaptionContainer}>
          <Text style={styles.captionText}>
            {currentIndex === 0 ? '⭐ Main Profile Picture' : `📸 Profile Photo #${currentIndex + 1}`}
          </Text>
        </View>
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
});

export default PreviewModal;
