import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export const SUPPORTED_LANGUAGES = ['en', 'pl', 'nl'] as const;
export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_STORAGE_KEY = 'catsos.language';

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type LanguageState = {
  current: SupportedLanguage;
};

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return (
    typeof value === 'string' &&
    SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
  );
}

function syncDocumentLanguage(language: SupportedLanguage) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = language;
}

function readStoredLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(storedLanguage) ? storedLanguage : null;
  } catch {
    return null;
  }
}

function persistLanguage(language: SupportedLanguage) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage failures so private browsing or blocked storage does not break the app.
  }
}

export function getInitialLanguageState(): LanguageState {
  const current = readStoredLanguage() ?? DEFAULT_LANGUAGE;
  syncDocumentLanguage(current);
  return { current };
}

const initialState: LanguageState = getInitialLanguageState();

const languageSlice = createSlice({
  name: 'language',
  initialState,
  reducers: {
    setLanguage(state, action: PayloadAction<SupportedLanguage>) {
      state.current = action.payload;
      syncDocumentLanguage(action.payload);
      persistLanguage(action.payload);
    },
  },
});

export const { setLanguage } = languageSlice.actions;
export default languageSlice.reducer;
