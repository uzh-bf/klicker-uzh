import { useQuery } from '@apollo/client'
import { GetAnswerCollectionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import AnswerCollectionList from './answerCollections/AnswerCollectionList'
import CreateAddCollection from './answerCollections/CreateAddCollection'
import SharedAnswerCollectionList from './SharedAnswerCollectionList'

function AnswerCollections() {
  const t = useTranslations()
  const { data, loading } = useQuery(GetAnswerCollectionsDocument)

  return (
    <div className="h-full w-full">
      <H2>{t('manage.resources.answerCollections')}</H2>
      <div className="mb-2">
        {t('manage.resources.answerCollectionsDescription')}
      </div>
      <CreateAddCollection />
      <AnswerCollectionList
        collections={data?.getAnswerCollections?.answerCollections}
        loading={loading}
      />
      <SharedAnswerCollectionList
        sharedCollections={data?.getAnswerCollections?.sharedCollections}
        requestedCollections={data?.getAnswerCollections?.requestedCollections}
        loading={loading}
      />
    </div>
  )
}

export default AnswerCollections
