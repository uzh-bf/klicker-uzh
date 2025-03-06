import { useSuspenseQuery } from '@apollo/client'
import { GetAnswerCollectionCatalogInfoDocument } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function CatalogInfoAnswerCollection({
  id,
  catalogCollectionId,
}: {
  id: number
  catalogCollectionId?: string
}) {
  const t = useTranslations()
  const [showEntries, setShowEntries] = useState(false)
  const { data } = useSuspenseQuery(GetAnswerCollectionCatalogInfoDocument, {
    variables: {
      collectionId: id,
      catalogCollectionId,
    },
  })

  const collection = data?.getAnswerCollectionCatalogInfo
  if (!collection) return null

  return (
    <div className="mt-3 rounded bg-slate-100 p-3">
      <Markdown
        content={`**Description:** ${collection.description}`}
        data={{ cy: 'import-answer-collection-description' }}
      />
      {collection.entries && collection.entries.length > 0 ? (
        <div>
          {showEntries ? (
            <div className="mt-2">
              <div className="font-bold">
                {t('manage.resources.answerOptions')}
              </div>
              <ul className="list-inside list-disc">
                {collection.entries?.map((entry, ix) => (
                  <li
                    key={entry.id}
                    data-cy={`public-collection-answer-option-${ix}`}
                  >
                    {entry.value}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Button
              basic
              className={{
                root: 'text-primary-100 px-0 py-0 hover:bg-transparent',
              }}
              onClick={() => setShowEntries(true)}
              data={{ cy: 'public-collection-show-answers' }}
            >
              <Button.Label>{t('manage.resources.showAnswers')}</Button.Label>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default CatalogInfoAnswerCollection
