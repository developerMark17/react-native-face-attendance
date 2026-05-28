import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, spacing} from '../constants/theme';

function PrimaryButton({label, onPress, disabled = false, variant = 'primary'}) {
  const isSecondary = variant === 'secondary';

  return (
    <View>
      <Pressable
        style={({pressed}) => [
          styles.button,
          isSecondary ? styles.buttonSecondary : styles.buttonPrimary,
          pressed && !disabled ? (isSecondary ? styles.buttonSecondaryPressed : styles.buttonPressed) : null,
          disabled ? styles.buttonDisabled : null,
        ]}
        disabled={disabled}
        onPress={onPress}
      >
        <View style={styles.inner}>
          <Text style={[styles.label, isSecondary ? styles.labelSecondary : null]}>{label}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    borderWidth: 1,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  buttonSecondaryPressed: {
    backgroundColor: '#E7F7F5',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  labelSecondary: {
    color: colors.text,
  },
});

export default PrimaryButton;
