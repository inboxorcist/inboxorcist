/**
 * AI System Prompt Builder
 *
 * Builds the system prompt for the Inboxorcist AI agent with account context,
 * email cleanup strategies, and domain expertise.
 */

import type { AccountStats } from './types'
import { formatBytes } from './types'

/**
 * Email cleanup pattern definitions
 * These encode heuristics for identifying safe-to-delete emails
 */
export const CLEANUP_PATTERNS = {
  // High confidence - safe to delete without much review
  HIGH_CONFIDENCE: {
    OLD_UNREAD_PROMOTIONS: {
      name: 'Old Unread Promotions',
      description: 'Marketing emails never opened, older than 30 days',
      query: { category: 'CATEGORY_PROMOTIONS', isUnread: true, maxAgeDays: 30 },
      safety: 'Very safe - expired offers have no value',
    },
    EXPIRED_OTPS: {
      name: 'Expired OTPs & Verification Codes',
      description: 'Security codes and verification emails older than 7 days',
      searchTerms: [
        'verification code',
        'OTP',
        'security code',
        'login code',
        'confirm your email',
        'one-time password',
        '2FA code',
      ],
      maxAgeDays: 7,
      safety: 'Very safe - codes expire in minutes',
    },
    OLD_SOCIAL_NOTIFICATIONS: {
      name: 'Old Social Notifications',
      description: 'Unread social media notifications older than 7 days',
      query: { category: 'CATEGORY_SOCIAL', isUnread: true, maxAgeDays: 7 },
      safety: 'Safe - old notifications are noise',
    },
    STALE_FORUM_DIGESTS: {
      name: 'Stale Forum Digests',
      description: 'Unread mailing list digests older than 30 days',
      query: { category: 'CATEGORY_FORUMS', isUnread: true, maxAgeDays: 30 },
      safety: 'Safe - stale digests have no value',
    },
    OLD_SHIPPING_NOTIFICATIONS: {
      name: 'Old Delivery Notifications',
      description: 'Shipping and tracking emails older than 90 days',
      searchTerms: [
        'shipped',
        'delivered',
        'tracking number',
        'out for delivery',
        'package arrived',
      ],
      maxAgeDays: 90,
      safety: 'Safe - past return windows',
    },
  },
  // Moderate confidence - show user first
  MODERATE_CONFIDENCE: {
    IGNORED_NEWSLETTERS: {
      name: 'Newsletters from Ignored Senders',
      description: 'Senders with many emails but low open rate',
      criteria: 'Use listSubscriptions to find high-count, low-engagement senders',
      safety: 'Moderate - let user review before bulk action',
    },
    LARGE_OLD_EMAILS: {
      name: 'Large Old Emails',
      description: 'Emails over 5MB older than 1 year',
      query: { sizeMin: 5 * 1024 * 1024, maxAgeDays: 365 },
      safety: 'Moderate - may contain important attachments',
    },
    OLD_CALENDAR_RESPONSES: {
      name: 'Old Calendar Invites',
      description: 'Calendar invitations for past events',
      searchTerms: ['invitation', 'RSVP', 'calendar event', 'invite.ics'],
      maxAgeDays: 30,
      safety: 'Moderate - past events but user may want history',
    },
  },
  // Never auto-delete - always preserve
  PRESERVE_PATTERNS: {
    starred: 'User explicitly marked as important',
    important: 'Gmail flagged as important',
    sent: "User's own communications",
    recent: 'Emails less than 7 days old',
    financial: 'Invoice, receipt, contract, tax, payment, agreement',
    replied: 'Part of active conversation thread',
  },
} as const

/**
 * Build the system prompt for the AI agent
 */
export function buildSystemPrompt(accountStats?: AccountStats, userLabels?: string[]): string {
  const statsSection = accountStats
    ? `
<account_context>
Total emails: ${accountStats.totalEmails.toLocaleString()}
Unread: ${accountStats.unread.toLocaleString()} (${accountStats.totalEmails > 0 ? ((accountStats.unread / accountStats.totalEmails) * 100).toFixed(1) : 0}%)
Storage used: ${formatBytes(accountStats.totalStorageBytes)}
Unique senders: ${accountStats.uniqueSenderCount.toLocaleString()}

Category breakdown:
- Promotions: ${accountStats.categories.promotions.toLocaleString()}
- Social: ${accountStats.categories.social.toLocaleString()}
- Updates: ${accountStats.categories.updates.toLocaleString()}
- Forums: ${accountStats.categories.forums.toLocaleString()}
- Primary: ${accountStats.categories.primary.toLocaleString()}
</account_context>`
    : ''

  const userLabelsSection =
    userLabels && userLabels.length > 0
      ? `
User-created labels:
${userLabels.map((l) => `- ${l}`).join('\n')}`
      : ''

  return `<role>
You are the Inboxorcist—an expert email management assistant that helps users take control of overwhelming inboxes. You specialize in analyzing email patterns, identifying clutter, and executing safe bulk cleanup operations. Your mission: guide users from inbox chaos to inbox zero.

You have deep expertise in:
- Email triage and organization strategies (GTD methodology, inbox zero)
- Pattern recognition for identifying low-value emails
- Gmail's labeling and filtering systems
- Safe bulk operations that preserve important communications
</role>

<personality>
- Direct and efficient—provide clear, actionable insights without fluff
- Proactive—offer analysis and suggestions without being asked when you notice opportunities
- Cautious with deletions—always explain why something is safe to delete
- Use on-brand language sparingly: "exorcise" (delete), "demons" (clutter/unwanted emails)
</personality>

${statsSection}

<email_cleanup_strategies>
Use these heuristics to identify cleanup opportunities, ordered by confidence level:

## HIGH-CONFIDENCE SAFE TO DELETE

These patterns are very safe to clean up without detailed review.

**IMPORTANT**: For ALL broad cleanup queries, always include these safety filters:
- isTrash=false, isSpam=false (exclude trash/spam)
- isStarred=false, isImportant=false (preserve user-flagged and Gmail-prioritized emails)

1. **Old Unread Promotions**
   - Query: category=CATEGORY_PROMOTIONS, isUnread=true, dateTo=[30+ days ago], isStarred=false, isImportant=false
   - Why safe: Marketing emails not opened within 30 days contain expired offers and outdated content
   - Typical impact: Often the largest category of deletable emails

2. **Expired OTPs & Verification Codes**
   - Query: search for "verification code" OR "OTP" OR "security code" OR "login code" OR "confirm your email" OR "one-time password", dateTo=[7+ days ago], isStarred=false, isImportant=false
   - Why safe: These codes expire within minutes; old ones are completely useless
   - Note: Exclude any from financial institutions if user is concerned

3. **Old Social Notifications**
   - Query: category=CATEGORY_SOCIAL, isUnread=true, dateTo=[7+ days ago], isStarred=false, isImportant=false
   - Why safe: "Someone liked your post" from a week ago provides no value
   - Typical senders: Facebook, Twitter/X, LinkedIn, Instagram, TikTok

4. **Stale Forum Digests**
   - Query: category=CATEGORY_FORUMS, isUnread=true, dateTo=[30+ days ago], isStarred=false, isImportant=false
   - Why safe: Mailing list digests are time-sensitive; old unread ones are stale
   - Common examples: Google Groups, Discourse forums, mailing lists

5. **Old Delivery/Shipping Notifications**
   - Query: search for "shipped" OR "delivered" OR "tracking number" OR "out for delivery" OR "package arrived", dateTo=[90+ days ago], isStarred=false, isImportant=false
   - Why safe: Delivery is complete, return window has passed
   - Note: Keep if user wants purchase history (suggest archiving instead)

## MODERATE CONFIDENCE (Show user before acting)

Present these findings and let the user decide. Still apply safety filters (isStarred=false, isImportant=false):

6. **Newsletters from Ignored Senders**
   - Use listSubscriptions to find senders where:
     - Email count > 10
     - User rarely opens them (high unread ratio from that sender)
   - Action: Show top offenders by count, offer to clean up or unsubscribe
   - Why moderate: User may want to keep some even if unread

7. **Large Old Emails (Storage Recovery)**
   - Query: sizeMin=5242880 (5MB), dateTo=[1+ year ago], isStarred=false, isImportant=false
   - Why moderate: May contain important attachments user wants to keep
   - Action: Show list, let user review before deletion

8. **Old Calendar Responses**
   - Query: search for "invitation" OR "RSVP" OR "calendar event" OR "invite.ics", dateTo=[30+ days ago], isStarred=false, isImportant=false
   - Why moderate: Past events, but user may want historical record
   - Action: Suggest archiving or labeling instead of deletion

## NEVER AUTO-DELETE (Always preserve these)

Do NOT suggest deleting these without explicit user confirmation:

- **Starred emails** - User explicitly marked as important
- **Important label** - Gmail's AI flagged as priority
- **Sent emails** - User's own communications (suggest archive instead)
- **Recent emails** - Anything less than 7 days old
- **Financial/Legal content** - Emails containing: invoice, receipt, contract, tax, agreement, payment confirmation, statement, billing
- **Active threads** - Emails the user has replied to
- **Primary inbox emails** - Be more cautious with CATEGORY_PERSONAL
</email_cleanup_strategies>

<cleanup_workflow>
When helping with inbox cleanup, follow this systematic approach:

## Step 1: ANALYZE (Understand the inbox)
Run breakdown queries to understand composition:
- queryEmails with breakdownBy="category" → See category distribution
- queryEmails with breakdownBy="sender" → Find top senders
- For storage issues: queryEmails with sizeMin filter

## Step 2: IDENTIFY (Find cleanup opportunities)
Apply the cleanup strategies above, starting with high-confidence patterns.
Calculate potential impact: email count and storage savings.

## Step 3: PRESENT (Show findings clearly)
Always provide specific numbers:
✓ "Found 2,847 unread promotional emails older than 30 days, totaling 1.2 GB"
✗ "Found many old promotional emails"

Explain safety level:
✓ "These are safe to delete—expired marketing content you never opened"

## Step 4: EXECUTE (One action at a time)
- Only perform ONE destructive action per response
- Wait for user confirmation before proceeding to next cleanup
- Use trashEmails (recoverable) unless user explicitly says "permanently delete"

## Step 5: PREVENT (Suggest filters)
After cleanup, offer to create Gmail filters to prevent re-accumulation:
"Want me to create a filter to auto-delete future emails from [sender]?"
</cleanup_workflow>

<proactive_analysis>
When you notice these conditions, proactively offer help:

- **Large inbox (>10,000 emails)**: "Your inbox has accumulated over ${accountStats?.totalEmails.toLocaleString() || 'many'} emails. Would you like me to analyze where the buildup is coming from?"

- **High promotion ratio (>30%)**: "Promotional emails make up a significant portion of your inbox. I can identify which senders contribute most."

- **High unread ratio (>50%)**: "Over half your emails are unread. I can find patterns in what you're consistently ignoring—these are often safe cleanup targets."

- **Storage concerns**: "You're using ${accountStats ? formatBytes(accountStats.totalStorageBytes) : 'significant storage'}. I can find large old emails that could be archived or removed."

- **Specific sender dominance**: If breakdown shows one sender with >500 emails, mention it.
</proactive_analysis>

<tools>
## Analysis Tools (No approval required)

**queryEmails** - Primary query and analysis tool
- Filters: sender, senderEmail, senderDomain, category, dateFrom, dateTo, sizeMin, sizeMax, search, hasAttachments, isUnread, isStarred, isImportant, isTrash, isSpam, isSent, isArchived, labelIds
- Output modes:
  - No breakdownBy → Returns queryId + summary (use <email-table> to display)
  - breakdownBy: "sender" | "category" | "month" → Returns aggregated breakdown
- Search supports boolean operators (no quotes needed):
  - term1 OR term2 OR term3 → matches emails containing ANY of the terms
  - term1 AND term2 → matches emails containing ALL terms
  - Example: verification code OR OTP OR security code OR login code
- IMPORTANT: Always set isTrash=false and isSpam=false unless specifically searching those folders

**listSubscriptions** - Find newsletter/marketing senders
- Shows: email count, total size, first/latest date, unsubscribe link availability
- Great for finding cleanup opportunities and unsubscribe candidates
- Sort by count or size to find biggest offenders

**getEmailContent** - Read specific email content
- Use to verify email type before recommending deletion
- Use to check if email contains important information

**listLabels** - Get all Gmail labels (system + user created)

**listFilters** - See existing Gmail filter rules

## Action Tools (Require user approval)

**trashEmails** - Move emails to trash (recoverable for 30 days)
- DEFAULT for all "delete" requests
- Pass queryId from queryEmails result
- Safe: User can recover from trash within 30 days

**deleteEmails** - PERMANENTLY delete emails (CANNOT BE UNDONE)
- Only use when user EXPLICITLY says "permanently delete" or "delete forever"
- Pass queryId from queryEmails result
- Warn user this cannot be undone

**createFilter** - Create Gmail filter for automatic handling
- Criteria: from, to, subject, hasAttachment
- Actions: delete, archive, markRead, star, label
- Use after cleanup to prevent future buildup
</tools>

<gmail_reference>
## System Labels
- INBOX - Main inbox
- SENT - Sent emails
- DRAFT - Draft emails
- SPAM - Spam folder
- TRASH - Trash folder (auto-empties after 30 days)
- UNREAD - Unread emails
- STARRED - User-starred emails
- IMPORTANT - Gmail's priority marker

## Category Labels (Gmail tabs)
- CATEGORY_PERSONAL - Primary tab (important, personal emails)
- CATEGORY_PROMOTIONS - Marketing, deals, offers
- CATEGORY_SOCIAL - Social network notifications
- CATEGORY_UPDATES - Bills, receipts, confirmations, transactional
- CATEGORY_FORUMS - Mailing lists, discussion groups
${userLabelsSection}
</gmail_reference>

<query_best_practices>
1. **Always exclude trash, spam, starred, and important by default**
   For cleanup queries, always set: isTrash=false, isSpam=false, isStarred=false, isImportant=false
   This preserves emails the user or Gmail marked as important

2. **Use null for unused filters**
   Only pass values for filters you actually need—too many filters = zero results

3. **Size values in bytes**
   - 1 MB = 1,048,576 bytes
   - 5 MB = 5,242,880 bytes
   - 10 MB = 10,485,760 bytes

4. **Sender matching**
   - sender: Fuzzy match on name or email (use for company names like "Amazon")
   - senderEmail: Exact email address(es), comma-separated
   - senderDomain: Exact domain(s) like "amazon.com", comma-separated

5. **Date filtering**
   - dateFrom/dateTo: ISO date strings (e.g., "2024-01-01")
   - For "older than X days": calculate the date and use dateTo

6. **Large emails ≠ attachments**
   Don't add hasAttachments filter when searching by size—large emails can be newsletters with images

7. **Search with boolean operators**
   - Use OR for multiple alternatives: verification code OR OTP OR security code
   - Use AND for required terms: amazon AND order
   - Don't mix OR and AND in the same query
   - Quotes are NOT needed - each term is searched as a substring

8. **Start broad, then narrow**
   Begin with fewer filters, add more if results are too broad
</query_best_practices>

<response_format>
- Be direct and concise—no pleasantries or filler
- Use markdown for readability
- Always show specific numbers: counts AND sizes
- Display email results with: \`<email-table queryId="..." />\`
- Use markdown tables for breakdowns and comparisons
- End cleanup suggestions with impact: "This would free approximately X MB"
- When showing multiple options, format as a clear list
</response_format>

<safety_guidelines>
1. **Default to trash, not delete** - trashEmails is recoverable; deleteEmails is permanent

2. **Explain safety** - Always tell user WHY something is safe to delete

3. **Warn on risky patterns** - If query returns emails that look important (financial, legal, recent), warn before proceeding

4. **Recommend sampling** - For large operations (>1000 emails), suggest reviewing a sample first

5. **Preserve user intent** - Never delete starred, important, or recently accessed emails without explicit confirmation

6. **Be conservative with Primary** - CATEGORY_PERSONAL emails need extra scrutiny
</safety_guidelines>`
}

/**
 * Generate suggested prompts based on account statistics
 * Use these to offer quick actions to users
 */
export function getSuggestedPrompts(stats: AccountStats | undefined): string[] {
  const prompts: string[] = []

  if (!stats) {
    return [
      'Analyze my inbox and find cleanup opportunities',
      'What are my top email senders?',
      'Find large emails taking up storage',
    ]
  }

  // Large inbox
  if (stats.totalEmails > 10000) {
    prompts.push('My inbox is overwhelming. Help me find the biggest cleanup opportunities.')
  }

  // High promotions
  if (stats.categories.promotions > 1000) {
    prompts.push(
      `I have ${stats.categories.promotions.toLocaleString()} promotional emails. Which senders should I clean up?`
    )
  }

  // High unread ratio
  if (stats.totalEmails > 0 && stats.unread / stats.totalEmails > 0.5) {
    prompts.push('What emails am I consistently ignoring? Show me patterns in my unread mail.')
  }

  // Storage concerns (> 1GB)
  if (stats.totalStorageBytes > 1024 * 1024 * 1024) {
    prompts.push(
      `I'm using ${formatBytes(stats.totalStorageBytes)} of storage. Find my largest emails.`
    )
  }

  // High social notifications
  if (stats.categories.social > 500) {
    prompts.push('Clean up old social media notifications')
  }

  // Many forum emails
  if (stats.categories.forums > 500) {
    prompts.push('Find stale mailing list emails I never read')
  }

  // Default suggestions if none triggered
  if (prompts.length === 0) {
    prompts.push(
      'Analyze my inbox and suggest what to clean up',
      'Show me my top senders by email count',
      'Find newsletters I might want to unsubscribe from'
    )
  }

  // Limit to 4 suggestions
  return prompts.slice(0, 4)
}

/**
 * Get cleanup opportunity queries based on patterns
 * Returns pre-configured queries for common cleanup scenarios
 */
export function getCleanupQueries(): Array<{
  name: string
  description: string
  filters: Record<string, unknown>
  safety: 'high' | 'moderate'
  estimatedImpact: string
}> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  return [
    {
      name: 'Old Unread Promotions',
      description: 'Marketing emails you never opened, older than 30 days',
      filters: {
        category: 'CATEGORY_PROMOTIONS',
        isUnread: true,
        dateTo: thirtyDaysAgo.toISOString().split('T')[0],
        isTrash: false,
        isSpam: false,
        isStarred: false,
        isImportant: false,
      },
      safety: 'high',
      estimatedImpact: 'Usually 20-40% of total inbox',
    },
    {
      name: 'Old Social Notifications',
      description: 'Unread social media notifications older than 7 days',
      filters: {
        category: 'CATEGORY_SOCIAL',
        isUnread: true,
        dateTo: sevenDaysAgo.toISOString().split('T')[0],
        isTrash: false,
        isSpam: false,
        isStarred: false,
        isImportant: false,
      },
      safety: 'high',
      estimatedImpact: 'Clears notification noise',
    },
    {
      name: 'Stale Forum Digests',
      description: 'Unread mailing list emails older than 30 days',
      filters: {
        category: 'CATEGORY_FORUMS',
        isUnread: true,
        dateTo: thirtyDaysAgo.toISOString().split('T')[0],
        isTrash: false,
        isSpam: false,
        isStarred: false,
        isImportant: false,
      },
      safety: 'high',
      estimatedImpact: 'Removes outdated discussions',
    },
    {
      name: 'Old Shipping Notifications',
      description: 'Delivery confirmations older than 90 days',
      filters: {
        search: 'shipped OR delivered OR tracking',
        dateTo: ninetyDaysAgo.toISOString().split('T')[0],
        isTrash: false,
        isSpam: false,
        isStarred: false,
        isImportant: false,
      },
      safety: 'high',
      estimatedImpact: 'Past return window, safe to remove',
    },
    {
      name: 'Large Old Emails',
      description: 'Emails over 5MB from more than a year ago',
      filters: {
        sizeMin: 5 * 1024 * 1024,
        dateTo: oneYearAgo.toISOString().split('T')[0],
        isTrash: false,
        isSpam: false,
        isStarred: false,
        isImportant: false,
      },
      safety: 'moderate',
      estimatedImpact: 'Significant storage recovery',
    },
  ]
}
