/**
 * W4 activity wizard safety matrix (F1/F6).
 * All four activity types in English and German: pristine cancel without
 * dialog, dirty-cancel guard, confirmed discard cleanup, reload recovery
 * with current-step values, and snapshot isolation between activity types.
 * Final-review regression coverage: distinct duplicate/convert source
 * identifiers, self-scoped snapshot cleanup by mounted wizards, eviction of
 * malformed or structurally invalid snapshots, keep-editing on the dirty
 * cancel dialog, and the edit-mode guard-only lifecycle with edit dialog
 * copy and snapshot-free completion.
 */
import { expect, type Page } from '@playwright/test'
import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { cleanupTest } from '../util/cleanup.js'
import { test } from '../util/fixtures.js'
import {
  COURSE_ID_TEST,
  SEEDED_COURSE,
  USER_ID_TEST,
} from '../util/constants.js'
import { getPrisma, seedActivities } from '../global-setup.js'
import { deMessages, enMessages } from '../util/messages.js'
import {
  createPracticeQuiz,
  createQuestionSC,
  runTask,
} from '../util/workflow.js'

test('CLEANUP', cleanupTest)

const wizardTypes = [
  {
    id: 'live-quiz',
    openButton: 'create-live-quiz',
    nameField: 'insert-live-quiz-name',
  },
  {
    id: 'practice-quiz',
    openButton: 'create-practice-quiz',
    nameField: 'insert-practice-quiz-name',
  },
  {
    id: 'microlearning',
    openButton: 'create-microlearning',
    nameField: 'insert-microlearning-name',
  },
  {
    id: 'group-activity',
    openButton: 'create-group-activity',
    nameField: 'insert-groupactivity-name',
  },
] as const

const locales = ['en', 'de'] as const

type Locale = (typeof locales)[number]

const de = deMessages.manage.activityWizard
const en = enMessages.manage.activityWizard
const deElements = deMessages.manage.elements

function recoveryHeading(locale: Locale) {
  return locale === 'de' ? deElements.recoverData : 'Data Recovery'
}

async function activitySnapshotKeys(page: Page) {
  return page.evaluate(() =>
    Object.keys(localStorage).filter((k) =>
      k.startsWith('autosave-activity-creation')
    )
  )
}

async function openSeededCourseActivity(
  page: Page,
  tab: 'tab-liveQuizzes' | 'tab-practiceQuizzes' | 'tab-microLearnings'
) {
  await page.getByTestId('courses').click()
  await page.getByTestId('course-list-button-' + SEEDED_COURSE).click()
  await page.getByTestId(tab).click()
}

const distinctSourceMicroLearningId = '62a038e5-495e-4262-bd97-f30c3540122b'
const distinctSourceMicroLearningName = 'W4 Source Microlearning'
const selectionRecoveryElementName = 'W4 Selection Recovery Element'

async function seedDistinctSourceMicroLearning() {
  const prisma = await getPrisma()
  const scheduledStartAt = new Date('2020-01-01T00:00:00.000Z')
  const scheduledEndAt = new Date('2050-01-01T23:59:00.000Z')

  await prisma.microLearning.upsert({
    where: { id: distinctSourceMicroLearningId },
    create: {
      id: distinctSourceMicroLearningId,
      name: distinctSourceMicroLearningName,
      displayName: distinctSourceMicroLearningName,
      scheduledStartAt,
      scheduledEndAt,
      courseId: COURSE_ID_TEST,
      ownerId: USER_ID_TEST,
    },
    update: {
      name: distinctSourceMicroLearningName,
      displayName: distinctSourceMicroLearningName,
      scheduledStartAt,
      scheduledEndAt,
      courseId: COURSE_ID_TEST,
      ownerId: USER_ID_TEST,
      status: 'DRAFT',
    },
  })
  await prisma.derivedPermission.upsert({
    where: {
      microLearningId_userId: {
        microLearningId: distinctSourceMicroLearningId,
        userId: USER_ID_TEST,
      },
    },
    create: {
      permissionLevel: PermissionLevel.OWNER,
      microLearning: { connect: { id: distinctSourceMicroLearningId } },
      user: { connect: { id: USER_ID_TEST } },
    },
    update: { permissionLevel: PermissionLevel.OWNER },
  })
}

async function openDuplicateMicroLearning(page: Page, name: string) {
  await page.getByTestId(`actions-MICRO_LEARNING-${name}`).click()
  await page.getByTestId(`duplicate-microlearning-${name}`).click()
  await expect(page.getByTestId('insert-microlearning-name')).toBeVisible()
}

async function discardActivityWizard(page: Page) {
  await page.getByTestId('cancel-activity-creation').click()
  await page.getByTestId('discard-activity-creation').click()
  await page.waitForTimeout(1700)
}

const practiceQuizWizard = wizardTypes[1]

function validCreateSnapshot(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    mode: 'create',
    activityType: 'PRACTICE_QUIZ',
    savedAt: new Date().toISOString(),
    values: {
      name: 'W4 Invalid Candidate',
      displayName: '',
      description: '',
      multiplier: '1',
      stacks: [{ elements: [] }],
      order: 'SEQUENTIAL',
      resetTimeDays: '6',
    },
    selectedElements: {},
    ...overrides,
  })
}

function validLiveQuizCreateSnapshot() {
  return JSON.stringify({
    version: 1,
    mode: 'create',
    activityType: 'LIVE_QUIZ',
    savedAt: new Date().toISOString(),
    values: {
      name: 'W4 F2 Candidate',
      displayName: '',
      description: '',
      multiplier: '1',
      courseId: 'no-course-selected',
      blocks: [{ elements: [] }],
      isGamificationEnabled: false,
      isAssessmentEnabled: false,
      isPinProtected: false,
      isConfusionFeedbackEnabled: true,
      isLiveQAEnabled: false,
      isModerationEnabled: true,
      defaultPoints: 0,
      defaultCorrectPoints: 0,
      maxBonusPoints: 0,
      timeToZeroBonus: 30,
    },
    selectedElements: {},
  })
}

async function expectNoRecoveryDialog(page: Page, locale: Locale) {
  if (locale === 'de') {
    await expect(
      page.getByRole('heading', { name: deElements.recoverData })
    ).toHaveCount(0)
  } else {
    await expect(
      page.getByRole('heading', { name: 'Data Recovery' })
    ).toHaveCount(0)
  }
}

async function openLibrary(page: Page, locale: Locale) {
  await page.goto(
    locale === 'de'
      ? process.env.URL_MANAGE + '/de'
      : String(process.env.URL_MANAGE)
  )
  await page.waitForLoadState('domcontentloaded')
}

async function openWizard(page: Page, wizard: (typeof wizardTypes)[number]) {
  await page.getByTestId(wizard.openButton).click()
  await expect(page.getByTestId(wizard.nameField)).toBeVisible()
}

async function snapshotKeys(page: Page) {
  return page.evaluate(
    () =>
      Object.keys(localStorage).filter((k) =>
        k.startsWith('autosave-activity-creation')
      ).length
  )
}

test.describe('W4 activity wizard safety', () => {
  test('element creation remains available while an activity wizard is open', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await openLibrary(page, 'en')

    const sidebar = page.getByTestId('element-library-sidebar')
    const createElement = sidebar.getByTestId('create-question')
    await expect(createElement).toBeVisible()
    await expect(
      page
        .getByTestId('activity-creation-choices')
        .getByTestId('create-question')
    ).toHaveCount(0)
    const standardCreateElementColor = await createElement.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    )

    const firstElement = page.locator('[data-cy^="element-item-"]').first()
    const standardHeight = await firstElement.evaluate(
      (element) => element.getBoundingClientRect().height
    )
    await expect(firstElement.locator('.line-clamp-2')).toBeVisible()
    await expect
      .poll(() =>
        firstElement
          .locator('[data-cy^="element-actions-"]')
          .evaluate((element) => getComputedStyle(element).flexDirection)
      )
      .toBe('column')

    await openWizard(page, wizardTypes[0])

    await expect(page.getByTestId('activity-creation-choices')).toHaveCount(0)
    await expect(
      page
        .getByTestId('activity-wizard-navigation')
        .getByTestId('create-question')
    ).toHaveCount(0)
    await expect(createElement).toBeVisible()
    await expect
      .poll(() =>
        createElement.evaluate(
          (element) => getComputedStyle(element).backgroundColor
        )
      )
      .not.toBe(standardCreateElementColor)
    await expect(firstElement.locator('.line-clamp-1')).toBeVisible()
    const compactHeight = await firstElement.evaluate(
      (element) => element.getBoundingClientRect().height
    )
    expect(compactHeight).toBeLessThan(standardHeight - 20)
    await expect
      .poll(() =>
        firstElement
          .locator('[data-cy^="element-actions-"]')
          .evaluate((element) => getComputedStyle(element).flexDirection)
      )
      .toBe('row')

    const navigation = page.getByTestId('activity-wizard-navigation')
    await expect(navigation.getByTestId('next-or-submit')).toHaveText(
      en.continueToDescription
    )

    await createElement.click()
    await expect(page.getByTestId('select-question-type')).toBeVisible()
    await page.getByTestId('close-element-modal').click()
    await expect(page.getByTestId(wizardTypes[0].nameField)).toBeVisible()
  })

  for (const locale of locales) {
    test.describe('locale ' + locale, () => {
      for (const wizard of wizardTypes) {
        test(
          'pristine cancel closes without dialog and without snapshot (' +
            wizard.id +
            ')',
          async ({ page, loginLecturer }) => {
            await loginLecturer()
            await openLibrary(page, locale)
            await openWizard(page, wizard)
            await page.waitForTimeout(1300)
            expect(await snapshotKeys(page)).toBe(0)
            await page.getByTestId('cancel-activity-creation').click()
            await expect(
              page.getByTestId('discard-activity-creation')
            ).toHaveCount(0)
            await expect(page.getByTestId(wizard.openButton)).toBeVisible()
            expect(await snapshotKeys(page)).toBe(0)
          }
        )

        test(
          'dirty cancel guards and discard clears state for clean re-entry (' +
            wizard.id +
            ')',
          async ({ page, loginLecturer }) => {
            await loginLecturer()
            await openLibrary(page, locale)
            await openWizard(page, wizard)
            const name = 'W4 ' + wizard.id + ' ' + locale
            await page.getByTestId(wizard.nameField).fill(name)
            await page.getByTestId('next-or-submit').click()
            await page.waitForTimeout(1300)
            expect(await snapshotKeys(page)).toBe(1)
            await page.getByTestId('cancel-activity-creation').click()
            if (locale === 'de') {
              await expect(
                page.getByRole('heading', { name: de.confirmCancelTitle })
              ).toBeVisible()
            } else {
              await expect(
                page.getByRole('heading', {
                  name: 'Discard changes to this activity creation?',
                })
              ).toBeVisible()
            }
            await page.getByTestId('discard-activity-creation').click()
            await page.waitForTimeout(1700)
            await expect(page.getByTestId(wizard.openButton)).toBeVisible()
            expect(await snapshotKeys(page)).toBe(0)
            await openWizard(page, wizard)
            await expect(
              page.locator('[role=dialog], [role=alertdialog]')
            ).toHaveCount(0)
          }
        )

        test(
          'reload recovery restores the confirmed step values (' +
            wizard.id +
            ')',
          async ({ page, loginLecturer }) => {
            await loginLecturer()
            await openLibrary(page, locale)
            await openWizard(page, wizard)
            const name = 'W4 Recover ' + wizard.id + ' ' + locale
            await page.getByTestId(wizard.nameField).fill(name)
            await page.getByTestId('next-or-submit').click()
            await page.waitForTimeout(1300)
            await page.reload()
            // The persisted snapshot must be scoped to the signed-in
            // account and must not surface before the wizard is reopened.
            const scopedKeys = await page.evaluate(() =>
              Object.keys(localStorage).filter((k) =>
                k.startsWith('autosave-activity-creation')
              )
            )
            expect(scopedKeys.length).toBe(1)
            expect(scopedKeys[0]).toContain('user-lecturer-')
            await expect(
              page.locator('[role=dialog], [role=alertdialog]')
            ).toHaveCount(0)
            await expect(page.getByTestId(wizard.openButton)).toBeVisible()
            await openWizard(page, wizard)
            if (locale === 'de') {
              await expect(
                page.getByRole('heading', { name: deElements.recoverData })
              ).toBeVisible()
            } else {
              await expect(
                page.getByRole('heading', { name: 'Data Recovery' })
              ).toBeVisible()
            }
            await page.getByTestId('load-recovered-element-data').click()
            await expect(page.getByTestId(wizard.nameField)).toHaveValue(name)
            await page.getByTestId('cancel-activity-creation').click()
            await expect(
              page.getByTestId('discard-activity-creation')
            ).toBeVisible()
            await page.getByTestId('discard-activity-creation').click()
            await page.waitForTimeout(1700)
            expect(await snapshotKeys(page)).toBe(0)
          }
        )

        if (wizard.id === 'live-quiz') {
          test(
            'selected library elements recover with wizard state (' +
              wizard.id +
              ')',
            async ({ page, loginLecturer }) => {
              test.skip(locale !== 'en', 'covered once in English')
              await loginLecturer()
              await createQuestionSC(page, {
                name: selectionRecoveryElementName,
                content: 'Synthetic element for W4 selection recovery',
                choices: [
                  { value: 'Correct', correct: true },
                  { value: 'Incorrect', correct: false },
                ],
                userId: USER_ID_TEST,
              })
              await openLibrary(page, locale)
              const search = page.getByTestId('elements-search-input')
              await expect(search).toBeVisible()
              await search.fill(selectionRecoveryElementName)
              await page.keyboard.press('Enter')
              const row = page.getByTestId(
                `element-item-${selectionRecoveryElementName}`
              )
              await expect(row).toBeVisible()
              const checkbox = row.getByTestId(
                `element-checkbox-${selectionRecoveryElementName}`
              )
              await expect(checkbox).toBeVisible()
              await checkbox.check()
              await openWizard(page, wizard)
              await page
                .getByTestId(wizard.nameField)
                .fill('W4 Selection Recovery')
              await page.waitForTimeout(2200)
              expect(await snapshotKeys(page)).toBe(1)

              await page.reload()
              await expect(page.getByTestId(wizard.openButton)).toBeVisible()
              await openWizard(page, wizard)
              await expect(
                page.getByRole('heading', { name: 'Data Recovery' })
              ).toBeVisible()
              await page.getByTestId('load-recovered-element-data').click()
              await expect(page.getByTestId(wizard.nameField)).toHaveValue(
                'W4 Selection Recovery'
              )

              // Move to the element stack step and require the page-owned
              // selection to remain available after recovery.
              await page.getByTestId('next-or-submit').click()
              await page
                .getByTestId('insert-live-display-name')
                .fill('W4 Selection Recovery Display Name')
              await page.getByTestId('next-or-submit').click()
              await page.getByTestId('next-or-submit').click()
              await expect(
                page.getByTestId('add-selection-to-one-block')
              ).toBeVisible()

              await page.getByTestId('cancel-activity-creation').click()
              await page.getByTestId('discard-activity-creation').click()
              await page.waitForTimeout(1700)
              expect(await snapshotKeys(page)).toBe(0)
            }
          )
        }

        test(
          'active-step edits persist and recover after reload (' +
            wizard.id +
            ')',
          async ({ page, loginLecturer }) => {
            await loginLecturer()
            await openLibrary(page, locale)
            await openWizard(page, wizard)
            const name = 'W4 Step ' + wizard.id
            await page.getByTestId(wizard.nameField).fill(name)
            // Value sampling plus the debounced save must flush without
            // ever navigating to the next wizard step.
            await page.waitForTimeout(2200)
            await page.reload()
            await expect(page.getByTestId(wizard.openButton)).toBeVisible()
            await openWizard(page, wizard)
            if (locale === 'de') {
              await expect(
                page.getByRole('heading', { name: deElements.recoverData })
              ).toBeVisible()
            } else {
              await expect(
                page.getByRole('heading', { name: 'Data Recovery' })
              ).toBeVisible()
            }
            await page.getByTestId('load-recovered-element-data').click()
            await expect(page.getByTestId(wizard.nameField)).toHaveValue(name)
            await page.getByTestId('cancel-activity-creation').click()
            await page.getByTestId('discard-activity-creation').click()
            await page.waitForTimeout(1700)
            expect(await snapshotKeys(page)).toBe(0)
          }
        )
      }

      test(
        'snapshot isolation between activity types (' + locale + ')',
        async ({ page, loginLecturer }) => {
          await loginLecturer()
          await openLibrary(page, locale)
          // Leave a Live Quiz draft persisted: a regression collapsing the
          // user, activity-type, mode, or source key dimension would
          // resurface it inside the second wizard below.
          const first = wizardTypes[0]
          await openWizard(page, first)
          await page
            .getByTestId(first.nameField)
            .fill('W4 ISO ' + first.id + ' ' + locale)
          await page.waitForTimeout(2000)
          expect(await snapshotKeys(page)).toBe(1)
          // Reload keeps the persisted draft in place without discarding it.
          await page.reload()
          await expect(page.getByTestId(first.openButton)).toBeVisible()
          expect(await snapshotKeys(page)).toBe(1)

          // A different activity type must not offer the stored draft.
          const second = wizardTypes[1]
          await openWizard(page, second)
          await page.waitForTimeout(300)
          await expect(
            page.locator('[role=dialog], [role=alertdialog]')
          ).toHaveCount(0)

          // Redraft the second type; confirmed discard cleans it up.
          await page
            .getByTestId(second.nameField)
            .fill('W4 ISO ' + second.id + ' ' + locale)
          await page.waitForTimeout(2000)
          // Both drafts coexist under separate keys: exactly two now, and
          // neither wizard may surface the other type's draft.
          expect(await snapshotKeys(page)).toBe(2)
          await page.getByTestId('cancel-activity-creation').click()
          await expect(
            page.getByTestId('discard-activity-creation')
          ).toBeVisible()
          await page.getByTestId('discard-activity-creation').click()
          await expect(page.getByTestId(second.openButton)).toBeVisible()

          // The untouched first draft must still be recoverable, then is
          // discarded for a clean store.
          await openWizard(page, first)
          await expect(
            page.locator('[role=dialog], [role=alertdialog]')
          ).not.toHaveCount(0)
          if (locale === 'de') {
            await expect(
              page.getByRole('heading', { name: deElements.recoverData })
            ).toBeVisible()
          } else {
            await expect(
              page.getByRole('heading', { name: 'Data Recovery' })
            ).toBeVisible()
          }
          await page.getByTestId('load-recovered-element-data').click()
          await expect(page.getByTestId(first.nameField)).toHaveValue(
            'W4 ISO ' + first.id + ' ' + locale
          )
          await page.getByTestId('cancel-activity-creation').click()
          await page.getByTestId('discard-activity-creation').click()
          await page.waitForTimeout(1700)
          expect(await snapshotKeys(page)).toBe(0)
        }
      )

      // Distinct source activities must retain separate same-mode drafts, and
      // conversion must retain its separate mode and activity-type identity.
      test(
        'duplicate drafts and conversion recover by source and mode (' +
          locale +
          ')',
        async ({ page, loginLecturer }) => {
          test.skip(locale !== 'en', 'covered once in English')
          await seedActivities()
          await seedDistinctSourceMicroLearning()

          await loginLecturer()
          try {
            await openSeededCourseActivity(page, 'tab-microLearnings')

            // Keep the first source draft mounted only long enough to flush
            // it, then reload so a second source can create a same-mode draft.
            await openDuplicateMicroLearning(page, 'Seed Microlearning')
            await page
              .getByTestId('insert-microlearning-name')
              .fill('W4 Duplicate Seed Source ' + locale)
            await page.waitForTimeout(2000)

            await openLibrary(page, locale)
            await expect(page.getByTestId('create-microlearning')).toBeVisible()
            await openSeededCourseActivity(page, 'tab-microLearnings')
            await openDuplicateMicroLearning(
              page,
              distinctSourceMicroLearningName
            )
            await expect(
              page.getByRole('heading', { name: recoveryHeading(locale) })
            ).toHaveCount(0)
            await page
              .getByTestId('insert-microlearning-name')
              .fill('W4 Duplicate Second Source ' + locale)
            await page.waitForTimeout(2000)

            // Two same-mode, same-type drafts must coexist rather than
            // overwriting one another.
            expect(await activitySnapshotKeys(page)).toHaveLength(2)

            // Re-enter each source independently and recover its own name.
            await openLibrary(page, locale)
            await openSeededCourseActivity(page, 'tab-microLearnings')
            await openDuplicateMicroLearning(page, 'Seed Microlearning')
            await expect(
              page.getByRole('heading', { name: recoveryHeading(locale) })
            ).toBeVisible()
            await page.getByTestId('load-recovered-element-data').click()
            await expect(
              page.getByTestId('insert-microlearning-name')
            ).toHaveValue('W4 Duplicate Seed Source ' + locale)
            await discardActivityWizard(page)

            await openSeededCourseActivity(page, 'tab-microLearnings')
            await openDuplicateMicroLearning(
              page,
              distinctSourceMicroLearningName
            )
            await expect(
              page.getByRole('heading', { name: recoveryHeading(locale) })
            ).toBeVisible()
            await page.getByTestId('load-recovered-element-data').click()
            await expect(
              page.getByTestId('insert-microlearning-name')
            ).toHaveValue('W4 Duplicate Second Source ' + locale)
            await discardActivityWizard(page)
            expect(await snapshotKeys(page)).toBe(0)

            // Conversion is only offered on an ended microlearning; switch
            // the status directly and refresh the course page.
            const statusResult = await runTask('changeActivityStatus', {
              activityName: 'Seed Microlearning',
              activityType: 'MICRO_LEARNING',
              status: 'ENDED',
            })
            if (statusResult === false) {
              throw new Error('Seed Microlearning not found for conversion')
            }
            await openSeededCourseActivity(page, 'tab-microLearnings')
            await page
              .getByTestId('actions-MICRO_LEARNING-Seed Microlearning')
              .click()
            await page
              .getByTestId(
                'convert-microlearning-Seed Microlearning-to-practice-quiz'
              )
              .click()
            await expect(
              page.getByTestId('insert-practice-quiz-name')
            ).toBeVisible()
            await page
              .getByTestId('insert-practice-quiz-name')
              .fill('W4 Converted Source ' + locale)
            await page.waitForTimeout(2000)
            // Conversion uses a separate mode and activity-type dimension.
            expect(await activitySnapshotKeys(page)).toEqual([
              'autosave-activity-creation-user-lecturer-convert-PRACTICE_QUIZ-52a038e5-495e-4262-bd97-f30c3540122a',
            ])
            // Keep conversionMode in the URL so the wizard rebuilds the same
            // conversion-scoped snapshot key after reload.
            await page.reload()
            await expect(
              page.getByTestId('insert-practice-quiz-name')
            ).toBeVisible()
            await expect(
              page.getByRole('heading', { name: recoveryHeading(locale) })
            ).toBeVisible()
            await page.getByTestId('load-recovered-element-data').click()
            await expect(
              page.getByTestId('insert-practice-quiz-name')
            ).toHaveValue('W4 Converted Source ' + locale)
            await discardActivityWizard(page)
            expect(await snapshotKeys(page)).toBe(0)
          } finally {
            await runTask('changeActivityStatus', {
              activityName: 'Seed Microlearning',
              activityType: 'MICRO_LEARNING',
              status: 'DRAFT',
            })
          }
        }
      )

      // A mounted wizard that becomes clean removes only the snapshot it
      // wrote itself; an unopened recovery candidate must survive untouched.
      test(
        'clean mounted wizard clears only its own snapshot (' + locale + ')',
        async ({ page, loginLecturer }) => {
          test.skip(locale !== 'en', 'covered once in English')
          await loginLecturer()
          await createQuestionSC(page, {
            name: 'W4 Autosave Recovery Element',
            content: 'Synthetic element for autosave recovery coverage',
            choices: [
              { value: 'Correct', correct: true },
              { value: 'Incorrect', correct: false },
            ],
            userId: USER_ID_TEST,
          })
          // Plant a recovery candidate for a live-quiz wizard that is never
          // opened: its snapshot must survive the practice-quiz flow below.
          await page.evaluate((payload) => {
            localStorage.setItem(
              'autosave-activity-creation-user-lecturer-create-LIVE_QUIZ-new',
              payload
            )
          }, validLiveQuizCreateSnapshot())
          await page.reload()

          // Enter and leave the practice-quiz wizard with no edits: the
          // clean mounted wizard must clear only its own absent candidate
          // and must leave the live-quiz snapshot in place.
          await page.getByTestId(practiceQuizWizard.openButton).click()
          await expect(
            page.getByTestId(practiceQuizWizard.nameField)
          ).toBeVisible()
          await page.waitForTimeout(1300)
          expect(await snapshotKeys(page)).toBe(1)
          await page.getByTestId('cancel-activity-creation').click()
          await expect(
            page.getByTestId(practiceQuizWizard.openButton)
          ).toBeVisible()
          // Only the planted live-quiz candidate may survive: no
          // practice-quiz snapshot may have been created by the clean mount.
          expect(await activitySnapshotKeys(page)).toEqual([
            'autosave-activity-creation-user-lecturer-create-LIVE_QUIZ-new',
          ])

          // Select an element before opening the wizard. The recovery prompt
          // must pause autosave, so the candidate cannot be overwritten by
          // the wizard's initial form values while the decision is pending.
          const checkbox = page
            .locator('[data-cy^="element-checkbox-"]')
            .first()
          await expect(checkbox).toBeVisible()
          await checkbox.check()
          await page.getByTestId('create-live-quiz').click()
          await expect(
            page.getByRole('heading', { name: recoveryHeading(locale) })
          ).toBeVisible()
          await page.waitForTimeout(1300)
          const candidate = await page.evaluate(() => {
            const raw = localStorage.getItem(
              'autosave-activity-creation-user-lecturer-create-LIVE_QUIZ-new'
            )
            return raw ? JSON.parse(raw) : null
          })
          expect(candidate?.values?.name).toBe('W4 F2 Candidate')

          // Discarding the old candidate explicitly resumes autosave. The
          // selected library element is wizard state even though no form
          // field changed, so it must make the wizard dirty on cancel.
          await page.getByTestId('discard-recovered-element-data').click()
          await page.waitForTimeout(1300)
          const replacement = await page.evaluate(() => {
            const raw = localStorage.getItem(
              'autosave-activity-creation-user-lecturer-create-LIVE_QUIZ-new'
            )
            return raw ? JSON.parse(raw) : null
          })
          expect(
            Object.keys(replacement?.selectedElements ?? {})
          ).not.toHaveLength(0)
          await page.getByTestId('cancel-activity-creation').click()
          await expect(
            page.getByTestId('discard-activity-creation')
          ).toBeVisible()
          await page.getByTestId('discard-activity-creation').click()
          await page.waitForTimeout(1700)
          expect(await snapshotKeys(page)).toBe(0)

          // Discarding the wizard also clears page-owned library selection;
          // a clean re-entry must not reopen the guard for selection alone.
          await page.getByTestId('create-live-quiz').click()
          await expect(page.getByTestId('insert-live-quiz-name')).toBeVisible()
          await page.getByTestId('cancel-activity-creation').click()
          await expect(
            page.getByTestId('discard-activity-creation')
          ).toHaveCount(0)
        }
      )

      // Storage cleanup is best effort: an unavailable removeItem must not
      // leave the lecturer trapped inside the wizard.
      test(
        'storage cleanup failure does not block close (' + locale + ')',
        async ({ page, loginLecturer }) => {
          test.skip(locale !== 'en', 'covered once in English')
          await page.addInitScript(() => {
            const removeItem = Storage.prototype.removeItem
            Storage.prototype.removeItem = function (key) {
              if (key.startsWith('autosave-activity-creation')) {
                throw new Error('Synthetic storage failure')
              }
              removeItem.call(this, key)
            }
          })
          await loginLecturer()
          await openLibrary(page, locale)
          await openWizard(page, practiceQuizWizard)
          await page
            .getByTestId(practiceQuizWizard.nameField)
            .fill('W4 Storage Failure ' + locale)
          await page.getByTestId('next-or-submit').click()
          await page.waitForTimeout(1300)
          await page.getByTestId('cancel-activity-creation').click()
          await page.getByTestId('discard-activity-creation').click()
          await expect(
            page.getByTestId(practiceQuizWizard.openButton)
          ).toBeVisible()
        }
      )

      // Malformed and structurally invalid snapshots are evicted on
      // validation and are never offered or hydrated.
      test(
        'malformed snapshots are evicted and never offered (' + locale + ')',
        async ({ page, loginLecturer }) => {
          await loginLecturer()
          await page.evaluate((payload) => {
            localStorage.setItem(
              'autosave-activity-creation-user-lecturer-create-PRACTICE_QUIZ-new',
              payload
            )
          }, '{"not": "json"')
          await openLibrary(page, locale)
          // A malformed payload must be evicted without ever being offered.
          await page.getByTestId(practiceQuizWizard.openButton).click()
          await expect(
            page.getByTestId(practiceQuizWizard.nameField)
          ).toBeVisible()
          await expectNoRecoveryDialog(page, locale)
          expect(await snapshotKeys(page)).toBe(0)
          await page.getByTestId('cancel-activity-creation').click()
          await expect(
            page.getByTestId(practiceQuizWizard.openButton)
          ).toBeVisible()

          // A structurally invalid payload fails field validation and is
          // evicted on the availability check of the next wizard visit.
          await page.evaluate(
            (payload) => {
              localStorage.setItem(
                'autosave-activity-creation-user-lecturer-create-PRACTICE_QUIZ-new',
                payload
              )
            },
            validCreateSnapshot({ values: { name: 42 } })
          )
          await page.getByTestId(practiceQuizWizard.openButton).click()
          await expect(
            page.getByTestId(practiceQuizWizard.nameField)
          ).toBeVisible()
          await page.waitForTimeout(1300)
          expect(await snapshotKeys(page)).toBe(0)
          await page.getByTestId('cancel-activity-creation').click()
          await page.waitForTimeout(1700)

          // Planting while the wizard is open, then reloading, exercises
          // the same validate-and-evict reader on the remount so the
          // corrupt payload is never offered either.
          await page.getByTestId(practiceQuizWizard.openButton).click()
          await expect(
            page.getByTestId(practiceQuizWizard.nameField)
          ).toBeVisible()
          await page.evaluate(
            (payload) => {
              localStorage.setItem(
                'autosave-activity-creation-user-lecturer-create-PRACTICE_QUIZ-new',
                payload
              )
            },
            validCreateSnapshot({ values: { name: 42 } })
          )
          await page.reload()
          await page.getByTestId(practiceQuizWizard.openButton).click()
          await expect(
            page.getByTestId(practiceQuizWizard.nameField)
          ).toBeVisible()
          await expectNoRecoveryDialog(page, locale)
          expect(await snapshotKeys(page)).toBe(0)
        }
      )

      // Keep editing on the dirty-cancel dialog must preserve the entered
      // value and permit a later discard of the same data.
      test(
        'keep editing preserves entered values for later discard (' +
          locale +
          ')',
        async ({ page, loginLecturer }) => {
          await loginLecturer()
          await openLibrary(page, locale)
          await openWizard(page, practiceQuizWizard)
          const name = 'W4 Keep ' + locale
          await page.getByTestId(practiceQuizWizard.nameField).fill(name)
          await page.getByTestId('next-or-submit').click()
          await expect(
            page.getByTestId('insert-practice-quiz-display-name')
          ).toBeVisible()
          await page.waitForTimeout(1300)

          await page.getByTestId('cancel-activity-creation').click()
          if (locale === 'de') {
            await expect(
              page.getByRole('heading', { name: de.confirmCancelTitle })
            ).toBeVisible()
          } else {
            await expect(
              page.getByRole('heading', {
                name: en.confirmCancelTitle,
              })
            ).toBeVisible()
          }
          await page.getByTestId('keep-editing-activity-creation').click()
          await expect(
            page.getByTestId('discard-activity-creation')
          ).toHaveCount(0)
          // Keep editing leaves the wizard open; return to the first step and
          // verify that the entered value is still intact.
          await page.getByTestId('back-activity-creation').click()
          await expect(
            page.getByTestId(practiceQuizWizard.nameField)
          ).toHaveValue(name)
          await page.getByTestId('next-or-submit').click()
          await expect(
            page.getByTestId('insert-practice-quiz-display-name')
          ).toBeVisible()

          // The second cancel must open the guard again over the same data.
          await page.getByTestId('cancel-activity-creation').click()
          await expect(
            page.getByTestId('discard-activity-creation')
          ).toBeVisible()
          await page.getByTestId('discard-activity-creation').click()
          await page.waitForTimeout(1700)
          await expect(
            page.getByTestId(practiceQuizWizard.openButton)
          ).toBeVisible()
          expect(await snapshotKeys(page)).toBe(0)
        }
      )

      // Edit mode is guard-only: it never persists snapshots, uses the
      // edit-specific cancel copy, and a successful edit save leaves no
      // recovery candidate behind.
      test(
        'edit mode is guard-only and completes without snapshots (' +
          locale +
          ')',
        async ({ page, loginLecturer }) => {
          test.skip(locale !== 'en', 'covered once in English')
          await loginLecturer()
          await createQuestionSC(page, {
            name: 'W4 Edit Stack Question',
            content: 'Synthetic question for the W4 edit-mode test',
            choices: [
              { value: 'Correct', correct: true },
              { value: 'Incorrect', correct: false },
            ],
            userId: USER_ID_TEST,
          })
          // Build the edit candidate through the wizard so the flow and the
          // stack step are fully populated.
          await createPracticeQuiz(page, {
            name: 'W4 Edit Target',
            displayName: 'W4 Edit Target',
            courseName: SEEDED_COURSE,
            stacks: [{ elements: ['W4 Edit Stack Question'] }],
          })
          await expect(page.getByTestId('create-new-activity')).toBeVisible()

          await page.getByTestId('courses').click()
          await page.getByTestId('course-list-button-' + SEEDED_COURSE).click()
          await page.getByTestId('tab-practiceQuizzes').click()
          await page.getByTestId('actions-PRACTICE_QUIZ-W4 Edit Target').click()
          await page.getByTestId('edit-practice-quiz-W4 Edit Target').click()
          await expect(
            page.getByTestId('insert-practice-quiz-name')
          ).toBeVisible()

          // Edit mode never writes a snapshot, even while sitting on the
          // step with edits entered, and a reload offers no recovery.
          await page
            .getByTestId('insert-practice-quiz-name')
            .fill('W4 Edited Practice Quiz')
          await page.waitForTimeout(2200)
          await expectNoRecoveryDialog(page, locale)
          expect(await snapshotKeys(page)).toBe(0)

          // The guard uses the edit-specific cancel dialog copy.
          await expect(
            page.getByTestId('insert-practice-quiz-name')
          ).toBeVisible()
          await page
            .getByTestId('insert-practice-quiz-name')
            .fill('W4 Edited Practice Quiz Final')
          await page.getByTestId('cancel-activity-creation').click()
          await expect(
            page.getByRole('heading', { name: en.confirmCancelEditTitle })
          ).toBeVisible()
          await page.getByTestId('keep-editing-activity-creation').click()
          await expect(
            page.getByTestId('discard-activity-creation')
          ).toHaveCount(0)

          // A successful edit save completes the wizard and leaves no
          // recovery candidate behind.
          await page
            .getByTestId('insert-practice-quiz-name')
            .fill('W4 Edited Practice Quiz')
          await page.getByTestId('next-or-submit').click()
          await expect(
            page.getByTestId('insert-practice-quiz-display-name')
          ).toBeVisible()
          await page.getByTestId('next-or-submit').click()
          await page.getByTestId('next-or-submit').click()
          await page.getByTestId('next-or-submit').click()
          await expect(page.getByTestId('open-activity-overview')).toBeVisible()
          await page.waitForTimeout(1300)
          expect(await snapshotKeys(page)).toBe(0)
        }
      )
    })
  }
})
