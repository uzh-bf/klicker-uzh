import { useMutation, useQuery } from '@apollo/client'
import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import type { GetBasicCourseInformationQuery } from '@klicker-uzh/graphql/dist/ops'
import {
  CreateCourseDiscussionReplyDocument,
  CreateCourseDiscussionThreadDocument,
  DiscussionSort,
  GetCourseDiscussionThreadsDocument,
  ToggleCourseDiscussionReplyUpvoteDocument,
  ToggleCourseDiscussionThreadUpvoteDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  getDiscussionScopeDisplayLabel,
  getDiscussionSourceDisplayLabel,
  parseScopeKeyToInput,
} from '@klicker-uzh/shared-components/src/discussionUtils'
import { Button, H2, UserNotification, toast } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type BasicCourseInformation = NonNullable<
  GetBasicCourseInformationQuery['basicCourseInformation']
>

interface CourseDiscussionPanelProps {
  courseId: string
  scopeKey?: string
  embedToken?: string
  embedded?: boolean
  course?: BasicCourseInformation | null
  className?: string
  compact?: boolean
  showTitle?: boolean
  idPrefix?: string
}

function getCourseDiscussionScopeKey(courseId: string, scopeKey?: string) {
  if (scopeKey) {
    return scopeKey
  }

  return `course:${courseId}`
}

function CourseDiscussionPanel({
  courseId,
  scopeKey,
  embedToken,
  embedded = false,
  course,
  className,
  compact = false,
  showTitle = true,
  idPrefix = 'course-qa',
}: CourseDiscussionPanelProps) {
  const t = useTranslations()
  const formatter = useFormatter()

  const [threadDraft, setThreadDraft] = useState('')
  const [postThreadAnonymous, setPostThreadAnonymous] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [postReplyAnonymous, setPostReplyAnonymous] = useState<
    Record<number, boolean>
  >({})
  const [replyingThreadId, setReplyingThreadId] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)

  const activeScopeKey = useMemo(
    () => getCourseDiscussionScopeKey(courseId, scopeKey),
    [courseId, scopeKey]
  )

  const {
    data: threadsData,
    loading: loadingThreads,
    error: threadsError,
    refetch: refetchThreads,
    fetchMore,
    startPolling,
    stopPolling,
  } = useQuery(GetCourseDiscussionThreadsDocument, {
    variables: {
      courseId,
      scopeKey: activeScopeKey,
      sort: DiscussionSort.ActivityDesc,
      limit: 20,
      embedToken,
    },
    skip: !courseId,
    fetchPolicy: 'cache-and-network',
  })

  const [createThread, { loading: creatingThread }] = useMutation(
    CreateCourseDiscussionThreadDocument
  )
  const [createReply] = useMutation(CreateCourseDiscussionReplyDocument)
  const [toggleThreadUpvote] = useMutation(
    ToggleCourseDiscussionThreadUpvoteDocument
  )
  const [toggleReplyUpvote] = useMutation(
    ToggleCourseDiscussionReplyUpvoteDocument
  )

  const parsedScopeInput = parseScopeKeyToInput(courseId, activeScopeKey)
  const canCreateThreadForActiveScope = useMemo(() => {
    if (!parsedScopeInput) return false
    if (activeScopeKey === `course:${courseId}`) return true
    if (activeScopeKey.startsWith('stack:')) return true
    if (activeScopeKey.startsWith('ext:') && embedded && !!embedToken) {
      return true
    }

    return false
  }, [activeScopeKey, courseId, embedded, embedToken, parsedScopeInput])

  const threads = threadsData?.courseDiscussionThreads?.threads ?? []
  const localizedThreads = threads.map((thread) => {
    const scopeDisplayLabel = getDiscussionScopeDisplayLabel(thread.scope, {
      course: t('shared.generic.course'),
      stack: (number) => t('shared.generic.stackN', { number }),
    })

    return {
      ...thread,
      scopeDisplayLabel,
      sourceDisplayLabel: getDiscussionSourceDisplayLabel({
        sourceKey: thread.sourceKey,
        sourceLabel: thread.sourceLabel,
        courseLabel: t('shared.generic.course'),
      }),
    }
  })
  const hasMore = threadsData?.courseDiscussionThreads?.hasMore ?? false
  const nextCursor = threadsData?.courseDiscussionThreads?.nextCursor ?? null
  const canPostAnonymously =
    threadsData?.courseDiscussionThreads?.canPostAnonymously ?? false
  const isAccessible =
    threadsData?.courseDiscussionThreads?.isAccessible ?? true

  useEffect(() => {
    if (canPostAnonymously) return

    setPostThreadAnonymous(false)
    setPostReplyAnonymous({})
  }, [canPostAnonymously])

  useEffect(() => {
    startPolling(30000)

    return () => stopPolling()
  }, [activeScopeKey, courseId, embedToken, startPolling, stopPolling])

  const handleCreateThread = useCallback(async () => {
    if (
      !threadDraft.trim() ||
      !canCreateThreadForActiveScope ||
      !parsedScopeInput
    ) {
      return
    }

    try {
      const result = await createThread({
        variables: {
          input: {
            courseId,
            content: threadDraft,
            scope: parsedScopeInput,
            isAnonymous: postThreadAnonymous,
            embedToken,
          },
        },
      })

      if (!result.data?.createCourseDiscussionThread) {
        toast({
          type: 'error',
          message: t('pwa.courseQA.threadPostFailed'),
        })
        return
      }

      setThreadDraft('')
      setPostThreadAnonymous(false)
      await refetchThreads()
    } catch {
      toast({
        type: 'error',
        message: t('pwa.courseQA.threadPostError'),
      })
    }
  }, [
    threadDraft,
    createThread,
    courseId,
    parsedScopeInput,
    postThreadAnonymous,
    embedToken,
    canCreateThreadForActiveScope,
    refetchThreads,
    t,
  ])

  const handleCreateReply = useCallback(
    async (threadId: number) => {
      const content = replyDrafts[threadId]?.trim()
      if (!content) return

      setReplyingThreadId(threadId)

      try {
        const result = await createReply({
          variables: {
            input: {
              courseId,
              threadId,
              content,
              isAnonymous: postReplyAnonymous[threadId] ?? false,
              embedToken,
            },
          },
        })

        if (!result.data?.createCourseDiscussionReply) {
          toast({
            type: 'error',
            message: t('pwa.courseQA.replyPostFailed'),
          })
          return
        }

        setReplyDrafts((prev) => ({
          ...prev,
          [threadId]: '',
        }))
        setPostReplyAnonymous((prev) => ({
          ...prev,
          [threadId]: false,
        }))
        await refetchThreads()
      } catch {
        toast({
          type: 'error',
          message: t('pwa.courseQA.replyPostError'),
        })
      } finally {
        setReplyingThreadId(null)
      }
    },
    [
      replyDrafts,
      postReplyAnonymous,
      createReply,
      courseId,
      embedToken,
      refetchThreads,
      t,
    ]
  )

  const handleToggleThreadUpvote = useCallback(
    async (threadId: number, hasUpvoted?: boolean | null) => {
      try {
        await toggleThreadUpvote({
          variables: {
            threadId,
            upvote: !hasUpvoted,
          },
        })
      } catch {
        toast({
          type: 'error',
          message: t('pwa.courseQA.upvoteFailed'),
        })
      }
    },
    [toggleThreadUpvote, t]
  )

  const handleToggleReplyUpvote = useCallback(
    async (replyId: number, hasUpvoted?: boolean | null) => {
      try {
        await toggleReplyUpvote({
          variables: {
            replyId,
            upvote: !hasUpvoted,
          },
        })
      } catch {
        toast({
          type: 'error',
          message: t('pwa.courseQA.upvoteFailed'),
        })
      }
    },
    [toggleReplyUpvote, t]
  )

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || !hasMore || loadingMoreRef.current) return

    loadingMoreRef.current = true
    setLoadingMore(true)

    try {
      await fetchMore({
        variables: { cursor: nextCursor },
        updateQuery: (previous, { fetchMoreResult }) => {
          if (!fetchMoreResult) return previous

          const existingIds = new Set(
            previous.courseDiscussionThreads.threads.map((thread) => thread.id)
          )

          return {
            ...previous,
            courseDiscussionThreads: {
              ...fetchMoreResult.courseDiscussionThreads,
              threads: [
                ...previous.courseDiscussionThreads.threads,
                ...fetchMoreResult.courseDiscussionThreads.threads.filter(
                  (thread) => !existingIds.has(thread.id)
                ),
              ],
            },
          }
        },
      })
      stopPolling()
    } catch {
      toast({
        type: 'error',
        message: t('shared.generic.systemError'),
      })
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [nextCursor, hasMore, fetchMore, stopPolling, t])

  if (loadingThreads) {
    return <Loader />
  }

  if (threadsError) {
    return (
      <UserNotification
        type="error"
        message={t('shared.generic.systemError')}
      />
    )
  }

  if (!embedded && course?.isCourseQARolloutEnabled === false) {
    return (
      <UserNotification
        type="warning"
        message={t('pwa.courseQA.accessDenied')}
        data={{ cy: 'course-qa-access-denied' }}
      />
    )
  }

  if (
    !embedded &&
    course?.isCourseQARolloutEnabled === true &&
    course?.isCourseQAEnabled === false
  ) {
    return (
      <UserNotification
        type="info"
        message={t('pwa.courseQA.disabled')}
        data={{ cy: 'course-qa-disabled-notice' }}
      />
    )
  }

  if (!isAccessible) {
    return (
      <UserNotification
        type="warning"
        message={t('pwa.courseQA.accessDenied')}
        data={{ cy: 'course-qa-access-denied' }}
      />
    )
  }

  const threadInputId = `${idPrefix}-thread-content`
  const formatDateTime = (value: string) =>
    formatter.dateTime(new Date(value), {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

  return (
    <div
      className={twMerge(
        'mx-auto flex w-full max-w-5xl flex-col gap-4',
        compact && 'mx-0 max-w-none gap-3',
        className
      )}
    >
      <div
        className={twMerge(
          'rounded-lg border border-gray-200 bg-white p-4 shadow-sm',
          compact && 'p-3'
        )}
      >
        {showTitle && (
          <H2 className={{ root: 'mb-2' }}>{t('pwa.courseQA.title')}</H2>
        )}

        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-semibold text-gray-700"
            htmlFor={threadInputId}
          >
            {t('pwa.courseQA.newThread')}
          </label>
          <textarea
            id={threadInputId}
            name={threadInputId}
            rows={3}
            maxLength={4000}
            value={threadDraft}
            onChange={(event) => setThreadDraft(event.target.value)}
            autoComplete="off"
            placeholder={t('pwa.courseQA.threadPlaceholder')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            aria-label={t('pwa.courseQA.newThread')}
            data-cy="course-qa-thread-input"
          />

          {embedToken && canPostAnonymously && (
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                name={`${idPrefix}-thread-anonymous`}
                type="checkbox"
                checked={postThreadAnonymous}
                onChange={(event) =>
                  setPostThreadAnonymous(event.target.checked)
                }
                data-cy="course-qa-thread-anonymous"
              />
              {t('pwa.courseQA.postAnonymously')}
            </label>
          )}

          <div className="flex justify-end">
            <Button
              primary
              loading={creatingThread}
              disabled={
                creatingThread ||
                threadDraft.trim().length === 0 ||
                !canCreateThreadForActiveScope ||
                !parsedScopeInput
              }
              onClick={handleCreateThread}
              data={{ cy: 'course-qa-create-thread' }}
            >
              <Button.Label>{t('pwa.courseQA.postThread')}</Button.Label>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3" data-cy="course-qa-threads-list">
        {threads.length === 0 ? (
          <UserNotification
            type="info"
            message={t('pwa.courseQA.noThreads')}
            data={{ cy: 'course-qa-empty' }}
          />
        ) : (
          localizedThreads.map((thread) => (
            <div
              key={thread.id}
              className={twMerge(
                'rounded-lg border border-gray-200 bg-white p-4 shadow-sm',
                compact && 'p-3'
              )}
              data-cy={`course-qa-thread-${thread.id}`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                {thread.sourceDisplayLabel &&
                  thread.sourceDisplayLabel !== thread.scopeDisplayLabel && (
                    <span className="max-w-full break-words rounded-full bg-gray-100 px-2 py-0.5">
                      {thread.sourceDisplayLabel}
                    </span>
                  )}
                <span className="max-w-full break-words rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                  {thread.scopeDisplayLabel}
                </span>
                <span>{formatDateTime(thread.createdAt)}</span>
              </div>

              <div
                className="whitespace-pre-wrap break-words text-sm"
                data-cy={`course-qa-thread-content-${thread.id}`}
              >
                {thread.content}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  onClick={() =>
                    handleToggleThreadUpvote(thread.id, thread.hasUpvoted)
                  }
                  active={!!thread.hasUpvoted}
                  className={{
                    root: 'h-8 motion-safe:transition-transform motion-safe:hover:scale-105',
                  }}
                  data={{ cy: `course-qa-thread-upvote-${thread.id}` }}
                  aria-label={t('pwa.courseQA.threadUpvoteAriaLabel', {
                    count: thread.upvotes,
                  })}
                >
                  <Button.Icon icon={faThumbsUp} />
                  <Button.Label>{String(thread.upvotes)}</Button.Label>
                </Button>
                <span className="text-xs text-gray-500">
                  {t('pwa.courseQA.nReply', { count: thread.replyCount })}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-2 border-l border-gray-200 pl-3">
                {thread.replies?.map((reply) => (
                  <div
                    key={reply.id}
                    className="rounded-md bg-gray-50 p-2"
                    data-cy={`course-qa-reply-${reply.id}`}
                  >
                    <div
                      className="mb-1 whitespace-pre-wrap break-words text-sm"
                      data-cy={`course-qa-reply-content-${reply.id}`}
                    >
                      {reply.content}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">
                        {formatDateTime(reply.createdAt)}
                      </span>
                      <Button
                        onClick={() =>
                          handleToggleReplyUpvote(reply.id, reply.hasUpvoted)
                        }
                        active={!!reply.hasUpvoted}
                        className={{
                          root: 'h-7 motion-safe:transition-transform motion-safe:hover:scale-105',
                        }}
                        data={{ cy: `course-qa-reply-upvote-${reply.id}` }}
                        aria-label={t('pwa.courseQA.replyUpvoteAriaLabel', {
                          count: reply.upvotes,
                        })}
                      >
                        <Button.Icon
                          icon={faThumbsUp}
                          className={{ root: 'h-3 w-3' }}
                        />
                        <Button.Label>{String(reply.upvotes)}</Button.Label>
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="mt-1 rounded-md border border-gray-200 p-2">
                  <textarea
                    name={`${idPrefix}-reply-content-${thread.id}`}
                    rows={2}
                    maxLength={4000}
                    value={replyDrafts[thread.id] ?? ''}
                    onChange={(event) =>
                      setReplyDrafts((prev) => ({
                        ...prev,
                        [thread.id]: event.target.value,
                      }))
                    }
                    autoComplete="off"
                    placeholder={t('pwa.courseQA.replyPlaceholder')}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                    aria-label={t('pwa.courseQA.replyPlaceholder')}
                    data-cy={`course-qa-reply-input-${thread.id}`}
                  />

                  {embedToken && canPostAnonymously && (
                    <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        name={`${idPrefix}-reply-anonymous-${thread.id}`}
                        type="checkbox"
                        checked={postReplyAnonymous[thread.id] ?? false}
                        onChange={(event) =>
                          setPostReplyAnonymous((prev) => ({
                            ...prev,
                            [thread.id]: event.target.checked,
                          }))
                        }
                        data-cy={`course-qa-reply-anonymous-${thread.id}`}
                      />
                      {t('pwa.courseQA.replyAnonymously')}
                    </label>
                  )}

                  <div className="mt-2 flex justify-end">
                    <Button
                      primary
                      loading={replyingThreadId === thread.id}
                      disabled={
                        replyingThreadId === thread.id ||
                        (replyDrafts[thread.id]?.trim().length ?? 0) === 0
                      }
                      onClick={() => handleCreateReply(thread.id)}
                      className={{ root: 'h-8' }}
                      data={{ cy: `course-qa-create-reply-${thread.id}` }}
                    >
                      <Button.Label>{t('pwa.courseQA.reply')}</Button.Label>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {hasMore && (
          <div className="flex justify-center">
            <Button
              onClick={handleLoadMore}
              loading={loadingMore}
              disabled={loadingMore}
              data={{ cy: 'course-qa-load-more' }}
            >
              <Button.Label>{t('pwa.courseQA.loadMore')}</Button.Label>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CourseDiscussionPanel
