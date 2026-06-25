import { createSlice } from '@reduxjs/toolkit';

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type AuthState = {
  user: AuthUser | null;
};

const initialState: AuthState = {
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signInDemoUser(state) {
      state.user = {
        id: 'demo-user',
        name: 'Demo Coordinator',
        email: 'coordinator@example.com',
      };
    },
    signOut(state) {
      state.user = null;
    },
  },
});

export const { signInDemoUser, signOut } = authSlice.actions;
export default authSlice.reducer;
