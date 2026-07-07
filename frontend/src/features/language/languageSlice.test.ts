import reducer, {
  DEFAULT_LANGUAGE,
  getInitialLanguageState,
  LANGUAGE_STORAGE_KEY,
  setLanguage,
} from './languageSlice';

describe('languageSlice', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = DEFAULT_LANGUAGE;
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = DEFAULT_LANGUAGE;
  });

  it('updates the selected language, document language, and stored preference', () => {
    const state = reducer(undefined, setLanguage('pl'));

    expect(state.current).toBe('pl');
    expect(document.documentElement.lang).toBe('pl');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pl');
  });

  it('loads a supported language from local storage', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'nl');

    const state = getInitialLanguageState();

    expect(state.current).toBe('nl');
    expect(document.documentElement.lang).toBe('nl');
  });

  it('falls back to English for unsupported stored language values', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');

    const state = getInitialLanguageState();

    expect(state.current).toBe(DEFAULT_LANGUAGE);
    expect(document.documentElement.lang).toBe(DEFAULT_LANGUAGE);
  });
});
