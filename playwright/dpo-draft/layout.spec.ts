import { expect, test } from '@playwright/test'

const manage = process.env.URL_MANAGE ?? 'http://127.0.0.1:3002'
const student = process.env.URL_STUDENT ?? 'http://127.0.0.1:3001'

for (const locale of ['de', 'en']) {
  for (const size of ['desktop', 'mobile', 'lms']) {
    test(`${locale} draft surfaces render at ${size} size`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000)
      await page.setViewportSize(
        size === 'mobile'
          ? { width: 390, height: 844 }
          : { width: 1280, height: 900 }
      )
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      for (const app of ['student', 'manage']) {
        const url = `${app === 'student' ? student : manage}/${locale}/dpo-draft`
        if (size === 'lms') {
          await page.goto(url)
          await page.setContent(
            `<iframe title="Synthetic LMS frame" src="${url}" style="width:760px;height:680px;border:0"></iframe>`
          )
        } else await page.goto(url)
        const surface = size === 'lms' ? page.frameLocator('iframe') : page
        const count = app === 'student' ? 6 : 3
        for (let index = 0; index < count; index++) {
          if (app === 'student') {
            await surface.getByTestId('dpo-view').click()
            await surface.getByRole('option').nth(index).click()
          } else {
            await surface
              .getByTestId(
                [
                  'dpo-open-assessment-export',
                  'dpo-open-research-export',
                  'dpo-open-knowledge-upload',
                ][index]!
              )
              .click()
          }
          await expect(surface.getByTestId('dpo-review-notice')).toBeAttached()
          const width = await surface.locator('html').evaluate((el) => ({
            scroll: el.scrollWidth,
            client: el.clientWidth,
          }))
          expect(width.scroll).toBeLessThanOrEqual(width.client + 1)
          for (const dialog of await surface.getByRole('dialog').all()) {
            await expect(dialog).toHaveCSS('opacity', '1')
          }
          await page.screenshot({
            path: testInfo.outputPath(`${app}-${index}.png`),
            fullPage: true,
          })
          if (app === 'manage')
            await surface
              .getByTestId(
                [
                  'dpo-close-assessment-export',
                  'dpo-close-research-export',
                  'dpo-close-knowledge-upload',
                ][index]!
              )
              .click()
          if (app === 'student' && index === 5)
            await surface.getByTestId('dpo-leaderboard-modal-close').click()
        }
      }
      expect(errors).toEqual([])
    })
  }
}
