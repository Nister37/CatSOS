import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type AuthUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatarFallback: string;
  profilePictureUrl?: string | null;
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
};

const STORAGE_KEY = 'catsos_auth';

function loadPersistedAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const user = parsed.user && typeof parsed.user === 'object' ? (parsed.user as AuthUser) : null;
    return {
      user,
      accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : null,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
    };
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

const initialState: AuthState = loadPersistedAuth();

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
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, accessToken, refreshToken }));
      } catch {
        /* ignore storage errors */
      }
    },
    updateUser(state, action: PayloadAction<Partial<AuthUser>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              user: state.user,
              accessToken: state.accessToken,
              refreshToken: state.refreshToken,
            }),
          );
        } catch {
          /* ignore storage errors */
        }
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
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ user: state.user, accessToken, refreshToken }),
        );
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

export const { setCredentials, setAccessToken, signOut, updateUser } = authSlice.actions;
export default authSlice.reducer;
