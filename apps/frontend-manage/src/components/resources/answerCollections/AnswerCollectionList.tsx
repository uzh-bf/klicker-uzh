import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import AnswerCollectionCollapsible from './AnswerCollectionCollapsible'
import AnswerCollectionItem from './AnswerCollectionItem'

function AnswerCollectionList({
  collections,
  loading,
}: {
  collections?: AnswerCollection[]
  loading: boolean
}) {
  const t = useTranslations()

  return (
    <AnswerCollectionCollapsible
      title={t('manage.resources.createdAnswerCollections')}
    >
      {loading ? <Loader /> : null}
      {collections && collections.length === 0 ? (
        <UserNotification type="info" className={{ root: 'mt-1.5' }}>
          {t('manage.resources.noAnswerCollections')}
        </UserNotification>
      ) : (
        <div className="mb-6 mt-2 flex flex-col gap-2">
          {collections?.map((collection) => (
            <AnswerCollectionItem
              editable
              key={`answer-collection-${collection.id}`}
              collection={collection}
            />
          ))}
        </div>
      )}
    </AnswerCollectionCollapsible>
  )
}

export default AnswerCollectionList
