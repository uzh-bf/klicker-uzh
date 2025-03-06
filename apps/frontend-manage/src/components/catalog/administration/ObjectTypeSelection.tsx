import { CatalogObjectType, ObjectAccess } from '@klicker-uzh/graphql/dist/ops'
import { FormikSelectField, UserNotification } from '@uzh-bf/design-system'
import { FormikErrors } from 'formik'
import { useTranslations } from 'next-intl'
import { CatalogObjectAdditionFormValues } from './AddObjectToCatalogModal'
import ObjectAccessSelection from './ObjectAccessSelection'

function ObjectTypeSelection({
  accessValue,
  setFieldValue,
}: {
  accessValue: ObjectAccess
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<CatalogObjectAdditionFormValues>>
}) {
  const t = useTranslations()

  return (
    <div>
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-1/2">
          <FormikSelectField
            required
            name="objectType"
            label={t('manage.catalog.objectType')}
            tooltip={t('manage.catalog.objectTypeTooltip')}
            placeholder={t('manage.catalog.selectObjectType')}
            items={Object.values(CatalogObjectType)
              .filter((type) => type !== CatalogObjectType.CatalogCollection)
              .map((objectType) => ({
                value: objectType,
                label: t(`shared.types.${objectType}`),
                data: { cy: `object-type-${objectType}` },
              }))}
            data={{ cy: 'object-type-selection' }}
            className={{ select: { trigger: 'h-9' } }}
          />
        </div>
        <div className="w-full md:w-1/2">
          <ObjectAccessSelection
            value={accessValue}
            onChange={(value) => setFieldValue('access', value)}
            cyPrefix="modal"
          />
        </div>
      </div>
      <UserNotification
        message={t(`manage.catalog.infoAccess${accessValue}`)}
        className={{ root: 'mt-3' }}
      />
    </div>
  )
}

export default ObjectTypeSelection
