import React, {Suspense, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Camera, CameraType} from 'react-native-camera-kit';

import CaptureOverlay from './CaptureOverlay';
import {colors, spacing} from '../constants/theme';

function toAsset(photo) {
  const uri = photo.uri?.startsWith('file://') ? photo.uri : `file://${photo.uri || ''}`;
  const sourcePath = photo.path || photo.uri || '';
  const segments = sourcePath.split(/[\\/]/);
  const fileName = photo.name || segments[segments.length - 1] || 'capture.jpg';

  return {
    uri,
    fileName,
    type: 'image/jpeg',
  };
}

function LiveCameraModal({visible, title, subtitle, challenge, confirmLabel = 'Use Photo', onClose, onConfirm}) {
  const camera = useRef(null);
  const [hasPermission, setHasPermission] = useState(Platform.OS !== 'android');
  const [capturedImage, setCapturedImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [permissionError, setPermissionError] = useState('');

  useEffect(() => {
    if (!visible) {
      setCapturedImage(null);
      setBusy(false);
      setPermissionError('');
      return;
    }

    if (Platform.OS !== 'android') {
      setHasPermission(true);
      return;
    }

    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA).then(granted => {
      const allowed = granted === PermissionsAndroid.RESULTS.GRANTED;
      setHasPermission(allowed);
      if (!allowed) {
        setPermissionError('Camera permission is required to continue.');
      }
    });
  }, [visible]);

  const handleCapture = async () => {
    if (!camera.current || busy) {
      return;
    }

    try {
      setBusy(true);
      const photo = await camera.current.capture();
      setCapturedImage(toAsset(photo));
    } catch {
      setPermissionError('Failed to capture photo. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = () => {
    if (!capturedImage) {
      return;
    }
    onConfirm(capturedImage);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.topButton}>
            <Text style={styles.topButtonLabel}>Close</Text>
          </Pressable>
          <View style={styles.topCopy}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.previewFrame}>
          {!hasPermission ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.stateText}>{permissionError || 'Preparing in-app camera...'}</Text>
            </View>
          ) : capturedImage ? (
            <View style={styles.previewContainer}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle}>Review Capture</Text>
                <Text style={styles.previewSubtitle}>Retake if the face is not centered and clear.</Text>
              </View>
              <View style={styles.stillWrapper}>
                <Image source={{uri: capturedImage.uri}} style={styles.stillImage} />
                <View style={styles.stillOverlay} />
              </View>
            </View>
          ) : (
            <>
              <Suspense
                fallback={
                  <View style={styles.centerState}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                }
              >
                <Camera
                  ref={camera}
                  style={styles.camera}
                  cameraType={CameraType.Front}
                  flashMode="off"
                  focusMode="on"
                  zoomMode="off"
                  resizeMode="cover"
                />
              </Suspense>
              <CaptureOverlay challenge={challenge} />
            </>
          )}
        </View>

        {capturedImage ? (
          <View style={styles.footer}>
            <Pressable style={[styles.actionButton, styles.secondaryButton]} onPress={() => setCapturedImage(null)}>
              <Text style={[styles.actionLabel, styles.secondaryLabel]}>Retake</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.primaryButton]} onPress={handleConfirm}>
              <Text style={styles.actionLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.captureBar}>
            <Pressable style={styles.captureButton} onPress={handleCapture} disabled={busy || !hasPermission}>
              <View style={styles.captureInner} />
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#020617',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  topButton: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  topButtonLabel: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
  },
  topCopy: {
    flex: 1,
  },
  topSpacer: {
    width: 48,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  previewFrame: {
    flex: 1,
    marginHorizontal: spacing.md,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  camera: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  stateText: {
    color: '#E2E8F0',
    textAlign: 'center',
    marginTop: spacing.sm,
    fontSize: 15,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
  },
  previewHeader: {
    padding: spacing.md,
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  previewSubtitle: {
    color: '#CBD5E1',
    marginTop: 6,
    lineHeight: 20,
  },
  stillWrapper: {
    flex: 1,
    backgroundColor: '#111827',
  },
  stillImage: {
    width: '100%',
    height: '100%',
  },
  stillOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
  },
  captureBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryLabel: {
    color: colors.text,
  },
});

export default LiveCameraModal;
