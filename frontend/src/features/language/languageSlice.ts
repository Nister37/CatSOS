import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SupportedLanguage = 'en' | 'pl';

type LanguageState = {
  current: SupportedLanguage;
};

const initialState: LanguageState = {
  current: 'en',
};

const languageSlice = createSlice({
  name: 'language',
  initialState,
  reducers: {
    setLanguage(state, action: PayloadAction<SupportedLanguage>) {
      state.current = action.payload;
      document.documentElement.lang = action.payload;
    },
  },
});

export const { setLanguage } = languageSlice.actions;
export default languageSlice.reducer;
