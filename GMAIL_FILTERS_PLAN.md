# Gmail Filters & Labels Management Feature - Implementation Plan

## Overview

Add the ability to manage Gmail filters/rules and labels within Inboxorcist. Users can:
- **Filters**: View, create, edit, and delete Gmail filters, plus apply filters retroactively to existing emails
- **Labels**: View, create, edit, and delete custom labels (with color support)

**Notes**:
- Gmail API has no "update" method for filters. To edit a filter, we delete the old one and create a new one.
- System labels (INBOX, SENT, TRASH, etc.) cannot be modified or deleted - only user-created labels can be managed.

---

## Progress Tracker

### Filters

- [ ] **Phase 1: Backend - Filters API**
  - [ ] Add Gmail filter service (`apps/api/src/services/filters.ts`)
  - [ ] Add filter routes (`apps/api/src/routes/filters.ts`)
  - [ ] Register routes in main app

- [ ] **Phase 2: Frontend - Filters Basic Structure**
  - [ ] Add Filters page route (`apps/web/src/routes/_dashboard/filters.tsx`)
  - [ ] Add sidebar navigation link
  - [ ] Create FiltersPage component with tabs (Filters / Labels)

- [ ] **Phase 3: Frontend - Filters List & Display**
  - [ ] Create FilterCard component (display single filter)
  - [ ] Create FilterList component (list all filters)
  - [ ] Implement filter loading state and empty state

- [ ] **Phase 4: Frontend - Filters Create/Edit**
  - [ ] Create FilterFormDialog component
  - [ ] Implement filter criteria form (from, to, subject, has words, etc.)
  - [ ] Implement filter actions form (archive, mark read, star, labels, etc.)
  - [ ] Add validation

- [ ] **Phase 5: Frontend - Filters Delete**
  - [ ] Add delete confirmation dialog
  - [ ] Implement delete API call

- [ ] **Phase 6: Apply Filter to Existing Emails**
  - [ ] Add "Apply to existing" button on each filter
  - [ ] Create preview dialog showing matching email count
  - [ ] Implement batch action application

### Labels

- [ ] **Phase 7: Backend - Labels API**
  - [ ] Add labels service functions to `filters.ts`
  - [ ] Add label routes (list, create, update, delete)

- [ ] **Phase 8: Frontend - Labels List & Display**
  - [ ] Create LabelCard component (display single label with color)
  - [ ] Create LabelList component
  - [ ] Show system labels (read-only) vs user labels (editable)

- [ ] **Phase 9: Frontend - Labels Create/Edit/Delete**
  - [ ] Create LabelFormDialog component
  - [ ] Implement name input and color picker (Gmail's 75 preset colors)
  - [ ] Add delete confirmation dialog
  - [ ] Implement CRUD API calls

### Polish

- [ ] **Phase 10: Polish**
  - [ ] Error handling and toast notifications
  - [ ] Loading states
  - [ ] Empty states with helpful messaging
  - [ ] Keyboard shortcuts (if applicable)

---

## API Design

### Endpoints

**Filters:**
```
GET    /api/filters/accounts/:id/filters           - List all filters
GET    /api/filters/accounts/:id/filters/:fid      - Get single filter
POST   /api/filters/accounts/:id/filters           - Create filter
DELETE /api/filters/accounts/:id/filters/:fid      - Delete filter
PUT    /api/filters/accounts/:id/filters/:fid      - "Update" (delete + create)
POST   /api/filters/accounts/:id/filters/:fid/apply   - Apply filter to existing emails
GET    /api/filters/accounts/:id/filters/:fid/preview - Preview matching emails count
```

**Labels:**
```
GET    /api/filters/accounts/:id/labels            - List all labels
POST   /api/filters/accounts/:id/labels            - Create label
GET    /api/filters/accounts/:id/labels/:lid       - Get single label
PATCH  /api/filters/accounts/:id/labels/:lid       - Update label (name, color)
DELETE /api/filters/accounts/:id/labels/:lid       - Delete label
```

### Types

**Filters:**
```typescript
interface GmailFilter {
  id: string
  criteria: FilterCriteria
  action: FilterAction
}

interface FilterCriteria {
  from?: string           // Sender email/name
  to?: string             // Recipient
  subject?: string        // Subject contains
  query?: string          // Has words (Gmail search syntax)
  negatedQuery?: string   // Doesn't have words
  hasAttachment?: boolean // Has attachment
  size?: number           // Size in bytes
  sizeComparison?: 'larger' | 'smaller'
  excludeChats?: boolean  // Exclude chat messages
}

interface FilterAction {
  addLabelIds?: string[]     // Labels to add
  removeLabelIds?: string[]  // Labels to remove
  forward?: string           // Forward to (verified email)
}

// Common label IDs for actions:
// - INBOX (remove = archive)
// - UNREAD (remove = mark as read)
// - STARRED (add = star)
// - IMPORTANT (add = mark important)
// - TRASH (add = delete)
// - SPAM (remove = never mark as spam)
// - CATEGORY_* (for category assignment)
```

**Labels:**
```typescript
interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
  messageListVisibility?: 'show' | 'hide'
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide'
  messagesTotal?: number
  messagesUnread?: number
  threadsTotal?: number
  threadsUnread?: number
  color?: LabelColor
}

interface LabelColor {
  textColor: string      // Hex color (e.g., '#ffffff')
  backgroundColor: string // Hex color (e.g., '#fb4c2f')
}

// Create/Update label request
interface LabelRequest {
  name: string
  messageListVisibility?: 'show' | 'hide'
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide'
  color?: LabelColor
}
```

---

## Frontend Components

### File Structure

```
apps/web/src/
├── routes/_dashboard/
│   └── filters.tsx                # Route definition
├── components/domain/filters/
│   ├── FiltersPage.tsx            # Main page with Tabs (Filters / Labels)
│   │
│   │── # Filter components
│   ├── FilterList.tsx             # List of filter cards
│   ├── FilterCard.tsx             # Single filter display
│   ├── FilterFormDialog.tsx       # Create/Edit filter dialog
│   ├── FilterCriteriaForm.tsx     # Criteria inputs
│   ├── FilterActionsForm.tsx      # Action checkboxes/selects
│   ├── DeleteFilterDialog.tsx     # Delete filter confirmation
│   ├── ApplyFilterDialog.tsx      # Apply to existing preview
│   │
│   │── # Label components
│   ├── LabelList.tsx              # List of label cards (system + user)
│   ├── LabelCard.tsx              # Single label display with color
│   ├── LabelFormDialog.tsx        # Create/Edit label dialog
│   ├── LabelColorPicker.tsx       # Gmail's 75 preset colors grid
│   └── DeleteLabelDialog.tsx      # Delete label confirmation
│
├── hooks/
│   ├── useFilters.ts              # Filter CRUD operations
│   └── useLabels.ts               # Label CRUD operations
└── lib/
    └── api.ts                     # Add filter & label API functions
```

### Component Hierarchy

```
FiltersPage
├── Header (title)
├── Tabs (Filters | Labels)
│
├── [Tab: Filters]
│   ├── "Create Filter" button
│   ├── FilterList
│   │   └── FilterCard (for each filter)
│   │       ├── Criteria display (chips/badges)
│   │       ├── Actions display (chips/badges)
│   │       └── Action buttons (Edit, Delete, Apply)
│   ├── FilterFormDialog (modal for create/edit)
│   │   ├── FilterCriteriaForm
│   │   │   ├── From input
│   │   │   ├── To input
│   │   │   ├── Subject input
│   │   │   ├── Has words input
│   │   │   ├── Doesn't have input
│   │   │   ├── Has attachment toggle
│   │   │   └── Size filter (number + larger/smaller)
│   │   └── FilterActionsForm
│   │       ├── Skip Inbox (Archive) checkbox
│   │       ├── Mark as read checkbox
│   │       ├── Star it checkbox
│   │       ├── Mark as important checkbox
│   │       ├── Delete it checkbox
│   │       ├── Never send to Spam checkbox
│   │       └── Apply label dropdown
│   ├── DeleteFilterDialog
│   └── ApplyFilterDialog
│       ├── Preview (X emails match this filter)
│       ├── Action summary
│       └── Confirm/Cancel buttons
│
└── [Tab: Labels]
    ├── "Create Label" button
    ├── LabelList
    │   ├── Section: System Labels (read-only, no actions)
    │   │   └── LabelCard (INBOX, SENT, DRAFTS, etc.)
    │   └── Section: Your Labels (editable)
    │       └── LabelCard (for each user label)
    │           ├── Color dot + Name
    │           ├── Message count (optional)
    │           └── Action buttons (Edit, Delete)
    ├── LabelFormDialog (modal for create/edit)
    │   ├── Name input
    │   ├── LabelColorPicker (75 preset colors grid)
    │   └── Visibility options (optional, advanced)
    └── DeleteLabelDialog
        └── Warning: "This will remove the label from X messages"
```

---

## Filter Criteria UI Mapping

| Criteria Field | UI Component | Label |
|---------------|--------------|-------|
| from | Input | "From" |
| to | Input | "To" |
| subject | Input | "Subject contains" |
| query | Input | "Has the words" |
| negatedQuery | Input | "Doesn't have" |
| hasAttachment | Switch | "Has attachment" |
| size + sizeComparison | Number + Select | "Size" (larger/smaller than X MB) |

---

## Filter Actions UI Mapping

| Action | UI Component | Label | Implementation |
|--------|--------------|-------|----------------|
| Archive | Checkbox | "Skip the Inbox (Archive it)" | removeLabelIds: ['INBOX'] |
| Mark read | Checkbox | "Mark as read" | removeLabelIds: ['UNREAD'] |
| Star | Checkbox | "Star it" | addLabelIds: ['STARRED'] |
| Important | Checkbox | "Mark as important" | addLabelIds: ['IMPORTANT'] |
| Not important | Checkbox | "Never mark as important" | removeLabelIds: ['IMPORTANT'] |
| Delete | Checkbox | "Delete it" | addLabelIds: ['TRASH'] |
| Never spam | Checkbox | "Never send it to Spam" | removeLabelIds: ['SPAM'] |
| Apply label | Select | "Apply the label" | addLabelIds: [labelId] |
| Forward | Input | "Forward to" | forward: email |

---

## Apply to Existing Emails - UX Flow

1. User clicks "Apply to existing" on a filter card
2. Dialog opens showing:
   - Filter criteria summary
   - "Searching for matching emails..." loading state
3. API returns count of matching emails
4. Dialog shows:
   - "X emails match this filter"
   - Actions that will be applied (e.g., "Will be archived and marked as read")
   - Warning if actions are destructive (delete)
5. User clicks "Apply" or "Cancel"
6. If Apply:
   - Progress indicator
   - Batch process emails (using existing batch API patterns)
   - Success toast with count
   - Refresh filter list

---

## Backend Implementation Notes

### Gmail API Calls - Filters

```typescript
// List filters
gmail.users.settings.filters.list({ userId: 'me' })

// Get single filter
gmail.users.settings.filters.get({ userId: 'me', id: filterId })

// Create filter
gmail.users.settings.filters.create({
  userId: 'me',
  requestBody: { criteria, action }
})

// Delete filter
gmail.users.settings.filters.delete({ userId: 'me', id: filterId })

// Apply filter to existing - use messages.list + messages.batchModify
gmail.users.messages.list({ userId: 'me', q: buildQueryFromCriteria(criteria) })
gmail.users.messages.batchModify({
  userId: 'me',
  requestBody: {
    ids: messageIds,
    addLabelIds: action.addLabelIds,
    removeLabelIds: action.removeLabelIds
  }
})
```

### Gmail API Calls - Labels

```typescript
// List all labels
gmail.users.labels.list({ userId: 'me' })

// Get single label
gmail.users.labels.get({ userId: 'me', id: labelId })

// Create label
gmail.users.labels.create({
  userId: 'me',
  requestBody: {
    name: 'My Label',
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show',
    color: { textColor: '#ffffff', backgroundColor: '#fb4c2f' }
  }
})

// Update label (PATCH for partial update)
gmail.users.labels.patch({
  userId: 'me',
  id: labelId,
  requestBody: {
    name: 'New Name',
    color: { textColor: '#ffffff', backgroundColor: '#16a765' }
  }
})

// Delete label
gmail.users.labels.delete({ userId: 'me', id: labelId })
```

### Query Building

Convert filter criteria to Gmail search query for "Apply to existing":

```typescript
function buildQueryFromCriteria(criteria: FilterCriteria): string {
  const parts: string[] = []
  if (criteria.from) parts.push(`from:${criteria.from}`)
  if (criteria.to) parts.push(`to:${criteria.to}`)
  if (criteria.subject) parts.push(`subject:${criteria.subject}`)
  if (criteria.query) parts.push(criteria.query)
  if (criteria.negatedQuery) parts.push(`-{${criteria.negatedQuery}}`)
  if (criteria.hasAttachment) parts.push('has:attachment')
  if (criteria.size && criteria.sizeComparison) {
    parts.push(`${criteria.sizeComparison}:${criteria.size}`)
  }
  return parts.join(' ')
}
```

---

## Sidebar Update

Add to `Sidebar.tsx` navigation items:

```typescript
{ icon: Filter, label: 'Filters', path: '/filters' }
```

Position: After "Subscriptions", before "Settings"

---

## API Sources

**Filters:**
- [Managing Filters Guide](https://developers.google.com/workspace/gmail/api/guides/filter_settings)
- [Filters REST Resource](https://developers.google.com/gmail/api/reference/rest/v1/users.settings.filters)
- [Create Method](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.filters/create)
- [Delete Method](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.filters/delete)

**Labels:**
- [Labels REST Resource](https://developers.google.com/gmail/api/reference/rest/v1/users.labels)
- [Create Label](https://developers.google.com/gmail/api/reference/rest/v1/users.labels/create)
- [Update Label](https://developers.google.com/gmail/api/reference/rest/v1/users.labels/update)
- [Delete Label](https://developers.google.com/gmail/api/reference/rest/v1/users.labels/delete)

---

## Gmail Label Preset Colors

Gmail only allows 75 predefined color combinations. Store these as constants:

```typescript
// Example subset - full list has 75 combinations
const GMAIL_LABEL_COLORS = [
  { backgroundColor: '#000000', textColor: '#ffffff' },
  { backgroundColor: '#434343', textColor: '#ffffff' },
  { backgroundColor: '#666666', textColor: '#ffffff' },
  { backgroundColor: '#999999', textColor: '#ffffff' },
  { backgroundColor: '#cccccc', textColor: '#000000' },
  { backgroundColor: '#efefef', textColor: '#000000' },
  { backgroundColor: '#f3f3f3', textColor: '#000000' },
  { backgroundColor: '#ffffff', textColor: '#000000' },
  // ... reds, oranges, yellows, greens, cyans, blues, purples, pinks
  { backgroundColor: '#fb4c2f', textColor: '#ffffff' }, // Red
  { backgroundColor: '#ffad47', textColor: '#000000' }, // Orange
  { backgroundColor: '#fad165', textColor: '#000000' }, // Yellow
  { backgroundColor: '#16a765', textColor: '#ffffff' }, // Green
  { backgroundColor: '#43d692', textColor: '#000000' }, // Light green
  { backgroundColor: '#4a86e8', textColor: '#ffffff' }, // Blue
  { backgroundColor: '#a479e2', textColor: '#ffffff' }, // Purple
  { backgroundColor: '#f691b3', textColor: '#000000' }, // Pink
  // ... (fetch full list from Gmail API or hardcode all 75)
]
```

**Note**: The LabelColorPicker component should display these as a grid of clickable color swatches.

---

## Limitations to Note

**Filters:**
1. **Max 1000 filters** per Gmail account
2. **No update API** - must delete and recreate
3. **One custom label per filter** action
4. **Forwarding requires verified email** - skip this initially or show warning
5. **batchModify max 1000 messages** - need pagination for "Apply to existing"

**Labels:**
1. **Max 10,000 labels** per Gmail account
2. **Only 75 preset colors** - cannot use arbitrary colors
3. **System labels cannot be modified** - only user labels are editable
4. **Deleting a label removes it from all messages** - warn user
