# Explorer Feature - Implementation Plan

> Advanced email table UI with filters for browsing and bulk deletion

## Overview

The Explorer tab allows users to browse all synced emails in a table format with advanced filters. Users can select emails and bulk delete (move to trash).

## Requirements

### Filters (All Available)
- **Sender**: Search/select by sender email
- **Category**: promotions, social, updates, forums, primary
- **Date Range**: from/to date pickers
- **Size**: min/max size in bytes (with presets like >5MB, >10MB)
- **Read Status**: read/unread/all
- **Starred**: starred/not starred/all
- **Has Attachments**: yes/no/all
- **Subject Search**: text search in subject

### Table Columns
- Checkbox (for selection)
- From (sender name + email)
- Subject (with snippet preview)
- Category (badge)
- Size (formatted)
- Date (formatted)
- Labels (badges)

### Actions
- Bulk select (checkbox column)
- Select all on page / Select all matching filters
- Delete selected (move to trash)
- Refresh data

### Pagination
- Server-side pagination
- 50 items per page default
- Page navigation controls
- Total count display

---

## Phase 1: Backend API Endpoints

### New File: `apps/api/src/routes/explorer.ts`

#### `GET /api/gmail/accounts/:id/emails`

Query emails with filters and pagination.

**Query Parameters:**
```typescript
interface ExplorerQueryParams {
  // Pagination
  page?: number;          // default: 1
  limit?: number;         // default: 50, max: 100

  // Filters
  sender?: string;        // exact match or LIKE %value%
  category?: string;      // exact match
  dateFrom?: number;      // unix timestamp ms
  dateTo?: number;        // unix timestamp ms
  sizeMin?: number;       // bytes
  sizeMax?: number;       // bytes
  isUnread?: boolean;     // true/false
  isStarred?: boolean;    // true/false
  hasAttachments?: boolean;
  search?: string;        // subject LIKE %value%

  // Sorting
  sortBy?: 'date' | 'size' | 'sender';  // default: date
  sortOrder?: 'asc' | 'desc';           // default: desc
}
```

**Response:**
```typescript
interface ExplorerResponse {
  emails: EmailRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  filters: ExplorerQueryParams; // echo back applied filters
}
```

#### `POST /api/gmail/accounts/:id/emails/trash`

Move selected emails to trash.

**Request Body:**
```typescript
interface TrashRequest {
  emailIds: string[];  // gmail_ids to trash
}
```

**Response:**
```typescript
interface TrashResponse {
  success: boolean;
  trashedCount: number;
  failedIds?: string[];
  message: string;
}
```

#### `GET /api/gmail/accounts/:id/emails/count`

Get count of emails matching filters (for "select all matching" feature).

**Query Parameters:** Same as `/emails` endpoint (without pagination)

**Response:**
```typescript
interface CountResponse {
  count: number;
  filters: ExplorerQueryParams;
}
```

### Implementation in `apps/api/src/lib/emails-db.ts`

Add new functions:
- `queryEmails(db, filters, pagination)` - Build dynamic SQL query with filters
- `countEmails(db, filters)` - Count matching emails
- `deleteEmailsByIds(db, ids)` - Remove from local DB after Gmail trash

---

## Phase 2: Gmail Trash Service

### Update: `apps/api/src/services/gmail.ts`

Add function to batch trash emails via Gmail API:

```typescript
async function trashEmails(
  accountId: string,
  emailIds: string[]
): Promise<{ success: string[]; failed: string[] }>
```

**Notes:**
- Use `gmail.users.messages.trash()` for each message
- Batch up to 10 concurrent requests
- Handle rate limiting with exponential backoff
- Return success/failed arrays

---

## Phase 3: Frontend Components

### New Files Structure:
```
apps/web/src/
├── components/
│   └── domain/
│       ├── ExplorerTab.tsx        # Main tab container
│       ├── ExplorerFilters.tsx    # Filter controls
│       ├── ExplorerTable.tsx      # Data table
│       └── ExplorerPagination.tsx # Pagination controls
├── hooks/
│   └── useExplorerEmails.ts       # Data fetching hook
└── lib/
    └── api.ts                     # Add new API functions
```

### Component: `ExplorerTab.tsx`
- Container for filters + table + pagination
- Manages filter state
- Handles selection state
- Coordinates bulk actions

### Component: `ExplorerFilters.tsx`
Filter controls:
- Sender: Combobox with search (use existing senders data)
- Category: Dropdown select
- Date Range: Two date inputs
- Size: Dropdown with presets (Any, >1MB, >5MB, >10MB) + custom
- Read Status: Dropdown (All, Read, Unread)
- Starred: Dropdown (All, Starred, Not Starred)
- Attachments: Dropdown (All, Has Attachments, No Attachments)
- Subject Search: Text input with debounce
- Clear filters button
- Apply filters button (or auto-apply with debounce)

### Component: `ExplorerTable.tsx`
Data table with:
- Checkbox column (sticky)
- Sortable columns (click header to sort)
- Row hover state
- Responsive design
- Loading skeleton
- Empty state

### Component: `ExplorerPagination.tsx`
- Page info: "Showing 1-50 of 1,624"
- Page navigation: First, Prev, [1] [2] [3] ... [N], Next, Last
- Items per page selector: 25, 50, 100

### Hook: `useExplorerEmails.ts`
```typescript
function useExplorerEmails(accountId: string, filters: Filters) {
  // Uses React Query or SWR for caching
  // Returns: { emails, pagination, isLoading, error, refetch }
}
```

---

## Phase 4: Integration & Polish

### Sidebar Update
Add "Explorer" tab below "Overview" in `Sidebar.tsx`:
```tsx
<NavItem
  icon={Search} // or Table2 icon
  label="Explorer"
  active={activeTab === "explorer"}
  onClick={() => onTabChange("explorer")}
/>
```

### Dashboard Update
Add Explorer tab content in `Dashboard.tsx`:
```tsx
{activeTab === "explorer" && (
  <ExplorerTab
    accountId={selectedAccountId}
    syncStatus={syncStatus}
  />
)}
```

### UI Dependencies
May need to add shadcn components:
- `@/components/ui/table` - Data table
- `@/components/ui/select` - Dropdowns
- `@/components/ui/input` - Text inputs
- `@/components/ui/checkbox` - Selection
- `@/components/ui/popover` + `@/components/ui/calendar` - Date picker

---

## Implementation Order

### Phase 1: Backend (Start Here)
1. Create `apps/api/src/routes/explorer.ts`
2. Add `queryEmails()` and `countEmails()` to `emails-db.ts`
3. Register routes in `apps/api/src/index.ts`
4. Test with curl/Postman

### Phase 2: Gmail Trash
1. Add `trashEmails()` to `gmail.ts` service
2. Implement POST `/emails/trash` endpoint
3. Test trashing a few emails

### Phase 3: Frontend Base
1. Add missing shadcn components (table, select, checkbox)
2. Create `useExplorerEmails.ts` hook
3. Add API functions to `lib/api.ts`
4. Create basic `ExplorerTab.tsx` with hardcoded data

### Phase 4: Frontend Filters & Table
1. Build `ExplorerFilters.tsx`
2. Build `ExplorerTable.tsx`
3. Build `ExplorerPagination.tsx`
4. Wire up filter state to API calls

### Phase 5: Selection & Deletion
1. Add checkbox selection logic
2. Add "Delete Selected" button
3. Add confirmation dialog
4. Implement trash action with loading state
5. Refresh data after deletion

### Phase 6: Polish
1. Add sidebar navigation item
2. Add loading skeletons
3. Add empty states
4. Add error handling
5. Test with large datasets
6. Responsive design tweaks

---

## API Contracts Summary

```
GET  /api/gmail/accounts/:id/emails       - Query emails with filters
GET  /api/gmail/accounts/:id/emails/count - Count matching emails
POST /api/gmail/accounts/:id/emails/trash - Trash selected emails
```

---

## Notes

- Explorer requires sync to be completed (like existing senders endpoint)
- Consider adding a "last synced" indicator
- For large selections (>1000), may need job-based approach
- Keep UI copy on-brand ("Banish emails", "Exorcise selected", etc.)
