import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function ElementTypeFilter({
  elementType,
  setElementType,
}: {
  elementType: ElementType | 'all'
  setElementType: Dispatch<SetStateAction<ElementType | 'all'>>
}) {
  const t = useTranslations()

  return (
    <SelectField
      label={t('manage.analytics.elementType')}
      items={[
        { value: 'all', label: t('manage.analytics.allElementTypes') },
        ...Object.values(ElementType).map((value) => ({
          value,
          label: t(`shared.${value}.typeLabel`),
        })),
      ]}
      value={elementType}
      onChange={(value) => setElementType(value as ElementType | 'all')}
      className={{ select: { root: 'w-52', trigger: 'h-8' } }}
    />
  )
}

export default ElementTypeFilter
