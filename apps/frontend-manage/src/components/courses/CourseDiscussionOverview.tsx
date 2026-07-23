import { useLazyQuery, useQuery } from '@apollo/client'
import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCourseDiscussionEmbeddingInfoDocument,
  GetCourseDiscussionOverviewDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification, toast } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

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
  const [externalSource, setExternalSource] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [allowAnonymous, setAllowAnonymous] = useState(false)
  const [expiresInHours, setExpiresInHours] = useState(48)
  const [generatedEmbedInfo, setGeneratedEmbedInfo] = useState<{
    embedUrl: string
    expiresAt: string
  } | null>(null)
  const [currentTime, setCurrentTime] = useState(0)

  const {
    data: overviewData,
    loading: loadingOverview,
    refetch: refetchOverview,
  } = useQuery(GetCourseDiscussionOverviewDocument, {
    variables: {
      courseId,
      sort: 'ACTIVITY_DESC',
      limit: 100,
    } as any,
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
  }, [externalSource, externalRef, allowAnonymous, expiresInHours])

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

  const groups = overviewData?.courseDiscussionOverview?.groups ?? []
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
            onClick={async () => {
              await refetchOverview()
            }}
            data={{ cy: 'course-qa-refresh-overview' }}
          >
            <Button.Label>{t('manage.course.refreshOverview')}</Button.Label>
          </Button>
        </div>

        {groups.length === 0 ? (
          <UserNotification
            type="info"
            message={t('manage.course.noThreadsYet')}
            data={{ cy: 'course-qa-overview-empty' }}
          />
        ) : (
          <div
            className="flex flex-col gap-3"
            data-cy="course-qa-overview-groups"
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
              {t('manage.course.embedExternalBlockHelp')}
            </div>
          </div>
          <FontAwesomeIcon
            icon={faChevronDown}
            className="mt-1 shrink-0 text-gray-500 group-open:rotate-180 motion-safe:transition-transform"
            aria-hidden="true"
          />
        </summary>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
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
              placeholder={t('manage.course.embedExternalSourcePlaceholder')}
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
            loading={loadingEmbed}
            disabled={!hasValidExternalBlock || loadingEmbed}
            onClick={async () => {
              try {
                const result = await generateEmbedInfo({
                  variables: {
                    courseId,
                    externalBlock: {
                      externalSource: externalSource.trim(),
                      externalRef: externalRef.trim(),
                    },
                    allowAnonymous: effectiveAllowAnonymous,
                    expiresInHours,
                  },
                })

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
                Generate a new link before copying.
              </div>
            )}
          </div>
        )}
      </details>
    </div>
  )
}

export default CourseDiscussionOverview
