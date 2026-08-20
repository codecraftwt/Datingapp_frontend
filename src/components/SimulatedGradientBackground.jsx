import React from 'react';
import { StyleSheet, View, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export const SimulatedGradientBackground = ({ children }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Base background color: vibrant coral orange */}
      <View style={styles.baseBg} />

      {/* Primary gradient simulator: huge hot-pink glow positioned from the bottom right */}
      <View style={styles.glowPink} />

      {/* Decorative concentric rings (Radar / Ripple Effect matching the screenshot) */}
      <View style={[styles.rippleRing, { width: width * 1.6, height: width * 1.6, borderRadius: (width * 1.6) / 2, opacity: 0.04, top: -width * 0.4, alignSelf: 'center' }]} />
      <View style={[styles.rippleRing, { width: width * 1.2, height: width * 1.2, borderRadius: (width * 1.2) / 2, opacity: 0.07, top: -width * 0.2, alignSelf: 'center' }]} />
      <View style={[styles.rippleRing, { width: width * 0.8, height: width * 0.8, borderRadius: (width * 0.8) / 2, opacity: 0.1, top: 0, alignSelf: 'center' }]} />
      <View style={[styles.rippleRing, { width: width * 0.45, height: width * 0.45, borderRadius: (width * 0.45) / 2, opacity: 0.14, top: width * 0.18, alignSelf: 'center' }]} />

      {/* Additional small floating background hearts/circles */}
      <View style={[styles.floatingCircle, { width: 12, height: 12, borderRadius: 6, top: height * 0.15, left: width * 0.1, opacity: 0.25 }]} />
      <View style={[styles.floatingCircle, { width: 24, height: 24, borderRadius: 12, top: height * 0.45, right: width * 0.08, opacity: 0.15 }]} />
      <View style={[styles.floatingCircle, { width: 16, height: 16, borderRadius: 8, bottom: height * 0.25, left: width * 0.15, opacity: 0.2 }]} />
      <View style={[styles.floatingCircle, { width: 8, height: 8, borderRadius: 4, bottom: height * 0.15, right: width * 0.2, opacity: 0.3 }]} />

      <View style={[styles.content, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 20 : 0), paddingBottom: Math.max(insets.bottom, 10) }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF7B54', // Fallback coral
  },
  baseBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FF6D55', // Vibrant Coral-Orange
  },
  glowPink: {
    position: 'absolute',
    bottom: -height * 0.25,
    right: -width * 0.3,
    width: width * 1.6,
    height: width * 1.6,
    borderRadius: (width * 1.6) / 2,
    backgroundColor: '#FE3C72', // Rich Tinder-like Pink/Rose
    opacity: 0.95,
  },
  rippleRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderStyle: 'solid',
  },
  floatingCircle: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  content: {
    flex: 1,
  },
});
