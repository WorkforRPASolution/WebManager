/**
 * E2E Test: Log Tail Deduplication (Offset Mode)
 *
 * Prerequisites:
 *   1. Docker containers running: docker-compose up -d --build
 *   2. WebManager server running: cd server && npm run dev
 *   3. Start CRLF log writer:
 *      docker exec ars-direct-agent /app/tests/crlf_log_writer.sh \
 *        /app/ManagerAgent/logs/ARSAgentDummy/test_crlf.log 0.5 40 --partial
 *
 * Run: npx playwright test e2e/log-tail-dedup.spec.js
 */
import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:3000/api'
const EQP_ID = 'DIRECT_01'
const LOG_FILE = 'logs/ARSAgentDummy/test_crlf.log'
const AGENT_GROUP = 'ars_agent'
const COLLECT_SECONDS = 15

test.describe('Log Tail Dedup — Offset Mode E2E', () => {
  let token

  test.beforeAll(async ({ request }) => {
    // Login to get token
    const res = await request.post(`${API_BASE}/auth/login`, {
      data: { username: 'e2etest', password: 'Test1234' }
    })
    const body = await res.json()
    expect(body.token).toBeTruthy()
    token = body.token
  })

  test('SSE tail stream has no duplicate lines', async ({ request }) => {
    // Collect SSE events via fetch
    const lines = await collectTailLines(token, COLLECT_SECONDS)

    console.log(`Collected ${lines.length} lines in ${COLLECT_SECONDS}s`)
    expect(lines.length).toBeGreaterThan(0)

    // Verify: no consecutive duplicate lines
    const duplicates = []
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === lines[i - 1]) {
        duplicates.push({ index: i, line: lines[i] })
      }
    }

    if (duplicates.length > 0) {
      console.error('DUPLICATE LINES FOUND:')
      for (const d of duplicates) {
        console.error(`  [${d.index}] "${d.line}"`)
      }
    }
    expect(duplicates).toHaveLength(0)

    // Verify: lines are in order (each line number > previous)
    const lineNumbers = lines
      .map(l => {
        const m = l.match(/line (\d+)$/)
        return m ? parseInt(m[1]) : null
      })
      .filter(n => n !== null)

    for (let i = 1; i < lineNumbers.length; i++) {
      expect(lineNumbers[i]).toBeGreaterThan(lineNumbers[i - 1])
    }

    console.log(`All ${lines.length} lines in order, no duplicates`)
  })

  test('partial write lines appear complete (no fragments)', async ({ request }) => {
    const lines = await collectTailLines(token, COLLECT_SECONDS)

    // With --partial flag, every 5th line is split. Verify no half-lines appear.
    const fragments = lines.filter(l => {
      // A valid line matches: YYYY-MM-DD HH:MM:SS [INFO] CRLF test log line N
      return l.length > 0 && !l.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \[INFO\] CRLF test log line \d+$/)
    })

    if (fragments.length > 0) {
      console.error('FRAGMENT LINES FOUND:')
      for (const f of fragments) {
        console.error(`  "${f}"`)
      }
    }
    expect(fragments).toHaveLength(0)
  })
})

/**
 * Collect tail lines from SSE stream for a given duration.
 * Uses fetch + ReadableStream (same as client-side sseStreamParser).
 */
async function collectTailLines(authToken, seconds) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), seconds * 1000)

  const allLines = []

  try {
    const response = await fetch(`${API_BASE}/clients/log-tail-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        targets: [{ eqpId: EQP_ID, filePath: LOG_FILE, agentGroup: AGENT_GROUP }]
      }),
      signal: controller.signal
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const sseLines = buffer.split('\n')
      buffer = sseLines.pop()

      for (const sseLine of sseLines) {
        if (sseLine.startsWith('data: ')) {
          try {
            const data = JSON.parse(sseLine.slice(6))
            if (data.lines) {
              allLines.push(...data.lines)
            }
          } catch { /* skip malformed */ }
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') throw err
  } finally {
    clearTimeout(timeout)
  }

  return allLines
}
