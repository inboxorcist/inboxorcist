/**
 * Centralized i18n system with modular translation files
 *
 * Two language modes:
 * - "en": Default clear language
 * - "exorcist": Horror-comedy themed language
 */

import { common } from './common'
import { sync } from './sync'
import { overview } from './overview'
import { explorer } from './explorer'
import { subscriptions } from './subscriptions'
import { settings } from './settings'
import { getStarted } from './getStarted'
import { dialogs } from './dialogs'
import { filters } from './filters'
import { bishop } from './bishop'

export type Language = 'en' | 'exorcist'

// Merge all translations
const mergeTranslations = (
  ...sources: Record<Language, Record<string, string>>[]
): Record<Language, Record<string, string>> => {
  const result: Record<Language, Record<string, string>> = {
    en: {},
    exorcist: {},
  }

  for (const source of sources) {
    for (const lang of ['en', 'exorcist'] as const) {
      Object.assign(result[lang], source[lang])
    }
  }

  return result
}

export const translations = mergeTranslations(
  common,
  sync,
  overview,
  explorer,
  subscriptions,
  settings,
  getStarted,
  dialogs,
  filters,
  bishop
)

export type TranslationKey = keyof typeof translations.en

/**
 * Get a translation for the given key and language
 */
export function getTranslation(key: TranslationKey, language: Language): string {
  return translations[language][key] || translations.en[key] || key
}

/**
 * Get sync phase message based on percentage and status
 */
export function getSyncPhase(percentage: number, status: string, language: Language): string {
  const t = (key: string) => translations[language][key] || translations.en[key] || key

  if (status === 'completed') {
    return t('sync.phase.complete')
  }
  if (status === 'failed') {
    return t('sync.phase.failed')
  }
  if (status === 'cancelled') {
    return t('sync.phase.cancelled')
  }
  if (status === 'paused') {
    return t('sync.phase.paused')
  }
  if (status === 'pending') {
    return t('sync.phase.pending')
  }

  // Running status - phase based on percentage
  if (percentage < 5) {
    return t('sync.phase.starting')
  }
  if (percentage < 20) {
    return t('sync.phase.early')
  }
  if (percentage < 40) {
    return t('sync.phase.progress')
  }
  if (percentage < 60) {
    return t('sync.phase.midway')
  }
  if (percentage < 85) {
    return t('sync.phase.advanced')
  }
  return t('sync.phase.finishing')
}

// Re-export individual modules for direct imports if needed
export {
  common,
  sync,
  overview,
  explorer,
  subscriptions,
  settings,
  getStarted,
  dialogs,
  filters,
  bishop,
}
