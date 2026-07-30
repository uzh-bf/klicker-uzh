import { expect, type Request, type Route } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import {
  COURSE_ID_TEST,
  COURSE_ID_TEST3,
  URL_MANAGE,
  URL_STUDENT,
  USER_ID_TEST,
} from '../util/constants.js'
import { test } from '../util/fixtures.js'
import { selectOption } from '../util/fixtures/activities.js'
import {
  createQuestionSC,
  fillAnswerField,
  fillEditorField,
} from '../util/fixtures/elements.js'
import { statusLabels } from '../util/messages.js'

const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
const studentUrl = process.env.URL_STUDENT ?? URL_STUDENT
const treeName = 'Adaptive E2E tree'
const treeDisplayName = 'Adaptive E2E competence tree'
const elementNames = [
  'Adaptive E2E single choice 1',
  'Adaptive E2E single choice 2',
  'Adaptive E2E single choice 3',
  'Adaptive E2E single choice 4',
] as const
const elementName = elementNames[0]
const quizName = 'Adaptive E2E practice quiz'
const quizDisplayName = 'Adaptive E2E practice'

function hasGraphqlOperation(request: Request, operationName: string) {
  let payload: unknown
  try {
    payload = request.postDataJSON()
  } catch {
    return false
  }

  const operations = Array.isArray(payload) ? payload : [payload]
  return operations.some(
    (operation) =>
      typeof operation === 'object' &&
      operation !== null &&
      'operationName' in operation &&
      operation.operationName === operationName
  )
}

async function fulfillGraphqlError(route: Route, message: string) {
  const origin = route.request().headers().origin

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: origin
      ? {
          'access-control-allow-credentials': 'true',
          'access-control-allow-origin': origin,
          vary: 'Origin',
        }
      : undefined,
    body: JSON.stringify({
      data: null,
      errors: [{ message }],
    }),
  })
}

async function findTree() {
  const prisma = await getPrisma()
  const tree = await prisma.competenceTree.findFirst({
    where: { name: treeName },
    include: {
      levels: { orderBy: { order: 'asc' } },
      nodes: { orderBy: { depth: 'asc' } },
      courseLinks: true,
    },
  })

  if (!tree) throw new Error(`Competence tree "${treeName}" was not found`)
  return tree
}

async function findQuiz() {
  const prisma = await getPrisma()
  const quiz = await prisma.practiceQuiz.findFirst({
    where: { name: quizName },
    include: {
      adaptiveConfig: { include: { publishedPool: true } },
    },
  })

  if (!quiz) throw new Error(`Practice quiz "${quizName}" was not found`)
  return quiz
}

test.describe('Adaptive PracticeQuiz production workflow', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 })

  let originalRolloutStates: Array<{
    id: string
    isAdaptiveLearningEnabled: boolean
  }> = []

  test.beforeAll(async () => {
    const prisma = await getPrisma()
    originalRolloutStates = await prisma.course.findMany({
      select: { id: true, isAdaptiveLearningEnabled: true },
    })
    await prisma.practiceQuiz.deleteMany({ where: { name: quizName } })
    await prisma.competenceTree.deleteMany({ where: { name: treeName } })
    await prisma.element.deleteMany({
      where: { name: { in: [...elementNames] } },
    })
  })

  test.afterAll(async () => {
    const prisma = await getPrisma()
    await prisma.$transaction(
      originalRolloutStates.map(({ id, isAdaptiveLearningEnabled }) =>
        prisma.course.update({
          where: { id },
          data: { isAdaptiveLearningEnabled },
        })
      )
    )
  })

  test('keeps adaptive authoring unavailable until a course is enabled', async ({
    page,
    loginLecturer,
  }) => {
    const prisma = await getPrisma()
    await prisma.course.updateMany({
      data: { isAdaptiveLearningEnabled: false },
    })

    try {
      await loginLecturer()
      const createPracticeQuiz = page.getByTestId('create-practice-quiz')
      await expect(createPracticeQuiz).toBeVisible({ timeout: 30_000 })
      await createPracticeQuiz.click()

      await expect(
        page.getByTestId('adaptive-mode-rollout-unavailable')
      ).toBeVisible()
      await expect(
        page.getByTestId('practice-quiz-mode-adaptive')
      ).toBeDisabled()
    } finally {
      await prisma.course.update({
        where: { id: COURSE_ID_TEST },
        data: { isAdaptiveLearningEnabled: true },
      })
    }
  })

  test('creates and reuses a depth-five competence tree', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer(`${manageUrl}/resources/competenceTrees`)
    await page.getByTestId('competence-tree-create').click()

    await page.getByTestId('competence-tree-name').fill(treeName)
    await page.getByTestId('competence-tree-display-name').fill(treeDisplayName)
    await page
      .getByTestId('competence-tree-description')
      .fill('Reusable depth-five tree for the adaptive browser workflow.')

    await page
      .getByTestId('competence-tree-node-name')
      .fill('Quantitative reasoning')
    await page.getByTestId('competence-tree-select-node-node:local:2').click()
    await page.getByTestId('competence-tree-node-name').fill('Foundations')

    for (const [key, name] of [
      ['node:local:3', 'Interpretation'],
      ['node:local:4', 'Application'],
      ['node:local:5', 'Transfer'],
    ] as const) {
      await page.getByTestId('competence-tree-node-add-child').click()
      await expect(
        page.getByTestId(`competence-tree-select-node-${key}`)
      ).toBeVisible()
      await page.getByTestId('competence-tree-node-name').fill(name)
    }

    await page
      .getByTestId('competence-tree-coverage-target-node:local:5-level:local:1')
      .fill('4')
    await page
      .getByTestId(
        'competence-tree-coverage-enabled-node:local:5-level:local:2'
      )
      .click()
    await page
      .getByTestId(
        'competence-tree-coverage-enabled-node:local:5-level:local:3'
      )
      .click()

    await page.getByTestId('competence-tree-node-parent').click()
    await page
      .getByTestId('competence-tree-node-parent-option-node:local:1')
      .click()
    await expect(
      page.getByTestId(
        'competence-tree-coverage-target-node:local:4-level:local:1'
      )
    ).toBeVisible()
    await expect(
      page.getByTestId(
        'competence-tree-coverage-target-node:local:5-level:local:1'
      )
    ).toHaveValue('4')

    await page.getByTestId('competence-tree-node-parent').click()
    await page
      .getByTestId('competence-tree-node-parent-option-node:local:4')
      .click()
    await expect(
      page.getByTestId(
        'competence-tree-coverage-target-node:local:4-level:local:1'
      )
    ).toHaveCount(0)
    await expect(
      page.getByTestId(
        'competence-tree-coverage-target-node:local:5-level:local:1'
      )
    ).toHaveValue('4')

    await page.getByTestId('competence-tree-select-node-node:local:2').click()
    await page.getByTestId('competence-tree-node-parent').click()
    await expect(
      page.getByTestId('competence-tree-node-parent-option-node:local:1')
    ).toBeVisible()
    await expect(
      page.getByTestId('competence-tree-node-parent-option-node:local:5')
    ).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.getByTestId('competence-tree-add-root').click()
    await expect(
      page.getByTestId('competence-tree-select-node-node:local:6')
    ).toBeVisible()
    await expect(page.getByTestId('competence-tree-node-name')).toBeFocused()
    await page.getByTestId('competence-tree-node-name').fill('Data literacy')
    await page.getByTestId('competence-tree-node-add-child').click()
    await expect(
      page.getByTestId('competence-tree-select-node-node:local:7')
    ).toBeVisible()
    await expect(page.getByTestId('competence-tree-node-name')).toBeFocused()
    await page
      .getByTestId('competence-tree-node-name')
      .fill('Read data displays')

    await page.getByTestId('competence-tree-save').click()
    await page.waitForURL(/\/resources\/competenceTrees\/[0-9a-f-]{36}$/)

    const tree = await findTree()
    expect(Math.max(...tree.nodes.map((node) => node.depth))).toBe(5)
    expect(tree.nodes).toHaveLength(7)

    await page
      .getByTestId('competence-tree-node-description')
      .fill('Unsaved navigation guard check')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByTestId('courses').click()
    await expect(page).toHaveURL(
      new RegExp(`/resources/competenceTrees/${tree.id}$`)
    )
    await expect(
      page.getByTestId('competence-tree-node-description')
    ).toHaveValue('Unsaved navigation guard check')

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId('competence-tree-back').click()
    await page.waitForURL(/\/resources\/competenceTrees$/)
    await page.getByTestId(`competence-tree-links-${tree.id}`).click()

    for (const courseId of [COURSE_ID_TEST, COURSE_ID_TEST3]) {
      const linkSwitch = page.getByTestId(
        `competence-tree-course-link-switch-${courseId}`
      )
      await expect(linkSwitch).toBeVisible()
      await linkSwitch.click()
      await expect(linkSwitch).toHaveAttribute('data-state', 'checked')
    }

    await page.getByTestId('competence-tree-course-links-close').click()
    await expect.poll(async () => (await findTree()).courseLinks.length).toBe(2)

    await page.goto(`${manageUrl}/resources/competenceTrees/${tree.id}`)
    await page.getByTestId('competence-tree-create-element').click()
    await page.waitForURL(`${manageUrl}/`)
    await expect(page.getByTestId('insert-question-title')).toBeVisible()
    await expect(
      page.getByTestId('adaptive-mapping-create-toggle')
    ).toBeVisible()
    await page.getByTestId('close-element-modal-button').click()
  })

  test('recovers a saved READY element after its adaptive mapping fails', async ({
    page,
    loginLecturer,
  }) => {
    const tree = await findTree()
    const leaf = tree.nodes.find((node) => node.depth === 5)
    const level = tree.levels[0]
    if (!leaf || !level) throw new Error('Depth-five leaf or level is missing')
    const prisma = await getPrisma()

    await loginLecturer()

    await page.getByTestId('create-question').click()
    await page.getByTestId('insert-question-title').fill(elementName)
    await page.getByTestId('select-question-status').click()
    await page
      .getByTestId(`select-question-status-${statusLabels.ready}`)
      .click()
    await page.getByTestId('configure-sample-solution').click()
    await fillEditorField(
      page,
      'insert-question-text',
      'Which value is equal to two plus two?'
    )
    await fillAnswerField(page, 0, '4')
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('add-new-answer').click()
    await fillAnswerField(page, 1, '5')
    await page.getByTestId('insert-question-title').click()
    await page.getByTestId('set-correctness-0').click()

    await expect(page.getByTestId('adaptive-mapping-section')).toBeVisible()
    await page.getByTestId('adaptive-mapping-create-toggle').click()
    await page.getByTestId('adaptive-mapping-tree-select').click()
    await page.getByTestId(`adaptive-mapping-tree-option-${tree.id}`).click()
    await page.getByTestId(`adaptive-mapping-leaf-select-${tree.id}`).click()
    await page
      .getByTestId(`adaptive-mapping-leaf-${tree.id}-${leaf.id}`)
      .click()
    await page.getByTestId(`adaptive-mapping-level-select-${tree.id}`).click()
    await page
      .getByTestId(`adaptive-mapping-level-${tree.id}-${level.id}`)
      .click()

    await expect(
      page.getByTestId(`adaptive-mapping-parameters-${tree.id}`)
    ).toContainText('0.50')
    await expect(page.getByTestId('save-new-question')).toContainText(
      'Create element and assign'
    )
    const coverageWhere = {
      treeId: tree.id,
      leafNodeId: leaf.id,
      levelId: level.id,
    }
    await prisma.competenceTreeLeafLevelCoverage.updateMany({
      where: coverageWhere,
      data: { enabled: false },
    })
    try {
      const mappingResponsePromise = page.waitForResponse(
        (response) =>
          hasGraphqlOperation(
            response.request(),
            'UpdateCompetenceTreeElementAssignment'
          ),
        { timeout: 30_000 }
      )
      await page.getByTestId('save-new-question').click()
      const mappingResponse = await mappingResponsePromise
      await expect(mappingResponse.json()).resolves.toMatchObject({
        errors: [
          expect.objectContaining({
            message:
              'Element assignments require enabled leaf-level coverage in the same competence tree.',
          }),
        ],
      })

      await expect(page.getByTestId('adaptive-mapping-recovery')).toBeVisible()
      await expect(
        page.getByTestId('adaptive-mapping-recovery-error-detail')
      ).toContainText(
        'Element assignments require enabled leaf-level coverage in the same competence tree.'
      )
    } finally {
      await prisma.competenceTreeLeafLevelCoverage.updateMany({
        where: coverageWhere,
        data: { enabled: true },
      })
    }

    await expect
      .poll(() => prisma.element.count({ where: { name: elementName } }))
      .toBe(1)
    await expect(
      prisma.competenceTreeElementAssignment.count({
        where: { treeId: tree.id, leafNodeId: leaf.id, levelId: level.id },
      })
    ).resolves.toBe(0)

    await page.getByTestId('close-element-modal-button').click()
    await expect(page.getByTestId('adaptive-mapping-recovery')).toHaveCount(0)
    await page.getByTestId('create-question').click()
    await expect(page.getByTestId('adaptive-mapping-recovery')).toBeVisible()
    await expect(page.getByTestId('insert-question-title')).toHaveValue(
      elementName
    )
    await page.getByTestId('adaptive-mapping-retry').click()
    await expect(page.getByTestId('adaptive-mapping-recovery')).toHaveCount(0)

    await expect
      .poll(() =>
        prisma.competenceTreeElementAssignment.count({
          where: { treeId: tree.id, leafNodeId: leaf.id, levelId: level.id },
        })
      )
      .toBe(1)
    await expect
      .poll(() => prisma.element.count({ where: { name: elementName } }))
      .toBe(1)

    for (const [index, name] of elementNames.slice(1).entries()) {
      await createQuestionSC({
        name,
        content: `Which value is equal to ${index + 3} plus one?`,
        choices: [
          { value: String(index + 4), correct: true },
          { value: String(index + 5), correct: false },
        ],
        userId: USER_ID_TEST,
      })
    }
    const additionalElements = await prisma.element.findMany({
      where: { name: { in: [...elementNames.slice(1)] } },
      select: { id: true },
    })
    expect(additionalElements).toHaveLength(3)
    await prisma.competenceTreeElementAssignment.createMany({
      data: additionalElements.map(({ id }) => ({
        treeId: tree.id,
        elementId: id,
        leafNodeId: leaf.id,
        levelId: level.id,
      })),
    })
    await expect
      .poll(() =>
        prisma.competenceTreeElementAssignment.count({
          where: { treeId: tree.id, leafNodeId: leaf.id, levelId: level.id },
        })
      )
      .toBe(4)

    await page.goto(`${manageUrl}/resources/competenceTrees/${tree.id}`)
    const assignmentTable = page.getByRole('table', {
      name: 'Review mappings for this tree. Add mappings while creating or editing an element.',
    })
    await expect(assignmentTable).toBeVisible()
    await expect(
      assignmentTable.getByRole('columnheader', {
        name: 'Discrimination (a)',
      })
    ).toBeVisible()
    await expect(
      assignmentTable.getByRole('columnheader', {
        name: 'Difficulty (b)',
      })
    ).toBeVisible()
    await expect(
      assignmentTable.getByRole('rowheader', { name: /Adaptive E2E/ }).first()
    ).toBeVisible()
    await expect(
      assignmentTable.getByRole('switch', {
        name: `Use ${elementName} in this competence tree`,
      })
    ).toBeVisible()

    const tableViewport = assignmentTable.locator('..')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(assignmentTable).toBeVisible()
    await expect
      .poll(() =>
        tableViewport.evaluate(
          (element) => element.scrollWidth > element.clientWidth
        )
      )
      .toBe(true)
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  test('creates and publishes an adaptive mode PracticeQuiz', async ({
    page,
    loginLecturer,
  }) => {
    const tree = await findTree()
    const demonstrationRoot = tree.nodes.find(
      (node) => node.parentId === null && node.name === 'Data literacy'
    )
    const prisma = await getPrisma()
    const assignment = await prisma.competenceTreeElementAssignment.findFirst({
      where: { treeId: tree.id },
    })
    if (!assignment) throw new Error('Adaptive assignment is missing')
    if (!demonstrationRoot) {
      throw new Error('Demonstration root competence is missing')
    }

    await loginLecturer()
    await page.getByTestId('create-practice-quiz').click()
    await page.getByTestId('insert-practice-quiz-name').fill(quizName)
    await page.getByTestId('practice-quiz-mode-adaptive').click()
    await page.getByTestId('next-or-submit').click()

    await page
      .getByTestId('insert-practice-quiz-display-name')
      .fill(quizDisplayName)
    await page
      .getByTestId('insert-practice-quiz-description')
      .fill('A compact adaptive E2E diagnostic.')
    await page.getByTestId('next-or-submit').click()

    await selectOption(page, '[data-cy="select-course"]', 'Testkurs')
    await page.getByTestId('adaptive-preset').click()
    await page.getByTestId('adaptive-preset-research').click()
    await page.getByTestId('adaptive-total-question-cap').fill('4')
    await page.getByTestId('adaptive-advanced-settings-toggle').click()
    await page.getByTestId('adaptive-min-questions-per-leaf').fill('1')
    await page.getByTestId('adaptive-classification-z').fill('0.01')
    await expect(page.getByTestId('next-or-submit')).toBeEnabled()
    await page.getByTestId('next-or-submit').click()

    await selectOption(
      page,
      '[data-cy="adaptive-tree-select"]',
      treeDisplayName
    )
    await expect(page.getByTestId('adaptive-hierarchy-overrides')).toBeVisible()
    await page
      .getByTestId(`adaptive-node-enabled-${demonstrationRoot.id}`)
      .click()
    await page.getByTestId('confirm-adaptive-node-disable').click()
    await expect(
      page.getByTestId(`adaptive-assignment-${assignment.id}`)
    ).toBeVisible()
    await page.getByTestId('adaptive-refresh-preview').click()
    await expect(page.getByTestId('adaptive-readiness-status')).toBeVisible()
    await expect(page.getByTestId('adaptive-readiness-errors')).toHaveCount(0)
    await expect(
      page.getByTestId(
        'adaptive-readiness-issue-ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE'
      )
    ).toHaveCount(0)
    await expect(page.getByTestId('next-or-submit')).toBeEnabled()
    await page.getByTestId('next-or-submit').click()

    await expect(page.getByTestId('open-activity-overview')).toBeVisible()
    const quiz = await findQuiz()
    expect(quiz.mode).toBe('ADAPTIVE')
    expect(quiz.courseId).toBe(COURSE_ID_TEST)

    await page.getByTestId('courses').click()
    await page
      .getByTestId('course-list-button-Testkurs')
      .click({ timeout: 30_000 })
    await page.getByRole('tab', { name: /^Practice Quizzes/ }).click()
    await page.getByTestId(`publish-practice-quiz-${quizName}`).click()
    await expect(page.getByTestId('adaptive-publication')).toBeVisible()
    await expect(page.getByTestId('adaptive-readiness-status')).toBeVisible()
    await expect(
      page.getByTestId('publish-practice-quiz-immediately')
    ).toBeEnabled()
    await page.getByTestId('publish-practice-quiz-immediately').click()

    await expect.poll(async () => (await findQuiz()).status).toBe('PUBLISHED')
    const publishedQuiz = await findQuiz()
    expect(publishedQuiz.adaptiveConfig?.publishedPool).toHaveLength(4)
  })

  test('shows level-band results and anonymous cohort reporting', async ({
    page,
    loginLecturer,
    loginStudentPassword,
  }) => {
    test.slow()
    const quiz = await findQuiz()
    const quizUrl = `${studentUrl}/course/${COURSE_ID_TEST}/practiceQuizzes/${quiz.id}`

    for (let index = 1; index <= 6; index++) {
      await loginStudentPassword(`testuser${index}`)
      await page.goto(quizUrl, { waitUntil: 'commit' })
      let rejectNextSubmit = index === 1
      let rejectNextResult = index === 1
      if (index === 1) {
        await page.route('**/graphql', async (route) => {
          if (
            rejectNextSubmit &&
            hasGraphqlOperation(
              route.request(),
              'MSubmitAdaptivePracticeQuizResponse'
            )
          ) {
            rejectNextSubmit = false
            await fulfillGraphqlError(
              route,
              'Synthetic adaptive submit failure'
            )
            return
          }
          if (
            rejectNextResult &&
            hasGraphqlOperation(route.request(), 'QAdaptivePracticeQuizResult')
          ) {
            rejectNextResult = false
            await fulfillGraphqlError(
              route,
              'Synthetic adaptive result failure'
            )
            return
          }
          await route.continue()
        })
      }
      await expect(
        page.getByTestId('adaptive-practice-quiz-intro')
      ).toBeVisible()
      await page.getByTestId('start-adaptive-practice-quiz').click()
      for (let question = 1; question <= 4; question++) {
        await expect(
          page.getByTestId('adaptive-practice-quiz-question')
        ).toBeVisible()
        await expect(
          page.getByTestId('adaptive-question-progress')
        ).toContainText(`Question ${question}`)
        await expect(page.getByTestId('adaptive-question-timer')).toBeVisible()
        await page.getByTestId('sc-0-answer-option-0').click()
        await page.getByTestId('submit-adaptive-practice-quiz-response').click()
        if (index === 1 && question === 1) {
          await expect(
            page.getByTestId('adaptive-question-progress')
          ).toContainText('Question 1')
          await expect(
            page.getByTestId('submit-adaptive-practice-quiz-response')
          ).toContainText('Try again')
          await expect(
            page.getByTestId('submit-adaptive-practice-quiz-response')
          ).toBeEnabled()
          await page
            .getByTestId('submit-adaptive-practice-quiz-response')
            .click()
        }
        if (question < 4) {
          await expect(
            page.getByTestId('adaptive-question-progress')
          ).toContainText(`Question ${question + 1}`)
        }
      }
      if (index === 1) {
        await expect(
          page.getByTestId('retry-adaptive-practice-quiz-result')
        ).toBeVisible()
        await page.getByTestId('retry-adaptive-practice-quiz-result').click()
      }
      await expect(
        page.getByTestId('adaptive-practice-quiz-result')
      ).toBeVisible()

      if (index === 1) {
        const prisma = await getPrisma()
        const participant = await prisma.participant.findUniqueOrThrow({
          where: { username: 'testuser1' },
          select: { id: true },
        })
        const attempt =
          await prisma.adaptivePracticeQuizAttempt.findFirstOrThrow({
            where: {
              practiceQuizId: quiz.id,
              participantId: participant.id,
              status: 'COMPLETED',
            },
            include: { finalLevel: { select: { label: true } } },
            orderBy: { completedAt: 'desc' },
          })
        expect(attempt.finalLevel).not.toBeNull()
        await expect(
          page.getByTestId('adaptive-result-overall-level')
        ).toHaveText(`Estimated level: ${attempt.finalLevel!.label}`)
        await expect(
          page.getByTestId('adaptive-result-level-interpretation')
        ).toContainText('diagnostic rule')
        await expect(
          page.getByTestId('adaptive-result-trajectory')
        ).toBeVisible()
        await expect(
          page.getByTestId('adaptive-competence-profile')
        ).toBeVisible()
        await page.unroute('**/graphql')
      }
    }

    const prisma = await getPrisma()
    await expect(
      prisma.adaptivePracticeQuizAttempt.count({
        where: { practiceQuizId: quiz.id, status: 'COMPLETED' },
      })
    ).resolves.toBe(6)
    await expect(
      prisma.adaptivePracticeQuizResponse.count({
        where: { attempt: { practiceQuizId: quiz.id } },
      })
    ).resolves.toBe(24)

    await loginLecturer(`${manageUrl}/practiceQuiz/${quiz.id}/evaluation`)
    await expect(page.getByTestId('adaptive-evaluation')).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-cohort-suppressed')
    ).toHaveCount(0)
    await expect(
      page.getByTestId('adaptive-evaluation-pilot-metrics')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-distribution-overall')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-root-distributions')
    ).toBeVisible()
    await expect(
      page.getByTestId('adaptive-evaluation-attempt-classified')
    ).toContainText('5')
    await expect(
      page.getByTestId('adaptive-evaluation-attempt-completed')
    ).toContainText('5')
    await expect(
      page.getByTestId('adaptive-evaluation-attempt-capped')
    ).toContainText('0')
    await expect(
      page.getByTestId('adaptive-pilot-median-questions')
    ).toContainText('4.0')
    await expect(
      page.getByTestId('adaptive-pilot-median-duration')
    ).toContainText(/\d+\.\d sec/)
    await expect(
      page.getByTestId('adaptive-pilot-response-integrity')
    ).toContainText('No issue')
    await expect(
      page.getByTestId('adaptive-pilot-duration-completeness')
    ).toContainText('No issue')
    const firstPoolItem = quiz.adaptiveConfig?.publishedPool[0]
    if (!firstPoolItem) throw new Error('Adaptive published pool is empty')
    await expect(
      page.getByTestId(`adaptive-item-diagnostic-${firstPoolItem.id}`)
    ).toContainText('Not enough data')
    await expect(page.getByText('testuser1')).toHaveCount(0)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(
      page.getByTestId(`adaptive-item-diagnostic-mobile-${firstPoolItem.id}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`adaptive-item-diagnostic-${firstPoolItem.id}`)
    ).toBeHidden()

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${manageUrl}/de/practiceQuiz/${quiz.id}/evaluation`, {
      waitUntil: 'commit',
    })
    await expect(page.getByTestId('adaptive-evaluation')).toBeVisible()
    await expect(
      page.getByTestId('adaptive-pilot-median-questions')
    ).toContainText('4,0')
    await expect(
      page.getByTestId('adaptive-pilot-median-duration')
    ).toContainText(/\d+,\d Sek\./)
    await expect(
      page.getByTestId('adaptive-pilot-near-boundary-rate')
    ).toContainText('0,0')

    const attemptWithMissingDuration =
      await prisma.adaptivePracticeQuizAttempt.findFirstOrThrow({
        where: { practiceQuizId: quiz.id, status: 'COMPLETED' },
        orderBy: { completedAt: 'asc' },
        select: { id: true },
      })
    await prisma.adaptivePracticeQuizAttempt.update({
      where: { id: attemptWithMissingDuration.id },
      data: { elapsedSeconds: null },
    })
    // Source rows are immutable after a fixed cohort release. Explicitly
    // invalidate the test snapshot to exercise privacy-safe recomputation.
    await prisma.adaptivePracticeQuizCohortSnapshot.updateMany({
      where: { practiceQuizId: quiz.id, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    })
    await page.goto(`${manageUrl}/practiceQuiz/${quiz.id}/evaluation`, {
      waitUntil: 'commit',
    })
    await expect(page.getByTestId('adaptive-evaluation')).toBeVisible()
    await expect(
      page.getByTestId('adaptive-pilot-median-duration')
    ).toContainText('Withheld')
    await expect(
      page.getByTestId('adaptive-pilot-duration-completeness')
    ).toContainText('Withheld')
    await expect(
      page.getByTestId('adaptive-pilot-median-questions')
    ).toContainText('4.0')
    await expect(
      page.getByTestId('adaptive-pilot-response-integrity')
    ).toContainText('No issue')
    await expect(
      page.getByTestId(`adaptive-item-diagnostic-${firstPoolItem.id}`)
    ).toContainText('Not enough data')
  })
})
