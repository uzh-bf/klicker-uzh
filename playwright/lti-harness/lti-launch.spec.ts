import { expect, type Page, test } from '@playwright/test'
import { COURSE_ID_TEST } from '../../packages/prisma-data/src/data/constants.js'
import {
  type LaunchEmbedding,
  type LaunchTargetRoute,
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
  toolCookieSent: boolean
}

let platform: MockPlatform

test.beforeAll(async () => {
  platform = await startMockPlatform({
    toolOrigin,
    // LMS course elements open a course page, which signs the participant in
    // from ?jwt= even when the browser blocks the PWA's cookies.
    redirectTarget: `${pwaOrigin.origin}/course/${COURSE_ID_TEST}`,
  })
})

test.afterAll(async () => {
  await platform?.close()
})

async function launch(
  page: Page,
  embedding: LaunchEmbedding,
  route: LaunchTargetRoute = 'custom'
): Promise<LaunchOutcome> {
  let reachedPwa = false
  let toolError: string | undefined
  let pwaCookieHeader: Promise<string | null> | undefined

  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === pwaOrigin.origin && url.searchParams.has('jwt')) {
      reachedPwa = true
      pwaCookieHeader ??= request.headerValue('cookie')
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

  await page.goto(platform.launchUrl(embedding, route))
  await expect
    .poll(() => reachedPwa || toolError !== undefined, { timeout: 30_000 })
    .toBe(true)

  // The LTI service sets the lti-token cookie for the PWA during the launch.
  // The PWA deletes it after signing in, so whether the browser kept it is
  // read from the PWA's first request rather than from the cookie jar.
  const cookieHeader = (await pwaCookieHeader) ?? ''
  return {
    reachedPwa,
    toolError,
    toolCookieSent: /(^|;\s*)lti-token=/.test(cookieHeader),
  }
}

// The PWA keeps the participant token in a cookie, or in sessionStorage when
// the browser blocks its cookies in the iframe.
async function participantSignedIn(page: Page) {
  const cookies = await page.context().cookies(pwaOrigin.origin)
  if (cookies.some((cookie) => cookie.name === 'participant_token')) {
    return true
  }
  const pwaFrame = page
    .frames()
    .find((frame) => frame.url().startsWith(pwaOrigin.origin))
  return (
    (await pwaFrame
      ?.evaluate(() => !!sessionStorage.getItem('participant_token'))
      .catch(() => false)) ?? false
  )
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
        outcome.toolCookieSent,
        'this project should block third-party cookies'
      ).toBe(false)
    }

    expect(outcome.toolError, 'LTI service rejected the launch').toBeUndefined()
    expect(outcome.reachedPwa).toBe(true)

    // In development the PWA sets its session cookie with SameSite=Lax, which
    // a cross-site iframe cannot store, while production uses SameSite=None.
    // Iframes that allow third-party cookies therefore cannot sign in locally.
    if (
      embedding === 'top-level' ||
      testInfo.project.metadata.blocksThirdPartyCookies === true
    ) {
      await expect
        .poll(() => participantSignedIn(page), { timeout: 30_000 })
        .toBe(true)
    }
  })
}

// The launch state is bound to the browser that started the login, so a
// launch replayed from another browser and a reused handoff URL are rejected.
// These are server checks; one browser is enough.
// Access links name the target with a redirectTo query on the target link URI
// instead of the custom claim. The query travels in the launch state, so this
// is a server check; one browser is enough.
test.describe('launch target', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'server-side checks run in one browser'
  )

  test('a redirectTo launch reaches the PWA', async ({ page }) => {
    const outcome = await launch(page, 'top-level', 'query')

    expect(outcome.toolError, 'LTI service rejected the launch').toBeUndefined()
    expect(outcome.reachedPwa).toBe(true)
    await expect
      .poll(() => participantSignedIn(page), { timeout: 30_000 })
      .toBe(true)
  })
})

test.describe('launch replay', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'server-side checks run in one browser'
  )

  test('a launch posted from another browser is rejected', async ({
    browser,
  }) => {
    const origin = await browser.newContext()
    const originPage = await origin.newPage()
    let launch: URLSearchParams | undefined
    await originPage.route(`${toolOrigin}/`, async (route) => {
      const body = new URLSearchParams(route.request().postData() ?? '')
      if (body.has('ltijs_recovered_state')) return route.continue()
      // keep the id_token and state, and stop before this browser uses them
      launch = body
      return route.abort()
    })
    await originPage.goto(platform.launchUrl('top-level'))
    await expect.poll(() => launch, { timeout: 30_000 }).toBeDefined()
    await origin.close()

    const other = await browser.newContext()
    const otherPage = await other.newPage()
    const rejection = otherPage.waitForResponse(
      (response) =>
        response.url() === `${toolOrigin}/` &&
        response.request().method() === 'POST' &&
        response.status() >= 400
    )
    let reachedPwa = false
    otherPage.on('request', (request) => {
      const url = new URL(request.url())
      if (url.origin === pwaOrigin.origin && url.searchParams.has('jwt')) {
        reachedPwa = true
      }
    })
    await otherPage.setContent(
      `<form method="post" action="${toolOrigin}/">
        <input name="id_token"><input name="state">
      </form>`
    )
    await otherPage.locator('[name=id_token]').fill(launch!.get('id_token')!)
    await otherPage.locator('[name=state]').fill(launch!.get('state')!)
    await otherPage
      .locator('form')
      .evaluate((form: HTMLFormElement) => form.submit())

    const response = await rejection
    expect(await response.json()).toMatchObject({ message: 'INVALID_STATE' })
    expect(reachedPwa).toBe(false)
    await other.close()
  })

  test('a handoff URL works only once', async ({ page, request }) => {
    let handoffUrl: string | undefined
    let reachedPwa = false
    page.on('request', (launchRequest) => {
      const url = new URL(launchRequest.url())
      if (url.origin === toolOrigin && url.pathname === '/handoff') {
        handoffUrl = launchRequest.url()
      }
      if (url.origin === pwaOrigin.origin && url.searchParams.has('jwt')) {
        reachedPwa = true
      }
    })
    await page.goto(platform.launchUrl('top-level'))
    await expect.poll(() => reachedPwa, { timeout: 30_000 }).toBe(true)

    const replay = await request.get(handoffUrl!, { maxRedirects: 0 })
    expect(replay.status()).toBe(401)
  })
})
