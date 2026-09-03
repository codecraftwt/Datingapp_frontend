import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

export const CustomButton = ({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  textStyle,
  ...props
}) => {
  const isButtonDisabled = disabled || loading;

  const buttonStyles = [
    styles.button,
    variant === 'primary' && styles.primaryButton,
    variant === 'secondary' && styles.secondaryButton,
    variant === 'accent' && styles.accentButton,
    variant === 'outline' && styles.outlineButton,
    variant === 'white' && styles.whiteButton,
    isButtonDisabled && styles.disabledButton,
    style,
  ];

  const textStyles = [
    styles.text,
    variant === 'primary' && styles.primaryText,
    variant === 'secondary' && styles.secondaryText,
    variant === 'accent' && styles.accentText,
    variant === 'outline' && styles.outlineText,
    variant === 'white' && styles.whiteText,
    isButtonDisabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      disabled={isButtonDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FF5864' : '#FFFFFF'}
        />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
    paddingHorizontal: 20,
    marginVertical: 8,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowOpacity: 0,
    elevation: 0,
  },
  accentButton: {
    backgroundColor: '#FE3C72', // Rich pink
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  outlineButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowOpacity: 0,
    elevation: 0,
  },
  whiteButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  whiteText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  primaryText: {
    color: '#FE3C72', // Match pink/coral theme
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  accentText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: '#FFFFFF',
  },
  disabledText: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
