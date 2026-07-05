import reducer, { setLanguage } from './languageSlice';

describe('languageSlice', () => {
  afterEach(() => {
    document.documentElement.lang = 'en';
  });

  it('updates the selected language and document language', () => {
    const state = reducer(undefined, setLanguage('pl'));

    expect(state.current).toBe('pl');
    expect(document.documentElement.lang).toBe('pl');
  });
});
