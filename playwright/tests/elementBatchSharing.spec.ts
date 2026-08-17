import { expect } from '@playwright/test'
import fs from 'node:fs'
import { chooseActionByTestId } from '../util/actions.js'
import { test } from '../util/fixtures.js'
import { enMessages as messages } from '../util/messages.js'
import {
  createQuestionMC,
  createQuestionNR,
  env,
  loginIndividualCatalyst,
  loginInstitutionalCatalyst,
  loginLecturer,
  logoutUser,
  runTask,
  selectOption,
  shareObject,
} from '../util/workflow.js'

const questions = JSON.parse(
  fs.readFileSync(
    new URL('../fixtures/questions.json', import.meta.url),
    'utf8'
  )
)

test('batch sharing applies updates first and reports elements without ADMIN access', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(600_000)
  page.setDefaultNavigationTimeout(300_000)

  await runTask('cleanupDatabase')
  await runTask('seedDatabase')
  await loginLecturer(page)
  await createQuestionMC(page, {
    name: questions.MCML.title,
    content: questions.MCML.content,
    choices: questions.MCML.choices,
    userId: env('LECTURER_ID'),
  })
  await createQuestionNR(page, {
    name: questions.NRML.title,
    content: questions.NRML.content,
    ...questions.NRML.options,
    multiplier: 3,
    userId: env('LECTURER_ID'),
  })

  for (const { elementName, permissionLevel } of [
    {
      elementName: questions.MCML.title,
      permissionLevel: messages.manage.sharing.permissionsADMIN,
    },
    {
      elementName: questions.NRML.title,
      permissionLevel: messages.manage.sharing.permissionsWRITE,
    },
  ]) {
    await page.getByTestId('elements-search-input').clear()
    await page.getByTestId('elements-search-input').fill(elementName)
    await page.getByTestId('elements-search-input').press('Enter')
    await chooseActionByTestId(
      page,
      `actions-element-${elementName}`,
      `share-element-${elementName}`
    )
    await shareObject(page, {
      usernameOrEmail: env('LECTURER_INST_SHORTNAME'),
      permissionLevel,
    })
    await page.getByTestId('close-share-object').click()
  }

  await logoutUser(page)
  await loginInstitutionalCatalyst(page)
  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').press('Enter')

  await page.getByTestId(`element-checkbox-${questions.NRML.title}`).check()
  await page.getByTestId('element-batch-operations').click()
  await page.getByTestId('status-checkbox').check()
  await selectOption(
    page,
    '[data-cy="element-status-select"]',
    messages.shared.READY.statusLabel
  )
  await page.getByTestId('element-batch-sharing-checkbox').check()
  await page
    .getByTestId('element-batch-sharing-username-or-email')
    .fill(env('LECTURER_IND_SHORTNAME'))
  await expect(
    page.getByTestId(`element-batch-sharing-x-${questions.NRML.title}`)
  ).toBeVisible()
  await expect(page.getByTestId('apply-batch-operations')).toBeEnabled()
  await page.getByTestId('close-batch-operations-modal').click()
  await page.getByTestId(`element-checkbox-${questions.NRML.title}`).uncheck()

  await page.getByTestId(`element-checkbox-${questions.MCML.title}`).check()
  await page.getByTestId(`element-checkbox-${questions.NRML.title}`).check()
  await page.getByTestId('element-batch-operations').click()
  await page.getByTestId('status-checkbox').check()
  await selectOption(
    page,
    '[data-cy="element-status-select"]',
    messages.shared.READY.statusLabel
  )
  await page.getByTestId('element-batch-sharing-checkbox').check()
  await page
    .getByTestId('element-batch-sharing-username-or-email')
    .fill(env('LECTURER_IND_SHORTNAME'))
  await selectOption(
    page,
    '[data-cy="element-batch-sharing-permission-level"]',
    messages.manage.sharing.permissionsREAD
  )

  await expect(
    page.getByTestId(`element-batch-sharing-check-${questions.MCML.title}`)
  ).toBeVisible()
  const writeOnlyElement = page.getByTestId(
    `element-batch-sharing-x-${questions.NRML.title}`
  )
  await expect(writeOnlyElement).toBeVisible()
  await writeOnlyElement.hover()
  await expect(
    page
      .getByRole('tooltip')
      .getByText(
        messages.manage.questionPool.batchSharingInsufficientPermission,
        { exact: true }
      )
  ).toBeVisible()

  await page.getByTestId('apply-batch-operations').click()
  await expect(page.getByTestId('element-batch-result')).toBeVisible()
  await expect(page.getByTestId('element-batch-update-result')).toContainText(
    messages.manage.questionPool.batchUpdateResultSuccess
  )
  await expect(
    page.getByTestId(`element-batch-sharing-result-${questions.MCML.title}`)
  ).toContainText(messages.manage.questionPool.batchSharingResultShared)
  await expect(
    page.getByTestId(`element-batch-sharing-result-${questions.NRML.title}`)
  ).toContainText(
    messages.manage.questionPool.batchSharingResultSkippedInsufficientPermission
  )
  await expect(page.getByTestId('apply-batch-operations')).toBeHidden()

  await page.getByTestId('close-batch-operations-result').click()
  await logoutUser(page)
  await loginIndividualCatalyst(page)
  await page.getByTestId('elements-search-input').fill(questions.MCML.title)
  await page.getByTestId('elements-search-input').press('Enter')
  await expect(
    page.getByTestId(`element-item-${questions.MCML.title}`)
  ).toBeVisible()

  await page.getByTestId('elements-search-input').clear()
  await page.getByTestId('elements-search-input').fill(questions.NRML.title)
  await page.getByTestId('elements-search-input').press('Enter')
  await expect(
    page.getByTestId(`element-item-${questions.NRML.title}`)
  ).toBeHidden()
})
