import { expect, test, type Page } from '@playwright/test'

type CourseState = {
  gamification?: boolean
  assessment?: boolean
  error?: boolean
  responseId?: string
  bots?: string[]
  wait?: Promise<void>
}

async function mockGuide(page: Page, courses: Record<string, CourseState>) {
  await page.route('**/api/graphql*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const operation =
      request.method() === 'POST'
        ? request.postDataJSON()
        : {
            operationName: url.searchParams.get('operationName'),
            variables: JSON.parse(url.searchParams.get('variables') ?? '{}'),
          }
    const courseId = operation.variables?.courseId
    const state = courses[courseId]
    let body: object = { data: { self: null } }
    if (operation.operationName === 'GetStudentDocsCourse') {
      await state?.wait
      body = state?.error
        ? { errors: [{ message: 'Unavailable synthetic course' }] }
        : {
            data: {
              getCourseOverviewData: state
                ? {
                    __typename: 'CourseOverviewData',
                    course: {
                      __typename: 'Course',
                      id: state.responseId ?? courseId,
                      displayName: 'Synthetic course',
                      color: '#0028A5',
                      isGamificationEnabled: state.gamification ?? false,
                      isAssessmentEnabled: state.assessment ?? false,
                    },
                  }
                : null,
            },
          }
    } else if (operation.operationName === 'GetCourseChatbots') {
      body = {
        data: {
          courseChatbots: (state?.bots ?? []).map((id) => ({
            __typename: 'Chatbot',
            id,
            name: `Synthetic bot ${id}`,
            description: '',
            avatar: null,
          })),
        },
      }
    }
    await route.fulfill({
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': new URL(page.url()).origin,
        'access-control-allow-credentials': 'true',
      },
      body: JSON.stringify(body),
    })
  })
}

async function navigateCourse(page: Page, courseId: string) {
  await page.evaluate(async (id) => {
    const next = (
      window as typeof window & {
        next: { router: { push: (url: string) => Promise<boolean> } }
      }
    ).next
    await next.router.push(`/docs?courseId=${encodeURIComponent(id)}`)
  }, courseId)
}

test.describe('Student guide course context', () => {
  test('unavailable capabilities keep general help and account choices reachable', async ({
    page,
  }) => {
    await mockGuide(page, {
      disabled: {},
      error: { error: true },
      stale: { responseId: 'other-course', gamification: true, bots: ['one'] },
    })
    for (const query of [
      '',
      '?courseId=disabled',
      '?courseId=error',
      '?courseId=stale',
      '?courseId=',
      '?courseId=one&courseId=two',
    ]) {
      await page.goto(`/docs${query}`)
      await expect(page.getByTestId('docs-prototype-first-visit')).toBeVisible()
      await expect(
        page.getByTestId('docs-prototype-view-progress')
      ).toHaveCount(0)
      await expect(page.locator('#ai-tutor')).toHaveCount(0)
      await expect(page.locator('#learning-analytics')).toHaveCount(0)
      await expect(page.locator('#gamification')).toHaveCount(0)
      await expect(
        page.getByTestId('docs-prototype-help-missing-activity')
      ).toBeVisible()
      await expect(
        page.getByTestId('docs-prototype-edit-profile')
      ).toHaveAttribute('href', /\/editProfile$/)
      await expect(
        page.getByTestId('docs-prototype-data-use-settings')
      ).toHaveAttribute('href', /\/account\/data-use$/)
      await expect(page.locator('iframe')).toHaveCount(0)
    }
  })

  test('course transitions hide previous features while loading and in assessments', async ({
    page,
  }) => {
    let release!: () => void
    const wait = new Promise<void>((resolve) => {
      release = resolve
    })
    await mockGuide(page, {
      enabled: { gamification: true, bots: ['one'] },
      pending: { wait },
      assessment: { assessment: true, gamification: true, bots: ['one'] },
    })
    await page.goto('/docs?courseId=enabled')
    await expect(page.getByTestId('docs-prototype-chatbot-try')).toBeVisible()
    await navigateCourse(page, 'pending')
    await expect(page.getByTestId('docs-prototype-view-progress')).toHaveCount(
      0
    )
    await expect(page.locator('#ai-tutor')).toHaveCount(0)
    release()
    await expect(
      page.getByTestId('docs-prototype-help-missing-activity')
    ).toBeVisible()
    await navigateCourse(page, 'assessment')
    await expect(
      page.getByTestId('student-docs-assessment-warning')
    ).toBeVisible()
    await expect(page.getByTestId('docs-prototype-view-progress')).toHaveCount(
      0
    )
    await expect(page.locator('#ai-tutor')).toHaveCount(0)
  })

  test('all bots are selectable and embeddings load on request and survive view changes', async ({
    page,
  }) => {
    await mockGuide(page, {
      enabled: { gamification: true, bots: ['one', 'two'] },
    })
    const requests: string[] = []
    await page.route('**/course/**/chatbot/**', async (route) => {
      requests.push(route.request().url())
      await route.fulfill({
        contentType: 'text/html',
        body: '<main>Fixture</main>',
      })
    })
    await page.goto('/docs?courseId=enabled')
    const selector = page.getByTestId('docs-prototype-chatbot-select')
    await expect(selector).toBeVisible()
    await expect(selector.locator('option')).toHaveCount(2)
    expect(requests).toHaveLength(0)
    await selector.selectOption('two')
    const fallback = page.locator('a[href$="/course/enabled/chatbot/two"]')
    await expect(fallback).toHaveAttribute('target', '_blank')
    await expect(fallback).not.toHaveAttribute('href', /embed=/)
    await page.getByTestId('docs-prototype-chatbot-try').click()
    await expect(page.locator('#ai-tutor iframe')).toHaveAttribute(
      'src',
      /\/two\?embed=true$/
    )
    await expect.poll(() => requests.length).toBe(1)
    await page.getByTestId('docs-prototype-view-progress').click()
    await expect(page.locator('#gamification')).toBeVisible()
    await page.getByTestId('docs-prototype-view-guide').click()
    await expect(page.locator('#ai-tutor iframe')).toBeVisible()
    expect(requests).toHaveLength(1)
    await selector.selectOption('one')
    await expect(page.locator('#ai-tutor iframe')).toHaveCount(0)
    await page.getByTestId('docs-prototype-chatbot-try').click()
    await expect(page.locator('#ai-tutor iframe')).toHaveAttribute(
      'src',
      /\/one\?embed=true$/
    )
    await navigateCourse(page, 'disabled')
    await expect(page.locator('iframe')).toHaveCount(0)
  })

  test('progress deep links, reload and back preserve locale and course context', async ({
    page,
  }) => {
    await mockGuide(page, { enabled: { gamification: true } })
    await page.goto('/de/docs?courseId=enabled#gamification')
    await expect(page.locator('#gamification')).toBeVisible()
    await expect(page).toHaveURL(
      /\/de\/docs\?courseId=enabled&view=progress#gamification$/
    )
    await page.reload()
    await expect(page.locator('#gamification')).toBeVisible()
    await page.getByTestId('docs-prototype-view-guide').click()
    await expect(page).toHaveURL(/\/de\/docs\?courseId=enabled$/)
    await page.goBack()
    await expect(page.locator('#gamification')).toBeVisible()
    await expect(page).toHaveURL(/courseId=enabled&view=progress/)
    await expect(page.locator('#learning-analytics')).toHaveCount(0)
  })
})
