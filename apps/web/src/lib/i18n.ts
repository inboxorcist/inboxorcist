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
    'stats.totalStorage.inTrash': 'in trash',
    'stats.primary': 'Primary',
    'stats.primary.subtitle': 'Main inbox emails',
    'stats.inTrash': 'In Trash',
    'stats.inTrash.subtitle': 'Awaiting deletion',
    'stats.availableAfterSync': 'Available after sync',

    // Overview - Sync Banner
    'syncBanner.title': 'Unlocking insights',
    'syncBanner.badge': 'Syncing',
    'syncBanner.topSenders': 'Top senders',
    'syncBanner.largeAttachments': 'large attachments',
    'syncBanner.oldEmails': 'old emails',

    // Cleanup Cards (unified section)
    'cleanup.title': 'Quick Cleanup',
    'cleanup.badge': 'Syncing...',
    'cleanup.description': 'Select a category to start cleaning (excludes starred & important)',
    'cleanup.promotions': 'Marketing Emails',
    'cleanup.promotions.desc': 'Newsletters & promos',
    'cleanup.social': 'Social Emails',
    'cleanup.social.desc': 'Social notifications',
    'cleanup.updates': 'Auto Updates',
    'cleanup.updates.desc': 'Automated notifications',
    'cleanup.forums': 'Forum Emails',
    'cleanup.forums.desc': 'Discussion threads',
    'cleanup.ancient': 'Ancient Emails',
    'cleanup.ancient.desc': 'Over 2 years old',
    'cleanup.stale': 'Stale Emails',
    'cleanup.stale.desc': 'Over 1 year old',
    'cleanup.heavy': 'Heavy Emails',
    'cleanup.heavy.desc': 'Over 10 MB',
    'cleanup.bloated': 'Bloated Emails',
    'cleanup.bloated.desc': 'Over 5 MB',
    'cleanup.readPromos': 'Read Marketing',
    'cleanup.readPromos.desc': 'Already read promos',
    'cleanup.spam': 'Clear Spam',
    'cleanup.spam.desc': 'Empty spam folder',
    'cleanup.trash': 'Empty Trash',
    'cleanup.trash.desc': 'Permanent delete',

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
    'stats.totalStorage.inTrash': 'in the abyss',
    'stats.primary': 'Sacred Ground',
    'stats.primary.subtitle': 'Protected messages',
    'stats.inTrash': 'In the Abyss',
    'stats.inTrash.subtitle': 'Awaiting purge',
    'stats.availableAfterSync': 'Awaiting detection',

    // Overview - Sync Banner
    'syncBanner.title': 'Sensing the presence',
    'syncBanner.badge': 'Scanning',
    'syncBanner.topSenders': 'most frequent haunters',
    'syncBanner.largeAttachments': 'space-devouring demons',
    'syncBanner.oldEmails': 'forgotten spirits',

    // Cleanup Cards (unified section)
    'cleanup.title': 'Quick Exorcism',
    'cleanup.badge': 'Sensing...',
    'cleanup.description': 'Banish spirits by category (protects starred & important)',
    'cleanup.promotions': 'Possessed Promos',
    'cleanup.promotions.desc': 'Marketing demons',
    'cleanup.social': 'Social Spirits',
    'cleanup.social.desc': 'Social hauntings',
    'cleanup.updates': 'Update Demons',
    'cleanup.updates.desc': 'Automated curses',
    'cleanup.forums': 'Forum Phantoms',
    'cleanup.forums.desc': 'Discussion spirits',
    'cleanup.ancient': 'Ancient Curses',
    'cleanup.ancient.desc': 'Haunting 2+ years',
    'cleanup.stale': 'Lingering Spirits',
    'cleanup.stale.desc': 'Haunting 1+ year',
    'cleanup.heavy': 'Heavy Hauntings',
    'cleanup.heavy.desc': 'Space devourers',
    'cleanup.bloated': 'Bloated Beasts',
    'cleanup.bloated.desc': 'Storage leeches',
    'cleanup.readPromos': 'Silent Promos',
    'cleanup.readPromos.desc': 'Already read demons',
    'cleanup.spam': 'Banish Spam',
    'cleanup.spam.desc': 'Purge spam spirits',
    'cleanup.trash': 'Purge the Abyss',
    'cleanup.trash.desc': 'Final banishment',

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
