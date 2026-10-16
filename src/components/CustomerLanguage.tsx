'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { MenuItem } from '@/lib/db';
import { customerTranslations } from '@/lib/customer-translations';

type Language = 'cs' | 'en';
const STORAGE_KEY = 'choco-customer-language';
type LanguageContext = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (text: string) => string;
  itemName: (item: MenuItem) => string;
  itemDescription: (item: MenuItem) => string;
};
const Context = createContext<LanguageContext | null>(null);

export function CustomerLanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>('cs');
  const currentLanguage = useRef<Language>('cs');
  const applyLanguage = useCallback((value: Language) => {
    currentLanguage.current = value;
    updateLanguage(value);
    document.documentElement.lang = value;
  }, []);

  useEffect(() => {
    const previousLang = document.documentElement.lang;
    try { applyLanguage(localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'cs'); } catch { applyLanguage('cs'); }
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) applyLanguage(event.newValue === 'en' ? 'en' : 'cs');
    };
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('storage', sync); document.documentElement.lang = previousLang; };
  }, [applyLanguage]);

  const setLanguage = (value: Language) => {
    applyLanguage(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Selection still works without storage. */ }
  };
  // Async payment callbacks also read the latest selected language.
  const t = useCallback((text: string) => currentLanguage.current === 'en' ? (customerTranslations[text] ?? text) : text, []);
  const itemName = (item: MenuItem) => language === 'en' ? (item.englishName?.trim() || item.name) : item.name;
  const itemDescription = (item: MenuItem) => language === 'en' ? (item.englishDescription?.trim() || item.description) : item.description;

  return <Context.Provider value={{ language, setLanguage, t, itemName, itemDescription }}>{children}</Context.Provider>;
}

export function useCustomerLanguage() {
  const context = useContext(Context);
  if (!context) throw new Error('CustomerLanguageProvider is required');
  return context;
}

export function LanguageSwitch() {
  const { language, setLanguage } = useCustomerLanguage();
  return <div className="language-switch" role="group" aria-label="Jazyk / Language">
    <button type="button" lang="cs" aria-label="Čeština" aria-pressed={language === 'cs'} onClick={() => setLanguage('cs')}>CZ</button>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
  </div>;
}
