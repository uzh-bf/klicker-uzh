import { CollectionAccess } from '@klicker-uzh/graphql/dist/ops'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import CollectionAccessLabel from './CollectionAccessLabel'

function AnswerCollectionImportTypeFilter({
  typeFilter,
  setTypeFilter,
}: {
  typeFilter: CollectionAccess | ''
  setTypeFilter: Dispatch<SetStateAction<CollectionAccess | ''>>
}) {
  const t = useTranslations()

  return (
    <SelectField
      label={t('manage.resources.accessTypes')}
      items={[
        { value: '', label: t('manage.resources.all') },
        {
          value: CollectionAccess.Public,
          label: <CollectionAccessLabel accessType={CollectionAccess.Public} />,
          data: { cy: 'answer-collection-access-public' },
        },
        {
          value: CollectionAccess.Restricted,
          label: (
            <CollectionAccessLabel accessType={CollectionAccess.Restricted} />
          ),
          data: { cy: 'answer-collection-access-restricted' },
        },
      ]}
      value={typeFilter}
      onChange={(newValue) => {
        setTypeFilter(newValue as CollectionAccess)
      }}
      className={{ select: { trigger: 'h-9 w-40' } }}
    />
  )
}

export default AnswerCollectionImportTypeFilter
