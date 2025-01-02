import { useQuery } from '@apollo/client'
import { faBan, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CollectionAccess,
  GetAnswerCollectionSelectionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  SelectField,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AnswerCollectionImportItem from './AnswerCollectionImportItem'
import AnswerCollectionImportTypeFilter from './AnswerCollectionImportTypeFilter'
import useCollectionShortnames from './useCollectionShortnames'
import useCollectionFilters from './useCollectionsFilters'

function AnswerCollectionImport({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useTranslations()
  const [search, setSearch] = useState('')
  const [shortnameFilter, setShortnameFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<CollectionAccess | ''>('')

  const { data, loading } = useQuery(GetAnswerCollectionSelectionDocument)

  const collections = data?.getAnswerCollectionSelection ?? []
  const shortnames = useCollectionShortnames({ collections })
  const filteredCollections = useCollectionFilters({
    collections,
    search,
    shortnameFilter,
    typeFilter,
  })

  if (loading) {
    return <Loader />
  }

  return (
    <div className="mb-6">
      <div className="-mt-2 mb-2 flex flex-row items-end justify-between">
        <TextField
          placeholder={t('manage.general.searchPlaceholder')}
          value={search}
          onChange={(newValue: string) => {
            setSearch(newValue)
          }}
          icon={faMagnifyingGlass}
          className={{
            input: 'w-60',
          }}
        />
        <div className="flex flex-row gap-3">
          <AnswerCollectionImportTypeFilter
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
          />
          <SelectField
            label={t('manage.resources.userShortnames')}
            items={[
              {
                label: t('manage.resources.all'),
                value: '',
              },
              ...shortnames.map((shortname) => ({
                label: shortname,
                value: shortname,
              })),
            ]}
            value={shortnameFilter}
            onChange={(newValue) => {
              setShortnameFilter(newValue)
            }}
            className={{ select: { trigger: 'h-9 w-40' } }}
            placeholder={t('manage.resources.all')}
          />
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-2">
        {filteredCollections && filteredCollections.length > 0 ? (
          filteredCollections?.map((collection) => (
            <AnswerCollectionImportItem
              key={`collection-button-selection-${collection.id}`}
              collection={collection}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          ))
        ) : (
          <UserNotification
            type="info"
            message={t('manage.resources.noPublicRestrictedCollections')}
          />
        )}
      </div>
      <Button
        className={{ root: 'h-8 border-red-400' }}
        onClick={onClose}
        data={{ cy: 'cancel-create-answer-collection' }}
      >
        <FontAwesomeIcon icon={faBan} />
        {t('shared.generic.cancel')}
      </Button>
    </div>
  )
}

export default AnswerCollectionImport
