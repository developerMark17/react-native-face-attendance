const DEV_API_BASE_URL = 'http://127.0.0.1:8000';
const PROD_API_BASE_URL = 'https://your-api-domain.com';

export const API_BASE_URL = __DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL;

export const ENDPOINTS = {
  registerFace: '/register-face',
  recognizeFace: '/recognize-face',
  attendance: '/attendance',
  adminAttendance: '/admin/attendance',
  token: '/auth/token',
};
