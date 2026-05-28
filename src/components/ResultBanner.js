import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, spacing} from '../constants/theme';

function ResultBanner({type, message}) {
  if (!message) {
    return null;
  }

  const isSuccess = type === 'success';

  return (
    <View style={[styles.banner, isSuccess ? styles.success : styles.error]}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  success: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
  },
  error: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  message: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ResultBanner;
