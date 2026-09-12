import {
  faArrowLeft,
  faArrowRight,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type {
  CaseStudyElementOptions,
  CaseStudyInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CSEvaluation from './evaluation/CSEvaluation'
import PracticeQuizPoints from './evaluation/PracticeQuizPoints'
import QuestionExplanation from './evaluation/QuestionExplanation'
import useCaseStudySolutionsObject from './hooks/useCaseStudySolutionsObject'
import CSCase from './questions/CSCase'
import type { CaseStudyStudentResponseType } from './StudentElement'
import { validateCaseStudyResponse } from './utils/validateResponse'

interface CaseStudyQuestionProps {
  preview?: boolean
  sequential: boolean
  content: string
  options: CaseStudyElementOptions
  response: CaseStudyStudentResponseType
  setResponse: (newValue: CaseStudyStudentResponseType, valid: boolean) => void
  existingResponse?: CaseStudyStudentResponseType
  elementIx: number
  evaluation?: CaseStudyInstanceEvaluation
  noPoints: boolean
  disabled?: boolean
}

function CaseStudyQuestion({
  preview = false,
  sequential,
  content,
  options,
  response,
  setResponse,
  existingResponse,
  elementIx,
  evaluation,
  noPoints,
  disabled = false,
}: CaseStudyQuestionProps) {
  const t = useTranslations()
  const [caseIndex, setCaseIndex] = useState(0)
  const [caseValidity, setCaseValidity] = useState<boolean[]>([])
  const currentSingleCaseId = options.cases[caseIndex]?.id

  // convert case study solutions to object for efficient access
  const solutions = useCaseStudySolutionsObject({ evaluation })

  // initialize the case validity array based on the existing response
  useEffect(() => {
    if (!response) return

    setCaseValidity(
      options.cases.map((currentCase) => {
        const currentResponse = response[currentCase.id]

        if (!currentResponse) return false

        return validateCaseStudyResponse({
          response: { [currentCase.id]: currentResponse },
        })
      })
    )
  }, [options.cases, response])

  return (
    <div className="flex flex-col gap-4 text-base md:flex-row">
      <div className="flex-1">
        {content !== '<br>' && (
          <div className={twMerge(!!evaluation && 'mb-3')}>
            <div className="mb-1 mt-3 flex flex-row items-center justify-between">
              <div className="text-lg font-bold">
                {t('shared.generic.instructions')}
              </div>
              {noPoints ? (
                <div className="bg-primary-100 flex h-max flex-row items-center gap-1.5 rounded px-1.5 text-sm text-white">
                  <FontAwesomeIcon icon={faInfoCircle} />
                  {t('shared.generic.noPoints')}
                </div>
              ) : null}
            </div>
            <Markdown
              withProse
              content={content}
              data={{ cy: `instance-question-content` }}
              className={{ root: 'text-base' }}
            />
          </div>
        )}

        {evaluation && evaluation.explanation && (
          <QuestionExplanation explanation={evaluation.explanation} />
        )}

        {sequential && options.cases.length > 1 ? (
          <div>
            <div className="-mb-2 mt-4 flex w-full flex-row flex-wrap gap-4">
              {options.cases.map((_, index) => {
                return (
                  <div
                    onClick={() => setCaseIndex(index)}
                    className={twMerge(
                      'bg-uzh-grey-60 rounded-full px-2.5 py-0.5 text-sm font-bold hover:cursor-pointer',
                      caseIndex === index && 'bg-uzh-blue-80 text-white',
                      caseValidity[index] && 'bg-green-700 text-white'
                    )}
                    key={`case-breadcrumb-${index}`}
                  >
                    {caseValidity[index] ? (
                      <span className="mr-1">✓</span>
                    ) : null}
                    <span>{`${t('shared.generic.case')} ${index + 1}`}</span>
                  </div>
                )
              })}
            </div>
            <CSCase
              elementIx={elementIx}
              caseIndex={caseIndex}
              currentCase={options.cases[caseIndex]!}
              items={options.items}
              criteria={options.criteria}
              disabled={disabled || !!existingResponse}
              caseResponse={
                currentSingleCaseId
                  ? (existingResponse?.[currentSingleCaseId] ??
                    response?.[currentSingleCaseId])
                  : {}
              }
              setCaseResponse={(newValue: CaseStudyStudentResponseType['']) => {
                if (!currentSingleCaseId) return

                // validate student response to entire case study
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

                // validate student response to current case
                const caseValid = validateCaseStudyResponse({
                  response: {
                    [currentSingleCaseId]: newValue,
                  },
                })
                setCaseValidity((prev) => {
                  const newValidity = [...prev]
                  newValidity[caseIndex] = caseValid
                  return newValidity
                })
              }}
            />
            <div className="flex flex-row justify-between">
              <Button
                onClick={() => setCaseIndex((prev) => Math.max(0, prev - 1))}
                disabled={caseIndex === 0}
                className={{
                  root: 'border-uzh-blue-80 h-8 border-2',
                }}
                data={{ cy: 'switch-previous-case' }}
              >
                <Button.Icon icon={faArrowLeft} />
                <Button.Label>{t('pwa.liveQuiz.previousCase')}</Button.Label>
              </Button>
              <Button
                onClick={() =>
                  setCaseIndex((prev) =>
                    Math.min(options.cases.length - 1, prev + 1)
                  )
                }
                disabled={caseIndex === options.cases.length - 1}
                className={{
                  root: 'border-uzh-blue-80 h-8 gap-2 border-2',
                }}
                data={{ cy: 'switch-next-case' }}
              >
                <Button.Label>{t('pwa.liveQuiz.nextCase')}</Button.Label>
                <Button.Icon withoutLabel icon={faArrowRight} />
              </Button>
            </div>
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
                solutions={solutions?.[currentCase.id]}
                disabled={disabled || !!existingResponse}
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

      {evaluation && evaluation.studySolutions && solutions && !preview ? (
        <div
          className="col-span-1 mr-2 rounded-md border border-solid bg-slate-50 px-2 py-4 md:ml-2 md:mr-0 md:w-64 md:px-0 lg:w-80"
          key={`evaluation-${elementIx}`}
        >
          <div className="flex flex-col gap-4 md:px-4">
            <div className="flex flex-row justify-between">
              <PracticeQuizPoints evaluation={evaluation} />
            </div>
            <CSEvaluation
              evaluation={evaluation}
              options={options}
              solutions={solutions}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default CaseStudyQuestion
