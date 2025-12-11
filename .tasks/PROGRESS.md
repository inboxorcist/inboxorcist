# Inboxorcist - Development Progress

## Completed

### Phase 1: Project Setup
- [x] Monorepo structure with Bun workspaces
- [x] API with Hono
- [x] Web with React 19 + Vite + TailwindCSS + shadcn/ui
- [x] TypeScript configuration

### Phase 2: Database
- [x] Drizzle ORM integration
- [x] Dual database support (Postgres / SQLite fallback)
- [x] Schema with multi-user support (`user_id` field)
- [x] nanoid for IDs (alphanumeric)
- [x] Tables: `gmail_accounts`, `oauth_tokens`, `jobs`
- [x] Migration scripts (`db:generate`, `db:push`, `db:studio`)

### Phase 3: Gmail OAuth
- [x] Google OAuth2 flow
- [x] Token encryption (AES-256-GCM)
- [x] Token auto-refresh
- [x] Multi-account support per user
- [x] Frontend OAuth UI
- [x] Account connection/disconnection

---

## In Progress

### Phase 4: Gmail API Integration
- [ ] Fetch email statistics (counts by category/label)
- [ ] List emails with filters
- [ ] Gmail label management

---

## Pending

### Phase 5: Email Cleanup
- [ ] Batch delete emails (max 1000 per request)
- [ ] Trash emails
- [ ] Empty trash ("Holy water")
- [ ] Exponential backoff for rate limits
- [ ] Progress tracking

### Phase 6: Job System
- [ ] Job queue (BullMQ with Redis / in-memory fallback)
- [ ] Job creation and management
- [ ] Resumable jobs (pagination state)
- [ ] Job progress UI
- [ ] Job history

### Phase 7: UI/UX
- [ ] Dashboard with email statistics
- [ ] Category selection (Promotions, Social, Updates)
- [ ] Preview emails before deletion
- [ ] Real-time job progress
- [ ] Dark mode

### Phase 8: Docker & Deployment
- [ ] Dockerfile
- [ ] docker-compose.yml
- [ ] Environment configuration
- [ ] Single-command deployment

### Phase 9: Polish
- [ ] Error handling improvements
- [ ] Loading states
- [ ] Toast notifications
- [ ] Mobile responsiveness
- [ ] Documentation

---

## Future (Cloud Version)
- [ ] User authentication
- [ ] Users table
- [ ] Auto-delete rules ("Wards")
- [ ] Billing integration
