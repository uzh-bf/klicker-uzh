import { CatalogObjectType, ObjectAccess } from '@klicker-uzh/graphql/dist/ops'
import { FormikSelectField, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ObjectAccessSelection from './ObjectAccessSelection'

function ObjectTypeSelection({ accessValue }: { accessValue: ObjectAccess }) {
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
            items={Object.values(CatalogObjectType).map((objectType) => ({
              value: objectType,
              label: t(`shared.types.${objectType}`),
              data: { cy: `object-type-${objectType}` },
            }))}
            data={{ cy: 'object-type-selection' }}
            className={{ select: { trigger: 'h-9' } }}
          />
        </div>
        <div className="w-full md:w-1/2">
          <ObjectAccessSelection />
        </div>
      </div>
      <UserNotification
        message={t(`manage.resources.infoAccess${accessValue}`)}
        className={{ root: 'mt-3' }}
      />
    </div>
  )
}

export default ObjectTypeSelection
