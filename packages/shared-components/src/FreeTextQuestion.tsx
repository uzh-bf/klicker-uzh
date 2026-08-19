import type {
  FreeTextElementOptions,
  FreeTextInstanceEvaluation,
  FreeTextPracticeStateDataFragment,
} from '@klicker-uzh/graphql/dist/ops'
import { twMerge } from 'tailwind-merge'
import FTEvaluation from './evaluation/FTEvaluation'
import PracticeQuizPoints from './evaluation/PracticeQuizPoints'
import QuestionExplanation from './evaluation/QuestionExplanation'
import QuestionContent from './QuestionContent'
import FREETextAnswerOptions from './questions/FREETextAnswerOptions'
import { validateFreeTextResponse } from './utils/validateResponse'

interface FreeTextQuestionProps {
  preview?: boolean
  content: string
  options: FreeTextElementOptions
  response?: string
  valid: boolean
  setResponse: (newValue: string, valid: boolean) => void
  existingResponse?: string
  elementIx: number
  evaluation?: FreeTextInstanceEvaluation
  semanticState?: FreeTextPracticeStateDataFragment | null
  semanticInputEditable?: boolean
  showSemanticDetails?: boolean
  noPoints: boolean
  disabled?: boolean
  compact?: boolean
}

function FreeTextQuestion({
  preview = false,
  content,
  options,
  response,
  setResponse,
  existingResponse,
  elementIx,
  evaluation,
  semanticState,
  semanticInputEditable = false,
  showSemanticDetails = false,
  noPoints,
  disabled,
  compact = false,
}: FreeTextQuestionProps) {
  const semanticAnswer = semanticState?.currentAttempt?.answer
  const displayedResponse = semanticInputEditable
    ? (response ?? semanticAnswer ?? '')
    : (semanticAnswer ?? existingResponse ?? response ?? '')
  const showLegacyEvaluation =
    !!evaluation?.solutions && evaluation.solutions.length > 0 && !preview
  const showSemanticEvaluation =
    !!semanticState?.solutionAuthorized && showSemanticDetails && !preview

  return (
    <div className={twMerge('flex flex-col gap-4', !compact && 'md:flex-row')}>
      <div className="flex-1">
        <QuestionContent content={content} noPoints={noPoints} />

        {semanticState
          ? showSemanticDetails &&
            semanticState.explanation && (
              <QuestionExplanation explanation={semanticState.explanation} />
            )
          : evaluation?.explanation && (
              <QuestionExplanation explanation={evaluation.explanation} />
            )}

        <FREETextAnswerOptions
          value={displayedResponse}
          onChange={(newValue) => {
            const valid = validateFreeTextResponse({
              response: newValue,
              options,
            })
            setResponse(newValue, valid)
          }}
          maxLength={options.restrictions?.maxLength ?? undefined}
          disabled={disabled || (!!existingResponse && !semanticInputEditable)}
          elementIx={elementIx}
        />
      </div>

      {showLegacyEvaluation || showSemanticEvaluation ? (
        <div
          className={twMerge(
            'col-span-1 mr-2 rounded-md border border-solid bg-slate-50 px-2 py-4',
            !compact && 'md:ml-2 md:mr-0 md:w-64 md:px-0 lg:w-80'
          )}
          key={`evaluation-${elementIx}`}
        >
          <div className="flex flex-col gap-4 md:px-4">
            {showLegacyEvaluation && evaluation && (
              <div className="flex flex-row justify-between">
                <PracticeQuizPoints
                  evaluation={{
                    ...evaluation,
                    xpAwarded:
                      evaluation.solutions?.length === 0
                        ? null
                        : evaluation.xpAwarded,
                  }}
                />
              </div>
            )}
            <FTEvaluation
              options={{
                ...options,
                solutions: evaluation?.solutions,
              }}
              evaluation={evaluation}
              semanticState={semanticState}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default FreeTextQuestion
