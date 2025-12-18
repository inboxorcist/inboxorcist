import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { type Language, type TranslationKey, getTranslation, getSyncPhase } from '@/lib/i18n'

const STORAGE_KEY = 'inboxorcist-language'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  isExorcistMode: boolean
  toggleExorcistMode: () => void
  t: (key: TranslationKey) => string
  /** Get sync phase message based on percentage and status */
  tSyncPhase: (percentage: number, status: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'en' || stored === 'exorcist') {
        return stored
      }
    }
    return 'en'
  })

  // Persist language preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
  }, [language])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
  }

  const isExorcistMode = language === 'exorcist'

  const toggleExorcistMode = () => {
    setLanguageState((prev) => (prev === 'en' ? 'exorcist' : 'en'))
  }

  const t = (key: TranslationKey): string => {
    return getTranslation(key, language)
  }

  const tSyncPhase = (percentage: number, status: string): string => {
    return getSyncPhase(percentage, status, language)
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        isExorcistMode,
        toggleExorcistMode,
        t,
        tSyncPhase,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- Hook must be exported alongside Provider
export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
