import { useMutation, useQuery } from '@apollo/client'
import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import {
  CreateCourseDiscussionReplyDocument,
  CreateCourseDiscussionThreadDocument,
  GetBasicCourseInformationDocument,
  GetCourseDiscussionThreadsDocument,
  ToggleCourseDiscussionReplyUpvoteDocument,
  ToggleCourseDiscussionThreadUpvoteDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { parseScopeKeyToInput } from '@klicker-uzh/shared-components/src/discussionUtils'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { Button, H2, UserNotification, toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import nookies from 'nookies'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '../../../components/Layout'
import Footer from '../../../components/common/Footer'

interface CourseDiscussionPageProps {
  courseId: string
  embedded: boolean
  participantToken?: string
  cookiesAvailable?: boolean
}

function getCourseDiscussionScopeKey(courseId: string, scopeKey?: string) {
  if (scopeKey) {
    return scopeKey
  }

  return `course:${courseId}`
}

function CourseDiscussionPage({
  courseId,
  embedded,
  participantToken,
  cookiesAvailable,
}: CourseDiscussionPageProps) {
  const t = useTranslations()
  const router = useRouter()

  const scopeKeyFromQuery =
    typeof router.query.scopeKey === 'string'
      ? router.query.scopeKey
      : undefined
  const embedToken =
    typeof router.query.embedToken === 'string'
      ? router.query.embedToken
      : undefined

  const [threadDraft, setThreadDraft] = useState('')
  const [postThreadAnonymous, setPostThreadAnonymous] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [postReplyAnonymous, setPostReplyAnonymous] = useState<
    Record<number, boolean>
  >({})
  const [replyingThreadId, setReplyingThreadId] = useState<number | null>(null)

  useParticipantToken({ participantToken, cookiesAvailable })

  const activeScopeKey = useMemo(
    () => getCourseDiscussionScopeKey(courseId, scopeKeyFromQuery),
    [courseId, scopeKeyFromQuery]
  )

  const {
    data: courseData,
    loading: loadingCourse,
    error: courseError,
  } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId },
    skip: !courseId || embedded,
  })

  const {
    data: threadsData,
    loading: loadingThreads,
    error: threadsError,
    refetch: refetchThreads,
    fetchMore,
  } = useQuery(GetCourseDiscussionThreadsDocument, {
    variables: {
      courseId,
      scopeKey: activeScopeKey,
      sort: 'ACTIVITY_DESC' as any,
      limit: 20,
      embedToken,
    },
    skip: !courseId,
    fetchPolicy: 'cache-and-network',
    pollInterval: 30000,
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
            scope: parsedScopeInput as any,
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
        await refetchThreads()
      } catch {
        toast({
          type: 'error',
          message: t('pwa.courseQA.upvoteFailed'),
        })
      }
    },
    [toggleThreadUpvote, refetchThreads, t]
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
        await refetchThreads()
      } catch {
        toast({
          type: 'error',
          message: t('pwa.courseQA.upvoteFailed'),
        })
      }
    },
    [toggleReplyUpvote, refetchThreads, t]
  )

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || !hasMore) return
    await fetchMore({
      variables: { cursor: nextCursor },
    })
  }, [nextCursor, hasMore, fetchMore])

  if (loadingCourse || loadingThreads) {
    return (
      <Layout embedded={embedded} displayName={t('pwa.courseQA.title')}>
        <Loader />
      </Layout>
    )
  }

  if (courseError || threadsError) {
    return (
      <Layout embedded={embedded} displayName={t('pwa.courseQA.title')}>
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  if (
    !embedded &&
    courseData?.basicCourseInformation?.isCourseQARolloutEnabled === false
  ) {
    return (
      <Layout
        embedded={embedded}
        course={courseData.basicCourseInformation}
        displayName={t('pwa.courseQA.title')}
      >
        <UserNotification
          type="warning"
          message={t('pwa.courseQA.accessDenied')}
        />
      </Layout>
    )
  }

  if (
    !embedded &&
    courseData?.basicCourseInformation?.isCourseQARolloutEnabled === true &&
    courseData?.basicCourseInformation?.isCourseQAEnabled === false
  ) {
    return (
      <Layout
        embedded={embedded}
        course={courseData.basicCourseInformation}
        displayName={t('pwa.courseQA.title')}
      >
        <UserNotification type="info" message={t('pwa.courseQA.disabled')} />
      </Layout>
    )
  }

  if (!isAccessible) {
    return (
      <Layout
        embedded={embedded}
        course={courseData?.basicCourseInformation ?? undefined}
        displayName={t('pwa.courseQA.title')}
      >
        <UserNotification
          type="warning"
          message={t('pwa.courseQA.accessDenied')}
        />
      </Layout>
    )
  }

  return (
    <Layout
      embedded={embedded}
      course={courseData?.basicCourseInformation ?? undefined}
      displayName={t('pwa.courseQA.title')}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <H2 className={{ root: 'mb-2' }}>{t('pwa.courseQA.title')}</H2>

          <div className="flex flex-col gap-2">
            <label
              className="text-sm font-semibold text-gray-700"
              htmlFor="qa-thread-content"
            >
              {t('pwa.courseQA.newThread')}
            </label>
            <textarea
              id="qa-thread-content"
              rows={3}
              maxLength={4000}
              value={threadDraft}
              onChange={(event) => setThreadDraft(event.target.value)}
              placeholder={t('pwa.courseQA.threadPlaceholder')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              aria-label={t('pwa.courseQA.newThread')}
            />

            {embedToken && canPostAnonymously && (
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={postThreadAnonymous}
                  onChange={(event) =>
                    setPostThreadAnonymous(event.target.checked)
                  }
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

        <div className="flex flex-col gap-3">
          {threads.length === 0 ? (
            <UserNotification
              type="info"
              message={t('pwa.courseQA.noThreads')}
            />
          ) : (
            threads.map((thread) => (
              <div
                key={thread.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {thread.sourceLabel && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">
                      {thread.sourceLabel}
                    </span>
                  )}
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                    {thread.scope?.scopeLabel ?? thread.scope?.scopeKey}
                  </span>
                  <span>
                    {dayjs(thread.createdAt).format('DD.MM.YYYY HH:mm')}
                  </span>
                </div>

                <div className="whitespace-pre-wrap text-sm">
                  {thread.content}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() =>
                      handleToggleThreadUpvote(thread.id, thread.hasUpvoted)
                    }
                    active={!!thread.hasUpvoted}
                    className={{
                      root: 'h-8 transform transition hover:scale-105',
                    }}
                    data={{ cy: `course-qa-thread-upvote-${thread.id}` }}
                    aria-label={`Upvote, ${thread.upvotes} current upvotes`}
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
                    <div key={reply.id} className="rounded-md bg-gray-50 p-2">
                      <div className="mb-1 whitespace-pre-wrap text-sm">
                        {reply.content}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500">
                          {dayjs(reply.createdAt).format('DD.MM.YYYY HH:mm')}
                        </span>
                        <Button
                          onClick={() =>
                            handleToggleReplyUpvote(reply.id, reply.hasUpvoted)
                          }
                          active={!!reply.hasUpvoted}
                          className={{
                            root: 'h-7 transform transition hover:scale-105',
                          }}
                          data={{ cy: `course-qa-reply-upvote-${reply.id}` }}
                          aria-label={`Upvote reply, ${reply.upvotes} current upvotes`}
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
                      rows={2}
                      maxLength={4000}
                      value={replyDrafts[thread.id] ?? ''}
                      onChange={(event) =>
                        setReplyDrafts((prev) => ({
                          ...prev,
                          [thread.id]: event.target.value,
                        }))
                      }
                      placeholder={t('pwa.courseQA.replyPlaceholder')}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      aria-label={t('pwa.courseQA.replyPlaceholder')}
                    />

                    {embedToken && canPostAnonymously && (
                      <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={postReplyAnonymous[thread.id] ?? false}
                          onChange={(event) =>
                            setPostReplyAnonymous((prev) => ({
                              ...prev,
                              [thread.id]: event.target.checked,
                            }))
                          }
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
                data={{ cy: 'course-qa-load-more' }}
              >
                <Button.Label>{t('pwa.courseQA.loadMore')}</Button.Label>
              </Button>
            </div>
          )}
        </div>

        {!embedded && (
          <Footer
            browserLink={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/qa`}
          />
        )}
      </div>
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  try {
    if (typeof ctx.params?.courseId !== 'string') {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
          statusCode: 302,
        },
      }
    }

    const apolloClient = initializeApollo()

    const embedParam = ctx.query.embed
    const embedValue = Array.isArray(embedParam) ? embedParam[0] : embedParam
    const embedded = embedValue === 'true' || embedValue === '1'

    const { participantToken, cookiesAvailable } = await getParticipantToken({
      apolloClient,
      courseId: ctx.params.courseId,
      ctx,
    })

    if (participantToken) {
      return {
        props: {
          participantToken,
          cookiesAvailable,
          courseId: ctx.params.courseId,
          embedded,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    return addApolloState(apolloClient, {
      props: {
        courseId: ctx.params.courseId,
        embedded,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    })
  } catch (error) {
    console.error('Error in getServerSideProps on course QA page:', error)

    try {
      nookies.destroy(ctx, 'lti-token', {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
    } catch (nookiesError) {
      console.error(nookiesError)
    }

    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/course/${ctx.params?.courseId}/qa`)}`,
        permanent: false,
      },
    }
  }
}

export default CourseDiscussionPage
