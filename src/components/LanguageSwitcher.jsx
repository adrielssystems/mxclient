import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const currentLang = i18n.language || (typeof window !== 'undefined' ? window.localStorage.getItem('i18nextLng') : null) || 'en';
  const isEnglish = currentLang.startsWith('en');

  const toggleLanguage = () => {
    const newLang = isEnglish ? 'ar' : 'en';
    i18n.changeLanguage(newLang).then(() => {
        document.documentElement.lang = newLang;
        document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    });
  };

  React.useEffect(() => {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang.startsWith('ar') ? 'rtl' : 'ltr';
  }, [currentLang]);

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
      title="Toggle Language"
    >
      <Globe className="w-4 h-4 text-blue-500" />
      <span className="text-[11px] font-black uppercase tracking-widest">
        {t(`language.${isEnglish ? 'ar' : 'en'}`)}
      </span>
    </button>
  );
}
