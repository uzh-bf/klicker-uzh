import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import AnswerCollectionItem from './AnswerCollectionItem'

function AnswerCollectionList({
  collections,
  loading,
  setDeletionSuccess,
  setDeletionFailure,
  setRemovalSuccess,
  setRemovalFailure,
}: {
  collections?: AnswerCollection[]
  loading: boolean
  setDeletionSuccess: Dispatch<SetStateAction<boolean>>
  setDeletionFailure: Dispatch<SetStateAction<boolean>>
  setRemovalSuccess: Dispatch<SetStateAction<boolean>>
  setRemovalFailure: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  if (loading) {
    return <Loader />
  }

  return (
    <div>
      <H3>{t('manage.resources.availableAnswerCollections')}</H3>
      {collections && collections.length === 0 ? (
        <UserNotification type="info" className={{ root: 'mt-1.5' }}>
          {t('manage.resources.noAnswerCollections')}
        </UserNotification>
      ) : (
        <div className="flex flex-col">
          {collections?.map((collection) => (
            <AnswerCollectionItem
              isOwner={collection.isOwner ?? false}
              isEditable={collection.isEditable ?? false}
              isImported={collection.isImported ?? false}
              accessGranted={collection.isAccessGranted ?? false}
              key={`answer-collection-${collection.id}`}
              collection={collection}
              setDeletionSuccess={setDeletionSuccess}
              setDeletionFailure={setDeletionFailure}
              setRemovalSuccess={setRemovalSuccess}
              setRemovalFailure={setRemovalFailure}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default AnswerCollectionList
