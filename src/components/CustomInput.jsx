import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from 'react-native';

export const CustomInput = ({
  label,
  iconType = 'none',
  secureTextEntry,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const shouldSecureText = secureTextEntry && !isPasswordVisible;

  // Render pure CSS/React Native layout-based icons for independence and fast loading
  const renderIcon = () => {
    switch (iconType) {
      case 'email':
        return (
          <View style={styles.iconContainer}>
            {/* Envelope Outline */}
            <View style={styles.envelopeOuter}>
              {/* Envelope Flap */}
              <View style={styles.envelopeInner} />
            </View>
          </View>
        );
      case 'user':
        return (
          <View style={styles.iconContainer}>
            {/* User Avatar Circle */}
            <View style={styles.userHead} />
            {/* User Shoulder */}
            <View style={styles.userBody} />
          </View>
        );
      case 'password':
        return (
          <View style={styles.iconContainer}>
            {/* Lock Shackle */}
            <View style={styles.lockShackle} />
            {/* Lock Body */}
            <View style={styles.lockBody} />
          </View>
        );
      case 'phone':
        return (
          <View style={styles.iconContainer}>
            {/* Phone Handset Outline */}
            <View style={styles.phoneOuter}>
              {/* Home button circle */}
              <View style={styles.phoneInner} />
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
        ]}
      >
        {renderIcon()}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor="rgba(0, 0, 0, 0.4)"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={shouldSecureText}
          autoCapitalize="none"
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            activeOpacity={0.7}
          >
            {/* Custom styled eye shape */}
            <View style={styles.eyeIconOuter}>
              <View style={styles.eyeIconInner} />
              {shouldSecureText && <View style={styles.eyeIconSlash} />}
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
    opacity: 0.9,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    height: 52,
    paddingHorizontal: 16,
  },
  inputWrapperFocused: {
    borderColor: '#FE3C72',
    backgroundColor: '#FFFFFF',
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#000000',
    fontSize: 16,
    height: '100%',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },
  // Custom Icon Styles
  envelopeOuter: {
    width: 18,
    height: 12,
    borderWidth: 1.5,
    borderColor: '#333333',
    borderRadius: 2,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  envelopeInner: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: '#333333',
    alignSelf: 'center',
    marginTop: -8,
    transform: [{ rotate: '45deg' }],
  },
  userHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
    marginBottom: 2,
  },
  userBody: {
    width: 14,
    height: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: '#333333',
  },
  lockShackle: {
    width: 10,
    height: 8,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderWidth: 1.5,
    borderColor: '#333333',
    borderBottomWidth: 0,
    marginBottom: -1,
  },
  lockBody: {
    width: 14,
    height: 10,
    backgroundColor: '#333333',
    borderRadius: 2,
  },
  phoneOuter: {
    width: 12,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#333333',
    borderRadius: 3,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 2,
  },
  phoneInner: {
    width: 4,
    height: 1.5,
    backgroundColor: '#333333',
    borderRadius: 1,
  },
  eyeIconOuter: {
    width: 18,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  eyeIconInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333333',
  },
  eyeIconSlash: {
    position: 'absolute',
    width: 20,
    height: 1.5,
    backgroundColor: '#333333',
    transform: [{ rotate: '45deg' }],
  },
});
