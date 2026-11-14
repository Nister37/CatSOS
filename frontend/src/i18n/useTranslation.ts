import { useContext, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';
import {
  DEFAULT_LANGUAGE,
  setLanguage as setLanguageAction,
  type SupportedLanguage,
} from '../features/language/languageSlice';
import type { RootState } from '../app/store';
import { translations, type TranslationKey } from './translations';

export function useTranslation() {
  const reduxContext = useContext(ReactReduxContext);
  const store = reduxContext?.store;

  const currentLanguage = useSyncExternalStore(
    (callback) => {
      if (!store) return () => {};
      return store.subscribe(callback);
    },
    () => {
      if (!store) return DEFAULT_LANGUAGE;
      const state = store.getState() as RootState;
      return state.language?.current ?? DEFAULT_LANGUAGE;
    },
    () => DEFAULT_LANGUAGE,
  );

  const t = (key: TranslationKey, fallback?: string): string => {
    const langDict = (translations as Record<string, Record<string, string>>)[currentLanguage];
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    const defaultDict = translations.en as Record<string, string>;
    if (defaultDict && defaultDict[key]) {
      return defaultDict[key];
    }
    return fallback ?? key;
  };

  const changeLanguage = (lang: SupportedLanguage) => {
    if (store) {
      store.dispatch(setLanguageAction(lang));
    }
  };

  return {
    t,
    language: currentLanguage,
    setLanguage: changeLanguage,
  };
}
