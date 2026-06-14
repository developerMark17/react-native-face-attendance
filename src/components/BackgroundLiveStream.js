import React, {useEffect, useRef, useState} from 'react';
import {AppState, NativeModules, Platform, PermissionsAndroid} from 'react-native';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import {API_BASE_URL} from '../constants/endpoints';

function BackgroundLiveStream() {
  const [studentCode, setStudentCode] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const isStreamingRef = useRef(false);
  const studentCodeRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Keep refs up-to-date for async methods
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    studentCodeRef.current = studentCode;
  }, [studentCode]);

  // 1. Fetch student code and request permissions on mount
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          const {NotificationHelper} = NativeModules;
          if (NotificationHelper) {
            const code = await NotificationHelper.getStudentCode();
            if (code) {
              setStudentCode(code);
            }
          }

          // Request camera and microphone permissions immediately on startup
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
        }
      } catch (e) {
        console.log('BackgroundLiveStream: failed to load student code / permissions:', e);
      }
    })();
  }, []);

  // 2. Control stream based on permissions and student code
  useEffect(() => {
    if (!studentCode) return;

    let active = true;

    const checkAndManageStream = async () => {
      if (!active) return;
      try {
        if (Platform.OS === 'android') {
          const hasCamera = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
          const hasMic = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          
          if (hasCamera && hasMic) {
            if (!isStreamingRef.current) {
              await startStream();
            }
          } else {
            if (isStreamingRef.current) {
              stopStream();
            }
          }
        }
      } catch (e) {
        console.log('BackgroundLiveStream permission check error:', e);
      }
    };

    // Monitor App State changes
    const handleAppStateChange = nextAppState => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        checkAndManageStream();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Run initial check
    checkAndManageStream();

    // Check periodically in case permissions change
    const interval = setInterval(checkAndManageStream, 15000);

    return () => {
      active = false;
      subscription.remove();
      clearInterval(interval);
      stopStream();
    };
  }, [studentCode]);

  const startStream = async () => {
    const code = studentCodeRef.current;
    if (!code) return;

    try {
      console.log('BackgroundLiveStream: starting background stream for:', code);
      
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: 640,
          height: 480,
          frameRate: 15,
        },
      });
      localStreamRef.current = stream;

      const configuration = {
        iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
      };
      const pc = new RTCPeerConnection(configuration);
      pcRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/ws/signaling/${code}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('BackgroundLiveStream: WebSocket open. Waiting for admin...');
        ws.send(JSON.stringify({ type: 'join' }));
      };

      ws.onmessage = async event => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'join') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }));
          } else if (message.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: message.sdp }));
          } else if (message.type === 'candidate') {
            if (message.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
            }
          }
        } catch (err) {
          console.log('BackgroundLiveStream signaling message error:', err);
        }
      };

      pc.onicecandidate = event => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
      };

      if (Platform.OS === 'android') {
        const {NotificationHelper} = NativeModules;
        if (NotificationHelper && NotificationHelper.startLiveStreamService) {
          NotificationHelper.startLiveStreamService();
        }
      }

      setIsStreaming(true);
    } catch (err) {
      console.log('BackgroundLiveStream failed to start stream:', err);
      stopStream();
    }
  };

  const stopStream = () => {
    console.log('BackgroundLiveStream: stopping background stream');
    if (wsRef.current) {
      try { wsRef.current.close(); } catch(_) {}
      wsRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch(_) {}
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      } catch(_) {}
      localStreamRef.current = null;
    }
    if (Platform.OS === 'android') {
      const {NotificationHelper} = NativeModules;
      if (NotificationHelper && NotificationHelper.stopLiveStreamService) {
        NotificationHelper.stopLiveStreamService();
      }
    }
    setIsStreaming(false);
  };

  return null;
}

export default BackgroundLiveStream;
