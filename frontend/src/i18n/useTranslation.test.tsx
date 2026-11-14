import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useTranslation } from './useTranslation';
import { Provider } from 'react-redux';
import { createAppStore } from '../app/store';

describe('useTranslation hook', () => {
  it('returns english translations by default', () => {
    const store = createAppStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.language).toBe('en');
    expect(result.current.t('nav.sightingsMap')).toBe('Sightings Map');
    expect(result.current.t('shelters.title')).toBe('Shelters & Vets');
  });

  it('translates to polish when language is pl', () => {
    const store = createAppStore({
      language: { current: 'pl' },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.language).toBe('pl');
    expect(result.current.t('nav.sightingsMap')).toBe('Mapa zgłoszeń');
    expect(result.current.t('shelters.title')).toBe('Schroniska i weterynarze');
  });

  it('translates to dutch when language is nl', () => {
    const store = createAppStore({
      language: { current: 'nl' },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.language).toBe('nl');
    expect(result.current.t('nav.sightingsMap')).toBe('Waarnemingenkaart');
    expect(result.current.t('shelters.title')).toBe('Asielen & Dierenartsen');
  });

  it('translates to french when language is fr', () => {
    const store = createAppStore({
      language: { current: 'fr' },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.language).toBe('fr');
    expect(result.current.t('nav.sightingsMap')).toBe('Carte des signalements');
    expect(result.current.t('shelters.title')).toBe('Refuges et vétérinaires');
  });

  it('switches language dynamically via setLanguage', () => {
    const store = createAppStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.t('home.heroTitle')).toBe("Lost your cat? We're here to help.");

    act(() => {
      result.current.setLanguage('pl');
    });

    expect(result.current.language).toBe('pl');
    expect(result.current.t('home.heroTitle')).toBe('Zgubiłeś kota? Pomożemy Ci go znaleźć.');
  });
});
