import { useMutation, useQuery } from '@apollo/client'
import {
  CreateCourseDiscussionReplyDocument,
  CreateCourseDiscussionThreadDocument,
  GetBasicCourseInformationDocument,
  GetCourseDiscussionScopesDocument,
  GetCourseDiscussionThreadsDocument,
  ToggleCourseDiscussionReplyUpvoteDocument,
  ToggleCourseDiscussionThreadUpvoteDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { Button, H2, UserNotification, toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import nookies from 'nookies'
import { useEffect, useMemo, useState } from 'react'
import Layout from '../../../components/Layout'
import Footer from '../../../components/common/Footer'

interface CourseDiscussionPageProps {
  courseId: string
  embedded: boolean
  participantToken?: string
  cookiesAvailable?: boolean
}

type ParsedDiscussionScopeInput = {
  scopeType:
    | 'COURSE'
    | 'PRACTICE_QUIZ'
    | 'PRACTICE_STACK'
    | 'PRACTICE_ELEMENT'
    | 'LIVE_QUIZ'
    | 'LIVE_BLOCK'
    | 'LIVE_INSTANCE'
    | 'EXTERNAL_BLOCK'
  practiceQuizId?: string
  stackId?: number
  instanceId?: number
  liveBlockId?: number
  externalSource?: string
  externalRef?: string
}

function parseScopeKeyToInput(
  courseId: string,
  scopeKey?: string | null
): ParsedDiscussionScopeInput {
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

  const liveInstanceMatch = scopeKey.match(
    /^lq:([^:]+):block:(\d+):instance:(\d+)$/
  )
  if (liveInstanceMatch) {
    return {
      scopeType: 'LIVE_INSTANCE',
      liveBlockId: Number.parseInt(liveInstanceMatch[2] ?? '', 10),
      instanceId: Number.parseInt(liveInstanceMatch[3] ?? '', 10),
    }
  }

  const liveBlockMatch = scopeKey.match(/^lq:([^:]+):block:(\d+)$/)
  if (liveBlockMatch) {
    return {
      scopeType: 'LIVE_BLOCK',
      liveBlockId: Number.parseInt(liveBlockMatch[2] ?? '', 10),
    }
  }

  const liveQuizMatch = scopeKey.match(/^lq:([^:]+)$/)
  if (liveQuizMatch) {
    return {
      scopeType: 'LIVE_QUIZ',
    }
  }

  return {
    scopeType: 'COURSE',
  }
}

function canCreateThreadForScope(scope: ParsedDiscussionScopeInput) {
  return (
    scope.scopeType === 'COURSE' ||
    scope.scopeType === 'PRACTICE_QUIZ' ||
    scope.scopeType === 'PRACTICE_STACK' ||
    scope.scopeType === 'PRACTICE_ELEMENT' ||
    scope.scopeType === 'EXTERNAL_BLOCK'
  )
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
    typeof router.query.scopeKey === 'string' ? router.query.scopeKey : undefined
  const embedToken =
    typeof router.query.embedToken === 'string'
      ? router.query.embedToken
      : undefined

  const [activeScopeKey, setActiveScopeKey] = useState(scopeKeyFromQuery ?? '')
  const [threadDraft, setThreadDraft] = useState('')
  const [postThreadAnonymous, setPostThreadAnonymous] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [postReplyAnonymous, setPostReplyAnonymous] = useState<
    Record<number, boolean>
  >({})

  useEffect(() => {
    if (scopeKeyFromQuery) {
      setActiveScopeKey(scopeKeyFromQuery)
    }
  }, [scopeKeyFromQuery])

  useParticipantToken({ participantToken, cookiesAvailable })

  const {
    data: courseData,
    loading: loadingCourse,
    error: courseError,
  } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId },
    skip: !courseId || embedded,
  })

  const {
    data: scopesData,
    loading: loadingScopes,
    refetch: refetchScopes,
  } = useQuery(GetCourseDiscussionScopesDocument, {
    variables: { courseId },
    skip: !courseId || !!embedToken,
    fetchPolicy: 'cache-and-network',
    pollInterval: 25000,
  })

  const {
    data: threadsData,
    loading: loadingThreads,
    error: threadsError,
    refetch: refetchThreads,
  } = useQuery(GetCourseDiscussionThreadsDocument, {
    variables: {
      courseId,
      scopeKey: activeScopeKey || scopeKeyFromQuery,
      sort: 'ACTIVITY_DESC',
      limit: 50,
      includeLinkedLiveQuizSpaces: embedToken ? false : true,
      embedToken,
    },
    skip: !courseId,
    fetchPolicy: 'cache-and-network',
    pollInterval: 15000,
  })

  const [createThread, { loading: creatingThread }] = useMutation(
    CreateCourseDiscussionThreadDocument
  )
  const [createReply, { loading: creatingReply }] = useMutation(
    CreateCourseDiscussionReplyDocument
  )
  const [toggleThreadUpvote] = useMutation(
    ToggleCourseDiscussionThreadUpvoteDocument
  )
  const [toggleReplyUpvote] = useMutation(ToggleCourseDiscussionReplyUpvoteDocument)

  const scopeOptions = useMemo(() => {
    return (
      scopesData?.courseDiscussionScopes?.map((scope) => ({
        key: scope.scopeKey,
        scopeLabel: scope.scopeLabel,
        label: `${scope.scopeLabel} (${scope.sourceLabel})`,
        spaceType: scope.spaceType,
      })) ?? []
    )
  }, [scopesData?.courseDiscussionScopes])

  const effectiveScopeKey =
    activeScopeKey || scopeKeyFromQuery || `course:${courseId}`
  const selectedScope = scopeOptions.find(
    (scope) => scope.key === effectiveScopeKey
  )
  const parsedScopeInput = parseScopeKeyToInput(courseId, effectiveScopeKey)
  const canCreateThread = canCreateThreadForScope(parsedScopeInput)

  const handleCreateThread = async () => {
    if (!threadDraft.trim()) return
    if (!canCreateThread) {
      toast({
        type: 'error',
        message:
          'New threads can currently only be created in course and practice scopes.',
      })
      return
    }

    try {
      const result = await createThread({
        variables: {
          input: {
            courseId,
            content: threadDraft,
            scope: parsedScopeInput,
            scopeLabel: selectedScope?.scopeLabel,
            isAnonymous: postThreadAnonymous,
            embedToken,
          },
        },
      })

      if (!result.data?.createCourseDiscussionThread) {
        toast({
          type: 'error',
          message: 'Unable to post thread. Check permissions or embed settings.',
        })
        return
      }

      setThreadDraft('')
      await refetchThreads()
      if (!embedToken) {
        await refetchScopes()
      }
    } catch {
      toast({
        type: 'error',
        message: 'Unable to post thread. Please try again.',
      })
    }
  }

  const handleCreateReply = async (threadId: number) => {
    const content = replyDrafts[threadId]?.trim()
    if (!content) return

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
          message: 'Unable to post reply. Check permissions or embed settings.',
        })
        return
      }

      setReplyDrafts((prev) => ({
        ...prev,
        [threadId]: '',
      }))
      await refetchThreads()
      if (!embedToken) {
        await refetchScopes()
      }
    } catch {
      toast({
        type: 'error',
        message: 'Unable to post reply. Please try again.',
      })
    }
  }

  const handleToggleThreadUpvote = async (threadId: number, hasUpvoted?: boolean | null) => {
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
        message: 'Unable to update upvote. Sign in as a participant to vote.',
      })
    }
  }

  const handleToggleReplyUpvote = async (replyId: number, hasUpvoted?: boolean | null) => {
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
        message: 'Unable to update upvote. Sign in as a participant to vote.',
      })
    }
  }

  if (loadingCourse || loadingThreads || (loadingScopes && !embedToken)) {
    return (
      <Layout embedded={embedded} displayName="Course Q&A">
        <Loader />
      </Layout>
    )
  }

  if (courseError || threadsError) {
    return (
      <Layout embedded={embedded} displayName="Course Q&A">
        <UserNotification type="error" message={t('shared.generic.systemError')} />
      </Layout>
    )
  }

  const threads = threadsData?.courseDiscussionThreads?.threads ?? []

  return (
    <Layout
      embedded={embedded}
      course={courseData?.basicCourseInformation ?? undefined}
      displayName="Course Q&A"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <H2 className={{ root: 'mb-2' }}>Course Q&A</H2>

          {!embedded && (
            <div className="mb-3 flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700" htmlFor="qa-scope-filter">
                Scope Filter
              </label>
              <select
                id="qa-scope-filter"
                value={activeScopeKey}
                onChange={(event) => setActiveScopeKey(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">All Scopes</option>
                {scopeOptions.map((scope) => (
                  <option value={scope.key} key={scope.key}>
                    {scope.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700" htmlFor="qa-thread-content">
              New Thread
            </label>
            <textarea
              id="qa-thread-content"
              rows={3}
              maxLength={4000}
              value={threadDraft}
              onChange={(event) => setThreadDraft(event.target.value)}
              placeholder={
                canCreateThread
                  ? 'Ask a question for this scope...'
                  : 'Thread creation is not available for this selected source.'
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />

            {!canCreateThread && (
              <div className="text-xs text-amber-700">
                New threads are currently limited to course-space scopes.
              </div>
            )}

            {embedToken && (
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={postThreadAnonymous}
                  onChange={(event) => setPostThreadAnonymous(event.target.checked)}
                />
                Post anonymously
              </label>
            )}

            <div className="flex justify-end">
              <Button
                primary
                loading={creatingThread}
                disabled={
                  creatingThread ||
                  threadDraft.trim().length === 0 ||
                  !canCreateThread
                }
                onClick={handleCreateThread}
                data={{ cy: 'course-qa-create-thread' }}
              >
                <Button.Label>Post Thread</Button.Label>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {threads.length === 0 ? (
            <UserNotification
              type="info"
              message="No discussion threads yet for this scope."
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
                  <span>{dayjs(thread.createdAt).format('DD.MM.YYYY HH:mm')}</span>
                </div>

                <div className="whitespace-pre-wrap text-sm">{thread.content}</div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() =>
                      handleToggleThreadUpvote(thread.id, thread.hasUpvoted)
                    }
                    active={!!thread.hasUpvoted}
                    className={{ root: 'h-8' }}
                    data={{ cy: `course-qa-thread-upvote-${thread.id}` }}
                  >
                    <Button.Label>{`👍 ${thread.upvotes}`}</Button.Label>
                  </Button>
                  <span className="text-xs text-gray-500">
                    {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
                  </span>
                </div>

                <div className="mt-3 flex flex-col gap-2 border-l border-gray-200 pl-3">
                  {thread.replies?.map((reply) => (
                    <div key={reply.id} className="rounded-md bg-gray-50 p-2">
                      <div className="mb-1 whitespace-pre-wrap text-sm">{reply.content}</div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500">
                          {dayjs(reply.createdAt).format('DD.MM.YYYY HH:mm')}
                        </span>
                        <Button
                          onClick={() =>
                            handleToggleReplyUpvote(reply.id, reply.hasUpvoted)
                          }
                          active={!!reply.hasUpvoted}
                          className={{ root: 'h-7' }}
                          data={{ cy: `course-qa-reply-upvote-${reply.id}` }}
                        >
                          <Button.Label>{`👍 ${reply.upvotes}`}</Button.Label>
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
                      placeholder="Write a reply..."
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />

                    {embedToken && (
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
                        Reply anonymously
                      </label>
                    )}

                    <div className="mt-2 flex justify-end">
                      <Button
                        primary
                        loading={creatingReply}
                        disabled={
                          creatingReply ||
                          (replyDrafts[thread.id]?.trim().length ?? 0) === 0
                        }
                        onClick={() => handleCreateReply(thread.id)}
                        className={{ root: 'h-8' }}
                        data={{ cy: `course-qa-create-reply-${thread.id}` }}
                      >
                        <Button.Label>Reply</Button.Label>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
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
