import { create } from 'zustand';

export type SupportedLanguage = 'en' | 'gu';

interface LanguageState {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  toggleLanguage: () => void;
}

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  const saved = localStorage.getItem('lf_language');
  if (saved === 'gu' || saved === 'en') {
    document.documentElement.lang = saved;
    return saved;
  }
  return 'en';
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: getInitialLanguage(),
  setLanguage: (language: SupportedLanguage) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lf_language', language);
      document.documentElement.lang = language;
    }
    set({ language });
  },
  toggleLanguage: () =>
    set((state) => {
      const next = state.language === 'en' ? 'gu' : 'en';
      if (typeof window !== 'undefined') {
        localStorage.setItem('lf_language', next);
        document.documentElement.lang = next;
      }
      return { language: next };
    }),
}));
