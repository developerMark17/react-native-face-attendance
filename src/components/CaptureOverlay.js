import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {challengeLabel} from '../utils/challenge';
import {spacing} from '../constants/theme';

function CaptureOverlay({challenge}) {
  return (
    <View style={styles.overlayContainer}>
      <View style={styles.targetCircle} />
      <View style={styles.challengeBadge}>
        <Text style={styles.challengeText}>{challengeLabel(challenge)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetCircle: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  challengeBadge: {
    position: 'absolute',
    bottom: spacing.xl,
    backgroundColor: 'rgba(15, 118, 110, 0.9)',
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
  },
  challengeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default CaptureOverlay;
