import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View, Animated, Easing} from 'react-native';
import {colors, spacing} from '../constants/theme';

export function AttendanceCard({entry, index = 0}) {
  const [slideAnim] = useState(new Animated.Value(-300));
  const [fadeAnim] = useState(new Animated.Value(0));
  const action = (entry?.action || 'in').toUpperCase();
  const isIn = action === 'IN';

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  const formatTime = timestamp => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  const formatDate = timestamp => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{translateX: slideAnim}],
        },
      ]}
    >
      <View style={styles.topAccent} />
      <View style={styles.cardContent}>
        <View style={styles.leftSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{entry.name?.charAt(0).toUpperCase() || '?'}</Text>
          </View>
        </View>

        <View style={styles.middleSection}>
          <Text style={styles.name}>{entry.name || 'Unknown'}</Text>
          <Text style={styles.subTitle}>
            {entry.student_code ? `Student ${entry.student_code}` : `Student #${entry.user_id ?? '--'}`}
          </Text>
          <View style={styles.timeRow}>
            <Text style={styles.time}>{formatTime(entry.timestamp)}</Text>
            <Text style={styles.date}>{formatDate(entry.timestamp)}</Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          <View style={[styles.statusBadge, isIn ? styles.statusBadgeIn : styles.statusBadgeOut]}>
            <Text style={[styles.statusText, isIn ? styles.statusTextIn : styles.statusTextOut]}>
              {isIn ? 'IN' : 'OUT'}
            </Text>
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  topAccent: {
    height: 5,
    backgroundColor: '#38BDF8',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  leftSection: {
    justifyContent: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0F2F1',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  middleSection: {
    flex: 1,
  },
  name: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subTitle: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  time: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  date: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  rightSection: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeIn: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  statusBadgeOut: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTextIn: {
    color: '#047857',
  },
  statusTextOut: {
    color: '#B91C1C',
  },
  rankBadge: {
    marginTop: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
  },
});
