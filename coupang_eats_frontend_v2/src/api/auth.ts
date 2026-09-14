import { apiClient, setAccessToken } from './client';
import type { AccessTokenResponse, SignInBody } from './types';

export async function signIn(body: SignInBody) {
  const { data } = await apiClient.post<AccessTokenResponse>('/auth/sign-in', body);
  setAccessToken(data.accessToken);
  return data;
}

export async function signOut() {
  await apiClient.post('/auth/sign-out');
  setAccessToken(null);
}

/** 이메일 인증 링크 처리 (GET /auth/verify-email?token=) */
export async function verifyEmail(token: string) {
  const { data } = await apiClient.get<{ message?: string; data?: { message?: string } }>(
    '/auth/verify-email',
    { params: { token } },
  );
  return data;
}

export async function getHealth() {
  const { data } = await apiClient.get<{ status: string }>('/health');
  return data;
}
