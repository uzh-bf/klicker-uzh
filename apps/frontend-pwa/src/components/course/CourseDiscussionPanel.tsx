import { useMutation, useQuery } from '@apollo/client'
import type { GetBasicCourseInformationQuery } from '@klicker-uzh/graphql/dist/ops'
import {
  CreateCourseDiscussionThreadDocument,
  DiscussionSort,
  GetCourseDiscussionThreadsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  getDiscussionScopeDisplayLabel,
  getDiscussionSourceDisplayLabel,
  parseScopeKeyToInput,
} from '@klicker-uzh/shared-components/src/discussionUtils'
import { Button, H2, UserNotification, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CourseDiscussionThreadCard from './CourseDiscussionThreadCard'

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

  const [threadDraft, setThreadDraft] = useState('')
  const [postThreadAnonymous, setPostThreadAnonymous] = useState(false)
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
  const courseDisplayLabel = t('shared.generic.course')
  const scopeDisplayLabels = {
    course: courseDisplayLabel,
    practiceStack: (number: number) =>
      t('shared.generic.practiceStackN', { number }),
    microlearningStack: (number: number) =>
      t('shared.generic.microlearningStackN', { number }),
  }
  const localizedThreads = threads.map((thread) => {
    const scopeDisplayLabel = getDiscussionScopeDisplayLabel(
      thread.scope,
      scopeDisplayLabels
    )

    return {
      ...thread,
      scopeDisplayLabel,
      sourceDisplayLabel: getDiscussionSourceDisplayLabel({
        sourceKey: thread.sourceKey,
        sourceLabel: thread.sourceLabel,
        courseLabel: courseDisplayLabel,
      }),
    }
  })
  const hasMore = threadsData?.courseDiscussionThreads?.hasMore ?? false
  const nextCursor = threadsData?.courseDiscussionThreads?.nextCursor ?? null
  const canPostAnonymously =
    threadsData?.courseDiscussionThreads?.canPostAnonymously ?? false
  const canPostIdentified =
    threadsData?.courseDiscussionThreads?.canPostIdentified ?? false
  const canPost = canPostIdentified || canPostAnonymously
  const canVote = canPostIdentified
  const mustPostAnonymously = !canPostIdentified && canPostAnonymously
  const canChooseAnonymity = canPostIdentified && canPostAnonymously
  const isAccessible =
    threadsData?.courseDiscussionThreads?.isAccessible ?? true

  useEffect(() => {
    if (canPostAnonymously) return

    setPostThreadAnonymous(false)
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
            isAnonymous:
              mustPostAnonymously ||
              (canChooseAnonymity && postThreadAnonymous),
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
    canChooseAnonymity,
    mustPostAnonymously,
    embedToken,
    canCreateThreadForActiveScope,
    refetchThreads,
    t,
  ])

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
  const showComposer =
    canPost && canCreateThreadForActiveScope && Boolean(parsedScopeInput)

  return (
    <div
      className={twMerge(
        'mx-auto flex w-full max-w-5xl flex-col gap-4',
        compact && 'mx-0 max-w-none gap-3',
        className
      )}
    >
      {showTitle && !showComposer && (
        <H2 className={{ root: 'mb-2' }}>{t('pwa.courseQA.title')}</H2>
      )}

      {showComposer ? (
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

            {embedToken &&
              (canChooseAnonymity ? (
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
              ) : mustPostAnonymously ? (
                <p
                  className="text-sm text-gray-600"
                  data-cy="course-qa-thread-anonymous"
                >
                  {t('pwa.courseQA.postingAnonymously')}
                </p>
              ) : null)}

            <div className="flex justify-end">
              <Button
                primary
                loading={creatingThread}
                disabled={creatingThread || threadDraft.trim().length === 0}
                onClick={handleCreateThread}
                data={{ cy: 'course-qa-create-thread' }}
              >
                <Button.Label>{t('pwa.courseQA.postThread')}</Button.Label>
              </Button>
            </div>
          </div>
        </div>
      ) : embedded ? (
        <UserNotification
          type="info"
          message={t('pwa.courseQA.readOnly')}
          data={{ cy: 'course-qa-read-only' }}
        />
      ) : null}

      <div className="flex flex-col gap-3" data-cy="course-qa-threads-list">
        {threads.length === 0 ? (
          <UserNotification
            type="info"
            message={t('pwa.courseQA.noThreads')}
            data={{ cy: 'course-qa-empty' }}
          />
        ) : (
          localizedThreads.map((thread) => (
            <CourseDiscussionThreadCard
              key={thread.id}
              courseId={courseId}
              thread={thread}
              embedToken={embedToken}
              compact={compact}
              canPost={canPost}
              canVote={canVote}
              canChooseAnonymity={canChooseAnonymity}
              mustPostAnonymously={mustPostAnonymously}
              idPrefix={idPrefix}
              onReplyCreated={refetchThreads}
            />
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
