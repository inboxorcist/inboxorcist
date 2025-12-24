/**
 * Bishop AI (chat) page translations
 */
export const bishop = {
  en: {
    // Page header
    'bishop.title': 'Bishop AI',
    'bishop.description': 'Your divine counsel for inbox exorcism.',

    // Setup card
    'bishop.setup.title': 'Summon Bishop AI',
    'bishop.setup.description':
      'Add your API key to summon the Bishop. Your key is stored encrypted and never leaves your server.',
    'bishop.setup.provider': 'AI Provider',
    'bishop.setup.apiKey': 'API Key',
    'bishop.setup.apiKeyPlaceholder.openai': 'Enter your OpenAI API key',
    'bishop.setup.apiKeyPlaceholder.anthropic': 'Enter your Anthropic API key',
    'bishop.setup.apiKeyPlaceholder.google': 'Enter your Google API key',
    'bishop.setup.apiKeyPlaceholder.vercel': 'Enter your Vercel AI Gateway API key',
    'bishop.setup.submit': 'Summon Bishop AI',
    'bishop.setup.submitting': 'Summoning...',

    // Empty state
    'bishop.empty.title': 'Bishop AI',
    'bishop.empty.description':
      'Your divine counsel for inbox exorcism. Ask questions, get insights, or request cleanup rituals.',

    // Quick prompts
    'bishop.prompt.overview': 'Inbox overview',
    'bishop.prompt.overview.text':
      'Give me an overview of my inbox - total emails, categories breakdown, and storage used',
    'bishop.prompt.topSenders': 'Top senders',
    'bishop.prompt.topSenders.text': 'Show me my top 10 senders by email count',
    'bishop.prompt.cleanup': 'Cleanup suggestions',
    'bishop.prompt.cleanup.text': 'What emails can I safely delete to free up space?',
    'bishop.prompt.subscriptions': 'Subscriptions',
    'bishop.prompt.subscriptions.text': 'List my newsletter subscriptions with unsubscribe links',

    // Chat interface
    'bishop.input.placeholder': 'Ask about your emails...',
    'bishop.history': 'History',
    'bishop.history.title': 'Chat History',
    'bishop.history.new': 'New Chat',
    'bishop.history.empty': 'No conversations yet',

    // Chain of thought labels
    'bishop.cot.header': 'Chain of Thought',
    'bishop.cot.queryEmails.active': 'Searching for emails...',
    'bishop.cot.queryEmails.complete': 'Found emails',
    'bishop.cot.queryEmails.error': 'Search failed',
    'bishop.cot.queryEmails.cancelled': 'Search cancelled',
    'bishop.cot.getEmailContent.active': 'Fetching email content...',
    'bishop.cot.getEmailContent.complete': 'Fetched email content',
    'bishop.cot.getEmailContent.error': 'Failed to fetch email',
    'bishop.cot.getEmailContent.cancelled': 'Fetch cancelled',
    'bishop.cot.listLabels.active': 'Loading labels...',
    'bishop.cot.listLabels.complete': 'Loaded labels',
    'bishop.cot.listLabels.error': 'Failed to load labels',
    'bishop.cot.listLabels.cancelled': 'Load cancelled',
    'bishop.cot.listFilters.active': 'Loading filter rules...',
    'bishop.cot.listFilters.complete': 'Loaded filter rules',
    'bishop.cot.listFilters.error': 'Failed to load filters',
    'bishop.cot.listFilters.cancelled': 'Load cancelled',
    'bishop.cot.listSubscriptions.active': 'Finding subscriptions...',
    'bishop.cot.listSubscriptions.complete': 'Found subscriptions',
    'bishop.cot.listSubscriptions.error': 'Failed to find subscriptions',
    'bishop.cot.listSubscriptions.cancelled': 'Search cancelled',
    'bishop.cot.analyzeInbox.active': 'Analyzing inbox for cleanup opportunities...',
    'bishop.cot.analyzeInbox.complete': 'Found cleanup opportunities',
    'bishop.cot.analyzeInbox.error': 'Analysis failed',
    'bishop.cot.analyzeInbox.cancelled': 'Analysis cancelled',
    'bishop.cot.trashEmails.active': 'Awaiting approval to move to trash...',
    'bishop.cot.trashEmails.complete': 'Moved emails to trash',
    'bishop.cot.trashEmails.error': 'Failed to move to trash',
    'bishop.cot.trashEmails.cancelled': 'Move to trash cancelled',
    'bishop.cot.deleteEmails.active': 'Awaiting approval to delete...',
    'bishop.cot.deleteEmails.complete': 'Deleted emails permanently',
    'bishop.cot.deleteEmails.error': 'Failed to delete',
    'bishop.cot.deleteEmails.cancelled': 'Delete cancelled',
    'bishop.cot.createFilter.active': 'Awaiting approval to create filter...',
    'bishop.cot.createFilter.complete': 'Created filter',
    'bishop.cot.createFilter.error': 'Failed to create filter',
    'bishop.cot.createFilter.cancelled': 'Filter creation cancelled',
    'bishop.cot.applyLabel.active': 'Awaiting approval to modify labels...',
    'bishop.cot.applyLabel.complete': 'Applied labels',
    'bishop.cot.applyLabel.error': 'Failed to apply labels',
    'bishop.cot.applyLabel.cancelled': 'Label change cancelled',

    // Confirmation dialogs
    'bishop.confirm.delete.title': 'Confirm Delete',
    'bishop.confirm.trash.title': 'Confirm Move to Trash',
    'bishop.confirm.filter.title': 'Confirm Create Filter',
    'bishop.confirm.emails': 'emails',
    'bishop.confirm.storage': 'storage',
    'bishop.confirm.criteria': 'Criteria:',
    'bishop.confirm.action': 'Action:',
    'bishop.confirm.cancel': 'Cancel',
    'bishop.confirm.delete': 'Delete',
    'bishop.confirm.trash': 'Move to Trash',
    'bishop.confirm.createFilter': 'Create Filter',
    'bishop.confirm.cancelledByUser': 'Cancelled by user',

    // Status
    'bishop.status.processing': 'Processing...',
    'bishop.status.error': 'Error',
  },
  exorcist: {
    // Page header
    'bishop.title': 'Bishop AI',
    'bishop.description': 'Divine counsel for your inbox exorcism.',

    // Setup card
    'bishop.setup.title': 'Summon the Bishop',
    'bishop.setup.description':
      'Offer your API key to summon the Bishop. Your offering is sealed and never leaves your sanctum.',
    'bishop.setup.provider': 'Divine Channel',
    'bishop.setup.apiKey': 'Sacred Key',
    'bishop.setup.apiKeyPlaceholder.openai': 'Enter your OpenAI sacred key',
    'bishop.setup.apiKeyPlaceholder.anthropic': 'Enter your Anthropic sacred key',
    'bishop.setup.apiKeyPlaceholder.google': 'Enter your Google sacred key',
    'bishop.setup.apiKeyPlaceholder.vercel': 'Enter your Vercel Gateway sacred key',
    'bishop.setup.submit': 'Summon the Bishop',
    'bishop.setup.submitting': 'Performing the ritual...',

    // Empty state
    'bishop.empty.title': 'Bishop AI',
    'bishop.empty.description':
      'Divine counsel for your inbox exorcism. Seek guidance, reveal truths, or perform cleansing rituals.',

    // Quick prompts
    'bishop.prompt.overview': 'Soul census',
    'bishop.prompt.overview.text':
      'Give me a census of the souls in my inbox - total haunts, their categories, and the weight they carry',
    'bishop.prompt.topSenders': 'Chief haunters',
    'bishop.prompt.topSenders.text': 'Reveal the 10 spirits who haunt me most frequently',
    'bishop.prompt.cleanup': 'Exorcism targets',
    'bishop.prompt.cleanup.text': 'Which souls can I safely banish to free my sanctum?',
    'bishop.prompt.subscriptions': 'The bound ones',
    'bishop.prompt.subscriptions.text':
      'List the spirits I am bound to, with their banishment rites',

    // Chat interface
    'bishop.input.placeholder': 'Seek guidance about your souls...',
    'bishop.history': 'Scrolls',
    'bishop.history.title': 'Sacred Scrolls',
    'bishop.history.new': 'New Consultation',
    'bishop.history.empty': 'No consultations recorded',

    // Chain of thought labels
    'bishop.cot.header': 'Divine Revelation',
    'bishop.cot.queryEmails.active': 'Sensing the souls...',
    'bishop.cot.queryEmails.complete': 'Souls revealed',
    'bishop.cot.queryEmails.error': 'The vision failed',
    'bishop.cot.queryEmails.cancelled': 'Vision interrupted',
    'bishop.cot.getEmailContent.active': 'Reading the soul...',
    'bishop.cot.getEmailContent.complete': 'Soul examined',
    'bishop.cot.getEmailContent.error': 'Failed to read soul',
    'bishop.cot.getEmailContent.cancelled': 'Reading interrupted',
    'bishop.cot.listLabels.active': 'Gathering the marks...',
    'bishop.cot.listLabels.complete': 'Marks gathered',
    'bishop.cot.listLabels.error': 'Failed to gather marks',
    'bishop.cot.listLabels.cancelled': 'Gathering interrupted',
    'bishop.cot.listFilters.active': 'Consulting the wards...',
    'bishop.cot.listFilters.complete': 'Wards revealed',
    'bishop.cot.listFilters.error': 'Failed to consult wards',
    'bishop.cot.listFilters.cancelled': 'Consultation interrupted',
    'bishop.cot.listSubscriptions.active': 'Sensing the bound ones...',
    'bishop.cot.listSubscriptions.complete': 'Bound ones revealed',
    'bishop.cot.listSubscriptions.error': 'Failed to sense bindings',
    'bishop.cot.listSubscriptions.cancelled': 'Sensing interrupted',
    'bishop.cot.analyzeInbox.active': 'Divining cleansing opportunities...',
    'bishop.cot.analyzeInbox.complete': 'Cleansing targets revealed',
    'bishop.cot.analyzeInbox.error': 'Divination failed',
    'bishop.cot.analyzeInbox.cancelled': 'Divination interrupted',
    'bishop.cot.trashEmails.active': 'Awaiting blessing to banish...',
    'bishop.cot.trashEmails.complete': 'Souls banished to purgatory',
    'bishop.cot.trashEmails.error': 'Banishment failed',
    'bishop.cot.trashEmails.cancelled': 'Banishment cancelled',
    'bishop.cot.deleteEmails.active': 'Awaiting blessing to obliterate...',
    'bishop.cot.deleteEmails.complete': 'Souls obliterated',
    'bishop.cot.deleteEmails.error': 'Obliteration failed',
    'bishop.cot.deleteEmails.cancelled': 'Obliteration cancelled',
    'bishop.cot.createFilter.active': 'Awaiting blessing to inscribe ward...',
    'bishop.cot.createFilter.complete': 'Ward inscribed',
    'bishop.cot.createFilter.error': 'Failed to inscribe ward',
    'bishop.cot.createFilter.cancelled': 'Inscription cancelled',
    'bishop.cot.applyLabel.active': 'Awaiting blessing to mark souls...',
    'bishop.cot.applyLabel.complete': 'Souls marked',
    'bishop.cot.applyLabel.error': 'Marking ritual failed',
    'bishop.cot.applyLabel.cancelled': 'Marking cancelled',

    // Confirmation dialogs
    'bishop.confirm.delete.title': 'Confirm Obliteration',
    'bishop.confirm.trash.title': 'Confirm Banishment',
    'bishop.confirm.filter.title': 'Confirm Ward Inscription',
    'bishop.confirm.emails': 'souls',
    'bishop.confirm.storage': 'essence',
    'bishop.confirm.criteria': 'Target:',
    'bishop.confirm.action': 'Ritual:',
    'bishop.confirm.cancel': 'Abort',
    'bishop.confirm.delete': 'Obliterate',
    'bishop.confirm.trash': 'Banish to Purgatory',
    'bishop.confirm.createFilter': 'Inscribe Ward',
    'bishop.confirm.cancelledByUser': 'Ritual aborted',

    // Status
    'bishop.status.processing': 'Channeling...',
    'bishop.status.error': 'The spirits resist',
  },
} as const
