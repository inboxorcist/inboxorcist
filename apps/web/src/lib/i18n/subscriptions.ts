/**
 * Subscriptions page translations
 */
export const subscriptions = {
  en: {
    // Page header
    'subscriptions.title': 'Subscriptions',
    'subscriptions.description':
      'Manage your email subscriptions and unsubscribe from unwanted newsletters',

    // Table headers
    'subscriptions.table.from': 'From',
    'subscriptions.table.emails': 'Emails',
    'subscriptions.table.size': 'Size',
    'subscriptions.table.firstEmail': 'First Email',
    'subscriptions.table.lastEmail': 'Last Email',
    'subscriptions.table.action': 'Action',

    // Sync pending state
    'subscriptions.syncPending.title': 'Your subscriptions will appear here',
    'subscriptions.syncPending.description':
      "We're syncing your inbox. Once complete, you'll see all senders with unsubscribe links.",

    // Empty states
    'subscriptions.noResults': 'No subscriptions found',
    'subscriptions.noResults.description':
      'Emails with unsubscribe links will appear here after sync',

    // Filters
    'subscriptions.search.placeholder': 'Search by sender name or email...',
    'subscriptions.filter.anyCount': 'Any Count',
    'subscriptions.filter.anySize': 'Any Size',
    'subscriptions.filter.anyTime': 'Any Time',
    'subscriptions.filter.last7days': 'Last 7 days',
    'subscriptions.filter.last30days': 'Last 30 days',
    'subscriptions.filter.last90days': 'Last 90 days',
    'subscriptions.filter.lastYear': 'Last year',
    'subscriptions.filter.older1year': 'Older than 1 year',
    'subscriptions.filter.older2years': 'Older than 2 years',
    'subscriptions.filter.customRange': 'Custom range',
    'subscriptions.filter.startDate': 'Start date',
    'subscriptions.filter.endDate': 'End date',

    // Sort options
    'subscriptions.sort.mostEmails': 'Most Emails',
    'subscriptions.sort.fewestEmails': 'Fewest Emails',
    'subscriptions.sort.largestSize': 'Largest Size',
    'subscriptions.sort.smallestSize': 'Smallest Size',
    'subscriptions.sort.newestFirst': 'Newest First Email',
    'subscriptions.sort.oldestFirst': 'Oldest First Email',
    'subscriptions.sort.recentActivity': 'Recent Activity',
    'subscriptions.sort.oldestActivity': 'Oldest Activity',
    'subscriptions.sort.nameAZ': 'Name A-Z',
    'subscriptions.sort.nameZA': 'Name Z-A',

    // Actions
    'subscriptions.view': 'View',
    'subscriptions.unsubscribe': 'Unsub',
    'subscriptions.unsubscribed': 'Unsubscribed',
    'subscriptions.markUnsubscribed': 'Mark Unsubscribed',

    // Bulk actions
    'subscriptions.bulk.markUnsubscribed': 'Mark Unsubscribed',
    'subscriptions.bulk.confirmTitle': 'Mark {count} senders as unsubscribed?',
    'subscriptions.bulk.confirmDescription':
      "This will mark the selected senders as unsubscribed in your list. This action helps you track which senders you've already unsubscribed from, but does not actually unsubscribe you from their emails.",
    'subscriptions.bulk.markAsUnsubscribed': 'Mark as Unsubscribed',

    // Pagination
    'subscriptions.showing': 'Showing {start} - {end} of {total} subscriptions',
  },
  exorcist: {
    // Page header - Who keeps haunting your inbox
    'subscriptions.title': 'The Haunters',
    'subscriptions.description': 'They found your email. They keep coming back.',

    // Table headers
    'subscriptions.table.from': 'Haunter',
    'subscriptions.table.emails': 'Hauntings',
    'subscriptions.table.size': 'Soul Weight',
    'subscriptions.table.firstEmail': 'First Haunting',
    'subscriptions.table.lastEmail': 'Last Haunting',
    'subscriptions.table.action': 'Ritual',

    // Sync pending state
    'subscriptions.syncPending.title': 'Haunters will appear here',
    'subscriptions.syncPending.description':
      "We're sensing what haunts your inbox. Once revealed, you'll see everyone who keeps emailing you.",

    // Empty states
    'subscriptions.noResults': 'No haunters found',
    'subscriptions.noResults.description':
      'Spirits with banishment links will appear here after the scan',

    // Filters
    'subscriptions.search.placeholder': 'Search haunters by name or essence...',
    'subscriptions.filter.anyCount': 'Any Hauntings',
    'subscriptions.filter.anySize': 'Any Weight',
    'subscriptions.filter.anyTime': 'Any Era',
    'subscriptions.filter.last7days': 'Last 7 days',
    'subscriptions.filter.last30days': 'Last 30 days',
    'subscriptions.filter.last90days': 'Last 90 days',
    'subscriptions.filter.lastYear': 'Last year',
    'subscriptions.filter.older1year': 'Ancient (1+ year)',
    'subscriptions.filter.older2years': 'Primordial (2+ years)',
    'subscriptions.filter.customRange': 'Custom era',
    'subscriptions.filter.startDate': 'From era',
    'subscriptions.filter.endDate': 'Until era',

    // Sort options
    'subscriptions.sort.mostEmails': 'Most Hauntings',
    'subscriptions.sort.fewestEmails': 'Fewest Hauntings',
    'subscriptions.sort.largestSize': 'Heaviest Souls',
    'subscriptions.sort.smallestSize': 'Lightest Souls',
    'subscriptions.sort.newestFirst': 'Recent Arrivals',
    'subscriptions.sort.oldestFirst': 'Ancient Arrivals',
    'subscriptions.sort.recentActivity': 'Recent Activity',
    'subscriptions.sort.oldestActivity': 'Dormant Spirits',
    'subscriptions.sort.nameAZ': 'Name A-Z',
    'subscriptions.sort.nameZA': 'Name Z-A',

    // Actions
    'subscriptions.view': 'Observe',
    'subscriptions.unsubscribe': 'Banish',
    'subscriptions.unsubscribed': 'Banished',
    'subscriptions.markUnsubscribed': 'Mark Banished',

    // Bulk actions
    'subscriptions.bulk.markUnsubscribed': 'Mark Banished',
    'subscriptions.bulk.confirmTitle': 'Mark {count} haunters as banished?',
    'subscriptions.bulk.confirmDescription':
      "This will mark the selected haunters as banished in your registry. This helps track which spirits you've already dealt with, but does not perform the actual banishment ritual.",
    'subscriptions.bulk.markAsUnsubscribed': 'Mark as Banished',

    // Pagination
    'subscriptions.showing': 'Revealing {start} - {end} of {total} haunters',
  },
} as const
