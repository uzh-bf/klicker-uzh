import { FormLabel } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementType } from '../../../../lib/constants/elementTypes'

interface OptionsLabelProps {
  type: ElementType
}

function OptionsLabel({ type }: OptionsLabelProps) {
  const t = useTranslations()
  const isChoiceElement =
    type === ElementType.Sc ||
    type === ElementType.Mc ||
    type === ElementType.Kprim
  const isFreeElement =
    type === ElementType.FreeText || type === ElementType.Numerical

  return (
    <>
      {isChoiceElement && (
        <div className="flex-1">
          <FormLabel
            required
            labelType="small"
            label={t('manage.elements.answerOptions')}
            tooltip={t('manage.elements.answerOptionsTooltip')}
          />
        </div>
      )}
      {isFreeElement && (
        <div className="flex-1">
          <FormLabel
            required
            label={t('shared.generic.options')}
            labelType="small"
            tooltip={
              type === ElementType.Numerical
                ? t('manage.elements.NUMERICALOptionsTooltip')
                : t('manage.elements.FTOptionsTooltip')
            }
            className={{ label: 'mb-1 text-black' }}
          />
        </div>
      )}
    </>
  )
}

export default OptionsLabel
