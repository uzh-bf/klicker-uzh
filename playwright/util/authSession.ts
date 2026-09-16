import { BrowserContext, Page } from '@playwright/test'
import * as jose from 'jose'
import { APP_SECRET, URL_MANAGE } from './constants.js'
import { TokenData } from './types.js'

export async function setSessionCookieForUrl({
  context,
  cookieName = 'next-auth.session-token',
  targetUrl = process.env.URL_MANAGE ?? URL_MANAGE,
  tokenData,
}: {
  context: BrowserContext
  cookieName?: string
  targetUrl?: string
  tokenData: TokenData
}) {
  const secret = new TextEncoder().encode(process.env.APP_SECRET ?? APP_SECRET)
  const token = await new jose.SignJWT(tokenData as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .setIssuer(process.env.APP_ORIGIN_AUTH ?? 'http://127.0.0.1:3010')
    .sign(secret)

  const url = new URL(targetUrl)
  const cookieDomain = process.env.COOKIE_DOMAIN?.trim()
  const cookie = {
    name: cookieName,
    value: token,
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure: url.protocol === 'https:',
  }

  await context.addCookies([
    cookieDomain
      ? {
          ...cookie,
          domain: cookieDomain.startsWith('.')
            ? cookieDomain
            : `.${cookieDomain}`,
          path: '/',
        }
      : { ...cookie, url: url.origin },
  ])
}

export async function disableAnimations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        animation-iteration-count: 1 !important;
        transition-property: none !important;
      }

      [data-sonner-toast],
      [data-sonner-toaster],
      section[aria-label='Notifications alt+T'] {
        pointer-events: none !important;
      }
    `,
  })
}

// Next.js mounts its route announcer from a client-only effect, so this element
// appears only once the page bundle has hydrated; the server-rendered HTML
// never contains it. The pages router renders it as a `p` and the app router as
// a `div`, so match on the id alone. Waiting for it proves the client is
// interactive, which these login helpers need because they reach the login page
// with `waitUntil: 'commit'`: the form is already in the SSR HTML long before
// the bundle runs, and values typed in that window are discarded when React
// takes over. See docs/solutions/test-failure/playwright-login-pre-hydration-race.md.
export async function waitForClientHydration(page: Page) {
  await page.waitForSelector('#__next-route-announcer__', {
    state: 'attached',
    timeout: 30_000,
  })
}
