import { ElementDisplayMode, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { FormikSelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface DisplayModeSettingProps {
  type: ElementType
}

function DisplayModeSetting({ type }: DisplayModeSettingProps) {
  const t = useTranslations()

  return [ElementType.Sc, ElementType.Mc].includes(type) ? (
    <FormikSelectField
      contentPosition="popper"
      name="options.displayMode"
      items={Object.values(ElementDisplayMode).map((mode) => ({
        value: mode,
        label: t(`manage.questionForms.${mode}Display`),
        data: {
          cy: `select-display-mode-${t(`manage.questionForms.${mode}Display`)}`,
        },
      }))}
      data={{ cy: 'select-display-mode' }}
      className={{ select: { trigger: 'h-8 w-48' } }}
    />
  ) : null
}

export default DisplayModeSetting
