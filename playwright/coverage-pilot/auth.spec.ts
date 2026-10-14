import { expect, test } from '@playwright/test'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
// The collector is also independently tested with Node's test runner.
import { collectCoverage } from './collect.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const origin = 'http://127.0.0.1:3010'

for (const journey of ['landing', 'consent-reload'] as const) {
  test(`auth browser coverage: ${journey}`, async ({ page, browser }) => {
    // Synthetic anonymous session; do not invoke Edu-ID, submit credentials,
    // write a database or accept terms for an actual account.
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) return route.abort('blockedbyclient')
      if (url.pathname === '/api/auth/session') {
        return route.fulfill({ json: {} })
      }
      return route.continue()
    })
    await page.coverage.startJSCoverage({ resetOnNavigation: false })
    await page.goto('/')
    const checkbox = page.getByTestId('tos-checkbox')
    const login = page.getByTestId('eduid-login-button')
    const delegated = page.getByTestId('delegated-login-button')
    await expect(checkbox).not.toBeChecked()
    await expect(login).toBeDisabled()
    await expect(delegated).toBeDisabled()

    if (journey === 'consent-reload') {
      await checkbox.check()
      await expect(login).toBeEnabled()
      await expect(delegated).toBeEnabled()
      await page.reload()
      await expect(checkbox).toBeChecked()
      await expect(login).toBeEnabled()
      await checkbox.uncheck()
      await expect(login).toBeDisabled()
      await expect(delegated).toBeDisabled()
    }

    // Process raw V8 entries and maps in memory. Only sanitized summaries,
    // repository paths and source hashes reach disk or the artifact.
    const entries = await page.coverage.stopJSCoverage()
    const report = await collectCoverage({
      entries,
      root,
      origin,
      journey,
      browserVersion: browser.version(),
    })
    const directory = `${root}/playwright/test-results/coverage-pilot-summary`
    await mkdir(directory, { recursive: true })
    await writeFile(
      `${directory}/${journey}.json`,
      JSON.stringify(report, null, 2) + '\n'
    )
    console.log(
      JSON.stringify({ journey, ...report.total, files: report.files.length })
    )
  })
}
