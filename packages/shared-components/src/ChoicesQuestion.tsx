import {
  ChoiceQuestionOptions,
  ElementType,
  InstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import MCKPRIMEvaluation from './evaluation/MCKPRIMEvaluation'
import PracticeQuizPoints from './evaluation/PracticeQuizPoints'
import QuestionExplanation from './evaluation/QuestionExplanation'
import SCEvaluation from './evaluation/SCEvaluation'
import KPAnswerOptions from './questions/KPAnswerOptions'
import MCAnswerOptions from './questions/MCAnswerOptions'
import SCAnswerOptions from './questions/SCAnswerOptions'
import {
  validateKprimResponse,
  validateMcResponse,
  validateScResponse,
} from './utils/validateResponse'

interface ChoicesQuestionProps {
  content: string
  type: ElementType.Sc | ElementType.Mc | ElementType.Kprim
  options: ChoiceQuestionOptions
  response?: Record<number, boolean>
  setResponse: (newValue: Record<number, boolean>, valid: boolean) => void
  existingResponse?: Record<number, boolean>
  elementIx: number
  evaluation?: InstanceEvaluation
}

function ChoicesQuestion({
  content,
  type,
  options,
  response,
  setResponse,
  existingResponse,
  elementIx,
  evaluation,
}: ChoicesQuestionProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1">
        {content !== '<br>' && (
          <div
            className={twMerge(
              'mt-4 mb-4 border-slate-300 flex-initial min-h-[6rem] bg-primary-10 border rounded leading-6 prose max-w-none prose-p:!m-0 prose-img:!m-0 p-4'
            )}
          >
            <Markdown content={content} />
          </div>
        )}

        {evaluation && evaluation.explanation && (
          <QuestionExplanation explanation={evaluation.explanation} />
        )}

        {type === ElementType.Kprim && (
          <KPAnswerOptions
            displayMode={options.displayMode}
            type={ElementType.Kprim}
            choices={options.choices}
            value={existingResponse ?? response}
            onChange={(newValue: Record<number, boolean>) => {
              const valid = validateKprimResponse(newValue)
              setResponse(newValue, valid)
            }}
            elementIx={elementIx}
            disabled={!!existingResponse}
          />
        )}

        {type === ElementType.Mc && (
          <MCAnswerOptions
            displayMode={options.displayMode}
            choices={options.choices}
            value={existingResponse ?? response}
            onChange={(newValue: Record<number, boolean>) => {
              const valid = validateMcResponse(newValue)
              setResponse(newValue, valid)
            }}
            elementIx={elementIx}
            disabled={!!existingResponse}
          />
        )}

        {type === ElementType.Sc && (
          <SCAnswerOptions
            displayMode={options.displayMode}
            choices={options.choices}
            value={existingResponse ?? response}
            onChange={(newValue: Record<number, boolean>) => {
              const valid = validateScResponse(newValue)
              setResponse(newValue, valid)
            }}
            elementIx={elementIx}
            disabled={!!existingResponse}
          />
        )}
      </div>

      {evaluation && (
        <div
          className="col-span-1 px-2 py-4 mr-2 border border-solid rounded-md md:w-64 lg:w-80 md:px-0 md:ml-2 md:mr-0 bg-slate-50"
          key={`evaluation-${elementIx}`}
        >
          <div className="flex flex-col gap-4 md:px-4">
            <div className="flex flex-row justify-between">
              <PracticeQuizPoints evaluation={evaluation} />
            </div>
            {type === ElementType.Sc && (
              <SCEvaluation evaluation={evaluation} />
            )}
            {(type === ElementType.Mc || type === ElementType.Kprim) && (
              <MCKPRIMEvaluation evaluation={evaluation} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ChoicesQuestion
