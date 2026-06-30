import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import { CaseStudyElementResultCaseInfo } from '@lib/evaluationTypes'
import { Checkbox, H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import { TextSizeType } from '../textSizes'

function CSCaseSelection({
  cases,
  selectedCases,
  setSelectedCases,
  textSize,
  disabled = false,
}: {
  cases: CaseStudyElementResultCaseInfo[]
  selectedCases: string[]
  setSelectedCases: Dispatch<SetStateAction<string[]>>
  textSize: TextSizeType
  disabled?: boolean
}) {
  const t = useTranslations()

  return (
    <div>
      <H3 className={{ root: textSize.textLg }}>{t('shared.generic.cases')}</H3>
      <div className="flex flex-col gap-1.5">
        {cases.map((caseItem, caseIx) => (
          <div
            key={`settings-select-case-${caseItem.id}`}
            className="flex flex-row gap-2"
          >
            <Checkbox
              checked={selectedCases.includes(caseItem.id)}
              onCheck={() =>
                setSelectedCases((prev) =>
                  prev.includes(caseItem.id)
                    ? prev.filter((id) => id !== caseItem.id)
                    : [...prev, caseItem.id]
                )
              }
              style={{
                root: {
                  backgroundColor: selectedCases.includes(caseItem.id)
                    ? selectedCases.length > 1
                      ? CHART_COLORS[caseIx % 12]
                      : 'gray'
                    : '',
                },
              }}
              disabled={disabled || cases.length === 1}
              className={{
                root: twMerge(
                  'text-white',
                  (disabled || cases.length === 1) && 'bg-gray-200'
                ),
              }}
            />
            <div>{`${caseIx + 1}. ${caseItem.name}`}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CSCaseSelection
