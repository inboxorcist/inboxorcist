import { Hono } from 'hono'
import {
  getConfig,
  setConfig,
  isSetupRequired,
  isSetupCompleted,
  markSetupCompleted,
  type ConfigKey,
} from '../services/config'

const app = new Hono()

/**
 * GET /api/setup/status
 * Check if setup is required and get current configuration state
 *
 * Response:
 * - setupRequired: true if Google credentials are not configured
 * - setupCompleted: true if setup has been marked as done
 * - config: object with each config key's status (not the actual values for secrets)
 */
app.get('/status', async (c) => {
  const setupRequired = await isSetupRequired()
  const setupCompleted = await isSetupCompleted()

  // Get config status for each key (don't expose secret values)
  const googleClientId = await getConfig('google_client_id')
  const googleClientSecret = await getConfig('google_client_secret')
  const appUrl = await getConfig('app_url')

  return c.json({
    setupRequired,
    setupCompleted,
    config: {
      google_client_id: {
        hasValue: googleClientId.value !== null,
        value: googleClientId.value, // Client ID is not secret
        source: googleClientId.source,
        isEditable: googleClientId.isEditable,
      },
      google_client_secret: {
        hasValue: googleClientSecret.value !== null,
        // Don't expose the actual secret value
        value: googleClientSecret.value ? '••••••••' : null,
        source: googleClientSecret.source,
        isEditable: googleClientSecret.isEditable,
      },
      app_url: {
        hasValue: appUrl.value !== null,
        value: appUrl.value,
        source: appUrl.source,
        isEditable: appUrl.isEditable,
      },
    },
  })
})

/**
 * POST /api/setup
 * Save configuration values
 *
 * Request body:
 * {
 *   google_client_id?: string,
 *   google_client_secret?: string,
 *   app_url?: string
 * }
 *
 * Only editable fields (not set via env) can be saved.
 * After saving, marks setup as completed if all required fields are set.
 */
app.post('/', async (c) => {
  // Check if setup is already completed via env vars
  const setupRequired = await isSetupRequired()
  const setupCompleted = await isSetupCompleted()

  if (!setupRequired && setupCompleted) {
    // All config is from env vars, nothing to set up
    return c.json(
      {
        success: false,
        error: 'Setup is already complete. Configuration is managed via environment variables.',
      },
      400
    )
  }

  const body = await c.req.json<{
    google_client_id?: string
    google_client_secret?: string
    app_url?: string
  }>()

  const errors: string[] = []
  const saved: string[] = []

  // Validate required fields if this is initial setup
  if (setupRequired) {
    if (!body.google_client_id) {
      const existing = await getConfig('google_client_id')
      if (!existing.value) {
        errors.push('google_client_id is required')
      }
    }
    if (!body.google_client_secret) {
      const existing = await getConfig('google_client_secret')
      if (!existing.value) {
        errors.push('google_client_secret is required')
      }
    }
  }

  if (errors.length > 0) {
    return c.json({ success: false, errors }, 400)
  }

  // Save each provided value
  const keysToSave: { key: ConfigKey; value: string | undefined }[] = [
    { key: 'google_client_id', value: body.google_client_id },
    { key: 'google_client_secret', value: body.google_client_secret },
    { key: 'app_url', value: body.app_url },
  ]

  for (const { key, value } of keysToSave) {
    if (value === undefined) continue

    try {
      await setConfig(key, value)
      saved.push(key)
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message)
      } else {
        errors.push(`Failed to save ${key}`)
      }
    }
  }

  // Mark setup as completed if we now have all required config
  const stillRequired = await isSetupRequired()
  if (!stillRequired) {
    await markSetupCompleted()
  }

  return c.json({
    success: errors.length === 0,
    saved,
    errors: errors.length > 0 ? errors : undefined,
    setupCompleted: !stillRequired,
  })
})

/**
 * GET /api/setup/validate
 * Validate that Google credentials are working
 * Tests the OAuth configuration by attempting to generate an auth URL
 */
app.get('/validate', async (c) => {
  const setupRequired = await isSetupRequired()

  if (setupRequired) {
    return c.json({
      valid: false,
      error: 'Google credentials are not configured',
    })
  }

  // Try to create an OAuth client to validate credentials format
  try {
    const { getGoogleCredentials } = await import('../services/config')
    const { clientId, clientSecret } = await getGoogleCredentials()

    // Basic validation
    if (!clientId?.endsWith('.apps.googleusercontent.com')) {
      return c.json({
        valid: false,
        error: 'Invalid Google Client ID format. Should end with .apps.googleusercontent.com',
      })
    }

    if (!clientSecret || clientSecret.length < 10) {
      return c.json({
        valid: false,
        error: 'Google Client Secret appears to be invalid',
      })
    }

    return c.json({
      valid: true,
      message: 'Credentials format looks valid. Full validation happens during OAuth flow.',
    })
  } catch (error) {
    return c.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    })
  }
})

export default app
