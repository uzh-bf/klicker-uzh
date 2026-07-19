import type { CaseStudyElementOptions } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import type { CaseStudySolutionsObject } from '@klicker-uzh/types'
import { FormLabel } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'
import Loader from '../Loader'
import type { CaseStudyStudentResponseType } from '../StudentElement'
import CSSlider from './CSSlider'

function CSCase({
  elementIx,
  caseIndex,
  currentCase,
  items,
  criteria,
  solutions,
  disabled,
  caseResponse,
  setCaseResponse,
}: {
  elementIx: number
  caseIndex: number
  currentCase: CaseStudyElementOptions['cases'][0]
  items: CaseStudyElementOptions['items']
  criteria: CaseStudyElementOptions['criteria']
  solutions?: CaseStudySolutionsObject['']
  disabled: boolean
  caseResponse?: CaseStudyStudentResponseType['']
  setCaseResponse: (newValue: CaseStudyStudentResponseType['']) => void
}) {
  return (
    <div className="mt-6">
      {currentCase.description !== '<br>' && (
        <div>
          <div
            className="mb-1 text-lg font-bold"
            data-cy={`case-${caseIndex}-title`}
          >
            {`${caseIndex + 1}. ${currentCase.title}`}
          </div>
          <div
            className={twMerge(
              'prose prose-p:m-0! prose-img:m-0! mb-4 min-h-24 max-w-none flex-initial rounded border border-slate-300 p-4 leading-6'
            )}
          >
            <Markdown
              content={currentCase.description}
              data={{ cy: `case-${caseIndex}-description` }}
            />
          </div>
        </div>
      )}

      {typeof caseResponse !== 'undefined' ? (
        (items ?? []).map((item, itemIx) => (
          <div
            key={`student-element-cs-item-${item.id}`}
            className="mb-4 border-b border-slate-200 pb-4 last:border-b-0"
          >
            <div className="font-bold">{item.value}</div>
            <div className="flex flex-col gap-2">
              {criteria.map((criterion, criterionIx) => (
                <div key={`student-element-cs-criterion-${criterion.id}`}>
                  <div className="-mb-2 flex flex-row items-center justify-between">
                    <FormLabel
                      required
                      label={criterion.name}
                      labelType="small"
                      className={{ label: 'mb-1' }}
                    />
                    {!criterion.labels ? (
                      <div
                        className="-mb-1"
                        data-cy={`cs-slider-nr-value-${elementIx}-${caseIndex}-${itemIx}-${criterionIx}`}
                      >
                        {criterion.unit
                          ? `${caseResponse[item.id]?.[criterion.id] ?? '-'} ${criterion.unit}`
                          : (caseResponse[item.id]?.[criterion.id] ?? '-')}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-5 md:flex-row md:items-center">
                    <CSSlider
                      elementIx={elementIx}
                      caseIndex={caseIndex}
                      itemIx={itemIx}
                      criterionIx={criterionIx}
                      disabled={disabled}
                      value={caseResponse[item.id]?.[criterion.id]}
                      onChange={(newValue) => {
                        setCaseResponse({
                          ...caseResponse,
                          [item.id]: {
                            ...caseResponse[item.id],
                            [criterion.id]: newValue,
                          },
                        })
                      }}
                      defaultValue={
                        criterion.min + (criterion.max - criterion.min) / 2
                      }
                      min={criterion.min}
                      max={criterion.max}
                      step={criterion.step}
                      labels={{
                        min: criterion.labels?.min ?? criterion.min.toString(),
                        mid: criterion.labels?.mid ?? undefined,
                        max: criterion.labels?.max ?? criterion.max.toString(),
                      }}
                      solution={solutions?.[item.id]?.[criterion.id]}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <Loader />
      )}
    </div>
  )
}

export default CSCase
