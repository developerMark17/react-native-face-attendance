// For Android Emulator, use 'http://10.0.2.2:8000'
// For iOS Simulator / Web, use 'http://127.0.0.1:8000'
// For physical devices, use your computer's local IP (e.g., 'http://192.168.1.15:8000')
const DEV_API_BASE_URL = 'http://10.0.2.2:8000';
const PROD_API_BASE_URL = 'https://fastapi-face-attendance.onrender.com';

export const API_BASE_URL = __DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL;

export const ENDPOINTS = {
  registerFace: '/register-face',
  recognizeFace: '/recognize-face',
  attendance: '/attendance',
  adminAttendance: '/admin/attendance',
  token: '/auth/token',
};
