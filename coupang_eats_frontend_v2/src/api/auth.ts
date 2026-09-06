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

export async function getHealth() {
  const { data } = await apiClient.get<{ status: string }>('/health');
  return data;
}
