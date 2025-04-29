import { ObjectAccess, SharingObjectType } from '@klicker-uzh/graphql/dist/ops'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import ObjectAccessLabel from '../ObjectAccessLabel'

function ObjectFilters({
  typeFilter,
  setTypeFilter,
  accessTypeFilter,
  setAccessTypeFilter,
}: {
  typeFilter: SharingObjectType | ''
  setTypeFilter: Dispatch<SetStateAction<SharingObjectType | ''>>
  accessTypeFilter: ObjectAccess | ''
  setAccessTypeFilter: Dispatch<SetStateAction<ObjectAccess | ''>>
}) {
  const t = useTranslations()

  return (
    <div className="flex flex-row gap-3">
      <SelectField
        label={t('manage.catalog.objectType')}
        items={[
          {
            value: '',
            label: t('manage.catalog.all'),
            data: { cy: 'all-object-types' },
          },
          ...Object.values(SharingObjectType).map((type) => ({
            label: t(`shared.types.${type}`),
            value: type,
            data: { cy: `catalog-object-type-${type}` },
          })),
        ]}
        value={typeFilter}
        onChange={(newValue) => {
          setTypeFilter(newValue as SharingObjectType)
        }}
        className={{ select: { trigger: 'h-9 w-52' } }}
        data={{ cy: 'catalog-object-type-filter' }}
      />
      <SelectField
        label={t('manage.catalog.accessTypes')}
        items={[
          {
            value: '',
            label: t('manage.catalog.all'),
            data: { cy: 'catalog-access-all' },
          },
          {
            value: ObjectAccess.Public,
            label: <ObjectAccessLabel accessType={ObjectAccess.Public} />,
            data: { cy: 'catalog-access-public' },
          },
          {
            value: ObjectAccess.Restricted,
            label: <ObjectAccessLabel accessType={ObjectAccess.Restricted} />,
            data: { cy: 'catalog-access-restricted' },
          },
        ]}
        value={accessTypeFilter}
        onChange={(newValue) => {
          setAccessTypeFilter(newValue as ObjectAccess)
        }}
        className={{ select: { trigger: 'h-9 w-40' } }}
        data={{ cy: 'catalog-access-type-filter' }}
      />
    </div>
  )
}

export default ObjectFilters
