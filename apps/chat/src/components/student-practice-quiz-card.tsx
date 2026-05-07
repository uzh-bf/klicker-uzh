'use client'

import type {
  ElementInstance,
  ElementStack,
  InstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  type ChoicesStudentResponseType,
  type StackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import useStudentResponse from '@klicker-uzh/shared-components/src/hooks/useStudentResponse'
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  XCircleIcon,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  GetPracticeStackForQuizOutput,
  StackResponseInput,
} from '../services/studentPracticeMcp'

type PracticeQuizToolResult = GetPracticeStackForQuizOutput & {
  kind: 'student-practice-quiz'
}

const EMPTY_STACK = {
  id: 0,
  elements: [],
} as unknown as ElementStack

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function asQuizResult(value: unknown): PracticeQuizToolResult | null {
  const record = asRecord(value)
  const stack = asRecord(record?.stack)
  if (record?.kind !== 'student-practice-quiz' || !stack) return null
  if (!Array.isArray(stack.elements)) return null
  if (stack.elements.length === 0) return null
  if (typeof record.questionRef !== 'string') return null

  const hasRenderableElements = stack.elements.every((element) => {
    const elementRecord = asRecord(element)
    return (
      typeof elementRecord?.id === 'number' &&
      typeof elementRecord.elementType === 'string' &&
      !!asRecord(elementRecord.elementData)
    )
  })
  if (!hasRenderableElements) return null

  return record as PracticeQuizToolResult
}

function toElementStack(quiz: PracticeQuizToolResult): ElementStack {
  return {
    id: quiz.stack.stackId,
    displayName: quiz.stack.stackTitle,
    description: quiz.stack.description ?? null,
    elements: quiz.stack.elements as unknown as ElementInstance[],
  } as ElementStack
}

function getGradingPayload(
  submission: unknown
): Record<string, unknown> | null {
  const record = asRecord(submission)
  return asRecord(record?.result) ?? record
}

function getEvaluations(submission: unknown): InstanceEvaluation[] {
  const grading = getGradingPayload(submission)
  if (!Array.isArray(grading?.evaluations)) return []
  return grading.evaluations.filter(Boolean) as InstanceEvaluation[]
}

function createStackStorage(
  studentResponse: StackStudentResponseType,
  submission: unknown
): StackStudentResponseType {
  const evaluations = getEvaluations(submission)

  return Object.entries(studentResponse).reduce<StackStudentResponseType>(
    (acc, [instanceId, value]) => {
      const parsedInstanceId = parseInt(instanceId, 10)
      acc[parsedInstanceId] = {
        ...value,
        evaluation: evaluations.find(
          (evaluation) => evaluation.instanceId === parsedInstanceId
        ),
      }
      return acc
    },
    {}
  )
}

function choicesResponse(
  response: ChoicesStudentResponseType | undefined
): Array<{ ix: number; selected: boolean }> {
  return Object.entries(response ?? {})
    .filter(([, selected]) => selected)
    .map(([ix, selected]) => ({
      ix: parseInt(ix, 10),
      selected: selected ?? false,
    }))
}

function buildResponses({
  elements,
  studentResponse,
}: {
  elements: ElementInstance[]
  studentResponse: StackStudentResponseType
}): { error?: string; responses?: StackResponseInput[] } {
  const responses: StackResponseInput[] = []

  for (const element of elements) {
    const value = studentResponse[element.id]
    if (!value?.valid) {
      return { error: 'Complete the practice question before submitting.' }
    }

    if (
      value.type === ElementType.Sc ||
      value.type === ElementType.Mc ||
      value.type === ElementType.Kprim
    ) {
      responses.push({
        choicesResponse: choicesResponse(
          value.response as ChoicesStudentResponseType
        ),
        instanceId: element.id,
        type: value.type,
      })
    } else if (value.type === ElementType.Numerical) {
      responses.push({
        instanceId: element.id,
        numericalResponse: parseFloat(value.response as string),
        type: value.type,
      })
    } else if (value.type === ElementType.FreeText) {
      responses.push({
        freeTextResponse: value.response as string,
        instanceId: element.id,
        type: value.type,
      })
    } else if (value.type === ElementType.Flashcard) {
      responses.push({
        flashcardResponse:
          value.response as StackResponseInput['flashcardResponse'],
        instanceId: element.id,
        type: value.type,
      })
    } else {
      return { error: 'This practice question type is not supported in chat.' }
    }
  }

  return { responses }
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
  const stack = useMemo(
    () => (quiz ? toElementStack(quiz) : EMPTY_STACK),
    [quiz]
  )
  const startedAtMs = useRef(Date.now())
  const [activeElementIx, setActiveElementIx] = useState(0)
  const [studentResponse, setStudentResponse] =
    useState<StackStudentResponseType>({})
  const [stackStorage, setStackStorage] = useState<
    StackStudentResponseType | undefined
  >(undefined)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useStudentResponse({
    currentStep: 1,
    setStudentResponse,
    stack,
  })

  useEffect(() => {
    startedAtMs.current = Date.now()
    setActiveElementIx(0)
    setError(null)
    setStackStorage(undefined)
  }, [quiz?.questionRef])

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
  const chatbotId = params.chatbotId
  const elements = (stack.elements ?? []) as ElementInstance[]
  const elementCount = elements.length
  const displayedElementIx = Math.min(activeElementIx, elementCount - 1)
  const activeElement = elements[displayedElementIx]
  const activeResponse = activeElement
    ? studentResponse[activeElement.id]
    : undefined
  const isSubmitted = typeof stackStorage !== 'undefined'
  const allResponsesValid = elements.every(
    (element) => studentResponse[element.id]?.valid === true
  )
  const canMoveForward = isSubmitted || activeResponse?.valid === true

  async function handleSubmit() {
    setError(null)

    if (isSubmitted) return

    if (!chatbotId) {
      setError('Chatbot route is missing.')
      return
    }

    const built = buildResponses({
      elements,
      studentResponse,
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

      const submission = await response.json()
      setStackStorage(createStackStorage(studentResponse, submission))
      setActiveElementIx(0)
    } catch (submitError) {
      console.error('Failed to submit practice answer:', submitError)
      setError('Could not submit the practice answer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="my-3 w-full rounded-md border border-slate-200 bg-white p-4 text-slate-950 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase text-slate-500">
            Practice question
          </div>
          <h3 className="mt-1 text-base font-semibold leading-6">
            {activeQuiz.stack.stackTitle}
          </h3>
        </div>
        {isSubmitted ? (
          <CheckCircle2Icon className="size-5 text-emerald-600" />
        ) : null}
      </div>

      {activeQuiz.stack.description ? (
        <div className="mt-2 text-sm leading-6 text-slate-700">
          <DynamicMarkdown content={activeQuiz.stack.description} withProse />
        </div>
      ) : null}

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
        {elementCount > 1 ? (
          <div className="mb-3 text-xs font-medium uppercase text-slate-500">
            Question {displayedElementIx + 1}/{elementCount}
          </div>
        ) : null}

        {activeElement ? (
          <StudentElement
            compact
            disabledInput={isSubmitted}
            element={activeElement}
            elementIx={displayedElementIx}
            setStudentResponse={setStudentResponse}
            stackStorage={stackStorage}
            studentResponse={studentResponse}
          />
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {elementCount > 1 && displayedElementIx > 0 ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => setActiveElementIx((ix) => Math.max(0, ix - 1))}
            type="button"
          >
            <ChevronLeftIcon className="size-4" />
            Back
          </button>
        ) : null}

        {elementCount > 1 && displayedElementIx < elementCount - 1 ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || !canMoveForward}
            onClick={() =>
              setActiveElementIx((ix) => Math.min(elementCount - 1, ix + 1))
            }
            type="button"
          >
            Next
            <ChevronRightIcon className="size-4" />
          </button>
        ) : (
          <button
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || isSubmitted || !allResponsesValid}
            onClick={handleSubmit}
            type="button"
          >
            {isSubmitting ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <CheckCircle2Icon className="size-4" />
            )}
            Submit
          </button>
        )}
      </div>
    </div>
  )
}
