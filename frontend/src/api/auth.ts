import { apiRequest } from './client';

const BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:8000';

export type AuthResponse = {
  access: string;
  refresh: string;
  token_type: string;
  user: { id: number; email: string };
};

export type VerificationPendingResponse = {
  detail: string;
  email_verification_required: boolean;
  resend_available_in_seconds: number;
  user: { id: number; email: string };
};

export type CurrentUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  avatar_fallback: string;
};

async function unauthPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data as T;
}

export function register(email: string, password: string, passwordConfirm: string) {
  return unauthPost<VerificationPendingResponse>('/api/auth/register/', {
    email,
    password,
    password_confirm: passwordConfirm,
  });
}

export function verifyEmail(email: string, code: string) {
  return unauthPost<AuthResponse>('/api/auth/verify-email/', { email, code });
}

export function login(email: string, password: string) {
  return unauthPost<AuthResponse>('/api/auth/login/', { email, password });
}

export function refreshToken(refresh: string) {
  return unauthPost<{ access: string; refresh?: string }>('/api/auth/token/refresh/', { refresh });
}

export function getMe() {
  return apiRequest<CurrentUser>('/api/me/');
}

export function resendVerification(email: string) {
  return unauthPost<VerificationPendingResponse>('/api/auth/verification/resend/', { email });
}

export function requestPasswordReset(email: string) {
  return unauthPost<{ detail: string }>('/api/auth/password-reset/', { email });
}

export function confirmPasswordReset(
  uid: string,
  token: string,
  newPassword: string,
  newPasswordConfirm: string,
) {
  return unauthPost<{ detail: string }>('/api/auth/password-reset/confirm/', {
    uid,
    token,
    new_password: newPassword,
    new_password_confirm: newPasswordConfirm,
  });
}
