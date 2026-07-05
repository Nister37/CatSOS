import { store } from '../app/store';
import { setAccessToken, signOut } from '../features/auth/authSlice';

const BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:8000';

let isRefreshing = false;
let waiters: Array<(token: string | null) => void> = [];

async function doRefresh(): Promise<string | null> {
  const refresh = store.getState().auth.refreshToken;
  if (!refresh) return null;

  try {
    const res = await fetch(`${BASE_URL}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (!res.ok) {
      store.dispatch(signOut());
      return null;
    }

    const data = (await res.json()) as { access: string; refresh?: string };
    store.dispatch(
      setAccessToken({ accessToken: data.access, refreshToken: data.refresh ?? refresh }),
    );
    return data.access;
  } catch {
    store.dispatch(signOut());
    return null;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const token = store.getState().auth.accessToken;

  const headers = new Headers(options.headers ?? {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && store.getState().auth.refreshToken) {
    let newToken: string | null;

    if (isRefreshing) {
      newToken = await new Promise<string | null>((resolve) => waiters.push(resolve));
    } else {
      isRefreshing = true;
      newToken = await doRefresh();
      waiters.forEach((resolve) => resolve(newToken));
      waiters = [];
      isRefreshing = false;
    }

    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...options, headers });
    }
  }

  if (!res.ok) {
    throw await res.json().catch(() => ({ detail: 'Request failed' }));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
