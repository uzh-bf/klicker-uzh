import { useMutation } from '@apollo/client'
import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CourseDiscussionPostFailure,
  CreateCourseDiscussionReplyDocument,
  DeleteCourseDiscussionReplyDocument,
  DeleteCourseDiscussionThreadDocument,
  type GetCourseDiscussionThreadsQuery,
  ToggleCourseDiscussionReplyUpvoteDocument,
  ToggleCourseDiscussionThreadUpvoteDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, toast } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type PendingDeletion =
  | { type: 'thread'; id: number }
  | { type: 'reply'; id: number }

type CourseDiscussionThread =
  GetCourseDiscussionThreadsQuery['courseDiscussionThreads']['threads'][number] & {
    scopeDisplayLabel: string
    sourceDisplayLabel: string | null | undefined
  }

interface CourseDiscussionThreadCardProps {
  courseId: string
  thread: CourseDiscussionThread
  embedToken?: string
  compact: boolean
  canPost: boolean
  canVote: boolean
  canChooseAnonymity: boolean
  mustPostAnonymously: boolean
  idPrefix: string
  onReplyCreated: () => Promise<unknown>
  onContentDeleted: () => Promise<unknown>
}

function CourseDiscussionThreadCard({
  courseId,
  thread,
  embedToken,
  compact,
  canPost,
  canVote,
  canChooseAnonymity,
  mustPostAnonymously,
  idPrefix,
  onReplyCreated,
  onContentDeleted,
}: CourseDiscussionThreadCardProps) {
  const t = useTranslations()
  const formatter = useFormatter()
  const [replyDraft, setReplyDraft] = useState('')
  const [postReplyAnonymous, setPostReplyAnonymous] = useState(false)
  const [replyComposerOpen, setReplyComposerOpen] = useState(false)
  const [submittingReply, setSubmittingReply] = useState(false)
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingDeletion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [createReply] = useMutation(CreateCourseDiscussionReplyDocument)
  const [deleteThread] = useMutation(DeleteCourseDiscussionThreadDocument)
  const [deleteReply] = useMutation(DeleteCourseDiscussionReplyDocument)
  const [toggleThreadUpvote] = useMutation(
    ToggleCourseDiscussionThreadUpvoteDocument
  )
  const [toggleReplyUpvote] = useMutation(
    ToggleCourseDiscussionReplyUpvoteDocument
  )

  useEffect(() => {
    if (canChooseAnonymity || mustPostAnonymously) return

    setPostReplyAnonymous(false)
  }, [canChooseAnonymity, mustPostAnonymously])

  const handleCreateReply = useCallback(async () => {
    const content = replyDraft.trim()
    if (!content) return

    setSubmittingReply(true)

    try {
      const result = await createReply({
        variables: {
          input: {
            courseId,
            threadId: thread.id,
            content,
            isAnonymous:
              mustPostAnonymously || (canChooseAnonymity && postReplyAnonymous),
            embedToken,
          },
        },
      })

      const postResult = result.data?.createCourseDiscussionReply
      if (!postResult?.reply) {
        const message =
          postResult?.failureCode === CourseDiscussionPostFailure.RateLimited
            ? t('pwa.courseQA.postRateLimited')
            : postResult?.failureCode ===
                CourseDiscussionPostFailure.ReplyLimitReached
              ? t('pwa.courseQA.replyLimitReached')
              : t('pwa.courseQA.replyPostFailed')

        toast({
          type: 'error',
          message,
        })
        return
      }

      setReplyDraft('')
      setPostReplyAnonymous(false)
      await onReplyCreated()
    } catch {
      toast({
        type: 'error',
        message: t('pwa.courseQA.replyPostError'),
      })
    } finally {
      setSubmittingReply(false)
    }
  }, [
    replyDraft,
    createReply,
    courseId,
    thread.id,
    mustPostAnonymously,
    canChooseAnonymity,
    postReplyAnonymous,
    embedToken,
    onReplyCreated,
    t,
  ])

  const handleToggleThreadUpvote = useCallback(async () => {
    try {
      await toggleThreadUpvote({
        variables: {
          threadId: thread.id,
          upvote: !thread.hasUpvoted,
        },
      })
    } catch {
      toast({
        type: 'error',
        message: t('pwa.courseQA.upvoteFailed'),
      })
    }
  }, [thread.id, thread.hasUpvoted, toggleThreadUpvote, t])

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
          : (
              await deleteReply({
                variables: { replyId: pendingDeletion.id },
              })
            ).data?.deleteCourseDiscussionReply

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
      await onContentDeleted()
    } catch {
      toast({
        type: 'error',
        message: t('pwa.courseQA.deleteError'),
      })
    } finally {
      setDeleting(false)
    }
  }, [pendingDeletion, deleteThread, deleteReply, onContentDeleted, t])

  const formatDateTime = (value: string) =>
    formatter.dateTime(new Date(value), {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  const replyTriggerId = `${idPrefix}-reply-trigger-${thread.id}`
  const replyComposerId = `${idPrefix}-reply-composer-${thread.id}`
  const threadUpvoteCountDescriptionId = `${idPrefix}-thread-upvote-count-${thread.id}`

  return (
    <div
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
        {canVote ? (
          <>
            <Button
              onClick={handleToggleThreadUpvote}
              active={!!thread.hasUpvoted}
              className={{
                root: 'h-8 motion-safe:transition-transform motion-safe:hover:scale-105',
              }}
              data={{ cy: `course-qa-thread-upvote-${thread.id}` }}
              aria-pressed={!!thread.hasUpvoted}
              aria-label={t('pwa.courseQA.threadUpvoteAriaLabel')}
              aria-describedby={threadUpvoteCountDescriptionId}
            >
              <Button.Icon icon={faThumbsUp} />
              <Button.Label>{String(thread.upvotes)}</Button.Label>
            </Button>
            <span id={threadUpvoteCountDescriptionId} className="sr-only">
              {t('pwa.courseQA.threadUpvoteCountAriaLabel', {
                count: thread.upvotes,
              })}
            </span>
          </>
        ) : (
          <>
            <span
              className="inline-flex h-8 items-center gap-2 px-2 text-sm text-gray-600"
              aria-hidden="true"
            >
              <FontAwesomeIcon icon={faThumbsUp} className="h-4 w-4" />
              {thread.upvotes}
            </span>
            <span className="sr-only">
              {t('pwa.courseQA.threadUpvoteCountAriaLabel', {
                count: thread.upvotes,
              })}
            </span>
          </>
        )}
        <span className="text-xs text-gray-500">
          {t('pwa.courseQA.nReply', { count: thread.replyCount })}
        </span>
        {canPost && (
          <Button
            id={replyTriggerId}
            onClick={() => setReplyComposerOpen((open) => !open)}
            disabled={submittingReply}
            active={replyComposerOpen}
            className={{ root: 'h-8' }}
            aria-expanded={replyComposerOpen}
            aria-controls={replyComposerId}
            data={{ cy: `course-qa-open-reply-${thread.id}` }}
          >
            <Button.Label>
              {replyComposerOpen
                ? t('shared.generic.close')
                : t('pwa.courseQA.reply')}
            </Button.Label>
          </Button>
        )}
        {thread.canDelete && (
          <Button
            onClick={() =>
              setPendingDeletion({ type: 'thread', id: thread.id })
            }
            className={{ root: 'h-8 text-red-600' }}
            data={{ cy: `course-qa-delete-thread-${thread.id}` }}
            aria-label={t('pwa.courseQA.deleteThread')}
          >
            <Button.Icon icon={faTrash} />
          </Button>
        )}
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
              {canVote ? (
                <>
                  <Button
                    onClick={() =>
                      handleToggleReplyUpvote(reply.id, reply.hasUpvoted)
                    }
                    active={!!reply.hasUpvoted}
                    className={{
                      root: 'h-7 motion-safe:transition-transform motion-safe:hover:scale-105',
                    }}
                    data={{ cy: `course-qa-reply-upvote-${reply.id}` }}
                    aria-pressed={!!reply.hasUpvoted}
                    aria-label={t('pwa.courseQA.replyUpvoteAriaLabel')}
                    aria-describedby={`${idPrefix}-reply-upvote-count-${reply.id}`}
                  >
                    <Button.Icon
                      icon={faThumbsUp}
                      className={{ root: 'h-3 w-3' }}
                    />
                    <Button.Label>{String(reply.upvotes)}</Button.Label>
                  </Button>
                  <span
                    id={`${idPrefix}-reply-upvote-count-${reply.id}`}
                    className="sr-only"
                  >
                    {t('pwa.courseQA.replyUpvoteCountAriaLabel', {
                      count: reply.upvotes,
                    })}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="inline-flex h-7 items-center gap-2 px-2 text-xs text-gray-600"
                    aria-hidden="true"
                  >
                    <FontAwesomeIcon icon={faThumbsUp} className="h-3 w-3" />
                    {reply.upvotes}
                  </span>
                  <span className="sr-only">
                    {t('pwa.courseQA.replyUpvoteCountAriaLabel', {
                      count: reply.upvotes,
                    })}
                  </span>
                </>
              )}
              {reply.canDelete && (
                <Button
                  onClick={() =>
                    setPendingDeletion({ type: 'reply', id: reply.id })
                  }
                  className={{ root: 'h-7 text-red-600' }}
                  data={{ cy: `course-qa-delete-reply-${reply.id}` }}
                  aria-label={t('pwa.courseQA.deleteReply')}
                >
                  <Button.Icon icon={faTrash} className={{ root: 'h-3 w-3' }} />
                </Button>
              )}
            </div>
          </div>
        ))}

        {canPost && (
          <div
            id={replyComposerId}
            hidden={!replyComposerOpen}
            className="mt-1 rounded-md border border-gray-200 p-2"
          >
            <textarea
              name={`${idPrefix}-reply-content-${thread.id}`}
              rows={2}
              maxLength={4000}
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              autoComplete="off"
              placeholder={t('pwa.courseQA.replyPlaceholder')}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              aria-label={t('pwa.courseQA.replyPlaceholder')}
              data-cy={`course-qa-reply-input-${thread.id}`}
            />

            {embedToken &&
              (canChooseAnonymity ? (
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    name={`${idPrefix}-reply-anonymous-${thread.id}`}
                    type="checkbox"
                    checked={postReplyAnonymous}
                    onChange={(event) =>
                      setPostReplyAnonymous(event.target.checked)
                    }
                    data-cy={`course-qa-reply-anonymous-${thread.id}`}
                  />
                  {t('pwa.courseQA.replyAnonymously')}
                </label>
              ) : mustPostAnonymously ? (
                <p
                  className="mt-2 text-xs text-gray-600"
                  data-cy={`course-qa-reply-anonymous-${thread.id}`}
                >
                  {t('pwa.courseQA.replyingAnonymously')}
                </p>
              ) : null)}

            <div className="mt-2 flex justify-end gap-2">
              <Button
                disabled={submittingReply}
                onClick={() => {
                  document.getElementById(replyTriggerId)?.focus()
                  setReplyComposerOpen(false)
                  setReplyDraft('')
                  setPostReplyAnonymous(false)
                }}
                className={{ root: 'h-8' }}
                data={{ cy: `course-qa-cancel-reply-${thread.id}` }}
              >
                <Button.Label>{t('shared.generic.cancel')}</Button.Label>
              </Button>
              <Button
                primary
                loading={submittingReply}
                disabled={submittingReply || replyDraft.trim().length === 0}
                onClick={handleCreateReply}
                className={{ root: 'h-8' }}
                data={{ cy: `course-qa-create-reply-${thread.id}` }}
              >
                <Button.Label>{t('pwa.courseQA.reply')}</Button.Label>
              </Button>
            </div>
          </div>
        )}
      </div>

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
          dataPrimaryAction={{ cy: 'course-qa-confirm-deletion' }}
          dataSecondaryAction={{ cy: 'course-qa-cancel-deletion' }}
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

export default CourseDiscussionThreadCard
