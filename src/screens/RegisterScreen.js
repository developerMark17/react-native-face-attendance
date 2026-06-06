import React, {useState} from 'react';
import {Image, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, View} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import LiveCameraModal from '../components/LiveCameraModal';
import LoadingOverlay from '../components/LoadingOverlay';
import PrimaryButton from '../components/PrimaryButton';
import ResultBanner from '../components/ResultBanner';
import TextInputField from '../components/TextInputField';
import {colors, spacing} from '../constants/theme';
import {registerFace} from '../services/attendanceApi';

function RegisterScreen({navigation}) {
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [program, setProgram] = useState('B.Tech');
  const [semester, setSemester] = useState('1');
  const [section, setSection] = useState('A');
  const [result, setResult] = useState({type: '', message: ''});
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleCapture = async () => {
    setCameraOpen(true);
  };

  const handleChooseGallery = async () => {
    try {
      const options = {
        mediaType: 'photo',
        quality: 1,
      };

      launchImageLibrary(options, response => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.errorCode) {
          setResult({type: 'error', message: `Gallery Error: ${response.errorMessage}`});
        } else if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          setImage(asset);
          setResult({type: 'success', message: 'Face image selected from gallery.'});
        }
      });
    } catch (err) {
      setResult({type: 'error', message: 'Failed to open gallery.'});
    }
  };

  const requestPhoneAndContactsAccess = async () => {
    if (Platform.OS !== 'android') {
      setResult({type: 'success', message: 'Permissions not required on this platform.'});
      return;
    }
    try {
      setResult({type: '', message: ''});
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      ]);

      const phoneStateGranted =
        granted[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] === PermissionsAndroid.RESULTS.GRANTED;
      const contactsGranted =
        granted[PermissionsAndroid.PERMISSIONS.READ_CONTACTS] === PermissionsAndroid.RESULTS.GRANTED;

      if (phoneStateGranted && contactsGranted) {
        setResult({type: 'success', message: 'Phone State and Contacts permissions granted.'});
      } else {
        setResult({
          type: 'error',
          message: `Permissions status: Phone State (${phoneStateGranted ? 'Granted' : 'Denied'}), Contacts (${
            contactsGranted ? 'Granted' : 'Denied'
          }).`,
        });
      }
    } catch (err) {
      setResult({type: 'error', message: 'Failed to request permissions.'});
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      setResult({type: 'error', message: 'Please enter a valid name.'});
      return;
    }

    if (!image?.uri) {
      setResult({type: 'error', message: 'Capture or choose a face photo before submitting.'});
      return;
    }

    try {
      setLoading(true);
      setResult({type: '', message: ''});
      const response = await registerFace({
        name: name.trim(),
        student_code: studentCode.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        guardian_phone: guardianPhone.trim() || undefined,
        department: department.trim() || undefined,
        program: program.trim() || undefined,
        semester: semester.trim() || undefined,
        section: section.trim() || undefined,
        image,
      });
      setResult({type: 'success', message: response.message || 'Face registered successfully.'});
    } catch (error) {
      setResult({
        type: 'error',
        message: error?.response?.data?.detail || 'Failed to register face.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Register Face</Text>
      <Text style={styles.infoText}>
        Capture a front-facing image with one visible face, then enroll the student for attendance.
      </Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Enrollment Checklist</Text>
        <Text style={styles.heroPoint}>Good light and neutral background</Text>
        <Text style={styles.heroPoint}>Only one face in frame</Text>
        <Text style={styles.heroPoint}>Student code matches the college record</Text>
      </View>

      <TextInputField label="Student Name" value={name} onChangeText={setName} placeholder="Enter full name" />
      <TextInputField
        label="Student Code"
        value={studentCode}
        onChangeText={setStudentCode}
        placeholder="Example: CSE-2026-001"
      />
      <TextInputField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="student@college.edu"
        keyboardType="email-address"
      />
      <TextInputField
        label="Phone Number"
        value={phone}
        onChangeText={setPhone}
        placeholder="Enter student phone number"
        keyboardType="phone-pad"
      />
      <TextInputField
        label="Guardian Phone"
        value={guardianPhone}
        onChangeText={setGuardianPhone}
        placeholder="Enter guardian phone number"
        keyboardType="phone-pad"
      />
      <View style={styles.inlineFields}>
        <View style={styles.inlineItem}>
          <TextInputField label="Department" value={department} onChangeText={setDepartment} placeholder="Department" />
        </View>
        <View style={styles.inlineItem}>
          <TextInputField label="Program" value={program} onChangeText={setProgram} placeholder="Program" />
        </View>
      </View>
      <View style={styles.inlineFields}>
        <View style={styles.inlineItem}>
          <TextInputField
            label="Semester"
            value={semester}
            onChangeText={setSemester}
            placeholder="1"
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.inlineItem}>
          <TextInputField label="Section" value={section} onChangeText={setSection} placeholder="A" />
        </View>
      </View>

      {image?.uri ? (
        <View style={styles.previewCard}>
          <Image source={{uri: image.uri}} style={styles.previewImage} />
        </View>
      ) : null}

      <ResultBanner type={result.type} message={result.message} />

      <View style={styles.buttonRow}>
        <View style={styles.buttonCol}>
          <PrimaryButton label={image?.uri ? 'Retake Photo' : 'Capture Photo'} onPress={handleCapture} />
        </View>
        <View style={styles.buttonCol}>
          <PrimaryButton label="Choose Gallery" onPress={handleChooseGallery} variant="secondary" />
        </View>
      </View>

      <PrimaryButton label="Register Face" onPress={handleRegister} disabled={loading} />
      <PrimaryButton
        label="Request Contacts & Phone Access"
        onPress={requestPhoneAndContactsAccess}
        variant="secondary"
      />
      <PrimaryButton label="Go to Attendance" onPress={() => navigation.navigate('Camera')} variant="secondary" />
      <PrimaryButton label="View Logs" onPress={() => navigation.navigate('Logs')} variant="secondary" />

      {loading ? <LoadingOverlay message="Registering face..." /> : null}

      <LiveCameraModal
        visible={cameraOpen}
        title="Register Face"
        subtitle="Center your face inside the guide and capture without leaving the app."
        confirmLabel="Use This Photo"
        onClose={() => setCameraOpen(false)}
        onConfirm={asset => {
          setImage(asset);
          setResult({type: 'success', message: 'Face image captured in-app. Review it, then submit registration.'});
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
  heroCard: {
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  heroPoint: {
    color: '#EEF2FF',
    fontSize: 14,
    marginTop: 4,
  },
  previewCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: 320,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineItem: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  buttonCol: {
    flex: 1,
  },
});

export default RegisterScreen;
