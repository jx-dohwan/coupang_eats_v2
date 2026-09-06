import axios from 'axios';
import type { ApiSuccess } from './types';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    sessionStorage.setItem('accessToken', token);
  } else {
    sessionStorage.removeItem('accessToken');
  }
}

export function getAccessToken() {
  if (accessToken) return accessToken;
  const stored = sessionStorage.getItem('accessToken');
  accessToken = stored;
  return accessToken;
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const body = response.data as ApiSuccess<unknown> | unknown;
    if (
      body &&
      typeof body === 'object' &&
      'success' in body &&
      (body as ApiSuccess<unknown>).success === true &&
      'data' in body
    ) {
      response.data = (body as ApiSuccess<unknown>).data;
    }
    return response;
  },
  (error) => {
    const message =
      error.response?.data?.message ??
      error.message ??
      '요청에 실패했습니다.';
    return Promise.reject(new Error(Array.isArray(message) ? message.join(', ') : message));
  },
);
