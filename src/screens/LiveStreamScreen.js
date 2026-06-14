import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';

import PrimaryButton from '../components/PrimaryButton';
import {colors, spacing} from '../constants/theme';
import {API_BASE_URL} from '../constants/endpoints';

function LiveStreamScreen({navigation}) {
  const [localStream, setLocalStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [studentCode, setStudentCode] = useState(null);

  const pcRef = useRef(null);
  const wsRef = useRef(null);

  // Fetch the registered student code on screen mount
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          const {NotificationHelper} = NativeModules;
          if (NotificationHelper) {
            const code = await NotificationHelper.getStudentCode();
            if (code) {
              setStudentCode(code);
              return;
            }
          }
        }
        Alert.alert(
          'Not Registered',
          'Please register this student first to get a Student Code.',
          [{text: 'Go to Register', onPress: () => navigation.navigate('register')}],
        );
      } catch (e) {
        console.error('Failed to load student code:', e);
      }
    })();
  }, [navigation]);

  // Clean up WebRTC resources when leaving the screen
  useEffect(() => {
    return () => {
      stopStreamInternal();
    };
  }, []);

  const startStream = async () => {
    if (!studentCode) {
      Alert.alert('Error', 'No student code found. Please register first.');
      return;
    }

    try {
      setLoading(true);

      // 1. Get user media (video & audio)
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user', // Use front camera
          width: 640,
          height: 480,
          frameRate: 15,
        },
      });

      setLocalStream(stream);

      // 2. Initialize WebRTC PeerConnection
      const configuration = {
        iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
      };
      const pc = new RTCPeerConnection(configuration);
      pcRef.current = pc;

      // Add local stream tracks to connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // 3. Connect to signaling WebSocket
      const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/ws/signaling/${studentCode}`;
      console.log('Connecting signaling WebSocket to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Signaling WebSocket open. Waiting for admin to join...');
      };

      ws.onmessage = async event => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received signaling message type:', message.type);

          if (message.type === 'join') {
            // Admin joined - create WebRTC Offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(
              JSON.stringify({
                type: 'offer',
                sdp: offer.sdp,
              }),
            );
            console.log('Sent WebRTC Offer to admin');
          } else if (message.type === 'answer') {
            // Admin replied with SDP Answer
            await pc.setRemoteDescription(
              new RTCSessionDescription({
                type: 'answer',
                sdp: message.sdp,
              }),
            );
            console.log('Set WebRTC remote description (answer)');
          } else if (message.type === 'candidate') {
            // Admin sent ICE candidate
            if (message.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
              console.log('Added remote ICE candidate');
            }
          }
        } catch (err) {
          console.error('Signaling message error:', err);
        }
      };

      // Handle ICE Candidates generated locally
      pc.onicecandidate = event => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'candidate',
              candidate: event.candidate,
            }),
          );
          console.log('Sent local ICE candidate');
        }
      };

      setIsStreaming(true);
      if (Platform.OS === 'android') {
        const {NotificationHelper} = NativeModules;
        if (NotificationHelper && NotificationHelper.startLiveStreamService) {
          NotificationHelper.startLiveStreamService();
        }
      }
    } catch (err) {
      console.error('Failed to start stream:', err);
      Alert.alert('Error', 'Failed to access camera/audio. Ensure permissions are granted.');
      stopStreamInternal();
    } finally {
      setLoading(false);
    }
  };

  const stopStreamInternal = () => {
    // Stop WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Close WebRTC peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Stop local camera/audio tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    setIsStreaming(false);
    if (Platform.OS === 'android') {
      const {NotificationHelper} = NativeModules;
      if (NotificationHelper && NotificationHelper.stopLiveStreamService) {
        NotificationHelper.stopLiveStreamService();
      }
    }
  };

  const stopStream = () => {
    stopStreamInternal();
    Alert.alert('Success', 'Live stream has been stopped.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Live Camera Stream</Text>
          <Text style={styles.subtitle}>
            Stream your front camera and audio to the admin panel in real-time.
          </Text>
        </View>

        {/* Live Indicator / Stream State */}
        {isStreaming && (
          <View style={styles.liveBadge}>
            <View style={styles.redDot} />
            <Text style={styles.liveText}>LIVE STREAM ACTIVE</Text>
          </View>
        )}

        {/* Video Preview Box */}
        <View style={styles.previewCard}>
          {localStream ? (
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.rtcView}
              objectFit="cover"
            />
          ) : (
            <View style={styles.placeholder}>
              {loading ? (
                <ActivityIndicator size="large" color="#0F766E" />
              ) : (
                <Text style={styles.placeholderText}>
                  {studentCode
                    ? `Camera Ready for Student: ${studentCode}`
                    : 'Loading Student Info...'}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.buttonGroup}>
          {!isStreaming ? (
            <PrimaryButton
              label={loading ? 'Initializing Stream...' : 'Start Live Stream'}
              onPress={startStream}
              disabled={loading || !studentCode}
            />
          ) : (
            <PrimaryButton
              label="Stop Live Stream"
              onPress={stopStream}
              variant="danger"
            />
          )}
          <PrimaryButton
            label="Back to Home"
            onPress={() => navigation.navigate('home')}
            variant="secondary"
            disabled={loading}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginVertical: spacing.sm,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  liveText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewCard: {
    height: 360,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  rtcView: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonGroup: {
    marginBottom: spacing.md,
  },
});

export default LiveStreamScreen;
