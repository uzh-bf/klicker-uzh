import { Badge, H4, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

type OverviewAnswerCollectionEntry = {
  id: number
  value: string
}

export type OverviewAnswerCollection = {
  ref: string
  name: string
  description?: string | null
  alreadyImported?: boolean
  existingAnswerCollectionId?: number | null
  entries: readonly OverviewAnswerCollectionEntry[]
  elementNames?: readonly string[]
}

function PackageAnswerCollectionOverview({
  collections,
  mode,
  loading = false,
  error = '',
  dataCy,
}: {
  collections: readonly OverviewAnswerCollection[]
  mode: 'export' | 'import'
  loading?: boolean
  error?: string
  dataCy: string
}) {
  const t = useTranslations()

  const descriptionKey =
    mode === 'export'
      ? 'manage.elements.packageAnswerCollectionsExportDescription'
      : 'manage.elements.packageAnswerCollectionsImportDescription'
  const duplicateCount = collections.filter(
    (collection) => collection.alreadyImported
  ).length

  return (
    <section className="flex min-h-0 flex-col gap-2" data-cy={dataCy}>
      <div className="flex flex-col gap-1">
        <H4 className={{ root: 'm-0 text-base' }}>
          {t('manage.elements.packageAnswerCollections')}
        </H4>
        <div className="text-sm text-slate-600">
          {t(descriptionKey, { numCollections: collections.length })}
        </div>
      </div>

      {mode === 'import' && duplicateCount > 0 ? (
        <div data-cy="element-import-answer-collection-duplicate-summary">
          <UserNotification
            type="warning"
            message={t(
              'manage.elements.packageAnswerCollectionDuplicateSummary',
              {
                count: duplicateCount,
              }
            )}
            className={{ root: 'text-sm' }}
          />
        </div>
      ) : null}

      {loading ? (
        <UserNotification
          message={t('manage.elements.packagePreviewLoading')}
          className={{ root: 'text-sm' }}
        />
      ) : error ? (
        <UserNotification
          type="error"
          message={error || t('manage.elements.packagePreviewError')}
          className={{ root: 'text-sm' }}
        />
      ) : collections.length === 0 ? (
        <UserNotification
          message={t('manage.elements.packageAnswerCollectionsEmpty')}
          className={{ root: 'text-sm' }}
        />
      ) : (
        <div className="max-h-40 overflow-auto rounded-md border border-solid bg-white">
          {collections.map((collection, index) => {
            const visibleEntries = collection.entries.slice(0, 5)
            const remainingEntries =
              collection.entries.length - visibleEntries.length
            const usedBy = collection.elementNames?.filter(Boolean) ?? []

            return (
              <div
                key={collection.ref}
                className="border-b border-solid px-3 py-2 last:border-b-0"
                data-cy={`element-package-answer-collection-${index}`}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <div className="line-clamp-1 break-words text-sm font-bold">
                      {collection.name}
                    </div>
                    {collection.description ? (
                      <div className="line-clamp-2 break-words text-xs text-slate-600">
                        {collection.description}
                      </div>
                    ) : null}
                    {mode === 'import' && collection.alreadyImported ? (
                      <span
                        className="mt-1 inline-block"
                        data-cy={`element-import-answer-collection-duplicate-${index}`}
                      >
                        <Badge className="border-amber-300 bg-amber-50 text-amber-800">
                          {t(
                            'manage.elements.packageAnswerCollectionDuplicate'
                          )}
                        </Badge>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex-none text-xs text-slate-600">
                    {t('manage.elements.packageAnswerCollectionEntries', {
                      count: collection.entries.length,
                    })}
                  </div>
                </div>

                {usedBy.length > 0 ? (
                  <div className="mt-1 line-clamp-1 text-xs text-slate-600">
                    {t('manage.elements.packageAnswerCollectionUsedBy', {
                      elements: usedBy.join(', '),
                    })}
                  </div>
                ) : null}

                {visibleEntries.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {visibleEntries.map((entry) => (
                      <span
                        key={entry.id}
                        className="max-w-full truncate rounded border border-solid bg-slate-50 px-1.5 py-0.5 text-xs text-slate-700"
                      >
                        {entry.value}
                      </span>
                    ))}
                    {remainingEntries > 0 ? (
                      <span className="rounded border border-solid bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600">
                        {t(
                          'manage.elements.packageAnswerCollectionMoreEntries',
                          {
                            count: remainingEntries,
                          }
                        )}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default PackageAnswerCollectionOverview
