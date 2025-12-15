# Cleanup Feature Implementation Plan

## Overview

Implement the cleanup functionality by reusing explorer components with cleanup-specific enhancements. The cleanup page will show quick cleanup cards at the top, then a filterable table below. Clicking a cleanup card auto-applies the corresponding filter.

## Key Requirements

1. **Backend**: Add `totalSizeBytes` to explorer response and support larger page sizes (5000 for cleanup)
2. **Frontend**: Extract reusable filter/table components from Explorer, update Cleanup page layout
3. **UX**: Clicking cleanup cards auto-applies filters, show storage to be freed

---

## Phase 1: Backend API Enhancements

### 1.1 Add `totalSizeBytes` to Explorer Response

**File:** `apps/api/src/lib/emails-db.ts`

Add function to calculate total size of filtered emails:

```typescript
export function sumFilteredEmailsSize(db: Database, filters: ExplorerFilters): number {
  // Sum size_bytes for all emails matching filters
}
```

**File:** `apps/api/src/routes/explorer.ts`

Update `GET /api/explorer/accounts/:id/emails`:
- Add `totalSizeBytes` to response (sum of all matching emails, not just current page)
- Update max limit from 100 to 5000 for cleanup use cases
- Add optional `mode` query param: `browse` (default, limit 100) or `cleanup` (limit 5000)

**Response change:**
```typescript
{
  emails: EmailRecord[],
  pagination: {
    page, limit, total, totalPages, hasMore
  },
  filters,
  totalSizeBytes: number  // NEW: Total size of ALL matching emails (not just page)
}
```

### 1.2 Tasks

- [ ] Add `sumFilteredEmailsSize()` function to `emails-db.ts`
- [ ] Update explorer route to include `totalSizeBytes` in response
- [ ] Update limit validation: max 100 for browse mode, max 5000 for cleanup mode
- [ ] Update `ExplorerResponse` type in frontend `api.ts`

---

## Phase 2: Extract Reusable Components

### 2.1 Create Shared Types

**File:** `apps/web/src/components/domain/email-browser/types.ts`

```typescript
export interface EmailBrowserConfig {
  mode: 'explore' | 'cleanup';
  pageSize: number;
  showStorageInfo?: boolean;
}

export interface FilterPreset {
  id: string;
  label: string;
  filters: ExplorerFilters;
}
```

### 2.2 Extract Email Filters Component

**File:** `apps/web/src/components/domain/email-browser/EmailFilters.tsx`

Extract from ExplorerPage lines 468-652:
- Location/mailbox dropdown
- Search input
- Sender multi-select
- Category, Size, Status, Starred, Important, Attachments dropdowns
- Search/Clear buttons

Props:
```typescript
interface EmailFiltersProps {
  filters: ExplorerFilters;
  onFiltersChange: (filters: ExplorerFilters) => void;
  accountId: string;
  syncStatus: string;
  disabled?: boolean;
}
```

### 2.3 Extract Email Table Component

**File:** `apps/web/src/components/domain/email-browser/EmailTable.tsx`

Extract from ExplorerPage lines 269-809:
- Column definitions
- Table rendering with resizing
- Row selection
- Loading skeleton
- Empty states

Props:
```typescript
interface EmailTableProps {
  emails: EmailRecord[];
  isLoading: boolean;
  error: string | null;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
  columnSizing: ColumnSizingState;
  onColumnSizingChange: (sizing: ColumnSizingState) => void;
  emptyStateConfig?: {
    icon?: React.ReactNode;
    title: string;
    description: string;
    showClearFilters?: boolean;
    onClearFilters?: () => void;
  };
}
```

### 2.4 Extract Pagination Component

**File:** `apps/web/src/components/domain/email-browser/EmailPagination.tsx`

Extract from ExplorerPage lines 656-706:
- Page info text
- Navigation buttons

Props:
```typescript
interface EmailPaginationProps {
  pagination: ExplorerPagination | null;
  page: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  totalSizeBytes?: number;  // NEW: For cleanup mode
  showStorageInfo?: boolean;
}
```

### 2.5 Create Storage Info Component

**File:** `apps/web/src/components/domain/email-browser/StorageInfo.tsx`

Show storage that will be freed:
```typescript
interface StorageInfoProps {
  totalSizeBytes: number;
  totalCount: number;
}
```

Display: "Freeing 1.5 GB from 5,234 emails"

### 2.6 Tasks

- [ ] Create `apps/web/src/components/domain/email-browser/` directory
- [ ] Create `types.ts` with shared types
- [ ] Extract `EmailFilters.tsx`
- [ ] Extract `EmailTable.tsx`
- [ ] Extract `EmailPagination.tsx`
- [ ] Create `StorageInfo.tsx`
- [ ] Create `index.ts` barrel export

---

## Phase 3: Create Email Browser Hook

### 3.1 Enhance useExplorerEmails

**File:** `apps/web/src/hooks/useExplorerEmails.ts`

Add support for:
- Configurable page size
- `totalSizeBytes` in response
- Filter preset application

```typescript
interface UseExplorerEmailsOptions {
  pageSize?: number;  // Default 50
  mode?: 'browse' | 'cleanup';
}

interface UseExplorerEmailsResult {
  // ... existing fields
  totalSizeBytes: number | null;  // NEW
  applyPreset: (preset: FilterPreset) => void;  // NEW
}
```

### 3.2 Tasks

- [ ] Add `totalSizeBytes` to hook state
- [ ] Add configurable page size option
- [ ] Add `applyPreset()` function
- [ ] Update response parsing

---

## Phase 4: Refactor Explorer Page

### 4.1 Update ExplorerPage

**File:** `apps/web/src/components/domain/ExplorerPage.tsx`

Refactor to use extracted components:

```tsx
export function ExplorerPage({ ... }) {
  const { ... } = useExplorerEmails(accountId, { mode: 'browse' });

  return (
    <div>
      {/* Header */}
      <PageHeader title={t("explorer.title")} ... />

      {/* Sync Progress */}
      {isSyncing && <SyncProgress ... />}

      {/* Selection Actions */}
      {selectedIds.length > 0 && <SelectionActions ... />}

      {/* Filters */}
      <EmailFilters
        filters={filters}
        onFiltersChange={setFilters}
        accountId={accountId}
        syncStatus={syncStatus}
      />

      {/* Pagination */}
      <EmailPagination
        pagination={pagination}
        page={page}
        onPageChange={setPage}
      />

      {/* Table */}
      <EmailTable
        emails={emails}
        isLoading={isLoading}
        ...
      />
    </div>
  );
}
```

### 4.2 Tasks

- [ ] Refactor ExplorerPage to use EmailFilters
- [ ] Refactor ExplorerPage to use EmailTable
- [ ] Refactor ExplorerPage to use EmailPagination
- [ ] Verify all functionality works as before
- [ ] Test explorer page end-to-end

---

## Phase 5: Implement Cleanup Page

### 5.1 Define Filter Presets

**File:** `apps/web/src/components/domain/CleanupPage.tsx`

```typescript
const CLEANUP_PRESETS: Record<CleanupCategory, ExplorerFilters> = {
  promotions: { category: 'CATEGORY_PROMOTIONS', isTrash: false, isSpam: false },
  social: { category: 'CATEGORY_SOCIAL', isTrash: false, isSpam: false },
  updates: { category: 'CATEGORY_UPDATES', isTrash: false, isSpam: false },
  forums: { category: 'CATEGORY_FORUMS', isTrash: false, isSpam: false },
  old_2years: {
    dateTo: Date.now() - (2 * 365 * 24 * 60 * 60 * 1000),
    isTrash: false,
    isSpam: false
  },
  old_1year: {
    dateTo: Date.now() - (365 * 24 * 60 * 60 * 1000),
    isTrash: false,
    isSpam: false
  },
  large_10mb: { sizeMin: 10 * 1024 * 1024, isTrash: false, isSpam: false },
  large_5mb: { sizeMin: 5 * 1024 * 1024, isTrash: false, isSpam: false },
};
```

### 5.2 Update Cleanup Page Layout

```tsx
export function CleanupPage({ stats, syncProgress, isSyncing, accountId }) {
  const {
    emails,
    pagination,
    filters,
    setFilters,
    totalSizeBytes,
    ...
  } = useExplorerEmails(accountId, { mode: 'cleanup', pageSize: 50 });

  const [activePreset, setActivePreset] = useState<CleanupCategory | null>(null);

  const handleCardClick = (category: CleanupCategory) => {
    setActivePreset(category);
    setFilters(CLEANUP_PRESETS[category]);
  };

  return (
    <div className="space-y-6">
      {/* Header with Sync Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("cleanup.title")}</h1>
          <p className="text-muted-foreground">{t("cleanup.description")}</p>
        </div>
        <SyncStatusBar ... />
      </div>

      {/* Sync Progress (if syncing) */}
      {isSyncing && <SyncProgress ... />}

      {/* Quick Cleanup Cards */}
      <QuickExorcismSection
        stats={stats}
        syncProgress={syncProgress}
        isSyncing={isSyncing}
        selectable={false}  // Single click mode
        onExorcise={(categories) => handleCardClick(categories[0])}
      />

      {/* Storage Summary - when filters active */}
      {totalSizeBytes && (
        <StorageInfo
          totalSizeBytes={totalSizeBytes}
          totalCount={pagination?.total || 0}
        />
      )}

      {/* Filters */}
      <EmailFilters
        filters={filters}
        onFiltersChange={(f) => {
          setFilters(f);
          setActivePreset(null);  // Clear preset indicator
        }}
        accountId={accountId}
        syncStatus={syncStatus}
      />

      {/* Selection Actions */}
      {selectedIds.length > 0 && (
        <SelectionActions
          count={selectedIds.length}
          onTrash={handleTrash}
          isLoading={isTrashLoading}
        />
      )}

      {/* Pagination with Storage Info */}
      <EmailPagination
        pagination={pagination}
        page={page}
        onPageChange={setPage}
        totalSizeBytes={totalSizeBytes}
        showStorageInfo={true}
      />

      {/* Email Table */}
      <EmailTable
        emails={emails}
        isLoading={isLoading}
        ...
      />
    </div>
  );
}
```

### 5.3 Update QuickExorcismSection

Modify to support "click to filter" mode:
- When `selectable={false}`, clicking a card calls `onExorcise([category])`
- Parent handles this by applying filter preset

### 5.4 Tasks

- [ ] Define CLEANUP_PRESETS mapping
- [ ] Update CleanupPage layout
- [ ] Add header with sync status
- [ ] Integrate QuickExorcismSection with filter preset
- [ ] Add EmailFilters below cards
- [ ] Add StorageInfo component
- [ ] Add EmailPagination with storage info
- [ ] Add EmailTable
- [ ] Wire up card click -> filter application
- [ ] Add selection actions bar
- [ ] Add delete confirmation dialog
- [ ] Test all cleanup presets

---

## Phase 6: Polish & Testing

### 6.1 UI Improvements

- [ ] Add active state indicator on cleanup cards when filter is active
- [ ] Animate filter transitions
- [ ] Add "Clear preset" button when preset is active
- [ ] Show which preset is currently active in filters area

### 6.2 Testing

- [ ] Test all filter presets apply correctly
- [ ] Test pagination works with large page sizes
- [ ] Test storage calculation accuracy
- [ ] Test trash functionality
- [ ] Test sync status integration
- [ ] Cross-browser testing

---

## File Changes Summary

### New Files

```
apps/web/src/components/domain/email-browser/
├── index.ts
├── types.ts
├── EmailFilters.tsx
├── EmailTable.tsx
├── EmailPagination.tsx
└── StorageInfo.tsx
```

### Modified Files

```
apps/api/src/lib/emails-db.ts          # Add sumFilteredEmailsSize()
apps/api/src/routes/explorer.ts        # Add totalSizeBytes, update limits
apps/web/src/lib/api.ts                # Update ExplorerResponse type
apps/web/src/hooks/useExplorerEmails.ts # Add totalSizeBytes, presets
apps/web/src/components/domain/ExplorerPage.tsx  # Refactor to use shared components
apps/web/src/components/domain/CleanupPage.tsx   # Full implementation
apps/web/src/components/domain/QuickExorcismSection.tsx  # Minor updates
```

---

## Implementation Order

1. **Phase 1**: Backend API (totalSizeBytes, limits) - foundation
2. **Phase 2**: Extract components - no functional changes yet
3. **Phase 3**: Enhance hook - add new features
4. **Phase 4**: Refactor Explorer - use new components, verify no regression
5. **Phase 5**: Implement Cleanup - the main feature
6. **Phase 6**: Polish - final touches

Each phase should be a separate commit for easy rollback.

---

## Progress Tracking

- [x] **Phase 1**: Backend API Enhancements
- [x] **Phase 2**: Extract Reusable Components
- [x] **Phase 3**: Create Email Browser Hook
- [x] **Phase 4**: Refactor Explorer Page
- [x] **Phase 5**: Implement Cleanup Page
- [x] **Phase 6**: Polish & Testing

## Implementation Complete!

All phases have been implemented. The cleanup feature now:
- Shows quick cleanup cards at the top
- Clicking a card auto-applies the corresponding filter
- Shows total storage that can be freed
- Uses the same filter/table components as Explorer
- Supports selecting and trashing emails
