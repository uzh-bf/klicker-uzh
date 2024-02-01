import {
  ChoiceQuestionOptions,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import React from 'react'
import { twMerge } from 'tailwind-merge'
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
}

function ChoicesQuestion({
  content,
  type,
  options,
  response,
  setResponse,
  existingResponse,
  elementIx,
}: ChoicesQuestionProps) {
  return (
    <div>
      {content !== '<br>' && (
        <div
          className={twMerge(
            'mt-4 mb-4 border-slate-300 flex-initial min-h-[6rem] bg-primary-10 border rounded leading-6 prose max-w-none prose-p:!m-0 prose-img:!m-0 p-4'
          )}
        >
          <Markdown content={content} />
        </div>
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
  )
}

export default ChoicesQuestion
