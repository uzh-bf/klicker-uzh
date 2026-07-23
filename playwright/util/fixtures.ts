import { test as base, BrowserContext, Page } from '@playwright/test'
import { disableAnimations, setSessionCookieForUrl } from './authSession.js'
import {
  LECTURER_EMAIL,
  LECTURER_IND_EMAIL,
  LECTURER_IND_ID,
  LECTURER_INST2_EMAIL,
  LECTURER_INST2_ID,
  LECTURER_INST3_EMAIL,
  LECTURER_INST3_ID,
  LECTURER_INST4_EMAIL,
  LECTURER_INST4_ID,
  LECTURER_INST_EMAIL,
  LECTURER_INST_ID,
  STUDENT_PASSWORD,
  STUDENT_USERNAME,
  URL_CONTROL,
  URL_MANAGE,
  URL_STUDENT_LOGIN,
  USER_ID_TEST,
} from './constants.js'
import {
  useLecturerContextFixture,
  UseLecturerContextOptions,
  useStudentContextFixture,
  UseStudentContextOptions,
} from './fixtures/auth.js'
import { createElementFixture, ElementOptions } from './fixtures/elements.js'
import {
  createLiveQuizFixture,
  CreateLiveQuizOptions,
  validateFeatureAvailabilityFixture,
  ValidateFeatureAvailabilityOptions,
} from './fixtures/manage.js'
import { TokenData } from './types.js'

// ---------------------------------------------------------------------------
// Helper: set a JWT session cookie, mirrors cy.loginFactory()
// ---------------------------------------------------------------------------
async function setSessionCookie(
  page: Page,
  context: BrowserContext,
  tokenData: TokenData,
  cookieName: string = 'next-auth.session-token',
  redirectUrl?: string
) {
  await context.clearCookies()

  const target = redirectUrl ?? process.env.URL_MANAGE ?? URL_MANAGE
  await setSessionCookieForUrl({
    context,
    cookieName,
    targetUrl: target,
    tokenData,
  })
  await page.goto(target)
  // Clear storage after navigating so we are on the same origin (avoids
  // SecurityError on about:blank or cross-origin pages).
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('hideLecturerSurvey', 'true')
    } catch {
      // cross-origin or sandboxed — nothing to clear
    }
  })
  await disableAnimations(page)
}

// ---------------------------------------------------------------------------
// Fixture types
// ---------------------------------------------------------------------------
type KlickerUZHFixtures = {
  /** Low-level factory: sign any token data, set the cookie, navigate */
  loginFactory: (
    tokenData: TokenData,
    cookieName?: string,
    redirectUrl?: string
  ) => Promise<void>

  /** Lecturer with full Catalyst access (mirrors cy.loginLecturer) */
  loginLecturer: () => Promise<void>

  /** Lecturer scoped to the Control app */
  loginLecturerControl: () => Promise<void>

  /** Free-tier user (no Catalyst) */
  loginFreeUser: () => Promise<void>

  /** Individual Catalyst user (pro1) */
  loginIndividualCatalyst: () => Promise<void>

  /** Institutional Catalyst user (pro2) */
  loginInstitutionalCatalyst: () => Promise<void>

  /** Institutional Catalyst user 2 (pro3) */
  loginInstitutionalCatalyst2: () => Promise<void>

  /** Institutional Catalyst user 3 (pro4) */
  loginInstitutionalCatalyst3: () => Promise<void>

  /** Institutional Catalyst user 4 (pro5) */
  loginInstitutionalCatalyst4: () => Promise<void>

  /** Student password login via the PWA login page */
  loginStudentPassword: (username: string) => Promise<void>

  /** Default student login (testuser1) */
  loginStudent: () => Promise<void>

  /** Clear the session cookie (mirrors cy.logoutUser) */
  logoutUser: () => Promise<void>

  createElement: (page: Page, elementOptions: ElementOptions) => Promise<void>

  createLiveQuiz: (page: Page, options: CreateLiveQuizOptions) => Promise<void>

  useStudentContext: (
    page: Page,
    options: UseStudentContextOptions
  ) => Promise<void>

  useLecturerContext: (
    page: Page,
    options: UseLecturerContextOptions
  ) => Promise<void>

  validateFeatureAvailability: (
    page: Page,
    options: ValidateFeatureAvailabilityOptions
  ) => Promise<void>
}

// ---------------------------------------------------------------------------
// Extended test object with all KlickerUZH fixtures
// ---------------------------------------------------------------------------
export const test = base.extend<KlickerUZHFixtures>({
  loginFactory: async ({ page, context }, use) => {
    await use(
      async (
        tokenData: TokenData,
        cookieName?: string,
        redirectUrl?: string
      ) => {
        await setSessionCookie(
          page,
          context,
          tokenData,
          cookieName,
          redirectUrl
        )
      }
    )
  },

  loginLecturer: async ({ loginFactory }, use) => {
    await use(async () => {
      await loginFactory({
        email: LECTURER_EMAIL,
        sub: USER_ID_TEST,
        role: 'ADMIN',
        scope: 'ACCOUNT_OWNER',
        catalystInstitutional: true,
        catalystIndividual: true,
      })
    })
  },

  loginLecturerControl: async ({ page, context }, use) => {
    await use(async () => {
      await setSessionCookie(
        page,
        context,
        {
          email: LECTURER_EMAIL,
          sub: USER_ID_TEST,
          role: 'ADMIN',
          scope: 'ACCOUNT_OWNER',
          catalystInstitutional: true,
          catalystIndividual: true,
        },
        undefined,
        process.env.URL_CONTROL ?? URL_CONTROL
      )
    })
  },

  loginFreeUser: async ({ loginFactory }, use) => {
    await use(async () => {
      await loginFactory({
        email: 'free@df.uzh.ch',
        sub: '76047345-3801-4628-ae7b-adbebcfe8822',
        role: 'USER',
        scope: 'ACCOUNT_OWNER',
        catalystInstitutional: false,
        catalystIndividual: false,
      })
    })
  },

  loginIndividualCatalyst: async ({ loginFactory }, use) => {
    await use(async () => {
      await loginFactory({
        email: LECTURER_IND_EMAIL,
        sub: LECTURER_IND_ID,
        role: 'USER',
        scope: 'ACCOUNT_OWNER',
        catalystInstitutional: false,
        catalystIndividual: true,
      })
    })
  },

  loginInstitutionalCatalyst: async ({ loginFactory }, use) => {
    await use(async () => {
      await loginFactory({
        email: LECTURER_INST_EMAIL,
        sub: LECTURER_INST_ID,
        role: 'USER',
        scope: 'ACCOUNT_OWNER',
        catalystInstitutional: true,
        catalystIndividual: false,
      })
    })
  },

  loginInstitutionalCatalyst2: async ({ loginFactory }, use) => {
    await use(async () => {
      await loginFactory({
        email: LECTURER_INST2_EMAIL,
        sub: LECTURER_INST2_ID,
        role: 'USER',
        scope: 'ACCOUNT_OWNER',
        catalystInstitutional: true,
        catalystIndividual: false,
      })
    })
  },

  loginInstitutionalCatalyst3: async ({ loginFactory }, use) => {
    await use(async () => {
      await loginFactory({
        email: LECTURER_INST3_EMAIL,
        sub: LECTURER_INST3_ID,
        role: 'USER',
        scope: 'ACCOUNT_OWNER',
        catalystInstitutional: true,
        catalystIndividual: false,
      })
    })
  },

  loginInstitutionalCatalyst4: async ({ loginFactory }, use) => {
    await use(async () => {
      await loginFactory({
        email: LECTURER_INST4_EMAIL,
        sub: LECTURER_INST4_ID,
        role: 'USER',
        scope: 'ACCOUNT_OWNER',
        catalystInstitutional: true,
        catalystIndividual: false,
      })
    })
  },

  loginStudentPassword: async ({ page }, use) => {
    await use(async (username: string) => {
      await page.context().clearCookies()

      const loginUrl = process.env.URL_STUDENT_LOGIN ?? URL_STUDENT_LOGIN
      await page.goto(loginUrl)
      await page.evaluate(() => {
        try {
          localStorage.clear()
          sessionStorage.clear()
        } catch {
          // cross-origin or sandboxed page — nothing to clear
        }
      })
      await disableAnimations(page)

      await page.getByTestId('username-field').fill(username)
      await page
        .getByTestId('password-field')
        .fill(process.env.STUDENT_PASSWORD ?? STUDENT_PASSWORD)
      await page.getByTestId('submit-login').click()
    })
  },

  loginStudent: async ({ loginStudentPassword }, use) => {
    await use(async () => {
      await loginStudentPassword(
        process.env.STUDENT_USERNAME ?? STUDENT_USERNAME
      )
    })
  },

  logoutUser: async ({ context }, use) => {
    await use(async () => {
      const cookies = await context.cookies()
      const sessionCookie = cookies.find(
        (c) => c.name === 'next-auth.session-token'
      )
      if (sessionCookie) {
        await context.clearCookies()
      }
    })
  },

  createElement: async ({}, use) => {
    await use(async (page: Page, elementOptions: ElementOptions) => {
      await createElementFixture(page, elementOptions)
    })
  },

  createLiveQuiz: async ({}, use) => {
    await use(async (page: Page, options: CreateLiveQuizOptions) => {
      await createLiveQuizFixture(page, options)
    })
  },

  useStudentContext: async ({}, use) => {
    await use(async (page: Page, options: UseStudentContextOptions) => {
      await useStudentContextFixture(page, options)
    })
  },

  useLecturerContext: async ({}, use) => {
    await use(async (page: Page, options: UseLecturerContextOptions) => {
      await useLecturerContextFixture(page, options)
    })
  },

  validateFeatureAvailability: async ({}, use) => {
    await use(
      async (page: Page, options: ValidateFeatureAvailabilityOptions) => {
        await validateFeatureAvailabilityFixture(page, options)
      }
    )
  },
})

export { expect } from '@playwright/test'
