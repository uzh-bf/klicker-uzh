import { BrowserContext, Page } from '@playwright/test'
import * as jose from 'jose'
import { APP_SECRET, URL_MANAGE } from './constants.js'
import { TokenData } from './types.js'

function getSharedCookieDomain(targetUrl: URL) {
  const configuredDomain = process.env.COOKIE_DOMAIN
  if (
    configuredDomain &&
    (targetUrl.hostname === configuredDomain ||
      targetUrl.hostname.endsWith(`.${configuredDomain}`))
  ) {
    return `.${configuredDomain}`
  }

  if (
    targetUrl.hostname === 'localhost' ||
    /^\d+\.\d+\.\d+\.\d+$/.test(targetUrl.hostname)
  ) {
    return undefined
  }

  const [, ...domainParts] = targetUrl.hostname.split('.')
  return domainParts.length >= 2 ? `.${domainParts.join('.')}` : undefined
}

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
  const domain = getSharedCookieDomain(url)
  await context.addCookies([
    {
      name: cookieName,
      value: token,
      httpOnly: true,
      path: '/',
      sameSite: 'Lax',
      secure: url.protocol === 'https:',
      ...(domain ? { domain } : { url: url.origin }),
    },
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
