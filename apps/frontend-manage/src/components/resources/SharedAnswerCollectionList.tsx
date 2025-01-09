import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import AnswerCollectionCollapsible from './answerCollections/AnswerCollectionCollapsible'
import AnswerCollectionItem from './answerCollections/AnswerCollectionItem'

function SharedAnswerCollectionList({
  sharedCollections,
  requestedCollections,
  loading,
}: {
  sharedCollections?: AnswerCollection[]
  requestedCollections?: AnswerCollection[]
  loading: boolean
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
          />
        ))}
        {requestedCollections?.map((collection) => (
          <AnswerCollectionItem
            key={`requested-collection-item-${collection.id}`}
            collection={collection}
            accessGranted={false}
          />
        ))}
      </div>
    </AnswerCollectionCollapsible>
  )
}

export default SharedAnswerCollectionList
