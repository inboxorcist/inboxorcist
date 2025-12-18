/**
 * Sync progress translations
 *
 * The sync process maps to the first phase of an exorcism:
 * - Sensing the spirits (detecting emails)
 * - Spirits manifesting (emails appearing)
 * - Learning their names (cataloging senders - knowing names gives power!)
 * - Recording in the grimoire (saving to database)
 *
 * Phase thresholds:
 * - 0-5%: starting (preparing)
 * - 5-20%: early (connecting, first contact)
 * - 20-40%: progress (scanning, detecting)
 * - 40-60%: midway (processing, cataloging)
 * - 60-85%: advanced (continuing to process)
 * - 85-100%: finishing (wrapping up)
 */
export const sync = {
  en: {
    // Titles
    'sync.title.active': 'Syncing Emails',
    'sync.title.failed': 'Sync Interrupted',
    'sync.title.complete': 'Sync Complete',
    'sync.title.pending': 'Starting Sync',
    'sync.title.paused': 'Sync Paused',
    'sync.title.cancelled': 'Sync Cancelled',

    // Badge
    'sync.badge': 'Live',

    // Actions
    'sync.resume': 'Resume',
    'sync.cancel': 'Cancel',
    'sync.start': 'Start Sync',

    // Progress phases (based on percentage)
    'sync.phase.pending': 'Preparing to sync...',
    'sync.phase.starting': 'Connecting to Gmail...',
    'sync.phase.early': 'Fetching email list...',
    'sync.phase.progress': 'Scanning your inbox...',
    'sync.phase.midway': 'Processing messages...',
    'sync.phase.advanced': 'Still crunching...',
    'sync.phase.finishing': 'Almost done...',
    'sync.phase.complete': 'Sync complete',
    'sync.phase.failed': 'Sync interrupted',
    'sync.phase.cancelled': 'Sync was cancelled',
    'sync.phase.paused': 'Sync paused',

    // Stats
    'sync.remaining': 'remaining',
    'sync.rate': 'emails/sec',
    'sync.calculating': 'Calculating...',
  },
  exorcist: {
    // Titles - The sync is sensing what haunts the inbox
    'sync.title.active': 'Sensing the Presence',
    'sync.title.failed': 'Connection Lost',
    'sync.title.complete': 'Spirits Revealed',
    'sync.title.pending': 'Preparing...',
    'sync.title.paused': 'Paused',
    'sync.title.cancelled': 'Abandoned',

    // Badge
    'sync.badge': 'Live',

    // Actions
    'sync.resume': 'Resume',
    'sync.cancel': 'Abandon',
    'sync.start': 'Begin Séance',

    // Progress phases - follows the exorcism detection journey
    'sync.phase.pending': 'Drawing the ritual circle...',
    'sync.phase.starting': 'The veil between worlds thins...',
    'sync.phase.early': 'First spirits stir...',
    'sync.phase.progress': 'They are manifesting...',
    'sync.phase.midway': 'Learning their true names...',
    'sync.phase.advanced': 'So many souls...',
    'sync.phase.finishing': 'Sealing the grimoire...',
    'sync.phase.complete': 'The spirits stand revealed',
    'sync.phase.failed': 'The connection was severed',
    'sync.phase.cancelled': 'The séance was abandoned',
    'sync.phase.paused': 'The spirits wait...',

    // Stats
    'sync.remaining': 'remaining',
    'sync.rate': 'spirits/sec',
    'sync.calculating': 'Sensing...',
  },
} as const
