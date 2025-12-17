/**
 * Gmail HTTP Batch API
 *
 * Implements Gmail's batch API to fetch multiple messages in a single HTTP request.
 * This dramatically reduces HTTP overhead when syncing large numbers of emails.
 *
 * Gmail batch API supports up to 100 requests per batch.
 * Endpoint: POST https://gmail.googleapis.com/batch/gmail/v1
 */

import type { OAuth2Client } from 'google-auth-library'
import type { gmail_v1 } from 'googleapis'

const BATCH_ENDPOINT = 'https://gmail.googleapis.com/batch/gmail/v1'
const MAX_BATCH_SIZE = 100

export interface BatchMessageResult {
  id: string
  data: gmail_v1.Schema$Message | null
  error: { code: number; message: string; status: string } | null
}

/**
 * Build a multipart/mixed batch request body for Gmail API
 */
function buildBatchRequestBody(
  messageIds: string[],
  format: 'metadata' | 'full' | 'minimal'
): { body: string; boundary: string } {
  const boundary = `batch_${Date.now()}_${Math.random().toString(36).substring(2)}`
  const parts: string[] = []

  for (const messageId of messageIds) {
    parts.push(`--${boundary}`)
    parts.push('Content-Type: application/http')
    parts.push('Content-ID: ' + messageId)
    parts.push('')
    parts.push(`GET /gmail/v1/users/me/messages/${messageId}?format=${format} HTTP/1.1`)
    parts.push('')
  }

  parts.push(`--${boundary}--`)

  return {
    body: parts.join('\r\n'),
    boundary,
  }
}

/**
 * Parse a multipart/mixed batch response from Gmail API
 */
function parseBatchResponse(
  responseBody: string,
  boundary: string,
  messageIds: string[]
): BatchMessageResult[] {
  const results: BatchMessageResult[] = []

  // Split response by boundary
  const parts = responseBody.split(`--${boundary}`)

  // Skip first empty part and last closing boundary
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!part || part.trim() === '--') continue

    // Extract Content-ID to match with original request
    const contentIdMatch = part.match(/Content-ID:\s*response-([^\r\n]+)/i)
    const messageId = contentIdMatch ? contentIdMatch[1].trim() : messageIds[i - 1]

    // Find the HTTP response line and status code
    const httpMatch = part.match(/HTTP\/1\.1\s+(\d+)\s+([^\r\n]+)/)
    const statusCode = httpMatch ? parseInt(httpMatch[1], 10) : 0

    // Find JSON body - look for the JSON object after headers
    // The JSON starts after a blank line (double CRLF or double LF)
    const headerBodySplit = part.split(/\r?\n\r?\n/)
    let jsonBody: string | null = null

    // Find the part that looks like JSON (starts with {)
    for (let j = 1; j < headerBodySplit.length; j++) {
      const potential = headerBodySplit[j].trim()
      if (potential.startsWith('{')) {
        jsonBody = potential
        break
      }
    }

    if (statusCode === 200 && jsonBody) {
      try {
        const data = JSON.parse(jsonBody) as gmail_v1.Schema$Message
        results.push({ id: messageId, data, error: null })
      } catch {
        results.push({
          id: messageId,
          data: null,
          error: { code: 500, message: 'Failed to parse response JSON', status: 'PARSE_ERROR' },
        })
      }
    } else if (jsonBody) {
      // Error response
      try {
        const errorData = JSON.parse(jsonBody)
        results.push({
          id: messageId,
          data: null,
          error: {
            code: errorData.error?.code || statusCode,
            message: errorData.error?.message || 'Unknown error',
            status: errorData.error?.status || 'UNKNOWN',
          },
        })
      } catch {
        results.push({
          id: messageId,
          data: null,
          error: { code: statusCode, message: 'Failed to parse error response', status: 'UNKNOWN' },
        })
      }
    } else {
      results.push({
        id: messageId,
        data: null,
        error: { code: statusCode || 500, message: 'Empty response', status: 'EMPTY_RESPONSE' },
      })
    }
  }

  return results
}

/**
 * Execute a batch request to fetch multiple Gmail messages
 *
 * @param oauth2Client - Authenticated OAuth2 client
 * @param messageIds - Array of message IDs to fetch (max 100)
 * @param format - Response format ('metadata' recommended for sync)
 * @returns Array of results with message data or error for each ID
 */
export async function executeBatch(
  oauth2Client: OAuth2Client,
  messageIds: string[],
  format: 'metadata' | 'full' | 'minimal' = 'metadata'
): Promise<BatchMessageResult[]> {
  if (messageIds.length === 0) {
    return []
  }

  if (messageIds.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch size ${messageIds.length} exceeds maximum of ${MAX_BATCH_SIZE}`)
  }

  const { body, boundary } = buildBatchRequestBody(messageIds, format)

  const response = await oauth2Client.request<string>({
    url: BATCH_ENDPOINT,
    method: 'POST',
    headers: {
      'Content-Type': `multipart/mixed; boundary=${boundary}`,
    },
    body,
    // Tell gaxios to return raw text, not parsed JSON
    responseType: 'text',
  })

  const responseData =
    typeof response.data === 'string' ? response.data : JSON.stringify(response.data)

  // Extract boundary from response Content-Type header or from response body
  const responseContentType =
    response.headers?.['content-type'] || response.headers?.['Content-Type'] || ''
  let responseBoundary = boundary

  // Try to get boundary from header
  const responseBoundaryMatch = responseContentType.match(/boundary=([^;]+)/)
  if (responseBoundaryMatch) {
    responseBoundary = responseBoundaryMatch[1].replace(/"/g, '')
  } else {
    // Try to extract boundary from response body (may have leading whitespace/newlines)
    const firstLineMatch = responseData.match(/^\s*--([^\r\n]+)/)
    if (firstLineMatch) {
      responseBoundary = firstLineMatch[1]
    }
  }

  return parseBatchResponse(responseData, responseBoundary, messageIds)
}

/**
 * Execute multiple batches in parallel with concurrency control
 *
 * @param oauth2Client - Authenticated OAuth2 client
 * @param messageIds - All message IDs to fetch
 * @param format - Response format
 * @param concurrency - Number of parallel batch requests (default: 10)
 * @param onBatchComplete - Optional callback after each batch completes
 * @returns All results combined
 */
export async function executeBatchesConcurrently(
  oauth2Client: OAuth2Client,
  messageIds: string[],
  format: 'metadata' | 'full' | 'minimal' = 'metadata',
  concurrency: number = 10,
  onBatchComplete?: (completed: number, total: number, failed: number) => void
): Promise<BatchMessageResult[]> {
  const allResults: BatchMessageResult[] = []
  let completedBatches = 0
  let totalFailed = 0

  // Split into batches of MAX_BATCH_SIZE
  const batches: string[][] = []
  for (let i = 0; i < messageIds.length; i += MAX_BATCH_SIZE) {
    batches.push(messageIds.slice(i, i + MAX_BATCH_SIZE))
  }

  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += concurrency) {
    const concurrentBatches = batches.slice(i, i + concurrency)

    const batchPromises = concurrentBatches.map(async (batch) => {
      try {
        return await executeBatch(oauth2Client, batch, format)
      } catch (error) {
        // On full batch failure, return errors for all messages
        console.error('[GmailBatch] Batch request failed:', error)
        return batch.map((id) => ({
          id,
          data: null,
          error: {
            code: 500,
            message: error instanceof Error ? error.message : 'Batch request failed',
            status: 'BATCH_FAILED',
          },
        }))
      }
    })

    const batchResults = await Promise.all(batchPromises)

    for (const results of batchResults) {
      allResults.push(...results)
      completedBatches++
      totalFailed += results.filter((r) => r.error).length

      if (onBatchComplete) {
        onBatchComplete(completedBatches, batches.length, totalFailed)
      }
    }
  }

  return allResults
}

/**
 * Check if an error is a rate limit error (429)
 */
export function isBatchRateLimitError(results: BatchMessageResult[]): boolean {
  return results.some((r) => r.error?.code === 429)
}

/**
 * Get retry-after value from rate limit errors
 */
export function getBatchRetryAfter(results: BatchMessageResult[]): number | null {
  const rateLimitError = results.find((r) => r.error?.code === 429)
  if (!rateLimitError) return null

  // Gmail typically returns retry-after in the error message or as a separate field
  // Default to 60 seconds if not specified
  return 60000
}
