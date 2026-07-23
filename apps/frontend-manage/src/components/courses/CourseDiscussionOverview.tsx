import { useLazyQuery, useQuery } from '@apollo/client'
import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DiscussionSort,
  GetCourseDiscussionCourseEmbeddingInfoDocument,
  GetCourseDiscussionEmbeddingInfoDocument,
  GetCourseDiscussionOverviewDocument,
  type GetCourseDiscussionOverviewQuery,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification, toast } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

type OverviewGroup =
  GetCourseDiscussionOverviewQuery['courseDiscussionOverview']['groups'][number]

interface OverviewPagination {
  groups: OverviewGroup[]
  nextCursor: string | null
  hasMore: boolean
}

function mergeOverviewGroups(
  ...groupSets: Array<OverviewGroup[]>
): OverviewGroup[] {
  const mergedGroups: OverviewGroup[] = []
  const groupIndexes = new Map<string, number>()

  for (const groups of groupSets) {
    for (const group of groups) {
      const existingIndex = groupIndexes.get(group.sourceKey)

      if (existingIndex === undefined) {
        groupIndexes.set(group.sourceKey, mergedGroups.length)
        mergedGroups.push({
          ...group,
          threads: [...group.threads],
        })
        continue
      }

      const existingGroup = mergedGroups[existingIndex]!
      const existingThreadIds = new Set(
        existingGroup.threads.map((thread) => thread.id)
      )
      existingGroup.threads.push(
        ...group.threads.filter((thread) => !existingThreadIds.has(thread.id))
      )
    }
  }

  return mergedGroups
}

function CourseDiscussionOverview({
  courseId,
  isCourseQAEnabled,
  isCourseQAAnonymousEnabled,
}: {
  courseId: string
  isCourseQAEnabled: boolean
  isCourseQAAnonymousEnabled: boolean
}) {
  const t = useTranslations()
  const formatter = useFormatter()
  const [embedScope, setEmbedScope] = useState<'external' | 'course'>(
    'external'
  )
  const [externalSource, setExternalSource] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [allowAnonymous, setAllowAnonymous] = useState(false)
  const [expiresInHours, setExpiresInHours] = useState(48)
  const [generatedEmbedInfo, setGeneratedEmbedInfo] = useState<{
    embedUrl: string
    expiresAt: string
  } | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pagination, setPagination] = useState<OverviewPagination | null>(null)
  const loadingMoreRef = useRef(false)

  const {
    data: overviewData,
    loading: loadingOverview,
    error: overviewError,
    refetch: refetchOverview,
    fetchMore,
  } = useQuery(GetCourseDiscussionOverviewDocument, {
    variables: {
      courseId,
      sort: DiscussionSort.ActivityDesc,
      limit: 20,
    },
    skip: !isCourseQAEnabled,
    pollInterval: 20000,
    fetchPolicy: 'cache-and-network',
  })

  const [generateEmbedInfo, { loading: loadingEmbed }] = useLazyQuery(
    GetCourseDiscussionEmbeddingInfoDocument,
    {
      fetchPolicy: 'no-cache',
    }
  )
  const [generateCourseEmbedInfo, { loading: loadingCourseEmbed }] =
    useLazyQuery(GetCourseDiscussionCourseEmbeddingInfoDocument, {
      fetchPolicy: 'no-cache',
    })
  const isExternalEmbed = embedScope === 'external'
  const isGeneratingEmbed = loadingEmbed || loadingCourseEmbed
  const effectiveAllowAnonymous = isCourseQAAnonymousEnabled && allowAnonymous
  const hasValidExternalBlock =
    externalSource.trim().length > 0 && externalRef.trim().length > 0

  useEffect(() => {
    if (isCourseQAAnonymousEnabled) return

    setAllowAnonymous(false)
  }, [isCourseQAAnonymousEnabled])

  useEffect(() => {
    if (!generatedEmbedInfo) return

    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [generatedEmbedInfo])

  useEffect(() => {
    setGeneratedEmbedInfo(null)
  }, [embedScope, externalSource, externalRef, allowAnonymous, expiresInHours])

  useEffect(() => {
    setPagination(null)
    loadingMoreRef.current = false
    setLoadingMore(false)
  }, [courseId, isCourseQAEnabled])

  const overview = overviewData?.courseDiscussionOverview
  const groups = mergeOverviewGroups(
    overview?.groups ?? [],
    pagination?.groups ?? []
  )
  const hasMore = pagination?.hasMore ?? overview?.hasMore ?? false
  const nextCursor = pagination
    ? pagination.nextCursor
    : (overview?.nextCursor ?? null)
  const loadedThreadCount = groups.reduce(
    (count, group) => count + group.threads.length,
    0
  )

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || !hasMore || loadingOverview || loadingMoreRef.current) {
      return
    }

    loadingMoreRef.current = true
    setLoadingMore(true)

    try {
      const result = await fetchMore({
        variables: { cursor: nextCursor },
      })
      const nextPage = result.data?.courseDiscussionOverview
      if (!nextPage) return

      setPagination((previous) => ({
        groups: mergeOverviewGroups(previous?.groups ?? [], nextPage.groups),
        nextCursor: nextPage.nextCursor ?? null,
        hasMore: nextPage.hasMore,
      }))
    } catch {
      toast({
        type: 'error',
        message: t('shared.generic.systemError'),
      })
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [fetchMore, hasMore, loadingOverview, nextCursor, t])

  const handleRefresh = useCallback(async () => {
    if (loadingMoreRef.current) return

    try {
      await refetchOverview()
    } catch {
      toast({
        type: 'error',
        message: t('shared.generic.systemError'),
      })
    }
  }, [refetchOverview, t])

  if (!isCourseQAEnabled) {
    return (
      <div className="px-1 py-2">
        <UserNotification
          type="info"
          message={t('manage.course.courseQADisabledNotice')}
          data={{ cy: 'course-qa-disabled-notice' }}
        />
      </div>
    )
  }

  if (loadingOverview) {
    return (
      <div className="px-1 py-2">
        <Loader />
      </div>
    )
  }

  const formatDateTime = (value: string) =>
    formatter.dateTime(new Date(value), {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  const embedExpiryTimestamp = generatedEmbedInfo
    ? new Date(generatedEmbedInfo.expiresAt).getTime()
    : null
  const embedExpired =
    embedExpiryTimestamp !== null &&
    Number.isFinite(embedExpiryTimestamp) &&
    embedExpiryTimestamp < currentTime

  return (
    <div className="flex flex-col gap-4 px-1 py-2">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <H3 className={{ root: 'm-0' }}>
            {t('manage.course.discussionOverview')}
          </H3>
          <Button
            onClick={handleRefresh}
            disabled={loadingMore}
            data={{ cy: 'course-qa-refresh-overview' }}
          >
            <Button.Label>{t('manage.course.refreshOverview')}</Button.Label>
          </Button>
        </div>

        {overviewError && !overview ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
          />
        ) : groups.length === 0 ? (
          <UserNotification
            type="info"
            message={t('manage.course.noThreadsYet')}
            data={{ cy: 'course-qa-overview-empty' }}
          />
        ) : (
          <div
            className="flex flex-col gap-3"
            data-cy="course-qa-overview-groups"
            aria-busy={loadingMore}
          >
            {groups.map((group) => (
              <div
                key={group.sourceKey}
                className="rounded-md border border-gray-200"
                data-cy={`course-qa-overview-group-${group.sourceKey}`}
              >
                <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold">
                  {group.sourceLabel}
                </div>
                <div className="flex flex-col gap-2 p-3">
                  {group.threads.map((thread) => (
                    <div
                      key={thread.id}
                      className="rounded-md border border-gray-100 p-2"
                      data-cy={`course-qa-overview-thread-${thread.id}`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span className="max-w-full break-words rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                          {thread.scope?.scopeLabel ?? thread.scope?.scopeKey}
                        </span>
                        <span>{formatDateTime(thread.lastActivityAt)}</span>
                        <span className="flex items-center gap-1">
                          <FontAwesomeIcon
                            icon={faThumbsUp}
                            className="text-gray-500"
                            aria-hidden="true"
                          />
                          {thread.upvotes}
                        </span>
                        <span>
                          {t('pwa.courseQA.nReply', {
                            count: thread.replyCount,
                          })}
                        </span>
                      </div>
                      <div className="line-clamp-2 whitespace-pre-wrap break-words text-sm">
                        {thread.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {(hasMore || pagination !== null) && (
              <div className="flex justify-center pt-1">
                <Button
                  onClick={handleLoadMore}
                  loading={loadingMore}
                  disabled={loadingMore || !hasMore}
                  data={{ cy: 'course-qa-load-more-overview' }}
                >
                  <Button.Label>
                    {hasMore
                      ? t('manage.course.loadMoreThreads')
                      : t('manage.course.allThreadsLoaded')}
                  </Button.Label>
                </Button>
                <span className="sr-only" aria-live="polite">
                  {t('manage.course.loadedThreadCount', {
                    count: loadedThreadCount,
                  })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <details className="group rounded-lg border border-gray-200 bg-white p-4">
        <summary className="focus-visible:outline-primary-100 flex cursor-pointer list-none items-start justify-between gap-4 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <div className="min-w-0">
            <H3 className={{ root: 'm-0' }}>
              {t('manage.course.embedLinkGenerator')}
            </H3>
            <div className="mt-2 text-sm text-gray-600">
              {isExternalEmbed
                ? t('manage.course.embedExternalBlockHelp')
                : t('manage.course.embedCourseHelp')}
            </div>
          </div>
          <FontAwesomeIcon
            icon={faChevronDown}
            className="mt-1 shrink-0 text-gray-500 group-open:rotate-180 motion-safe:transition-transform"
            aria-hidden="true"
          />
        </summary>

        <fieldset className="mt-4">
          <legend className="mb-1 block text-xs font-semibold text-gray-700">
            {t('manage.course.embedScope')}
          </legend>
          <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5">
            {(['external', 'course'] as const).map((scope) => (
              <label
                key={scope}
                className={`focus-within:ring-primary-100 cursor-pointer rounded px-3 py-1.5 text-sm focus-within:ring-2 ${
                  embedScope === scope
                    ? 'bg-white font-semibold text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
                data-cy={`course-qa-embed-scope-${scope}`}
              >
                <input
                  type="radio"
                  name="embed-scope"
                  value={scope}
                  checked={embedScope === scope}
                  onChange={() => setEmbedScope(scope)}
                  className="sr-only"
                />
                {scope === 'course'
                  ? t('manage.course.embedScopeCourse')
                  : t('manage.course.embedScopeExternal')}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {isExternalEmbed && (
            <>
              <div>
                <label
                  className="mb-1 block text-xs font-semibold text-gray-700"
                  htmlFor="embed-external-source"
                >
                  {t('manage.course.embedExternalSource')}
                </label>
                <input
                  id="embed-external-source"
                  name="embed-external-source"
                  type="text"
                  value={externalSource}
                  onChange={(event) => setExternalSource(event.target.value)}
                  autoComplete="off"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder={t(
                    'manage.course.embedExternalSourcePlaceholder'
                  )}
                  data-cy="course-qa-external-source"
                />
              </div>

              <div>
                <label
                  className="mb-1 block text-xs font-semibold text-gray-700"
                  htmlFor="embed-external-ref"
                >
                  {t('manage.course.embedExternalRef')}
                </label>
                <input
                  id="embed-external-ref"
                  name="embed-external-ref"
                  type="text"
                  value={externalRef}
                  onChange={(event) => setExternalRef(event.target.value)}
                  autoComplete="off"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder={t('manage.course.embedExternalRefPlaceholder')}
                  data-cy="course-qa-external-ref"
                />
              </div>
            </>
          )}

          <div>
            <label
              className="mb-1 block text-xs font-semibold text-gray-700"
              htmlFor="embed-token-lifetime"
            >
              {t('manage.course.tokenLifetime')}
            </label>
            <input
              id="embed-token-lifetime"
              name="embed-token-lifetime"
              type="number"
              min={1}
              max={336}
              value={expiresInHours}
              inputMode="numeric"
              autoComplete="off"
              onChange={(event) =>
                setExpiresInHours(
                  Math.max(
                    1,
                    Math.min(
                      336,
                      Number.parseInt(event.target.value || '1', 10)
                    )
                  )
                )
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              data-cy="course-qa-expires-hours"
            />
          </div>

          <div className="flex items-end">
            <label
              className="inline-flex items-center gap-2 text-sm text-gray-700"
              htmlFor="embed-allow-anonymous"
            >
              <input
                id="embed-allow-anonymous"
                name="embed-allow-anonymous"
                type="checkbox"
                checked={effectiveAllowAnonymous}
                disabled={!isCourseQAAnonymousEnabled}
                onChange={(event) => setAllowAnonymous(event.target.checked)}
                data-cy="course-qa-allow-anonymous-embed"
              />
              {t('manage.course.allowAnonymousPosting')}
            </label>
          </div>
        </div>

        {!isCourseQAAnonymousEnabled && (
          <div className="mt-2 text-xs text-amber-700">
            {t('manage.course.allowAnonymousPostingDisabled')}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            primary
            loading={isGeneratingEmbed}
            disabled={
              (isExternalEmbed && !hasValidExternalBlock) || isGeneratingEmbed
            }
            onClick={async () => {
              try {
                const variables = {
                  courseId,
                  allowAnonymous: effectiveAllowAnonymous,
                  expiresInHours,
                }
                const result = isExternalEmbed
                  ? await generateEmbedInfo({
                      variables: {
                        ...variables,
                        externalBlock: {
                          externalSource: externalSource.trim(),
                          externalRef: externalRef.trim(),
                        },
                      },
                    })
                  : await generateCourseEmbedInfo({ variables })

                if (!result.data?.getCourseDiscussionEmbeddingInfo?.embedUrl) {
                  toast({
                    type: 'error',
                    message: t('manage.course.embedGenFailed'),
                  })
                  setGeneratedEmbedInfo(null)
                  return
                }

                setCurrentTime(Date.now())
                setGeneratedEmbedInfo({
                  embedUrl:
                    result.data.getCourseDiscussionEmbeddingInfo.embedUrl,
                  expiresAt:
                    result.data.getCourseDiscussionEmbeddingInfo.expiresAt,
                })
              } catch {
                toast({
                  type: 'error',
                  message: t('manage.course.embedGenFailed'),
                })
                setGeneratedEmbedInfo(null)
              }
            }}
            data={{ cy: 'course-qa-generate-embed' }}
          >
            <Button.Label>{t('manage.course.generateEmbedLink')}</Button.Label>
          </Button>

          <Button
            onClick={async () => {
              if (!generatedEmbedInfo?.embedUrl) return

              try {
                await navigator.clipboard.writeText(generatedEmbedInfo.embedUrl)
                toast({
                  type: 'success',
                  message: t('manage.course.embedCopied'),
                })
              } catch {
                toast({
                  type: 'error',
                  message: t('shared.generic.systemError'),
                })
              }
            }}
            disabled={!generatedEmbedInfo?.embedUrl || embedExpired}
            data={{ cy: 'course-qa-copy-embed' }}
          >
            <Button.Label>{t('manage.course.copyUrl')}</Button.Label>
          </Button>
        </div>

        {generatedEmbedInfo?.embedUrl && (
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
            <div className="mb-1 font-semibold text-gray-700">
              {t('manage.course.embedUrl')}
            </div>
            {!embedExpired && (
              <div
                className="break-all text-gray-800"
                data-cy="course-qa-embed-url"
              >
                {generatedEmbedInfo.embedUrl}
              </div>
            )}
            <div className="mt-1 text-gray-600">
              {t('manage.course.expiresAt', {
                date: formatDateTime(generatedEmbedInfo.expiresAt),
              })}
            </div>
            {embedExpired && (
              <div className="mt-1 text-amber-700">
                {t('manage.course.embedExpiredRegenerate')}
              </div>
            )}
          </div>
        )}
      </details>
    </div>
  )
}

export default CourseDiscussionOverview
