import { FormikSelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

function AnswerCollectionCatalogSelection({
  className,
}: {
  className?: string
}) {
  const t = useTranslations()

  return (
    <FormikSelectField
      name="catalogCollectionId"
      label={t('manage.resources.catalogCollection')}
      tooltip={t('manage.resources.catalogCollectionTooltip')}
      items={[
        {
          label: t('manage.resources.noCatalogCollectionSelected'),
          value: '',
          data: { cy: 'select-no-catalog-collection' },
        },
      ]}
      data={{ cy: 'answer-collection-catalog-collection' }}
      className={{
        select: { trigger: 'h-9 w-full', root: 'w-full' },
        root: twMerge('w-full', className),
      }}
    />
  )
}

export default AnswerCollectionCatalogSelection
