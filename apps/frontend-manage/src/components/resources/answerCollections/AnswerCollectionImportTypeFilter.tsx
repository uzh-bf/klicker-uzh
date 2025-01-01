import { faLockOpen, faUserLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CollectionAccess } from '@klicker-uzh/graphql/dist/ops'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

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
          label: (
            <div className="flex flex-row items-center gap-2 text-green-700">
              <FontAwesomeIcon icon={faLockOpen} />
              {t(`manage.resources.access${CollectionAccess.Public}`)}
            </div>
          ),
          data: { cy: 'answer-collection-access-public' },
        },
        {
          value: CollectionAccess.Restricted,
          label: (
            <div className="flex flex-row items-center gap-2 text-orange-600">
              <FontAwesomeIcon icon={faUserLock} />
              {t(`manage.resources.access${CollectionAccess.Restricted}`)}
            </div>
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
