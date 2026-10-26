import { expect, type Page, test } from '@playwright/test'
import {
  type LaunchEmbedding,
  type MockPlatform,
  startMockPlatform,
} from './mockPlatform.js'

// Runs real LTI 1.3 launches from the mock platform through the local LTI
// service (ltijs) to the PWA. Start the stack and select the dev mode as
// described in README.md; LTI_HARNESS_DEV_MODE labels which mode the running
// LTI service uses.

const devMode = process.env.LTI_HARNESS_DEV_MODE
if (devMode !== 'true' && devMode !== 'false') {
  throw new Error(
    'Set LTI_HARNESS_DEV_MODE to the LTI_DEV_MODE value of the running LTI service (true or false)'
  )
}

const pwaOrigin = new URL(
  process.env.URL_STUDENT ?? 'https://pwa.klicker.localhost'
)
const toolOrigin =
  process.env.LTI_HARNESS_TOOL_ORIGIN ??
  `https://${pwaOrigin.hostname.replace(/^pwa\./, 'lti.')}`

type LaunchOutcome = {
  reachedPwa: boolean
  toolError?: string
  toolSessionCookieStored: boolean
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
    // ltijs reports launch failures as JSON with details.message
    let message = `HTTP ${response.status()}`
    try {
      const parsed = JSON.parse(body) as {
        details?: { message?: string }
        error?: string
      }
      message = parsed.details?.message ?? parsed.error ?? message
    } catch {}
    toolError ??= message
  })

  if (test.info().project.metadata.blocksThirdPartyCookies === true) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCookieControls', {
      enableThirdPartyCookieRestriction: true,
      disableThirdPartyCookieMetadata: true,
      disableThirdPartyCookieHeuristics: true,
    })
  }

  await page.goto(platform.launchUrl(embedding))
  await expect
    .poll(() => reachedPwa || toolError !== undefined, { timeout: 30_000 })
    .toBe(true)

  // ltijs keeps a platform session cookie named lti<base64> on the tool host.
  const toolCookies = await page.context().cookies(toolOrigin)
  return {
    reachedPwa,
    toolError,
    toolSessionCookieStored: toolCookies.some(
      (cookie) => cookie.name.startsWith('lti') && cookie.name !== 'lti-token'
    ),
  }
}

for (const embedding of ['top-level', 'iframe'] as const) {
  test(`${embedding} launch reaches the PWA (LTI_DEV_MODE=${devMode})`, async ({
    page,
  }, testInfo) => {
    const outcome = await launch(page, embedding)

    const summary = JSON.stringify({
      project: testInfo.project.name,
      devMode,
      embedding,
      ...outcome,
    })
    testInfo.annotations.push({ type: 'lti-launch', description: summary })
    console.log(`[lti-launch] ${summary}`)

    // A project that claims to block third-party cookies must actually do so,
    // otherwise its iframe result says nothing about blocking browsers.
    if (
      embedding === 'iframe' &&
      testInfo.project.metadata.blocksThirdPartyCookies === true
    ) {
      expect(
        outcome.toolSessionCookieStored,
        'this project should block third-party cookies'
      ).toBe(false)
    }

    expect(outcome.toolError, 'LTI service rejected the launch').toBeUndefined()
    expect(outcome.reachedPwa).toBe(true)
  })
}
