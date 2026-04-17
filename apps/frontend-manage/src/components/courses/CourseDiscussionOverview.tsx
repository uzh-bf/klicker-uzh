import { useLazyQuery, useQuery } from '@apollo/client'
import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCourseDiscussionEmbeddingInfoDocument,
  GetCourseDiscussionOverviewDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification, toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
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
  const [externalSource, setExternalSource] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [allowAnonymous, setAllowAnonymous] = useState(false)
  const [expiresInHours, setExpiresInHours] = useState(48)
  const [generatedEmbedInfo, setGeneratedEmbedInfo] = useState<{
    embedUrl: string
    expiresAt: string
  } | null>(null)

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
      setGeneratedEmbedInfo((current) => (current ? { ...current } : current))
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
  const embedExpired = generatedEmbedInfo
    ? dayjs(generatedEmbedInfo.expiresAt).isBefore(dayjs())
    : false

  return (
    <div className="flex flex-col gap-4 px-1 py-2">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <H3 className={{ root: 'mb-2 mt-0' }}>
          {t('manage.course.embedLinkGenerator')}
        </H3>

        <div className="mb-2 text-sm text-gray-600">
          {t('manage.course.embedExternalBlockHelp')}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label
              className="mb-1 block text-xs font-semibold text-gray-700"
              htmlFor="embed-external-source"
            >
              {t('manage.course.embedExternalSource')}
            </label>
            <input
              id="embed-external-source"
              type="text"
              value={externalSource}
              onChange={(event) => setExternalSource(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              placeholder={t('manage.course.embedExternalSourcePlaceholder')}
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
              type="text"
              value={externalRef}
              onChange={(event) => setExternalRef(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              placeholder={t('manage.course.embedExternalRefPlaceholder')}
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
              type="number"
              min={1}
              max={336}
              value={expiresInHours}
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
            />
          </div>

          <div className="flex items-end">
            <label
              className="inline-flex items-center gap-2 text-sm text-gray-700"
              htmlFor="embed-allow-anonymous"
            >
              <input
                id="embed-allow-anonymous"
                type="checkbox"
                checked={effectiveAllowAnonymous}
                disabled={!isCourseQAAnonymousEnabled}
                onChange={(event) => setAllowAnonymous(event.target.checked)}
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

          <Button
            onClick={async () => {
              await refetchOverview()
            }}
            data={{ cy: 'course-qa-refresh-overview' }}
          >
            <Button.Label>{t('manage.course.refreshOverview')}</Button.Label>
          </Button>
        </div>

        {generatedEmbedInfo?.embedUrl && (
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
            <div className="mb-1 font-semibold text-gray-700">
              {t('manage.course.embedUrl')}
            </div>
            {!embedExpired && (
              <div className="break-all text-gray-800">
                {generatedEmbedInfo.embedUrl}
              </div>
            )}
            <div className="mt-1 text-gray-600">
              {t('manage.course.expiresAt', {
                date: dayjs(generatedEmbedInfo.expiresAt).format(
                  'DD.MM.YYYY HH:mm'
                ),
              })}
            </div>
            {embedExpired && (
              <div className="mt-1 text-amber-700">
                Generate a new link before copying.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <H3 className={{ root: 'mb-2 mt-0' }}>
          {t('manage.course.discussionOverview')}
        </H3>

        {groups.length === 0 ? (
          <UserNotification
            type="info"
            message={t('manage.course.noThreadsYet')}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div
                key={group.sourceKey}
                className="rounded-md border border-gray-200"
              >
                <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold">
                  {group.sourceLabel}
                </div>
                <div className="flex flex-col gap-2 p-3">
                  {group.threads.map((thread) => (
                    <div
                      key={thread.id}
                      className="rounded-md border border-gray-100 p-2"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                          {thread.scope?.scopeLabel ?? thread.scope?.scopeKey}
                        </span>
                        <span>
                          {dayjs(thread.lastActivityAt).format(
                            'DD.MM.YYYY HH:mm'
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <FontAwesomeIcon
                            icon={faThumbsUp}
                            className="text-gray-500"
                          />
                          {thread.upvotes}
                        </span>
                        <span>
                          {t('pwa.courseQA.nReply', {
                            count: thread.replyCount,
                          })}
                        </span>
                      </div>
                      <div className="line-clamp-2 whitespace-pre-wrap text-sm">
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
    </div>
  )
}

export default CourseDiscussionOverview
