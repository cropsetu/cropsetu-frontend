/**
 * LanguageContext — provides `t()` translation helper and language switching.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, LANGUAGES } from '../i18n/translations';
import { getItem, setItem } from '../utils/storage';

const LANG_KEY = 'farmeasy_language';
const DEFAULT_LANG = 'en';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANG);
  const [ready, setReady] = useState(false);

  // Load saved language preference
  useEffect(() => {
    (async () => {
      try {
        const saved = await getItem(LANG_KEY);
        if (saved && translations[saved]) {
          setLanguageState(saved);
        }
      } catch {
        // ignore
      }
      setReady(true);
    })();
  }, []);

  const setLanguage = useCallback(async (lang) => {
    if (translations[lang]) {
      setLanguageState(lang);
      await setItem(LANG_KEY, lang);
    }
  }, []);

  const t = useCallback(
    (key, fallback) => {
      // Resolve dot-notation paths: 'login.enterPhone' -> dict.login.enterPhone.
      // Fall back to flat-key lookup first for back-compat.
      const lookup = (dict) => {
        if (!dict || typeof key !== 'string') return undefined;
        if (typeof dict[key] === 'string') return dict[key];
        return key.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), dict);
      };
      const v = lookup(translations[language]) ?? lookup(translations[DEFAULT_LANG]);
      return typeof v === 'string' ? v : (fallback ?? key);
    },
    [language],
  );

  if (!ready) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

export default LanguageContext;
