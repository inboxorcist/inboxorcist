# Inboxorcist PRD
### The open-source Gmail exorcism tool

---

## Product Vision

Your inbox is haunted. Thousands of unread emails. Promotional demons. Newsletter poltergeists. Attachment bloat from 2019.

Inboxorcist is a self-hostable, privacy-first Gmail cleanup tool that lets users reclaim their inbox without handing their data to another SaaS vampire.

**MVP Focus:** One-time manual cleanup. Connect Gmail → See the damage → Banish the demons.

---

## User Personas (MVP)

**The Hoarder**
- 50,000+ emails, inbox zero is a myth
- Wants to purge old stuff but afraid of deleting something important
- Needs to see what they're deleting before committing

**The Privacy Nerd**
- Won't touch Unroll.me or Cleanfox (they sell data)
- Will self-host anything to keep control
- Values transparency, open source

**The Storage Cruncher**
- Gmail storage warning triggered this journey
- Hunting for large attachments and space hogs
- Wants quick wins, biggest impact first

---

## User Flows

### Flow 1: First-Time Setup

```
┌─────────────────────────────────────────────────────────────┐
│ Landing Page                                                │
│ ↓                                                           │
│ Click "Begin the Exorcism"                                  │
│ ↓                                                           │
│ Google OAuth Consent Screen                                 │
│ ↓                                                           │
│ Redirect back → Account connected                           │
│ ↓                                                           │
│ Sync begins (background) → Show Sync Screen with progress   │
│ ↓                                                           │
│ Sync complete → Redirect to Dashboard                       │
└─────────────────────────────────────────────────────────────┘
```

**Logic Notes:**
- OAuth requests `gmail.readonly` and `gmail.modify` scopes
- After OAuth success, immediately trigger background sync
- Sync fetches email metadata only (sender, date, size, labels) — never the email body
- User can watch sync progress or wait
- If sync takes >30 seconds, show estimated time remaining
- User cannot access cleanup features until initial sync completes

---

### Flow 2: Adding Another Gmail Account

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard (logged in)                                       │
│ ↓                                                           │
│ Click account dropdown → "Add another account"              │
│ ↓                                                           │
│ Google OAuth (new account)                                  │
│ ↓                                                           │
│ Sync begins for new account                                 │
│ ↓                                                           │
│ Dashboard updates with account switcher                     │
└─────────────────────────────────────────────────────────────┘
```

**Logic Notes:**
- Each account is completely isolated (separate sync, separate data)
- Account switcher appears once 2+ accounts connected
- Switching accounts shows that account's dashboard instantly (data already synced locally)

---

### Flow 3: The Cleanup Ritual (Core Flow)

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard                                                   │
│ ↓                                                           │
│ User clicks a quick action OR opens Advanced Cleanup        │
│ ↓                                                           │
│ Cleanup View: Filters + Results                             │
│ ↓                                                           │
│ User adjusts filters → Results update in real-time          │
│ ↓                                                           │
│ User selects emails (individual or bulk)                    │
│ ↓                                                           │
│ Clicks "Send to the Grave" (Move to Trash)                  │
│ ↓                                                           │
│ Confirmation modal with count + storage impact              │
│ ↓                                                           │
│ Confirm → API calls batch move to Gmail Trash               │
│ ↓                                                           │
│ Success state → Results refresh (trashed items removed)     │
│ ↓                                                           │
│ Optional: "Finish them off" prompt to empty trash           │
└─────────────────────────────────────────────────────────────┘
```

**Logic Notes:**
- Filters are combined with AND logic (Date AND Sender AND Size, etc.)
- Results update as filters change (debounced, ~300ms delay)
- "Select all" selects all matching the current filter, not just visible page
- Show running total: "X emails selected (Y MB)"
- Batch operations happen in background; show progress for large batches
- After trashing, offer to empty trash but don't force it
- Gmail auto-deletes trash after 30 days anyway

---

### Flow 4: Empty the Trash (Permanent Deletion)

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard OR Post-cleanup prompt                            │
│ ↓                                                           │
│ Click "Empty Trash" / "Finish them off"                     │
│ ↓                                                           │
│ Warning modal (serious tone, red accent)                    │
│ "You're about to permanently delete X emails.               │
│  They cannot be recovered. Ever.                            │
│  Gmail's trash auto-empties in 30 days anyway."             │
│ ↓                                                           │
│ User types "EXORCISE" to confirm (friction = intentional)   │
│ ↓                                                           │
│ Permanent deletion via Gmail API                            │
│ ↓                                                           │
│ Success → Trash counter resets                              │
└─────────────────────────────────────────────────────────────┘
```

**Logic Notes:**
- This is the only destructive action; make it feel heavy
- Typing confirmation prevents accidental mass deletion
- Only empties Gmail's trash (which includes what Inboxorcist trashed + anything else in there)
- Show what's in trash before confirming (count + size)

---

### Flow 5: Disconnect Account

```
┌─────────────────────────────────────────────────────────────┐
│ Settings → Connected Accounts                               │
│ ↓                                                           │
│ Click "Remove" on an account                                │
│ ↓                                                           │
│ Confirmation: "Remove access to account@gmail.com?          │
│ This deletes all locally stored data for this account."     │
│ ↓                                                           │
│ Confirm → Revoke token, delete local data                   │
│ ↓                                                           │
│ If last account: Return to Landing                          │
│ If other accounts remain: Stay on Settings                  │
└─────────────────────────────────────────────────────────────┘
```

**Logic Notes:**
- Disconnecting removes ALL local data for that account
- Does not delete anything from Gmail itself
- User can re-add the same account later (fresh sync)

---

## Screens

### Screen 1: Landing Page

**Purpose:** First impression. Explain the value. Get them to connect.

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│  [Logo: Inboxorcist]                           [GitHub ↗]      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│         Your inbox is possessed.                               │
│                                                                │
│    100,000 emails you'll never read. Promotions.               │
│    Newsletters. Ghosts of 2019.                                │
│                                                                │
│           ┌─────────────────────────┐                          │
│           │  Begin the Exorcism 👻  │                          │
│           └─────────────────────────┘                          │
│                                                                │
│                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Self-hosted  │ │ Open source  │ │ Your data    │            │
│  │ You own it   │ │ Inspect it   │ │ stays yours  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                │
│  "Unlike other cleanup tools, we don't read your emails,       │
│   sell your data, or phone home. Run it on your machine.       │
│   Burn it down when you're done."                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Logo/wordmark (top left)
- GitHub link (top right)
- Hero headline + subhead
- Primary CTA button: "Begin the Exorcism"
- Three value props (icons + short text)
- Privacy manifesto (1-2 sentences)
- Footer: "Made for the paranoid. Open source on GitHub."

**States:**
- Default: As shown
- If returning user (has accounts): Button changes to "Enter the Crypt" → goes to Dashboard

---

### Screen 2: Sync Screen

**Purpose:** Show progress while initial sync runs. Set expectations.

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│  [Logo: Inboxorcist]                                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│              Scanning for spirits...                           │
│                                                                │
│              account@gmail.com                                 │
│                                                                │
│         ████████████░░░░░░░░░░░░░░░░░  34%                     │
│                                                                │
│              23,847 emails discovered                          │
│              ~2 minutes remaining                              │
│                                                                │
│                                                                │
│   ┌──────────────────────────────────────────────────────┐     │
│   │  What we're doing:                                   │     │
│   │  • Fetching email metadata (sender, date, size)      │     │
│   │  • We never read your email content                  │     │
│   │  • All data stays on your machine                    │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Progress bar with percentage
- Email count (live updating)
- Time estimate (appears after ~10% complete, when we can estimate)
- Reassurance box explaining what's happening
- No cancel button (they can close the tab; re-opening resumes)

**Copy Variants for Status:**
- 0-20%: "Scanning for spirits..."
- 20-50%: "Unearthing the dead..."
- 50-80%: "Cataloging the damned..."
- 80-99%: "Preparing the ritual..."
- 100%: "The spirits are revealed." → Auto-redirect to Dashboard

**Logic Notes:**
- If sync fails (token error, rate limit), show error with retry option
- For very large mailboxes (100k+), warn this might take 5-10 minutes
- Sync happens in pages; progress = pages completed / estimated total pages

---

### Screen 3: Dashboard

**Purpose:** Home base. Show the haunting. Provide quick actions and entry to deep cleanup.

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│  [Logo]     [account@gmail.com ▼]              [Settings ⚙]    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  The Haunting                                     [↻ Re-sync]  │
│  Last synced: 5 minutes ago                                    │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │   👻 78,432          📎 4.2 GB         📬 12,847        │   │
│  │   Total emails       Storage used      Unread           │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  Quick Exorcisms                                               │
│                                                                │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │ 🪦 Ancient Spirits │  │ 📦 Bloated Souls   │                │
│  │                    │  │                    │                │
│  │ 23,421 emails      │  │ 847 emails         │                │
│  │ older than 2 years │  │ over 5MB each      │                │
│  │                    │  │ (2.1 GB total)     │                │
│  │ [Exorcise these →] │  │ [Exorcise these →] │                │
│  └────────────────────┘  └────────────────────┘                │
│                                                                │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │ 📧 Repeat Offenders│  │ 🏷️ Promotions Hell │                │
│  │                    │  │                    │                │
│  │ Top senders:       │  │ 15,892 emails      │                │
│  │ • LinkedIn: 2,341  │  │ in Promotions tab  │                │
│  │ • Medium: 1,892    │  │                    │                │
│  │ • Substack: 1,203  │  │                    │                │
│  │ [See all senders →]│  │ [Exorcise these →] │                │
│  └────────────────────┘  └────────────────────┘                │
│                                                                │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            🔮 Advanced Cleanup Ritual                   │   │
│  │   Full control. Custom filters. Surgical precision.    │   │
│  │                    [Enter →]                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  🗑️ Trash: 1,203 emails (340 MB)         [Empty Trash]         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Elements:**

**Header:**
- Logo (links to dashboard)
- Account switcher dropdown (shows current email, lists others, "Add account" option)
- Settings gear icon

**Stats Row:**
- Total email count
- Total storage used (calculated from attachment sizes + estimated email body sizes)
- Unread count
- These update after each cleanup action

**Quick Exorcism Cards:**

| Card | Logic |
|------|-------|
| Ancient Spirits | Emails older than 2 years. Count + "Exorcise these" CTA. Clicking opens Cleanup View with date filter pre-set. |
| Bloated Souls | Emails with attachments >5MB. Show count + total size. Clicking opens Cleanup View with size filter pre-set. |
| Repeat Offenders | Top 3-5 senders by email count. "See all senders" opens Cleanup View with sender breakdown. |
| Promotions Hell | Emails in Gmail's "Promotions" category. Count + CTA. Clicking opens Cleanup View with category filter pre-set. |

**Advanced Cleanup CTA:**
- Prominent card/button leading to full Cleanup View
- For users who want custom filter combinations

**Trash Status Bar:**
- Shows current Gmail trash count + size
- "Empty Trash" button (leads to confirmation flow)
- Only shows if trash has items

**States:**
- Loading: Skeleton cards while calculating stats
- Empty inbox: Celebratory message ("Your inbox is clean. The spirits are at rest.")
- Sync in progress: Show banner "Syncing... Stats may be incomplete"

---

### Screen 4: Cleanup View (The Ritual Chamber)

**Purpose:** The power tool. Filter, preview, select, destroy.

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│  [← Back to Dashboard]                    [account@gmail.com]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  The Ritual Chamber                                            │
│                                                                │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ FILTERS                                              [Reset]││
│ │                                                             ││
│ │ Date Range        From: [Jan 1, 2020 ▼]  To: [Dec 31, 2022]││
│ │                   Quick: [Older than 1yr] [2yr] [3yr] [5yr]  ││
│ │                                                             ││
│ │ Size              [Any ▼]  → Options: Any, >1MB, >5MB, >10MB││
│ │                                                             ││
│ │ Sender            [Search senders...              ]         ││
│ │                   Popular: [LinkedIn ×] [Medium ×] [+ more] ││
│ │                                                             ││
│ │ Labels            [Select labels...               ]         ││
│ │                   [Inbox] [Updates] [Forums] [Custom...]    ││
│ │                                                             ││
│ │ Category          ( ) All  (•) Promotions  ( ) Social       ││
│ │                   ( ) Updates  ( ) Forums  ( ) Primary      ││
│ │                                                             ││
│ │ Status            [All ▼]  → Options: All, Read, Unread     ││
│ │                                                             ││
│ │ Has Attachment    [ ] Only show emails with attachments     ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                │
│  Showing 12,847 condemned souls (2.3 GB)                       │
│                                                                │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ [☑] Select all 12,847          Sort by: [Date (newest) ▼]  ││
│ ├─────────────────────────────────────────────────────────────┤│
│ │ [☑] LinkedIn         "Your weekly job digest..."  Jan 3     ││
│ │     jobs-noreply@    ─────────────────────────    1.2 MB   ││
│ ├─────────────────────────────────────────────────────────────┤│
│ │ [☑] Medium Daily     "Today's top stories..."     Jan 2     ││
│ │     noreply@medium   ─────────────────────────    340 KB   ││
│ ├─────────────────────────────────────────────────────────────┤│
│ │ [ ] Stripe           "Your January invoice"       Jan 1     ││
│ │     receipts@stripe  ─────────────────────────    89 KB    ││
│ ├─────────────────────────────────────────────────────────────┤│
│ │                    ... more rows ...                        ││
│ ├─────────────────────────────────────────────────────────────┤│
│ │              [Load more] or pagination                      ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │  👻 2,341 selected (892 MB)      [Send to the Grave 🪦]     ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Filter Panel Elements:**

| Filter | Behavior |
|--------|----------|
| **Date Range** | Two date pickers (from/to). Quick buttons for common ranges. Default: "All time" |
| **Size** | Dropdown: Any, >1MB, >5MB, >10MB, >25MB. Filters by attachment size. |
| **Sender** | Search input with autocomplete from synced sender list. Can select multiple. Shows top senders as quick-add chips. |
| **Labels** | Multi-select dropdown. Populated from user's Gmail labels. Includes system labels (Inbox, Sent, etc.) |
| **Category** | Radio buttons for Gmail categories. "All" = no category filter. |
| **Status** | Dropdown: All, Read only, Unread only |
| **Has Attachment** | Checkbox. When checked, only shows emails with attachments. |
| **Reset** | Clears all filters to default |

**Filter Logic:**
- All active filters combine with AND
- Example: Date (older than 2yr) AND Sender (LinkedIn) AND Category (Promotions) = emails from LinkedIn in Promotions older than 2 years
- Results update in real-time as filters change (with debounce)
- Empty state: "No emails match these filters. Try adjusting your criteria."

**Results List Elements:**

| Column | Content |
|--------|---------|
| Checkbox | Individual selection. Unchecked by default. |
| Sender | Display name + email address (truncated if long) |
| Subject | Email subject, truncated with ellipsis |
| Date | Formatted date (relative for recent: "2 days ago", absolute for old: "Jan 3, 2021") |
| Size | Attachment size if present, otherwise estimate based on email |

**Results Behavior:**
- Default sort: Date (newest first)
- Sort options: Date (newest/oldest), Size (largest/smallest), Sender (A-Z)
- Pagination: 50 items per page, or infinite scroll with "Load more"
- "Select all" selects ALL matching emails (not just visible), with clear indication: "Select all 12,847"
- Clicking a row (not checkbox) could expand to show more details (optional for MVP, nice-to-have)

**Action Bar (sticky at bottom):**
- Shows selected count + total size
- "Send to the Grave" button (disabled if nothing selected)
- Updates in real-time as selection changes

**States:**
- Loading: Skeleton rows while filtering
- Empty results: "No spirits match your criteria. The filters are too pure."
- Processing: After clicking "Send to the Grave", show progress modal

---

### Screen 5: Confirmation Modal (Pre-Trash)

**Purpose:** Confirm before moving to trash. Last chance to review.

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                    🪦 Confirm the Ritual                       │
│                                                                │
│       You're about to banish 2,341 emails to the grave.        │
│                                                                │
│                     Total size: 892 MB                         │
│                                                                │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ This moves emails to Gmail's Trash.                  │    │
│    │ They'll stay there for 30 days before auto-deletion. │    │
│    │ You can recover them from Trash if needed.           │    │
│    └──────────────────────────────────────────────────────┘    │
│                                                                │
│          [Cancel]              [Send to the Grave →]           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Copy Notes:**
- Reassure that this is NOT permanent deletion
- Mention 30-day Gmail trash retention
- Make it clear they can undo from Gmail Trash

**Behavior:**
- "Cancel" closes modal, returns to Cleanup View
- "Send to the Grave" triggers batch trash operation

---

### Screen 6: Progress Modal (During Trash Operation)

**Purpose:** Show progress during batch operation. Keep user informed.

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                   ⏳ Banishing spirits...                      │
│                                                                │
│              ████████████████░░░░░░░░  67%                     │
│                                                                │
│                   1,567 / 2,341 emails                         │
│                                                                │
│     Do not close this window. The ritual must complete.        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Non-dismissable while in progress
- Updates as batches complete (Gmail API processes in batches of ~1000)
- If error occurs mid-way, show error state with count of successful/failed + retry option

---

### Screen 7: Success Modal (Post-Trash)

**Purpose:** Celebrate the win. Prompt next action.

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                      🎉 Souls banished.                        │
│                                                                │
│                2,341 emails moved to trash                     │
│                    892 MB reclaimed                            │
│                                                                │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ These emails are in Gmail's Trash.                   │    │
│    │ They'll auto-delete in 30 days, or you can           │    │
│    │ finish them off now.                                 │    │
│    └──────────────────────────────────────────────────────┘    │
│                                                                │
│    [Back to Dashboard]           [Finish them off 💀]          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- "Back to Dashboard" returns to Dashboard (stats will be updated)
- "Finish them off" leads to Empty Trash confirmation
- Could also have "Continue cleaning" to stay in Cleanup View

---

### Screen 8: Empty Trash Confirmation

**Purpose:** Final warning before permanent deletion. Make it feel serious.

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                  ☠️ PERMANENT EXORCISM ☠️                      │
│                                                                │
│        You're about to permanently delete everything           │
│                    in your Gmail Trash.                        │
│                                                                │
│                      3,847 emails                              │
│                         1.4 GB                                 │
│                                                                │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ ⚠️  THIS CANNOT BE UNDONE                            │    │
│    │                                                      │    │
│    │  These emails will be permanently deleted from       │    │
│    │  your Gmail account. Not even Google can recover     │    │
│    │  them. Make sure you're ready.                       │    │
│    │                                                      │    │
│    │  (Gmail auto-deletes trash after 30 days anyway,     │    │
│    │   so there's no rush.)                               │    │
│    └──────────────────────────────────────────────────────┘    │
│                                                                │
│        Type EXORCISE to confirm:                               │
│        ┌─────────────────────────────────────────────┐         │
│        │                                             │         │
│        └─────────────────────────────────────────────┘         │
│                                                                │
│          [Cancel]              [Delete Forever]                │
│                               (disabled until typed)           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- "Delete Forever" button disabled until user types "EXORCISE"
- Case-insensitive matching
- After deletion: Show success toast, return to Dashboard, trash counter resets

---

### Screen 9: Settings

**Purpose:** Manage accounts and preferences.

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│  [← Back to Dashboard]                                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Settings                                                      │
│                                                                │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  Connected Accounts                                            │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📧 john@gmail.com                                       │   │
│  │    Last synced: 5 minutes ago                           │   │
│  │    78,432 emails indexed                                │   │
│  │                               [Re-sync]  [Remove]       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📧 john.work@company.com                                │   │
│  │    Last synced: 2 hours ago                             │   │
│  │    12,103 emails indexed                                │   │
│  │                               [Re-sync]  [Remove]       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              [+ Add another account]                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  Danger Zone                                                   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🗑️ Clear all local data                                 │   │
│  │    Remove all accounts and cached data from this        │   │
│  │    Inboxorcist instance. Does not affect your Gmail.    │   │
│  │                                        [Clear Data]     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Elements:**

**Connected Accounts:**
- List all linked Gmail accounts
- Per account: email, last sync time, email count
- "Re-sync" triggers fresh metadata sync for that account
- "Remove" shows confirmation, then disconnects + deletes local data

**Add Account:**
- Triggers OAuth flow for new account

**Danger Zone:**
- "Clear all data" removes everything (all accounts, all cached data)
- Requires confirmation
- After clearing: redirect to Landing page

---

## Empty & Error States

### Empty States

| State | Location | Copy |
|-------|----------|------|
| No accounts connected | Dashboard (shouldn't happen, but fallback) | "No accounts connected. Add a Gmail account to begin the exorcism." |
| Inbox is clean | Dashboard (rare) | "Your inbox is spotless. No demons here. Either you're a productivity god, or you're in denial." |
| No filter results | Cleanup View | "No spirits match your criteria. Try loosening the filters." |
| Trash is empty | Dashboard trash bar | Don't show trash bar at all if empty |

### Error States

| Error | Handling |
|-------|----------|
| OAuth failed/cancelled | Return to Landing with toast: "Connection cancelled. Try again when you're ready." |
| Token expired | Show banner: "Session expired. Please re-authenticate." + Re-auth button |
| Sync failed | Show retry option: "Sync failed. This might be a rate limit. Wait a minute and try again." |
| Trash operation failed | Show which succeeded/failed: "2,100 emails trashed. 241 failed. Retry failed?" |
| Network error | Toast: "Connection lost. Check your internet and try again." |

---

## Component Specifications

### Account Switcher Dropdown

```
┌────────────────────────────────┐
│ ✓ john@gmail.com              │  ← Current (checkmark)
├────────────────────────────────┤
│   john.work@company.com       │
├────────────────────────────────┤
│ + Add another account         │  ← Always at bottom
└────────────────────────────────┘
```

- Shows on Dashboard and Cleanup View
- Clicking another account switches immediately (data is local)
- "Add another account" triggers OAuth

### Toast Notifications

```
┌─────────────────────────────────────────────┐
│ ✓ 2,341 emails banished to trash    [×]    │
└─────────────────────────────────────────────┘
```

- Appear top-right or bottom-right
- Auto-dismiss after 5 seconds
- Manual dismiss with X
- Types: Success (green), Error (red), Info (blue), Warning (yellow)

### Sender Autocomplete

```
Sender: [linked                    ]
        ┌────────────────────────────────┐
        │ LinkedIn (2,341 emails)        │
        │ LinkedIn Jobs (892 emails)     │
        │ Linktree (23 emails)           │
        └────────────────────────────────┘
```

- Searches against synced sender list
- Shows email count per sender
- Click to add to filter
- Multiple senders = OR logic (emails from A OR B OR C)

---

## Interaction Details

### Batch Selection Logic

When user clicks "Select all X,XXX":
1. Immediately mark header checkbox as checked
2. Store the current filter state, not individual IDs
3. When user proceeds to trash, resolve filter to IDs at that moment
4. This handles edge cases where sync might have added emails mid-session

When user manually unchecks some items:
1. Switch from "all selected" mode to "individual selection" mode
2. Track the unchecked IDs as exclusions

### Filter Persistence

- Filters reset when leaving Cleanup View
- Exception: If arriving from Quick Action card, those filters are pre-set
- Consider: Save last-used filters in localStorage (nice-to-have)

### Keyboard Shortcuts (Nice-to-have for MVP, but on-brand)

| Key | Action |
|-----|--------|
| `/` | Focus search/filter |
| `Esc` | Clear selection / Close modal |
| `Enter` | Confirm action in modal |
| `Ctrl/Cmd + A` | Select all visible |

---

## Copy & Tone Guidelines

### Voice
- Playful but not silly
- Horror/exorcism theme without being too dark
- Self-aware, slightly irreverent
- Technical users appreciate wit, not fluff

### Terminology

| Instead of... | Use... |
|--------------|--------|
| Delete | Banish, Exorcise, Send to the grave |
| Trash | The Grave, Purgatory |
| Emails | Spirits, Souls, Demons (when dramatic), Emails (when clarity needed) |
| Inbox | The Haunting |
| Sync | Scan, Discover, Unearth |
| Error | "Something went wrong" → "The ritual was interrupted" |
| Loading | "Scanning for spirits...", "Channeling the dead..." |
| Success | "Souls banished", "The exorcism is complete" |

### Headlines by Screen

| Screen | Headline |
|--------|----------|
| Landing | "Your inbox is possessed." |
| Dashboard | "The Haunting" (as section title) |
| Cleanup View | "The Ritual Chamber" |
| Sync | "Scanning for spirits..." |
| Success | "Souls banished." |
| Empty Trash | "PERMANENT EXORCISM" |
| Error | "The ritual was interrupted." |

### CTA Buttons

| Action | Button Text |
|--------|-------------|
| Connect Gmail | "Begin the Exorcism" |
| Go to Cleanup | "Enter the Ritual Chamber" |
| Apply filters | Just apply automatically, no button needed |
| Move to trash | "Send to the Grave" |
| Empty trash | "Finish them off" / "Delete Forever" |
| Confirm destructive action | Typing "EXORCISE" |
| Return home | "Back to Dashboard" / "Return to the Crypt" |

---

## Out of Scope (MVP)

These are explicitly NOT in v1:

- **Unsubscribe functionality** - Requires parsing email body, dealing with different unsubscribe methods
- **Scheduled cleanups** - Runs once, manually
- **Email rules/automation** - "Delete all from X sender automatically"
- **Label management** - Creating, renaming, organizing labels
- **Email body search** - Only metadata is indexed
- **Email preview** - No viewing email content
- **Mobile-responsive design** - Desktop-first, tablet acceptable, phone not prioritized
- **Dark mode** - Nice to have, not MVP
- **Telemetry/analytics** - Privacy-first means no tracking
- **Cloud version** - Self-hosted only for MVP
- **Multiple Gmail categories in one filter** - Radio buttons, not multi-select (simpler)

---

## Open Questions

1. **Re-sync behavior**: Full re-sync (delete + re-fetch all) or incremental (fetch new since last sync)?
   - Recommendation: Incremental is complex. MVP = full re-sync with warning about time.

2. **Rate limiting UX**: Gmail API has quotas. How do we handle hitting them?
   - Recommendation: Show clear error, suggest waiting, provide retry. Don't over-engineer.

3. **Session persistence**: If user closes tab mid-sync, what happens on return?
   - Recommendation: Store sync progress in DB. Resume where left off.

4. **Exact storage calculation**: Gmail doesn't give exact storage per email easily.
   - Recommendation: Use attachment sizes + rough estimate for body. Underpromise.

5. **Maximum emails**: Is there a point where we say "too many"?
   - Recommendation: No hard limit, but warn for 200k+ that sync will be slow.

---

## Success Criteria (MVP)

Since this is self-hosted and privacy-focused, we're not tracking users. But for the builder:

- User can connect Gmail account successfully
- Sync completes for mailboxes up to 100k emails
- User can filter emails by any combination of: date, size, sender, label, category
- User can select and trash emails in batches
- User can empty Gmail trash
- User can add/remove multiple accounts
- No data leaves the user's machine
- Total time from "Begin Exorcism" to first trash action: <5 minutes for average user

---

## Appendix: User Testing Questions

When testing with real users:

1. "What do you think this app does?" (Landing page clarity)
2. "What would you click first?" (Intuitive entry point)
3. "How would you find emails from LinkedIn from 2020?" (Filter discoverability)
4. "How confident are you that your data is private?" (Trust signals)
5. "What would make you nervous about clicking this?" (Destructive action UX)
6. "Is anything confusing about the language/copy?" (Brand clarity vs. confusion)

---

*Document version: 1.0*
*Last updated: [Date]*
*Status: MVP Ready for Development*