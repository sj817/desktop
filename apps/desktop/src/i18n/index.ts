import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enUS from '@locales/en-US.json'
import zhCN from '@locales/zh-CN.json'
import jaJP from '@locales/ja-JP.json'

export const supportedLanguages = [
  { code: 'en-US', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'ja-JP', label: '日本語' },
] as const

export type LanguageCode = (typeof supportedLanguages)[number]['code']

export const defaultLanguage: LanguageCode = 'en-US'

const STORAGE_KEY = 'github-desktop.language'

const resources = {
  'en-US': { translation: enUS },
  'zh-CN': { translation: zhCN },
  'ja-JP': { translation: jaJP },
}

function isSupported(code: string): code is LanguageCode {
  return supportedLanguages.some(l => l.code === code)
}

// Map a navigator language (e.g. 'zh', 'zh-Hans', 'ja-JP') to a supported code.
function mapSystemLanguage(navLang: string): LanguageCode | null {
  const primary = navLang.toLowerCase().split('-')[0]
  const byPrimary: Record<string, LanguageCode> = {
    zh: 'zh-CN',
    ja: 'ja-JP',
    en: 'en-US',
  }
  return byPrimary[primary] ?? null
}

// Resolution order: saved choice -> system language -> default.
function detectLanguage(): LanguageCode {
  const stored =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null
  if (stored && isSupported(stored)) {
    return stored
  }

  const navLang = typeof navigator !== 'undefined' ? navigator.language : ''
  return (navLang && mapSystemLanguage(navLang)) || defaultLanguage
}

// Switch language and persist the choice for next launch.
export function changeLanguage(code: LanguageCode) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, code)
  }
  return i18n.changeLanguage(code)
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: defaultLanguage,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
})

export default i18n
