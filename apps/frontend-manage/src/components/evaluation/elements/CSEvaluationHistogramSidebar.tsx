import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterionInfo,
  CaseStudyElementResultItemInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import {
  Checkbox,
  H3,
  SelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import { TextSizeType } from '../textSizes'
import CSCaseSelection from './CSCaseSelection'

function CSEvaluationHistogramSidebar({
  cases,
  items,
  criteria,
  selectedCases,
  setSelectedCases,
  selectedItems,
  setSelectedItems,
  selectedCriterion,
  setSelectedCriterion,
  textSize,
}: {
  cases: CaseStudyElementResultCaseInfo[]
  items: CaseStudyElementResultItemInfo[]
  criteria: CaseStudyElementResultCriterionInfo[]
  selectedCases: string[]
  setSelectedCases: Dispatch<SetStateAction<string[]>>
  selectedItems: string[]
  setSelectedItems: Dispatch<SetStateAction<string[]>>
  selectedCriterion: string
  setSelectedCriterion: Dispatch<SetStateAction<string>>
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
        disabled={selectedItems.length > 1}
      />
      <div>
        <H3 className={{ root: textSize.textLg }}>
          {t('shared.generic.caseStudyItems')}
        </H3>
        <div className="flex flex-col gap-1.5">
          {items.map((item, itemIx) => (
            <div
              key={`settings-select-items-${item.id}`}
              className="flex flex-row gap-2"
            >
              <Checkbox
                checked={selectedItems.includes(String(item.id))}
                onCheck={() =>
                  setSelectedItems((prev) =>
                    prev.includes(String(item.id))
                      ? prev.filter((id) => id !== String(item.id))
                      : [...prev, String(item.id)]
                  )
                }
                style={{
                  root: {
                    backgroundColor: selectedItems.includes(String(item.id))
                      ? selectedItems.length > 1
                        ? CHART_COLORS[itemIx % 12]
                        : 'gray'
                      : '',
                  },
                }}
                disabled={items.length === 1 || selectedCases.length > 1}
                className={{
                  root: twMerge(
                    'text-white',
                    (selectedCases.length > 1 || items.length === 1) &&
                      'bg-gray-200'
                  ),
                }}
              />
              <div>{`${itemIx + 1}. ${item.name}`}</div>
            </div>
          ))}
        </div>
      </div>
      <SelectField
        label={t('shared.generic.criterion')}
        items={criteria.map((criterion) => ({
          value: criterion.id,
          label: criterion.name,
        }))}
        value={selectedCriterion}
        onChange={(newValue) => setSelectedCriterion(newValue)}
        className={{
          label: 'mt-0',
          root: 'w-full',
          select: { root: 'w-full', trigger: 'w-full' },
        }}
        disabled={criteria.length === 1}
      />
      <UserNotification
        message={t('manage.evaluation.caseStudyHistogramSelection')}
      />
    </div>
  )
}

export default CSEvaluationHistogramSidebar
