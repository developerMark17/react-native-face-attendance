/**
 * LiveStreamHeadlessTask.js
 *
 * This HeadlessJS task runs when the app process was killed but the
 * LiveStreamService foreground service restarts. It spins up a fresh
 * JS runtime and re-establishes the WebRTC livestream connection.
 *
 * Registered in index.js via AppRegistry.registerHeadlessTask().
 */
import {NativeModules, Platform} from 'react-native';
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

let pc = null;
let ws = null;
let localStream = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
let studentCode = null;

async function getStudentCode() {
  if (Platform.OS === 'android') {
    const {NotificationHelper} = NativeModules;
    if (NotificationHelper) {
      return await NotificationHelper.getStudentCode();
    }
  }
  return null;
}

function cleanupResources() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try { ws.close(); } catch (_) {}
    ws = null;
  }
  if (pc) {
    try { pc.close(); } catch (_) {}
    pc = null;
  }
  if (localStream) {
    try {
      localStream.getTracks().forEach(track => track.stop());
    } catch (_) {}
    localStream = null;
  }
}

async function connectStream() {
  if (!studentCode) {
    console.log('[HeadlessLiveStream] No student code, aborting.');
    return;
  }

  cleanupResources();
  reconnectAttempts = 0;

  try {
    console.log('[HeadlessLiveStream] Starting stream for:', studentCode);

    // 1. Get camera + audio
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: {
        facingMode: 'user',
        width: 640,
        height: 480,
        frameRate: 15,
      },
    });
    localStream = stream;

    // 2. Create peer connection
    const configuration = {
      iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
    };
    pc = new RTCPeerConnection(configuration);

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // 3. Monitor connection state for failures
    pc.onconnectionstatechange = () => {
      console.log('[HeadlessLiveStream] Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.log('[HeadlessLiveStream] Peer connection lost, scheduling reconnect...');
        scheduleReconnect();
      }
    };

    // 4. Connect WebSocket
    connectWebSocket();
  } catch (err) {
    console.log('[HeadlessLiveStream] Failed to start stream:', err);
    scheduleReconnect();
  }
}

function connectWebSocket() {
  if (!studentCode) return;

  const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/ws/signaling/${studentCode}`;
  console.log('[HeadlessLiveStream] Connecting WebSocket to:', wsUrl);

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[HeadlessLiveStream] WebSocket open. Sending join.');
    reconnectAttempts = 0; // Reset on successful connection
    ws.send(JSON.stringify({type: 'join'}));
  };

  ws.onmessage = async event => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'join') {
        if (pc && pc.signalingState !== 'closed') {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({type: 'offer', sdp: offer.sdp}));
          }
        }
      } else if (message.type === 'answer') {
        if (pc && pc.signalingState !== 'closed') {
          await pc.setRemoteDescription(
            new RTCSessionDescription({type: 'answer', sdp: message.sdp}),
          );
        }
      } else if (message.type === 'candidate') {
        if (message.candidate && pc && pc.signalingState !== 'closed') {
          await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
      }
    } catch (err) {
      console.log('[HeadlessLiveStream] Signaling error:', err);
    }
  };

  ws.onerror = err => {
    console.log('[HeadlessLiveStream] WebSocket error:', err.message);
  };

  ws.onclose = event => {
    console.log('[HeadlessLiveStream] WebSocket closed. Code:', event.code);
    // Only reconnect if this wasn't a deliberate close (code 1000 = normal close)
    if (event.code !== 1000) {
      scheduleReconnect();
    }
  };

  if (pc) {
    pc.onicecandidate = event => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({type: 'candidate', candidate: event.candidate}));
      }
    };
  }
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('[HeadlessLiveStream] Max reconnect attempts reached. Giving up.');
    return;
  }

  // Exponential backoff with jitter
  const delay = Math.min(
    INITIAL_RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts) + Math.random() * 1000,
    MAX_RECONNECT_DELAY_MS,
  );
  reconnectAttempts++;

  console.log(
    `[HeadlessLiveStream] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
  );

  reconnectTimer = setTimeout(() => {
    // If we still have a valid local stream, just reconnect the WebSocket
    if (localStream && localStream.getTracks().some(t => t.readyState === 'live')) {
      if (ws) {
        try { ws.close(); } catch (_) {}
        ws = null;
      }
      connectWebSocket();
    } else {
      // Full reconnect: re-acquire camera and re-establish everything
      connectStream();
    }
  }, delay);
}

/**
 * The headless task entry point.
 * Returns a Promise that never resolves — this keeps the JS runtime alive
 * so the WebRTC stream can continue running.
 */
const LiveStreamHeadlessTask = async () => {
  console.log('[HeadlessLiveStream] Headless task started.');

  studentCode = await getStudentCode();

  if (!studentCode) {
    console.log('[HeadlessLiveStream] No student code found. Exiting headless task.');
    return;
  }

  await connectStream();

  // Keep the task alive indefinitely by returning a never-resolving promise
  return new Promise(() => {});
};

export default LiveStreamHeadlessTask;
