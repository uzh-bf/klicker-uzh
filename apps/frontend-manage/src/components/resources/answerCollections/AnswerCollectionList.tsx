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
  error,
  loading,
}: {
  collections?: AnswerCollectionInfo[]
  error: boolean
  loading: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const highlightedCollectionId =
    typeof router.query.highlight === 'string'
      ? Number(router.query.highlight)
      : undefined
  const hasHighlightedCollectionId = Number.isInteger(highlightedCollectionId)

  if (loading) {
    return <Loader />
  }

  if (error) {
    return (
      <UserNotification className={{ root: 'mt-1.5' }} type="error">
        {t('shared.generic.systemError')}
      </UserNotification>
    )
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
                hasHighlightedCollectionId
                  ? highlightedCollectionId === collection.id
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
