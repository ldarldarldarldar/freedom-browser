import React, { createContext, useContext, useEffect, useMemo } from 'react';
import {
  Language,
  TranslationKey,
  normalizeLanguage,
  setActiveLanguage,
  translate,
} from './translations';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key, params) => translate('en', key, params),
});

interface I18nProviderProps {
  currentLanguage?: string;
  onLanguageChange?: (lang: Language) => void;
  children: React.ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  currentLanguage = 'en',
  onLanguageChange,
  children,
}) => {
  const normalized = normalizeLanguage(currentLanguage);

  useEffect(() => {
    setActiveLanguage(normalized);
  }, [normalized]);

  const value = useMemo<I18nContextType>(() => {
    return {
      language: normalized,
      setLanguage: (newLang: Language) => {
        setActiveLanguage(newLang);
        onLanguageChange?.(newLang);
      },
      t: (key: TranslationKey, params?: Record<string, string | number>) => {
        return translate(normalized, key, params);
      },
    };
  }, [normalized, onLanguageChange]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => {
  return useContext(I18nContext);
};
