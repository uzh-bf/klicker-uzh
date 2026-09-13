import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { getPrisma } from '../global-setup.js'
import { setSessionCookieForUrl } from '../util/authSession.js'
import { URL_MANAGE, USER_ID_TEST } from '../util/constants.js'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test.beforeAll(() => {
  expect(process.env.KLICKER_PLAYWRIGHT_PRODUCTION).toBe('1')
})

for (const locale of ['en', 'de']) {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    test(`production registration document and controls: ${locale}, ${viewport.width}px`, async ({
      page,
    }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.name))
      await page.setViewportSize(viewport)
      const response = await page.goto(`/${locale}/createAccount`)
      expect(response?.status()).toBe(200)
      const username = page.getByTestId('username-field-account-creation')
      await expect(username).toBeEditable()
      await username.fill(`pw${randomUUID().replaceAll('-', '').slice(0, 10)}`)
      await expect(username).toHaveValue(/^pw[0-9a-f]{10}$/)
      const submit = page.getByTestId('create-profile-button')
      await expect(submit).toBeDisabled()
      await page.getByTestId('tos-checkbox').click()
      await expect(page.getByTestId('tos-checkbox')).toBeChecked()
      await expect(submit).toBeDisabled()
      const toggle = page.getByTestId('toggle-profile-public-setting')
      await toggle.click()
      await expect(toggle).not.toBeChecked()
      expect((await page.reload())?.status()).toBe(200)
      await expect(username).toBeEditable()
      expect(errors).toEqual([])
    })
  }
}

test('production Manage renders and operates a translated shared component with real evaluation data', async ({
  page,
}) => {
  const prisma = await getPrisma()
  const quizId = randomUUID()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.name))
  const element = await prisma.element.create({
    data: {
      type: 'FREE_TEXT',
      name: 'Synthetic font controls',
      content: 'Synthetic response',
      options: {},
      ownerId: USER_ID_TEST,
    },
  })
  try {
    await prisma.liveQuiz.create({
      data: {
        id: quizId,
        name: 'Synthetic font controls',
        displayName: 'Synthetic font controls',
        ownerId: USER_ID_TEST,
        status: 'ENDED',
        permissions: {
          create: { userId: USER_ID_TEST, permissionLevel: 'OWNER' },
        },
        blocks: {
          create: {
            order: 0,
            status: 'EXECUTED',
            elements: {
              create: {
                type: 'LIVE_QUIZ',
                elementType: 'FREE_TEXT',
                order: 0,
                ownerId: USER_ID_TEST,
                elementId: element.id,
                options: {},
                elementData: {
                  ...element,
                  id: randomUUID(),
                  elementId: element.id,
                  type: 'FREE_TEXT',
                  options: {},
                },
                results: {
                  total: 1,
                  responses: { synthetic: { value: 'Synthetic', count: 1 } },
                },
                anonymousResults: { total: 0, responses: {} },
              },
            },
          },
        },
      },
    })
    const manage = process.env.URL_MANAGE ?? URL_MANAGE
    await setSessionCookieForUrl({
      context: page.context(),
      targetUrl: manage,
      tokenData: {
        sub: USER_ID_TEST,
        role: 'ADMIN',
        scope: 'ACCOUNT_OWNER',
        email: 'synthetic@example.invalid',
        catalystIndividual: true,
        catalystInstitutional: true,
      },
    })
    for (const locale of ['en', 'de']) {
      const evaluationResponse = page.waitForResponse((response) => {
        const request = response.request()
        return (
          request.url().includes('GetLiveQuizEvaluation') ||
          (request.postData()?.includes('GetLiveQuizEvaluation') ?? false)
        )
      })
      expect(
        (
          await page.goto(`${manage}/${locale}/quizzes/${quizId}/evaluation`)
        )?.status()
      ).toBe(200)
      const evaluation = await (await evaluationResponse).json()
      expect(evaluation.errors?.length ?? 0).toBe(0)
      expect(evaluation.data?.liveQuizEvaluation !== null).toBe(true)
      expect(
        evaluation.data?.liveQuizEvaluation?.results[0]?.instances
      ).toHaveLength(1)
      const charts = page.getByTestId('change-chart-type')
      await charts.click()
      await page
        .getByTestId('change-chart-type-manage.evaluation.wordCloud')
        .click()
      await expect(page.getByTestId('word-cloud')).toBeVisible()
      const increase = page
        .getByTestId('increase-font-size-max-word-cloud')
        .first()
      await expect(increase).toBeEnabled()
      const controls = increase.locator('..')
      const before = await controls.innerText()
      await increase.click()
      await expect(controls).not.toHaveText(before)
      expect((await page.reload())?.status()).toBe(200)
      await expect(charts).toBeVisible()
    }
    expect(errors).toEqual([])
  } finally {
    await prisma.liveQuiz.deleteMany({
      where: { id: quizId, ownerId: USER_ID_TEST },
    })
    await prisma.element.deleteMany({
      where: { id: element.id, ownerId: USER_ID_TEST },
    })
  }
})
