import axios from 'axios';
import {API_BASE_URL} from '../constants/endpoints';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    Accept: 'application/json',
  },
});

export default apiClient;
