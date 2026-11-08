/**
 * Escape room end-to-end workflow.
 *
 * The serial orchestrator keeps the mode workflows in their original order;
 * each mode owns its focused test registrations under ./escape-room.
 */
import { test } from '../util/fixtures.js'
import {
  createContent,
  createQuestionQrScan,
  createQuestionSC,
  env,
  loginLecturer,
  runTask,
} from '../util/workflow.js'
import { registerGroupEscapeRoomTests } from './escape-room/group.js'
import {
  registerMicrolearningCreationTest,
  registerMicrolearningFlowTest,
} from './escape-room/microlearning.js'
import {
  registerPracticeEscapeRoomTests,
  registerQrFallbackTest,
} from './escape-room/practice-quiz.js'
import { CT1, QR, SC1, SC2 } from './escape-room/shared.js'

test.describe.serial('Escape room workflows', () => {
  test('CLEANUP', async ({ page: testPage }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await runTask('cleanupDatabase')
    await runTask('seedDatabase')
  })

  test('Create the questions required for the escape room', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionSC(page, {
      name: SC1.title,
      content: SC1.content,
      choices: SC1.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionSC(page, {
      name: SC2.title,
      content: SC2.content,
      choices: SC2.choices,
      userId: env('LECTURER_ID'),
    })
    await createContent(page, {
      name: CT1.title,
      content: CT1.content,
      userId: env('LECTURER_ID'),
    })
    await createQuestionQrScan(page, {
      name: QR.title,
      content: QR.content,
      code: QR.code,
      userId: env('LECTURER_ID'),
    })
  })

  registerPracticeEscapeRoomTests()
  registerMicrolearningCreationTest()
  registerQrFallbackTest()
  registerMicrolearningFlowTest()
  registerGroupEscapeRoomTests()
})
