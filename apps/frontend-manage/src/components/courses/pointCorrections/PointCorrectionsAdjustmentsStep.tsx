import { Checkbox } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'

function PointCorrectionsAdjustmentsStep() {
  const t = useTranslations()
  const [baseAwardField, , baseAwardHelpers] = useField('adjustments.baseAward')
  const [baseDeductField, , baseDeductHelpers] = useField(
    'adjustments.baseDeduct'
  )
  const [correctnessAwardField, , correctnessAwardHelpers] = useField(
    'adjustments.correctnessAward'
  )
  const [correctnessDeductField, , correctnessDeductHelpers] = useField(
    'adjustments.correctnessDeduct'
  )
  const [bonusAwardField, , bonusAwardHelpers] = useField(
    'adjustments.bonusAward'
  )
  const [bonusDeductField, , bonusDeductHelpers] = useField(
    'adjustments.bonusDeduct'
  )

  const toggleExclusive = (
    currentValue: boolean,
    setCurrent: (val: boolean) => void,
    setCounterpart: (val: boolean) => void
  ) => {
    const newValue = !currentValue
    setCurrent(newValue)
    if (newValue) {
      setCounterpart(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-gray-700">
        {t.rich('manage.pointCorrections.adjustmentsDescription', {
          b: (children) => <b>{children}</b>,
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            id: 'base',
            awardField: baseAwardField,
            awardHelpers: baseAwardHelpers,
            deductField: baseDeductField,
            deductHelpers: baseDeductHelpers,
            label: t('manage.pointCorrections.adjustmentsBaseLabel'),
          },
          {
            id: 'correctness',
            awardField: correctnessAwardField,
            awardHelpers: correctnessAwardHelpers,
            deductField: correctnessDeductField,
            deductHelpers: correctnessDeductHelpers,
            label: t('manage.pointCorrections.adjustmentsCorrectnessLabel'),
          },
          {
            id: 'bonus',
            awardField: bonusAwardField,
            awardHelpers: bonusAwardHelpers,
            deductField: bonusDeductField,
            deductHelpers: bonusDeductHelpers,
            label: t('manage.pointCorrections.adjustmentsBonusLabel'),
          },
        ].map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-md border border-gray-200 p-3"
          >
            <div className="text-sm font-semibold text-gray-900">
              {item.label}
            </div>
            <div className="flex flex-col gap-2 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={Boolean(item.awardField.value)}
                  onCheck={() =>
                    toggleExclusive(
                      Boolean(item.awardField.value),
                      item.awardHelpers.setValue,
                      item.deductHelpers.setValue
                    )
                  }
                  data={{ cy: `point-corrections-${item.id}-award-checkbox` }}
                  label={t('manage.pointCorrections.adjustmentsAwardLabel')}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={Boolean(item.deductField.value)}
                  onCheck={() =>
                    toggleExclusive(
                      Boolean(item.deductField.value),
                      item.deductHelpers.setValue,
                      item.awardHelpers.setValue
                    )
                  }
                  data={{ cy: `point-corrections-${item.id}-deduct-checkbox` }}
                  label={t('manage.pointCorrections.adjustmentsDeductLabel')}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PointCorrectionsAdjustmentsStep
