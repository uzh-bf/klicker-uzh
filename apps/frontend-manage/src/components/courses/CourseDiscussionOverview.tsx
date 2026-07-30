import { useMutation, useQuery } from '@apollo/client'
import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { faChevronDown, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteCourseDiscussionReplyDocument,
  DeleteCourseDiscussionThreadDocument,
  DiscussionSort,
  GetCourseDiscussionOverviewDocument,
  type GetCourseDiscussionOverviewQuery,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  getDiscussionScopeDisplayLabel,
  getDiscussionSourceDisplayLabel,
} from '@klicker-uzh/shared-components/src/discussionUtils'
import {
  Button,
  H3,
  Modal,
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import CourseDiscussionEmbedGenerator from './CourseDiscussionEmbedGenerator'

type PendingDeletion =
  | { type: 'thread'; id: number }
  | { type: 'reply'; id: number }

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
  const [loadingMore, setLoadingMore] = useState(false)
  const [pagination, setPagination] = useState<OverviewPagination | null>(null)
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingDeletion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const loadingMoreRef = useRef(false)
  const [deleteThread] = useMutation(DeleteCourseDiscussionThreadDocument)
  const [deleteReply] = useMutation(DeleteCourseDiscussionReplyDocument)

  const {
    data: overviewData,
    loading: loadingOverview,
    error: overviewError,
    refetch: refetchOverview,
    fetchMore,
    startPolling,
    stopPolling,
  } = useQuery(GetCourseDiscussionOverviewDocument, {
    variables: {
      courseId,
      sort: DiscussionSort.ActivityDesc,
      limit: 20,
    },
    skip: !isCourseQAEnabled,
    pollInterval: pagination ? 0 : 20000,
    fetchPolicy: 'cache-and-network',
  })

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
  const courseDisplayLabel = t('shared.generic.course')
  const scopeDisplayLabels = {
    course: courseDisplayLabel,
    practiceStack: (number: number) =>
      t('shared.generic.practiceStackN', { number }),
    microlearningStack: (number: number) =>
      t('shared.generic.microlearningStackN', { number }),
  }
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
    stopPolling()

    try {
      const result = await fetchMore({
        variables: { cursor: nextCursor },
      })
      const nextPage = result.data?.courseDiscussionOverview
      if (!nextPage) {
        startPolling(20000)
        return
      }

      setPagination((previous) => ({
        groups: mergeOverviewGroups(previous?.groups ?? [], nextPage.groups),
        nextCursor: nextPage.nextCursor ?? null,
        hasMore: nextPage.hasMore,
      }))
    } catch {
      startPolling(20000)
      toast({
        type: 'error',
        message: t('shared.generic.systemError'),
      })
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [
    fetchMore,
    hasMore,
    loadingOverview,
    nextCursor,
    startPolling,
    stopPolling,
    t,
  ])

  const handleRefresh = useCallback(async () => {
    if (loadingMoreRef.current) return

    try {
      await refetchOverview()
      setPagination(null)
    } catch {
      toast({
        type: 'error',
        message: t('shared.generic.systemError'),
      })
    }
  }, [refetchOverview, t])

  const handleConfirmDeletion = useCallback(async () => {
    if (!pendingDeletion) return

    setDeleting(true)

    try {
      const succeeded =
        pendingDeletion.type === 'thread'
          ? (
              await deleteThread({
                variables: { threadId: pendingDeletion.id },
              })
            ).data?.deleteCourseDiscussionThread
          : (await deleteReply({ variables: { replyId: pendingDeletion.id } }))
              .data?.deleteCourseDiscussionReply

      if (!succeeded) {
        toast({
          type: 'error',
          message:
            pendingDeletion.type === 'thread'
              ? t('pwa.courseQA.deleteThreadFailed')
              : t('pwa.courseQA.deleteReplyFailed'),
        })
        return
      }

      setPendingDeletion(null)
      await handleRefresh()
    } catch {
      toast({
        type: 'error',
        message: t('pwa.courseQA.deleteError'),
      })
    } finally {
      setDeleting(false)
    }
  }, [pendingDeletion, deleteThread, deleteReply, handleRefresh, t])

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
  return (
    <div className="flex flex-col gap-4 px-1 py-2">
      <section>
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
                  {getDiscussionSourceDisplayLabel({
                    sourceKey: group.sourceKey,
                    sourceLabel: group.sourceLabel,
                    courseLabel: courseDisplayLabel,
                  })}
                </div>
                <div className="divide-y divide-gray-100">
                  {group.threads.map((thread) => (
                    <details
                      key={thread.id}
                      className="group"
                      data-cy={`course-qa-overview-thread-${thread.id}`}
                    >
                      <summary
                        className="focus-visible:outline-primary-100 flex cursor-pointer list-none items-start gap-3 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        data-cy={`course-qa-overview-thread-toggle-${thread.id}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                            <span className="max-w-full break-words rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                              {getDiscussionScopeDisplayLabel(
                                thread.scope,
                                scopeDisplayLabels
                              )}
                            </span>
                            <span>{formatDateTime(thread.lastActivityAt)}</span>
                            <span
                              className="flex items-center gap-1"
                              aria-hidden="true"
                            >
                              <FontAwesomeIcon
                                icon={faThumbsUp}
                                className="text-gray-500"
                              />
                              {thread.upvotes}
                            </span>
                            <span className="sr-only">
                              {t('pwa.courseQA.threadUpvoteCountAriaLabel', {
                                count: thread.upvotes,
                              })}
                            </span>
                            <span>
                              {t('pwa.courseQA.nReply', {
                                count: thread.replyCount,
                              })}
                            </span>
                          </span>
                          <span
                            className="line-clamp-2 whitespace-pre-wrap break-words text-sm group-open:line-clamp-none"
                            data-cy={`course-qa-overview-thread-content-${thread.id}`}
                          >
                            {thread.content}
                          </span>
                        </span>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className="mt-1 shrink-0 text-gray-500 group-open:rotate-180 motion-safe:transition-transform"
                          aria-hidden="true"
                        />
                      </summary>

                      {(thread.replies.length > 0 || thread.canDelete) && (
                        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
                          {thread.replies.length > 0 && (
                            <div className="divide-y divide-gray-200">
                              {thread.replies.map((reply) => (
                                <div
                                  key={reply.id}
                                  className="py-2 first:pt-1 last:pb-1"
                                  data-cy={`course-qa-overview-reply-${reply.id}`}
                                >
                                  <div className="whitespace-pre-wrap break-words text-sm">
                                    {reply.content}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                    <span>
                                      {formatDateTime(reply.createdAt)}
                                    </span>
                                    <span
                                      className="flex items-center gap-1"
                                      aria-hidden="true"
                                    >
                                      <FontAwesomeIcon icon={faThumbsUp} />
                                      {reply.upvotes}
                                    </span>
                                    <span className="sr-only">
                                      {t(
                                        'pwa.courseQA.replyUpvoteCountAriaLabel',
                                        {
                                          count: reply.upvotes,
                                        }
                                      )}
                                    </span>
                                    {reply.canDelete && (
                                      <Button
                                        onClick={() =>
                                          setPendingDeletion({
                                            type: 'reply',
                                            id: reply.id,
                                          })
                                        }
                                        className={{ root: 'h-6 text-red-600' }}
                                        data={{
                                          cy: `course-qa-overview-delete-reply-${reply.id}`,
                                        }}
                                        aria-label={t(
                                          'pwa.courseQA.deleteReply'
                                        )}
                                      >
                                        <Button.Icon
                                          icon={faTrash}
                                          className={{ root: 'h-3 w-3' }}
                                        />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {thread.canDelete && (
                            <div className="flex justify-end pt-2">
                              <Button
                                onClick={() =>
                                  setPendingDeletion({
                                    type: 'thread',
                                    id: thread.id,
                                  })
                                }
                                className={{ root: 'h-7 text-red-600' }}
                                data={{
                                  cy: `course-qa-overview-delete-thread-${thread.id}`,
                                }}
                              >
                                <Button.Icon icon={faTrash} />
                                <Button.Label>
                                  {t('pwa.courseQA.deleteThread')}
                                </Button.Label>
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </details>
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
      </section>

      <CourseDiscussionEmbedGenerator
        courseId={courseId}
        isCourseQAAnonymousEnabled={isCourseQAAnonymousEnabled}
      />

      {pendingDeletion ? (
        <Modal
          open
          hideCloseButton
          onClose={() => setPendingDeletion(null)}
          title={
            pendingDeletion.type === 'thread'
              ? t('pwa.courseQA.deleteThreadTitle')
              : t('pwa.courseQA.deleteReplyTitle')
          }
          secondaryLabel={t('shared.generic.cancel')}
          onSecondaryAction={() => setPendingDeletion(null)}
          primaryLabel={t('pwa.courseQA.deleteConfirm')}
          primaryButtonStyle="destructive"
          primaryLoading={deleting}
          onPrimaryAction={handleConfirmDeletion}
          className={{ content: 'max-w-lg' }}
          dataPrimaryAction={{ cy: 'course-qa-overview-confirm-deletion' }}
          dataSecondaryAction={{ cy: 'course-qa-overview-cancel-deletion' }}
        >
          <p className="text-base">
            {pendingDeletion.type === 'thread'
              ? t('pwa.courseQA.deleteThreadMessage')
              : t('pwa.courseQA.deleteReplyMessage')}
          </p>
        </Modal>
      ) : null}
    </div>
  )
}

export default CourseDiscussionOverview
