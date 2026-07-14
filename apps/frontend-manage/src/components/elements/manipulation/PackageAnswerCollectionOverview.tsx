import { Badge, Button, H4, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { memo, useState } from 'react'

type OverviewAnswerCollectionEntry = {
  id: number
  value: string
}

const ANSWER_COLLECTION_ENTRY_PAGE_SIZE = 100

export type OverviewAnswerCollection = {
  ref: string
  name: string
  description?: string | null
  alreadyImported?: boolean
  existingAnswerCollectionId?: number | null
  existingAnswerCollectionName?: string | null
  entries: readonly OverviewAnswerCollectionEntry[]
  elementNames?: readonly string[]
}

const ExpandableAnswerCollectionEntries = memo(
  function ExpandableAnswerCollectionEntries({
    entries,
  }: {
    entries: readonly OverviewAnswerCollectionEntry[]
  }) {
    const t = useTranslations()
    const [expanded, setExpanded] = useState(false)
    const [page, setPage] = useState(0)
    const totalPages = Math.ceil(
      entries.length / ANSWER_COLLECTION_ENTRY_PAGE_SIZE
    )
    const visibleEntries = entries.slice(
      page * ANSWER_COLLECTION_ENTRY_PAGE_SIZE,
      (page + 1) * ANSWER_COLLECTION_ENTRY_PAGE_SIZE
    )
    const firstVisibleEntry = page * ANSWER_COLLECTION_ENTRY_PAGE_SIZE + 1
    const lastVisibleEntry = Math.min(
      (page + 1) * ANSWER_COLLECTION_ENTRY_PAGE_SIZE,
      entries.length
    )

    return (
      <details
        className="mt-1 rounded border border-solid bg-slate-50"
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary className="cursor-pointer px-2 py-1 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2">
          {t('manage.elements.packageAnswerCollectionEntries', {
            count: entries.length,
          })}
        </summary>
        {expanded ? (
          <div className="border-t border-solid">
            <ol
              start={firstVisibleEntry}
              className="m-0 max-h-48 list-decimal overflow-auto px-7 py-1.5 text-xs text-slate-700 [contain:content]"
              data-cy="element-package-answer-collection-entry-page"
              data-total-entries={entries.length}
            >
              {visibleEntries.map((entry) => (
                <li key={entry.id} className="break-words py-0.5">
                  {entry.value}
                </li>
              ))}
            </ol>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t border-solid px-2 py-1 text-xs">
                <Button
                  basic
                  type="button"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  data={{ cy: 'element-package-answer-collection-previous' }}
                >
                  {t('shared.table.previous')}
                </Button>
                <span aria-live="polite">
                  {t('manage.general.showingResults', {
                    start: firstVisibleEntry,
                    end: lastVisibleEntry,
                    total: entries.length,
                  })}
                </span>
                <Button
                  basic
                  type="button"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages - 1, current + 1))
                  }
                  data={{ cy: 'element-package-answer-collection-next' }}
                >
                  {t('shared.table.next')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </details>
    )
  }
)

function PackageAnswerCollectionOverview({
  collections,
  mode,
  loading = false,
  error = '',
  dataCy,
  selectedCollectionRefs,
}: {
  collections: readonly OverviewAnswerCollection[]
  mode: 'export' | 'import'
  loading?: boolean
  error?: string
  dataCy: string
  selectedCollectionRefs?: ReadonlySet<string>
}) {
  const t = useTranslations()

  const visibleCollections = selectedCollectionRefs
    ? collections.filter((collection) =>
        selectedCollectionRefs.has(collection.ref)
      )
    : collections

  const descriptionKey =
    mode === 'export'
      ? 'manage.elements.packageAnswerCollectionsExportDescription'
      : 'manage.elements.packageAnswerCollectionsImportDescription'
  const duplicateCount = visibleCollections.filter(
    (collection) => collection.alreadyImported
  ).length

  return (
    <section
      className="flex min-h-0 flex-col gap-2"
      data-cy={dataCy}
      aria-live={mode === 'import' ? 'polite' : undefined}
    >
      <div className="flex flex-col gap-1">
        <H4 className={{ root: 'm-0 text-base' }}>
          {t('manage.elements.packageAnswerCollections')}
        </H4>
        <div className="text-sm text-slate-600">
          {t(descriptionKey, { numCollections: visibleCollections.length })}
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
            className={{
              root: 'text-sm',
              icon: 'text-red-900',
              message: 'text-red-900',
            }}
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
      ) : visibleCollections.length === 0 ? (
        <UserNotification
          message={t('manage.elements.packageAnswerCollectionsEmpty')}
          className={{ root: 'text-sm' }}
        />
      ) : (
        <div className="max-h-40 overflow-auto rounded-md border border-solid bg-white">
          {visibleCollections.map((collection, index) => {
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
                        {collection.existingAnswerCollectionName ? (
                          <span className="ml-1 text-xs text-amber-800">
                            {t(
                              'manage.elements.packageAnswerCollectionDuplicateExisting',
                              {
                                name: collection.existingAnswerCollectionName,
                              }
                            )}
                          </span>
                        ) : null}
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

                {collection.entries.length > 0 ? (
                  <ExpandableAnswerCollectionEntries
                    entries={collection.entries}
                  />
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
