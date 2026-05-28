export class AttendanceWebSocket {
  ws = null;
  url = '';
  reconnectAttempts = 0;
  maxReconnectAttempts = 5;
  reconnectDelay = 3000;
  listeners = {
    connected: [],
    disconnected: [],
    attendance: [],
    error: [],
  };

  constructor(baseUrl = 'http://127.0.0.1:8000') {
    // Convert http to ws, https to wss
    this.url = baseUrl.replace(/^http/, 'ws') + '/ws/attendance';
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();

          // Send ping every 30s to keep connection alive
          this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send('ping');
            }
          }, 30000);
        };

        this.ws.onmessage = event => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'attendance') {
              this.emit('attendance', data.data);
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        this.ws.onerror = error => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          clearInterval(this.pingInterval);
          this.emit('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        reject(error);
      }
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect().catch(err => console.error('Reconnect failed:', err));
      }, this.reconnectDelay);
    }
  }

  disconnect() {
    clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

let instance = null;

export function getAttendanceWebSocket(baseUrl) {
  if (!instance) {
    instance = new AttendanceWebSocket(baseUrl);
  }
  return instance;
}
