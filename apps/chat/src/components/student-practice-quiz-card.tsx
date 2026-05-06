'use client'

import {
  CheckCircle2Icon,
  CheckIcon,
  LoaderCircleIcon,
  XCircleIcon,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { FormEvent, useRef, useState } from 'react'
import type {
  GetPracticeStackForQuizOutput,
  SafeElement,
  StackResponseInput,
  SupportedElementType,
} from '../services/studentPracticeMcp'

type PracticeQuizToolResult = GetPracticeStackForQuizOutput & {
  kind: 'student-practice-quiz'
}

type Choice = {
  ix: number
  value: string
}

type Evaluation = {
  instanceId?: number
  explanation?: string | null
  score?: number | null
  correctness?: number | null
  pointsAwarded?: number | null
  xpAwarded?: number | null
  feedbacks?: Array<{
    correct?: boolean | null
    feedback?: string | null
    ix?: number | null
    value?: string | null
  }> | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function asQuizResult(value: unknown): PracticeQuizToolResult | null {
  const record = asRecord(value)
  const stack = asRecord(record?.stack)
  if (record?.kind !== 'student-practice-quiz' || !stack) return null
  if (!Array.isArray(stack.elements)) return null
  if (typeof record.questionRef !== 'string') return null

  return record as PracticeQuizToolResult
}

function getChoices(element: SafeElement): Choice[] {
  const choices = element.options?.choices
  if (!Array.isArray(choices)) return []

  return choices.flatMap((choice) => {
    const record = asRecord(choice)
    if (!record) return []

    const ix = Number(record.ix)
    if (!Number.isInteger(ix)) return []

    return [{ ix, value: String(record.value ?? '') }]
  })
}

function getGradingPayload(
  submission: unknown
): Record<string, unknown> | null {
  const record = asRecord(submission)
  return asRecord(record?.result) ?? record
}

function getEvaluations(submission: unknown): Evaluation[] {
  const grading = getGradingPayload(submission)
  if (!Array.isArray(grading?.evaluations)) return []
  return grading.evaluations.filter(Boolean) as Evaluation[]
}

function formatScore(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function labelForType(type: SupportedElementType): string {
  switch (type) {
    case 'SC':
      return 'Single choice'
    case 'MC':
      return 'Multiple choice'
    case 'KPRIM':
      return 'Kprim'
    case 'NUMERICAL':
      return 'Numerical'
    case 'FREE_TEXT':
      return 'Free text'
    case 'FLASHCARD':
      return 'Flashcard'
  }
}

function buildChoicesResponse(
  element: SafeElement,
  selectedChoices: Record<number, boolean> | undefined
) {
  return getChoices(element).map((choice) => ({
    ix: choice.ix,
    selected: Boolean(selectedChoices?.[choice.ix]),
  }))
}

function buildResponses({
  choicesByInstanceId,
  elements,
  flashcardsByInstanceId,
  freeTextByInstanceId,
  numericalByInstanceId,
}: {
  choicesByInstanceId: Record<number, Record<number, boolean>>
  elements: SafeElement[]
  flashcardsByInstanceId: Record<number, 'CORRECT' | 'PARTIAL' | 'INCORRECT'>
  freeTextByInstanceId: Record<number, string>
  numericalByInstanceId: Record<number, string>
}): { error?: string; responses?: StackResponseInput[] } {
  const responses: StackResponseInput[] = []

  for (const element of elements) {
    if (['SC', 'MC', 'KPRIM'].includes(element.elementType)) {
      const choices = choicesByInstanceId[element.instanceId]
      if (
        element.elementType === 'SC' &&
        !Object.values(choices ?? {}).some(Boolean)
      ) {
        return { error: 'Select an answer for each single-choice question.' }
      }

      responses.push({
        choicesResponse: buildChoicesResponse(element, choices),
        instanceId: element.instanceId,
        type: element.elementType,
      })
      continue
    }

    if (element.elementType === 'NUMERICAL') {
      const rawValue = numericalByInstanceId[element.instanceId]?.trim()
      const numericalResponse = Number(rawValue)
      if (!rawValue || !Number.isFinite(numericalResponse)) {
        return { error: 'Enter a number for each numerical question.' }
      }

      responses.push({
        instanceId: element.instanceId,
        numericalResponse,
        type: element.elementType,
      })
      continue
    }

    if (element.elementType === 'FREE_TEXT') {
      responses.push({
        freeTextResponse: freeTextByInstanceId[element.instanceId] ?? '',
        instanceId: element.instanceId,
        type: element.elementType,
      })
      continue
    }

    if (element.elementType === 'FLASHCARD') {
      const flashcardResponse = flashcardsByInstanceId[element.instanceId]
      if (!flashcardResponse) {
        return { error: 'Select a flashcard self-assessment.' }
      }

      responses.push({
        flashcardResponse,
        instanceId: element.instanceId,
        type: element.elementType,
      })
    }
  }

  return { responses }
}

function FeedbackSummary({ submission }: { submission: unknown }) {
  const grading = getGradingPayload(submission)
  if (!grading) return null

  const score = formatScore(grading.score)
  const status = typeof grading.status === 'string' ? grading.status : null
  const evaluations = getEvaluations(submission)

  return (
    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
      <div className="flex items-center gap-2 font-medium">
        <CheckCircle2Icon className="size-4" />
        <span>{status ? `Submitted (${status})` : 'Submitted'}</span>
        {score ? <span className="text-emerald-800">Score {score}</span> : null}
      </div>

      {evaluations.length > 0 ? (
        <div className="mt-2 space-y-2">
          {evaluations.map((evaluation, index) => {
            const evaluationScore = formatScore(evaluation.score)
            const correctness = formatScore(evaluation.correctness)
            return (
              <div
                key={`${evaluation.instanceId ?? index}`}
                className="text-xs leading-5"
              >
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-medium">
                  {evaluationScore ? (
                    <span>Score {evaluationScore}</span>
                  ) : null}
                  {correctness ? <span>Correctness {correctness}</span> : null}
                  {typeof evaluation.pointsAwarded === 'number' ? (
                    <span>Points {formatScore(evaluation.pointsAwarded)}</span>
                  ) : null}
                  {typeof evaluation.xpAwarded === 'number' ? (
                    <span>XP {formatScore(evaluation.xpAwarded)}</span>
                  ) : null}
                </div>
                {evaluation.explanation ? (
                  <p className="mt-1 whitespace-pre-wrap">
                    {evaluation.explanation}
                  </p>
                ) : null}
                {evaluation.feedbacks?.length ? (
                  <ul className="mt-1 space-y-1">
                    {evaluation.feedbacks.map((feedback, feedbackIndex) => (
                      <li key={feedbackIndex}>
                        {typeof feedback.correct === 'boolean'
                          ? feedback.correct
                            ? 'Correct: '
                            : 'Incorrect: '
                          : null}
                        {feedback.feedback || feedback.value || ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function ChoiceInputs({
  disabled,
  element,
  selectedChoices,
  setSelectedChoices,
}: {
  disabled: boolean
  element: SafeElement
  selectedChoices: Record<number, boolean> | undefined
  setSelectedChoices: (next: Record<number, boolean>) => void
}) {
  const choices = getChoices(element)
  const isSingleChoice = element.elementType === 'SC'

  return (
    <div className="mt-3 space-y-2">
      {choices.map((choice) => (
        <label
          key={choice.ix}
          className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-5 hover:bg-slate-50"
        >
          <input
            checked={Boolean(selectedChoices?.[choice.ix])}
            className="mt-1"
            disabled={disabled}
            name={`practice-${element.instanceId}`}
            onChange={(event) => {
              if (isSingleChoice) {
                setSelectedChoices({ [choice.ix]: event.target.checked })
              } else {
                setSelectedChoices({
                  ...(selectedChoices ?? {}),
                  [choice.ix]: event.target.checked,
                })
              }
            }}
            type={isSingleChoice ? 'radio' : 'checkbox'}
          />
          <span>{choice.value}</span>
        </label>
      ))}
    </div>
  )
}

function FlashcardButtons({
  disabled,
  selected,
  setSelected,
}: {
  disabled: boolean
  selected: 'CORRECT' | 'PARTIAL' | 'INCORRECT' | undefined
  setSelected: (next: 'CORRECT' | 'PARTIAL' | 'INCORRECT') => void
}) {
  const options = [
    { label: 'I knew it', value: 'CORRECT' as const },
    { label: 'Partially', value: 'PARTIAL' as const },
    { label: 'Not yet', value: 'INCORRECT' as const },
  ]

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            selected === option.value
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
          disabled={disabled}
          onClick={() => setSelected(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function StudentPracticeQuizCard({
  result,
  status,
}: {
  result?: unknown
  status: { type: string }
}) {
  const params = useParams<{ chatbotId?: string }>()
  const quiz = asQuizResult(result)
  const startedAtMs = useRef(Date.now())
  const [choicesByInstanceId, setChoicesByInstanceId] = useState<
    Record<number, Record<number, boolean>>
  >({})
  const [freeTextByInstanceId, setFreeTextByInstanceId] = useState<
    Record<number, string>
  >({})
  const [numericalByInstanceId, setNumericalByInstanceId] = useState<
    Record<number, string>
  >({})
  const [flashcardsByInstanceId, setFlashcardsByInstanceId] = useState<
    Record<number, 'CORRECT' | 'PARTIAL' | 'INCORRECT'>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submission, setSubmission] = useState<unknown>(null)

  const chatbotId = params.chatbotId
  const isDisabled = isSubmitting || Boolean(submission)
  const elementCount = quiz?.stack.elements.length ?? 0
  const title = quiz?.stack.stackTitle ?? 'Practice question'

  if (status.type === 'running' && !quiz) {
    return (
      <div className="my-2 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <LoaderCircleIcon className="size-4 animate-spin" />
        <span>Loading practice question...</span>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="my-2 inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <XCircleIcon className="size-4" />
        <span>Practice question unavailable</span>
      </div>
    )
  }
  const activeQuiz = quiz

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!chatbotId) {
      setError('Chatbot route is missing.')
      return
    }

    const built = buildResponses({
      choicesByInstanceId,
      elements: activeQuiz.stack.elements,
      flashcardsByInstanceId,
      freeTextByInstanceId,
      numericalByInstanceId,
    })

    if (built.error || !built.responses) {
      setError(
        built.error ?? 'Complete the practice question before submitting.'
      )
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(
        `/api/chatbots/${chatbotId}/practice/submit`,
        {
          body: JSON.stringify({
            questionRef: activeQuiz.questionRef,
            responses: built.responses,
            stackAnswerTimeSeconds: Math.max(
              0,
              Math.round((Date.now() - startedAtMs.current) / 1000)
            ),
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        }
      )

      if (!response.ok) {
        throw new Error(
          `Practice submission failed with HTTP ${response.status}`
        )
      }

      setSubmission(await response.json())
    } catch (submitError) {
      console.error('Failed to submit practice answer:', submitError)
      setError('Could not submit the practice answer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      className="my-3 w-full rounded-md border border-slate-200 bg-slate-50 p-4 text-slate-950 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase text-slate-500">
            Practice question{elementCount > 1 ? ` (${elementCount})` : ''}
          </div>
          <h3 className="mt-1 text-base font-semibold leading-6">{title}</h3>
        </div>
        {submission ? (
          <CheckCircle2Icon className="size-5 text-emerald-600" />
        ) : null}
      </div>

      {quiz.stack.description ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {quiz.stack.description}
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        {quiz.stack.elements.map((element, index) => (
          <section
            key={element.instanceId}
            className="rounded-md border border-slate-200 bg-white p-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase text-slate-500">
              <span>{labelForType(element.elementType)}</span>
              {elementCount > 1 ? (
                <span>
                  {index + 1}/{elementCount}
                </span>
              ) : null}
            </div>
            {element.name ? (
              <h4 className="mt-1 text-sm font-semibold leading-6 text-slate-950">
                {element.name}
              </h4>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
              {element.content}
            </p>

            {['SC', 'MC', 'KPRIM'].includes(element.elementType) ? (
              <ChoiceInputs
                disabled={isDisabled}
                element={element}
                selectedChoices={choicesByInstanceId[element.instanceId]}
                setSelectedChoices={(next) =>
                  setChoicesByInstanceId((current) => ({
                    ...current,
                    [element.instanceId]: next,
                  }))
                }
              />
            ) : null}

            {element.elementType === 'NUMERICAL' ? (
              <input
                className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                disabled={isDisabled}
                inputMode="decimal"
                onChange={(event) =>
                  setNumericalByInstanceId((current) => ({
                    ...current,
                    [element.instanceId]: event.target.value,
                  }))
                }
                placeholder={String(element.options?.placeholder ?? '')}
                type="number"
                value={numericalByInstanceId[element.instanceId] ?? ''}
              />
            ) : null}

            {element.elementType === 'FREE_TEXT' ? (
              <textarea
                className="mt-3 min-h-24 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                disabled={isDisabled}
                onChange={(event) =>
                  setFreeTextByInstanceId((current) => ({
                    ...current,
                    [element.instanceId]: event.target.value,
                  }))
                }
                value={freeTextByInstanceId[element.instanceId] ?? ''}
              />
            ) : null}

            {element.elementType === 'FLASHCARD' ? (
              <FlashcardButtons
                disabled={isDisabled}
                selected={flashcardsByInstanceId[element.instanceId]}
                setSelected={(next) =>
                  setFlashcardsByInstanceId((current) => ({
                    ...current,
                    [element.instanceId]: next,
                  }))
                }
              />
            ) : null}
          </section>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {submission ? <FeedbackSummary submission={submission} /> : null}

      <div className="mt-4 flex justify-end">
        <button
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isDisabled}
          type="submit"
        >
          {isSubmitting ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          Submit
        </button>
      </div>
    </form>
  )
}
