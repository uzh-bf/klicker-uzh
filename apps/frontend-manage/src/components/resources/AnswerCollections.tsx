import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { trpc } from '../../lib/trpc'
import AnswerCollectionCreation from './answerCollections/AnswerCollectionCreation'
import AnswerCollectionList from './answerCollections/AnswerCollectionList'

function AnswerCollections() {
  const t = useTranslations()
  const { data, error, isLoading } =
    trpc.resources.answerCollectionsInfo.useQuery()

  return (
    <div className="h-full w-full">
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
            collections={data?.answerCollections}
            error={Boolean(error && !data)}
            loading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}

export default AnswerCollections
