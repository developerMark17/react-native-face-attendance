import React, {useMemo, useState} from 'react';
import {Image, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, View} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

import CaptureOverlay from '../components/CaptureOverlay';
import LiveCameraModal from '../components/LiveCameraModal';
import LoadingOverlay from '../components/LoadingOverlay';
import PrimaryButton from '../components/PrimaryButton';
import ResultBanner from '../components/ResultBanner';
import TextInputField from '../components/TextInputField';
import {colors, spacing} from '../constants/theme';
import {recognizeFace} from '../services/attendanceApi';
import {challengeLabel, generateChallenge} from '../utils/challenge';

function CameraScreen({navigation}) {
  const [challenge, setChallenge] = useState(generateChallenge());
  const [image, setImage] = useState(null);
  const [result, setResult] = useState({type: '', message: ''});
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [nextPunchAction, setNextPunchAction] = useState('in');
  const [courseCode, setCourseCode] = useState('');
  const [sessionName, setSessionName] = useState('');

  const tip = useMemo(() => challengeLabel(challenge), [challenge]);

  const requestPermission = async permission => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const granted = await PermissionsAndroid.request(permission);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const handleCapture = async () => {
    setCameraOpen(true);
  };

  const getCurrentLocation = async () => {
    const fineLocationGranted = await requestPermission(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (!fineLocationGranted) {
      return null;
    }

    return new Promise(resolve => {
      Geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000,
        },
      );
    });
  };

  const handleAttendance = async () => {
    if (!image?.uri) {
      setResult({type: 'error', message: 'Capture your live face photo before marking attendance.'});
      return;
    }

    try {
      setLoading(true);
      setResult({type: '', message: ''});
      const location = await getCurrentLocation();
      const response = await recognizeFace({
        image,
        challenge,
        course_code: courseCode.trim() || undefined,
        session_name: sessionName.trim() || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });

      if (response.matched) {
        const currentAction = (response?.action || '').toLowerCase();
        const upcomingAction = currentAction === 'in' ? 'out' : 'in';
        setNextPunchAction(upcomingAction);
        setResult({
          type: 'success',
          message:
            response.message || `Attendance marked for ${response.name}. Capture a new live photo for the next punch.`,
        });
        // Force a fresh in-app capture for every punch (IN/OUT) to keep liveness validation consistent.
        setImage(null);
      } else {
        setResult({type: 'error', message: response.message || 'Face not recognized.'});
      }
      setChallenge(generateChallenge());
    } catch (error) {
      const serverDetail = error?.response?.data?.detail;
      const serverMessage = error?.response?.data?.message;
      const hasServerResponse = Boolean(error?.response);
      const isNetworkIssue = !hasServerResponse;

      setResult({
        type: 'error',
        message: isNetworkIssue
          ? 'Cannot reach server. Reconnect USB, run adb reverse for 8000/8081, then try again.'
          : serverDetail || serverMessage || 'Failed to mark attendance.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mark Attendance</Text>
      <Text style={styles.infoText}>
        Perform the liveness action shown below, capture your face, then submit attendance for the selected class.
      </Text>

      <View style={styles.inlineFields}>
        <View style={styles.inlineItem}>
          <TextInputField label="Course Code" value={courseCode} onChangeText={setCourseCode} placeholder="CSE101" />
        </View>
        <View style={styles.inlineItem}>
          <TextInputField
            label="Session"
            value={sessionName}
            onChangeText={setSessionName}
            placeholder="Morning Lecture"
          />
        </View>
      </View>

      <View style={styles.challengeCard}>
        <Text style={styles.challengeEyebrow}>Liveness Challenge</Text>
        <Text style={styles.challengeText}>{tip}</Text>
      </View>

      <View style={styles.captureCard}>
        {image?.uri ? (
          <Image source={{uri: image.uri}} style={styles.previewImage} />
        ) : (
          <View style={styles.previewPlaceholder} />
        )}
        <CaptureOverlay challenge={challenge} />
      </View>

      <ResultBanner type={result.type} message={result.message} />

      <PrimaryButton
        label={
          image?.uri
            ? 'Retake Live Photo'
            : nextPunchAction === 'out'
            ? 'Capture Live Photo for Punch Out'
            : 'Capture Live Photo for Punch In'
        }
        onPress={handleCapture}
      />
      <PrimaryButton
        label={nextPunchAction === 'out' ? 'Mark Punch Out' : 'Mark Punch In'}
        onPress={handleAttendance}
        disabled={loading}
      />
      <PrimaryButton label="Refresh Challenge" onPress={() => setChallenge(generateChallenge())} variant="secondary" />
      <PrimaryButton label="Go to Register" onPress={() => navigation.navigate('Register')} variant="secondary" />
      <PrimaryButton label="View Logs" onPress={() => navigation.navigate('Logs')} variant="secondary" />

      {loading ? <LoadingOverlay message="Verifying face and marking attendance..." /> : null}

      <LiveCameraModal
        visible={cameraOpen}
        title="Live Attendance Capture"
        subtitle="Stay inside the frame, perform the challenge, then capture in-app."
        challenge={challenge}
        confirmLabel="Use For Attendance"
        onClose={() => setCameraOpen(false)}
        onConfirm={asset => {
          setImage(asset);
          setResult({type: 'success', message: 'Live face photo captured in-app. Submit attendance when ready.'});
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  infoText: {
    color: colors.muted,
    marginBottom: spacing.md,
    fontSize: 15,
    lineHeight: 22,
  },
  challengeCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDBA74',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  challengeEyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  challengeText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  captureCard: {
    height: 360,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginBottom: spacing.md,
    position: 'relative',
  },
  previewPlaceholder: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  inlineFields: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineItem: {
    flex: 1,
  },
});

export default CameraScreen;
