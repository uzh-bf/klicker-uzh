import { useQuery } from '@apollo/client'
import { GetAnswerCollectionsInfoDocument } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import AnswerCollectionCreation from './answerCollections/AnswerCollectionCreation'
import AnswerCollectionList from './answerCollections/AnswerCollectionList'

function AnswerCollections() {
  const t = useTranslations()
  const { data, loading } = useQuery(GetAnswerCollectionsInfoDocument, {
    fetchPolicy: 'network-only',
  })

  return (
    <div className="min-h-full w-full shrink-0">
      <H2>{t('manage.resources.answerCollections')}</H2>
      <div className="mb-2">
        {t.rich('manage.resources.answerCollectionsDescription', {
          link: (text) => (
            <Link
              href="/resources/catalog"
              className="text-primary-100 hover:underline"
            >
              {text}
            </Link>
          ),
        })}
      </div>
      <div className="mt-6 flex flex-col lg:flex-row-reverse">
        <div className="lg:w-1/2 lg:border-l lg:pl-4">
          <AnswerCollectionCreation />
        </div>
        <div className="lg:w-1/2 lg:pr-4">
          <AnswerCollectionList
            collections={data?.getAnswerCollectionsInfo ?? []}
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}

export default AnswerCollections
