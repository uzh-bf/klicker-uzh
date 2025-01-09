import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import AnswerCollectionCollapsible from './AnswerCollectionCollapsible'
import AnswerCollectionItem from './AnswerCollectionItem'

function AnswerCollectionList({
  collections,
  loading,
  setDeletionSuccess,
  setDeletionFailure,
  setRemovalSuccess,
  setRemovalFailure,
  setCancellationSuccess,
  setCancellationFailure,
}: {
  collections?: AnswerCollection[]
  loading: boolean
  setDeletionSuccess: Dispatch<SetStateAction<boolean>>
  setDeletionFailure: Dispatch<SetStateAction<boolean>>
  setRemovalSuccess: Dispatch<SetStateAction<boolean>>
  setRemovalFailure: Dispatch<SetStateAction<boolean>>
  setCancellationSuccess: Dispatch<SetStateAction<boolean>>
  setCancellationFailure: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  return (
    <AnswerCollectionCollapsible
      title={t('manage.resources.createdAnswerCollections')}
      className={{ root: 'mb-4' }}
    >
      {loading ? <Loader /> : null}
      {collections && collections.length === 0 ? (
        <UserNotification type="info" className={{ root: 'mt-1.5' }}>
          {t('manage.resources.noAnswerCollections')}
        </UserNotification>
      ) : (
        <div className="mt-2 flex flex-col">
          {collections?.map((collection) => (
            <AnswerCollectionItem
              editable
              key={`answer-collection-${collection.id}`}
              collection={collection}
              setDeletionSuccess={setDeletionSuccess}
              setDeletionFailure={setDeletionFailure}
              setRemovalSuccess={setRemovalSuccess}
              setRemovalFailure={setRemovalFailure}
              setCancellationSuccess={setCancellationSuccess}
              setCancellationFailure={setCancellationFailure}
            />
          ))}
        </div>
      )}
    </AnswerCollectionCollapsible>
  )
}

export default AnswerCollectionList
