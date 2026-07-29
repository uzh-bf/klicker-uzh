import { useMutation, useQuery } from '@apollo/client'
import {
  CreateCourseDiscussionThreadDocument,
  DiscussionSort,
  GetCourseDiscussionThreadsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  getDiscussionScopeDisplayLabel,
  getDiscussionSourceDisplayLabel,
  parseScopeKeyToInput,
} from '@klicker-uzh/shared-components/src/discussionUtils'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

interface UseCourseDiscussionOptions {
  courseId: string
  scopeKey?: string
  embedToken?: string
  embedded: boolean
}

function getCourseDiscussionScopeKey(courseId: string, scopeKey?: string) {
  return scopeKey || `course:${courseId}`
}

function useCourseDiscussion({
  courseId,
  scopeKey,
  embedToken,
  embedded,
}: UseCourseDiscussionOptions) {
  const t = useTranslations()
  const [threadDraft, setThreadDraft] = useState('')
  const [postThreadAnonymous, setPostThreadAnonymous] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)

  const activeScopeKey = getCourseDiscussionScopeKey(courseId, scopeKey)
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
  const canCreateThreadForActiveScope =
    Boolean(parsedScopeInput) &&
    (activeScopeKey === `course:${courseId}` ||
      activeScopeKey.startsWith('stack:') ||
      (activeScopeKey.startsWith('ext:') && embedded && !!embedToken))

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
  const showComposer =
    canPost && canCreateThreadForActiveScope && Boolean(parsedScopeInput)

  useEffect(() => {
    if (canPostAnonymously) return

    setPostThreadAnonymous(false)
  }, [canPostAnonymously])

  useEffect(() => {
    startPolling(30000)

    return () => stopPolling()
  }, [activeScopeKey, courseId, embedToken, startPolling, stopPolling])

  const handleCreateThread = async () => {
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
  }

  const handleLoadMore = async () => {
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
  }

  return {
    localizedThreads,
    loadingThreads,
    threadsError,
    refetchThreads,
    hasMore,
    canPost,
    canVote,
    mustPostAnonymously,
    canChooseAnonymity,
    isAccessible,
    showComposer,
    threadDraft,
    setThreadDraft,
    postThreadAnonymous,
    setPostThreadAnonymous,
    creatingThread,
    handleCreateThread,
    loadingMore,
    handleLoadMore,
  }
}

export default useCourseDiscussion
