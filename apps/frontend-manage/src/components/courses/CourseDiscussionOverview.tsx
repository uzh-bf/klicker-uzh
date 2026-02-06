import { useLazyQuery, useQuery } from '@apollo/client'
import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCourseDiscussionEmbeddingInfoDocument,
  GetCourseDiscussionOverviewDocument,
  GetCourseDiscussionScopesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { parseScopeKeyToInput } from '@klicker-uzh/shared-components/src/discussionUtils'
import { Button, H3, UserNotification, toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

function CourseDiscussionOverview({
  courseId,
  isCourseQAEnabled,
}: {
  courseId: string
  isCourseQAEnabled: boolean
}) {
  const t = useTranslations()
  const [selectedScopeKey, setSelectedScopeKey] = useState<string>('')
  const [allowAnonymous, setAllowAnonymous] = useState(false)
  const [expiresInHours, setExpiresInHours] = useState(48)

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

  const { data: scopesData, loading: loadingScopes } = useQuery(
    GetCourseDiscussionScopesDocument,
    {
      variables: { courseId },
      skip: !isCourseQAEnabled,
      pollInterval: 30000,
      fetchPolicy: 'cache-and-network',
    }
  )

  const [generateEmbedInfo, { data: embedData, loading: loadingEmbed }] =
    useLazyQuery(GetCourseDiscussionEmbeddingInfoDocument)

  const scopeOptions = scopesData?.courseDiscussionScopes ?? []

  const embedScopeOptions = useMemo(() => {
    const baseOptions = scopeOptions.filter(
      (scope) => scope.spaceType === 'COURSE'
    )
    return baseOptions.length > 0
      ? baseOptions
      : [
          {
            scopeKey: `course:${courseId}`,
            scopeLabel: t('shared.generic.course'),
            sourceLabel: t('shared.generic.course'),
            spaceType: 'COURSE' as const,
          },
        ]
  }, [scopeOptions, courseId, t])

  // Set initial selected scope once options are available
  const initialScopeSet = useMemo(() => {
    if (!selectedScopeKey && embedScopeOptions.length > 0) {
      return embedScopeOptions[0]?.scopeKey ?? `course:${courseId}`
    }
    return null
  }, [selectedScopeKey, embedScopeOptions, courseId])

  if (initialScopeSet && !selectedScopeKey) {
    setSelectedScopeKey(initialScopeSet)
  }

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

  if (loadingOverview || loadingScopes) {
    return (
      <div className="px-1 py-2">
        <Loader />
      </div>
    )
  }

  const groups = overviewData?.courseDiscussionOverview?.groups ?? []

  return (
    <div className="flex flex-col gap-4 px-1 py-2">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <H3 className={{ root: 'mb-2 mt-0' }}>{t('manage.course.embedLinkGenerator')}</H3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700" htmlFor="embed-scope-select">
              {t('manage.course.scopeLabel')}
            </label>
            <select
              id="embed-scope-select"
              value={selectedScopeKey}
              onChange={(event) => setSelectedScopeKey(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {embedScopeOptions.map((scope) => (
                <option key={scope.scopeKey} value={scope.scopeKey}>
                  {scope.scopeLabel} ({scope.sourceLabel})
                </option>
              ))}
            </select>
            {scopeOptions.filter((s) => s.spaceType === 'COURSE').length === 0 && (
              <div className="mt-1 text-xs text-amber-700">
                {t('manage.course.noPersistentScope')}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700" htmlFor="embed-token-lifetime">
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
                    Math.min(336, Number.parseInt(event.target.value || '1', 10))
                  )
                )
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700" htmlFor="embed-allow-anonymous">
              <input
                id="embed-allow-anonymous"
                type="checkbox"
                checked={allowAnonymous}
                onChange={(event) => setAllowAnonymous(event.target.checked)}
              />
              {t('manage.course.allowAnonymousPosting')}
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            primary
            loading={loadingEmbed}
            disabled={!selectedScopeKey || loadingEmbed}
            onClick={async () => {
              const selectedScope = embedScopeOptions.find(
                (scope) => scope.scopeKey === selectedScopeKey
              )

              try {
                const result = await generateEmbedInfo({
                  variables: {
                    courseId,
                    scope: parseScopeKeyToInput(courseId, selectedScopeKey),
                    scopeLabel: selectedScope?.scopeLabel,
                    allowAnonymous,
                    expiresInHours,
                  },
                })

                if (!result.data?.getCourseDiscussionEmbeddingInfo?.embedUrl) {
                  toast({
                    type: 'error',
                    message: t('manage.course.embedGenFailed'),
                  })
                }
              } catch {
                toast({
                  type: 'error',
                  message: t('manage.course.embedGenFailed'),
                })
              }
            }}
            data={{ cy: 'course-qa-generate-embed' }}
          >
            <Button.Label>{t('manage.course.generateEmbedLink')}</Button.Label>
          </Button>

          <Button
            onClick={async () => {
              if (!embedData?.getCourseDiscussionEmbeddingInfo?.embedUrl) return

              try {
                await navigator.clipboard.writeText(
                  embedData.getCourseDiscussionEmbeddingInfo.embedUrl
                )
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
            disabled={!embedData?.getCourseDiscussionEmbeddingInfo?.embedUrl}
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

        {embedData?.getCourseDiscussionEmbeddingInfo?.embedUrl && (
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
            <div className="mb-1 font-semibold text-gray-700">{t('manage.course.embedUrl')}</div>
            <div className="break-all text-gray-800">
              {embedData.getCourseDiscussionEmbeddingInfo.embedUrl}
            </div>
            <div className="mt-1 text-gray-600">
              {t('manage.course.expiresAt', {
                date: dayjs(embedData.getCourseDiscussionEmbeddingInfo.expiresAt).format(
                  'DD.MM.YYYY HH:mm'
                ),
              })}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <H3 className={{ root: 'mb-2 mt-0' }}>{t('manage.course.discussionOverview')}</H3>

        {groups.length === 0 ? (
          <UserNotification
            type="info"
            message={t('manage.course.noThreadsYet')}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.sourceKey} className="rounded-md border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold">
                  {group.sourceLabel}
                </div>
                <div className="flex flex-col gap-2 p-3">
                  {group.threads.map((thread) => (
                    <div key={thread.id} className="rounded-md border border-gray-100 p-2">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                          {thread.scope?.scopeLabel ?? thread.scope?.scopeKey}
                        </span>
                        <span>
                          {dayjs(thread.lastActivityAt).format('DD.MM.YYYY HH:mm')}
                        </span>
                        <span className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faThumbsUp} className="text-gray-500" />
                          {thread.upvotes}
                        </span>
                        <span>{`${thread.replyCount} ${thread.replyCount === 1 ? 'reply' : 'replies'}`}</span>
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
