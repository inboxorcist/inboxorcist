/**
 * Explorer page translations
 *
 * The Explorer is "The Archives" in exorcist mode - where all spirits
 * are cataloged and where you select them for banishment (deletion).
 */
export const explorer = {
  en: {
    // Page header
    'explorer.title': 'Explorer',
    'explorer.description': 'Browse and manage your emails',

    // Sync pending state
    'explorer.syncPending.title': 'Your emails will appear here',
    'explorer.syncPending.description':
      "We're syncing your inbox. Once complete, you'll be able to browse and filter all your emails.",

    // Empty states
    'explorer.noEmails': 'No emails found',
    'explorer.noEmails.description': 'Try adjusting your filters',

    // Pagination
    'explorer.showing': 'Showing',
    'explorer.of': 'of',
    'explorer.emails': 'emails',
    'explorer.page': 'Page',

    // Filters
    'explorer.search': 'Search',
    'explorer.clearAll': 'Clear All',
    'explorer.searchSubject': 'Search subject...',
    'explorer.filterBySender': 'Filter by sender...',
    'explorer.searchSenders': 'Search senders...',
    'explorer.noSendersFound': 'No senders found',
    'explorer.filterByLabel': 'Filter by label...',
    'explorer.searchLabels': 'Search labels...',
    'explorer.noLabelsFound': 'No labels found',

    // Filter labels
    'explorer.filters.category': 'Category',
    'explorer.filters.allCategories': 'All Categories',
    'explorer.filters.dateRange': 'Date Range',
    'explorer.filters.anyTime': 'Any Time',
    'explorer.filters.size': 'Size',
    'explorer.filters.anySize': 'Any Size',
    'explorer.filters.status': 'Status',
    'explorer.filters.anyStatus': 'Any Status',
    'explorer.filters.read': 'Read',
    'explorer.filters.unread': 'Unread',
    'explorer.filters.hasAttachment': 'Has Attachment',

    // Actions
    'explorer.actions.trash': 'Move to Trash',
    'explorer.actions.delete': 'Delete Forever',
    'explorer.actions.selected': 'selected',

    // Select all banner
    'explorer.selectAll.allOnPage': 'All {count} emails on this page are selected.',
    'explorer.selectAll.selectMatching': 'Select all {total} matching emails',
    'explorer.selectAll.allMatching': 'All {total} matching emails are selected.',
    'explorer.selectAll.clearSelection': 'Clear selection',

    // Delete dialog
    'explorer.delete.title': 'Delete {count} emails permanently?',
    'explorer.delete.description':
      'This action cannot be undone. These emails will be permanently deleted from your Gmail account.',
    'explorer.delete.confirmText': 'permanently delete',
    'explorer.delete.confirm': 'Delete Forever',
  },
  exorcist: {
    // Page header - Browse all the spirits haunting your inbox
    'explorer.title': 'All Spirits',
    'explorer.description': 'Browse and banish',

    // Sync pending state
    'explorer.syncPending.title': 'Spirits will appear here',
    'explorer.syncPending.description':
      "We're sensing what haunts your inbox. Once revealed, you can browse and banish them.",

    // Empty states
    'explorer.noEmails': 'No spirits found',
    'explorer.noEmails.description': 'Try adjusting your ritual parameters',

    // Pagination
    'explorer.showing': 'Revealing',
    'explorer.of': 'of',
    'explorer.emails': 'spirits',
    'explorer.page': 'Page',

    // Filters
    'explorer.search': 'Seek',
    'explorer.clearAll': 'Clear All',
    'explorer.searchSubject': 'Search the whispers...',
    'explorer.filterBySender': 'Filter by haunter...',
    'explorer.searchSenders': 'Search haunters...',
    'explorer.noSendersFound': 'No haunters found',
    'explorer.filterByLabel': 'Filter by sigil...',
    'explorer.searchLabels': 'Search sigils...',
    'explorer.noLabelsFound': 'No sigils found',

    // Filter labels
    'explorer.filters.category': 'Spirit Type',
    'explorer.filters.allCategories': 'All Spirits',
    'explorer.filters.dateRange': 'Time Period',
    'explorer.filters.anyTime': 'Any Era',
    'explorer.filters.size': 'Soul Weight',
    'explorer.filters.anySize': 'Any Weight',
    'explorer.filters.status': 'Seal',
    'explorer.filters.anyStatus': 'Any Seal',
    'explorer.filters.read': 'Opened',
    'explorer.filters.unread': 'Sealed',
    'explorer.filters.hasAttachment': 'Has Artifact',

    // Actions - The exorcism itself
    'explorer.actions.trash': 'Cast to the Void',
    'explorer.actions.delete': 'Banish Forever',
    'explorer.actions.selected': 'marked',

    // Select all banner
    'explorer.selectAll.allOnPage': 'All {count} spirits on this page are marked.',
    'explorer.selectAll.selectMatching': 'Mark all {total} matching spirits',
    'explorer.selectAll.allMatching': 'All {total} matching spirits are marked for banishment.',
    'explorer.selectAll.clearSelection': 'Release selection',

    // Delete dialog - The final banishment
    'explorer.delete.title': 'Banish {count} spirits forever?',
    'explorer.delete.description':
      'This ritual cannot be undone. These spirits will be permanently banished from your realm.',
    'explorer.delete.confirmText': 'banish forever',
    'explorer.delete.confirm': 'Perform Banishment',
  },
} as const
