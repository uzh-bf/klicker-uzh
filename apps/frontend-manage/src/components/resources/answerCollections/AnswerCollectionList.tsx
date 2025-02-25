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
        <div className="mt-1.5 bg-white">
          {collections?.map((collection, index) => (
            <div key={`answer-collection-${collection.id}`}>
              <AnswerCollectionItem
                isOwner={collection.isOwner ?? false}
                isEditable={collection.isEditable ?? false}
                isImported={collection.isImported ?? false}
                isShareable={collection.isShareable ?? false}
                accessGranted={collection.isAccessGranted ?? false}
                collection={collection}
                setDeletionSuccess={setDeletionSuccess}
                setDeletionFailure={setDeletionFailure}
                setRemovalSuccess={setRemovalSuccess}
                setRemovalFailure={setRemovalFailure}
              />
              {index < collections.length - 1 && (
                <hr className="border-t-2 border-gray-300" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AnswerCollectionList
