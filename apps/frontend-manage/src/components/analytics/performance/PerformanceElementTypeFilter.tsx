import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Label, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function PerformanceElementTypeFilter({
  elementType,
  setElementType,
}: {
  elementType: ElementType | 'all'
  setElementType: Dispatch<SetStateAction<ElementType | 'all'>>
}) {
  const t = useTranslations()

  return (
    <div className="flex flex-row items-center gap-3">
      <Label
        label={t('manage.analytics.elementType')}
        className={{ root: 'font-bold' }}
      />
      <Select
        items={[
          { value: 'all', label: t('manage.analytics.allElementTypes') },
          ...Object.values(ElementType).map((value) => ({
            value,
            label: t(`shared.${value}.typeLabel`),
          })),
        ]}
        value={elementType}
        onChange={(value) => setElementType(value as ElementType | 'all')}
        className={{ root: 'w-52' }}
      />
    </div>
  )
}

export default PerformanceElementTypeFilter
