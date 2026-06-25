import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type NotificationTone = 'info' | 'success' | 'warning' | 'error';

export type Notification = {
  id: string;
  message: string;
  tone: NotificationTone;
};

type NotificationsState = {
  items: Notification[];
};

const initialState: NotificationsState = {
  items: [],
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: {
      reducer(state, action: PayloadAction<Notification>) {
        state.items.push(action.payload);
      },
      prepare(message: string, tone: NotificationTone = 'info') {
        return {
          payload: {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            message,
            tone,
          },
        };
      },
    },
    dismissNotification(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
  },
});

export const { addNotification, dismissNotification } = notificationsSlice.actions;
export default notificationsSlice.reducer;
