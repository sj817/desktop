import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import zhCN from '@locales/official/zh-CN.json'

// Language strategy for the official renderer: the source uses natural English
// text as the translation key, so English needs no resource bundle — a missing
// key falls back to the key itself. This makes the migration incremental and
// safe: any string not yet wrapped in t(), or not yet translated, simply renders
// in English. Contributors add a language by translating
// locales/official/<code>.json against locales/official/en-US.json (the catalog
// of every key).

export type LanguageCode = 'en-US' | 'zh-CN'

// Selectable preferences. 'system' resolves to the OS language at launch; a
// concrete code pins a language regardless of the OS.
export const languagePreferences = ['system', 'en-US', 'zh-CN'] as const
export type LanguagePreference = (typeof languagePreferences)[number]

// Autonyms (each language's own name) shown in the picker. 'system' is labelled
// by the caller via t() so it follows the active language.
export const languageAutonyms: Record<LanguageCode, string> = {
  'en-US': 'English',
  'zh-CN': '简体中文',
}

const STORAGE_KEY = 'github-desktop.language'

const resources = {
  'zh-CN': { translation: zhCN },
}

function mapSystemLanguage(navLang: string): LanguageCode {
  return navLang.toLowerCase().split('-')[0] === 'zh' ? 'zh-CN' : 'en-US'
}

function detectSystemLanguage(): LanguageCode {
  const navLang = typeof navigator !== 'undefined' ? navigator.language : ''
  return mapSystemLanguage(navLang)
}

function isPreference(value: string | null): value is LanguagePreference {
  return (
    value !== null &&
    (languagePreferences as readonly string[]).includes(value)
  )
}

// Resolution order: saved choice -> (if 'system' or unset) OS language.
export function getLanguagePreference(): LanguagePreference {
  const stored =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null
  return isPreference(stored) ? stored : 'system'
}

function resolvePreference(pref: LanguagePreference): LanguageCode {
  return pref === 'system' ? detectSystemLanguage() : pref
}

// Persist the choice and apply it. The app remounts on i18next's
// 'languageChanged' event (see ui/index.tsx) so every t() call re-evaluates.
export function setLanguagePreference(pref: LanguagePreference) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, pref)
  }
  return i18n.changeLanguage(resolvePreference(pref))
}

void i18n.use(initReactI18next).init({
  resources,
  lng: resolvePreference(getLanguagePreference()),
  fallbackLng: 'en-US',
  // Natural-language keys contain '.' and ':'; disable separators so the key is
  // looked up literally instead of being parsed as namespace/nesting paths.
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
})

// Bound t() for class components and non-React modules. Always reads the active
// language. Components re-render via the app remount on 'languageChanged'.
export const t = i18n.t.bind(i18n)

export { i18n }
export default i18n
