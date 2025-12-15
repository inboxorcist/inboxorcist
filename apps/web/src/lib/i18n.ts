/**
 * Simple i18n system with two modes:
 * - "en": Default clear language
 * - "exorcist": Horror-comedy themed language
 */

export type Language = 'en' | 'exorcist'

export const translations = {
  en: {
    // Page Headers
    'overview.title': 'Overview',
    'overview.description': 'Your inbox at a glance',
    'explorer.title': 'Explorer',
    'explorer.description': 'Browse and manage your emails',
    'explorer.syncPending.title': 'Your emails will appear here',
    'explorer.syncPending.description':
      "We're syncing your inbox. Once complete, you'll be able to browse and filter all your emails.",
    'explorer.noEmails': 'No emails found',
    'explorer.noEmails.description': 'Try adjusting your filters',
    'explorer.showing': 'Showing',
    'explorer.of': 'of',
    'explorer.emails': 'emails',
    'explorer.page': 'Page',
    'explorer.search': 'Search',
    'explorer.clearAll': 'Clear All',
    'explorer.searchSubject': 'Search subject...',
    'explorer.filterBySender': 'Filter by sender...',
    'explorer.searchSenders': 'Search senders...',
    'explorer.noSendersFound': 'No senders found',

    // Sync Progress
    'sync.title.active': 'Syncing Emails',
    'sync.title.failed': 'Sync Interrupted',
    'sync.title.complete': 'Sync Complete',
    'sync.badge': 'Live',
    'sync.progress': 'Progress',
    'sync.timeRemaining': 'Time remaining',
    'sync.resume': 'Resume',

    // Overview - Stats
    'stats.totalEmails': 'Total Emails',
    'stats.totalEmails.subtitle': 'In your inbox',
    'stats.unread': 'Unread',
    'stats.promotions': 'Promotions',
    'stats.promotions.subtitle': 'Marketing & newsletters',
    'stats.social': 'Social',
    'stats.social.subtitle': 'Social notifications',
    'stats.updates': 'Updates',
    'stats.updates.subtitle': 'Automated updates',
    'stats.forums': 'Forums',
    'stats.forums.subtitle': 'Forum discussions',
    'stats.largeFiles': 'Large Files',
    'stats.largeFiles.subtitle': 'Over 10 MB',
    'stats.oldEmails': 'Old Emails',
    'stats.oldEmails.subtitle': 'Over 2 years old',
    'stats.uniqueSenders': 'Unique Senders',
    'stats.uniqueSenders.subtitle': 'Different people/companies',
    'stats.totalStorage': 'Total Storage',
    'stats.totalStorage.subtitle': 'Email inbox size',
    'stats.primary': 'Primary',
    'stats.primary.subtitle': 'Main inbox emails',
    'stats.topSender': 'Top Sender',
    'stats.availableAfterSync': 'Available after sync',

    // Overview - Sync Banner
    'syncBanner.title': 'Unlocking insights',
    'syncBanner.badge': 'Syncing',
    'syncBanner.topSenders': 'Top senders',
    'syncBanner.largeAttachments': 'large attachments',
    'syncBanner.oldEmails': 'old emails',

    // Overview - Quick Cleanup
    'quickCleanup.title': 'Quick Cleanup',
    'quickCleanup.badge': 'Available after sync',
    'quickCleanup.description': 'Select a category to start cleaning',
    'quickCleanup.promotions': 'Promotions',
    'quickCleanup.promotions.desc': 'Marketing emails and newsletters',
    'quickCleanup.social': 'Social',
    'quickCleanup.social.desc': 'Social media notifications',
    'quickCleanup.updates': 'Updates',
    'quickCleanup.updates.desc': 'Automated notifications',
    'quickCleanup.forums': 'Forums',
    'quickCleanup.forums.desc': 'Forum discussions',

    // Overview - Deep Cleanup
    'deepCleanup.title': 'Advanced Cleanup',
    'deepCleanup.badge': 'Requires sync',
    'deepCleanup.description.ready': 'Target old and large emails',
    'deepCleanup.description.waiting': 'Complete sync to unlock these options',
    'deepCleanup.ancient': 'Ancient',
    'deepCleanup.ancient.desc': 'Over 2 years old',
    'deepCleanup.stale': 'Stale',
    'deepCleanup.stale.desc': 'Over 1 year old',
    'deepCleanup.heavy': 'Heavy',
    'deepCleanup.heavy.desc': 'Over 10 MB',
    'deepCleanup.bloated': 'Bloated',
    'deepCleanup.bloated.desc': 'Over 5 MB',

    // Overview - Power Moves
    'powerMoves.title': 'Power Moves',
    'powerMoves.description': 'One-click bulk delete',
    'powerMoves.promoPurge': 'Promo Purge',
    'powerMoves.promoPurge.desc': 'Delete all promotions & social',
    'powerMoves.thePurge': 'The Purge',
    'powerMoves.thePurge.desc': 'Delete emails 2+ years old',
    'powerMoves.spaceSaver': 'Space Saver',
    'powerMoves.spaceSaver.desc': 'Delete large attachments',

    // Settings
    'settings.exorcistMode': 'Exorcist Mode',
    'settings.exorcistMode.desc': 'Enable spooky themed language',
    'settings.exorcistMode.on': 'The spirits speak through you',
    'settings.exorcistMode.off': 'Standard mode',

    // Get Started Page
    'getStarted.tagline1': 'The power of delete',
    'getStarted.tagline2': 'compels you',
    'getStarted.description':
      "Bulk delete emails that Gmail's UI can't handle. 100k+ promotions, social updates, newsletters — gone in minutes.",
    'getStarted.title': 'Get started',
    'getStarted.subtitle': 'Connect your Gmail to begin cleaning up',
    'getStarted.connectButton': 'Connect with Gmail',
    'getStarted.trust1': 'Read & delete access only',
    'getStarted.trust2': 'Runs 100% on your machine',
    'getStarted.trust3': 'No data stored or sent anywhere',
  },

  exorcist: {
    // Page Headers
    'overview.title': 'The Sanctum',
    'overview.description': 'Survey the haunted grounds',
    'explorer.title': 'The Archives',
    'explorer.description': 'Browse and banish your spirits',
    'explorer.syncPending.title': 'Your spirits will manifest here',
    'explorer.syncPending.description':
      "We're sensing the spirits in your mailbox. Once the scan completes, you'll be able to browse and banish all your demons.",
    'explorer.noEmails': 'No spirits found',
    'explorer.noEmails.description': 'Try adjusting your ritual parameters',
    'explorer.showing': 'Revealing',
    'explorer.of': 'of',
    'explorer.emails': 'spirits',
    'explorer.page': 'Page',
    'explorer.search': 'Seek',
    'explorer.clearAll': 'Reset Ritual',
    'explorer.searchSubject': 'Search spirits...',
    'explorer.filterBySender': 'Filter by haunter...',
    'explorer.searchSenders': 'Search haunters...',
    'explorer.noSendersFound': 'No haunters found',

    // Sync Progress (Sync = Sensing spirits before exorcism)
    'sync.title.active': 'Sensing Presence',
    'sync.title.failed': 'Scan Interrupted',
    'sync.title.complete': 'Spirits Revealed',
    'sync.badge': 'Sensing',
    'sync.progress': 'Scan progress',
    'sync.timeRemaining': 'Scan completes in',
    'sync.resume': 'Resume Scan',

    // Overview - Stats
    'stats.totalEmails': 'Total Spirits',
    'stats.totalEmails.subtitle': 'Haunting your inbox',
    'stats.unread': 'Unsealed',
    'stats.promotions': 'Tempters',
    'stats.promotions.subtitle': 'Marketing demons',
    'stats.social': 'Phantoms',
    'stats.social.subtitle': 'Social spirits',
    'stats.updates': 'Wraiths',
    'stats.updates.subtitle': 'Automated hauntings',
    'stats.forums': 'Specters',
    'stats.forums.subtitle': 'Forum spirits',
    'stats.largeFiles': 'Heavy Demons',
    'stats.largeFiles.subtitle': 'Over 10 MB each',
    'stats.oldEmails': 'Ancient Spirits',
    'stats.oldEmails.subtitle': 'Haunting 2+ years',
    'stats.uniqueSenders': 'Haunters',
    'stats.uniqueSenders.subtitle': 'Different spirits',
    'stats.totalStorage': 'Soul Weight',
    'stats.totalStorage.subtitle': 'Burden on your inbox',
    'stats.primary': 'Sacred Ground',
    'stats.primary.subtitle': 'Protected messages',
    'stats.topSender': 'Biggest Haunter',
    'stats.availableAfterSync': 'Awaiting detection',

    // Overview - Sync Banner
    'syncBanner.title': 'Sensing the presence',
    'syncBanner.badge': 'Scanning',
    'syncBanner.topSenders': 'most frequent haunters',
    'syncBanner.largeAttachments': 'space-devouring demons',
    'syncBanner.oldEmails': 'forgotten spirits',

    // Overview - Quick Cleanup (Cleanup = Exorcism)
    'quickCleanup.title': 'Quick Exorcism',
    'quickCleanup.badge': 'Scan required',
    'quickCleanup.description': 'Banish common haunters by category',
    'quickCleanup.promotions': 'Tempters',
    'quickCleanup.promotions.desc': 'Marketing demons & newsletters',
    'quickCleanup.social': 'Phantoms',
    'quickCleanup.social.desc': 'Social media spirits',
    'quickCleanup.updates': 'Wraiths',
    'quickCleanup.updates.desc': 'Automated hauntings',
    'quickCleanup.forums': 'Specters',
    'quickCleanup.forums.desc': 'Forum spirits',

    // Overview - Deep Cleanup
    'deepCleanup.title': 'Deep Exorcism',
    'deepCleanup.badge': 'Scan required',
    'deepCleanup.description.ready': 'Banish the ancient and oversized demons',
    'deepCleanup.description.waiting': 'Banish forgotten and bloated spirits',
    'deepCleanup.ancient': 'Forgotten Souls',
    'deepCleanup.ancient.desc': 'Haunting 2+ years',
    'deepCleanup.stale': 'Lingering Spirits',
    'deepCleanup.stale.desc': 'Haunting 1+ year',
    'deepCleanup.heavy': 'Heavy Demons',
    'deepCleanup.heavy.desc': 'Space devourers',
    'deepCleanup.bloated': 'Bloated Beasts',
    'deepCleanup.bloated.desc': 'Storage leeches',

    // Overview - Power Moves
    'powerMoves.title': 'Forbidden Rituals',
    'powerMoves.description': 'Mass banishment spells',
    'powerMoves.promoPurge': 'Banish Tempters',
    'powerMoves.promoPurge.desc': 'Exorcise all tempters & phantoms',
    'powerMoves.thePurge': 'Release the Forgotten',
    'powerMoves.thePurge.desc': 'Free souls haunting 2+ years',
    'powerMoves.spaceSaver': 'Devour Devourers',
    'powerMoves.spaceSaver.desc': 'Reclaim your sacred space',

    // Settings
    'settings.exorcistMode': 'Exorcist Mode',
    'settings.exorcistMode.desc': 'The spirits speak through the interface',
    'settings.exorcistMode.on': 'The power compels you',
    'settings.exorcistMode.off': 'Return to the mundane',

    // Get Started Page
    'getStarted.tagline1': 'The power of delete',
    'getStarted.tagline2': 'compels you',
    'getStarted.description':
      "Banish the demons that Gmail's UI cannot handle. 100k+ marketing demons, social phantoms, newsletters — exorcised in minutes.",
    'getStarted.title': 'Begin the ritual',
    'getStarted.subtitle': 'Connect your Gmail to start the exorcism',
    'getStarted.connectButton': 'Summon Gmail',
    'getStarted.trust1': 'Read & banish access only',
    'getStarted.trust2': 'Rituals performed locally',
    'getStarted.trust3': 'No souls harvested or stored',
  },
} as const

export type TranslationKey = keyof typeof translations.en

/**
 * Get a translation for the given key and language
 */
export function getTranslation(key: TranslationKey, language: Language): string {
  return translations[language][key] || translations.en[key] || key
}
