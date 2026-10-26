import { expect, type Page, test } from '@playwright/test'
import {
  type LaunchEmbedding,
  type MockPlatform,
  startMockPlatform,
} from './mockPlatform.js'

// Runs real LTI 1.3 launches from the mock platform through the local LTI
// service (ltijs) to the PWA. Start the stack as described in README.md.

const pwaOrigin = new URL(
  process.env.URL_STUDENT ?? 'https://pwa.klicker.localhost'
)
const toolOrigin =
  process.env.LTI_HARNESS_TOOL_ORIGIN ??
  `https://${pwaOrigin.hostname.replace(/^pwa\./, 'lti.')}`

type LaunchOutcome = {
  reachedPwa: boolean
  toolError?: string
  toolCookieStored: boolean
  toolCookiePartitioned: boolean
}

let platform: MockPlatform

test.beforeAll(async () => {
  platform = await startMockPlatform({
    toolOrigin,
    redirectTarget: `${pwaOrigin.origin}/`,
  })
})

test.afterAll(async () => {
  await platform?.close()
})

async function launch(
  page: Page,
  embedding: LaunchEmbedding
): Promise<LaunchOutcome> {
  let reachedPwa = false
  let toolError: string | undefined

  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === pwaOrigin.origin && url.searchParams.has('jwt')) {
      reachedPwa = true
    }
  })
  page.on('response', async (response) => {
    if (new URL(response.url()).origin !== toolOrigin) return
    if (response.status() < 400) return
    const body = await response.text().catch(() => '')
    // ltijs and the LTI service report launch failures as JSON
    let message = `HTTP ${response.status()}`
    try {
      const parsed = JSON.parse(body) as { error?: string; message?: string }
      message = parsed.message ?? parsed.error ?? message
    } catch {}
    toolError ??= message
  })

  await page.goto(platform.launchUrl(embedding))
  await expect
    .poll(() => reachedPwa || toolError !== undefined, { timeout: 30_000 })
    .toBe(true)

  // The LTI service sets the lti-token cookie for the PWA during the launch.
  // A partitioned (CHIPS) cookie is kept only for this top-level site, so it
  // is reported separately from an ordinary third-party cookie.
  const toolCookies = (await page.context().cookies(toolOrigin)).filter(
    (cookie) => cookie.name.startsWith('lti')
  )
  return {
    reachedPwa,
    toolError,
    toolCookieStored: toolCookies.some((cookie) => !cookie.partitionKey),
    toolCookiePartitioned: toolCookies.some((cookie) => !!cookie.partitionKey),
  }
}

for (const embedding of ['top-level', 'iframe'] as const) {
  test(`${embedding} launch reaches the PWA`, async ({ page }, testInfo) => {
    const outcome = await launch(page, embedding)

    const summary = JSON.stringify({
      project: testInfo.project.name,
      embedding,
      ...outcome,
    })
    testInfo.annotations.push({ type: 'lti-launch', description: summary })
    console.log(`[lti-launch] ${summary}`)

    // A project that should block third-party cookies must actually do so,
    // otherwise its iframe result says nothing about blocking browsers.
    if (
      embedding === 'iframe' &&
      testInfo.project.metadata.blocksThirdPartyCookies === true
    ) {
      expect(
        outcome.toolCookieStored,
        'this project should block third-party cookies'
      ).toBe(false)
    }

    expect(outcome.toolError, 'LTI service rejected the launch').toBeUndefined()
    expect(outcome.reachedPwa).toBe(true)
  })
}
