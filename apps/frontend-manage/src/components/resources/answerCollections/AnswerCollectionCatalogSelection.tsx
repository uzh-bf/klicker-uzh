import { faWarning } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FormikSelectField, Tooltip } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

function AnswerCollectionCatalogSelection({
  className,
}: {
  className?: string
}) {
  const t = useTranslations()
  const [field] = useField('catalogCollectionId')

  return (
    <div className="flex flex-row items-start gap-3">
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
      {field.value === '' && (
        <Tooltip
          tooltip={t('manage.catalog.noCatalogCollectionSelectedWarning')}
          className={{ trigger: 'mt-9', tooltip: 'max-w-[30rem] text-sm' }}
        >
          <FontAwesomeIcon icon={faWarning} className="text-orange-500" />
        </Tooltip>
      )}
    </div>
  )
}

export default AnswerCollectionCatalogSelection
