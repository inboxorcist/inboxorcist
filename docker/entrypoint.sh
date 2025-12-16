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

check_required "GOOGLE_CLIENT_ID"
check_required "GOOGLE_CLIENT_SECRET"
check_required "JWT_SECRET"
check_required "ENCRYPTION_KEY"

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

# Validate APP_URL is a valid URL if provided
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
  echo "Please check your environment variables."
  echo "See documentation at: https://github.com/inboxorcist/inboxorcist#environment-variables"
  echo ""
  echo "=========================================="
  exit 1
fi

# =============================================================================
# Setup
# =============================================================================

# Ensure data directory exists with correct permissions
mkdir -p /usr/src/app/data
chmod 755 /usr/src/app/data

# =============================================================================
# Display Configuration
# =============================================================================

echo "Configuration:"
echo "  Database: ${DATABASE_URL:-PostgreSQL (bundled)}"
echo "  Server:   http://localhost:6616"
echo ""
echo "Starting server..."
echo "=========================================="
echo ""

# =============================================================================
# Execute Command
# =============================================================================

exec "$@"
