import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import type { RouterOutputs } from '../../../lib/trpc'
import AnswerCollectionItem from './AnswerCollectionItem'

type AnswerCollectionInfo =
  RouterOutputs['resources']['answerCollectionsInfo']['answerCollections'][number]

function AnswerCollectionList({
  collections,
  loading,
}: {
  collections?: AnswerCollectionInfo[]
  loading: boolean
}) {
  const t = useTranslations()
  const router = useRouter()

  if (loading) {
    return <Loader />
  }

  return (
    <div data-cy="answer-collection-list">
      <H3>{t('manage.resources.availableAnswerCollections')}</H3>
      {collections && collections.length === 0 ? (
        <UserNotification className={{ root: 'mt-1.5' }}>
          {t('manage.resources.noAnswerCollections')}
        </UserNotification>
      ) : (
        <div className="mt-1 flex flex-col">
          {collections?.map((collection) => (
            <AnswerCollectionItem
              key={`answer-collection-${collection.id}`}
              collection={collection}
              highlighted={
                router.query?.highlight
                  ? parseInt(router.query.highlight as string) === collection.id
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default AnswerCollectionList
