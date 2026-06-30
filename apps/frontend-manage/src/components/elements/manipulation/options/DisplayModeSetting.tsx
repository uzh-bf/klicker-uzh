import { FormikSelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  ElementDisplayMode,
  ElementType,
} from '../../../../lib/constants/elementTypes'

function DisplayModeSetting({
  type,
  disabled,
}: {
  type: ElementType
  disabled: boolean
}) {
  const t = useTranslations()

  return type === ElementType.Sc || type === ElementType.Mc ? (
    <FormikSelectField
      disabled={disabled}
      contentPosition="popper"
      name="options.displayMode"
      items={Object.values(ElementDisplayMode).map((mode) => ({
        value: mode,
        label: t(`manage.elements.${mode}Display`),
        data: {
          cy: `select-display-mode-${t(`manage.elements.${mode}Display`)}`,
        },
      }))}
      data={{ cy: 'select-display-mode' }}
      className={{ select: { trigger: 'h-8 w-48' } }}
    />
  ) : null
}

export default DisplayModeSetting
