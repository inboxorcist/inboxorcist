/**
 * Translations for filters and labels management
 */

import type { Language } from './index'

export const filters: Record<Language, Record<string, string>> = {
  en: {
    // Page
    'filters.title': 'Filters & Labels',
    'filters.description':
      'Manage your Gmail filters and labels to automatically organize incoming emails.',

    // Tabs
    'filters.tab.filters': 'Filters',
    'filters.tab.labels': 'Labels',

    // Create buttons
    'filters.createFilter': 'Create Filter',
    'filters.createLabel': 'Create Label',

    // Filters - Empty state
    'filters.empty.title': 'No filters yet',
    'filters.empty.description':
      'Filters automatically organize your incoming emails based on rules you define.',

    // Filters - Form
    'filters.create.title': 'Create Filter',
    'filters.edit.title': 'Edit Filter',
    'filters.form.description':
      'Set up criteria to match emails and choose actions to apply automatically.',
    'filters.form.criteria': 'When emails match these criteria...',
    'filters.form.from': 'From',
    'filters.form.to': 'To',
    'filters.form.subject': 'Subject contains',
    'filters.form.hasWords': 'Has the words',
    'filters.form.hasWordsHint': 'Use Gmail search syntax (OR, AND, quotes)',
    'filters.form.doesntHave': "Doesn't have",
    'filters.form.hasAttachment': 'Has attachment',
    'filters.form.sizeFilter': 'Size filter',
    'filters.form.actions': '...do this:',
    'filters.form.skipInbox': 'Skip the Inbox (Archive it)',
    'filters.form.markAsRead': 'Mark as read',
    'filters.form.starIt': 'Star it',
    'filters.form.markImportant': 'Always mark as important',
    'filters.form.neverImportant': 'Never mark as important',
    'filters.form.neverSpam': 'Never send it to Spam',
    'filters.form.deleteIt': 'Delete it',
    'filters.form.applyLabel': 'Apply label:',
    'filters.form.needCriteria': 'Please specify at least one search criterion.',
    'filters.form.needAction': 'Please select at least one action.',
    'filters.form.applyToExisting': 'Also apply filter to matching conversations',
    'filters.create.submit': 'Create Filter',

    // Filter Editor - Page
    'filterEditor.create.title': 'Create New Filter',
    'filterEditor.edit.title': 'Edit Filter',
    'filterEditor.create.description': 'Set up automatic rules to organize your incoming emails',
    'filterEditor.edit.description': 'Modify the criteria and actions for this filter',
    'filterEditor.notFound.title': 'Filter not found',
    'filterEditor.notFound.description':
      "The filter you're looking for doesn't exist or has been deleted.",
    'filterEditor.backToFilters': 'Back to Filters',

    // Filter Editor - Stepper
    'filterEditor.step.criteria': 'Filter Criteria',
    'filterEditor.step.criteriaDesc': 'Define which emails to match',
    'filterEditor.step.actions': 'Actions',
    'filterEditor.step.actionsDesc': 'Choose what to do with matches',

    // Filter Editor - Sender Section
    'filterEditor.sender.title': 'Sender & Recipient',
    'filterEditor.sender.description': 'Filter emails based on who sent them or who received them',
    'filterEditor.sender.fromPlaceholder': 'sender@example.com or @domain.com',
    'filterEditor.sender.fromHint': "Match sender's email or use @domain.com for entire domains",
    'filterEditor.sender.toPlaceholder': 'recipient@example.com',
    'filterEditor.sender.toHint':
      'Useful for filtering emails sent to specific addresses or aliases',

    // Filter Editor - Content Section
    'filterEditor.content.title': 'Email Content',
    'filterEditor.content.description': 'Filter based on subject line or words in the email body',
    'filterEditor.content.subjectPlaceholder': 'newsletter, invoice, alert...',
    'filterEditor.content.hasWordsPlaceholder': 'unsubscribe OR promotional',
    'filterEditor.content.hasWordsHint': 'Use Gmail search syntax:',
    'filterEditor.content.doesntHavePlaceholder': 'important, urgent...',
    'filterEditor.content.doesntHaveHint': 'Exclude emails containing these words',

    // Filter Editor - Additional Section
    'filterEditor.additional.title': 'Additional Criteria',
    'filterEditor.additional.description': 'Filter by attachments or email size',
    'filterEditor.additional.hasAttachment': 'Has attachment',
    'filterEditor.additional.hasAttachmentHint': 'Only match emails with file attachments',
    'filterEditor.additional.filterBySize': 'Filter by size',
    'filterEditor.additional.filterBySizeHint': 'Match emails based on their size',
    'filterEditor.additional.largerThan': 'Larger than',
    'filterEditor.additional.smallerThan': 'Smaller than',

    // Filter Editor - Preview
    'filterEditor.preview.title': 'Filter Query Preview',
    'filterEditor.preview.needCriteria': 'Add at least one criteria to continue',

    // Filter Editor - Test Section
    'filterEditor.test.title': 'Test Filter',
    'filterEditor.test.description': 'See which existing emails match your filter criteria',
    'filterEditor.test.testing': 'Testing...',
    'filterEditor.test.preview': 'Preview Matches',
    'filterEditor.test.matchingEmails': 'matching emails',
    'filterEditor.test.inInbox': 'in your inbox',
    'filterEditor.test.andMore': 'And {count} more...',
    'filterEditor.test.noMatches':
      'No existing emails match this filter. It will apply to future emails.',
    'filterEditor.test.whenMatch': 'When emails match:',
    'filterEditor.test.editCriteria': 'Edit criteria',

    // Filter Editor - Actions Section
    'filterEditor.actions.title': 'Do this...',
    'filterEditor.actions.description': 'Choose one or more actions to apply to matching emails',
    'filterEditor.actions.organization': 'Organization',
    'filterEditor.actions.importance': 'Importance',
    'filterEditor.actions.cleanup': 'Cleanup',
    'filterEditor.actions.labeling': 'Labeling',
    'filterEditor.actions.skipInbox': 'Skip the Inbox (Archive it)',
    'filterEditor.actions.skipInboxHint': "Emails won't appear in inbox, but remain searchable",
    'filterEditor.actions.markRead': 'Mark as read',
    'filterEditor.actions.markReadHint': 'Automatically mark matching emails as read',
    'filterEditor.actions.star': 'Star it',
    'filterEditor.actions.starHint': 'Add a star for easy access later',
    'filterEditor.actions.markImportant': 'Always mark as important',
    'filterEditor.actions.markImportantHint': "Override Gmail's importance prediction",
    'filterEditor.actions.neverImportant': 'Never mark as important',
    'filterEditor.actions.neverImportantHint': "Override Gmail's importance prediction",
    'filterEditor.actions.neverSpam': 'Never send to Spam',
    'filterEditor.actions.neverSpamHint': 'Always deliver to inbox, even if flagged as spam',
    'filterEditor.actions.delete': 'Delete it',
    'filterEditor.actions.deleteHint': 'Move matching emails directly to Trash',
    'filterEditor.actions.applyLabel': 'Apply label:',
    'filterEditor.actions.chooseLabel': 'Choose a label...',
    'filterEditor.actions.noLabel': 'None',
    'filterEditor.actions.createLabel': 'Create new label',
    'filterEditor.actions.needAction': 'Select at least one action to create the filter',

    // Filter Editor - Apply to Existing
    'filterEditor.applyExisting.title': 'Also apply to {count} existing emails',
    'filterEditor.applyExisting.description':
      'Run this filter on matching emails already in your inbox',

    // Filter Editor - Navigation
    'filterEditor.nav.cancel': 'Cancel',
    'filterEditor.nav.back': 'Back',
    'filterEditor.nav.continue': 'Continue',
    'filterEditor.nav.create': 'Create Filter',
    'filterEditor.nav.save': 'Save Filter',
    'filterEditor.nav.creating': 'Creating...',
    'filterEditor.nav.saving': 'Saving...',

    // Filter Editor - Tips Sidebar
    'filterEditor.tips.examples': 'Quick Examples',
    'filterEditor.tips.multipleSenders': 'Match multiple senders',
    'filterEditor.tips.entireDomain': 'Match entire domain',
    'filterEditor.tips.newsletters': 'Newsletters in "Has the words"',
    'filterEditor.tips.searchSyntax': 'Search Syntax',
    'filterEditor.tips.or': 'Match either term',
    'filterEditor.tips.exact': 'Match exact text',
    'filterEditor.tips.exclude': 'Exclude a term',
    'filterEditor.tips.tip': 'Tip:',
    'filterEditor.tips.orInFields': 'You can use OR in From/To fields to match multiple addresses.',
    'filterEditor.tips.combineConditions':
      'Combine criteria for precise filtering — all conditions must match.',
    'filterEditor.tips.recommendedCombos': 'Recommended Combos',
    'filterEditor.tips.newsletterOrg': 'Newsletter organization',
    'filterEditor.tips.newsletterOrgDesc': 'Skip inbox + Apply label',
    'filterEditor.tips.vipSenders': 'VIP senders',
    'filterEditor.tips.vipSendersDesc': 'Star + Mark important + Never spam',
    'filterEditor.tips.quietNotifications': 'Quiet notifications',
    'filterEditor.tips.quietNotificationsDesc': 'Skip inbox + Mark as read + Apply label',
    'filterEditor.tips.tips': 'Tips',
    'filterEditor.tips.skipInboxTip': 'Emails go straight to the label, bypassing inbox',
    'filterEditor.tips.neverSpamTip': "Overrides Gmail's spam detection for trusted senders",
    'filterEditor.tips.deleteWarning':
      "moves emails to trash. They're permanently deleted after 30 days.",
    'filterEditor.tips.testWarning': 'Test your filter before applying to existing emails.',

    // Filters - Actions
    'filters.edit': 'Edit',
    'filters.apply': 'Apply to existing',
    'filters.delete': 'Delete',
    'filters.apply.tooltip': 'Apply filter to existing emails',

    // Filters - Card
    'filters.card.criteria': 'Criteria',
    'filters.card.actions': 'Actions',
    'filters.card.from': 'From',
    'filters.card.to': 'To',
    'filters.card.subject': 'Subject',
    'filters.card.hasWords': 'Has',
    'filters.card.doesntHave': 'Not',
    'filters.card.hasAttachment': 'Has attachment',
    'filters.card.size': 'Size',
    'filters.card.archive': 'Archive',
    'filters.card.markRead': 'Mark read',
    'filters.card.star': 'Star',
    'filters.card.important': 'Important',
    'filters.card.notImportant': 'Not important',
    'filters.card.delete': 'Delete',
    'filters.card.noSpam': 'No spam',
    'filters.card.label': 'Label',
    'filters.card.apply': 'Apply to existing',
    'filters.card.applying': 'Applying...',

    // Filters - Delete
    'filters.delete.title': 'Delete Filter',
    'filters.delete.description':
      'Are you sure you want to delete this filter? This action cannot be undone. Existing emails will not be affected.',

    // Filters - Messages
    'filters.created': 'Filter created successfully',
    'filters.updated': 'Filter updated successfully',
    'filters.deleted': 'Filter deleted successfully',
    'filters.error.load': 'Failed to load filters. Please try again.',
    'filters.error.create': 'Failed to create filter',
    'filters.error.update': 'Failed to update filter',
    'filters.error.delete': 'Failed to delete filter',
    'filters.error.apply': 'Failed to apply filter',

    // Labels - Section headers
    'labels.section.user': 'Your Labels',
    'labels.section.system': 'System Labels',

    // Labels - Empty state
    'labels.empty.user': 'No custom labels yet. Create one to get started.',

    // Labels - Actions
    'labels.edit': 'Edit',
    'labels.delete': 'Delete',
    'labels.readonly': 'System',

    // Labels - Form
    'labels.create.title': 'Create Label',
    'labels.edit.title': 'Edit Label',
    'labels.create.description': 'Create a new label to organize your emails.',
    'labels.edit.description': 'Update the label name and color.',
    'labels.form.name': 'Label Name',
    'labels.form.namePlaceholder': 'Enter label name...',
    'labels.form.preview': 'Preview',
    'labels.form.color': 'Color',
    'labels.create.submit': 'Create Label',

    // Labels - Delete
    'labels.delete.title': 'Delete Label',
    'labels.delete.description':
      'Are you sure you want to delete this label? This will remove the label from all messages that have it.',

    // Labels - Messages
    'labels.created': 'Label created successfully',
    'labels.updated': 'Label updated successfully',
    'labels.deleted': 'Label deleted successfully',
    'labels.error.load': 'Failed to load labels. Please try again.',
    'labels.error.create': 'Failed to create label',
    'labels.error.update': 'Failed to update label',
    'labels.error.delete': 'Failed to delete label',
    'labels.error.duplicate': 'A label with this name already exists',

    // Common actions
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.cancel': 'Cancel',
    'common.save': 'Save Changes',
    'common.creating': 'Creating...',
    'common.saving': 'Saving...',
    'common.deleting': 'Deleting...',
  },
  exorcist: {
    // Page
    'filters.title': 'Wards & Sigils',
    'filters.description': 'Establish protective wards to banish unwanted spirits automatically.',

    // Tabs
    'filters.tab.filters': 'Wards',
    'filters.tab.labels': 'Sigils',

    // Create buttons
    'filters.createFilter': 'Cast Ward',
    'filters.createLabel': 'Create Sigil',

    // Filters - Empty state
    'filters.empty.title': 'No wards cast yet',
    'filters.empty.description':
      'Wards automatically banish incoming demons based on unholy patterns you define.',

    // Filters - Form
    'filters.create.title': 'Cast New Ward',
    'filters.edit.title': 'Modify Ward',
    'filters.form.description':
      'Define the demonic patterns to detect and choose banishment rituals.',
    'filters.form.criteria': 'When detecting these unholy signs...',
    'filters.form.from': 'From the depths of',
    'filters.form.to': 'Addressed to',
    'filters.form.subject': 'Subject contains',
    'filters.form.hasWords': 'Contains the words',
    'filters.form.hasWordsHint': 'Use arcane syntax (OR, AND, quotes)',
    'filters.form.doesntHave': 'Lacks the words',
    'filters.form.hasAttachment': 'Bears attachments',
    'filters.form.sizeFilter': 'Size restriction',
    'filters.form.actions': '...perform this ritual:',
    'filters.form.skipInbox': 'Banish from sanctuary (Archive)',
    'filters.form.markAsRead': 'Mark as witnessed',
    'filters.form.starIt': 'Mark with pentagram',
    'filters.form.markImportant': 'Always mark as urgent threat',
    'filters.form.neverImportant': 'Never mark as urgent',
    'filters.form.neverSpam': 'Never condemn to purgatory',
    'filters.form.deleteIt': 'Condemn to the void',
    'filters.form.applyLabel': 'Apply sigil:',
    'filters.form.needCriteria': 'The ward requires at least one unholy pattern.',
    'filters.form.needAction': 'Choose at least one banishment ritual.',
    'filters.form.applyToExisting': 'Also cast ward on existing demons',
    'filters.create.submit': 'Cast Ward',

    // Filter Editor - Page
    'filterEditor.create.title': 'Cast New Ward',
    'filterEditor.edit.title': 'Modify Ward',
    'filterEditor.create.description':
      'Establish protective wards to banish incoming demons automatically',
    'filterEditor.edit.description': 'Modify the unholy patterns and rituals for this ward',
    'filterEditor.notFound.title': 'Ward not found',
    'filterEditor.notFound.description': "The ward you seek doesn't exist or has been broken.",
    'filterEditor.backToFilters': 'Return to Wards',

    // Filter Editor - Stepper
    'filterEditor.step.criteria': 'Unholy Patterns',
    'filterEditor.step.criteriaDesc': 'Define which demons to detect',
    'filterEditor.step.actions': 'Rituals',
    'filterEditor.step.actionsDesc': 'Choose banishment methods',

    // Filter Editor - Sender Section
    'filterEditor.sender.title': 'Origin & Destination',
    'filterEditor.sender.description': 'Detect demons based on their origin or intended vessel',
    'filterEditor.sender.fromPlaceholder': 'demon@abyss.com or @domain.com',
    'filterEditor.sender.fromHint': "Match demon's origin or use @domain.com for entire realms",
    'filterEditor.sender.toPlaceholder': 'vessel@sanctuary.com',
    'filterEditor.sender.toHint': 'Useful for detecting demons targeting specific vessels',

    // Filter Editor - Content Section
    'filterEditor.content.title': 'Demonic Content',
    'filterEditor.content.description': 'Detect based on subject or words in the message',
    'filterEditor.content.subjectPlaceholder': 'curse, hex, summoning...',
    'filterEditor.content.hasWordsPlaceholder': 'unsubscribe OR promotional',
    'filterEditor.content.hasWordsHint': 'Use arcane syntax:',
    'filterEditor.content.doesntHavePlaceholder': 'blessing, holy...',
    'filterEditor.content.doesntHaveHint': 'Exclude demons containing these words',

    // Filter Editor - Additional Section
    'filterEditor.additional.title': 'Additional Patterns',
    'filterEditor.additional.description': 'Detect by attachments or message size',
    'filterEditor.additional.hasAttachment': 'Bears attachments',
    'filterEditor.additional.hasAttachmentHint': 'Only detect demons carrying artifacts',
    'filterEditor.additional.filterBySize': 'Filter by size',
    'filterEditor.additional.filterBySizeHint': 'Detect demons based on their mass',
    'filterEditor.additional.largerThan': 'Greater than',
    'filterEditor.additional.smallerThan': 'Lesser than',

    // Filter Editor - Preview
    'filterEditor.preview.title': 'Ward Pattern Preview',
    'filterEditor.preview.needCriteria': 'Add at least one pattern to continue',

    // Filter Editor - Test Section
    'filterEditor.test.title': 'Test Ward',
    'filterEditor.test.description': 'See which existing demons match your ward patterns',
    'filterEditor.test.testing': 'Scrying...',
    'filterEditor.test.preview': 'Preview Matches',
    'filterEditor.test.matchingEmails': 'matching demons',
    'filterEditor.test.inInbox': 'in your sanctuary',
    'filterEditor.test.andMore': 'And {count} more...',
    'filterEditor.test.noMatches':
      'No existing demons match this ward. It will apply to future invasions.',
    'filterEditor.test.whenMatch': 'When detecting:',
    'filterEditor.test.editCriteria': 'Edit patterns',

    // Filter Editor - Actions Section
    'filterEditor.actions.title': 'Perform this ritual...',
    'filterEditor.actions.description': 'Choose one or more banishment rituals',
    'filterEditor.actions.organization': 'Organization',
    'filterEditor.actions.importance': 'Urgency',
    'filterEditor.actions.cleanup': 'Purification',
    'filterEditor.actions.labeling': 'Marking',
    'filterEditor.actions.skipInbox': 'Banish from sanctuary (Archive)',
    'filterEditor.actions.skipInboxHint': "Demons won't appear in sanctuary, but remain trackable",
    'filterEditor.actions.markRead': 'Mark as witnessed',
    'filterEditor.actions.markReadHint': 'Automatically mark matching demons as witnessed',
    'filterEditor.actions.star': 'Mark with pentagram',
    'filterEditor.actions.starHint': 'Add a pentagram for easy tracking',
    'filterEditor.actions.markImportant': 'Always mark as urgent threat',
    'filterEditor.actions.markImportantHint': 'Override default threat detection',
    'filterEditor.actions.neverImportant': 'Never mark as urgent',
    'filterEditor.actions.neverImportantHint': 'Override default threat detection',
    'filterEditor.actions.neverSpam': 'Never condemn to purgatory',
    'filterEditor.actions.neverSpamHint': 'Always allow entry, even if detected as spam',
    'filterEditor.actions.delete': 'Condemn to the void',
    'filterEditor.actions.deleteHint': 'Banish matching demons directly to the void',
    'filterEditor.actions.applyLabel': 'Apply sigil:',
    'filterEditor.actions.chooseLabel': 'Choose a sigil...',
    'filterEditor.actions.noLabel': 'None',
    'filterEditor.actions.createLabel': 'Create new sigil',
    'filterEditor.actions.needAction': 'Select at least one ritual to cast the ward',

    // Filter Editor - Apply to Existing
    'filterEditor.applyExisting.title': 'Also cast on {count} existing demons',
    'filterEditor.applyExisting.description': 'Run this ward on demons already in your sanctuary',

    // Filter Editor - Navigation
    'filterEditor.nav.cancel': 'Abort',
    'filterEditor.nav.back': 'Back',
    'filterEditor.nav.continue': 'Continue',
    'filterEditor.nav.create': 'Cast Ward',
    'filterEditor.nav.save': 'Seal Ward',
    'filterEditor.nav.creating': 'Conjuring...',
    'filterEditor.nav.saving': 'Sealing...',

    // Filter Editor - Tips Sidebar
    'filterEditor.tips.examples': 'Arcane Examples',
    'filterEditor.tips.multipleSenders': 'Match multiple origins',
    'filterEditor.tips.entireDomain': 'Match entire realm',
    'filterEditor.tips.newsletters': 'Cursed scrolls in "Contains the words"',
    'filterEditor.tips.searchSyntax': 'Arcane Syntax',
    'filterEditor.tips.or': 'Match either pattern',
    'filterEditor.tips.exact': 'Match exact incantation',
    'filterEditor.tips.exclude': 'Exclude a pattern',
    'filterEditor.tips.tip': 'Wisdom:',
    'filterEditor.tips.orInFields': 'You can use OR in From/To fields to match multiple origins.',
    'filterEditor.tips.combineConditions':
      'Combine patterns for precise detection — all must match.',
    'filterEditor.tips.recommendedCombos': 'Recommended Rituals',
    'filterEditor.tips.newsletterOrg': 'Cursed scroll organization',
    'filterEditor.tips.newsletterOrgDesc': 'Banish + Apply sigil',
    'filterEditor.tips.vipSenders': 'Trusted spirits',
    'filterEditor.tips.vipSendersDesc': 'Pentagram + Mark urgent + No purgatory',
    'filterEditor.tips.quietNotifications': 'Silent wards',
    'filterEditor.tips.quietNotificationsDesc': 'Banish + Mark witnessed + Apply sigil',
    'filterEditor.tips.tips': 'Wisdom',
    'filterEditor.tips.skipInboxTip': 'Demons go straight to the sigil, bypassing sanctuary',
    'filterEditor.tips.neverSpamTip': 'Overrides purgatory detection for trusted spirits',
    'filterEditor.tips.deleteWarning':
      'condemns demons to the void. Permanently banished after 30 days.',
    'filterEditor.tips.testWarning': 'Test your ward before casting on existing demons.',

    // Filters - Actions
    'filters.edit': 'Modify',
    'filters.apply': 'Cast on existing',
    'filters.delete': 'Break ward',
    'filters.apply.tooltip': 'Cast ward on existing demons',

    // Filters - Card
    'filters.card.criteria': 'Unholy Signs',
    'filters.card.actions': 'Rituals',
    'filters.card.from': 'From',
    'filters.card.to': 'To',
    'filters.card.subject': 'Subject',
    'filters.card.hasWords': 'Contains',
    'filters.card.doesntHave': 'Lacks',
    'filters.card.hasAttachment': 'Has attachments',
    'filters.card.size': 'Size',
    'filters.card.archive': 'Banish',
    'filters.card.markRead': 'Witnessed',
    'filters.card.star': 'Pentagram',
    'filters.card.important': 'Urgent',
    'filters.card.notImportant': 'Not urgent',
    'filters.card.delete': 'Void',
    'filters.card.noSpam': 'No purgatory',
    'filters.card.label': 'Sigil',
    'filters.card.apply': 'Cast on existing',
    'filters.card.applying': 'Casting...',

    // Filters - Delete
    'filters.delete.title': 'Break Ward',
    'filters.delete.description':
      'Are you sure you want to break this protective ward? The demons already banished will remain so.',

    // Filters - Messages
    'filters.created': 'Ward successfully cast',
    'filters.updated': 'Ward modified',
    'filters.deleted': 'Ward broken',
    'filters.error.load': 'Failed to retrieve wards. Try the ritual again.',
    'filters.error.create': 'Failed to cast ward',
    'filters.error.update': 'Failed to modify ward',
    'filters.error.delete': 'Failed to break ward',
    'filters.error.apply': 'Failed to apply ward',

    // Labels - Section headers
    'labels.section.user': 'Your Sigils',
    'labels.section.system': 'Ancient Sigils',

    // Labels - Empty state
    'labels.empty.user': 'No sigils inscribed yet. Create one to mark your demons.',

    // Labels - Actions
    'labels.edit': 'Modify',
    'labels.delete': 'Banish',
    'labels.readonly': 'Ancient',

    // Labels - Form
    'labels.create.title': 'Create Sigil',
    'labels.edit.title': 'Modify Sigil',
    'labels.create.description': 'Inscribe a new sigil to mark your demons.',
    'labels.edit.description': 'Update the sigil name and aura.',
    'labels.form.name': 'Sigil Name',
    'labels.form.namePlaceholder': 'Enter sigil name...',
    'labels.form.preview': 'Preview',
    'labels.form.color': 'Aura',
    'labels.create.submit': 'Inscribe Sigil',

    // Labels - Delete
    'labels.delete.title': 'Erase Sigil',
    'labels.delete.description':
      'Are you sure you want to erase this sigil? It will be removed from all marked demons.',

    // Labels - Messages
    'labels.created': 'Sigil inscribed successfully',
    'labels.updated': 'Sigil modified',
    'labels.deleted': 'Sigil erased',
    'labels.error.load': 'Failed to retrieve sigils. Try the ritual again.',
    'labels.error.create': 'Failed to inscribe sigil',
    'labels.error.update': 'Failed to modify sigil',
    'labels.error.delete': 'Failed to erase sigil',
    'labels.error.duplicate': 'A sigil with this name already exists',

    // Common actions
    'common.edit': 'Modify',
    'common.delete': 'Banish',
    'common.cancel': 'Abort',
    'common.save': 'Seal Changes',
    'common.creating': 'Conjuring...',
    'common.saving': 'Sealing...',
    'common.deleting': 'Banishing...',
  },
}
