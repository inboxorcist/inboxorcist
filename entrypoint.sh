#!/bin/sh
set -e

echo ""
echo "=========================================="
echo "  Inboxorcist"
echo "  The power of delete compels you"
echo "=========================================="
echo ""

# =============================================================================
# Validate Required Environment Variables
# =============================================================================

ERRORS=""

# Check required variables
check_required() {
  var_name="$1"
  eval "value=\$$var_name"
  if [ -z "$value" ]; then
    ERRORS="${ERRORS}  - ${var_name} is not set\n"
  fi
}

# Required for app to function
check_required "JWT_SECRET"
check_required "ENCRYPTION_KEY"

# DATABASE_URL is optional - if not set, SQLite will be used

# Validate JWT_SECRET length (must be at least 32 characters)
if [ -n "$JWT_SECRET" ]; then
  jwt_length=$(printf '%s' "$JWT_SECRET" | wc -c)
  if [ "$jwt_length" -lt 32 ]; then
    ERRORS="${ERRORS}  - JWT_SECRET must be at least 32 characters (got ${jwt_length})\n"
  fi
fi

# Validate ENCRYPTION_KEY format (64 hex characters)
if [ -n "$ENCRYPTION_KEY" ]; then
  if ! echo "$ENCRYPTION_KEY" | grep -qE '^[a-fA-F0-9]{64}$'; then
    ERRORS="${ERRORS}  - ENCRYPTION_KEY must be a 64-character hex string\n"
    ERRORS="${ERRORS}    Generate with: openssl rand -hex 32\n"
  fi
fi

# Validate APP_URL is a valid URL if provided (optional)
if [ -n "$APP_URL" ]; then
  case "$APP_URL" in
    http://*|https://*)
      # Valid URL scheme
      ;;
    *)
      ERRORS="${ERRORS}  - APP_URL must be a valid URL (http:// or https://)\n"
      ;;
  esac
fi

# Exit if there are errors
if [ -n "$ERRORS" ]; then
  echo "ERROR: Environment configuration issues found:"
  echo ""
  printf "$ERRORS"
  echo ""
  echo "Required variables:"
  echo "  - JWT_SECRET (min 32 characters)"
  echo "  - ENCRYPTION_KEY (64 hex characters, generate with: openssl rand -hex 32)"
  echo ""
  echo "Optional variables:"
  echo "  - DATABASE_URL (PostgreSQL connection string, defaults to SQLite)"
  echo "  - GOOGLE_CLIENT_ID (can also be configured via /setup)"
  echo "  - GOOGLE_CLIENT_SECRET (can also be configured via /setup)"
  echo "  - APP_URL (for custom domains, defaults to http://localhost:PORT)"
  echo ""
  echo "See documentation at: https://inboxorcist.com/docs/configuration"
  echo ""
  echo "=========================================="
  exit 1
fi

# =============================================================================
# Setup
# =============================================================================

# Ensure data directory exists (created with correct ownership in Dockerfile)
# This is used for per-account email databases (SQLite)
mkdir -p /usr/src/app/data 2>/dev/null || true

# Note: Database migrations are now run automatically by the app on startup
# This simplifies the Docker build by removing the drizzle-kit dependency

# =============================================================================
# Display Configuration
# =============================================================================

echo "Configuration:"
if [ -n "$DATABASE_URL" ]; then
  echo "  Database:      PostgreSQL"
else
  echo "  Database:      SQLite (data/inboxorcist.db)"
fi

if [ -n "$GOOGLE_CLIENT_ID" ]; then
  echo "  Google OAuth:  Configured via environment"
else
  echo "  Google OAuth:  Not configured (visit /setup to configure)"
fi

echo "  Server:        http://localhost:${PORT:-6616}"
if [ -n "$APP_URL" ]; then
  echo "  Public URL:    $APP_URL"
fi
echo ""
echo "Starting server..."
echo "=========================================="
echo ""

# =============================================================================
# Execute Command
# =============================================================================

exec "$@"
