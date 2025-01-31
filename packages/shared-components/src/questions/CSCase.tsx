import type { CaseStudyElementOptions } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { FormLabel, NumberField } from '@uzh-bf/design-system'
import React from 'react'
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
  disabled,
  caseResponse,
  setCaseResponse,
}: {
  elementIx: number
  caseIndex: number
  currentCase: CaseStudyElementOptions['cases'][0]
  items: CaseStudyElementOptions['items']
  criteria: CaseStudyElementOptions['criteria']
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
            data-cy={`case-${caseIndex + 1}-title`}
          >
            {`${caseIndex + 1}. ${currentCase.title}`}
          </div>
          <div
            className={twMerge(
              'bg-primary-10 prose prose-p:!m-0 prose-img:!m-0 mb-4 min-h-[6rem] max-w-none flex-initial rounded border border-slate-300 p-4 leading-6'
            )}
          >
            <Markdown
              content={currentCase.description}
              data={{ cy: `case-${caseIndex + 1}-description` }}
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
            {criteria.map((criterion, criterionIx) => (
              <div key={`student-element-cs-criterion-${criterion.id}`}>
                <div className="-mb-2 flex flex-row items-center justify-between">
                  <FormLabel
                    required
                    label={criterion.name}
                    labelType="small"
                    className={{ label: 'font-normal' }}
                  />
                  {/* only show compact version on smaller devices */}
                  <div
                    className="-mb-1 block md:hidden"
                    data-cy={`cs-slider-value-${elementIx + 1}-${caseIndex + 1}-${itemIx + 1}-${criterionIx + 1}`}
                  >
                    {criterion.unit
                      ? `${caseResponse[item.id]?.[criterion.id] ?? '-'} ${criterion.unit}`
                      : (caseResponse[item.id]?.[criterion.id] ?? '-')}
                  </div>
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
                  />
                  <NumberField
                    disabled
                    value={caseResponse[item.id]?.[criterion.id] ?? ''}
                    onChange={() => null}
                    unit={criterion.unit ?? undefined}
                    className={{
                      field: 'hidden w-40 md:block',
                      input: 'h-8',
                      unit: 'h-8 px-2',
                    }} // only show on larger devices
                    data={{
                      cy: `cs-slider-nr-value-${elementIx + 1}-${caseIndex + 1}-${itemIx + 1}-${criterionIx + 1}`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ))
      ) : (
        <Loader />
      )}
    </div>
  )
}

export default CSCase
