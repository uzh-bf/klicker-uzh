import type { Page, Route } from '@playwright/test'
import { expect, test } from '../util/fixtures.js'

type GraphQLRequest = {
  operationName?: unknown
  variables?: {
    searchString?: unknown
  }
}

function readGraphQLRequest(route: Route): GraphQLRequest {
  const request = route.request()

  if (request.method() === 'GET') {
    const url = new URL(request.url())
    const rawVariables = url.searchParams.get('variables')

    let variables: GraphQLRequest['variables']
    if (rawVariables) {
      try {
        const parsedVariables: unknown = JSON.parse(rawVariables)
        if (typeof parsedVariables === 'object' && parsedVariables !== null) {
          variables = parsedVariables as GraphQLRequest['variables']
        }
      } catch {
        variables = undefined
      }
    }

    return {
      operationName: url.searchParams.get('operationName'),
      variables,
    }
  }

  const body: unknown = request.postDataJSON()
  return typeof body === 'object' && body !== null
    ? (body as GraphQLRequest)
    : {}
}

async function interceptUserElements(
  page: Page,
  handler: (route: Route) => Promise<void>
) {
  await page.route('**/api/graphql**', (route) => {
    if (readGraphQLRequest(route).operationName !== 'GetUserElements') {
      return route.fallback()
    }

    return handler(route)
  })
}

test.describe('Question library search feedback', () => {
  test('applies non-empty searches after a short pause', async ({
    page,
    loginLecturer,
  }) => {
    let requestCount = 0
    const searchStrings: unknown[] = []

    await interceptUserElements(page, async (route) => {
      requestCount += 1
      searchStrings.push(readGraphQLRequest(route).variables?.searchString)
      await route.fallback()
    })
    await loginLecturer()

    await expect(page.getByTestId('result-range-summary-top')).toBeVisible()
    const initialRequestCount = requestCount
    const search = page.getByTestId('elements-search-input')

    await search.fill('W1 debounced search term')
    await page.waitForTimeout(200)
    expect(requestCount).toBe(initialRequestCount)

    await expect
      .poll(() => requestCount, { timeout: 5000 })
      .toBeGreaterThan(initialRequestCount)
    await expect.poll(() => searchStrings).toContain('W1 debounced search term')
  })

  test('shows a localized error with Retry for a library query failure', async ({
    page,
    loginLecturer,
  }) => {
    let faultActive = true

    await interceptUserElements(page, async (route) => {
      if (!faultActive) {
        await route.fallback()
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify({
          errors: [{ message: 'Synthetic GetUserElements failure' }],
        }),
      })
    })
    await loginLecturer()

    const retryButton = page.getByTestId('elements-error-retry')
    await expect(retryButton).toBeVisible({ timeout: 15000 })
    await expect(
      page.getByText('The elements could not be loaded.')
    ).toBeVisible()

    faultActive = false
    await retryButton.click()
    await expect(retryButton).not.toBeAttached({ timeout: 15000 })
    await expect(page.getByTestId('result-range-summary-top')).toBeVisible({
      timeout: 15000,
    })
  })
})
