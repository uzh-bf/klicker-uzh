import { useLazyQuery, useQuery } from '@apollo/client'
import {
  GetCourseDiscussionEmbeddingInfoDocument,
  GetCourseDiscussionOverviewDocument,
  GetCourseDiscussionScopesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification, toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'

type CourseDiscussionScopeInput = {
  scopeType:
    | 'COURSE'
    | 'PRACTICE_QUIZ'
    | 'PRACTICE_STACK'
    | 'PRACTICE_ELEMENT'
    | 'EXTERNAL_BLOCK'
  practiceQuizId?: string
  stackId?: number
  instanceId?: number
  externalSource?: string
  externalRef?: string
}

function parseScopeKeyToInput(
  courseId: string,
  scopeKey?: string | null
): CourseDiscussionScopeInput {
  if (!scopeKey || scopeKey === `course:${courseId}`) {
    return {
      scopeType: 'COURSE',
    }
  }

  const practiceElementMatch = scopeKey.match(
    /^pq:([^:]+):stack:(\d+):instance:(\d+)$/
  )
  if (practiceElementMatch) {
    return {
      scopeType: 'PRACTICE_ELEMENT',
      practiceQuizId: practiceElementMatch[1],
      stackId: Number.parseInt(practiceElementMatch[2] ?? '', 10),
      instanceId: Number.parseInt(practiceElementMatch[3] ?? '', 10),
    }
  }

  const practiceStackMatch = scopeKey.match(/^pq:([^:]+):stack:(\d+)$/)
  if (practiceStackMatch) {
    return {
      scopeType: 'PRACTICE_STACK',
      practiceQuizId: practiceStackMatch[1],
      stackId: Number.parseInt(practiceStackMatch[2] ?? '', 10),
    }
  }

  const practiceQuizMatch = scopeKey.match(/^pq:([^:]+)$/)
  if (practiceQuizMatch) {
    return {
      scopeType: 'PRACTICE_QUIZ',
      practiceQuizId: practiceQuizMatch[1],
    }
  }

  const externalMatch = scopeKey.match(/^ext:([^:]+):(.+)$/)
  if (externalMatch) {
    return {
      scopeType: 'EXTERNAL_BLOCK',
      externalSource: decodeURIComponent(externalMatch[1] ?? ''),
      externalRef: decodeURIComponent(externalMatch[2] ?? ''),
    }
  }

  return {
    scopeType: 'COURSE',
  }
}

function CourseDiscussionOverview({
  courseId,
  isCourseQAEnabled,
}: {
  courseId: string
  isCourseQAEnabled: boolean
}) {
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
  const baseEmbedScopeOptions = scopeOptions.filter(
    (scope) => scope.spaceType === 'COURSE'
  )
  const embedScopeOptions =
    baseEmbedScopeOptions.length > 0
      ? baseEmbedScopeOptions
      : [
          {
            scopeKey: `course:${courseId}`,
            scopeLabel: 'Course',
            sourceLabel: 'Course',
            spaceType: 'COURSE' as const,
          },
        ]

  useEffect(() => {
    if (!selectedScopeKey && embedScopeOptions.length > 0) {
      setSelectedScopeKey(
        embedScopeOptions[0]?.scopeKey ?? `course:${courseId}`
      )
    }
  }, [courseId, embedScopeOptions, selectedScopeKey])

  if (!isCourseQAEnabled) {
    return (
      <div className="px-1 py-2">
        <UserNotification
          type="info"
          message="Course Q&A is currently disabled. Enable it in course settings to activate discussion features."
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
        <H3 className={{ root: 'mb-2 mt-0' }}>Embed Link Generator</H3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              Scope
            </label>
            <select
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
            {baseEmbedScopeOptions.length === 0 && (
              <div className="mt-1 text-xs text-amber-700">
                No persisted course scope found yet. A default course scope token
                will be generated.
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              Token Lifetime (hours)
            </label>
            <input
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
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={allowAnonymous}
                onChange={(event) => setAllowAnonymous(event.target.checked)}
              />
              Allow anonymous posting
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
                    message: 'Failed to generate embedding information.',
                  })
                }
              } catch {
                toast({
                  type: 'error',
                  message: 'Failed to generate embedding information.',
                })
              }
            }}
            data={{ cy: 'course-qa-generate-embed' }}
          >
            <Button.Label>Generate Embed Link</Button.Label>
          </Button>

          <Button
            onClick={async () => {
              if (!embedData?.getCourseDiscussionEmbeddingInfo?.embedUrl) return

              await navigator.clipboard.writeText(
                embedData.getCourseDiscussionEmbeddingInfo.embedUrl
              )
              toast({
                type: 'success',
                message: 'Embed URL copied to clipboard.',
              })
            }}
            disabled={!embedData?.getCourseDiscussionEmbeddingInfo?.embedUrl}
            data={{ cy: 'course-qa-copy-embed' }}
          >
            <Button.Label>Copy URL</Button.Label>
          </Button>

          <Button
            onClick={async () => {
              await refetchOverview()
            }}
            data={{ cy: 'course-qa-refresh-overview' }}
          >
            <Button.Label>Refresh Overview</Button.Label>
          </Button>
        </div>

        {embedData?.getCourseDiscussionEmbeddingInfo?.embedUrl && (
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
            <div className="mb-1 font-semibold text-gray-700">Embed URL</div>
            <div className="break-all text-gray-800">
              {embedData.getCourseDiscussionEmbeddingInfo.embedUrl}
            </div>
            <div className="mt-1 text-gray-600">
              Expires:{' '}
              {dayjs(embedData.getCourseDiscussionEmbeddingInfo.expiresAt).format(
                'DD.MM.YYYY HH:mm'
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <H3 className={{ root: 'mb-2 mt-0' }}>Discussion Overview</H3>

        {groups.length === 0 ? (
          <UserNotification
            type="info"
            message="No threads available yet in this course."
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
                        <span>{`👍 ${thread.upvotes}`}</span>
                        <span>{`${thread.replyCount} replies`}</span>
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
