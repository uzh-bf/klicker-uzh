import { expect, test } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import { COURSE_ID_TEST, USER_ID_TEST } from '../util/constants.js'
import { loginStudent } from '../util/workflow.js'

test.use({ video: 'off' })

async function createChoicePracticeQuiz() {
  const prisma = await getPrisma()
  const elements = await Promise.all(
    (['SC', 'MC', 'KPRIM'] as const).map((type) =>
      prisma.element.create({
        data: {
          type,
          name: `Mobile ${type}`,
          content: 'Select the matching answer for this synthetic example.',
          basePoints: true,
          pointsMultiplier: 1,
          ownerId: USER_ID_TEST,
          options: {
            hasSampleSolution: true,
            hasAnswerFeedbacks: false,
            displayMode: 'GRID',
            choices: Array.from({ length: 4 }, (_, ix) => ({
              ix,
              value: `Answer ${ix + 1}: a deliberately long description to check narrow reading space and wrapping.${ix === 0 ? '\n\n![Synthetic diagram](/klicker-icon-inverted.png)' : ''}`,
              correct: ix === 0,
            })),
          },
        },
      })
    )
  )
  return prisma.practiceQuiz.create({
    data: {
      name: 'Mobile choice controls',
      displayName: 'Mobile choice controls',
      status: 'PUBLISHED',
      orderType: 'SEQUENTIAL',
      availableFrom: new Date('2020-01-01'),
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
      stacks: {
        create: elements.map((element, order) => ({
          type: 'PRACTICE_QUIZ',
          order,
          courseId: COURSE_ID_TEST,
          elements: {
            create: {
              type: 'PRACTICE_QUIZ',
              elementType: element.type,
              order: 0,
              elementId: element.id,
              ownerId: USER_ID_TEST,
              options: {
                basePoints: true,
                pointsMultiplier: 1,
                resetTimeDays: 6,
              },
              elementData: {
                id: `${element.id}-v${element.version}`,
                elementId: element.id,
                name: element.name,
                type: element.type,
                content: element.content,
                basePoints: true,
                pointsMultiplier: 1,
                options: element.options,
              },
              results: { choices: { 0: 0, 1: 0, 2: 0, 3: 0 }, total: 0 },
              anonymousResults: {
                choices: { 0: 0, 1: 0, 2: 0, 3: 0 },
                total: 0,
              },
              instanceStatistics: { create: {} },
            },
          },
        })),
      },
    },
  })
}

async function createActiveLiveQuiz(type: 'SC' | 'MC' | 'KPRIM' = 'SC') {
  const prisma = await getPrisma()
  const startedAt = new Date()
  const element = await prisma.element.create({
    data: {
      type,
      name: 'Mobile live quiz choice',
      content: 'Select the matching answer for this synthetic live quiz.',
      basePoints: true,
      pointsMultiplier: 1,
      ownerId: USER_ID_TEST,
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        displayMode: 'GRID',
        choices: [
          { ix: 0, value: 'Synthetic live answer', correct: true },
          { ix: 1, value: 'Synthetic alternate answer', correct: false },
          ...(type === 'KPRIM'
            ? [
                { ix: 2, value: 'Synthetic third statement', correct: false },
                { ix: 3, value: 'Synthetic fourth statement', correct: true },
              ]
            : []),
        ],
      },
    },
  })

  const quiz = await prisma.liveQuiz.create({
    data: {
      name: 'Mobile live quiz controls',
      displayName: 'Mobile live quiz controls',
      status: 'PUBLISHED',
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
      isLiveQAEnabled: true,
      isConfusionFeedbackEnabled: false,
      blocks: {
        create: [
          {
            order: 0,
            status: 'ACTIVE',
            startedAt,
            elements: {
              create: [
                {
                  order: 0,
                  type: 'LIVE_QUIZ',
                  elementType: element.type,
                  elementData: {
                    id: `${element.id}-v${element.version}`,
                    elementId: element.id,
                    name: element.name,
                    type: element.type,
                    content: element.content,
                    basePoints: element.basePoints,
                    pointsMultiplier: element.pointsMultiplier,
                    options: element.options,
                  },
                  options: {
                    basePoints: element.basePoints,
                    pointsMultiplier: element.pointsMultiplier,
                  },
                  results: {},
                  anonymousResults: {},
                  instanceStatistics: { create: {} },
                  element: { connect: { id: element.id } },
                  owner: { connect: { id: USER_ID_TEST } },
                },
              ],
            },
          },
        ],
      },
    },
  })

  const block = await prisma.elementBlock.findFirst({
    where: { liveQuizId: quiz.id },
    select: { id: true },
  })
  if (!block) throw new Error('Synthetic live quiz block was not created')

  return prisma.liveQuiz.update({
    where: { id: quiz.id },
    data: { activeBlockId: block.id, startedAt },
  })
}

for (const locale of ['en', 'de']) {
  test.describe(`PWA mobile choices (${locale})`, () => {
    test.use({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale,
    })
    test('public feedback votes expose selection and reflow with enlarged text', async ({
      page,
    }, testInfo) => {
      const prisma = await getPrisma()
      const quiz = await createActiveLiveQuiz()
      await prisma.feedback.create({
        data: {
          liveQuizId: quiz.id,
          content: 'Synthetic public question',
          isPublished: true,
          responses: { create: { content: 'Synthetic public response' } },
        },
      })
      await loginStudent(page)
      const origin = new URL(page.url()).origin
      const url = `${origin}${locale === 'de' ? '/de' : ''}/session/${quiz.id}`
      await page.goto(url)
      await page.getByTestId('mobile-menu-feedbacks').tap()
      const question = page.getByTestId(
        'feedback-upvote-Synthetic public question'
      )
      const helpful = page.getByTestId(
        'feedback-response-upvote-Synthetic public response'
      )
      const unhelpful = page.getByTestId('feedback-response-downvote')
      for (const button of [question, helpful, unhelpful]) {
        await expect(button).toHaveAccessibleName(/\S/)
        await expect(button).toHaveAttribute('aria-pressed', 'false')
        expect((await button.boundingBox())?.width).toBeGreaterThanOrEqual(44)
        expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
      }
      await question.tap()
      await expect(question).toHaveAttribute('aria-pressed', 'true')
      await helpful.tap()
      await expect(helpful).toHaveAttribute('aria-pressed', 'true')
      await unhelpful.focus()
      await page.keyboard.press('Space')
      await expect(helpful).toHaveAttribute('aria-pressed', 'false')
      await expect(unhelpful).toHaveAttribute('aria-pressed', 'true')
      const field = page.getByTestId('feedback-input')
      await field.fill('Synthetic draft retained while reading feedback')
      await page.addStyleTag({
        content: 'html { font-size: 200% !important; }',
      })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await expect(field).toBeVisible()
      const label = page.locator('label[for="feedbackInput"]')
      const labelBox = (await label.boundingBox())!
      const fieldBox = (await field.boundingBox())!
      expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(
        fieldBox.x + fieldBox.width
      )
      expect(
        await label.evaluate(
          (element) => element.scrollWidth <= element.clientWidth
        )
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath('feedback-enlarged-mobile.png'),
      })
      await testInfo.attach('synthetic-session.json', {
        body: JSON.stringify({ url }),
        contentType: 'application/json',
      })
    })

    test('feedback retains the draft on failure and clears it after success', async ({
      page,
    }, testInfo) => {
      const prisma = await getPrisma()
      const quiz = await prisma.liveQuiz.create({
        data: {
          name: 'Synthetic feedback recovery',
          displayName: 'Synthetic feedback recovery',
          ownerId: USER_ID_TEST,
          courseId: COURSE_ID_TEST,
          status: 'PUBLISHED',
          isLiveQAEnabled: true,
          isConfusionFeedbackEnabled: false,
        },
      })
      await loginStudent(page)
      const origin = new URL(page.url()).origin
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: origin }])
      let fail = true
      await page.route('**/graphql', async (route) => {
        const body = route.request().postDataJSON()
        if (body?.operationName !== 'CreateFeedback') return route.continue()
        if (fail)
          return route.fulfill({
            json: { errors: [{ message: 'Synthetic failure' }] },
          })
        return route.continue()
      })
      await page.goto(
        `${origin}${locale === 'de' ? '/de' : ''}/session/${quiz.id}`
      )
      const field = page.getByTestId('feedback-input')
      await expect(field).toBeVisible()
      await expect(field).toHaveAccessibleName(/\S/)
      const draft = 'Synthetic feedback draft'
      await field.fill(draft)
      await page.getByTestId('feedback-submit').tap()
      await expect(
        page.getByRole('alert').filter({ hasText: /\S/ })
      ).toBeVisible()
      await expect(field).toHaveValue(draft)
      await expect(page.getByTestId('feedback-submit')).toBeEnabled()
      await page.screenshot({
        path: testInfo.outputPath('feedback-failure-mobile.png'),
      })
      fail = false
      await page.getByTestId('feedback-submit').tap()
      await expect(field).toHaveValue('')
      expect(
        await prisma.feedback.count({
          where: { liveQuizId: quiz.id, content: draft },
        })
      ).toBe(1)
      await page.screenshot({
        path: testInfo.outputPath('feedback-success-mobile.png'),
      })
    })
    test('selection is exposed and the layout reflows', async ({
      page,
    }, testInfo) => {
      const quiz = await createChoicePracticeQuiz()
      await loginStudent(page)
      const origin = new URL(page.url()).origin
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: origin }])
      await page.goto(
        `${origin}${locale === 'de' ? '/de' : ''}/course/${COURSE_ID_TEST}/practiceQuizzes/${quiz.id}`
      )
      await page.getByTestId('start-practice-quiz').click()
      const bookmark = page.getByTestId('bookmark-element-stack')
      await bookmark.tap()
      await expect(bookmark).toHaveAttribute('aria-pressed', 'true')
      const options = page.locator('[data-cy^="sc-0-answer-option-"]')
      await expect(options).toHaveCount(4)
      await expect(options.first()).toHaveAttribute('aria-pressed', 'false')
      const expand = page
        .getByRole('button', {
          name: locale === 'en' ? 'Expand image' : 'Bild vergrössern',
          exact: true,
        })
        .first()
      const expandBox = await expand.boundingBox()
      expect(expandBox?.width).toBeGreaterThanOrEqual(44)
      expect(expandBox?.height).toBeGreaterThanOrEqual(44)
      await expand.focus()
      await page.keyboard.press('Enter')
      const imageDialog = page.getByRole('dialog')
      await expect(imageDialog).toBeVisible()
      await expect(imageDialog.getByRole('img')).toHaveAttribute(
        'alt',
        'Synthetic diagram'
      )
      await page.keyboard.press('Escape')
      await expect(imageDialog).toHaveCount(0)
      await expect(expand).toBeFocused()
      await expect(options.first()).toHaveAttribute('aria-pressed', 'false')
      await options.first().tap()
      await expect(options.first()).toHaveAttribute('aria-pressed', 'true')
      await options.nth(1).focus()
      await page.keyboard.press('Space')
      await expect(options.first()).toHaveAttribute('aria-pressed', 'false')
      await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'true')
      const [first, second] = await Promise.all([
        options.first().boundingBox(),
        options.nth(1).boundingBox(),
      ])
      expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height)
      await expect(page.getByRole('main')).toHaveCount(1)
      await page.screenshot({
        path: testInfo.outputPath('single-choice-mobile.png'),
      })
      await page.setViewportSize({ width: 320, height: 740 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath('single-choice-narrow.png'),
      })
      await page.setViewportSize({ width: 390, height: 844 })
      await page.getByTestId('student-stack-submit').click()
      await expect(options.first()).toBeDisabled()
      await page.getByTestId('student-stack-continue').click()
      const multiple = page.locator('[data-cy^="mc-0-answer-option-"]')
      await expect(multiple).toHaveCount(4)
      await multiple.first().tap()
      await multiple.nth(1).focus()
      await page.keyboard.press('Space')
      await expect(multiple.first()).toHaveAttribute('aria-pressed', 'true')
      await expect(multiple.nth(1)).toHaveAttribute('aria-pressed', 'true')
      await multiple.first().tap()
      await expect(multiple.first()).toHaveAttribute('aria-pressed', 'false')
      await expect(multiple.nth(1)).toHaveAttribute('aria-pressed', 'true')
      await page.screenshot({
        path: testInfo.outputPath('multiple-choice-mobile.png'),
      })
      await page.getByTestId('student-stack-submit').click()
      await page.getByTestId('student-stack-continue').click()
      const yes = page.getByTestId('toggle-kp-0-answer-0-correct')
      const progress = page.getByTestId('practice-quiz-progress')
      const progressLabels = await progress
        .getByRole('button')
        .allTextContents()
      expect(new Set(progressLabels).size).toBe(progressLabels.length)
      for (const step of await progress.getByRole('button').all()) {
        expect((await step.boundingBox())?.height).toBeGreaterThanOrEqual(44)
        expect(
          await step.evaluate(
            (element) => element.scrollHeight <= element.clientHeight
          )
        ).toBe(true)
      }
      const no = page.getByTestId('toggle-kp-0-answer-0-incorrect')
      await expect(yes).toHaveAttribute('aria-pressed', 'false')
      await expect(no).toHaveAttribute('aria-pressed', 'false')
      await expect(yes).toHaveAccessibleName(/\S/)
      await expect(no).toHaveAccessibleName(/\S/)
      await yes.tap()
      await expect(yes).toHaveAttribute('aria-pressed', 'true')
      await no.focus()
      await page.keyboard.press('Enter')
      await expect(yes).toHaveAttribute('aria-pressed', 'false')
      await expect(no).toHaveAttribute('aria-pressed', 'true')
      const box = await no.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
      await page.screenshot({
        path: testInfo.outputPath('kprim-mobile.png'),
      })
      await page.getByTestId('practice-quiz-reset').click()
      await page.getByTestId('start-practice-quiz').click()
      await expect(options.first()).toHaveAttribute('aria-pressed', 'false')
      await expect(bookmark).toHaveAttribute('aria-pressed', 'true')
    })

    for (const type of ['MC', 'KPRIM'] as const) {
      test(`live ${type} controls expose independent answer state`, async ({
        page,
      }, testInfo) => {
        const quiz = await createActiveLiveQuiz(type)
        await loginStudent(page)
        const origin = new URL(page.url()).origin
        await page.goto(
          `${origin}${locale === 'de' ? '/de' : ''}/session/${quiz.id}`
        )
        if (type === 'MC') {
          const choices = page.locator('[data-cy^="mc-0-answer-option-"]')
          await expect(choices).toHaveCount(2)
          await choices.first().tap()
          await choices.nth(1).focus()
          await page.keyboard.press('Space')
          await expect(choices.first()).toHaveAttribute('aria-pressed', 'true')
          await expect(choices.nth(1)).toHaveAttribute('aria-pressed', 'true')
          await choices.first().tap()
          await expect(choices.first()).toHaveAttribute('aria-pressed', 'false')
          await expect(choices.nth(1)).toHaveAttribute('aria-pressed', 'true')
        } else {
          const yes = page.getByTestId('toggle-kp-0-answer-0-correct')
          const no = page.getByTestId('toggle-kp-0-answer-0-incorrect')
          await expect(yes).toHaveAttribute('aria-pressed', 'false')
          await expect(no).toHaveAttribute('aria-pressed', 'false')
          await yes.tap()
          await no.focus()
          await page.keyboard.press('Space')
          await expect(yes).toHaveAttribute('aria-pressed', 'false')
          await expect(no).toHaveAttribute('aria-pressed', 'true')
        }
        await page.screenshot({
          path: testInfo.outputPath('live-answer-mobile.png'),
        })
      })
    }

    test('live quiz navigation exposes the active section and reflows', async ({
      page,
    }, testInfo) => {
      const quiz = await createActiveLiveQuiz()
      await loginStudent(page)
      const origin = new URL(page.url()).origin
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: origin }])
      await page.goto(
        `${origin}${locale === 'de' ? '/de' : ''}/session/${quiz.id}`
      )

      const questionsNavigation = page.getByTestId('mobile-menu-questions')
      const feedbackNavigation = page.getByTestId('mobile-menu-feedbacks')
      await expect(questionsNavigation).toBeVisible()
      await expect(questionsNavigation).toHaveAttribute('aria-current', 'page')

      for (const item of [questionsNavigation, feedbackNavigation]) {
        const box = await item.boundingBox()
        expect(box?.width).toBeGreaterThanOrEqual(44)
        expect(box?.height).toBeGreaterThanOrEqual(44)
      }

      await feedbackNavigation.tap()
      await expect(feedbackNavigation).toHaveAttribute('aria-current', 'page')
      await expect(page.getByTestId('feedback-input')).toBeVisible()
      await questionsNavigation.tap()
      await expect(questionsNavigation).toHaveAttribute('aria-current', 'page')

      await page.screenshot({
        path: testInfo.outputPath('live-quiz-navigation-mobile.png'),
      })

      await page.setViewportSize({ width: 1440, height: 900 })
      await page.screenshot({
        path: testInfo.outputPath('live-quiz-navigation-desktop.png'),
      })

      await page.setViewportSize({ width: 320, height: 740 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await expect(questionsNavigation).toBeVisible()
      await expect(questionsNavigation).toHaveAttribute('aria-current', 'page')
      for (const item of [questionsNavigation, feedbackNavigation]) {
        const box = await item.boundingBox()
        expect(box?.width).toBeGreaterThanOrEqual(44)
        expect(box?.height).toBeGreaterThanOrEqual(44)
      }
      await page.screenshot({
        path: testInfo.outputPath('live-quiz-navigation-narrow.png'),
      })
    })

    test('initial feedback failure has a retry path', async ({ page }) => {
      const quiz = await createActiveLiveQuiz()
      await loginStudent(page)
      const origin = new URL(page.url()).origin
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: origin }])
      let failedInitialRequest = false
      // Remove only prefetched feedback so the client exercises its retry state.
      await page.route(`**/session/${quiz.id}`, async (route) => {
        const response = await route.fetch()
        const html = await response.text()
        const body = html.replace(
          /(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,
          (_match, opening, serialized, closing) => {
            const data = JSON.parse(serialized)
            const root = data.props.pageProps.__APOLLO_STATE__.ROOT_QUERY
            for (const key of Object.keys(root)) {
              if (key.startsWith('feedbacks(')) delete root[key]
            }
            return `${opening}${JSON.stringify(data).replace(/</g, '\\u003c')}${closing}`
          }
        )
        expect(body).not.toBe(html)
        await route.fulfill({ response, body })
      })
      await page.route('**/graphql', async (route) => {
        const body = route.request().postDataJSON()
        if (body?.operationName !== 'GetFeedbacks') return route.continue()
        if (failedInitialRequest)
          return route.fulfill({ json: { data: { feedbacks: [] } } })
        failedInitialRequest = true
        return route.fulfill({
          json: { errors: [{ message: 'Synthetic feedback failure' }] },
        })
      })
      await page.goto(
        `${origin}${locale === 'de' ? '/de' : ''}/session/${quiz.id}`
      )
      await page.getByTestId('mobile-menu-feedbacks').tap()

      await expect.poll(() => failedInitialRequest).toBe(true)

      await expect(
        page.getByRole('alert').filter({ hasText: /\S/ })
      ).toBeVisible()
      const retry = page.getByTestId('feedback-retry')
      await expect(retry).toBeVisible()
      await retry.tap()
      await expect(page.getByTestId('feedback-input')).toBeVisible()
    })

    test('delayed live quiz submission exposes busy state with reduced motion', async ({
      page,
    }, testInfo) => {
      const quiz = await createActiveLiveQuiz()
      await page.emulateMedia({ reducedMotion: 'reduce' })
      let releaseResponse!: () => void
      const responsePending = new Promise<void>((resolve) => {
        releaseResponse = resolve
      })
      let responseStarted = false
      await page.route(
        (url) =>
          url.hostname.startsWith('response-api.') || url.port === '7078',
        async (route) => {
          if (route.request().method() !== 'POST') return route.continue()
          responseStarted = true
          await responsePending
          await route.fulfill({
            status: 200,
            json: { responseTimestamp: Date.now() },
          })
        }
      )
      await loginStudent(page)
      const origin = new URL(page.url()).origin
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: origin }])
      await page.goto(
        `${origin}${locale === 'de' ? '/de' : ''}/session/${quiz.id}`
      )

      const answer = page.getByTestId('sc-0-answer-option-0')
      const submit = page.getByTestId('student-submit-answer')
      await answer.tap()
      await expect(submit).toBeEnabled()
      try {
        await submit.tap()
        await expect.poll(() => responseStarted).toBe(true)
        await expect(submit).toBeDisabled()
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(1)
        await page.screenshot({
          path: testInfo.outputPath('live-quiz-submission-busy.png'),
        })
      } finally {
        releaseResponse()
      }
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
      await expect(
        page.getByRole('status').filter({ hasText: /\S/ })
      ).toBeVisible()
    })
  })
}
