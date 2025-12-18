/**
 * Dialog translations (unsubscribe, delete, etc.)
 */
export const dialogs = {
  en: {
    // Unsubscribe Dialog
    'dialog.unsubscribe.title': 'Unsubscribe from {sender}',
    'dialog.unsubscribe.description':
      "You'll be redirected to the sender's unsubscribe page. After unsubscribing, come back here to confirm.",
    'dialog.unsubscribe.unknownSender': 'Unknown sender',
    'dialog.unsubscribe.emailCount': '{count} emails',
    'dialog.unsubscribe.step1.title': 'Open unsubscribe page',
    'dialog.unsubscribe.step1.description': 'Click below to open the unsubscribe page in a new tab',
    'dialog.unsubscribe.step1.button': 'Open Unsubscribe Page',
    'dialog.unsubscribe.step2.title': 'Confirm completion',
    'dialog.unsubscribe.step2.description':
      'After completing the unsubscription on their page, confirm here to remove this sender from your list',
    'dialog.unsubscribe.cancel': 'Cancel',
    'dialog.unsubscribe.confirm': "I've Unsubscribed",
    'dialog.unsubscribe.toast.alreadyDone': 'Already marked as unsubscribed',
    'dialog.unsubscribe.toast.success': 'Marked as unsubscribed',
    'dialog.unsubscribe.toast.error': 'Failed to mark as unsubscribed',

    // Delete Dialog
    'dialog.delete.title': 'Permanently Delete {count} Email{plural}?',
    'dialog.delete.description':
      'You are about to <strong>permanently delete</strong> {count} email{plural} from your Gmail account.',
    'dialog.delete.warning.title': 'This action cannot be undone',
    'dialog.delete.warning.description':
      "These emails will be permanently removed from Gmail's servers. You will not be able to recover them through Gmail, Inboxorcist, or any other means.",
    'dialog.delete.confirmPrompt': 'To confirm, type <code>{expectedText}</code> below:',
    'dialog.delete.cancel': 'Cancel',
    'dialog.delete.confirm': 'Delete Forever',
    'dialog.delete.confirming': 'Deleting...',

    // Email Actions
    'emailActions.trash': 'Trash',
    'emailActions.delete': 'Delete',

    // Toast messages
    'toast.trash.error': 'Failed to trash emails',
    'toast.delete.error': 'Failed to delete emails',
    'toast.bulkUnsubscribe.error': 'Failed to mark subscriptions as unsubscribed',
  },
  exorcist: {
    // Unsubscribe Dialog
    'dialog.unsubscribe.title': 'Banish {sender}',
    'dialog.unsubscribe.description':
      "You'll be sent to the haunter's banishment portal. After the ritual, return here to seal the banishment.",
    'dialog.unsubscribe.unknownSender': 'Unknown spirit',
    'dialog.unsubscribe.emailCount': '{count} hauntings',
    'dialog.unsubscribe.step1.title': 'Open banishment portal',
    'dialog.unsubscribe.step1.description':
      'Click below to open the banishment ritual in a new realm',
    'dialog.unsubscribe.step1.button': 'Open Banishment Portal',
    'dialog.unsubscribe.step2.title': 'Seal the banishment',
    'dialog.unsubscribe.step2.description':
      'After completing the ritual on their realm, confirm here to remove this haunter from your registry',
    'dialog.unsubscribe.cancel': 'Abandon',
    'dialog.unsubscribe.confirm': 'Spirit Banished',
    'dialog.unsubscribe.toast.alreadyDone': 'Already marked as banished',
    'dialog.unsubscribe.toast.success': 'Marked as banished',
    'dialog.unsubscribe.toast.error': 'Banishment ritual failed',

    // Delete Dialog
    'dialog.delete.title': 'Permanently Banish {count} Spirit{plural}?',
    'dialog.delete.description':
      'You are about to <strong>permanently banish</strong> {count} spirit{plural} from your realm.',
    'dialog.delete.warning.title': 'This ritual cannot be undone',
    'dialog.delete.warning.description':
      'These spirits will be permanently cast into the void. You will not be able to summon them back through Gmail, Inboxorcist, or any other means.',
    'dialog.delete.confirmPrompt': 'To confirm, type <code>{expectedText}</code> below:',
    'dialog.delete.cancel': 'Abandon',
    'dialog.delete.confirm': 'Banish Forever',
    'dialog.delete.confirming': 'Banishing...',

    // Email Actions
    'emailActions.trash': 'Cast Out',
    'emailActions.delete': 'Banish',

    // Toast messages
    'toast.trash.error': 'Failed to cast out spirits',
    'toast.delete.error': 'Failed to banish spirits',
    'toast.bulkUnsubscribe.error': 'Failed to mark haunters as banished',
  },
} as const
