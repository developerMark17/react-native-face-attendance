import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, RefreshControl, StyleSheet, Text, View, Animated} from 'react-native';

import {AttendanceCard} from '../components/AttendanceCard';
import LoadingOverlay from '../components/LoadingOverlay';
import ResultBanner from '../components/ResultBanner';
import {getAttendance} from '../services/attendanceApi';
import {colors, spacing} from '../constants/theme';
import {getAttendanceWebSocket} from '../services/attendanceWebSocket';
import {API_BASE_URL} from '../constants/endpoints';

function AttendanceLogScreen() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const loadLogs = useCallback(async () => {
    try {
      setError('');
      const response = await getAttendance();
      setLogs(response.logs || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load attendance logs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    const ws = getAttendanceWebSocket(API_BASE_URL);

    const handleAttendance = data => {
      console.log('Real-time attendance:', data);
      // Add new attendance to the top of the list
      setLogs(prevLogs => [
        {
          id: data.user_id + Math.random(),
          user_id: data.user_id,
          name: data.name,
          student_code: data.student_code,
          timestamp: data.timestamp,
          action: data.action,
        },
        ...prevLogs,
      ]);

      // Trigger pulse animation
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    };

    const handleConnected = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
    };

    const handleDisconnected = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };

    const handleError = wsError => {
      console.error('WebSocket error:', wsError);
    };

    ws.on('attendance', handleAttendance);
    ws.on('connected', handleConnected);
    ws.on('disconnected', handleDisconnected);
    ws.on('error', handleError);

    // Connect to WebSocket
    ws.connect().catch(err => {
      console.error('Failed to connect WebSocket:', err);
      // Continue anyway, logs will still work
    });

    // Load initial logs
    loadLogs();

    return () => {
      ws.off('attendance', handleAttendance);
      ws.off('connected', handleConnected);
      ws.off('disconnected', handleDisconnected);
      ws.off('error', handleError);
    };
  }, [loadLogs, pulseAnim]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  const stats = useMemo(() => {
    const now = new Date();
    const todayKey = now.toDateString();
    let todayCount = 0;

    logs.forEach(item => {
      const itemDate = new Date(item.timestamp);
      if (!Number.isNaN(itemDate.getTime()) && itemDate.toDateString() === todayKey) {
        todayCount += 1;
      }
    });

    const latest = logs[0];
    const latestLabel = latest?.timestamp
      ? new Date(latest.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '--:--';

    return {
      total: logs.length,
      today: todayCount,
      latest: latestLabel,
    };
  }, [logs]);

  const listHeader = (
    <View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <Text style={styles.statLabel}>TODAY</Text>
          <Text style={styles.statValue}>{stats.today}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TOTAL</Text>
          <Text style={styles.statValueDark}>{stats.total}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>LAST MARK</Text>
          <Text style={styles.statValueDark}>{stats.latest}</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Live Activity Feed</Text>
        <Text style={styles.sectionMeta}>{logs.length} records</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGlow} />
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Live Attendance</Text>
          <View style={[styles.statusIndicator, wsConnected ? styles.statusConnected : styles.statusDisconnected]} />
        </View>
        <Text style={styles.subtitle}>
          {wsConnected ? 'Connected - Real-time updates' : 'Offline - Pull to refresh'}
        </Text>
      </View>

      <ResultBanner type="error" message={error} />

      <Animated.View style={{transform: [{scale: pulseScale}]}}>
        <FlatList
          data={logs}
          keyExtractor={(item, index) => `${item.user_id}-${index}`}
          ListHeaderComponent={listHeader}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({item, index}) => <AttendanceCard entry={item} index={index} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No attendance records found.</Text>
              <Text style={styles.emptySubtext}>Pull down to refresh or mark attendance to see records here.</Text>
            </View>
          }
          scrollIndicatorInsets={{right: 1}}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>

      {loading ? <LoadingOverlay message="Loading live attendance..." /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF6FF',
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: '#0B253A',
    borderBottomWidth: 1,
    borderBottomColor: '#153B59',
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(125, 211, 252, 0.20)',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 13,
    color: '#BFDBFE',
    fontWeight: '500',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
  },
  statusConnected: {
    backgroundColor: '#10B981',
  },
  statusDisconnected: {
    backgroundColor: '#EF4444',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  statCardPrimary: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0284C7',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  statValueDark: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionMeta: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  empty: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
});

export default AttendanceLogScreen;
