# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-12-17

### Added

- Initial public release
- Gmail OAuth integration with secure token storage
- Email sync supporting 100k+ emails
- Explorer page with advanced filtering:
  - Filter by sender, domain, category
  - Filter by date range, size, read/unread status
  - Filter by starred, important, attachments
  - Sort by date, size, sender
- Quick cleanup cards for common email categories:
  - Promotions, Social, Updates, Forums
  - Emails older than 1 year / 2 years
  - Large emails (5MB+, 10MB+)
  - Spam and Trash
- Bulk actions:
  - Move to Trash
  - Permanently delete with confirmation
  - Select all matching filters
- Subscription management:
  - View all senders with unsubscribe links
  - Filter by email count, size, date
  - One-click unsubscribe tracking
  - Bulk mark as unsubscribed
- Multiple Gmail account support
- Real-time sync progress tracking
- Self-hosted deployment options:
  - Single binary distribution
  - Docker with multiple profiles
  - Cloud platform templates (Railway, Render, Fly.io, DigitalOcean)
- SQLite (default) or PostgreSQL database support
- Automatic secret generation on first run
- Web-based setup UI for OAuth configuration
- Dark mode support
- Internationalization ready

### Security

- OAuth tokens encrypted at rest
- JWT-based session management
- No email content stored (metadata only)
- All data stays on user's machine

[Unreleased]: https://github.com/inboxorcist/inboxorcist/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/inboxorcist/inboxorcist/releases/tag/v0.1.0
