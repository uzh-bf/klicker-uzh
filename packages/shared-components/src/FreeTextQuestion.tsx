import type {
  FreeTextElementOptions,
  FreeTextInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
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
  noPoints: boolean
  disabled?: boolean
}

function FreeTextQuestion({
  preview = false,
  content,
  options,
  response,
  valid,
  setResponse,
  existingResponse,
  elementIx,
  evaluation,
  noPoints,
  disabled,
}: FreeTextQuestionProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1">
        <QuestionContent content={content} noPoints={noPoints} />

        {evaluation && evaluation.explanation && (
          <QuestionExplanation explanation={evaluation.explanation} />
        )}

        <FREETextAnswerOptions
          value={existingResponse ?? response ?? ''}
          onChange={(newValue) => {
            const valid = validateFreeTextResponse({
              response: newValue,
              options,
            })
            setResponse(newValue, valid)
          }}
          maxLength={options.restrictions?.maxLength ?? undefined}
          disabled={disabled || !!existingResponse}
          elementIx={elementIx}
        />
      </div>

      {evaluation && evaluation.solutions && !preview ? (
        <div
          className="col-span-1 mr-2 rounded-md border border-solid bg-slate-50 px-2 py-4 md:ml-2 md:mr-0 md:w-64 md:px-0 lg:w-80"
          key={`evaluation-${elementIx}`}
        >
          <div className="flex flex-col gap-4 md:px-4">
            <div className="flex flex-row justify-between">
              <PracticeQuizPoints
                evaluation={{
                  ...evaluation,
                  xpAwarded:
                    evaluation.solutions.length === 0
                      ? null
                      : evaluation.xpAwarded,
                }}
              />
            </div>
            <FTEvaluation
              options={{
                ...options,
                solutions: evaluation.solutions,
              }}
              evaluation={evaluation}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default FreeTextQuestion
