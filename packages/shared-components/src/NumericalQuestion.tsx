import type {
  NumericalElementOptions,
  NumericalInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import NREvaluation from './evaluation/NREvaluation'
import PracticeQuizPoints from './evaluation/PracticeQuizPoints'
import QuestionExplanation from './evaluation/QuestionExplanation'
import QuestionContent from './QuestionContent'
import NUMERICALAnswerOptions from './questions/NUMERICALAnswerOptions'
import { validateNumericalResponse } from './utils/validateResponse'

interface NumericalQuestionProps {
  preview?: boolean
  content: string
  options: NumericalElementOptions
  response?: string
  valid: boolean
  setResponse: (newValue: string, valid: boolean) => void
  existingResponse?: string
  elementIx: number
  evaluation?: NumericalInstanceEvaluation
  noPoints: boolean
  disabled?: boolean
}

function NumericalQuestion({
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
}: NumericalQuestionProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1">
        <QuestionContent content={content} noPoints={noPoints} />

        {evaluation && evaluation.explanation && (
          <QuestionExplanation explanation={evaluation.explanation} />
        )}

        <NUMERICALAnswerOptions
          value={
            existingResponse
              ? String(existingResponse)
              : response
                ? String(response)
                : undefined
          }
          onChange={(newValue) => {
            const valid = validateNumericalResponse({
              response: newValue,
              options,
            })
            setResponse(newValue, valid)
          }}
          valid={existingResponse ? !!existingResponse : valid}
          accuracy={options.accuracy ?? undefined}
          placeholder={options.placeholder ?? undefined}
          unit={options.unit ?? undefined}
          min={options.restrictions?.min ?? undefined}
          max={options.restrictions?.max ?? undefined}
          disabled={disabled || !!existingResponse}
          elementIx={elementIx}
        />
      </div>

      {evaluation && !preview ? (
        <div
          className="col-span-1 mr-2 rounded-md border border-solid bg-slate-50 px-2 py-4 md:ml-2 md:mr-0 md:w-64 md:px-0 lg:w-80"
          key={`evaluation-${elementIx}`}
        >
          <div className="flex flex-col gap-4 md:px-4">
            <div className="flex flex-row justify-between">
              <PracticeQuizPoints evaluation={evaluation} />
            </div>
            <NREvaluation
              options={{
                ...options,
                solutionRanges: evaluation.solutionRanges,
                exactSolutions: evaluation.exactSolutions,
              }}
              evaluation={evaluation}
              reference={existingResponse}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default NumericalQuestion
