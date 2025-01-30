import type { CaseStudyElementOptions } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import CSCase from './questions/CSCase'
import type { CaseStudyStudentResponseType } from './StudentElement'
import { validateCaseStudyResponse } from './utils/validateResponse'

interface CaseStudyQuestionProps {
  sequential: boolean
  content: string
  options: CaseStudyElementOptions
  response: CaseStudyStudentResponseType
  setResponse: (newValue: CaseStudyStudentResponseType, valid: boolean) => void
  existingResponse?: CaseStudyStudentResponseType
  elementIx: number
  // evaluation?: SelectionInstanceEvaluation
  disabled?: boolean
  // preview: boolean
}

function CaseStudyQuestion({
  sequential,
  content,
  options,
  response,
  setResponse,
  existingResponse,
  elementIx,
  // evaluation,
  disabled = false,
  // preview,
}: CaseStudyQuestionProps) {
  const t = useTranslations()
  const [caseIndex, setCaseIndex] = useState(0)
  const currentSingleCaseId = options.cases[caseIndex]!.id

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1">
        {content !== '<br>' && (
          <div>
            <div className="mb-1 text-xl font-bold">
              {t('shared.questions.csCaseStudyInstructions')}
            </div>
            <Markdown content={content} />
          </div>
        )}

        {/* // TODO: once evaluation is available */}
        {/* {evaluation && evaluation.explanation && (
          <QuestionExplanation explanation={evaluation.explanation} />
        )} */}

        {sequential ? (
          <div>
            <CSCase
              elementIx={elementIx}
              caseIndex={caseIndex}
              currentCase={options.cases[caseIndex]!}
              items={options.items}
              criteria={options.criteria}
              disabled={disabled}
              caseResponse={
                existingResponse?.[currentSingleCaseId] ??
                response?.[currentSingleCaseId]
              }
              setCaseResponse={(newValue: CaseStudyStudentResponseType['']) => {
                // TODO: potentially additionally validate the validity of the single step to enable / disable navigation between cases
                const valid = validateCaseStudyResponse({
                  response: {
                    ...response,
                    [currentSingleCaseId]: newValue,
                  },
                })
                setResponse(
                  {
                    ...response,
                    [currentSingleCaseId]: newValue,
                  },
                  valid
                )
              }}
            />
            {/* // TODO: add navigation logic to jump between cases */}
          </div>
        ) : (
          options.cases.map((currentCase, index) => (
            <div key={`case-${index}`}>
              <CSCase
                elementIx={elementIx}
                caseIndex={index}
                currentCase={currentCase}
                items={options.items}
                criteria={options.criteria}
                disabled={disabled}
                caseResponse={
                  existingResponse?.[currentCase.id] ??
                  response?.[currentCase.id]
                }
                setCaseResponse={(
                  newValue: CaseStudyStudentResponseType['']
                ) => {
                  const valid = validateCaseStudyResponse({
                    response: {
                      ...response,
                      [currentCase.id]: newValue,
                    },
                  })

                  setResponse(
                    {
                      ...response,
                      [currentCase.id]: newValue,
                    },
                    valid
                  )
                }}
              />
            </div>
          ))
        )}
      </div>

      {/* {evaluation && evaluation.answerSolutionIds && (
        <div
          className="col-span-1 mr-2 rounded-md border border-solid bg-slate-50 px-2 py-4 md:ml-2 md:mr-0 md:w-64 md:px-0 lg:w-80"
          key={`evaluation-${elementIx}`}
        >
          <div className="flex flex-col gap-4 md:px-4">
            <div className="flex flex-row justify-between">
              <PracticeQuizPoints evaluation={evaluation} />
            </div>
            <CSEValuation evaluation={evaluation} options={options} />
          </div>
        </div>
      )} */}
    </div>
  )
}

export default CaseStudyQuestion
