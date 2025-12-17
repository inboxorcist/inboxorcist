# Contributing to Inboxorcist

Thank you for your interest in contributing to Inboxorcist! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

When filing a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs what actually happened
- **Screenshots** if applicable
- **Environment details:**
  - OS (e.g., macOS 14, Ubuntu 22.04, Windows 11)
  - Browser (e.g., Chrome 120, Firefox 121)
  - Deployment method (binary, Docker, cloud platform)
  - Inboxorcist version

### Suggesting Features

Feature requests are welcome! Please:

1. Check if the feature has already been requested
2. Open a new issue with the "Feature Request" template
3. Describe the problem you're trying to solve
4. Explain your proposed solution
5. Consider alternatives you've thought about

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies:** `bun install`
3. **Make your changes** following our code style
4. **Test your changes** locally
5. **Run linting:** `bun run lint`
6. **Run formatting:** `bun run format`
7. **Commit your changes** with a clear message
8. **Push to your fork** and open a Pull Request

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- Node.js 20+ (for some tooling)

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/inboxorcist.git
cd inboxorcist

# Install dependencies
bun install

# Copy environment file
cp apps/api/.env.example apps/api/.env

# Run database migrations
bun run db:migrate

# Start development servers
bun run dev
```

- API runs at http://localhost:6616
- Web dev server runs at http://localhost:3000

### Project Structure

```
inboxorcist/
├── apps/
│   ├── api/          # Hono backend (Bun)
│   ├── web/          # React frontend (Vite)
│   └── docs/         # Documentation (Fumadocs)
├── Dockerfile        # Docker configuration
├── docker-compose.yml
├── scripts/          # Build and helper scripts
└── docs/             # Legacy markdown docs
```

## Code Style

### General Guidelines

- Use TypeScript for all new code
- Avoid `any` types - use proper typing
- Keep functions small and focused
- Write self-documenting code with clear variable names

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(explorer): add bulk delete confirmation dialog
fix(sync): handle Gmail API rate limits correctly
docs: update deployment guide for Railway
```

### File Naming

- Components: `PascalCase.tsx` (e.g., `EmailTable.tsx`)
- Hooks: `useCamelCase.ts` (e.g., `useEmailActions.ts`)
- Utilities: `camelCase.ts` (e.g., `filterUrl.ts`)
- Routes/services: `camelCase.ts` (e.g., `explorer.ts`)

## Testing

Currently, we don't have automated tests. If you're adding tests:

- Place test files next to the code they test
- Use `.test.ts` or `.spec.ts` suffix
- Focus on critical paths and edge cases

## Documentation

- Update relevant docs when changing functionality
- Documentation site source is in `apps/docs/`
- Use clear, concise language
- Include code examples where helpful

## Review Process

1. All PRs require at least one approval
2. CI checks must pass (lint, build)
3. Maintainers may request changes
4. Once approved, maintainers will merge

## Questions?

- Open a [Discussion](https://github.com/inboxorcist/inboxorcist/discussions) for questions
- Check our [Documentation](https://inboxorcist.com/docs) for guides
- Review existing issues for similar problems

## Recognition

Contributors will be recognized in our release notes. Thank you for helping make Inboxorcist better!
