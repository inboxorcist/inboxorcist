# Security Policy

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in Inboxorcist, please report it responsibly.

### How to Report

**Please DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities via email:

**Email:** priyansh@inboxorcist.com

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### What to Expect

- **Acknowledgment:** Within 48 hours
- **Initial Assessment:** Within 7 days
- **Resolution Timeline:** Depends on severity, typically 30-90 days

### Severity Levels

| Level | Description | Example |
|-------|-------------|---------|
| Critical | Immediate risk to user data | Authentication bypass, remote code execution |
| High | Significant risk | SQL injection, XSS with sensitive data access |
| Medium | Limited risk | Information disclosure, CSRF |
| Low | Minimal risk | Minor information leaks |

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Previous minor | Security fixes only |
| Older versions | No |

## Security Best Practices

When self-hosting Inboxorcist:

1. **Keep updated** - Always run the latest version
2. **Secure your secrets** - Never commit `.env` files
3. **Use HTTPS** - Deploy behind a reverse proxy with TLS
4. **Restrict access** - Use firewall rules to limit exposure
5. **Regular backups** - Back up your database regularly

## Acknowledgments

We appreciate security researchers who help keep Inboxorcist secure. With your permission, we'll acknowledge your contribution in our release notes.

## Scope

This security policy applies to:

- The Inboxorcist application (apps/api, apps/web)
- Official Docker images
- Official binary releases

Third-party deployments and modifications are not covered.
