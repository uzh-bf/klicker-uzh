import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { test } from '../util/fixtures.js'
import { env, loginStudentPassword, runTask } from '../util/workflow.js'

const data = JSON.parse(
  fs.readFileSync(
    new URL('../fixtures/Q-practice-quiz.json', import.meta.url),
    'utf8'
  )
).semantic

let quiz: { id: string; courseId: string; semanticInstanceId: number }

async function openQuiz(page: Page, username: string) {
  await loginStudentPassword(page, { username })
  await page.goto(
    `${env('URL_STUDENT')}/course/${quiz.courseId}/practiceQuizzes/${quiz.id}`,
    { waitUntil: 'commit' }
  )
}

async function startQuiz(page: Page, decision: 'accept' | 'decline') {
  await page.getByTestId('start-practice-quiz').click()
  const disclosure = page.getByTestId('semantic-evaluation-consent')
  await expect(disclosure).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: 'AI-assisted feedback' })
  ).toBeVisible()
  await page.getByTestId(`semantic-consent-${decision}`).click()
  await expect(page.getByTestId('free-text-input-0')).toBeVisible()
}

async function submitInitialStack(page: Page, semanticAnswer: string) {
  await page.getByTestId('free-text-input-0').fill(semanticAnswer)
  await page.getByTestId('free-text-input-1').fill(data.legacySolution)
  await page.getByTestId('student-stack-submit').click()
}

test.describe.serial('Semantic free-text Practice Quiz retries', () => {
  test.beforeAll(async () => {
    await runTask('cleanupDatabase')
    await runTask('seedDatabase')
    quiz = (await runTask('seedSemanticPracticeQuiz', data)) as typeof quiz
  })

  test('persists partial feedback and retries only the semantic answer', async ({
    page,
  }) => {
    await openQuiz(page, 'testuser1')
    await startQuiz(page, 'accept')
    await submitInitialStack(page, data.partialAnswer)

    await expect(
      page.getByText(data.semanticEvaluation.reference_solution)
    ).toHaveCount(0)
    await expect(page.getByTestId('semantic-evaluation-consent')).toHaveCount(0)

    const panel = page.getByTestId('semantic-free-text-retry-panel')
    await expect(panel).toContainText('Your answer is being evaluated.')
    await expect(panel).toContainText(data.partialLabel)
    await expect(page.getByTestId('semantic-attempts-used')).toContainText(
      '1 of 2'
    )

    await page.reload({ waitUntil: 'commit' })
    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByTestId('semantic-evaluation-consent')).toHaveCount(0)
    await expect(panel).toContainText(data.partialLabel)
    await expect(page.getByTestId('free-text-input-0')).toBeDisabled()
    await expect(page.getByTestId('free-text-input-1')).toBeDisabled()

    await page.getByTestId('semantic-try-again').click()
    await expect(page.getByTestId('free-text-input-0')).toBeEnabled()
    await expect(page.getByTestId('free-text-input-0')).toHaveValue(
      data.partialAnswer
    )
    await expect(page.getByTestId('free-text-input-1')).toBeDisabled()

    await page.getByTestId('free-text-input-0').fill(data.correctAnswer)
    await page.getByTestId('semantic-submit-improved-answer').click()
    await expect(panel).toContainText(data.correctLabel)
    await expect(page.getByTestId('semantic-attempts-used')).toContainText(
      '2 of 2'
    )

    await page.getByTestId('semantic-toggle-explanation').click()
    await expect(page.getByTestId('semantic-solution-details')).toContainText(
      data.semanticEvaluation.reference_solution
    )
    await expect(
      page.getByTestId('semantic-rubric-result-risk-reduction')
    ).toContainText(
      'Die Stufe „erfüllt“ wurde gewählt, weil die Antwort folgendes Kriterium erfüllt: Unsystematisches Risiko und Korrelation werden erklärt.'
    )
  })

  test('declining external evaluation keeps a non-match unavailable and allows reveal', async ({
    page,
  }) => {
    await openQuiz(page, 'testuser2')
    await startQuiz(page, 'decline')
    await submitInitialStack(page, data.incorrectAnswer)

    const panel = page.getByTestId('semantic-free-text-retry-panel')
    await expect(panel).toContainText(
      'Semantic feedback is currently unavailable.'
    )
    await expect(page.getByTestId('semantic-evaluation-consent')).toHaveCount(0)
    await expect(page.getByTestId('semantic-attempts-used')).toContainText(
      '0 of 2'
    )
    await page.getByTestId('semantic-show-solution').click()
    await page.getByTestId('semantic-toggle-explanation').click()
    await expect(page.getByTestId('semantic-solution-details')).toContainText(
      data.semanticEvaluation.reference_solution
    )
  })

  test('reveals every rubric criterion after partial feedback', async ({
    page,
  }) => {
    await openQuiz(page, 'testuser5')
    await startQuiz(page, 'accept')
    await submitInitialStack(page, data.partialAnswer)

    const panel = page.getByTestId('semantic-free-text-retry-panel')
    await expect(panel).toContainText(data.partialLabel)
    await page.getByTestId('semantic-show-solution').click()
    await page.getByTestId('semantic-toggle-explanation').click()

    await expect(page.getByTestId('semantic-rubric-summary')).toContainText(
      '2 of 4 criteria fully met'
    )

    const rubricIds = [
      'risk-reduction',
      'diversification-mechanism',
      'correlation',
      'risk-scope',
    ]
    for (const rubricId of rubricIds) {
      await expect(
        page.getByTestId(`semantic-rubric-overview-${rubricId}`)
      ).toBeVisible()
      await expect(
        page.getByTestId(`semantic-rubric-result-${rubricId}`)
      ).toBeVisible()
    }

    await expect(
      page.getByTestId('semantic-rubric-result-risk-reduction')
    ).toHaveAttribute('open', '')
    const riskReductionFeedback = page.getByTestId(
      'semantic-rubric-ai-feedback-risk-reduction'
    )
    await expect(riskReductionFeedback).toContainText('AI feedback')
    await expect(riskReductionFeedback).toContainText('Why this score')
    await expect(riskReductionFeedback).toContainText('How to improve')
    await expect(riskReductionFeedback).toContainText(
      'Die Antwort erkennt korrekt'
    )
    await expect(riskReductionFeedback).toContainText(
      'Ergänze, dass sich unternehmensspezifische Schwankungen'
    )
    const correlationResult = page.getByTestId(
      'semantic-rubric-result-correlation'
    )
    await expect(correlationResult).not.toHaveAttribute('open', '')
    await correlationResult.locator('summary').focus()
    await page.keyboard.press('Enter')
    await expect(correlationResult).toHaveAttribute('open', '')
  })

  test('keeps exact matching after declining external evaluation', async ({
    page,
  }) => {
    await openQuiz(page, 'testuser3')
    await startQuiz(page, 'decline')
    await submitInitialStack(page, data.exactAnswer)

    await expect(page.getByTestId('semantic-evaluation-consent')).toHaveCount(0)
    await expect(
      page.getByTestId('semantic-free-text-retry-panel')
    ).toContainText(data.correctLabel)
    await expect(page.getByTestId('semantic-practice-again')).toBeVisible()
  })

  test('auto-reveals the solution after the configured attempt limit', async ({
    page,
  }) => {
    await openQuiz(page, 'testuser4')
    await startQuiz(page, 'accept')
    await submitInitialStack(page, data.incorrectAnswer)

    const panel = page.getByTestId('semantic-free-text-retry-panel')
    await expect(panel).toContainText(data.incorrectLabel)
    await page.getByTestId('semantic-try-again').click()
    await page
      .getByTestId('free-text-input-0')
      .fill(`${data.incorrectAnswer} Noch einmal.`)
    await page.getByTestId('semantic-submit-improved-answer').click()

    await expect(panel).toContainText(data.incorrectLabel)
    await expect(page.getByTestId('semantic-practice-again')).toBeVisible()
    await expect(page.getByTestId('semantic-toggle-explanation')).toBeVisible()
    await page.getByTestId('semantic-toggle-explanation').click()
    await expect(page.getByTestId('semantic-solution-details')).toContainText(
      data.semanticEvaluation.reference_solution
    )
  })
})
