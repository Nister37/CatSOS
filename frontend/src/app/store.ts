import { combineReducers, configureStore } from '@reduxjs/toolkit';

import authReducer from '../features/auth/authSlice';
import languageReducer from '../features/language/languageSlice';
import notificationsReducer from '../features/notifications/notificationsSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  language: languageReducer,
  notifications: notificationsReducer,
});

export function createAppStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  });
}

export const store = createAppStore();

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
