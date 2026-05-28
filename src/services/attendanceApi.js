import apiClient from './apiClient';
import {ENDPOINTS} from '../constants/endpoints';

function buildImageFormData({uri, fileName = 'face.jpg', type = 'image/jpeg'}, fields = {}) {
  const formData = new FormData();

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });

  formData.append('image', {
    uri,
    name: fileName,
    type,
  });

  return formData;
}

export async function registerFace({name, image, ...studentFields}) {
  const data = buildImageFormData(image, {name, ...studentFields});
  const response = await apiClient.post(ENDPOINTS.registerFace, data, {
    headers: {'Content-Type': 'multipart/form-data'},
  });
  return response.data;
}

export async function recognizeFace({
  image,
  challenge,
  action = 'auto',
  course_code,
  session_name,
  latitude,
  longitude,
}) {
  const data = buildImageFormData(image, {
    challenge,
    action,
    course_code,
    session_name,
    latitude,
    longitude,
  });
  const response = await apiClient.post(ENDPOINTS.recognizeFace, data, {
    headers: {'Content-Type': 'multipart/form-data'},
  });
  return response.data;
}

export async function getAttendance() {
  const response = await apiClient.get(ENDPOINTS.attendance);
  return response.data;
}
