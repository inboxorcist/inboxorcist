# Gmail Sync Algorithm

> Design document for syncing email metadata from Gmail accounts.

---

## Overview

**Two-step sync** for optimal UX:
1. **Quick Stats** (5-15 sec) → Dashboard usable immediately
2. **Full Metadata** (background) → Enables cleanup view + top senders

Sync fetches **metadata only** (sender, date, size, labels) - never email body.

---

## Two-Step Sync Flow

```
User connects Gmail account
            │
            ▼
┌───────────────────────────────────────────────────────────┐
│  STEP 1: Quick Stats (~5-15 seconds)                      │
│  ────────────────────────────────────                     │
│  Uses messages.list with query filters to get counts      │
│  ~12 parallel API calls                                   │
│                                                           │
│  Returns:                                                 │
│  • Total email count                                      │
│  • Category counts (Promotions, Social, Updates, Forums)  │
│  • Large emails count (>5MB, >10MB)                       │
│  • Old emails count (>1yr, >2yr)                          │
│  • Unread count                                           │
│                                                           │
│  → Dashboard becomes usable                               │
└───────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────┐
│  STEP 2: Full Metadata Sync (background, 45-90 min)       │
│  ──────────────────────────────────────────────────       │
│  Fetches all message details via messages.get             │
│  Stores in SQLite file per account                        │
│                                                           │
│  Enables:                                                 │
│  • Top senders list (aggregated)                          │
│  • Cleanup view with filters                              │
│  • Instant local queries                                  │
│                                                           │
│  → Runs while user explores dashboard                     │
└───────────────────────────────────────────────────────────┘
```

---

## UX Timeline

| Time | What User Sees | Backend Status |
|------|----------------|----------------|
| 0s | "Connecting..." | OAuth complete |
| 2-5s | "Scanning inbox..." | Step 1 running |
| 5-15s | Dashboard with stats | Step 1 complete |
| 15s+ | "Top Senders: Calculating..." | Step 2 in background |
| 15s+ | "Cleanup View: Preparing..." | Step 2 in background |
| 45-90min | Full dashboard unlocked | Step 2 complete |

---

## Gmail API Limits

### Quota Costs

| Operation | Units | Notes |
|-----------|-------|-------|
| `messages.list` | 5 | Max 500 IDs per call |
| `messages.get` | 5 | Full message or metadata |
| `messages.trash` | 5 | Move to trash |
| `messages.batchDelete` | 50 | Permanent delete |
| `messages.modify` | 5 | Change labels |
| `users.getProfile` | 1 | Get email/storage info |

### Rate Limits

| Limit | Value |
|-------|-------|
| Per-user rate | 250 quota units/second |
| Daily per-project | 1,000,000,000 units |
| Batch API max | 100 requests per batch |

### Throughput Calculation

```
messages.get: 5 units each
Rate limit: 250 units/second
Max throughput: 250 / 5 = 50 messages/second

100k emails:
- Theoretical: 100,000 / 50 = 2,000 sec = 33 min
- Real-world: 45-90 min (rate limits, backoff, retries)
```

---

## Step 1: Quick Stats

### Purpose

Get dashboard stats instantly using `messages.list` with query filters. Each call returns `resultSizeEstimate` which gives the count without fetching actual messages.

### Algorithm

```
getQuickStats(accountId):

    gmail = getAuthenticatedClient(accountId)

    // All queries run in parallel (~12 calls)
    results = await Promise.all([

        // Total emails
        gmail.messages.list(
            maxResults = 1,
            includeSpamTrash = false
        ),

        // Categories
        gmail.messages.list(q = "category:promotions", maxResults = 1),
        gmail.messages.list(q = "category:social", maxResults = 1),
        gmail.messages.list(q = "category:updates", maxResults = 1),
        gmail.messages.list(q = "category:forums", maxResults = 1),
        gmail.messages.list(q = "category:primary", maxResults = 1),

        // Size-based
        gmail.messages.list(q = "larger:5M", maxResults = 1),
        gmail.messages.list(q = "larger:10M", maxResults = 1),

        // Age-based
        gmail.messages.list(q = "older_than:1y", maxResults = 1),
        gmail.messages.list(q = "older_than:2y", maxResults = 1),

        // Status
        gmail.messages.list(q = "is:unread", maxResults = 1),

        // Profile info
        gmail.users.getProfile()
    ])

    // Extract resultSizeEstimate from each response
    RETURN {
        total: results[0].resultSizeEstimate,
        categories: {
            promotions: results[1].resultSizeEstimate,
            social: results[2].resultSizeEstimate,
            updates: results[3].resultSizeEstimate,
            forums: results[4].resultSizeEstimate,
            primary: results[5].resultSizeEstimate
        },
        size: {
            larger5MB: results[6].resultSizeEstimate,
            larger10MB: results[7].resultSizeEstimate
        },
        age: {
            olderThan1Year: results[8].resultSizeEstimate,
            olderThan2Years: results[9].resultSizeEstimate
        },
        unread: results[10].resultSizeEstimate,
        storageUsed: results[11].messagesTotal
    }
```

### Cost Analysis

```
12 API calls × 5 units = 60 quota units
At 250 units/sec = 0.24 seconds of quota

With network latency: ~2-5 seconds total
```

### Storage

Stats are cached in main DB on `gmail_accounts`:

```
gmail_accounts (additions for stats)
├── stats_json          -- JSON blob of quick stats
├── stats_fetched_at    -- When stats were last fetched
```

Stats can be refreshed on-demand without re-syncing full metadata.

---

## Step 2: Full Metadata Sync

### Purpose

Fetch all message details to enable:
- Top senders aggregation
- Cleanup view with filters
- Instant local queries

### Storage Architecture

Each account gets its own SQLite file:

```
Self-hosted:
  data/
    {accountId}/
      emails.db        <- SQLite file

Cloud (future):
  s3://{bucket}/{userId}/{accountId}/emails.db
```

### SQLite Schema

```
emails.db
├── emails
│   ├── gmail_id        TEXT PK
│   ├── thread_id       TEXT
│   ├── subject         TEXT
│   ├── snippet         TEXT
│   ├── from_email      TEXT NOT NULL
│   ├── from_name       TEXT
│   ├── labels          TEXT         -- JSON array
│   ├── category        TEXT         -- CATEGORY_PROMOTIONS, etc.
│   ├── size_bytes      INTEGER
│   ├── has_attachments INTEGER      -- 0/1
│   ├── is_unread       INTEGER      -- 0/1
│   ├── is_starred      INTEGER      -- 0/1
│   ├── internal_date   INTEGER      -- Unix timestamp ms
│   └── synced_at       INTEGER
│
├── senders (computed after sync completes)
│   ├── email           TEXT PK
│   ├── name            TEXT
│   ├── count           INTEGER
│   └── total_size      INTEGER
│
└── INDEXES
    ├── idx_from_email
    ├── idx_category
    ├── idx_internal_date
    ├── idx_size_bytes
    └── idx_is_unread
```

### Main DB Schema (sync tracking)

```
gmail_accounts (additions for sync)
├── sync_status        -- 'idle' | 'stats_only' | 'syncing' | 'completed' | 'error'
├── sync_started_at
├── sync_completed_at
├── total_emails       -- Cached count
├── history_id         -- For incremental sync (future)
└── sync_error
```

### Algorithm

```
startFullSync(accountId):

    // Check no active sync
    IF active sync exists for accountId:
        RETURN existing job

    // Create job
    job = INSERT INTO jobs (
        gmail_account_id = accountId,
        type = 'metadata_sync',
        status = 'pending',
        total_messages = account.stats.total,  // From Step 1
        processed_messages = 0
    )

    UPDATE gmail_accounts
    SET sync_status = 'syncing', sync_started_at = NOW()
    WHERE id = accountId

    // Enqueue for background processing
    queue.add('metadata_sync', { jobId: job.id, accountId })

    RETURN job


processMetadataSync(jobId):

    job = getJob(jobId)
    accountId = job.gmail_account_id

    TRY:
        UPDATE job SET status = 'running', started_at = NOW()

        // Initialize SQLite
        sqliteDb = openOrCreate("data/{accountId}/emails.db")
        createTablesIfNotExist(sqliteDb)
        sqliteDb.run("DELETE FROM emails")  // Full re-sync

        gmail = getAuthenticatedClient(accountId)
        pageToken = job.next_page_token  // For resume
        processedCount = job.processed_messages

        WHILE true:
            // Yield to event loop
            await setImmediate()

            // Check cancellation
            IF job.status == 'cancelled':
                RETURN

            // Fetch page of IDs
            response = gmail.messages.list(
                maxResults = 500,
                pageToken = pageToken,
                includeSpamTrash = false,
                fields = "messages(id),nextPageToken,resultSizeEstimate"
            )

            IF response.messages is empty:
                BREAK

            // Fetch details in batches
            emails = fetchMessageDetails(gmail, response.messages)

            // Insert to SQLite
            batchInsert(sqliteDb, emails)

            // Update progress
            processedCount += response.messages.length
            pageToken = response.nextPageToken

            UPDATE job SET
                processed_messages = processedCount,
                next_page_token = pageToken

            IF pageToken is null:
                BREAK

        // Build sender aggregates
        sqliteDb.run("
            INSERT INTO senders (email, name, count, total_size)
            SELECT from_email,
                   MAX(from_name),
                   COUNT(*),
                   SUM(size_bytes)
            FROM emails
            GROUP BY from_email
            ORDER BY COUNT(*) DESC
        ")

        // Complete
        UPDATE job SET status = 'completed', completed_at = NOW()
        UPDATE gmail_accounts SET sync_status = 'completed'

    CATCH error:
        handleSyncError(jobId, accountId, error)
```

### Batch Message Fetching

```
fetchMessageDetails(gmail, messageIds):

    BATCH_SIZE = 50
    results = []

    FOR chunk IN messageIds.chunked(BATCH_SIZE):

        await setImmediate()  // Yield

        // Parallel fetch with retry
        chunkResults = await Promise.all(
            chunk.map(id =>
                withRetry(() =>
                    gmail.messages.get(
                        id = id,
                        format = "metadata",
                        metadataHeaders = ["From", "To", "Subject"]
                    )
                )
            )
        )

        FOR msg IN chunkResults:
            IF msg.error:
                log("Failed: {msg.id}")
                CONTINUE
            results.append(parseMessage(msg))

        await throttle.wait()

    RETURN results
```

### Message Parsing

```
parseMessage(msg):

    headers = msg.payload.headers
    fromHeader = getHeader(headers, "From")
    fromEmail, fromName = parseEmailAddress(fromHeader)
    labels = msg.labelIds

    RETURN {
        gmail_id: msg.id,
        thread_id: msg.threadId,
        subject: getHeader(headers, "Subject"),
        snippet: msg.snippet,
        from_email: fromEmail,
        from_name: fromName,
        labels: JSON.stringify(labels),
        category: findCategory(labels),
        size_bytes: msg.sizeEstimate,
        has_attachments: hasAttachments(msg),
        is_unread: "UNREAD" in labels,
        is_starred: "STARRED" in labels,
        internal_date: parseInt(msg.internalDate),
        synced_at: Date.now()
    }


findCategory(labels):
    FOR label IN labels:
        IF label STARTS WITH "CATEGORY_":
            RETURN label
    RETURN null


parseEmailAddress(header):
    // "John Doe <john@example.com>" → (john@example.com, John Doe)
    // "<john@example.com>" → (john@example.com, null)
    // "john@example.com" → (john@example.com, null)

    match = header.match(/"?([^"<]*)"?\s*<?([^\s<>]+@[^\s<>]+)>?/)
    IF match:
        RETURN (match[2].toLowerCase(), match[1].trim() or null)
    RETURN (header.toLowerCase(), null)
```

---

## Dashboard States

```
STATE 1: Before Step 1
┌─────────────────────────────────────────┐
│  Scanning your inbox...                 │
│  [skeleton cards]                       │
└─────────────────────────────────────────┘

STATE 2: After Step 1, During Step 2
┌─────────────────────────────────────────┐
│  👻 78,432 total emails                 │  ✓ From Step 1
│                                         │
│  Quick Exorcisms:                       │
│  ┌─────────────┐ ┌─────────────┐       │
│  │ Promotions  │ │ Older than  │       │
│  │ 15,892      │ │ 2 years     │       │  ✓ From Step 1
│  │ [Exorcise→] │ │ 23,421      │       │
│  └─────────────┘ └─────────────┘       │
│                                         │
│  Top Senders:                           │
│  [Syncing... 34%] ████████░░░░░        │  ⏳ Needs Step 2
│                                         │
│  [Advanced Cleanup - Syncing...]        │  ⏳ Needs Step 2
└─────────────────────────────────────────┘

STATE 3: After Step 2 Complete
┌─────────────────────────────────────────┐
│  All features unlocked                  │
│  • Top senders visible                  │
│  • Advanced cleanup ready               │
└─────────────────────────────────────────┘
```

---

## Non-Blocking Execution

### Why It Matters

Bun/Node.js is single-threaded. Long-running sync blocks:
- HTTP server (health checks fail)
- Other requests
- WebSocket connections

### Strategies

1. **Yield between pages**
   ```
   await setImmediate()
   ```

2. **Yield between batch inserts**
   ```
   FOR chunk IN records.chunked(100):
       sqliteDb.run(INSERT...)
       await setImmediate()
   ```

3. **Adaptive throttling**
   - Base delay: 100ms between batches
   - On 429: double delay, backoff period
   - On success streak: reduce delay (min 50ms)

---

## Error Handling

### Retry Logic

```
withRetry(fn, maxRetries=5, baseDelay=1000):

    FOR attempt IN 0..maxRetries:
        TRY:
            RETURN await fn()
        CATCH error:
            IF NOT isRetryable(error) OR attempt == maxRetries:
                THROW error

            delay = baseDelay * (2 ^ attempt)
            delay = min(delay, 60000)
            delay = delay * (0.75 + random() * 0.5)  // Jitter

            await sleep(delay)


isRetryable(error):
    // Retry
    IF error.code == 429: RETURN true      // Rate limit
    IF error.code >= 500: RETURN true      // Server error
    IF error.code IN [ECONNRESET, ETIMEDOUT]: RETURN true

    // Don't retry
    IF error.code == 401: RETURN false     // Auth expired
    IF error.code == 403: RETURN false     // Permission denied
    RETURN false
```

### Job-Level Retries

```
handleSyncError(jobId, accountId, error):

    job = getJob(jobId)
    retryCount = job.retry_count + 1

    // Auth expired - user action needed
    IF error.code == 401:
        UPDATE job SET status = 'failed', last_error = "Token expired"
        UPDATE gmail_accounts SET sync_status = 'error'
        RETURN

    // Retryable - re-queue
    IF isRetryable(error) AND retryCount <= 3:
        delay = (2 ^ retryCount) * 60 seconds

        UPDATE job SET status = 'pending', retry_count = retryCount
        queue.add('metadata_sync', { jobId }, { delay })
        RETURN

    // Permanent failure
    UPDATE job SET status = 'failed', last_error = error.message
    UPDATE gmail_accounts SET sync_status = 'error'
```

---

## Adaptive Rate Limiting

```
AdaptiveThrottle:
    minDelay = 50ms
    currentDelay = 100ms
    maxDelay = 5000ms
    backoffUntil = 0
    successes = 0

    wait():
        IF backoffUntil > now():
            await sleep(backoffUntil - now())
        ELSE:
            await sleep(currentDelay)

    onSuccess():
        successes++
        IF successes > 5:
            currentDelay = max(minDelay, currentDelay * 0.9)

    onRateLimit(retryAfter):
        successes = 0
        backoffUntil = now() + (retryAfter or 60000)
        currentDelay = min(maxDelay, currentDelay * 2)
```

---

## Progress Tracking

```
calculateProgress(job):
    processed = job.processed_messages
    total = job.total_messages or 1
    percentage = min(100, round(processed / total * 100))

    // ETA
    eta = null
    IF job.started_at AND processed > 0:
        elapsed = now() - job.started_at
        remaining = (elapsed / processed) * (total - processed)
        eta = formatDuration(remaining)

    // Phase message
    phase = SWITCH percentage:
        < 20:  "Scanning for spirits..."
        < 50:  "Unearthing the dead..."
        < 80:  "Cataloging the damned..."
        < 100: "Preparing the ritual..."
        else:  "The spirits are revealed."

    RETURN { status, processed, total, percentage, eta, phase }
```

---

## Resumability

Sync is resumable because:
- `next_page_token` stored in job
- `processed_messages` tracked
- SQLite file persists partial data

```
resumeSync(accountId):
    job = SELECT FROM jobs
          WHERE gmail_account_id = accountId
          AND type = 'metadata_sync'
          AND status IN ('failed', 'paused')
          ORDER BY created_at DESC
          LIMIT 1

    IF not job: THROW "No sync to resume"

    UPDATE job SET status = 'pending'
    queue.add('metadata_sync', { jobId: job.id })
```

---

## Job Queue

### Interface

```
Queue:
    add(type, data, options?) → jobId
    process(type, handler)
```

### BullMQ (with Redis)
- Use when `REDIS_URL` is set
- Survives restarts
- Max 3 concurrent syncs

### In-Memory (fallback)
- No Redis required
- Jobs lost on restart (resume from DB)
- Same concurrency limit

---

## API Endpoints

```
GET /api/gmail/accounts/:accountId/stats
    - Triggers Step 1 if not cached
    - Returns quick stats
    - { total, categories, size, age, unread }

POST /api/gmail/accounts/:accountId/sync
    - Starts Step 2 (full metadata sync)
    - Returns { jobId, status: 'started' }

GET /api/gmail/accounts/:accountId/sync
    - Returns sync progress
    - { status, processed, total, percentage, eta, phase }

DELETE /api/gmail/accounts/:accountId/sync
    - Cancels active sync

POST /api/gmail/accounts/:accountId/sync/resume
    - Resumes failed sync

GET /api/gmail/accounts/:accountId/stats/refresh
    - Forces Step 1 refresh (ignores cache)
```

---

## Performance Summary

| Step | Time | API Calls | Quota Units |
|------|------|-----------|-------------|
| Step 1 (Stats) | 5-15 sec | ~12 | ~60 |
| Step 2 (100k emails) | 45-90 min | ~100,200 | ~501,000 |

---

## Feature Availability Matrix

| Feature | After Step 1 | After Step 2 |
|---------|--------------|--------------|
| Total email count | ✓ | ✓ |
| Category counts | ✓ | ✓ |
| Size-based counts | ✓ | ✓ |
| Age-based counts | ✓ | ✓ |
| Unread count | ✓ | ✓ |
| Quick exorcism cards | ✓ | ✓ |
| Top senders list | ✗ | ✓ |
| Advanced cleanup view | ✗ | ✓ |
| Custom filter queries | ✗ | ✓ |

---

## Summary

| Component | Approach |
|-----------|----------|
| **Step 1** | messages.list with queries, parallel calls |
| **Step 2** | messages.get in batches, SQLite storage |
| **Storage** | SQLite file per account |
| **Job Queue** | BullMQ or in-memory |
| **Non-blocking** | setImmediate() yield |
| **Retries** | Exponential backoff + jitter |
| **Resumability** | Via stored pageToken |

---

## Implementation Plan

### Phase 1: Schema Updates

| Task | File(s) | Description |
|------|---------|-------------|
| 1.1 | `db/schema.*.ts` | Add sync fields to `gmail_accounts` table |
| 1.2 | `db/schema.*.ts` | Add `sync` type to jobs table |
| 1.3 | `lib/emails-db.ts` | Create SQLite helper for per-account emails.db |
| 1.4 | Run migrations | Apply schema changes |

**Schema additions for `gmail_accounts`:**
- `sync_status` (idle/stats_only/syncing/completed/error)
- `sync_started_at`
- `sync_completed_at`
- `total_emails`
- `stats_json`
- `stats_fetched_at`
- `history_id`
- `sync_error`

### Phase 2: Gmail Service Layer

| Task | File(s) | Description |
|------|---------|-------------|
| 2.1 | `services/gmail.ts` | Create Gmail API wrapper service |
| 2.2 | `services/gmail.ts` | Implement `getQuickStats()` - Step 1 |
| 2.3 | `services/gmail.ts` | Implement `fetchMessageDetails()` |
| 2.4 | `services/gmail.ts` | Implement `parseMessage()` helper |
| 2.5 | `lib/throttle.ts` | Create AdaptiveThrottle class |
| 2.6 | `lib/retry.ts` | Create `withRetry()` utility |

### Phase 3: Job Queue

| Task | File(s) | Description |
|------|---------|-------------|
| 3.1 | `services/queue/types.ts` | Define Queue interface |
| 3.2 | `services/queue/memory.ts` | Implement in-memory queue |
| 3.3 | `services/queue/bullmq.ts` | Implement BullMQ queue (optional) |
| 3.4 | `services/queue/index.ts` | Auto-select queue based on REDIS_URL |

### Phase 4: Sync Worker

| Task | File(s) | Description |
|------|---------|-------------|
| 4.1 | `services/sync/worker.ts` | Create sync job processor |
| 4.2 | `services/sync/worker.ts` | Implement pagination loop |
| 4.3 | `services/sync/worker.ts` | Implement batch fetching |
| 4.4 | `services/sync/worker.ts` | Implement SQLite writes |
| 4.5 | `services/sync/worker.ts` | Build sender aggregates |
| 4.6 | `services/sync/worker.ts` | Implement error handling |
| 4.7 | `services/sync/progress.ts` | Create progress calculator |

### Phase 5: API Routes

| Task | File(s) | Description |
|------|---------|-------------|
| 5.1 | `routes/gmail.ts` | `GET /accounts/:id/stats` |
| 5.2 | `routes/gmail.ts` | `GET /accounts/:id/stats/refresh` |
| 5.3 | `routes/gmail.ts` | `POST /accounts/:id/sync` |
| 5.4 | `routes/gmail.ts` | `GET /accounts/:id/sync` (progress) |
| 5.5 | `routes/gmail.ts` | `DELETE /accounts/:id/sync` (cancel) |
| 5.6 | `routes/gmail.ts` | `POST /accounts/:id/sync/resume` |

### Phase 6: Auto-Trigger

| Task | File(s) | Description |
|------|---------|-------------|
| 6.1 | `routes/oauth.ts` | Trigger Step 1 after OAuth callback |
| 6.2 | `routes/oauth.ts` | Auto-start Step 2 after Step 1 |
| 6.3 | `index.ts` | Initialize queue workers on startup |

### Phase 7: Frontend Integration

| Task | File(s) | Description |
|------|---------|-------------|
| 7.1 | `hooks/useStats.ts` | Fetch and cache stats |
| 7.2 | `hooks/useSyncProgress.ts` | Poll sync progress |
| 7.3 | `components/SyncProgress.tsx` | Progress bar component |
| 7.4 | `pages/Dashboard.tsx` | Display stats from Step 1 |
| 7.5 | `pages/Dashboard.tsx` | Show sync progress indicator |

---

## Progress Tracker

### Phase 1: Schema Updates
- [x] 1.1 Add sync fields to gmail_accounts
- [x] 1.2 Add sync type to jobs
- [x] 1.3 Create emails-db helper
- [x] 1.4 Run migrations (generated, user will push manually)

### Phase 2: Gmail Service Layer
- [x] 2.1 Create Gmail API wrapper
- [x] 2.2 Implement getQuickStats()
- [x] 2.3 Implement fetchMessageDetails()
- [x] 2.4 Implement parseMessage()
- [x] 2.5 Create AdaptiveThrottle
- [x] 2.6 Create withRetry()

### Phase 3: Job Queue
- [x] 3.1 Define Queue interface
- [x] 3.2 Implement in-memory queue
- [x] 3.3 Implement BullMQ queue
- [x] 3.4 Auto-select queue

### Phase 4: Sync Worker
- [x] 4.1 Create sync job processor
- [x] 4.2 Implement pagination loop
- [x] 4.3 Implement batch fetching
- [x] 4.4 Implement SQLite writes
- [x] 4.5 Build sender aggregates
- [x] 4.6 Implement error handling
- [x] 4.7 Create progress calculator

### Phase 5: API Routes
- [x] 5.1 GET /accounts/:id/stats
- [x] 5.2 GET /accounts/:id/stats/refresh
- [x] 5.3 POST /accounts/:id/sync
- [x] 5.4 GET /accounts/:id/sync
- [x] 5.5 DELETE /accounts/:id/sync
- [x] 5.6 POST /accounts/:id/sync/resume

### Phase 6: Auto-Trigger
- [x] 6.1 Trigger Step 1 after OAuth
- [x] 6.2 Auto-start Step 2 after Step 1
- [x] 6.3 Initialize workers on startup

### Phase 7: Frontend Integration
- [x] 7.1 Create useStats hook
- [x] 7.2 Create useSyncProgress hook
- [x] 7.3 Create SyncProgress component
- [x] 7.4 Display stats on Dashboard
- [x] 7.5 Show sync progress indicator

---

## File Structure (After Implementation)

```
apps/api/src/
├── db/
│   ├── index.ts              # Main DB connection
│   ├── schema.pg.ts          # Updated with sync fields
│   └── schema.sqlite.ts      # Updated with sync fields
├── lib/
│   ├── encryption.ts         # Existing
│   ├── id.ts                 # Existing
│   ├── emails-db.ts          # NEW: Per-account SQLite helper
│   ├── throttle.ts           # NEW: Adaptive rate limiting
│   └── retry.ts              # NEW: Retry with backoff
├── services/
│   ├── oauth.ts              # Existing
│   ├── gmail.ts              # NEW: Gmail API wrapper
│   ├── queue/
│   │   ├── index.ts          # NEW: Queue factory
│   │   ├── types.ts          # NEW: Queue interface
│   │   ├── memory.ts         # NEW: In-memory queue
│   │   └── bullmq.ts         # NEW: BullMQ implementation
│   └── sync/
│       ├── worker.ts         # NEW: Sync job processor
│       └── progress.ts       # NEW: Progress calculator
├── routes/
│   ├── oauth.ts              # Updated: trigger sync
│   └── gmail.ts              # NEW: Stats & sync endpoints
└── index.ts                  # Updated: init workers

apps/web/src/
├── hooks/
│   ├── useGmailAccounts.ts   # Existing
│   ├── useStats.ts           # NEW
│   └── useSyncProgress.ts    # NEW
├── components/
│   └── SyncProgress.tsx      # NEW
└── pages/
    └── Dashboard.tsx         # NEW or updated

data/
└── {accountId}/
    └── emails.db             # SQLite per account
```

---

## Dependencies to Add

```bash
# Job queue (optional, for Redis support)
bun add bullmq ioredis

# SQLite for per-account storage (already have better-sqlite3)
# No new deps needed
```

---

## Testing Checklist

### Step 1: Quick Stats
- [ ] Stats return within 15 seconds
- [ ] All category counts are accurate
- [ ] Stats are cached in DB
- [ ] Refresh endpoint works

### Step 2: Full Metadata Sync
- [ ] Sync starts automatically after OAuth
- [ ] Progress updates in real-time
- [ ] Sync can be cancelled
- [ ] Sync can be resumed after failure
- [ ] SQLite file is created correctly
- [ ] Sender aggregates are computed
- [ ] Works with 1k emails
- [ ] Works with 10k emails
- [ ] Works with 100k emails (if available)

### Error Handling
- [ ] 429 rate limit triggers backoff
- [ ] 401 marks sync as failed (token expired)
- [ ] Network errors retry automatically
- [ ] Job retries up to 3 times

### Non-Blocking
- [ ] Health endpoint responds during sync
- [ ] Multiple syncs can run concurrently
- [ ] Server doesn't freeze during large sync
