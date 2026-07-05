import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type AuthUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatarFallback: string;
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
};

const STORAGE_KEY = 'catsos_auth';

function loadPersistedTokens(): Pick<AuthState, 'accessToken' | 'refreshToken'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null };
    const { accessToken, refreshToken } = JSON.parse(raw) as Record<string, unknown>;
    return {
      accessToken: typeof accessToken === 'string' ? accessToken : null,
      refreshToken: typeof refreshToken === 'string' ? refreshToken : null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

const initialState: AuthState = {
  user: null,
  ...loadPersistedTokens(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ user: AuthUser; accessToken: string; refreshToken: string }>,
    ) {
      const { user, accessToken, refreshToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken, refreshToken }));
      } catch {
        /* ignore storage errors */
      }
    },
    setAccessToken(
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string }>,
    ) {
      const { accessToken, refreshToken } = action.payload;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken, refreshToken }));
      } catch {
        /* ignore storage errors */
      }
    },
    signOut(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore storage errors */
      }
    },
  },
});

export const { setCredentials, setAccessToken, signOut } = authSlice.actions;
export default authSlice.reducer;
