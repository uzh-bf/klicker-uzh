import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import AnswerCollectionCollapsible from './answerCollections/AnswerCollectionCollapsible'
import AnswerCollectionItem from './answerCollections/AnswerCollectionItem'

function SharedAnswerCollectionList({
  sharedCollections,
  requestedCollections,
  loading,
  setDeletionSuccess,
  setDeletionFailure,
  setRemovalSuccess,
  setRemovalFailure,
  setCancellationSuccess,
  setCancellationFailure,
}: {
  sharedCollections?: AnswerCollection[]
  requestedCollections?: AnswerCollection[]
  loading: boolean
  setDeletionSuccess: Dispatch<SetStateAction<boolean>>
  setDeletionFailure: Dispatch<SetStateAction<boolean>>
  setRemovalSuccess: Dispatch<SetStateAction<boolean>>
  setRemovalFailure: Dispatch<SetStateAction<boolean>>
  setCancellationSuccess: Dispatch<SetStateAction<boolean>>
  setCancellationFailure: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  if (loading) {
    return <Loader />
  }

  if (
    (!sharedCollections && !requestedCollections) ||
    (sharedCollections?.length === 0 && requestedCollections?.length === 0)
  ) {
    return (
      <AnswerCollectionCollapsible
        title={t('manage.resources.sharedAnswerCollections')}
        className={{ root: 'mb-4' }}
      >
        <UserNotification
          type="info"
          message={t('manage.resources.noSharedRequestedAnswerCollections')}
          className={{ root: 'mt-1.5' }}
        />
      </AnswerCollectionCollapsible>
    )
  }

  return (
    <AnswerCollectionCollapsible
      title={t('manage.resources.sharedAnswerCollections')}
      className={{ root: 'mb-4' }}
    >
      <div className="mt-2 flex flex-col">
        {sharedCollections?.map((collection) => (
          <AnswerCollectionItem
            key={`shared-collection-item-${collection.id}`}
            collection={collection}
            accessGranted={true}
            setDeletionSuccess={setDeletionSuccess}
            setDeletionFailure={setDeletionFailure}
            setRemovalSuccess={setRemovalSuccess}
            setRemovalFailure={setRemovalFailure}
            setCancellationSuccess={setCancellationSuccess}
            setCancellationFailure={setCancellationFailure}
          />
        ))}
        {requestedCollections?.map((collection) => (
          <AnswerCollectionItem
            key={`requested-collection-item-${collection.id}`}
            collection={collection}
            accessGranted={false}
            setDeletionSuccess={setDeletionSuccess}
            setDeletionFailure={setDeletionFailure}
            setRemovalSuccess={setRemovalSuccess}
            setRemovalFailure={setRemovalFailure}
            setCancellationSuccess={setCancellationSuccess}
            setCancellationFailure={setCancellationFailure}
          />
        ))}
      </div>
    </AnswerCollectionCollapsible>
  )
}

export default SharedAnswerCollectionList
