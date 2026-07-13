import { expect } from '@playwright/test'
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
import { createQuestionSC } from '../util/fixtures/elements.js'

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

test.describe.serial('Adaptive PracticeQuiz production workflow', () => {
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
      await page.getByTestId('create-practice-quiz').click()

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

    await page.getByTestId('competence-tree-save').click()
    await page.waitForURL(/\/resources\/competenceTrees\/[0-9a-f-]{36}$/)

    const tree = await findTree()
    expect(Math.max(...tree.nodes.map((node) => node.depth))).toBe(5)
    expect(tree.nodes).toHaveLength(5)

    await page.getByTestId('competence-tree-back').click()
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
  })

  test('maps a READY element to the deepest leaf and inferred item model', async ({
    page,
    loginLecturer,
  }) => {
    const tree = await findTree()
    const leaf = tree.nodes.find((node) => node.depth === 5)
    const level = tree.levels[0]
    if (!leaf || !level) throw new Error('Depth-five leaf or level is missing')

    await createQuestionSC({
      name: elementName,
      content: 'Which value is equal to two plus two?',
      choices: [
        { value: '4', correct: true },
        { value: '5', correct: false },
      ],
      userId: USER_ID_TEST,
    })

    await loginLecturer()
    await page.getByTestId('elements-search-input').fill(elementName)
    await page.keyboard.press('Enter')
    await page.getByTestId(`element-title-${elementName}`).click()

    await expect(page.getByTestId('adaptive-mapping-section')).toBeVisible()
    await page.getByTestId(`adaptive-mapping-add-${tree.id}`).click()
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
    await page.getByTestId(`adaptive-mapping-save-${tree.id}`).click()

    const prisma = await getPrisma()
    await expect
      .poll(() =>
        prisma.competenceTreeElementAssignment.count({
          where: { treeId: tree.id, leafNodeId: leaf.id, levelId: level.id },
        })
      )
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
    await page.getByTestId('close-element-modal').click()
  })

  test('creates and publishes an adaptive mode PracticeQuiz', async ({
    page,
    loginLecturer,
  }) => {
    const tree = await findTree()
    const prisma = await getPrisma()
    const assignment = await prisma.competenceTreeElementAssignment.findFirst({
      where: { treeId: tree.id },
    })
    if (!assignment) throw new Error('Adaptive assignment is missing')

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
    await page.getByTestId('adaptive-total-question-cap').fill('4')
    await page.getByTestId('adaptive-advanced-settings-toggle').click()
    await page.getByTestId('adaptive-min-questions-per-leaf').fill('1')
    await expect(page.getByTestId('next-or-submit')).toBeEnabled()
    await page.getByTestId('next-or-submit').click()

    await selectOption(
      page,
      '[data-cy="adaptive-tree-select"]',
      treeDisplayName
    )
    await expect(page.getByTestId('adaptive-hierarchy-overrides')).toBeVisible()
    await expect(
      page.getByTestId(`adaptive-assignment-${assignment.id}`)
    ).toBeVisible()
    await page.getByTestId('adaptive-refresh-preview').click()
    await expect(page.getByTestId('adaptive-readiness-status')).toBeVisible()
    await expect(page.getByTestId('adaptive-readiness-errors')).toHaveCount(0)
    await expect(page.getByTestId('next-or-submit')).toBeEnabled()
    await page.getByTestId('next-or-submit').click()

    await expect(page.getByTestId('open-activity-overview')).toBeVisible()
    const quiz = await findQuiz()
    expect(quiz.mode).toBe('ADAPTIVE')
    expect(quiz.courseId).toBe(COURSE_ID_TEST)

    await page.getByTestId('courses').click()
    await page.getByTestId('course-list-button-Testkurs').click()
    await page.getByTestId('tab-practiceQuizzes').click()
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
    test.setTimeout(180_000)

    const quiz = await findQuiz()
    const quizUrl = `${studentUrl}/course/${COURSE_ID_TEST}/practiceQuizzes/${quiz.id}`

    for (let index = 1; index <= 5; index++) {
      await loginStudentPassword(`testuser${index}`)
      await page.goto(quizUrl, { waitUntil: 'commit' })
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
        if (question < 4) {
          await expect(
            page.getByTestId('adaptive-question-progress')
          ).toContainText(`Question ${question + 1}`)
        }
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
        ).toHaveText(attempt.finalLevel!.label)
        await expect(
          page.getByTestId('adaptive-result-trajectory')
        ).toBeVisible()
        await expect(
          page.getByTestId('adaptive-competence-profile')
        ).toBeVisible()
      }
    }

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
    await expect(page.getByText('testuser1')).toHaveCount(0)
  })
})
