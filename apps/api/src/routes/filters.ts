/**
 * Gmail Filters & Labels API Routes
 *
 * Endpoints for managing Gmail filters (rules) and labels.
 * All routes require authentication and verify account ownership.
 */

import { Hono } from 'hono'
import type { MailAccount } from '../db'
import {
  listFilters,
  getFilter,
  createFilter,
  updateFilter,
  deleteFilter,
  listLabels,
  getLabel,
  createLabel,
  updateLabel,
  deleteLabel,
  getMatchingEmailCount,
  applyFilterToExisting,
  testFilterCriteria,
  type FilterCriteria,
  type FilterAction,
  type CreateLabelRequest,
  type UpdateLabelRequest,
} from '../services/filters'
import { auth, type AuthVariables } from '../middleware/auth'
import { verifyAccountOwnership } from '../middleware/ownership'
import { logger } from '../lib/logger'
import { startDeltaSync } from '../services/sync'

const filters = new Hono<{ Variables: AuthVariables }>()

// Apply auth middleware to all routes
filters.use('*', auth())

// ============================================================================
// Helper: Get account with ownership verification
// ============================================================================

async function getAccountForUser(userId: string, accountId: string): Promise<MailAccount | null> {
  return verifyAccountOwnership(userId, accountId)
}

// ============================================================================
// Filter Endpoints
// ============================================================================

/**
 * GET /api/filters/accounts/:id/filters
 * List all filters for an account
 */
filters.get('/accounts/:id/filters', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const filterList = await listFilters(accountId)

    return c.json({ filters: filterList })
  } catch (error) {
    logger.error('[Filters] Error listing filters:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to list filters: ${message}` }, 500)
  }
})

/**
 * GET /api/filters/accounts/:id/filters/:filterId
 * Get a single filter by ID
 */
filters.get('/accounts/:id/filters/:filterId', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const filterId = c.req.param('filterId')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const filter = await getFilter(accountId, filterId)

    if (!filter) {
      return c.json({ error: 'Filter not found' }, 404)
    }

    return c.json({ filter })
  } catch (error) {
    logger.error('[Filters] Error getting filter:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to get filter: ${message}` }, 500)
  }
})

/**
 * POST /api/filters/accounts/:id/filters
 * Create a new filter
 *
 * Body:
 * - criteria: FilterCriteria - matching conditions
 * - action: FilterAction - actions to apply
 */
filters.post('/accounts/:id/filters', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const body = await c.req.json<{ criteria: FilterCriteria; action: FilterAction }>()

    if (!body.criteria || !body.action) {
      return c.json({ error: 'criteria and action are required' }, 400)
    }

    // Validate at least one criteria is set
    const hasCriteria =
      body.criteria.from ||
      body.criteria.to ||
      body.criteria.subject ||
      body.criteria.query ||
      body.criteria.negatedQuery ||
      body.criteria.hasAttachment ||
      body.criteria.size

    if (!hasCriteria) {
      return c.json({ error: 'At least one filter criteria is required' }, 400)
    }

    // Validate at least one action is set
    const hasAction =
      (body.action.addLabelIds && body.action.addLabelIds.length > 0) ||
      (body.action.removeLabelIds && body.action.removeLabelIds.length > 0) ||
      body.action.forward

    if (!hasAction) {
      return c.json({ error: 'At least one filter action is required' }, 400)
    }

    const filter = await createFilter(accountId, body.criteria, body.action)

    return c.json({
      success: true,
      filter,
      message: 'Filter created successfully',
    })
  } catch (error) {
    logger.error('[Filters] Error creating filter:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to create filter: ${message}` }, 500)
  }
})

/**
 * PUT /api/filters/accounts/:id/filters/:filterId
 * Update a filter (deletes old and creates new)
 *
 * Body:
 * - criteria: FilterCriteria - matching conditions
 * - action: FilterAction - actions to apply
 */
filters.put('/accounts/:id/filters/:filterId', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const filterId = c.req.param('filterId')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const body = await c.req.json<{ criteria: FilterCriteria; action: FilterAction }>()

    if (!body.criteria || !body.action) {
      return c.json({ error: 'criteria and action are required' }, 400)
    }

    // Verify the filter exists first
    const existingFilter = await getFilter(accountId, filterId)
    if (!existingFilter) {
      return c.json({ error: 'Filter not found' }, 404)
    }

    const filter = await updateFilter(accountId, filterId, body.criteria, body.action)

    return c.json({
      success: true,
      filter,
      message: 'Filter updated successfully',
    })
  } catch (error) {
    logger.error('[Filters] Error updating filter:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to update filter: ${message}` }, 500)
  }
})

/**
 * DELETE /api/filters/accounts/:id/filters/:filterId
 * Delete a filter
 */
filters.delete('/accounts/:id/filters/:filterId', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const filterId = c.req.param('filterId')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Verify the filter exists first
    const existingFilter = await getFilter(accountId, filterId)
    if (!existingFilter) {
      return c.json({ error: 'Filter not found' }, 404)
    }

    await deleteFilter(accountId, filterId)

    return c.json({
      success: true,
      message: 'Filter deleted successfully',
    })
  } catch (error) {
    logger.error('[Filters] Error deleting filter:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to delete filter: ${message}` }, 500)
  }
})

/**
 * GET /api/filters/accounts/:id/filters/:filterId/preview
 * Get count of emails matching the filter criteria
 */
filters.get('/accounts/:id/filters/:filterId/preview', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const filterId = c.req.param('filterId')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const filter = await getFilter(accountId, filterId)
    if (!filter) {
      return c.json({ error: 'Filter not found' }, 404)
    }

    const count = await getMatchingEmailCount(accountId, filter.criteria)

    return c.json({
      count,
      filter,
    })
  } catch (error) {
    logger.error('[Filters] Error getting filter preview:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to get filter preview: ${message}` }, 500)
  }
})

/**
 * POST /api/filters/accounts/:id/filters/:filterId/apply
 * Apply a filter's actions to all matching existing emails
 */
filters.post('/accounts/:id/filters/:filterId/apply', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const filterId = c.req.param('filterId')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const filter = await getFilter(accountId, filterId)
    if (!filter) {
      return c.json({ error: 'Filter not found' }, 404)
    }

    const { modified, failed } = await applyFilterToExisting(
      accountId,
      filter.criteria,
      filter.action
    )

    // Trigger a delta sync to update local database with Gmail's changes
    if (modified > 0) {
      try {
        await startDeltaSync(accountId)
        logger.debug(`[Filters] Delta sync triggered after applying filter to ${modified} emails`)
      } catch (syncError) {
        logger.error('[Filters] Failed to trigger delta sync after applying filter:', syncError)
        // Don't fail the request if sync fails - Gmail was already updated
      }
    }

    return c.json({
      success: true,
      modified,
      failed,
      message:
        failed > 0
          ? `Applied filter to ${modified} emails, ${failed} failed`
          : `Successfully applied filter to ${modified} emails`,
    })
  } catch (error) {
    logger.error('[Filters] Error applying filter:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to apply filter: ${message}` }, 500)
  }
})

/**
 * POST /api/filters/accounts/:id/test
 * Test filter criteria to see matching emails count and samples
 *
 * Body:
 * - criteria: FilterCriteria - matching conditions to test
 */
filters.post('/accounts/:id/test', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const body = await c.req.json<{ criteria: FilterCriteria }>()

    if (!body.criteria) {
      return c.json({ error: 'criteria is required' }, 400)
    }

    // Validate at least one criteria is set
    const hasCriteria =
      body.criteria.from ||
      body.criteria.to ||
      body.criteria.subject ||
      body.criteria.query ||
      body.criteria.negatedQuery ||
      body.criteria.hasAttachment ||
      body.criteria.size

    if (!hasCriteria) {
      return c.json({ error: 'At least one filter criteria is required' }, 400)
    }

    const result = await testFilterCriteria(accountId, body.criteria)

    return c.json(result)
  } catch (error) {
    logger.error('[Filters] Error testing filter:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to test filter: ${message}` }, 500)
  }
})

// ============================================================================
// Label Endpoints
// ============================================================================

/**
 * GET /api/filters/accounts/:id/labels
 * List all labels for an account
 */
filters.get('/accounts/:id/labels', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const labelList = await listLabels(accountId)

    // Separate system and user labels for easier consumption
    const systemLabels = labelList.filter((l) => l.type === 'system')
    const userLabels = labelList.filter((l) => l.type === 'user')

    return c.json({
      labels: labelList,
      systemLabels,
      userLabels,
    })
  } catch (error) {
    logger.error('[Labels] Error listing labels:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to list labels: ${message}` }, 500)
  }
})

/**
 * GET /api/filters/accounts/:id/labels/:labelId
 * Get a single label by ID
 */
filters.get('/accounts/:id/labels/:labelId', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const labelId = c.req.param('labelId')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const label = await getLabel(accountId, labelId)

    if (!label) {
      return c.json({ error: 'Label not found' }, 404)
    }

    return c.json({ label })
  } catch (error) {
    logger.error('[Labels] Error getting label:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to get label: ${message}` }, 500)
  }
})

/**
 * POST /api/filters/accounts/:id/labels
 * Create a new label
 *
 * Body:
 * - name: string - label name (required)
 * - color: { textColor, backgroundColor } - optional
 * - messageListVisibility: 'show' | 'hide' - optional
 * - labelListVisibility: 'labelShow' | 'labelShowIfUnread' | 'labelHide' - optional
 */
filters.post('/accounts/:id/labels', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const body = await c.req.json<CreateLabelRequest>()

    if (!body.name || body.name.trim() === '') {
      return c.json({ error: 'Label name is required' }, 400)
    }

    const label = await createLabel(accountId, body)

    return c.json({
      success: true,
      label,
      message: 'Label created successfully',
    })
  } catch (error) {
    logger.error('[Labels] Error creating label:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    // Handle duplicate label name error
    if (message.includes('already exists') || message.includes('Label name exists')) {
      return c.json({ error: 'A label with this name already exists' }, 409)
    }

    return c.json({ error: `Failed to create label: ${message}` }, 500)
  }
})

/**
 * PATCH /api/filters/accounts/:id/labels/:labelId
 * Update a label
 *
 * Body:
 * - name: string - new label name (optional)
 * - color: { textColor, backgroundColor } - optional
 * - messageListVisibility: 'show' | 'hide' - optional
 * - labelListVisibility: 'labelShow' | 'labelShowIfUnread' | 'labelHide' - optional
 */
filters.patch('/accounts/:id/labels/:labelId', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const labelId = c.req.param('labelId')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Verify the label exists and is a user label
    const existingLabel = await getLabel(accountId, labelId)
    if (!existingLabel) {
      return c.json({ error: 'Label not found' }, 404)
    }

    if (existingLabel.type === 'system') {
      return c.json({ error: 'System labels cannot be modified' }, 403)
    }

    const body = await c.req.json<UpdateLabelRequest>()

    const label = await updateLabel(accountId, labelId, body)

    return c.json({
      success: true,
      label,
      message: 'Label updated successfully',
    })
  } catch (error) {
    logger.error('[Labels] Error updating label:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    // Handle duplicate label name error
    if (message.includes('already exists') || message.includes('Label name exists')) {
      return c.json({ error: 'A label with this name already exists' }, 409)
    }

    return c.json({ error: `Failed to update label: ${message}` }, 500)
  }
})

/**
 * DELETE /api/filters/accounts/:id/labels/:labelId
 * Delete a label
 */
filters.delete('/accounts/:id/labels/:labelId', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const labelId = c.req.param('labelId')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Verify the label exists and is a user label
    const existingLabel = await getLabel(accountId, labelId)
    if (!existingLabel) {
      return c.json({ error: 'Label not found' }, 404)
    }

    if (existingLabel.type === 'system') {
      return c.json({ error: 'System labels cannot be deleted' }, 403)
    }

    await deleteLabel(accountId, labelId)

    return c.json({
      success: true,
      message: 'Label deleted successfully',
    })
  } catch (error) {
    logger.error('[Labels] Error deleting label:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to delete label: ${message}` }, 500)
  }
})

export default filters
