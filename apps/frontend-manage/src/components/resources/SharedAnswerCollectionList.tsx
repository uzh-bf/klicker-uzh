import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import AnswerCollectionCollapsible from './answerCollections/AnswerCollectionCollapsible'

function SharedAnswerCollectionList({}: {
  sharedCollections?: AnswerCollection[]
  requestedCollections?: AnswerCollection[]
  loading: boolean
}) {
  const t = useTranslations()

  // TODO: add shared answer collection list

  return (
    <AnswerCollectionCollapsible
      title={t('manage.resources.sharedAnswerCollections')}
    >
      LIST
    </AnswerCollectionCollapsible>
  )
}

export default SharedAnswerCollectionList
