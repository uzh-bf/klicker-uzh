// @ts-nocheck
/**
 * Playwright translation of O-live-quiz.
 * Mirrors the original Cypress workflow with native Playwright actions.
 */
import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { chooseActionByTestId } from '../util/actions.js'
import { setSessionCookieForUrl } from '../util/authSession.js'
import { PARTICIPANT_IDS } from '../util/constants.js'
import { test } from '../util/fixtures.js'
import { getDatetimeValidationString, getFutureDate } from '../util/helpers.js'
import { enMessages as messages } from '../util/messages.js'
import {
  answerCaseStudy,
  assertActivityPoints,
  assertInstancePoints,
  assertNoActivityPoints,
  assertNoInstancePoints,
  createAnswerCollection,
  createContent,
  createCourse,
  createLiveQuiz,
  createMicroLearning,
  createPracticeQuiz,
  createQuestionCS,
  createQuestionFT,
  createQuestionKPRIM,
  createQuestionMC,
  createQuestionNR,
  createQuestionSC,
  createQuestionSE,
  createStacks,
  deleteElement,
  dragAndDropElement,
  editElement,
  env,
  expectByAssertion,
  gotoCommit,
  loginIndividualCatalyst,
  loginInstitutionalCatalyst,
  loginInstitutionalCatalyst2,
  loginInstitutionalCatalyst3,
  loginLecturer,
  loginStudent,
  logoutUser,
  restoreLocalForage,
  runTask,
  selectOption,
  snapshotLocalForage,
  typeInto,
  validateElement,
} from '../util/workflow.js'

function readFixture(name: string) {
  return JSON.parse(
    fs.readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
  )
}

let page: Page
const aliases = new Map<string, unknown>()
const data = Object.assign(
  {},
  readFixture('questions.json'),
  readFixture('O-live-quiz.json')
)
let studentPwaStorage: Awaited<ReturnType<typeof snapshotLocalForage>> | null =
  null
let studentPwaWebStorage: {
  localStorage: [string, string][]
  sessionStorage: [string, string][]
} | null = null
const liveQuizPins = new Map<string, string>()
let liveQuizPinRoutePage: Page | null = null

async function confirmResponseDeletionIfAvailable(
  page: Page,
  expectedResponsesText?: string
) {
  const dialog = page.getByRole('dialog', { name: 'Delete Live Quiz' })
  const responseSummary = dialog.getByText(
    /^\d+ response\(s\) in this live quiz submitted by students will be deleted\.$/
  )
  const confirmResponses = page.getByTestId('confirm-deletion-responses')
  const noResponsesSummary = dialog.getByText(
    'For this live quiz no responses have been collected yet.',
    { exact: true }
  )

  await expect(
    confirmResponses.or(responseSummary).or(noResponsesSummary).first()
  ).toBeVisible()

  if (await confirmResponses.isVisible().catch(() => false)) {
    if (expectedResponsesText) {
      await expect(page.locator('body')).toContainText(expectedResponsesText)
    }
    await confirmResponses.click()
  } else if (await responseSummary.isVisible().catch(() => false)) {
    if (expectedResponsesText) {
      await expect(responseSummary).toContainText(expectedResponsesText)
    }
    await responseSummary
      .locator('xpath=ancestor::*[.//button][1]')
      .getByRole('button', { name: 'Confirm' })
      .click()
  } else {
    await expect(noResponsesSummary).toBeVisible()
  }
}

async function clickIfVisible(page: Page, testId: string) {
  const locator = page.getByTestId(testId)
  if (await locator.isVisible().catch(() => false)) {
    await locator.click()
  }
}

async function showEvaluationResultsIfAvailable(page: Page) {
  const showResults = page.getByTestId('show-results-evaluation')
  if (await showResults.isVisible().catch(() => false)) {
    await showResults.click()
  }
}

function localizeEmbeddingUrl(rawUrl: unknown) {
  const value = String(rawUrl ?? '').trim()

  if (!value) {
    throw new Error('Embedding link was empty')
  }

  const studentUrl = new URL(env('URL_STUDENT'))
  const manageUrl = new URL(env('URL_MANAGE'))
  const url = new URL(value, studentUrl)

  if (url.hostname === 'pwa.klicker.com') {
    url.protocol = studentUrl.protocol
    url.hostname = studentUrl.hostname
    url.port = studentUrl.port
  } else if (url.hostname === 'manage.klicker.com') {
    url.protocol = manageUrl.protocol
    url.hostname = manageUrl.hostname
    url.port = manageUrl.port
  }

  return url.toString()
}

async function readEmbeddingLink(page: Page, testId: string) {
  const link = page.getByTestId(testId)
  await expect(link).toBeVisible()
  await expect(link).not.toHaveText('')
  return localizeEmbeddingUrl(await link.textContent())
}

async function gotoEmbeddingLink(page: Page, link: unknown) {
  await gotoCommit(page, localizeEmbeddingUrl(link))
}

async function openActivitiesListForQuiz(page: Page, quizName: string) {
  await gotoCommit(page, `${env('URL_MANAGE')}/activities`)
  await expectByAssertion(page.getByTestId('activities-search-input'), 'exist')
  await page.getByTestId('activities-search-input').clear()
  await typeInto(
    page.getByTestId('activities-search-input'),
    `${quizName}{enter}`
  )
  await expectByAssertion(
    page.getByTestId(`activity-LIVE_QUIZ-${quizName}`),
    'exist'
  )
}

async function openNextBlockFromCockpit(page: Page) {
  const nextBlock = page.getByTestId('next-block-timeline')
  await expect(nextBlock).toBeVisible({ timeout: 30000 })
  await expect(nextBlock).toBeEnabled()
  await nextBlock.click()
  await expect(page.getByTestId('evaluation-results-cockpit')).toBeVisible({
    timeout: 30000,
  })
}

async function visitEvaluationFromCockpit(page: Page) {
  const evaluationLink = page
    .getByTestId('evaluation-results-cockpit')
    .locator('xpath=ancestor::a[1]')
  await expect(evaluationLink).toBeVisible({ timeout: 30000 })

  const href = await evaluationLink.getAttribute('href')
  if (!href || !href.includes('/evaluation')) {
    throw new Error(`Unexpected evaluation link: ${href}`)
  }

  await gotoCommit(
    page,
    href.startsWith('http') ? href : `${env('URL_MANAGE')}${href}`
  )
  await expect(page.getByTestId('change-chart-type')).toBeVisible({
    timeout: 30000,
  })
}

async function selectWordCloudChart(page: Page) {
  await page.getByTestId('change-chart-type').click()
  await page
    .getByTestId('change-chart-type-manage.evaluation.wordCloud')
    .click()
  await showEvaluationResultsIfAvailable(page)
  await expect(page.getByTestId('word-cloud')).toBeVisible({ timeout: 30000 })
}

async function selectEvaluationInstance(page: Page, title: string) {
  await page.getByTestId('evaluate-question-select').click()
  await page.getByTestId(`evaluation-select-instance-${title}`).click()
  await expect(page.getByTestId('evaluate-question-select')).toContainText(
    title
  )
}

const noWordCloudResponsesMessage =
  'No participants have submitted responses for this question'

test.describe.serial('Different live-quiz workflows', () => {
  async function snapshotWebStorage(page: Page) {
    return page.evaluate(() => ({
      localStorage: Object.entries(localStorage),
      sessionStorage: Object.entries(sessionStorage),
    }))
  }

  async function restoreWebStorage(
    page: Page,
    snapshot: {
      localStorage: [string, string][]
      sessionStorage: [string, string][]
    }
  ) {
    await page.evaluate((snapshot) => {
      localStorage.clear()
      sessionStorage.clear()

      for (const [key, value] of snapshot.localStorage) {
        localStorage.setItem(key, value)
      }

      for (const [key, value] of snapshot.sessionStorage) {
        sessionStorage.setItem(key, value)
      }
    }, snapshot)
  }

  async function loginStudentWithStoredPwaState(page: Page) {
    await loginStudent(page)
    const tokenData = {
      email: env('STUDENT_EMAIL'),
      sub: PARTICIPANT_IDS[0]!,
      role: 'PARTICIPANT' as const,
      scope: 'EDUID' as const,
    }

    await setSessionCookieForUrl({
      context: page.context(),
      cookieName: 'next-auth.participant-session-token',
      targetUrl: env('URL_STUDENT'),
      tokenData,
    })
    await setSessionCookieForUrl({
      context: page.context(),
      cookieName: 'next-auth.participant-session-token',
      targetUrl: 'https://pwa.klicker.com',
      tokenData,
    })
    await setSessionCookieForUrl({
      context: page.context(),
      cookieName: 'next-auth.participant-session-token',
      targetUrl: 'https://api.klicker.com',
      tokenData,
    })

    const participantCookie = (
      await page.context().cookies('https://api.klicker.com')
    ).find((cookie) => cookie.name === 'next-auth.participant-session-token')

    if (participantCookie) {
      await page.context().addCookies([
        {
          name: participantCookie.name,
          value: participantCookie.value,
          domain: '.klicker.com',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
          secure: true,
        },
        {
          name: 'participant_token',
          value: participantCookie.value,
          domain: '.klicker.com',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
          secure: true,
        },
        {
          name: 'participant_token',
          value: participantCookie.value,
          url: 'http://127.0.0.1:7078',
          httpOnly: true,
          sameSite: 'Lax',
          secure: false,
        },
        {
          name: 'participant_token',
          value: participantCookie.value,
          url: 'http://localhost:7078',
          httpOnly: true,
          sameSite: 'Lax',
          secure: false,
        },
        {
          name: 'participant_token',
          value: participantCookie.value,
          url: 'https://response-api.klicker.com',
          httpOnly: true,
          sameSite: 'Lax',
          secure: true,
        },
      ])
      await page.context().addInitScript((token) => {
        sessionStorage.setItem('participant_token', token)
      }, participantCookie.value)
      await page.route('**/AddResponse', async (route) => {
        const response = await route.fetch({
          headers: {
            ...route.request().headers(),
            cookie: `participant_token=${participantCookie.value}`,
          },
        })
        await route.fulfill({ response })
      })
    }
  }

  async function copyLocalParticipantTokenToKlickerDomain() {
    let participantCookie = (
      await page.context().cookies('http://127.0.0.1:3000')
    ).find((cookie) => cookie.name === 'participant_token')

    if (!participantCookie) {
      await setSessionCookieForUrl({
        context: page.context(),
        cookieName: 'next-auth.participant-session-token',
        targetUrl: 'https://api.klicker.com',
        tokenData: {
          email: env('STUDENT_EMAIL'),
          sub: PARTICIPANT_IDS[0]!,
          role: 'PARTICIPANT' as const,
          scope: 'EDUID' as const,
        },
      })

      participantCookie = (
        await page.context().cookies('https://api.klicker.com')
      ).find((cookie) => cookie.name === 'next-auth.participant-session-token')
    }

    if (!participantCookie) {
      throw new Error('Could not create participant token for PWA login')
    }

    await page.context().addCookies([
      {
        name: 'next-auth.participant-session-token',
        value: participantCookie.value,
        domain: '.klicker.com',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: true,
      },
      {
        name: 'participant_token',
        value: participantCookie.value,
        domain: '.klicker.com',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: true,
      },
    ])
    await page
      .evaluate((token) => {
        sessionStorage.setItem('participant_token', token)
      }, participantCookie.value)
      .catch(() => undefined)
  }

  async function installTemporaryParticipantToken(token: string) {
    await page.context().addCookies([
      {
        name: 'temporary_participant_token',
        value: token,
        domain: '.klicker.com',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: true,
      },
      {
        name: 'temporary_participant_token',
        value: token,
        url: 'http://127.0.0.1:3000',
        httpOnly: true,
        sameSite: 'Lax',
        secure: false,
      },
      {
        name: 'temporary_participant_token',
        value: token,
        url: 'http://localhost:3000',
        httpOnly: true,
        sameSite: 'Lax',
        secure: false,
      },
      {
        name: 'temporary_participant_token',
        value: token,
        url: 'http://127.0.0.1:7078',
        httpOnly: true,
        sameSite: 'Lax',
        secure: false,
      },
      {
        name: 'temporary_participant_token',
        value: token,
        url: 'http://localhost:7078',
        httpOnly: true,
        sameSite: 'Lax',
        secure: false,
      },
      {
        name: 'temporary_participant_token',
        value: token,
        url: 'https://response-api.klicker.com',
        httpOnly: true,
        sameSite: 'Lax',
        secure: true,
      },
    ])
    await page
      .evaluate((token) => {
        sessionStorage.setItem('participant_token', token)
      }, token)
      .catch(() => undefined)
  }

  async function submitPseudonymAndAvatar() {
    const tokenResponse = page.waitForResponse(async (response) => {
      if (
        !response.url().includes('/graphql') ||
        response.request().method() !== 'POST'
      ) {
        return false
      }

      const body = await response.json().catch(() => null)
      const token = body?.data?.loginTemporaryParticipant
      if (typeof token !== 'string' || token.length === 0) return false

      await installTemporaryParticipantToken(token)
      return true
    })

    await page.getByTestId('submit-pseudonym-and-avatar').click()
    await tokenResponse
    await page.reload({ waitUntil: 'domcontentloaded' })
  }

  async function rememberStudentPwaState(page: Page) {
    studentPwaWebStorage = await snapshotWebStorage(page)
    studentPwaStorage = await snapshotLocalForage(page)
  }

  async function normalizeStudentSessionOrigin() {
    const currentUrl = new URL(page.url())
    const studentOrigin = new URL(env('URL_STUDENT')).origin
    const normalizedPath = currentUrl.pathname.replace(
      /^\/[a-z]{2}(?=\/session\/)/,
      ''
    )

    if (
      currentUrl.origin === studentOrigin &&
      currentUrl.pathname === normalizedPath
    )
      return

    try {
      await page.goto(`${studentOrigin}${normalizedPath}${currentUrl.search}`, {
        waitUntil: 'commit',
      })
    } catch (error) {
      if (!String(error).includes('ERR_NETWORK_CHANGED')) throw error
      await page.waitForTimeout(500)
    }
  }

  async function openStudentLiveQuiz(displayName: string) {
    const activity = page.getByText(displayName).first()
    const href = await activity.evaluate((element) => {
      const link = element.closest('a')
      return link?.getAttribute('href') ?? link?.href
    })

    if (href) {
      const studentOrigin = new URL(env('URL_STUDENT')).origin
      const activityUrl = new URL(href, studentOrigin)
      const normalizedPath = activityUrl.pathname.replace(
        /^\/[a-z]{2}(?=\/session\/)/,
        ''
      )

      await page.goto(
        `${studentOrigin}${normalizedPath}${activityUrl.search}`,
        { waitUntil: 'commit' }
      )
    } else {
      await activity.click()
      await page.waitForURL(/\/session\//)
    }

    await normalizeStudentSessionOrigin()
    if (studentPwaStorage) {
      if (studentPwaWebStorage) {
        await restoreWebStorage(page, studentPwaWebStorage)
      }
      await restoreLocalForage(page, studentPwaStorage)
      await page.reload({ waitUntil: 'commit' })
    }
  }

  async function fillJoinCoursePin(pin: string | number) {
    await expect(page.getByTestId('join-course-pin-field-1')).toBeVisible()
    const pinInput = page.locator('form input[data-input-otp="true"]').first()
    await expect(pinInput).toBeVisible()
    await pinInput.click()
    await typeInto(pinInput, String(pin))
  }

  async function fillLiveQuizPin(pin: string | number) {
    await expect(page.getByTestId('live-quiz-pin-input-1')).toBeVisible()
    const pinInput = page.locator('input[data-input-otp="true"]').first()
    await expect(pinInput).toBeVisible()
    await pinInput.click()
    await typeInto(pinInput, String(pin))
  }

  async function ensureLiveQuizPinRoute() {
    if (liveQuizPinRoutePage === page) return

    liveQuizPinRoutePage = page
    await page.route('**/api/graphql', async (route) => {
      const headers = route.request().headers()
      const pinCookies = Array.from(liveQuizPins.entries()).map(
        ([quizId, pin]) => `live-quiz-pin-${quizId}=${pin}`
      )
      const cookie = [headers.cookie, ...pinCookies].filter(Boolean).join('; ')

      const response = await route.fetch({
        headers: cookie ? { ...headers, cookie } : headers,
      })
      await route.fulfill({ response })
    })
  }

  async function installLiveQuizPinCookie(quizId: string, pin: string) {
    liveQuizPins.set(quizId, pin)
    await ensureLiveQuizPinRoute()
    await page.context().addCookies([
      {
        name: `live-quiz-pin-${quizId}`,
        value: pin,
        domain: '.klicker.com',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: true,
      },
    ])
  }

  function clearLiveQuizPinCookies() {
    liveQuizPins.clear()
  }

  async function submitLiveQuizPin(pin?: string | number) {
    const quizId = new URL(page.url()).pathname.match(
      /\/session\/([^/?#]+)/
    )?.[1]
    if (!quizId)
      throw new Error(`Could not infer live quiz id from ${page.url()}`)

    const pinValue =
      pin != null
        ? String(pin)
        : await page
            .locator('input[data-input-otp="true"]')
            .first()
            .inputValue()

    await installLiveQuizPinCookie(quizId, pinValue)

    const pinResponse = page.waitForResponse(async (response) => {
      if (
        !response.url().includes('/api/graphql') ||
        response.request().method() !== 'POST'
      ) {
        return false
      }

      const body = await response.json().catch(() => null)
      return body?.data?.setLiveQuizPin === true
    })

    await page.getByTestId('live-quiz-submit-pin').click()
    await pinResponse
    await page.reload({ waitUntil: 'domcontentloaded' })
  }

  async function acceptGamifiedLiveQuizAccountPrompt(
    activityDisplayName: string
  ) {
    await page
      .getByTestId('student-submit-answer')
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => undefined)

    for (let attempt = 0; attempt < 3; attempt++) {
      const dialog = page.getByRole('dialog', {
        name: /this live quiz is gamified/i,
      })
      const promptAppeared = await dialog
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false)

      if (!promptAppeared) return

      await dialog
        .getByRole('button', { name: /login with klicker-account/i })
        .click()

      const loginFormAppeared = await page
        .getByTestId('username-field')
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false)

      if (loginFormAppeared) {
        await page.getByTestId('username-field').fill(env('STUDENT_USERNAME'))
        await page.getByTestId('password-field').fill(env('STUDENT_PASSWORD'))
        await page.getByTestId('submit-login').click()
      }

      const quizOpened = await page
        .getByTestId('student-submit-answer')
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => true)
        .catch(() => false)

      if (!quizOpened) {
        await page.getByText(activityDisplayName).first().click()
        await expect(page.getByTestId('student-submit-answer')).toBeVisible()
      }
    }

    await expect(
      page.getByRole('dialog', { name: /this live quiz is gamified/i })
    ).toBeHidden()
  }

  async function verifyLiveQuizDetailsModalContent(
    activityName: string,
    data: any
  ) {
    await page.getByTestId(`activity-name-${activityName}`).click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.SCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      data.MCML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      data.KPML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-3')).toContainText(
      data.NRML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-4')).toContainText(
      data.FTML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-5')).toContainText(
      data.SEML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-6')).toContainText(
      data.CSML.title.substring(0, 20)
    )
    await expect(page.getByTestId('stack-0-instance-7')).toContainText(
      data.CT.title.substring(0, 20)
    )
    await page.getByTestId('close-activity-details-modal').click()
  }

  async function verifyLiveQuizOwnerPermissions(data: any) {
    await expectByAssertion(
      page.getByTestId(`start-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz1}`).click()
    await expectByAssertion(
      page.getByTestId(`edit-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`template-from-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz1, data)
    await expectByAssertion(
      page.getByTestId(`start-live-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz2}`).click()
    await expectByAssertion(
      page.getByTestId(`duplicate-live-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-live-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-live-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz2, data)
    await expectByAssertion(
      page.getByTestId(`live-quiz-cockpit-${data.sharing.quiz3}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz3}`).click()
    await expectByAssertion(
      page.getByTestId(`live-quiz-evaluation-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-live-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-live-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz3, data)
    await expectByAssertion(
      page.getByTestId(`live-quiz-evaluation-${data.sharing.quiz4}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz4}`).click()
    await expectByAssertion(
      page.getByTestId(`duplicate-live-quiz-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-live-quiz-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-live-quiz-${data.sharing.quiz4}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz4, data)
  }

  async function submitAndVerifyPermission(
    shortname: string,
    permissionText: string
  ) {
    const submit = page.getByTestId('new-permission-submit')
    const permission = page.getByTestId(`permission-${shortname}`)

    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(submit).toBeEnabled()
      await submit.click()

      const permissionCreated = await permission
        .waitFor({ state: 'attached', timeout: 10_000 })
        .then(() => true)
        .catch(() => false)

      if (permissionCreated) {
        await expect(
          permission.filter({ hasText: permissionText }).first()
        ).toBeAttached()
        return
      }
    }

    await expectByAssertion(permission, 'exist')
  }

  async function verifyLiveQuizREADPermissions(
    data: any,
    groupPermission: boolean
  ) {
    await loginIndividualCatalyst(page)
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).entries()) {
      await validateElement(page, { element: title, shouldExist: false })
    }
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-LIVE_QUIZ-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'not.exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz1}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz1}`).click()
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz1}`),
      'exist'
    )
    if (!groupPermission) {
      await expectByAssertion(
        page.getByTestId(`remove-live-quiz-${data.sharing.quiz1}`),
        'exist'
      )
    }
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz1, data)
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz2}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz2}`).click()
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz2}`),
      'exist'
    )
    if (!groupPermission) {
      await expectByAssertion(
        page.getByTestId(`remove-live-quiz-${data.sharing.quiz2}`),
        'exist'
      )
    }
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz2, data)
    await expectByAssertion(
      page.getByTestId(`live-quiz-evaluation-${data.sharing.quiz3}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz3}`).click()
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-live-quiz-${data.sharing.quiz3}`),
      !groupPermission ? 'exist' : 'not.exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz3, data)
    await expectByAssertion(
      page.getByTestId(`live-quiz-evaluation-${data.sharing.quiz4}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz4}`).click()
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz4}`),
      'exist'
    )
    if (!groupPermission) {
      await expectByAssertion(
        page.getByTestId(`remove-live-quiz-${data.sharing.quiz4}`),
        'exist'
      )
    }
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz4, data)
  }

  async function verifyLiveQuizEXECUTEPermissions(
    data: any,
    groupPermission: boolean
  ) {
    await loginInstitutionalCatalyst(page)
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).entries()) {
      await validateElement(page, { element: title, shouldExist: false })
    }
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-LIVE_QUIZ-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'not.exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`start-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz1}`).click()
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-live-quiz-${data.sharing.quiz1}`),
      !groupPermission ? 'exist' : 'not.exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz1, data)
    await expectByAssertion(
      page.getByTestId(`start-live-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz2}`).click()
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-live-quiz-${data.sharing.quiz2}`),
      !groupPermission ? 'exist' : 'not.exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz2, data)
    await expectByAssertion(
      page.getByTestId(`live-quiz-cockpit-${data.sharing.quiz3}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz3}`).click()
    await expectByAssertion(
      page.getByTestId(`live-quiz-evaluation-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-live-quiz-${data.sharing.quiz3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz3, data)
    await expectByAssertion(
      page.getByTestId(`live-quiz-evaluation-${data.sharing.quiz4}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz4}`).click()
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz4}`),
      'exist'
    )
    if (!groupPermission) {
      await expectByAssertion(
        page.getByTestId(`remove-live-quiz-${data.sharing.quiz4}`),
        'exist'
      )
    }
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz4, data)
  }

  async function verifyLiveQuizWRITEPermissions(
    data: any,
    groupPermission: boolean
  ) {
    await loginInstitutionalCatalyst2(page)
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).entries()) {
      await validateElement(page, { element: title, shouldExist: false })
    }
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-LIVE_QUIZ-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`change-activity-name-${data.sharing.quiz4}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`start-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz1}`).click()
    await expectByAssertion(
      page.getByTestId(`edit-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-live-quiz-${data.sharing.quiz1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz1, data)
    await expectByAssertion(
      page.getByTestId(`start-live-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz2}`).click()
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-live-quiz-${data.sharing.quiz2}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz2, data)
    await expectByAssertion(
      page.getByTestId(`live-quiz-cockpit-${data.sharing.quiz3}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz3}`).click()
    await expectByAssertion(
      page.getByTestId(`live-quiz-evaluation-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-live-quiz-${data.sharing.quiz3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz3, data)
    await expectByAssertion(
      page.getByTestId(`live-quiz-evaluation-${data.sharing.quiz4}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz4}`).click()
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz4}`),
      'exist'
    )
    if (!groupPermission) {
      await expectByAssertion(
        page.getByTestId(`remove-live-quiz-${data.sharing.quiz4}`),
        'exist'
      )
    }
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz4, data)
  }

  async function verifyLiveQuizADMINPermissions(
    data: any,
    groupPermission: boolean
  ) {
    await loginInstitutionalCatalyst3(page)
    for (const [__index, title] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).entries()) {
      await validateElement(page, { element: title })
    }
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-LIVE_QUIZ-${quiz}`),
        'exist'
      )
      await expectByAssertion(
        page.getByTestId(`change-activity-name-${quiz}`),
        'exist'
      )
    }
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`change-activity-name-${data.sharing.quiz4}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`start-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz1}`).click()
    await expectByAssertion(
      page.getByTestId(`edit-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`template-from-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-live-quiz-${data.sharing.quiz1}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-live-quiz-${data.sharing.quiz1}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz1, data)
    await expectByAssertion(
      page.getByTestId(`start-live-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz2}`).click()
    await expectByAssertion(
      page.getByTestId(`duplicate-live-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-live-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-live-quiz-${data.sharing.quiz2}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-live-quiz-${data.sharing.quiz2}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz2, data)
    await expectByAssertion(
      page.getByTestId(`live-quiz-cockpit-${data.sharing.quiz3}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz3}`).click()
    await expectByAssertion(
      page.getByTestId(`live-quiz-evaluation-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-qr-modal-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`duplicate-live-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-live-quiz-${data.sharing.quiz3}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-live-quiz-${data.sharing.quiz3}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz3, data)
    await expectByAssertion(
      page.getByTestId(`live-quiz-evaluation-${data.sharing.quiz4}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.sharing.quiz4}`).click()
    await expectByAssertion(
      page.getByTestId(`duplicate-live-quiz-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`show-embedding-modal-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`view-activity-log-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`share-live-quiz-${data.sharing.quiz4}`),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId(`remove-live-quiz-${data.sharing.quiz4}`),
      groupPermission ? 'not.exist' : 'exist'
    )
    await expectByAssertion(
      page.getByTestId(`delete-live-quiz-${data.sharing.quiz4}`),
      'exist'
    )
    await typeInto(page.locator('body'), '{esc}')
    await verifyLiveQuizDetailsModalContent(data.sharing.quiz4, data)
  }

  async function verifyREADPermissionsRevoked(data: any) {
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-LIVE_QUIZ-${quiz}`),
        'not.exist'
      )
    }
  }

  async function verifyEXECUTEPermissionsRevoked(data: any) {
    await loginInstitutionalCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-LIVE_QUIZ-${quiz}`),
        'not.exist'
      )
    }
  }

  async function verifyWRITEPermissionsRevoked(data: any) {
    await loginInstitutionalCatalyst2(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-LIVE_QUIZ-${quiz}`),
        'not.exist'
      )
    }
  }

  async function verifyADMINPermissionsRevoked(data: any) {
    await loginInstitutionalCatalyst3(page)
    for (const [__index, element] of Array.from([
      data.SCML.title,
      data.MCML.title,
      data.KPML.title,
      data.NRML.title,
      data.FTML.title,
      data.SEML.title,
      data.CSML.title,
      data.CT.title,
    ]).entries()) {
      await validateElement(page, { element, shouldExist: false })
    }
    await page.getByTestId('activities').click()
    const quizzes = [
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await expectByAssertion(
        page.getByTestId(`activity-LIVE_QUIZ-${quiz}`),
        'not.exist'
      )
    }
  }

  async function createAndStartProtectedLiveQuizzes(data: any) {
    await page.getByTestId('library').click()
    await createLiveQuiz(page, {
      name: data.protected.gamifiedCourse.liveQuiz,
      displayName: data.protected.gamifiedCourse.liveQuiz,
      courseName: data.protected.gamifiedCourse.name,
      pinProtectionWithoutCourse: true,
      blocks: [{ elements: [data.SCML.title, data.MC.title] }],
    })
    await page.getByTestId('create-new-activity').click()
    await createLiveQuiz(page, {
      name: data.protected.nonGamifiedCourse.liveQuiz,
      displayName: data.protected.nonGamifiedCourse.liveQuiz,
      courseName: data.protected.nonGamifiedCourse.name,
      pinProtectionWithoutCourse: true,
      blocks: [{ elements: [data.SCML.title, data.MC.title] }],
    })
    await page.getByTestId('create-new-activity').click()
    await page.getByTestId('activities').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.protected.gamifiedCourse.liveQuiz}{enter}`
    )
    await expectByAssertion(
      page.getByTestId(
        `activity-LIVE_QUIZ-${data.protected.gamifiedCourse.liveQuiz}`
      ),
      'exist'
    )
    await page
      .getByTestId(`start-live-quiz-${data.protected.gamifiedCourse.liveQuiz}`)
      .click()
    await expectByAssertion(
      page.getByTestId('abort-live-quiz-cockpit'),
      'exist'
    )
    await expect(page.getByTestId('live-quiz-display-name')).toContainText(
      data.protected.gamifiedCourse.liveQuiz
    )
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('activities').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.protected.nonGamifiedCourse.liveQuiz}{enter}`
    )
    await expectByAssertion(
      page.getByTestId(
        `activity-LIVE_QUIZ-${data.protected.nonGamifiedCourse.liveQuiz}`
      ),
      'exist'
    )
    await page
      .getByTestId(
        `start-live-quiz-${data.protected.nonGamifiedCourse.liveQuiz}`
      )
      .click()
    await expectByAssertion(
      page.getByTestId('abort-live-quiz-cockpit'),
      'exist'
    )
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
  }

  async function enterPinAnswerFirstBlock(pin: string, data: any) {
    await expectByAssertion(page.getByTestId('live-quiz-pin-input-1'), 'exist')
    await expectByAssertion(
      page.getByTestId('live-quiz-submit-pin'),
      'be.disabled'
    )
    await fillLiveQuizPin(pin)
    await submitLiveQuizPin(pin)
    await expect(page.getByTestId('instance-question-content')).toContainText(
      data.SCML.content
    )
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('instance-question-content')).toContainText(
      data.MC.content
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('instance-question-content')).toContainText(
      data.MC.content
    )
  }

  async function studentAccountLinkAccess(
    link: string,
    data: any,
    loggedIn: boolean,
    gamified: boolean
  ) {
    await page.goto(env('URL_STUDENT'), { waitUntil: 'commit' })
    {
      const scQuestion = data.SCML.content
      const mcQuestion = data.MC.content
      if (loggedIn) {
        await loginStudentWithStoredPwaState(page)
      }
      const localizedLink = localizeEmbeddingUrl(link)
      const embeddedPin = new URL(localizedLink).searchParams.get('pin')
      expect(embeddedPin).toMatch(/^[A-Z0-9]{6}$/)
      await gotoCommit(page, localizedLink)
      if (loggedIn && studentPwaStorage) {
        await restoreLocalForage(page, studentPwaStorage)
      }
      await expectByAssertion(
        page.getByTestId('live-quiz-pin-input-1'),
        'exist'
      )
      const pinInput = page.locator('input[data-input-otp="true"]').first()
      await expect(pinInput).toBeVisible()
      if ((await pinInput.inputValue()) !== embeddedPin) {
        await fillLiveQuizPin(embeddedPin!)
      }
      await expectByAssertion(
        page.getByTestId('live-quiz-submit-pin'),
        'not.be.disabled'
      )
      await submitLiveQuizPin(embeddedPin!)
      if (!loggedIn) {
        if (gamified) {
          await page.getByTestId('participate-anonymously').click()
        } else {
          await expectByAssertion(
            page.getByTestId('participate-anonymously'),
            'not.exist'
          )
        }
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(scQuestion)
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await page.getByTestId('sc-0-answer-option-0').click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(mcQuestion)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(
          page.getByTestId('instance-question-content')
        ).toContainText(mcQuestion)
      }
      await expect(page.getByTestId('instance-question-content')).toContainText(
        mcQuestion
      )
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('instance-question-content')).toContainText(
        mcQuestion
      )
      await expect(page.getByTestId('instance-question-content')).toContainText(
        mcQuestion
      )
      await expectByAssertion(
        page.getByTestId('student-submit-answer'),
        'be.disabled'
      )
      await page.getByTestId('mc-1-answer-option-1').click()
      await page.getByTestId('mc-1-answer-option-3').click()
      await page.getByTestId('student-submit-answer').click()
      await page.waitForTimeout(500)
    }
  }

  async function getPinProtectedQuizLinks(data: any) {
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.protected.gamifiedCourse.liveQuiz}{enter}`
    )
    await page
      .getByTestId(
        `live-quiz-cockpit-${data.protected.gamifiedCourse.liveQuiz}`
      )
      .click()
    await page.getByTestId('open-qr-modal').click()
    {
      const text = await page.getByTestId('qr-link-direct').textContent()
      aliases.set('protectedQuizLink', text)
    }
    await page.getByTestId('live-quiz-qr-modal-close').click()
    await page.getByTestId('activities').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.protected.nonGamifiedCourse.liveQuiz}{enter}`
    )
    await page
      .getByTestId(
        `live-quiz-cockpit-${data.protected.nonGamifiedCourse.liveQuiz}`
      )
      .click()
    await page.getByTestId('open-qr-modal').click()
    {
      const text = await page.getByTestId('qr-link-direct').textContent()
      aliases.set('protectedQuizLink2', text)
    }
    await page.getByTestId('live-quiz-qr-modal-close').click()
  }

  async function endPinProtectedLiveQuizzes(data: any) {
    for (const [__index, quiz] of Array.from([
      data.protected.gamifiedCourse.liveQuiz,
      data.protected.nonGamifiedCourse.liveQuiz,
    ]).entries()) {
      await chooseActionByTestId(
        page,
        'running-live-quiz-dropdown',
        `running-live-quiz-${quiz}`
      )
      for (let i = 0; i < 2; i++) {
        const nextBlockButton = page.getByTestId('next-block-timeline')
        if (
          !(await nextBlockButton
            .isVisible({ timeout: 5000 })
            .catch(() => false))
        ) {
          break
        }
        await nextBlockButton.click()
        await page.waitForTimeout(500)
      }
      await runTask('deleteLiveQuiz', { name: quiz })
    }
  }

  test('CLEANUP', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await runTask('cleanupDatabase')
    await runTask('seedDatabase')
  })

  test('Create the questions required in the live quiz test workflows', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionSC(page, {
      name: data.SC.title,
      content: data.SC.content,
      explanation: data.SC.explanation,
      choices: data.SC.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionSC(page, {
      name: data.SCML.title,
      content: data.SCML.content,
      explanation: data.SCML.explanation,
      choices: data.SCML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionSC(page, {
      name: data.SCML2.title,
      content: data.SCML2.content,
      explanation: data.SCML2.explanation,
      choices: data.SCML2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MC.title,
      content: data.MC.content,
      explanation: data.MC.explanation,
      choices: data.MC.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MCML.title,
      content: data.MCML.content,
      explanation: data.MCML.explanation,
      choices: data.MCML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MCML2.title,
      content: data.MCML2.content,
      explanation: data.MCML2.explanation,
      choices: data.MCML2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KP.title,
      content: data.KP.content,
      explanation: data.KP.explanation,
      choices: data.KP.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KPML.title,
      content: data.KPML.content,
      explanation: data.KPML.explanation,
      choices: data.KPML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionKPRIM(page, {
      name: data.KPML2.title,
      content: data.KPML2.content,
      explanation: data.KPML2.explanation,
      choices: data.KPML2.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionNR(page, {
      name: data.NR.title,
      content: data.NR.content,
      explanation: data.NR.explanation,
      ...data.NR.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionNR(page, {
      name: data.NRML.title,
      content: data.NRML.content,
      explanation: data.NRML.explanation,
      ...data.NRML.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionNR(page, {
      name: data.NRML2.title,
      content: data.NRML2.content,
      explanation: data.NRML2.explanation,
      ...data.NRML2.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FT.title,
      content: data.FT.content,
      explanation: data.FT.explanation,
      ...data.FT.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FTML.title,
      content: data.FTML.content,
      explanation: data.FTML.explanation,
      ...data.FTML.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FTML2.title,
      content: data.FTML2.content,
      explanation: data.FTML2.explanation,
      ...data.FTML2.options,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('resources').click()
    await page.getByTestId('answer-collections').click()
    await expectByAssertion(page.getByTestId('answer-collection-list'), 'exist')
    await createAnswerCollection(page, {
      name: data.collection.name,
      description: data.collection.description,
      entries: data.collection.options,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('library').click()
    await createQuestionSE(page, {
      name: data.SE.title,
      content: data.SE.content,
      explanation: data.SE.explanation,
      numberOfInputs: data.SE.inputs,
      collectionName: data.collection.name,
      userId: env('LECTURER_ID'),
    })
    await createQuestionSE(page, {
      name: data.SEML.title,
      content: data.SEML.content,
      explanation: data.SEML.explanation,
      numberOfInputs: data.SEML.inputs,
      collectionName: data.collection.name,
      correctAnswers: data.collection.options.filter((_, i) =>
        data.SEML.solutions.includes(i)
      ),
      userId: env('LECTURER_ID'),
    })
    await createQuestionSE(page, {
      name: data.SEML2.title,
      content: data.SEML2.content,
      explanation: data.SEML2.explanation,
      numberOfInputs: data.SEML2.inputs,
      collectionName: data.collection.name,
      correctAnswers: data.collection.options.filter((_, i) =>
        data.SEML2.solutions.includes(i)
      ),
      userId: env('LECTURER_ID'),
    })
    await createQuestionCS(page, {
      name: data.CS.title,
      content: data.CS.content,
      explanation: data.CS.explanation,
      collectionName: data.collection.name,
      selectedItems: data.collection.options.filter((_, i) =>
        data.CS.selectedItems.includes(i)
      ),
      criteria: data.CS.criteria,
      cases: data.CS.cases,
      solutions: data.CS.solutions,
      userId: env('LECTURER_ID'),
    })
    await createQuestionCS(page, {
      name: data.CSML.title,
      content: data.CSML.content,
      explanation: data.CSML.explanation,
      collectionName: data.collection.name,
      selectedItems: data.collection.options.filter((_, i) =>
        data.CSML.selectedItems.includes(i)
      ),
      criteria: data.CSML.criteria,
      cases: data.CSML.cases,
      solutions: data.CSML.solutions,
      userId: env('LECTURER_ID'),
    })
    await createQuestionCS(page, {
      name: data.CSML2.title,
      content: data.CSML2.content,
      explanation: data.CSML2.explanation,
      collectionName: data.collection.name,
      selectedItems: data.collection.options.filter((_, i) =>
        data.CSML2.selectedItems.includes(i)
      ),
      criteria: data.CSML2.criteria,
      cases: data.CSML2.cases,
      solutions: data.CSML2.solutions,
      userId: env('LECTURER_ID'),
    })
    await createContent(page, {
      name: data.CT.title,
      content: data.CT.content,
      userId: env('LECTURER_ID'),
    })
    await createContent(page, {
      name: data.CT2.title,
      content: data.CT2.content,
      userId: env('LECTURER_ID'),
    })
  })

  test('Test adding and deleting blocks to a live quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('create-live-quiz').click()
    await page.getByTestId('cancel-activity-creation').click()
    await page.getByTestId('create-live-quiz').click()
    await typeInto(page.getByTestId('insert-live-quiz-name'), 'TEMP')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await typeInto(page.getByTestId('insert-live-display-name'), 'TEMP DISPLAY')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('block-container-header'),
      'have.length',
      1
    )
    await page.getByTestId('drop-elements-add-block').click()
    await expectByAssertion(
      page.getByTestId('block-container-header'),
      'have.length',
      2
    )
    await page.getByTestId('delete-block-1').click()
    await expectByAssertion(
      page.getByTestId('block-container-header'),
      'have.length',
      1
    )
  })

  test('Create a live quiz with two questions and test all settings', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('create-live-quiz').click()
    await expectByAssertion(page.getByTestId('next-or-submit'), 'be.disabled')
    await typeInto(
      page.getByTestId('insert-live-quiz-name'),
      data.course1.quiz.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('next-or-submit'), 'be.disabled')
    await typeInto(
      page.getByTestId('insert-live-display-name'),
      data.course1.quiz.displayName
    )
    await page.getByTestId('insert-live-description').click()
    await typeInto(
      page.getByTestId('insert-live-description'),
      data.course1.quiz.description
    )
    await expect(page.getByTestId('insert-live-description')).toContainText(
      data.course1.quiz.description
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('next-or-submit'),
      'not.be.disabled'
    )
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await expect(page.getByTestId('select-course')).toContainText(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    await expectByAssertion(page.getByTestId('select-multiplier'), 'not.exist')
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings'),
      'not.exist'
    )
    await selectOption(page, '[data-cy="select-course"]', data.course1.name)
    await expect(page.getByTestId('select-course')).toContainText(
      data.course1.name
    )
    await expectByAssertion(page.getByTestId('select-multiplier'), 'exist')
    await selectOption(page, '[data-cy="select-course"]', data.course2.name)
    await expect(page.getByTestId('select-course')).toContainText(
      data.course2.name
    )
    await expectByAssertion(page.getByTestId('select-multiplier'), 'not.exist')
    await selectOption(page, '[data-cy="select-course"]', data.course1.name)
    await expect(page.getByTestId('select-course')).toContainText(
      data.course1.name
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings'),
      'exist'
    )
    await page.getByTestId('live-quiz-advanced-settings').click()
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings-close'),
      'exist'
    )
    await page.getByTestId('live-quiz-default-points').click()
    await page.getByTestId('live-quiz-default-points').clear()
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings-close'),
      'not.exist'
    )
    await page.getByTestId('live-quiz-default-points').click()
    await typeInto(page.getByTestId('live-quiz-default-points'), '-10')
    await expectByAssertion(
      page.getByTestId('live-quiz-default-points'),
      'have.value',
      '10'
    )
    await page.getByTestId('live-quiz-default-points').click()
    await page.getByTestId('live-quiz-default-points').clear()
    await typeInto(
      page.getByTestId('live-quiz-default-points'),
      String(data.course1.quiz.defaultPoints)
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-default-points'),
      'have.value',
      String(data.course1.quiz.defaultPoints)
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings-close'),
      'exist'
    )
    await page.getByTestId('live-quiz-default-correct-points').click()
    await page.getByTestId('live-quiz-default-correct-points').clear()
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings-close'),
      'not.exist'
    )
    await page.getByTestId('live-quiz-default-correct-points').click()
    await typeInto(page.getByTestId('live-quiz-default-correct-points'), '-20')
    await expectByAssertion(
      page.getByTestId('live-quiz-default-correct-points'),
      'have.value',
      '20'
    )
    await page.getByTestId('live-quiz-default-correct-points').click()
    await page.getByTestId('live-quiz-default-correct-points').clear()
    await typeInto(
      page.getByTestId('live-quiz-default-correct-points'),
      String(data.course1.quiz.defaultCorrectPoints)
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings-close'),
      'exist'
    )
    await page.getByTestId('live-quiz-max-bonus-points').click()
    await page.getByTestId('live-quiz-max-bonus-points').clear()
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings-close'),
      'not.exist'
    )
    await page.getByTestId('live-quiz-max-bonus-points').click()
    await typeInto(page.getByTestId('live-quiz-max-bonus-points'), '-30')
    await expectByAssertion(
      page.getByTestId('live-quiz-max-bonus-points'),
      'have.value',
      '30'
    )
    await page.getByTestId('live-quiz-max-bonus-points').click()
    await page.getByTestId('live-quiz-max-bonus-points').clear()
    await typeInto(
      page.getByTestId('live-quiz-max-bonus-points'),
      String(data.course1.quiz.maxBonusPoints)
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings-close'),
      'exist'
    )
    await page.getByTestId('live-quiz-time-to-zero-bonus').click()
    await page.getByTestId('live-quiz-time-to-zero-bonus').clear()
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings-close'),
      'not.exist'
    )
    await page.getByTestId('live-quiz-time-to-zero-bonus').click()
    await typeInto(page.getByTestId('live-quiz-time-to-zero-bonus'), '-40')
    await expectByAssertion(
      page.getByTestId('live-quiz-time-to-zero-bonus'),
      'have.value',
      '40'
    )
    await page.getByTestId('live-quiz-time-to-zero-bonus').click()
    await page.getByTestId('live-quiz-time-to-zero-bonus').clear()
    await typeInto(
      page.getByTestId('live-quiz-time-to-zero-bonus'),
      String(data.course1.quiz.timeToZeroBonus)
    )
    await page.getByTestId('live-quiz-advanced-settings-close').click()
    await expectByAssertion(page.getByTestId('select-multiplier'), 'exist')
    await expectByAssertion(page.getByTestId('select-multiplier'), 'exist')
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier1
    )
    await page.getByTestId('select-multiplier').click()
    await page
      .getByTestId(
        `select-multiplier-${messages.manage.activityWizard.multiplier2}`
      )
      .click()
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier2
    )
    await expectByAssertion(
      page.getByTestId('set-feedback-enabled'),
      'have.attr',
      'data-state',
      'checked'
    )
    await expectByAssertion(
      page.getByTestId('set-feedback-enabled'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await page.getByTestId('set-feedback-enabled').click()
    await expectByAssertion(
      page.getByTestId('set-feedback-enabled'),
      'have.attr',
      'data-state',
      'unchecked'
    )
    await expectByAssertion(
      page.getByTestId('set-feedback-enabled'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-enabled'),
      'have.attr',
      'data-state',
      'unchecked'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-enabled'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-moderation'),
      'have.attr',
      'data-state',
      'checked'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-moderation'),
      'have.attr',
      'disabled',
      'disabled'
    )
    await page.getByTestId('set-liveqa-enabled').click()
    await expectByAssertion(
      page.getByTestId('set-liveqa-enabled'),
      'have.attr',
      'data-state',
      'checked'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-enabled'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-moderation'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await page.getByTestId('set-liveqa-moderation').click()
    await expectByAssertion(
      page.getByTestId('set-liveqa-moderation'),
      'have.attr',
      'data-state',
      'unchecked'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-moderation'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('next-or-submit'), 'be.disabled')
    await page.getByTestId('delete-block-0').click()
    await expectByAssertion(
      page.getByTestId('next-or-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('drop-elements-add-block').click()
    await expectByAssertion(page.getByTestId('next-or-submit'), 'be.disabled')
    await createStacks(page, {
      stacks: [{ elements: [data.SC.title] }, { elements: [data.SCML.title] }],
      type: 'block',
    })
    await page.getByTestId('move-block-1-left').click()
    await expectByAssertion(page.getByTestId('element-0-block-0'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-0'),
      'contain',
      data.SCML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId('element-0-block-1'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-1'),
      'contain',
      data.SC.title.substring(0, 20)
    )
    await page.getByTestId('move-block-0-right').click()
    await expectByAssertion(page.getByTestId('element-0-block-0'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-0'),
      'contain',
      data.SC.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId('element-0-block-1'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-1'),
      'contain',
      data.SCML.title.substring(0, 20)
    )
    await page.getByTestId('open-block-0-countdown').click()
    await typeInto(page.getByTestId('block-time-limit'), '10')
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('open-block-1-countdown').click()
    await typeInto(page.getByTestId('block-time-limit'), '20')
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('open-block-0-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '10'
    )
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('open-block-1-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '20'
    )
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('move-block-1-left').click()
    await page.getByTestId('open-block-0-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '20'
    )
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('open-block-1-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '10'
    )
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('move-block-0-right').click()
    await page.getByTestId('open-block-0-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '10'
    )
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('open-block-1-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '20'
    )
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('back-activity-creation').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
  })

  test('Edit the created live quiz and check if all settings persist', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.course1.quiz.name}{enter}`
    )
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.course1.quiz.name}`),
      'exist'
    )
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.course1.quiz.name}`)
      .click()
    await page.getByTestId(`edit-live-quiz-${data.course1.quiz.name}`).click()
    await expectByAssertion(
      page.getByTestId('insert-live-quiz-name'),
      'have.value',
      data.course1.quiz.name
    )
    await page.getByTestId('insert-live-quiz-name').clear()
    await typeInto(
      page.getByTestId('insert-live-quiz-name'),
      data.course1.quiz.nameNew
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-live-display-name'),
      'have.value',
      data.course1.quiz.displayName
    )
    await page.getByTestId('insert-live-display-name').clear()
    await typeInto(
      page.getByTestId('insert-live-display-name'),
      data.course1.quiz.displayNameNew
    )
    await page.getByTestId('insert-live-description').click()
    await expect(page.getByTestId('insert-live-description')).toContainText(
      data.course1.quiz.description
    )
    await page.getByTestId('insert-live-description').click()
    await page.getByTestId('insert-live-description').clear()
    await typeInto(
      page.getByTestId('insert-live-description'),
      data.course1.quiz.descriptionNew
    )
    await page.getByTestId('insert-live-description').click()
    await expect(page.getByTestId('insert-live-description')).toContainText(
      data.course1.quiz.descriptionNew
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.course1.name
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-advanced-settings'),
      'exist'
    )
    await page.getByTestId('live-quiz-advanced-settings').click()
    await expectByAssertion(
      page.getByTestId('live-quiz-default-points'),
      'have.value',
      data.course1.quiz.defaultPoints
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-default-correct-points'),
      'have.value',
      data.course1.quiz.defaultCorrectPoints
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-max-bonus-points'),
      'have.value',
      data.course1.quiz.maxBonusPoints
    )
    await expectByAssertion(
      page.getByTestId('live-quiz-time-to-zero-bonus'),
      'have.value',
      data.course1.quiz.timeToZeroBonus
    )
    await page.getByTestId('live-quiz-advanced-settings-close').click()
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier2
    )
    await expectByAssertion(
      page.getByTestId('set-feedback-enabled'),
      'have.attr',
      'data-state',
      'unchecked'
    )
    await expectByAssertion(
      page.getByTestId('set-feedback-enabled'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-enabled'),
      'have.attr',
      'data-state',
      'checked'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-enabled'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-moderation'),
      'have.attr',
      'data-state',
      'unchecked'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-moderation'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await page.getByTestId('select-multiplier').click()
    await page
      .getByTestId(
        `select-multiplier-${messages.manage.activityWizard.multiplier4}`
      )
      .click()
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier4
    )
    await page.getByTestId('set-feedback-enabled').click()
    await page.getByTestId('set-liveqa-enabled').click()
    await expectByAssertion(
      page.getByTestId('set-feedback-enabled'),
      'have.attr',
      'data-state',
      'checked'
    )
    await expectByAssertion(
      page.getByTestId('set-feedback-enabled'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-enabled'),
      'have.attr',
      'data-state',
      'unchecked'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-enabled'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-moderation'),
      'have.attr',
      'data-state',
      'unchecked'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-moderation'),
      'have.attr',
      'disabled',
      'disabled'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('element-0-block-0'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-0'),
      'contain',
      data.SC.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId('element-0-block-1'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-1'),
      'contain',
      data.SCML.title.substring(0, 20)
    )
    await page.getByTestId('open-block-0-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '10'
    )
    await page.getByTestId('block-time-limit').clear()
    await typeInto(page.getByTestId('block-time-limit'), '15')
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('open-block-0-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '15'
    )
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('open-block-1-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '20'
    )
    await page.getByTestId('block-time-limit').clear()
    await typeInto(page.getByTestId('block-time-limit'), '25')
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('open-block-1-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '25'
    )
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('move-block-1-left').click()
    await expectByAssertion(page.getByTestId('element-0-block-0'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-0'),
      'contain',
      data.SCML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId('element-0-block-1'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-1'),
      'contain',
      data.SC.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.goto(`${env('URL_MANAGE')}/activities`, { waitUntil: 'commit' })
    await expectByAssertion(
      page.getByTestId('activities-search-input'),
      'exist'
    )
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.course1.quiz.nameNew}{enter}`
    )
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.course1.quiz.nameNew}`),
      'exist'
    )
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.course1.quiz.nameNew}`)
      .click()
    await page
      .getByTestId(`edit-live-quiz-${data.course1.quiz.nameNew}`)
      .click()
    await expectByAssertion(
      page.getByTestId('insert-live-quiz-name'),
      'have.value',
      data.course1.quiz.nameNew
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-live-display-name'),
      'have.value',
      data.course1.quiz.displayNameNew
    )
    await page.getByTestId('insert-live-description').click()
    await expect(page.getByTestId('insert-live-description')).toContainText(
      data.course1.quiz.descriptionNew
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('select-course')).toContainText(
      data.course1.name
    )
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier4
    )
    await expectByAssertion(
      page.getByTestId('set-feedback-enabled'),
      'have.attr',
      'data-state',
      'checked'
    )
    await expectByAssertion(
      page.getByTestId('set-feedback-enabled'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-enabled'),
      'have.attr',
      'data-state',
      'unchecked'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-enabled'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-moderation'),
      'have.attr',
      'data-state',
      'unchecked'
    )
    await expectByAssertion(
      page.getByTestId('set-liveqa-moderation'),
      'have.attr',
      'disabled',
      'disabled'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('element-0-block-0'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-0'),
      'contain',
      data.SCML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId('element-0-block-1'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-1'),
      'contain',
      data.SC.title.substring(0, 20)
    )
    await page.getByTestId('open-block-0-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '25'
    )
    await page.getByTestId('close-block-countdown').click()
    await page.getByTestId('open-block-1-countdown').click()
    await expectByAssertion(
      page.getByTestId('block-time-limit'),
      'have.value',
      '15'
    )
    await page.getByTestId('close-block-countdown').click()
  })

  test('Duplicate the live quiz', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.course1.quiz.nameNew}{enter}`
    )
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.course1.quiz.nameNew}`),
      'exist'
    )
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.course1.quiz.nameNew}`)
      .click()
    await page
      .getByTestId(`duplicate-live-quiz-${data.course1.quiz.nameNew}`)
      .click()
    await expectByAssertion(
      page.getByTestId('next-or-submit'),
      'not.be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('insert-live-quiz-name'),
      'have.value',
      data.course1.quiz.nameDupl
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('next-or-submit'),
      'not.be.disabled'
    )
    await expectByAssertion(
      page.getByTestId('insert-live-display-name'),
      'have.value',
      data.course1.quiz.displayNameNew
    )
    await page.getByTestId('insert-live-description').click()
    await expect(page.getByTestId('insert-live-description')).toContainText(
      data.course1.quiz.descriptionNew
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(page, '[data-cy="select-course"]', data.course1.name)
    await expect(page.getByTestId('select-course')).toContainText(
      data.course1.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('element-0-block-0'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-0'),
      'contain',
      data.SCML.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId('element-0-block-1'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-1'),
      'contain',
      data.SC.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.course1.quiz.nameDupl}`),
      'exist'
    )
  })

  test('Cleanup: Delete the duplicated live quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId(`activities`).click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.course1.quiz.nameDupl}{enter}`
    )
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.course1.quiz.nameDupl}`),
      'exist'
    )
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.course1.quiz.nameDupl}`)
      .click()
    await page
      .getByTestId(`delete-live-quiz-${data.course1.quiz.nameDupl}`)
      .click()
    await page.getByTestId(`confirmation-modal-cancel`).click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.course1.quiz.nameDupl}`)
      .click()
    await page
      .getByTestId(`delete-live-quiz-${data.course1.quiz.nameDupl}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`confirm-deletion-responses`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`confirm-deletion-qa-feedbacks`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`confirm-deletion-confusion-feedbacks`),
      'not.exist'
    )
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await expectByAssertion(
      page.getByText(data.course1.quiz.nameDupl).first(),
      'not.exist'
    )
  })

  test('Start the created live quizzes, abort it, and restart & complete it', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.course1.quiz.nameNew}{enter}`
    )
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.course1.quiz.nameNew}`),
      'exist'
    )
    await page
      .getByTestId(`start-live-quiz-${data.course1.quiz.nameNew}`)
      .click()
    await page.getByTestId('abort-live-quiz-cockpit').click()
    await page.getByTestId('abort-cancel-live-quiz').click()
    await page.getByTestId('abort-live-quiz-cockpit').click()
    await expectByAssertion(
      page.getByTestId('lq-deletion-responses-confirm'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('lq-deletion-feedbacks-confirm'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('lq-deletion-confusion-feedbacks-confirm'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('lq-deletion-leaderboard-entries-confirm'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('confirm-cancel-live-quiz'),
      'not.be.disabled'
    )
    await page.getByTestId('confirm-cancel-live-quiz').click()
    await page
      .getByTestId(`start-live-quiz-${data.course1.quiz.nameNew}`)
      .click()
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
  })

  test('Cleanup: Delete the created and completed live quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId(`activities`).click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.course1.quiz.nameNew}{enter}`
    )
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.course1.quiz.nameNew}`),
      'exist'
    )
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.course1.quiz.nameNew}`)
      .click()
    await page
      .getByTestId(`delete-live-quiz-${data.course1.quiz.nameNew}`)
      .click()
    await expectByAssertion(
      page.getByTestId(`confirm-deletion-responses`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`confirm-deletion-qa-feedbacks`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`confirm-deletion-confusion-feedbacks`),
      'not.exist'
    )
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await expectByAssertion(
      page.getByText(data.course1.quiz.nameNew).first(),
      'not.exist'
    )
  })

  test('Cleanup (DB): Hard delete soft-deleted live quiz directly in database', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const result = await runTask('removeSoftDeletedLiveQuiz', {
        lqName: data.course1.quiz.nameNew,
      })
      if (result === false) {
        throw new Error(
          'No soft deleted live quiz with this name has been found'
        )
      }
      await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
    }
  })

  test('Create and start a live quiz with all question types (with and without sample solution) to test the entire execution cycle', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('create-live-quiz').click()
    await typeInto(
      page.getByTestId('insert-live-quiz-name'),
      data.course2.quiz.name
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await typeInto(
      page.getByTestId('insert-live-display-name'),
      data.course2.quiz.displayName
    )
    await page.getByTestId('insert-live-description').click()
    await typeInto(
      page.getByTestId('insert-live-description'),
      data.course2.quiz.description
    )
    await page.getByTestId('insert-live-description').click()
    await expect(page.getByTestId('insert-live-description')).toContainText(
      data.course2.quiz.description
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await expect(page.getByTestId('select-course')).toContainText(
      messages.manage.activityWizard.liveQuizNoCourse
    )
    await expectByAssertion(page.getByTestId('select-multiplier'), 'not.exist')
    await selectOption(page, '[data-cy="select-course"]', data.course1.name)
    await expect(page.getByTestId('select-course')).toContainText(
      data.course1.name
    )
    await expectByAssertion(page.getByTestId('select-multiplier'), 'exist')
    await selectOption(page, '[data-cy="select-course"]', data.course2.name)
    await expect(page.getByTestId('select-course')).toContainText(
      data.course2.name
    )
    await expectByAssertion(page.getByTestId('select-multiplier'), 'not.exist')
    await selectOption(page, '[data-cy="select-course"]', data.course1.name)
    await expect(page.getByTestId('select-course')).toContainText(
      data.course1.name
    )
    await expectByAssertion(page.getByTestId('select-multiplier'), 'exist')
    await expectByAssertion(page.getByTestId('select-multiplier'), 'exist')
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier1
    )
    await page.getByTestId('select-multiplier').click()
    await page
      .getByTestId(
        `select-multiplier-${messages.manage.activityWizard.multiplier2}`
      )
      .click()
    await expect(page.getByTestId('select-multiplier')).toContainText(
      messages.manage.activityWizard.multiplier2
    )
    await page.getByTestId('set-liveqa-enabled').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await createStacks(page, {
      stacks: [
        {
          elements: [
            data.SCML.title,
            data.MCML.title,
            data.KPML.title,
            data.NR.title,
            data.FT.title,
            data.SE.title,
            data.CS.title,
            data.CT.title,
          ],
        },
        {
          elements: [
            data.SCML2.title,
            data.MCML2.title,
            data.KPML2.title,
            data.NRML2.title,
            data.FTML2.title,
            data.SEML2.title,
            data.CSML2.title,
            data.CT2.title,
          ],
        },
      ],
      type: 'block',
    })
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.course2.quiz.name}`),
      'exist'
    )
    await page.getByTestId(`start-live-quiz-${data.course2.quiz.name}`).click()
    await page.waitForTimeout(1000)
  })

  test('Check that the live quiz description is correctly shown to students', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentWithStoredPwaState(page)
    await openStudentLiveQuiz(data.course2.quiz.displayName)
    await expect(page.getByTestId('live-quiz-description')).toContainText(
      data.course2.quiz.displayName
    )
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.getByTestId('live-quiz-description')).toContainText(
      data.course2.quiz.displayName
    )
  })

  test('Start the first block of the live quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.course2.quiz.name}`)
      .click()
    await page.waitForTimeout(1000)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
  })

  test('Respond to the first block of the running live quiz from the student view', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentWithStoredPwaState(page)
    await openStudentLiveQuiz(data.course2.quiz.displayName)
    await acceptGamifiedLiveQuizAccountPrompt(data.course2.quiz.displayName)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await acceptGamifiedLiveQuizAccountPrompt(data.course2.quiz.displayName)
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await page.getByTestId('mc-1-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await page.getByTestId('feedback-input').click()
    await typeInto(
      page.getByTestId('feedback-input'),
      data.course2.quiz.feedbackDesktop
    )
    await page.getByTestId('feedback-submit').click()
    await expectByAssertion(
      page.getByText(data.course2.quiz.feedbackDesktop).first(),
      'not.exist'
    )
    await page.waitForTimeout(500)
    await rememberStudentPwaState(page)

    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.course2.quiz.name}`)
      .click()

    for (const { title, expected } of [
      { title: data.SCML.title, expected: 1 },
      { title: data.MCML.title, expected: 1 },
      { title: data.KPML.title, expected: 1 },
      { title: data.NR.title, expected: 0 },
    ]) {
      const elementLink = page
        .getByRole('link', { name: title, exact: false })
        .first()
      const linkTestId = await elementLink.getAttribute('data-cy')
      expect(linkTestId).toMatch(/^open-question-live-quiz-\d+$/)
      const instanceId = linkTestId!.replace('open-question-live-quiz-', '')
      const counts = page.getByTestId(`live-quiz-response-counts-${instanceId}`)

      const responseCountLabel = [
        messages.manage.cockpit.responsesReceived.replace(
          '{number}',
          String(expected)
        ),
        messages.manage.cockpit.responsesProcessed.replace(
          '{number}',
          String(expected)
        ),
      ].join(' · ')

      await expect(counts).toHaveAttribute('aria-label', responseCountLabel, {
        timeout: 30_000,
      })
    }
  })

  test('Test the live quiz functionalities on mobile devices', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await page.setViewportSize({ width: 375, height: 812 })
    await loginStudentWithStoredPwaState(page)
    await openStudentLiveQuiz(data.course2.quiz.displayName)
    await acceptGamifiedLiveQuizAccountPrompt(data.course2.quiz.displayName)
    const resumedAtNumericalQuestion = await page
      .getByText(data.NR.content)
      .first()
      .waitFor({ state: 'attached', timeout: 3000 })
      .then(() => true)
      .catch(() => false)

    if (!resumedAtNumericalQuestion) {
      if (await page.getByTestId('sc-0-answer-option-0').isVisible()) {
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await page.getByTestId('sc-0-answer-option-0').click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
      }

      if (await page.getByTestId('mc-1-answer-option-0').isVisible()) {
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await page.getByTestId('mc-1-answer-option-0').click()
        await page.getByTestId('mc-1-answer-option-1').click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
      }

      if (await page.getByTestId('toggle-kp-2-answer-0-correct').isVisible()) {
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
        await page.getByTestId('toggle-kp-2-answer-0-correct').click()
        await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
        await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
        await page.getByTestId('toggle-kp-2-answer-3-correct').click()
        await page.getByTestId('student-submit-answer').click()
        await page.waitForTimeout(500)
      }
    }

    await expectByAssertion(page.getByText(data.NR.content).first(), 'exist')
    await page.getByTestId('mobile-menu-leaderboard').click()
    await page.getByTestId('mobile-menu-feedbacks').click()
    await page.getByTestId('mobile-menu-questions').click()
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await page.getByTestId('input-numerical-3').clear()
    await typeInto(page.getByTestId('input-numerical-3'), data.NR.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await typeInto(page.getByTestId('free-text-input-4'), data.FT.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-1"]')
      .click()
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'not.be.disabled'
    )
    await page.locator('[id="selection-5-field-1"]').click()
    await page
      .locator('[id="react-select-selection-5-field-1-option-2"]')
      .click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await answerCaseStudy(page, {
      elementIx: 6,
      answers: data.CS.answers,
      cases: data.CS.cases,
      criteria: data.CS.criteria,
      initialValidation: async () => {
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
      },
      sequentialUI: true,
    })
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByText(messages.pwa.liveQuiz.allQuestionsAnswered).first(),
      'exist'
    )
    await page.getByTestId('mobile-menu-feedbacks').click()
    await page.getByTestId('feedback-input').click()
    await typeInto(
      page.getByTestId('feedback-input'),
      data.course2.quiz.feedbackMobile
    )
    await page.getByTestId('feedback-submit').click()
    await expectByAssertion(
      page.getByText(data.course2.quiz.feedbackDesktop).first(),
      'not.exist'
    )
    await expectByAssertion(
      page.getByText(data.course2.quiz.feedbackMobile).first(),
      'not.exist'
    )
    await page.waitForTimeout(500)
    await rememberStudentPwaState(page)
  })

  test('Start the second block of the live quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.course2.quiz.name}`)
      .click()
    await page.waitForTimeout(1000)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
  })

  test('Make feedbacks visible, respond to one and disable moderation', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.course2.quiz.name}`)
      .click()
    await page.waitForTimeout(1000)
    await page
      .getByTestId(`publish-feedback-${data.course2.quiz.feedbackDesktop}`)
      .click()
    await page
      .getByTestId(`publish-feedback-${data.course2.quiz.feedbackMobile}`)
      .click()
    await page
      .getByTestId(`open-feedback-${data.course2.quiz.feedbackDesktop}`)
      .click()
    await page
      .getByTestId(`respond-to-feedback-${data.course2.quiz.feedbackDesktop}`)
      .click()
    await typeInto(
      page.getByTestId(
        `respond-to-feedback-${data.course2.quiz.feedbackDesktop}`
      ),
      data.course2.quiz.feedbackResponse
    )
    await page
      .getByTestId(
        `submit-feedback-response-${data.course2.quiz.feedbackDesktop}`
      )
      .click()
    await page
      .getByTestId(`open-feedback-${data.course2.quiz.feedbackMobile}`)
      .click()
    await page
      .getByTestId(`pin-feedback-${data.course2.quiz.feedbackMobile}`)
      .click()
    await page
      .getByTestId(`pin-feedback-${data.course2.quiz.feedbackMobile}`)
      .click()
    await page.getByTestId('toggle-moderation').click()
  })

  test('Answer questions in second block from student view', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentWithStoredPwaState(page)
    await openStudentLiveQuiz(data.course2.quiz.displayName)
    await acceptGamifiedLiveQuizAccountPrompt(data.course2.quiz.displayName)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await acceptGamifiedLiveQuizAccountPrompt(data.course2.quiz.displayName)
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await page.getByTestId('mc-1-answer-option-0').click()
    await page.getByTestId('mc-1-answer-option-1').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await page.getByTestId('toggle-kp-2-answer-0-correct').click()
    await page.getByTestId('toggle-kp-2-answer-1-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-2-incorrect').click()
    await page.getByTestId('toggle-kp-2-answer-3-correct').click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await page.getByTestId('input-numerical-3').clear()
    await typeInto(page.getByTestId('input-numerical-3'), data.NR.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await typeInto(page.getByTestId('free-text-input-4'), data.FT.answer)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('student-submit-answer'),
      'be.disabled'
    )
    await page.locator('[id="selection-5-field-0"]').click()
    await page
      .locator('[id="react-select-selection-5-field-0-option-1"]')
      .click()
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await answerCaseStudy(page, {
      elementIx: 6,
      answers: data.CSML2.answers,
      cases: data.CSML2.cases,
      criteria: data.CSML2.criteria,
      initialValidation: async () => {
        await expectByAssertion(
          page.getByTestId('student-submit-answer'),
          'be.disabled'
        )
      },
      sequentialUI: true,
    })
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await page.getByTestId('student-submit-answer').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByText(messages.pwa.liveQuiz.allQuestionsAnswered).first(),
      'exist'
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expectByAssertion(
      page.getByText(messages.pwa.liveQuiz.allQuestionsAnswered).first(),
      'exist'
    )
    await rememberStudentPwaState(page)
  })

  test('Verify that the feedbacks and the given feedback response are visible to the student', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentWithStoredPwaState(page)
    await openStudentLiveQuiz(data.course2.quiz.displayName)
    await expectByAssertion(
      page.getByText(data.course2.quiz.feedbackDesktop).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByText(data.course2.quiz.feedbackMobile).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByText(data.course2.quiz.feedbackResponse).first(),
      'exist'
    )
    await page
      .getByTestId(`feedback-upvote-${data.course2.quiz.feedbackMobile}`)
      .click()
    await page
      .getByTestId(
        `feedback-response-upvote-${data.course2.quiz.feedbackResponse}`
      )
      .click()
    await page.getByTestId('feedback-input').click()
    await typeInto(
      page.getByTestId('feedback-input'),
      data.course2.quiz.feedbackDesktop2
    )
    await page.getByTestId('feedback-submit').click()
    await expectByAssertion(
      page.getByText(data.course2.quiz.feedbackDesktop2).first(),
      'exist'
    )
    await page.waitForTimeout(500)
  })

  test('Check out the public evaluation links accessible through the embedding modal', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.course2.quiz.name}`)
      .click()
    await page.waitForTimeout(1000)
    await page.getByTestId('embed-evaluation-cockpit').click()
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-generic-evaluation'
      )
      aliases.set('publicLinkEvaluation', text)
    }
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-0'
      )
      aliases.set('publicLinkQuestion0', text)
    }
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-6'
      )
      aliases.set('publicLinkQuestion6', text)
    }
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-7'
      )
      aliases.set('publicLinkQuestion7', text)
    }
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-9'
      )
      aliases.set('publicLinkQuestion9', text)
    }
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-leaderboard'
      )
      aliases.set('publicLinkLeaderboard', text)
    }
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear()).catch(() => undefined)
    await page.waitForTimeout(500)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/(?:127\.0\.0\.1:3010|auth\.klicker\.com)/)
    await expect(
      page.getByRole('heading', { name: 'Authentication' })
    ).toBeVisible()
    {
      const link = aliases.get('publicLinkEvaluation')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.SCML.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.MCML.content).first(), 'exist')
    await page.getByTestId('evaluate-previous-question').click()
    await expectByAssertion(page.getByText(data.SCML.content).first(), 'exist')
    {
      const link = aliases.get('publicLinkQuestion0')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.SCML.content).first(), 'exist')
    {
      const link = aliases.get('publicLinkQuestion6')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.CS.content).first(), 'exist')
    {
      const link = aliases.get('publicLinkQuestion7')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.CT.content).first(), 'exist')
    {
      const link = aliases.get('publicLinkQuestion9')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.MCML2.content).first(), 'exist')
    {
      const link = aliases.get('publicLinkLeaderboard')
      await gotoEmbeddingLink(page, link)
    }
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.course2.quiz.name}`)
      .click()
    await page.waitForTimeout(1000)
    await page.getByTestId('embed-evaluation-cockpit').click()
    await page.getByTestId('embedding-show-solution-switch').click()
    await page.getByTestId('embedding-show-explanation-switch').click()
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-0'
      )
      aliases.set('solutionEvaluationLink0', text)
    }
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-3'
      )
      aliases.set('solutionEvaluationLink3', text)
    }
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-7'
      )
      aliases.set('solutionEvaluationLink7', text)
    }
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-9'
      )
      aliases.set('solutionEvaluationLink9', text)
    }
    {
      const link = aliases.get('solutionEvaluationLink0')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.SCML.content).first(), 'exist')
    await expectByAssertion(
      page.getByText(data.SCML.explanation).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-solution'),
      'have.attr',
      'data-state',
      'checked'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-explanation'),
      'have.attr',
      'data-state',
      'checked'
    )
    {
      const link = aliases.get('solutionEvaluationLink3')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.NR.content).first(), 'exist')
    await expectByAssertion(
      page.getByText(data.NR.explanation).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-solution'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-explanation'),
      'have.attr',
      'data-state',
      'checked'
    )
    {
      const link = aliases.get('solutionEvaluationLink7')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.CT.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-solution'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-explanation'),
      'not.exist'
    )
    {
      const link = aliases.get('solutionEvaluationLink9')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.MCML2.content).first(), 'exist')
    await expectByAssertion(
      page.getByText(data.MCML2.explanation).first(),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-solution'),
      'have.attr',
      'data-state',
      'unchecked'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-explanation'),
      'have.attr',
      'data-state',
      'unchecked'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-solution'),
      'have.attr',
      'disabled',
      'disabled'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-explanation'),
      'have.attr',
      'disabled',
      'disabled'
    )
  })

  test('Check out the evaluation view of the live quiz and its content', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.course2.quiz.name}`)
      .click()
    await page.waitForTimeout(1000)
    await page.getByTestId('embed-evaluation-cockpit').click()
    await gotoEmbeddingLink(
      page,
      await readEmbeddingLink(page, 'open-embedding-link-generic-evaluation')
    )
    await expectByAssertion(page.getByText(data.SCML.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.MCML.content).first(), 'exist')
    await page.getByTestId('evaluate-previous-question').click()
    await expectByAssertion(page.getByText(data.SCML.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('evaluate-question-select'),
      'exist'
    )
    await expect(page.getByTestId('evaluate-question-select')).toContainText(
      data.SCML.title
    )
    await page.getByTestId('evaluate-question-select').click()
    await page
      .getByTestId(`evaluation-select-instance-${data.KPML.title}`)
      .click()
    await expect(page.getByTestId('evaluate-question-select')).toContainText(
      data.KPML.title
    )
    await page.getByTestId('evaluate-question-select').click()
    await page
      .getByTestId(`evaluation-select-instance-${data.SCML.title}`)
      .click()
    await expect(page.getByTestId('evaluate-question-select')).toContainText(
      data.SCML.title
    )
    await page.getByTestId('evaluate-next-question').click()
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.KPML.title).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.NR.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.FT.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.SE.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.CS.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.CT.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await showEvaluationResultsIfAvailable(page)
    await expectByAssertion(page.getByText(data.SCML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await showEvaluationResultsIfAvailable(page)
    await expectByAssertion(page.getByText(data.MCML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await showEvaluationResultsIfAvailable(page)
    await expectByAssertion(page.getByText(data.KPML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await showEvaluationResultsIfAvailable(page)
    await expectByAssertion(page.getByText(data.NRML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await showEvaluationResultsIfAvailable(page)
    await expectByAssertion(page.getByText(data.FTML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await showEvaluationResultsIfAvailable(page)
    await expectByAssertion(page.getByText(data.SEML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await showEvaluationResultsIfAvailable(page)
    await expectByAssertion(page.getByText(data.CSML2.content).first(), 'exist')
    await page.getByTestId('evaluate-next-question').click()
    await expectByAssertion(page.getByText(data.CT2.content).first(), 'exist')
    await page.getByTestId('evaluate-previous-question').click()
    await expectByAssertion(page.getByText(data.CSML2.content).first(), 'exist')
    await page.getByTestId('evaluate-previous-question').click()
    await page.getByTestId('evaluate-previous-question').click()
    await page.getByTestId('evaluate-previous-question').click()
    await expectByAssertion(page.getByText(data.NRML2.content).first(), 'exist')
    await page.getByTestId('evaluate-previous-question').click()
    await page.getByTestId('evaluate-previous-question').click()
    await page.getByTestId('evaluate-previous-question').click()
    await expectByAssertion(page.getByText(data.SCML2.content).first(), 'exist')
    await page.getByTestId('evaluate-previous-question').click()
    await expectByAssertion(page.getByText(data.CT.content).first(), 'exist')
    await page.getByTestId('evaluate-previous-question').click()
    await expectByAssertion(page.getByText(data.CS.content).first(), 'exist')
    await page.getByTestId('evaluate-previous-question').click()
    await expectByAssertion(page.getByText(data.SE.content).first(), 'exist')
    await page.getByTestId('evaluate-previous-question').click()
    await expectByAssertion(page.getByText(data.FT.content).first(), 'exist')
    await page.getByTestId('evaluate-previous-question').click()
    await page.getByTestId('evaluate-previous-question').click()
    await page.getByTestId('evaluate-previous-question').click()
    await expectByAssertion(page.getByText(data.MCML.title).first(), 'exist')
    await page.getByTestId('evaluate-stack-1').click()
    await expectByAssertion(page.getByText(data.SCML2.content).first(), 'exist')
    await page.getByTestId('evaluate-stack-0').click()
    await expectByAssertion(page.getByText(data.SCML.title).first(), 'exist')
    await page.getByTestId('evaluate-stack-1').click()
    await expectByAssertion(page.getByText(data.SCML2.content).first(), 'exist')
  })

  test('Close block and delete feedback / feedback response', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.course2.quiz.name}`)
      .click()
    await page.waitForTimeout(1000)
    await page.getByTestId('next-block-timeline').click()
    await page
      .getByTestId(`delete-feedback-${data.course2.quiz.feedbackMobile}`)
      .click()
    await page.getByTestId('confirm-feedback-deletion').click()
    await page
      .getByTestId(`open-feedback-${data.course2.quiz.feedbackDesktop}`)
      .click()
    await page
      .getByTestId(`delete-response-${data.course2.quiz.feedbackResponse}`)
      .click()
  })

  test('Verify that after closing the active live quiz block, the sample solution is shown', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.course2.quiz.name}`)
      .click()
    await page.waitForTimeout(1000)
    await page.getByTestId('embed-evaluation-cockpit').click()
    await page.getByTestId('embedding-show-solution-switch').click()
    await page.getByTestId('embedding-show-explanation-switch').click()
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-0'
      )
      aliases.set('solutionEvaluationLink0', text)
    }
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-3'
      )
      aliases.set('solutionEvaluationLink3', text)
    }
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-7'
      )
      aliases.set('solutionEvaluationLink7', text)
    }
    {
      const text = await readEmbeddingLink(
        page,
        'open-embedding-link-question-9'
      )
      aliases.set('solutionEvaluationLink9', text)
    }
    {
      const link = aliases.get('solutionEvaluationLink0')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.SCML.content).first(), 'exist')
    await expectByAssertion(
      page.getByText(data.SCML.explanation).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-solution'),
      'have.attr',
      'data-state',
      'checked'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-explanation'),
      'have.attr',
      'data-state',
      'checked'
    )
    {
      const link = aliases.get('solutionEvaluationLink3')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.NR.content).first(), 'exist')
    await expectByAssertion(
      page.getByText(data.NR.explanation).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-solution'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-explanation'),
      'have.attr',
      'data-state',
      'checked'
    )
    {
      const link = aliases.get('solutionEvaluationLink7')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.CT.content).first(), 'exist')
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-solution'),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-explanation'),
      'not.exist'
    )
    {
      const link = aliases.get('solutionEvaluationLink9')
      await gotoEmbeddingLink(page, link)
    }
    await expectByAssertion(page.getByText(data.MCML2.content).first(), 'exist')
    await expectByAssertion(
      page.getByText(data.MCML2.explanation).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-solution'),
      'have.attr',
      'data-state',
      'checked'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-explanation'),
      'have.attr',
      'data-state',
      'checked'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-solution'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
    await expectByAssertion(
      page.getByTestId('evaluation-footer-show-explanation'),
      'not.have.attr',
      'disabled',
      'disabled'
    )
  })

  test('Check that the deleted feedbacks are not visible anymore', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentWithStoredPwaState(page)
    await openStudentLiveQuiz(data.course2.quiz.displayName)
    await expectByAssertion(
      page.getByText(data.course2.quiz.feedbackDesktop).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByText(data.course2.quiz.feedbackDesktop2).first(),
      'exist'
    )
    await expectByAssertion(
      page.getByText(data.course2.quiz.feedbackMobile).first(),
      'not.exist'
    )
    await expectByAssertion(
      page.getByText(data.course2.quiz.feedbackResponse).first(),
      'not.exist'
    )
  })

  test('End live quiz on lecturer cockpit', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.course2.quiz.name}`)
      .click()
    await page.waitForTimeout(1000)
    await page.getByTestId('next-block-timeline').click()
  })

  test('Cleanup: Delete the live quiz used for the full cycle test', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId(`activities`).click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.course2.quiz.name}{enter}`
    )
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.course2.quiz.name}`),
      'exist'
    )
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.course2.quiz.name}`)
      .click()
    await page.getByTestId(`delete-live-quiz-${data.course2.quiz.name}`).click()
    await expectByAssertion(
      page.getByTestId(`confirmation-modal-confirm`),
      'be.disabled'
    )
    await confirmResponseDeletionIfAvailable(page)
    await page.getByTestId(`confirm-deletion-qa-feedbacks`).click()
    await expectByAssertion(
      page.getByTestId(`confirm-deletion-confusion-feedbacks`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`confirmation-modal-confirm`),
      'not.be.disabled'
    )
    await page.getByTestId(`confirmation-modal-cancel`).click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.course2.quiz.name}`)
      .click()
    await page.getByTestId(`delete-live-quiz-${data.course2.quiz.name}`).click()
    await expectByAssertion(
      page.getByTestId(`confirmation-modal-confirm`),
      'be.disabled'
    )
    await confirmResponseDeletionIfAvailable(page)
    await page.getByTestId(`confirm-deletion-qa-feedbacks`).click()
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await expectByAssertion(
      page.getByText(data.course2.quiz.name).first(),
      'not.exist'
    )
  })

  test('Cleanup (DB): Hard delete soft-deleted live quiz directly in database [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.waitForTimeout(2000)
    {
      const result = await runTask('removeSoftDeletedLiveQuiz', {
        lqName: data.course2.quiz.name,
      })
      if (result === false) {
        throw new Error(
          'No soft deleted live quiz with this name has been found'
        )
      }
      await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
    }
  })

  test('Create live quiz with a single SC question', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionSC(page, {
      name: data.SC2.title,
      content: data.SC2.content,
      choices: data.SC2.choices,
      userId: env('LECTURER_ID'),
    })
    await createLiveQuiz(page, {
      name: data.liveQuiz.name,
      displayName: data.liveQuiz.displayName,
      courseName: data.liveQuiz.course,
      blocks: [{ elements: [data.SC2.title] }],
    })
    await openActivitiesListForQuiz(page, data.liveQuiz.name)
    await page.getByTestId(`activity-name-${data.liveQuiz.name}`).click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.SC2.title
    )
    await page.getByTestId('close-activity-details-modal').click()
  })

  test('Edit the single choice question, edit and save the unmodified live quiz -> verify that nothing changed', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await editElement(page, { element: data.SC2.title })
    await page.getByTestId('instance-update-switch').click()
    await page.getByTestId('insert-question-title').clear()
    await typeInto(
      page.getByTestId('insert-question-title'),
      data.liveQuiz.newSCTitle
    )
    await page.getByTestId('insert-question-text').click()
    await page.getByTestId('insert-question-text').clear()
    await typeInto(
      page.getByTestId('insert-question-text'),
      data.liveQuiz.newSCContent
    )
    await page.getByTestId('save-new-question').click()
    await page.waitForTimeout(1000)
    await page.getByTestId('activities').click()
    await page.getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.name}`).click()
    await page.getByTestId(`edit-live-quiz-${data.liveQuiz.name}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-live-display-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('element-0-block-0'), 'exist')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await openActivitiesListForQuiz(page, data.liveQuiz.name)
    await page.getByTestId(`activity-name-${data.liveQuiz.name}`).click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.SC2.title
    )
    await page.getByTestId('close-activity-details-modal').click()
  })

  test('Add the modified single choice question and a multiple choice question to the live quiz', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionMC(page, {
      name: data.MC2.title,
      content: data.MC2.content,
      choices: data.MC2.choices,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('activities').click()
    await page.getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.name}`).click()
    await page.getByTestId(`edit-live-quiz-${data.liveQuiz.name}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-live-display-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('element-0-block-0'), 'exist')
    await dragAndDropElement(page, {
      element: data.liveQuiz.newSCTitle,
      target: 'drop-elements-block-0',
    })
    await expect(page.getByTestId(`element-1-block-0`)).toContainText(
      data.liveQuiz.newSCTitle.substring(0, 20)
    )
    await page.getByTestId('drop-elements-add-block').click()
    await dragAndDropElement(page, {
      element: data.MC2.title,
      target: 'drop-elements-block-1',
    })
    await expectByAssertion(page.getByTestId(`element-0-block-1`), 'exist')
    await expect(page.getByTestId(`element-0-block-1`)).toContainText(
      data.MC2.title.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await openActivitiesListForQuiz(page, data.liveQuiz.name)
    await page.getByTestId(`activity-name-${data.liveQuiz.name}`).click()
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.SC2.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      data.liveQuiz.newSCTitle
    )
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      data.MC2.title
    )
    await page.getByTestId('close-activity-details-modal').click()
  })

  test('Delete the two created elements and verify that the live quiz content is not modified on edit', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await deleteElement(page, { elementName: data.liveQuiz.newSCTitle })
    await deleteElement(page, { elementName: data.MC2.title })
    await page.getByTestId('activities').click()
    await page.getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.name}`).click()
    await page.getByTestId(`edit-live-quiz-${data.liveQuiz.name}`).click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(
      page.getByTestId('insert-live-display-name'),
      'exist'
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('select-course'), 'exist')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('move-block-0-right').click()
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await openActivitiesListForQuiz(page, data.liveQuiz.name)
    await page.getByTestId(`activity-name-${data.liveQuiz.name}`).click()
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      data.SC2.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      data.liveQuiz.newSCTitle
    )
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.MC2.title
    )
    await page.getByTestId('close-activity-details-modal').click()
  })

  test('Execute the live quiz, answer the questions and verify the question contents', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page.getByTestId(`start-live-quiz-${data.liveQuiz.name}`).click()
    await page.waitForTimeout(1000)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await loginStudentWithStoredPwaState(page)
    {
      const __originArgs = {
        data: data,
      }
      await page.getByTestId(`live-quiz-${data.liveQuiz.displayName}`).click()
      await expectByAssertion(
        page.getByTestId('student-submit-answer'),
        'be.disabled'
      )
      await expect(page.getByTestId('instance-question-content')).toContainText(
        data.MC2.content
      )
      await page.getByTestId('mc-0-answer-option-1').click()
      await page.getByTestId('mc-0-answer-option-2').click()
      await page.getByTestId('student-submit-answer').click()
      await page.waitForTimeout(500)
    }
  })

  test('Open the next block and answer the multiple choice question in the second block', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page.getByTestId(`live-quiz-cockpit-${data.liveQuiz.name}`).click()
    await page.waitForTimeout(1000)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await loginStudentWithStoredPwaState(page)
    {
      const __originArgs = {
        data: data,
      }
      await page.getByTestId(`live-quiz-${data.liveQuiz.displayName}`).click()
      await expectByAssertion(
        page.getByTestId('student-submit-answer'),
        'be.disabled'
      )
      await expect(page.getByTestId('instance-question-content')).toContainText(
        data.SC2.content
      )
      await page.getByTestId('sc-0-answer-option-0').click()
      await page.getByTestId('student-submit-answer').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId('student-submit-answer'),
        'be.disabled'
      )
      await expect(page.getByTestId('instance-question-content')).toContainText(
        data.liveQuiz.newSCContent
      )
      await page.getByTestId('sc-1-answer-option-0').click()
      await page.getByTestId('student-submit-answer').click()
      await page.waitForTimeout(500)
    }
  })

  test('Close the second block of the live quiz and end it', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page.getByTestId(`live-quiz-cockpit-${data.liveQuiz.name}`).click()
    await page.waitForTimeout(1000)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
  })

  test('Duplicate the live quiz and check that the same questions are contained therein', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.liveQuiz.name}{enter}`
    )
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.liveQuiz.name}`),
      'exist'
    )
    await page.getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.name}`).click()
    await page.getByTestId(`duplicate-live-quiz-${data.liveQuiz.name}`).click()
    await expectByAssertion(
      page.getByTestId('next-or-submit'),
      'not.be.disabled'
    )
    await page.getByTestId('insert-live-quiz-name').clear()
    await typeInto(
      page.getByTestId('insert-live-quiz-name'),
      data.liveQuiz.duplicateName
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await page.getByTestId('insert-live-display-name').clear()
    await typeInto(
      page.getByTestId('insert-live-display-name'),
      data.liveQuiz.duplicateDisplayName
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await selectOption(page, '[data-cy="select-course"]', data.liveQuiz.course)
    await expect(page.getByTestId('select-course')).toContainText(
      data.liveQuiz.course
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await expectByAssertion(page.getByTestId('element-0-block-0'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-0'),
      'contain',
      data.MC2.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId('element-0-block-1'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-0-block-1'),
      'contain',
      data.SC2.title.substring(0, 20)
    )
    await expectByAssertion(page.getByTestId('element-1-block-1'), 'exist')
    await expectByAssertion(
      page.getByTestId('element-1-block-1'),
      'contain',
      data.liveQuiz.newSCTitle.substring(0, 20)
    )
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)
    await openActivitiesListForQuiz(page, data.liveQuiz.duplicateName)
    await page
      .getByTestId(`activity-name-${data.liveQuiz.duplicateName}`)
      .click()
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      data.SC2.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      data.liveQuiz.newSCTitle
    )
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.MC2.title
    )
    await page.getByTestId('close-activity-details-modal').click()
  })

  test('Execute the duplicated live quiz, answer the questions and verify the question contents', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`start-live-quiz-${data.liveQuiz.duplicateName}`)
      .click()
    await page.waitForTimeout(1000)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await loginStudentWithStoredPwaState(page)
    {
      const __originArgs = {
        data: data,
      }
      await page
        .getByTestId(`live-quiz-${data.liveQuiz.duplicateDisplayName}`)
        .click()
      await expectByAssertion(
        page.getByTestId('student-submit-answer'),
        'be.disabled'
      )
      await expect(page.getByTestId('instance-question-content')).toContainText(
        data.MC2.content
      )
      await page.getByTestId('mc-0-answer-option-1').click()
      await page.getByTestId('mc-0-answer-option-2').click()
      await page.getByTestId('student-submit-answer').click()
      await page.waitForTimeout(500)
    }
  })

  test('Open the next block and answer the multiple choice question in the second block [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.liveQuiz.duplicateName}`)
      .click()
    await page.waitForTimeout(1000)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await loginStudentWithStoredPwaState(page)
    {
      const __originArgs = {
        data: data,
      }
      await page
        .getByTestId(`live-quiz-${data.liveQuiz.duplicateDisplayName}`)
        .click()
      await expectByAssertion(
        page.getByTestId('student-submit-answer'),
        'be.disabled'
      )
      await expect(page.getByTestId('instance-question-content')).toContainText(
        data.SC2.content
      )
      await page.getByTestId('sc-0-answer-option-0').click()
      await page.getByTestId('student-submit-answer').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId('student-submit-answer'),
        'be.disabled'
      )
      await expect(page.getByTestId('instance-question-content')).toContainText(
        data.liveQuiz.newSCContent
      )
      await page.getByTestId('sc-1-answer-option-0').click()
      await page.getByTestId('student-submit-answer').click()
      await page.waitForTimeout(500)
    }
  })

  test('Close the second block of the live quiz and end it [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page
      .getByTestId(`live-quiz-cockpit-${data.liveQuiz.duplicateName}`)
      .click()
    await page.waitForTimeout(1000)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
  })

  test('Delete the created live quizzes', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page.getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.name}`).click()
    await page.getByTestId(`delete-live-quiz-${data.liveQuiz.name}`).click()
    await confirmResponseDeletionIfAvailable(page)
    await clickIfVisible(page, 'confirm-deletion-qa-feedbacks')
    await clickIfVisible(page, 'confirm-deletion-confusion-feedbacks')
    await page.getByTestId(`confirmation-modal-confirm`).click()
    await page
      .getByTestId(`actions-LIVE_QUIZ-${data.liveQuiz.duplicateName}`)
      .click()
    await page
      .getByTestId(`delete-live-quiz-${data.liveQuiz.duplicateName}`)
      .click()
    await confirmResponseDeletionIfAvailable(page)
    await clickIfVisible(page, 'confirm-deletion-qa-feedbacks')
    await clickIfVisible(page, 'confirm-deletion-confusion-feedbacks')
    await page.getByTestId(`confirmation-modal-confirm`).click()
  })

  test('Create four different live quizzes and make sure that all required actions are shown to the object owner', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    for (let i = 1; i <= 4; i++) {
      await createLiveQuiz(page, {
        name: data.sharing[`quiz${i}`],
        displayName: data.sharing[`quiz${i}Display`],
        blocks: [
          {
            elements: [
              data.SCML.title,
              data.MCML.title,
              data.KPML.title,
              data.NRML.title,
              data.FTML.title,
              data.SEML.title,
              data.CSML.title,
              data.CT.title,
            ],
          },
        ],
      })
      await page.getByTestId('create-new-activity').click()
    }
    {
      const result = await runTask('changeActivityStatus', {
        activityName: data.sharing.quiz2,
        activityType: 'LIVE_QUIZ',
        status: 'SCHEDULED',
      })
      if (result === false) {
        throw new Error(
          'Live quiz to change status was not found in the database'
        )
      }
    }
    {
      const result = await runTask('changeActivityStatus', {
        activityName: data.sharing.quiz3,
        activityType: 'LIVE_QUIZ',
        status: 'PUBLISHED',
      })
      if (result === false) {
        throw new Error(
          'Live quiz to change status was not found in the database'
        )
      }
    }
    {
      const result = await runTask('changeActivityStatus', {
        activityName: data.sharing.quiz4,
        activityType: 'LIVE_QUIZ',
        status: 'ENDED',
      })
      if (result === false) {
        throw new Error(
          'Live quiz to change status was not found in the database'
        )
      }
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('activities').click()
    await verifyLiveQuizOwnerPermissions(data)
  })

  test('Share the live quizzes individually with different users and different permissions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).entries()) {
      await page.getByTestId(`actions-LIVE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-live-quiz-${quiz}`).click()
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_IND_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsREAD
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsREAD)
      await submitAndVerifyPermission(
        env('LECTURER_IND_SHORTNAME'),
        messages.manage.sharing.permissionsREAD
      )
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_INST_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsEXECUTE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsEXECUTE)
      await submitAndVerifyPermission(
        env('LECTURER_INST_SHORTNAME'),
        messages.manage.sharing.permissionsEXECUTE
      )
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_INST2_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsWRITE)
      await submitAndVerifyPermission(
        env('LECTURER_INST2_SHORTNAME'),
        messages.manage.sharing.permissionsWRITE
      )
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_INST3_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsADMIN
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsADMIN)
      await submitAndVerifyPermission(
        env('LECTURER_INST3_SHORTNAME'),
        messages.manage.sharing.permissionsADMIN
      )
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Log in as the user with READ permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyLiveQuizREADPermissions(data, false)
  })

  test('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyLiveQuizEXECUTEPermissions(data, false)
  })

  test('Log in as the user with WRITE permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyLiveQuizWRITEPermissions(data, false)
  })

  test('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyLiveQuizADMINPermissions(data, false)
  })

  test('Revoke the direct individual permissions for all users through the activity owner account', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    const quizzes = [
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]
    const users = [
      env('LECTURER_IND_SHORTNAME'),
      env('LECTURER_INST_SHORTNAME'),
      env('LECTURER_INST2_SHORTNAME'),
      env('LECTURER_INST3_SHORTNAME'),
    ]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await page.getByTestId(`actions-LIVE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-live-quiz-${quiz}`).click()
      for (const [__index, user] of Array.from(users).entries()) {
        await expectByAssertion(page.getByTestId(`permission-${user}`), 'exist')
        await page.getByTestId(`revoke-permission-${user}`).click()
        await page.getByTestId('confirm-revocation').click()
        await expectByAssertion(
          page.getByTestId(`permission-${user}`),
          'not.exist'
        )
      }
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Verify that user with previous READ permissions can no longer see / access the activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyREADPermissionsRevoked(data)
  })

  test('Verify that user with previous EXECUTE permissions can no longer see / access the activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyEXECUTEPermissionsRevoked(data)
  })

  test('Verify that user with previous WRITE permissions can no longer see / access the activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyWRITEPermissionsRevoked(data)
  })

  test('Verify that user with previous ADMIN permissions can no longer see / access the activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyADMINPermissionsRevoked(data)
  })

  test('Create user groups with users 2, 3, 4, and 5 as members, admins or owners and share the live quizzes with them', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await expectByAssertion(page.getByTestId('analytics'), 'exist')
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.sharing.group1)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_IND_SHORTNAME')
    )
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.sharing.group1}`),
      'exist'
    )
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.sharing.group2)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_INST_SHORTNAME')
    )
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.sharing.group2}`),
      'exist'
    )
    await loginInstitutionalCatalyst2(page)
    await expectByAssertion(page.getByTestId('analytics'), 'exist')
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.sharing.group3)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_EMAIL')
    )
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.sharing.group3}`),
      'exist'
    )
    await loginInstitutionalCatalyst3(page)
    await expectByAssertion(page.getByTestId('analytics'), 'exist')
    await page.getByTestId('resources').click()
    await page.getByTestId('user-groups').click()
    await page.getByTestId('create-user-group').click()
    await page.getByTestId('user-group-name').click()
    await typeInto(page.getByTestId('user-group-name'), data.sharing.group4)
    await page.getByTestId('member-shortname-email-0').click()
    await typeInto(
      page.getByTestId('member-shortname-email-0'),
      env('LECTURER_EMAIL')
    )
    await page.getByTestId('member-admin-0').click()
    await page.getByTestId('submit-create-user-group').click()
    await expectByAssertion(
      page.getByTestId(`user-group-${data.sharing.group4}`),
      'exist'
    )
    await logoutUser(page)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).entries()) {
      await page.getByTestId(`actions-LIVE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-live-quiz-${quiz}`).click()
      await selectOption(
        page,
        '[data-cy="new-permission-user-group"]',
        data.sharing.group1
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsREAD
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsREAD)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${data.sharing.group1}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${data.sharing.group1}`)
          .filter({ hasText: messages.manage.sharing.permissionsREAD })
          .first()
      ).toBeAttached()
      await selectOption(
        page,
        '[data-cy="new-permission-user-group"]',
        data.sharing.group2
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsEXECUTE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsEXECUTE)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${data.sharing.group2}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${data.sharing.group2}`)
          .filter({ hasText: messages.manage.sharing.permissionsEXECUTE })
          .first()
      ).toBeAttached()
      await selectOption(
        page,
        '[data-cy="new-permission-user-group"]',
        data.sharing.group3
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsWRITE)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${data.sharing.group3}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${data.sharing.group3}`)
          .filter({ hasText: messages.manage.sharing.permissionsWRITE })
          .first()
      ).toBeAttached()
      await selectOption(
        page,
        '[data-cy="new-permission-user-group"]',
        data.sharing.group4
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsADMIN
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsADMIN)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${data.sharing.group4}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${data.sharing.group4}`)
          .filter({ hasText: messages.manage.sharing.permissionsADMIN })
          .first()
      ).toBeAttached()
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Log in as the user with READ permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyLiveQuizREADPermissions(data, true)
  })

  test('Log in as the user with EXECUTE permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyLiveQuizEXECUTEPermissions(data, true)
  })

  test('Log in as the user with WRITE permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyLiveQuizWRITEPermissions(data, true)
  })

  test('Log in as the user with ADMIN permissions on all activities and check that the correct actions are available [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyLiveQuizADMINPermissions(data, true)
  })

  test('Revoke the direct group permissions for all users through the activity owner account', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    const quizzes = [
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]
    const groups = [
      data.sharing.group1,
      data.sharing.group2,
      data.sharing.group3,
      data.sharing.group4,
    ]
    for (const [__index, quiz] of Array.from(quizzes).entries()) {
      await page.getByTestId(`actions-LIVE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-live-quiz-${quiz}`).click()
      for (const [__index, group] of Array.from(groups).entries()) {
        await expectByAssertion(
          page.getByTestId(`permission-${group}`),
          'exist'
        )
        await page.getByTestId(`revoke-permission-${group}`).click()
        await page.getByTestId('confirm-revocation').click()
        await expectByAssertion(
          page.getByTestId(`permission-${group}`),
          'not.exist'
        )
      }
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Verify that user with previous READ permissions can no longer see / access the activity [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyREADPermissionsRevoked(data)
  })

  test('Verify that user with previous EXECUTE permissions can no longer see / access the activity [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyEXECUTEPermissionsRevoked(data)
  })

  test('Verify that user with previous WRITE permissions can no longer see / access the activity [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyWRITEPermissionsRevoked(data)
  })

  test('Verify that user with previous ADMIN permissions can no longer see / access the activity [2]', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await verifyADMINPermissionsRevoked(data)
  })

  test("Transfer ownership of all live quizzes to user 'pro1' using the username", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).entries()) {
      await page.getByTestId(`actions-LIVE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-live-quiz-${quiz}`).click()
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_IND_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsWRITE)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
          .filter({ hasText: messages.manage.sharing.permissionsWRITE })
          .first()
      ).toBeAttached()
      await page.getByTestId('transfer-ownership').click()
      await typeInto(
        page.getByTestId('new-owner-username-email-input'),
        env('LECTURER_IND_SHORTNAME')
      )
      await page.getByTestId('confirm-ownership-transfer').click()
      await expectByAssertion(
        page.getByTestId('transfer-ownership'),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
        'not.exist'
      )
      await expect(
        page
          .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
          .filter({ hasText: messages.manage.sharing.permissionsADMIN })
          .first()
      ).toBeAttached()
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test("Verify that user 'pro1' is the new owner and transfer the ownership back to the main user", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    await verifyLiveQuizOwnerPermissions(data)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).entries()) {
      await page.getByTestId(`actions-LIVE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-live-quiz-${quiz}`).click()
      await page.getByTestId('new-permission-username-or-email').click()
      await typeInto(
        page.getByTestId('new-permission-username-or-email'),
        env('LECTURER_SHORTNAME')
      )
      await selectOption(
        page,
        '[data-cy="new-permission-access-level"]',
        messages.manage.sharing.permissionsWRITE
      )
      await expect(
        page.getByTestId('new-permission-access-level')
      ).toContainText(messages.manage.sharing.permissionsWRITE)
      await page.getByTestId('new-permission-submit').click()
      await page.waitForTimeout(500)
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_SHORTNAME')}`),
        'exist'
      )
      await expect(
        page
          .getByTestId(`permission-${env('LECTURER_SHORTNAME')}`)
          .filter({ hasText: messages.manage.sharing.permissionsWRITE })
          .first()
      ).toBeAttached()
      await page.getByTestId('transfer-ownership').click()
      await typeInto(
        page.getByTestId('new-owner-username-email-input'),
        env('LECTURER_SHORTNAME')
      )
      await page.getByTestId('confirm-ownership-transfer').click()
      await expectByAssertion(
        page.getByTestId('transfer-ownership'),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_SHORTNAME')}`),
        'not.exist'
      )
      await expect(
        page
          .getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`)
          .filter({ hasText: messages.manage.sharing.permissionsADMIN })
          .first()
      ).toBeAttached()
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test("Remove the shared live quizzes from user 'pro1' using the removal functionality", async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginIndividualCatalyst(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).entries()) {
      await page.getByTestId(`actions-LIVE_QUIZ-${quiz}`).click()
      await page.getByTestId(`remove-live-quiz-${quiz}`).click()
      await page.getByTestId('confirm-deletion-final').click()
      await page.getByTestId('confirm-derived-access').click()
      await page.getByTestId('confirm-dependency-access').click()
      await page.getByTestId('confirmation-modal-confirm').click()
      await expectByAssertion(
        page.getByTestId(`activity-LIVE_QUIZ-${quiz}`),
        'not.exist'
      )
      await expectByAssertion(
        page.getByTestId('confirmation-modal-close'),
        'not.exist'
      )
    }
    await logoutUser(page)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    for (const [__index, quiz] of Array.from([
      data.sharing.quiz1,
      data.sharing.quiz2,
      data.sharing.quiz3,
      data.sharing.quiz4,
    ]).entries()) {
      await page.getByTestId(`actions-LIVE_QUIZ-${quiz}`).click()
      await page.getByTestId(`share-live-quiz-${quiz}`).click()
      await expectByAssertion(
        page.getByTestId(`permission-${env('LECTURER_IND_SHORTNAME')}`),
        'not.exist'
      )
      await page.getByTestId(`close-share-object`).click()
    }
  })

  test('Create a gamified live quiz on which the different access modes can be tested and other activity types to validate limitations of live-quiz specific temporary accounts', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createLiveQuiz(page, {
      name: data.modes.name,
      displayName: data.modes.displayName,
      courseName: data.modes.course,
      blocks: [
        { elements: [data.SCML.title] },
        { elements: [data.MCML.title] },
      ],
    })
    await page.getByTestId('create-new-activity').click()
    await createPracticeQuiz(page, {
      name: data.modes.practiceQuizName,
      displayName: data.modes.practiceQuizDisplayName,
      courseName: data.modes.course,
      stacks: [
        { elements: [data.SCML.title] },
        { elements: [data.MCML.title] },
      ],
    })
    await page.getByTestId('create-new-activity').click()
    await createMicroLearning(page, {
      name: data.modes.microLearningName,
      displayName: data.modes.microLearningDisplayName,
      courseName: data.modes.course,
      startDate: {
        monthDelta: -3,
        day: 16,
        hour: 2,
        minute: 0,
        validation: getDatetimeValidationString(-3, '16') + ', 02:00',
      }, // 3 months in the past at 2:00
      endDate: {
        monthDelta: 3,
        day: 14,
        hour: 18,
        minute: 0,
        validation: getDatetimeValidationString(3, '14') + ', 18:00',
      }, // 3 months in the future at 18:00
      stacks: [
        { elements: [data.SCML.title] },
        { elements: [data.MCML.title] },
      ],
    })
    await page.getByTestId('create-new-activity').click()
    await page.getByTestId('activities').click()
    await page.getByTestId(`start-live-quiz-${data.modes.name}`).click()
    await page.getByTestId('next-block-timeline').click()
    await page.waitForTimeout(500)
  })

  test('Choose anonymous participation in live quiz and verify the correct availability of account actions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('running-live-quiz-dropdown').click()
    await page.getByTestId(`running-live-quiz-${data.modes.name}`).click()
    await page.getByTestId('open-qr-modal').click()
    aliases.set(
      'quizLink',
      await page.getByTestId('qr-link-direct').textContent()
    )
    {
      const quizLink = aliases.get('quizLink')
      await page.context().clearCookies()
      await page.evaluate(() => localStorage.clear()).catch(() => undefined)
      await page.goto(String(quizLink), { waitUntil: 'commit' })
      {
        const __originArgs = {
          username: env('STUDENT_USERNAME'),
          password: env('STUDENT_PASSWORD'),
          messages,
          data: data,
        }
        const username = __originArgs.username
        const password = __originArgs.password
        await page.getByTestId('participate-anonymously').click()
        await expectByAssertion(
          page.getByTestId('participate-anonymously'),
          'not.exist'
        )
        await page.getByTestId('header-avatar').click()
        await expectByAssertion(
          page.getByTestId('header-logged-in-as'),
          'not.exist'
        )
        await expectByAssertion(
          page.getByTestId('header-setup-profile'),
          'not.exist'
        )
        await expectByAssertion(
          page.getByTestId('participant-profile-login'),
          'exist'
        )
        await expect(
          page.getByTestId('participant-profile-login')
        ).toContainText(messages.shared.generic.login)
        await expectByAssertion(page.getByTestId('course-docs'), 'exist')
        await expectByAssertion(page.getByTestId('language-switch'), 'exist')
        await expectByAssertion(page.getByTestId('logout'), 'not.exist')
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expectByAssertion(
          page.getByTestId('participate-anonymously'),
          'not.exist'
        )
        await page.getByTestId('header-avatar').click()
        await page.getByTestId('participant-profile-login').click()
        await page.getByTestId('username-field').fill(username)
        await page.getByTestId('password-field').fill(password)
        await page.getByTestId('submit-login').click()
        await page.waitForTimeout(500)
        await copyLocalParticipantTokenToKlickerDomain()
        await page.goto(env('URL_STUDENT'), { waitUntil: 'commit' })

        const liveQuizTile = page.getByTestId(
          `live-quiz-${data.modes.displayName}`
        )
        const homepageVisible = await liveQuizTile
          .waitFor({ state: 'visible', timeout: 15_000 })
          .then(() => true)
          .catch(() => false)

        if (homepageVisible) {
          await liveQuizTile.click()
          await page.waitForTimeout(1000)
        } else {
          await page.goto(String(quizLink), { waitUntil: 'commit' })
          await expect(page.getByTestId('header-page-title')).toContainText(
            data.modes.displayName
          )
        }

        await page.getByTestId('header-avatar').click()
        await expectByAssertion(
          page.getByTestId('header-logged-in-as'),
          'exist'
        )
        await expect(page.getByTestId('header-logged-in-as')).toContainText(
          username
        )
        await expectByAssertion(
          page.getByTestId('participant-profile-login'),
          'exist'
        )
        await expect(
          page.getByTestId('participant-profile-login')
        ).toContainText(messages.shared.generic.profile)
        await expectByAssertion(page.getByTestId('course-docs'), 'exist')
        await expectByAssertion(page.getByTestId('language-switch'), 'exist')
        await expectByAssertion(page.getByTestId('logout'), 'exist')
      }
    }
  })

  test('Choose a temporary pseudonymm and verify the correct availability of account actions', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('running-live-quiz-dropdown').click()
    await page.getByTestId(`running-live-quiz-${data.modes.name}`).click()
    await page.getByTestId('open-qr-modal').click()
    aliases.set(
      'quizLink',
      await page.getByTestId('qr-link-direct').textContent()
    )
    {
      const quizLink = aliases.get('quizLink')
      await page.context().clearCookies()
      await page.evaluate(() => localStorage.clear()).catch(() => undefined)
      await page.goto(String(quizLink), { waitUntil: 'commit' })
      {
        const __originArgs = { data: data }
        await page.getByTestId('create-temporary-pseudonym').click()
        await page.getByTestId('cancel-define-pseudonym').click()
        await page.getByTestId('create-temporary-pseudonym').click()
        await page.getByTestId('pseudonym-input').click()
        await typeInto(
          page.getByTestId('pseudonym-input'),
          data.modes.pseudonym
        )
        await page.getByTestId('pseudonym-next-step').click()
        await page.getByTestId('cancel-choose-avatar').click()
        await expectByAssertion(
          page.getByTestId('pseudonym-input'),
          'have.value',
          data.modes.pseudonym
        )
        await page.getByTestId('pseudonym-next-step').click()
        await expectByAssertion(
          page.getByTestId('submit-pseudonym-and-avatar'),
          'not.be.disabled'
        )
        await page.getByTestId('avatar-carousel-next').click()
        await page.getByTestId('avatar-carousel-next').click()
        await page.getByTestId('avatar-carousel-prev').click()
        await submitPseudonymAndAvatar()
        await page.getByTestId('header-avatar').click()
        await expectByAssertion(
          page.getByTestId('header-logged-in-as'),
          'exist'
        )
        await expect(page.getByTestId('header-logged-in-as')).toContainText(
          data.modes.pseudonym
        )
        await expectByAssertion(
          page.getByTestId('header-setup-profile'),
          'not.exist'
        )
        await expectByAssertion(
          page.getByTestId('participant-profile-login'),
          'not.exist'
        )
        await expectByAssertion(page.getByTestId('course-docs'), 'exist')
        await expectByAssertion(page.getByTestId('language-switch'), 'exist')
        await expectByAssertion(page.getByTestId('logout'), 'exist')
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expectByAssertion(
          page.getByTestId('create-temporary-pseudonym'),
          'not.exist'
        )
        await page.getByTestId('header-avatar').click()
        await expectByAssertion(
          page.getByTestId('header-logged-in-as'),
          'exist'
        )
        await expect(page.getByTestId('header-logged-in-as')).toContainText(
          data.modes.pseudonym
        )
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.getByTestId('header-avatar').click()
        await page.getByTestId('logout').click()
        await page.getByTestId('create-temporary-pseudonym').click()
        await typeInto(
          page.getByTestId('pseudonym-input'),
          data.modes.pseudonym2
        )
        await page.getByTestId('pseudonym-next-step').click()
        await submitPseudonymAndAvatar()
        await page.getByTestId('header-avatar').click()
        await expectByAssertion(
          page.getByTestId('header-logged-in-as'),
          'exist'
        )
        await expect(page.getByTestId('header-logged-in-as')).toContainText(
          data.modes.pseudonym2
        )
      }
    }
  })

  test('Log in as a regular user and verify that all redirects work correctly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('running-live-quiz-dropdown').click()
    await page.getByTestId(`running-live-quiz-${data.modes.name}`).click()
    await page.getByTestId('open-qr-modal').click()
    aliases.set(
      'quizLink',
      await page.getByTestId('qr-link-direct').textContent()
    )
    {
      const quizLink = aliases.get('quizLink')
      await page.context().clearCookies()
      await page.evaluate(() => localStorage.clear()).catch(() => undefined)
      await page.goto(String(quizLink), { waitUntil: 'commit' })
      {
        const __originArgs = {
          username: env('STUDENT_USERNAME'),
          password: env('STUDENT_PASSWORD'),
          quizName: data.modes.displayName,
          messages,
        }
        const username = __originArgs.username
        const password = __originArgs.password
        const quizName = __originArgs.quizName
        await page.getByTestId('login-with-account').click()
        await typeInto(page.getByTestId('username-field'), username)
        await typeInto(page.getByTestId('password-field'), password)
        await page.getByTestId('submit-login').click()
        await page.waitForTimeout(500)
        await copyLocalParticipantTokenToKlickerDomain()
        await page.goto(String(quizLink), { waitUntil: 'commit' })
        await expect(page.getByTestId('header-page-title')).toContainText(
          quizName
        )
        await page.getByTestId('header-avatar').click()
        await expectByAssertion(
          page.getByTestId('header-logged-in-as'),
          'exist'
        )
        await expect(page.getByTestId('header-logged-in-as')).toContainText(
          username
        )
        await expectByAssertion(
          page.getByTestId('participant-profile-login'),
          'exist'
        )
        await expect(
          page.getByTestId('participant-profile-login')
        ).toContainText(messages.shared.generic.profile)
        await expectByAssertion(page.getByTestId('course-docs'), 'exist')
        await expectByAssertion(page.getByTestId('language-switch'), 'exist')
        await expectByAssertion(page.getByTestId('logout'), 'exist')
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.getByTestId('header-avatar').click()
        await expectByAssertion(
          page.getByTestId('header-logged-in-as'),
          'exist'
        )
        await expect(page.getByTestId('header-logged-in-as')).toContainText(
          username
        )
      }
    }
  })

  test('Visit the live quiz leaderboard and check out that valid temporary participants are visible', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page.getByTestId(`live-quiz-cockpit-${data.modes.name}`).click()
    await page.waitForTimeout(1000)
    await page.getByTestId('embed-evaluation-cockpit').click()
    await gotoEmbeddingLink(
      page,
      await readEmbeddingLink(page, 'open-embedding-link-leaderboard')
    )
    await expectByAssertion(
      page.getByTestId(`leaderboard-entry-${data.modes.pseudonym}`),
      'not.exist'
    )
    await expectByAssertion(
      page.getByTestId(`leaderboard-entry-${data.modes.pseudonym2}`),
      'exist'
    )
    await expect(
      page.getByTestId(`leaderboard-entry-${data.modes.pseudonym2}`)
    ).toContainText(data.modes.pseudonym2)
  })

  test('Create a live quiz in a gamified course and validate that points are shown correctly', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createLiveQuiz(page, {
      name: data.details.name,
      displayName: data.details.displayName,
      courseName: data.details.courseName,
      multiplier: messages.manage.activityWizard.multiplier2,
      blocks: [
        {
          elements: [
            data.SC.title,
            data.MC.title,
            data.KP.title,
            data.NR.title,
            data.FT.title,
            data.SE.title,
            data.CS.title,
            data.CT.title,
          ],
        },
        {
          elements: [
            data.SCML.title,
            data.MCML.title,
            data.NRML.title,
            data.FTML.title,
            data.SEML.title,
            data.CSML.title,
            data.CT2.title,
          ],
        },
      ],
    })
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.details.name}`),
      'exist'
    )
    await page.getByTestId(`activity-name-${data.details.name}`).click()
    await assertActivityPoints(page, {
      basePoints: 130,
      correctnessPoints: 60,
      bonusPoints: 540,
      totalPoints: 730,
    })
    await expect(
      page.getByTestId('activity-details-stack-header-0')
    ).toContainText('70 P.')
    await expect(
      page.getByTestId('activity-details-stack-header-1')
    ).toContainText('660 P.')
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.SC.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      data.MC.title
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      data.KP.title
    )
    await expect(page.getByTestId('stack-0-instance-3')).toContainText(
      data.NR.title
    )
    await expect(page.getByTestId('stack-0-instance-4')).toContainText(
      data.FT.title
    )
    await expect(page.getByTestId('stack-0-instance-5')).toContainText(
      data.SE.title
    )
    await expect(page.getByTestId('stack-0-instance-6')).toContainText(
      data.CS.title
    )
    await expect(page.getByTestId('stack-0-instance-7')).toContainText(
      data.CT.title
    )
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 0,
    })
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 1,
    })
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 2,
    })
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 3,
    })
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 4,
    })
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 5,
    })
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 10,
      stackIx: 0,
      instanceIx: 6,
    })
    await assertInstancePoints(page, {
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      stackIx: 0,
      instanceIx: 7,
    })
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      data.MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      data.NRML.title
    )
    await expect(page.getByTestId('stack-1-instance-3')).toContainText(
      data.FTML.title
    )
    await expect(page.getByTestId('stack-1-instance-4')).toContainText(
      data.SEML.title
    )
    await expect(page.getByTestId('stack-1-instance-5')).toContainText(
      data.CSML.title
    )
    await expect(page.getByTestId('stack-1-instance-6')).toContainText(
      data.CT2.title
    )
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 0,
    })
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 1,
    })
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 2,
    })
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 3,
    })
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 4,
    })
    await assertInstancePoints(page, {
      basePoints: 10,
      correctnessPoints: 10,
      bonusPoints: 90,
      totalPoints: 110,
      stackIx: 1,
      instanceIx: 5,
    })
    await assertInstancePoints(page, {
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      stackIx: 1,
      instanceIx: 6,
    })
    await page.getByTestId('close-activity-details-modal').click()
  })

  test('Create live quiz in a non-gamified course and validate that no points are shown', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createLiveQuiz(page, {
      name: data.details.nameNonGamified,
      displayName: data.details.displayNameNonGamified,
      courseName: data.details.courseNonGamified,
      blocks: [
        {
          elements: [
            data.SC.title,
            data.MC.title,
            data.KP.title,
            data.NR.title,
            data.FT.title,
            data.SE.title,
            data.CS.title,
            data.CT.title,
          ],
        },
        {
          elements: [
            data.SCML.title,
            data.MCML.title,
            data.NRML.title,
            data.FTML.title,
            data.SEML.title,
            data.CSML.title,
            data.CT2.title,
          ],
        },
      ],
    })
    await page.getByTestId('open-activity-overview').click()
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.details.nameNonGamified}`),
      'exist'
    )
    await page
      .getByTestId(`activity-name-${data.details.nameNonGamified}`)
      .click()
    await assertNoActivityPoints(page)
    await expectByAssertion(
      page.getByTestId('activity-details-stack-header-0'),
      'not.contain',
      '70 P.'
    )
    await expectByAssertion(
      page.getByTestId('activity-details-stack-header-1'),
      'not.contain',
      '660 P.'
    )
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.SC.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      data.MC.title
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      data.KP.title
    )
    await expect(page.getByTestId('stack-0-instance-3')).toContainText(
      data.NR.title
    )
    await expect(page.getByTestId('stack-0-instance-4')).toContainText(
      data.FT.title
    )
    await expect(page.getByTestId('stack-0-instance-5')).toContainText(
      data.SE.title
    )
    await expect(page.getByTestId('stack-0-instance-6')).toContainText(
      data.CS.title
    )
    await expect(page.getByTestId('stack-0-instance-7')).toContainText(
      data.CT.title
    )
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 0,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 1,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 2,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 3,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 4,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 5,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 6,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 7,
    })
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      data.MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      data.NRML.title
    )
    await expect(page.getByTestId('stack-1-instance-3')).toContainText(
      data.FTML.title
    )
    await expect(page.getByTestId('stack-1-instance-4')).toContainText(
      data.SEML.title
    )
    await expect(page.getByTestId('stack-1-instance-5')).toContainText(
      data.CSML.title
    )
    await expect(page.getByTestId('stack-1-instance-6')).toContainText(
      data.CT2.title
    )
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 0,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 1,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 2,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 3,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 4,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 5,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 6,
    })
    await page.getByTestId('close-activity-details-modal').click()
  })

  test('Create live quiz without course assignment and validate that no points are shown', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createLiveQuiz(page, {
      name: data.details.nameNoCourse,
      displayName: data.details.displayNameNoCourse,
      blocks: [
        {
          elements: [
            data.SC.title,
            data.MC.title,
            data.KP.title,
            data.NR.title,
            data.FT.title,
            data.SE.title,
            data.CS.title,
            data.CT.title,
          ],
        },
        {
          elements: [
            data.SCML.title,
            data.MCML.title,
            data.NRML.title,
            data.FTML.title,
            data.SEML.title,
            data.CSML.title,
            data.CT2.title,
          ],
        },
      ],
    })
    await page.getByTestId('open-activity-overview').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.details.nameNoCourse}{enter}`
    )
    await expectByAssertion(
      page.getByTestId(`activity-LIVE_QUIZ-${data.details.nameNoCourse}`),
      'exist'
    )
    await page.getByTestId(`activity-name-${data.details.nameNoCourse}`).click()
    await assertNoActivityPoints(page)
    await expectByAssertion(
      page.getByTestId('activity-details-stack-header-0'),
      'not.contain',
      '70 P.'
    )
    await expectByAssertion(
      page.getByTestId('activity-details-stack-header-1'),
      'not.contain',
      '660 P.'
    )
    await expect(page.getByTestId('stack-0-instance-0')).toContainText(
      data.SC.title
    )
    await expect(page.getByTestId('stack-0-instance-1')).toContainText(
      data.MC.title
    )
    await expect(page.getByTestId('stack-0-instance-2')).toContainText(
      data.KP.title
    )
    await expect(page.getByTestId('stack-0-instance-3')).toContainText(
      data.NR.title
    )
    await expect(page.getByTestId('stack-0-instance-4')).toContainText(
      data.FT.title
    )
    await expect(page.getByTestId('stack-0-instance-5')).toContainText(
      data.SE.title
    )
    await expect(page.getByTestId('stack-0-instance-6')).toContainText(
      data.CS.title
    )
    await expect(page.getByTestId('stack-0-instance-7')).toContainText(
      data.CT.title
    )
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 0,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 1,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 2,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 3,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 4,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 5,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 6,
    })
    await assertNoInstancePoints(page, {
      stackIx: 0,
      instanceIx: 7,
    })
    await expect(page.getByTestId('stack-1-instance-0')).toContainText(
      data.SCML.title
    )
    await expect(page.getByTestId('stack-1-instance-1')).toContainText(
      data.MCML.title
    )
    await expect(page.getByTestId('stack-1-instance-2')).toContainText(
      data.NRML.title
    )
    await expect(page.getByTestId('stack-1-instance-3')).toContainText(
      data.FTML.title
    )
    await expect(page.getByTestId('stack-1-instance-4')).toContainText(
      data.SEML.title
    )
    await expect(page.getByTestId('stack-1-instance-5')).toContainText(
      data.CSML.title
    )
    await expect(page.getByTestId('stack-1-instance-6')).toContainText(
      data.CT2.title
    )
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 0,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 1,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 2,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 3,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 4,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 5,
    })
    await assertNoInstancePoints(page, {
      stackIx: 1,
      instanceIx: 6,
    })
    await page.getByTestId('close-activity-details-modal').click()
  })

  test('Preparation: Reset the database and create all required content for the PIN-protected live quizzes', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await runTask('cleanupDatabase')
    await runTask('seedDatabase')
    await loginLecturer(page)
    await createQuestionSC(page, {
      name: data.SCML.title,
      content: data.SCML.content,
      explanation: data.SCML.explanation,
      choices: data.SCML.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionMC(page, {
      name: data.MC.title,
      content: data.MC.content,
      explanation: data.MC.explanation,
      choices: data.MC.choices,
      userId: env('LECTURER_ID'),
    })
    await createCourse(page, {
      name: data.protected.gamifiedCourse.name,
      displayName: data.protected.gamifiedCourse.displayName,
      isAssessmentEnabled: false,
      isGamificationEnabled: true,
      isGroupCreationEnabled: true,
      startDate: getFutureDate(-1, '11'), // 1 month ago
      endDate: getFutureDate(6, '20'), // 6 months from now
      groupDeadlineDate: getFutureDate(2, '12'), // 2 months from now
      maxGroupSize: 4,
      preferredGroupSize: 2,
      participants: [env('STUDENT_USERNAME')],
    })
    await createCourse(page, {
      name: data.protected.nonGamifiedCourse.name,
      displayName: data.protected.nonGamifiedCourse.displayName,
      isAssessmentEnabled: false,
      isGamificationEnabled: false,
      isGroupCreationEnabled: false,
      startDate: getFutureDate(-1, '11'), // 1 month ago
      endDate: getFutureDate(6, '20'), // 6 months from now
      groupDeadlineDate: getFutureDate(2, '12'), // 2 months from now
      participants: [env('STUDENT_USERNAME')],
    })
    await createAndStartProtectedLiveQuizzes(data)
  })

  test('Have the a student with a valid account join both courses', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentWithStoredPwaState(page)
    {
      const pin = await runTask('getCoursePin', {
        courseName: data.protected.gamifiedCourse.name,
      })
      if (!pin) {
        throw new Error(
          'No course pin found. Please ensure that the previous test case has run successfully and generated a course pin.'
        )
      }
      await page.getByTestId('join-new-course').click()
      await fillJoinCoursePin(pin)
      await page.getByTestId('join-course-submit-form').click()
      await expectByAssertion(
        page.getByTestId(
          `course-button-${data.protected.gamifiedCourse.displayName}`
        ),
        'exist'
      )
    }
    {
      const pin = await runTask('getCoursePin', {
        courseName: data.protected.nonGamifiedCourse.name,
      })
      if (!pin) {
        throw new Error(
          'No course pin found. Please ensure that the previous test case has run successfully and generated a course pin.'
        )
      }
      await page.getByTestId('join-new-course').click()
      await fillJoinCoursePin(pin)
      await page.getByTestId('join-course-submit-form').click()
      await expectByAssertion(
        page.getByTestId(
          `course-button-${data.protected.nonGamifiedCourse.displayName}`
        ),
        'exist'
      )
    }
  })

  test('Verify that the shown PINs are identical with the stored ones', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.protected.gamifiedCourse.liveQuiz}{enter}`
    )
    await page
      .getByTestId(
        `live-quiz-cockpit-${data.protected.gamifiedCourse.liveQuiz}`
      )
      .click()
    {
      const text = await page.getByTestId('live-quiz-pin').textContent()
      aliases.set('protectedQuizPin', text.split(':')[1].replace(/\s+/g, ''))
    }
    await page.getByTestId('activities').click()
    await typeInto(
      page.getByTestId('activities-search-input'),
      `${data.protected.nonGamifiedCourse.liveQuiz}{enter}`
    )
    await page
      .getByTestId(
        `live-quiz-cockpit-${data.protected.nonGamifiedCourse.liveQuiz}`
      )
      .click()
    {
      const text = await page.getByTestId('live-quiz-pin').textContent()
      aliases.set('protectedQuizPin2', text.split(':')[1].replace(/\s+/g, ''))
    }
    {
      const pin = aliases.get('protectedQuizPin')
      {
        const result = await runTask('verifyLiveQuizPin', {
          pin,
          name: data.protected.gamifiedCourse.liveQuiz,
        })
        if (result === false) {
          throw new Error(
            'The wrong live quiz is shown for the quiz in question'
          )
        }
        await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
      }
    }
    {
      const pin = aliases.get('protectedQuizPin2')
      {
        const result = await runTask('verifyLiveQuizPin', {
          pin,
          name: data.protected.nonGamifiedCourse.liveQuiz,
        })
        if (result === false) {
          throw new Error(
            'The wrong live quiz is shown for the quiz in question'
          )
        }
        await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
      }
    }
  })

  test('Log in as one of the course participants and access both live quizzes using the provided PINs', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudentWithStoredPwaState(page)
    {
      const pin = await runTask('getLiveQuizPin', {
        name: data.protected.gamifiedCourse.liveQuiz,
      })
      await page
        .getByTestId(`live-quiz-${data.protected.gamifiedCourse.liveQuiz}`)
        .click()
      await enterPinAnswerFirstBlock(pin, data)
    }
    await page.getByTestId('header-home').click()
    {
      const pin = await runTask('getLiveQuizPin', {
        name: data.protected.nonGamifiedCourse.liveQuiz,
      })
      await page
        .getByTestId(`live-quiz-${data.protected.nonGamifiedCourse.liveQuiz}`)
        .click()
      await enterPinAnswerFirstBlock(pin, data)
    }
    await rememberStudentPwaState(page)
  })

  test('Test the direct access links for the live quiz with embedded PIN (logged in users)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await getPinProtectedQuizLinks(data)
    {
      const link = aliases.get('protectedQuizLink')
      await page.context().clearCookies()
      clearLiveQuizPinCookies()
      await page.evaluate(() => localStorage.clear()).catch(() => undefined)
      await studentAccountLinkAccess(String(link), data, true, true)
    }
    {
      const link = aliases.get('protectedQuizLink2')
      await page.context().clearCookies()
      clearLiveQuizPinCookies()
      await page.evaluate(() => localStorage.clear()).catch(() => undefined)
      await studentAccountLinkAccess(String(link), data, true, false)
    }
  })

  test('Test the direct access links for the live quiz with embedded PIN (anonymous users)', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await endPinProtectedLiveQuizzes(data)
    await createAndStartProtectedLiveQuizzes(data)
    await getPinProtectedQuizLinks(data)
    await page.context().clearCookies()
    clearLiveQuizPinCookies()
    await page.evaluate(() => localStorage.clear()).catch(() => undefined)
    {
      const link = aliases.get('protectedQuizLink')
      await studentAccountLinkAccess(String(link), data, false, true)
    }
    {
      const link = aliases.get('protectedQuizLink2')
      await studentAccountLinkAccess(String(link), data, false, false)
    }
    await page.goto(env('URL_MANAGE'), { waitUntil: 'commit' })
  })

  test('End the two protected live quizzes', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await endPinProtectedLiveQuizzes(data)
  })

  // ! Part 8: Word Cloud
  // #region
  test('Test word cloud display', async ({ page: testPage }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)

    await createQuestionNR(page, {
      name: data.NR4.title,
      content: data.NR4.content,
      explanation: data.NR4.explanation,
      ...data.NR4.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FT4.title,
      content: data.FT4.content,
      explanation: data.FT4.explanation,
      ...data.FT4.options,
      userId: env('LECTURER_ID'),
    })
    await createQuestionFT(page, {
      name: data.FT5.title,
      content: data.FT5.content,
      explanation: data.FT5.explanation,
      ...data.FT5.options,
      userId: env('LECTURER_ID'),
    })

    await createLiveQuiz(page, {
      name: data.liveQuizWordCloud.name,
      displayName: data.liveQuizWordCloud.displayName,
      courseName: data.liveQuizWordCloud.course,
      blocks: [
        {
          elements: [data.NR4.title, data.FT4.title, data.FT5.title],
        },
      ],
    })

    await page.getByTestId('quick-start').click()
    await openNextBlockFromCockpit(page)
    await visitEvaluationFromCockpit(page)
    await selectWordCloudChart(page)

    await expect(page.getByTestId('word-cloud')).toContainText(
      noWordCloudResponsesMessage
    )
    await expect(page.getByTestId('word-cloud-language-filter')).toBeHidden()
    await expect(page.getByTestId('word-cloud-display-limit')).toBeHidden()

    await selectEvaluationInstance(page, data.FT4.title)
    await selectWordCloudChart(page)
    await expect(page.getByTestId('word-cloud')).toContainText(
      noWordCloudResponsesMessage
    )
    await expect(page.getByTestId('word-cloud-language-filter')).toBeVisible()
    await expect(page.getByTestId('word-cloud-display-limit')).toBeVisible()

    await selectEvaluationInstance(page, data.FT5.title)
    await selectWordCloudChart(page)
    await expect(page.getByTestId('word-cloud')).toContainText(
      noWordCloudResponsesMessage
    )
    await expect(page.getByTestId('word-cloud-language-filter')).toBeVisible()
    await expect(page.getByTestId('word-cloud-display-limit')).toBeVisible()
  })

  test('Seed live quiz answers for word cloud display', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await runTask('seedWordCloudLiveQuizResponses', {
      freeTextAnswer: data.FT4.answer,
      freeTextTitle: data.FT4.title,
      numericalAnswer: data.NR4.answer,
      numericalTitle: data.NR4.title,
      quizName: data.liveQuizWordCloud.name,
      secondFreeTextAnswer: data.FT5.answer,
      secondFreeTextTitle: data.FT5.title,
    })
  })

  test('Test word cloud display after receiving answers', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    aliases.clear()
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await openActivitiesListForQuiz(page, data.liveQuizWordCloud.name)
    await page
      .getByTestId(`live-quiz-cockpit-${data.liveQuizWordCloud.name}`)
      .click()
    await visitEvaluationFromCockpit(page)
    await selectWordCloudChart(page)

    await expect(page.getByTestId('word-cloud')).toContainText('50')
    await expect(page.getByTestId('word-cloud-language-filter')).toBeHidden()
    await expect(page.getByTestId('word-cloud-display-limit')).toBeHidden()

    await selectEvaluationInstance(page, data.FT4.title)
    await selectWordCloudChart(page)
    await expect(page.getByTestId('word-cloud')).toContainText('hello')
    await expect(page.getByTestId('word-cloud')).toContainText('42')
    await expect(page.getByTestId('word-cloud')).not.toContainText('of')

    await selectOption(page, '[data-cy="word-cloud-language-select"]', 'none')
    await expect(page.getByTestId('word-cloud')).toContainText('of')

    await selectOption(page, '[data-cy="word-cloud-mode-select"]', 'sentences')
    await expect(page.getByTestId('word-cloud')).toContainText('of')
    await expect(page.getByTestId('word-cloud-language-filter')).toBeHidden()
    await expect(page.getByTestId('word-cloud-display-limit')).toBeHidden()

    await selectEvaluationInstance(page, data.FT5.title)
    await selectWordCloudChart(page)
    await expect(page.getByTestId('word-cloud')).toContainText('hallo')
    await expect(page.getByTestId('word-cloud')).toContainText('42')
    await expect(page.getByTestId('word-cloud')).toContainText('von')

    await selectOption(page, '[data-cy="word-cloud-language-select"]', 'de')
    await expect(page.getByTestId('word-cloud')).toContainText('hallo')
    await expect(page.getByTestId('word-cloud')).not.toContainText('von')
  })
  // #endregion
})
