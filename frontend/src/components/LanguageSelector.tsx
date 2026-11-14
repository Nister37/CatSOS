import { useEffect, useRef, useState, useId } from 'react';
import type { SupportedLanguage } from '../features/language/languageSlice';
import { useTranslation } from '../i18n/useTranslation';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'pl', label: 'Polish', nativeName: 'Polski' },
  { code: 'nl', label: 'Dutch', nativeName: 'Nederlands' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
];

interface LanguageSelectorProps {
  id?: string;
  className?: string;
  variant?: 'navbar' | 'mobile' | 'toolbar';
  ariaLabel?: string;
}

export function LanguageSelector({
  id: propId,
  className = '',
  variant = 'navbar',
  ariaLabel,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const autoId = useId();
  const id = propId || `language-select-${autoId}`;

  const { language, setLanguage, t } = useTranslation();
  const labelText = ariaLabel || t('nav.language') || 'Language';

  const currentOption =
    SUPPORTED_LANGUAGE_OPTIONS.find((opt) => opt.code === language) ||
    SUPPORTED_LANGUAGE_OPTIONS[0];

  const handleSelect = (code: SupportedLanguage) => {
    setLanguage(code);
    setIsOpen(false);
    triggerRef.current?.focus();

    if (selectRef.current && selectRef.current.value !== code) {
      selectRef.current.value = code;
      const event = new Event('change', { bubbles: true });
      selectRef.current.dispatchEvent(event);
    }
  };

  // Close dropdown on outside click or tap
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation & accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex(SUPPORTED_LANGUAGE_OPTIONS.findIndex((opt) => opt.code === language));
      return;
    }

    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % SUPPORTED_LANGUAGE_OPTIONS.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev <= 0 ? SUPPORTED_LANGUAGE_OPTIONS.length - 1 : prev - 1
        );
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < SUPPORTED_LANGUAGE_OPTIONS.length) {
          handleSelect(SUPPORTED_LANGUAGE_OPTIONS[focusedIndex].code);
        }
      } else if (e.key === 'Tab') {
        setIsOpen(false);
      }
    }
  };

  const isLight = variant === 'toolbar';

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
    >
      {/* Hidden native select to preserve screen-reader & test-automation compatibility */}
      <label htmlFor={id} className="sr-only">
        {labelText}
      </label>
      <select
        id={id}
        ref={selectRef}
        aria-label={labelText}
        value={language}
        onChange={(e) => handleSelect(e.target.value as SupportedLanguage)}
        className="sr-only"
        tabIndex={-1}
      >
        {SUPPORTED_LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.code.toUpperCase()}
          </option>
        ))}
      </select>

      {/* Styled custom trigger button matching website design */}
      <button
        ref={triggerRef}
        type="button"
        id={`${id}-trigger`}
        aria-label={`${currentOption.nativeName} (${currentOption.code.toUpperCase()})`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onKeyDown={handleKeyDown}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex items-center gap-1.5 h-9 px-2.5 rounded-lg border transition-all duration-200 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 ${
          isLight
            ? 'bg-surface-container hover:bg-surface-container-high border-outline-variant text-on-surface focus-visible:ring-offset-surface'
            : 'bg-on-primary/10 hover:bg-on-primary/20 text-on-primary border-on-primary/20 hover:border-on-primary/35 focus-visible:ring-offset-on-background'
        } ${isOpen ? (isLight ? 'border-primary ring-2 ring-primary/20' : 'border-primary-container/80 bg-on-primary/20 ring-2 ring-primary-container/30') : ''}`}
      >
        <span
          className={`material-symbols-outlined text-[18px] leading-none transition-colors ${
            isLight
              ? 'text-on-surface/70 group-hover:text-primary'
              : 'text-on-primary/75 group-hover:text-primary-container'
          }`}
        >
          language
        </span>
        <span className="font-bold text-label-sm uppercase tracking-wider leading-none">
          {currentOption.code}
        </span>
        <span
          className={`material-symbols-outlined text-[16px] leading-none transition-transform duration-200 ${
            isOpen
              ? 'rotate-180 text-primary-container'
              : isLight
              ? 'text-on-surface/50 group-hover:text-on-surface/80'
              : 'text-on-primary/60 group-hover:text-on-primary/90'
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Custom styled dropdown menu aligned with website design system */}
      {isOpen && (
        <div
          id={`${id}-menu`}
          role="listbox"
          aria-label={labelText}
          style={{ animation: 'popIn 160ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          className={`absolute right-0 mt-2 w-48 rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.3)] border p-1.5 z-[1100] origin-top-right overflow-hidden ${
            isLight
              ? 'bg-surface-container-lowest border-outline-variant text-on-surface'
              : 'bg-[#1a1c1c]/95 glass-nav backdrop-blur-xl border-on-primary/15 text-on-primary'
          }`}
        >
          <div
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
              isLight ? 'text-on-surface/40' : 'text-on-primary/40'
            }`}
          >
            {labelText}
          </div>

          <div className="flex flex-col gap-0.5">
            {SUPPORTED_LANGUAGE_OPTIONS.map((opt, index) => {
              const isSelected = opt.code === language;
              const isFocused = index === focusedIndex;

              return (
                <button
                  key={opt.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.code)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer text-label-sm ${
                    isSelected
                      ? isLight
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'bg-primary-container/20 text-primary-container font-bold'
                      : isFocused
                      ? isLight
                        ? 'bg-surface-container-high text-on-surface'
                        : 'bg-on-primary/10 text-on-primary'
                      : isLight
                      ? 'text-on-surface/80 hover:bg-surface-container hover:text-on-surface font-medium'
                      : 'text-on-primary/80 hover:bg-on-primary/8 hover:text-on-primary font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-flex items-center justify-center min-w-[24px] h-[18px] px-1 rounded text-[10px] font-bold tracking-wider uppercase transition-colors ${
                        isSelected
                          ? isLight
                            ? 'bg-primary text-white'
                            : 'bg-primary-container text-white'
                          : isLight
                          ? 'bg-surface-container-high text-on-surface/70'
                          : 'bg-on-primary/10 text-on-primary/70'
                      }`}
                    >
                      {opt.code}
                    </span>
                    <span className="font-label-md text-label-md">{opt.nativeName}</span>
                  </div>

                  {isSelected && (
                    <span
                      className={`material-symbols-outlined text-[18px] leading-none ${
                        isLight ? 'text-primary' : 'text-primary-container'
                      }`}
                    >
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
