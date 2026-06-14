import React, {useEffect, useRef, useState} from 'react';
import {AppState, NativeModules, Platform, PermissionsAndroid} from 'react-native';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import {API_BASE_URL} from '../constants/endpoints';

// Reconnection config
const MAX_RECONNECT_ATTEMPTS = 50;
const INITIAL_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

function BackgroundLiveStream() {
  const [studentCode, setStudentCode] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const isStreamingRef = useRef(false);
  const studentCodeRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const isStoppingRef = useRef(false); // Tracks intentional stops

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
        // App came back to foreground — verify stream is healthy
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

  /**
   * Connect or reconnect just the WebSocket (reuse existing PeerConnection & local stream).
   */
  const connectWebSocket = () => {
    const code = studentCodeRef.current;
    const pc = pcRef.current;
    if (!code || !pc) return;

    // Close old WS if any
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/ws/signaling/${code}`;
    console.log('BackgroundLiveStream: Connecting WebSocket to:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('BackgroundLiveStream: WebSocket open. Sending join.');
      reconnectAttemptsRef.current = 0; // Reset on success
      ws.send(JSON.stringify({type: 'join'}));
    };

    ws.onmessage = async event => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'join') {
          if (pc.signalingState !== 'closed') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({type: 'offer', sdp: offer.sdp}));
            }
          }
        } else if (message.type === 'answer') {
          if (pc.signalingState !== 'closed') {
            await pc.setRemoteDescription(new RTCSessionDescription({type: 'answer', sdp: message.sdp}));
          }
        } else if (message.type === 'candidate') {
          if (message.candidate && pc.signalingState !== 'closed') {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
          }
        }
      } catch (err) {
        console.log('BackgroundLiveStream signaling message error:', err);
      }
    };

    ws.onerror = err => {
      console.log('BackgroundLiveStream: WebSocket error:', err.message);
    };

    ws.onclose = event => {
      console.log('BackgroundLiveStream: WebSocket closed. Code:', event.code);
      // Only auto-reconnect if this wasn't a deliberate stop
      if (!isStoppingRef.current && event.code !== 1000) {
        scheduleReconnect();
      }
    };

    pc.onicecandidate = event => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({type: 'candidate', candidate: event.candidate}));
      }
    };
  };

  /**
   * Schedule a WebSocket reconnection with exponential backoff + jitter.
   */
  const scheduleReconnect = () => {
    if (isStoppingRef.current) return;

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log('BackgroundLiveStream: Max reconnect attempts reached. Stopping stream.');
      stopStream();
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttemptsRef.current) + Math.random() * 1000,
      MAX_RECONNECT_DELAY_MS,
    );
    reconnectAttemptsRef.current++;

    console.log(
      `BackgroundLiveStream: Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`,
    );

    reconnectTimerRef.current = setTimeout(() => {
      if (isStoppingRef.current) return;

      // Check if local stream is still alive
      if (localStreamRef.current && localStreamRef.current.getTracks().some(t => t.readyState === 'live')) {
        // Stream is alive, just reconnect WebSocket
        connectWebSocket();
      } else {
        // Stream died, do a full restart
        console.log('BackgroundLiveStream: Local stream died, performing full restart...');
        stopStreamInternal();
        startStream();
      }
    }, delay);
  };

  const startStream = async () => {
    const code = studentCodeRef.current;
    if (!code) return;

    isStoppingRef.current = false;
    reconnectAttemptsRef.current = 0;

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

      // Monitor peer connection health
      pc.onconnectionstatechange = () => {
        console.log('BackgroundLiveStream: PeerConnection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.log('BackgroundLiveStream: Peer connection lost, scheduling reconnect...');
          scheduleReconnect();
        }
      };

      // Connect WebSocket (handles signaling)
      connectWebSocket();

      if (Platform.OS === 'android') {
        const {NotificationHelper} = NativeModules;
        if (NotificationHelper && NotificationHelper.startLiveStreamService) {
          NotificationHelper.startLiveStreamService();
        }
      }

      setIsStreaming(true);
    } catch (err) {
      console.log('BackgroundLiveStream failed to start stream:', err);
      stopStreamInternal();
    }
  };

  /**
   * Internal stop — cleans up resources without triggering state changes
   * that would cause side effects.
   */
  const stopStreamInternal = () => {
    isStoppingRef.current = true;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;

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
  };

  const stopStream = () => {
    console.log('BackgroundLiveStream: stopping background stream');
    stopStreamInternal();

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
