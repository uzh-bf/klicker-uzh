import { expect, test, type Page } from '@playwright/test'
import { SignJWT } from 'jose'

const DOCUMENT_REFERENCE = 'document-0123456789abcdef'

function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} for retained citations`)
  return value
}

async function participantToken() {
  return new SignJWT({ sub: requiredEnvironment('PARTICIPANT_ID') })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(requiredEnvironment('APP_SECRET')))
}

async function assertReadOnlyDisclaimerState(page: Page) {
  const disclaimer = page.getByTestId('chat-disclaimer-content')
  if ((await disclaimer.count()) === 0) return

  // The retained fixture intentionally has no acceptance row. Observe the
  // gate when present, but never click either action or submit a replacement.
  await expect(disclaimer).toBeVisible()
  await expect(page.getByTestId('chat-disclaimer-accept')).toBeVisible()
  await expect(page.getByTestId('chat-disclaimer-decline')).toBeVisible()
}

async function assertCitationRendering(page: Page) {
  const sourceCard = page.getByTestId('chat-source-card').first()
  await expect(sourceCard).toBeVisible()
  await expect(sourceCard).not.toBeEmpty()
  await expect(sourceCard).toHaveAttribute('id', /^src-.+-\d+$/)
  await expect(sourceCard).toHaveAttribute('tabindex', '0')
  await expect(sourceCard).not.toContainText(DOCUMENT_REFERENCE)
  await expect(sourceCard).not.toHaveAttribute('href')
  await expect(sourceCard.locator('a')).toHaveCount(0)
  // A retained card beneath an overlay is rendered but cannot be reviewed.
  // Trial mode checks pointer reachability without dispatching a click.
  await sourceCard.click({ trial: true, timeout: 10_000 })

  const retrievalChip = page
    .getByTestId('chat-tool-call-toggle')
    .filter({ has: page.locator('svg.lucide-search') })
    .first()
  await expect(retrievalChip).toBeVisible()
  await expect(retrievalChip.locator('svg.lucide-search')).toHaveCount(1)

  const citation = page.getByTestId('chat-citation')
  await expect(citation).toHaveCount(1)
  await expect(citation).toHaveAttribute('href', /^#src-.+-\d+$/)
  await expect(citation).toHaveAttribute('aria-label', /\S+/)

  const citationHref = await citation.getAttribute('href')
  if (!citationHref) throw new Error('Citation is missing its source target')
  await expect(page.locator(citationHref)).toHaveCount(1)
  await expect(page.locator(citationHref)).toBeVisible()

  await expect(
    page.getByTestId('chat-assistant-message-content')
  ).not.toBeEmpty()
}

test('retained synthetic citation renders and survives a read-only reload', async ({
  page,
}, testInfo) => {
  const baseURL = requiredEnvironment('PLAYWRIGHT_BASE_URL')
  const writeRequests: string[] = []
  const origin = new URL(baseURL).origin

  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    // Embedded disclaimer media is not part of the local rendering proof.
    if (url.origin !== origin) {
      await route.abort()
      return
    }
    const pathname = url.pathname
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writeRequests.push(pathname)
      await route.abort()
      return
    }
    await route.continue()
  })

  await page.context().addCookies([
    {
      name: 'participant_token',
      value: await participantToken(),
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
      secure: new URL(baseURL).protocol === 'https:',
    },
  ])

  const threadURL = new URL(
    `/${requiredEnvironment('CHATBOT_ID')}/threads/${requiredEnvironment('THREAD_ID')}`,
    baseURL
  )
  await page.goto(threadURL.toString(), { waitUntil: 'domcontentloaded' })

  // Read a previously saved synthetic thread without creating new records.
  // Reload verifies retained history, not a fresh generation-to-storage flow.
  await assertReadOnlyDisclaimerState(page)
  await assertCitationRendering(page)
  await page
    .getByTestId('chat-source-card')
    .first()
    .screenshot({
      path: testInfo.outputPath('retained-source.png'),
    })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await assertReadOnlyDisclaimerState(page)
  await assertCitationRendering(page)

  expect(writeRequests).toHaveLength(0)
})
