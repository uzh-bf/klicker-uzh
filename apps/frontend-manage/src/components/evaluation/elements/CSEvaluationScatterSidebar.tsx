import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons'
import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterionInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import { TextSizeType } from '../textSizes'
import CSCaseSelection from './CSCaseSelection'
import { AggregationType } from './CSEvaluationScatter'

function CSEvaluationScatterSidebar({
  cases,
  criteria,
  selectedCases,
  setSelectedCases,
  xCriterion,
  setXCriterion,
  yCriterion,
  setYCriterion,
  aggregationType,
  setAggregationType,
  textSize,
}: {
  cases: CaseStudyElementResultCaseInfo[]
  criteria: CaseStudyElementResultCriterionInfo[]
  selectedCases: string[]
  setSelectedCases: Dispatch<SetStateAction<string[]>>
  xCriterion: string | null
  setXCriterion: Dispatch<SetStateAction<string | null>>
  yCriterion: string | null
  setYCriterion: Dispatch<SetStateAction<string | null>>
  aggregationType: AggregationType
  setAggregationType: Dispatch<SetStateAction<AggregationType>>
  textSize: TextSizeType
}) {
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-6 px-4 py-2">
      <CSCaseSelection
        cases={cases}
        selectedCases={selectedCases}
        setSelectedCases={setSelectedCases}
        textSize={textSize}
      />
      <div className="flex flex-col">
        <H3 className={{ root: twMerge('mb-0', textSize.textLg) }}>
          {t('shared.generic.settings')}
        </H3>
        <div className="flex w-full flex-row">
          <div className="w-full">
            <SelectField
              required
              label={t('manage.evaluation.criterionXAxis')}
              items={criteria.map((criterion) => ({
                value: String(criterion.id),
                label: criterion.name,
                disabled: criterion.id === yCriterion,
              }))}
              value={xCriterion ?? undefined}
              onChange={(value) => setXCriterion(value)}
              disabled={criteria.length === 1}
              className={{
                label: 'mt-0',
                root: 'w-full',
                select: { root: 'w-full', trigger: 'w-full' },
              }}
            />
            {criteria.length > 1 ? (
              <SelectField
                required
                label={t('manage.evaluation.criterionYAxis')}
                items={criteria.map((criterion) => ({
                  value: String(criterion.id),
                  label: criterion.name,
                  disabled: criterion.id === xCriterion,
                }))}
                value={yCriterion ?? undefined}
                onChange={(value) => setYCriterion(value)}
                className={{
                  label: 'mt-0',
                  root: 'w-full',
                  select: { root: 'w-full', trigger: 'w-full' },
                }}
              />
            ) : null}
          </div>
          {criteria.length > 1 ? (
            <Button
              basic
              className={{
                root: 'ml-1 mt-5 rotate-90 self-center rounded-full p-1',
              }}
              onClick={() => {
                if (!xCriterion || !yCriterion) return
                const temp = xCriterion
                setXCriterion(yCriterion)
                setYCriterion(temp)
              }}
            >
              <Button.Icon withoutLabel icon={faArrowRightArrowLeft} />
            </Button>
          ) : null}
        </div>
        <SelectField
          required
          label={t('manage.evaluation.aggregation')}
          items={[
            {
              value: AggregationType.MEAN,
              label: t('shared.generic.mean'),
            },
            {
              value: AggregationType.MEDIAN,
              label: t('shared.generic.median'),
            },
          ]}
          value={aggregationType}
          onChange={(value) => setAggregationType(value as AggregationType)}
          className={{
            root: 'mt-3 w-full',
            select: { root: 'w-full', trigger: 'w-full' },
          }}
        />
      </div>
    </div>
  )
}

export default CSEvaluationScatterSidebar
