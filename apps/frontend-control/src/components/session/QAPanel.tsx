import { useMutation } from '@apollo/client'
import { faArrowUp, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeLiveQuizSettingsDocument,
  DeleteFeedbackDocument,
  GetControlLiveQuizFeedbacksDocument,
  type GetControlLiveQuizFeedbacksQuery,
  PinFeedbackDocument,
  PublishFeedbackDocument,
  ResolveFeedbackDocument,
  RespondToFeedbackDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Switch, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ResponsiveSheet from '../common/ResponsiveSheet'
import {
  cardClass,
  dangerButtonClass,
  outlineButtonClass,
  primaryButtonClass,
  sheetButtonClass,
  smallButtonClass,
} from '../common/styles'

type QAData = NonNullable<
  GetControlLiveQuizFeedbacksQuery['controlLiveQuizFeedbacks']
>
type Question = NonNullable<QAData['feedbacks']>[number]
type Filter = 'pending' | 'open' | 'answered'

// questions asked within this window are flagged as new
const NEW_QUESTION_MS = 2 * 60 * 1000

function questionState(question: Question): Filter {
  if (question.isResolved) return 'answered'
  return question.isPublished ? 'open' : 'pending'
}

function useRunAction() {
  const t = useTranslations()
  return async (action: () => Promise<unknown>) => {
    try {
      await action()
      return true
    } catch {
      toast({
        type: 'error',
        message: t('control.liveQuiz.actionFailed'),
        options: { duration: 5000 },
      })
      return false
    }
  }
}

function QuestionCard({
  question,
  quizId,
  now,
  onDelete,
}: {
  question: Question
  quizId: string
  now: number
  onDelete: (question: Question) => void
}) {
  const t = useTranslations()
  const runAction = useRunAction()
  const [composing, setComposing] = useState(false)
  const [answer, setAnswer] = useState('')

  // the returned flags update the normalized Feedback entry in the cache
  const [publishFeedback] = useMutation(PublishFeedbackDocument)
  const [pinFeedback] = useMutation(PinFeedbackDocument)
  const [resolveFeedback] = useMutation(ResolveFeedbackDocument)
  const [respondToFeedback, { loading: responding }] = useMutation(
    RespondToFeedbackDocument
  )

  const state = questionState(question)
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(question.createdAt).getTime()) / 60000)
  )
  const isNew =
    state !== 'answered' &&
    now - new Date(question.createdAt).getTime() < NEW_QUESTION_MS
  const variables = { id: question.id, liveQuizId: quizId }
  const outline = `${smallButtonClass} ${outlineButtonClass}`

  return (
    <div
      className={twMerge(
        cardClass,
        'p-3.5',
        question.isPinned && state === 'open' && 'border-uzh-blue',
        isNew && !question.isPinned && 'border-uzh-red'
      )}
      data-cy={`qa-question-${question.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-8 flex-col items-center pt-0.5">
          <FontAwesomeIcon
            icon={faArrowUp}
            aria-hidden
            className="text-uzh-blue h-4 w-4"
          />
          <b aria-hidden className="text-ctrl-ink text-[15px] tabular-nums">
            {question.votes}
          </b>
          <span className="sr-only">
            {t('control.liveQuiz.qaVotes', { count: question.votes })}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-ctrl-ink text-[15px] leading-[1.4] break-words">
            {question.content}
          </div>
          <div className="text-ctrl-muted mt-1 flex flex-wrap gap-2 text-[13px]">
            <span>
              {minutes === 0
                ? t('control.liveQuiz.qaJustNow')
                : minutes < 60
                  ? t('control.liveQuiz.qaMinutesAgo', { minutes })
                  : t('control.liveQuiz.qaHoursAgo', {
                      hours: Math.floor(minutes / 60),
                    })}
            </span>
            {question.isPinned && state === 'open' && (
              <span className="text-uzh-blue font-semibold">
                · {t('control.liveQuiz.qaPinned')}
              </span>
            )}
            {isNew && (
              <span className="text-uzh-red font-semibold">
                · {t('control.liveQuiz.qaNew')}
              </span>
            )}
          </div>
          {question.responses?.map((response) => (
            <div
              key={response.id}
              className="bg-ctrl-bg text-ctrl-ink-2 mt-2 rounded-md px-2.5 py-2 text-sm break-words"
            >
              <b className="text-ctrl-ink">{t('control.liveQuiz.qaAnswer')}</b>{' '}
              {response.content}
            </div>
          ))}
        </div>
      </div>

      {composing ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            // biome-ignore lint/a11y/noAutofocus: opened by an explicit tap on "Antworten"
            autoFocus
            aria-label={t('control.liveQuiz.qaAnswerPlaceholder')}
            placeholder={t('control.liveQuiz.qaAnswerPlaceholder')}
            data-cy={`qa-answer-input-${question.id}`}
            className="border-uzh-blue text-ctrl-ink resize-y rounded-md border p-2.5 text-base shadow-[0_0_0_3px_rgba(0,40,165,0.18)] outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setComposing(false)}
              className={{ root: outline }}
              data={{ cy: `qa-answer-cancel-${question.id}` }}
            >
              {t('shared.generic.cancel')}
            </Button>
            <Button
              loading={responding}
              disabled={!answer.trim()}
              onClick={async () => {
                const sent = await runAction(() =>
                  respondToFeedback({
                    variables: { ...variables, responseContent: answer.trim() },
                  })
                )
                if (sent) {
                  setComposing(false)
                  setAnswer('')
                }
              }}
              className={{ root: `${smallButtonClass} ${primaryButtonClass}` }}
              data={{ cy: `qa-answer-send-${question.id}` }}
            >
              {t('control.liveQuiz.qaSend')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {state === 'pending' && (
            <>
              <Button
                onClick={() =>
                  runAction(() =>
                    publishFeedback({
                      variables: { ...variables, isPublished: true },
                      optimisticResponse: {
                        publishFeedback: {
                          __typename: 'Feedback',
                          id: question.id,
                          isPublished: true,
                        },
                      },
                    })
                  )
                }
                className={{
                  root: `${smallButtonClass} ${primaryButtonClass} gap-1.5`,
                }}
                data={{ cy: `qa-publish-${question.id}` }}
              >
                <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5" />
                {t('control.liveQuiz.qaPublish')}
              </Button>
              <Button
                onClick={() => onDelete(question)}
                className={{ root: outline }}
                data={{ cy: `qa-reject-${question.id}` }}
              >
                {t('control.liveQuiz.qaReject')}
              </Button>
            </>
          )}
          {state === 'open' && (
            <>
              <Button
                onClick={() => setComposing(true)}
                className={{ root: outline }}
                data={{ cy: `qa-respond-${question.id}` }}
              >
                {t('control.liveQuiz.qaRespond')}
              </Button>
              <Button
                onClick={() =>
                  runAction(() =>
                    resolveFeedback({
                      variables: { ...variables, isResolved: true },
                      optimisticResponse: {
                        resolveFeedback: {
                          __typename: 'Feedback',
                          id: question.id,
                          isResolved: true,
                        },
                      },
                    })
                  )
                }
                className={{ root: `${outline} gap-1.5` }}
                data={{ cy: `qa-resolve-${question.id}` }}
              >
                <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5" />
                {t('control.liveQuiz.qaResolve')}
              </Button>
              <Button
                onClick={() =>
                  runAction(() =>
                    pinFeedback({
                      variables: { ...variables, isPinned: !question.isPinned },
                      optimisticResponse: {
                        pinFeedback: {
                          __typename: 'Feedback',
                          id: question.id,
                          isPinned: !question.isPinned,
                        },
                      },
                    })
                  )
                }
                className={{ root: outline }}
                data={{ cy: `qa-pin-${question.id}` }}
              >
                {question.isPinned
                  ? t('control.liveQuiz.qaUnpin')
                  : t('control.liveQuiz.qaPin')}
              </Button>
              <Button
                onClick={() => onDelete(question)}
                className={{ root: `${outline} text-ctrl-muted` }}
                data={{ cy: `qa-hide-${question.id}` }}
              >
                {t('control.liveQuiz.qaHide')}
              </Button>
            </>
          )}
          {state === 'answered' && (
            <Button
              onClick={() =>
                runAction(() =>
                  resolveFeedback({
                    variables: { ...variables, isResolved: false },
                    optimisticResponse: {
                      resolveFeedback: {
                        __typename: 'Feedback',
                        id: question.id,
                        isResolved: false,
                      },
                    },
                  })
                )
              }
              className={{ root: outline }}
              data={{ cy: `qa-reopen-${question.id}` }}
            >
              {t('control.liveQuiz.qaReopen')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

interface QAPanelProps {
  quizId: string
  data: QAData
}

// Live Q&A moderation: approve, answer, pin, resolve and remove questions
function QAPanel({ quizId, data }: QAPanelProps) {
  const t = useTranslations()
  const runAction = useRunAction()
  const [filter, setFilter] = useState<Filter | null>(null)
  // the question stays set while the sheet animates closed
  const [deleting, setDeleting] = useState<Question | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const confirmDelete = (question: Question) => {
    setDeleting(question)
    setDeleteOpen(true)
  }
  const [confirmModerationOff, setConfirmModerationOff] = useState(false)
  // clock for the relative times and the "new" flag
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  const [changeSettings, { loading: changingSettings }] = useMutation(
    ChangeLiveQuizSettingsDocument,
    // switching moderation off publishes pending questions on the server
    { refetchQueries: [GetControlLiveQuizFeedbacksDocument] }
  )
  const [deleteFeedback, { loading: deletingFeedback }] = useMutation(
    DeleteFeedbackDocument,
    { refetchQueries: [GetControlLiveQuizFeedbacksDocument] }
  )

  const { isLiveQAEnabled, isModerationEnabled } = data
  const questions = data.feedbacks ?? []
  const counts = { pending: 0, open: 0, answered: 0 }
  for (const question of questions) counts[questionState(question)]++

  // without moderation there is nothing to review; otherwise default to the
  // review list while it has entries
  const activeFilter: Filter =
    filter && (filter !== 'pending' || isModerationEnabled)
      ? filter
      : isModerationEnabled && counts.pending > 0
        ? 'pending'
        : 'open'
  const filters: Filter[] = isModerationEnabled
    ? ['pending', 'open', 'answered']
    : ['open', 'answered']
  const filterLabels: Record<Filter, string> = {
    pending: t('control.liveQuiz.qaFilterPending'),
    open: t('control.liveQuiz.qaFilterOpen'),
    answered: t('control.liveQuiz.qaFilterAnswered'),
  }

  // pinned first, then by votes; the review list stays in arrival order
  const list = questions
    .filter((question) => questionState(question) === activeFilter)
    .sort((a, b) => {
      if (activeFilter === 'pending') return 0
      if (activeFilter === 'answered') {
        return (
          new Date(b.resolvedAt ?? 0).getTime() -
          new Date(a.resolvedAt ?? 0).getTime()
        )
      }
      return Number(b.isPinned) - Number(a.isPinned) || b.votes - a.votes
    })

  const setModeration = (isModerationEnabled: boolean) =>
    runAction(() =>
      changeSettings({ variables: { id: quizId, isModerationEnabled } })
    )

  return (
    <div className="flex flex-col gap-3" data-cy="qa-panel">
      <div className={twMerge(cardClass, 'flex flex-col gap-3 px-4 py-3')}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="qa-enabled-switch"
              className="text-ctrl-ink block text-[15px] font-bold"
            >
              {t('control.liveQuiz.qaEnabled')}
            </label>
            <div className="text-ctrl-muted text-[13px]">
              {isLiveQAEnabled
                ? t('control.liveQuiz.qaEnabledHint')
                : t('control.liveQuiz.qaDisabledHint')}
            </div>
          </div>
          <Switch
            checked={isLiveQAEnabled}
            disabled={changingSettings}
            onCheckedChange={(value) =>
              runAction(() =>
                changeSettings({
                  variables: { id: quizId, isLiveQAEnabled: value },
                })
              )
            }
            id="qa-enabled-switch"
            data={{ cy: 'qa-toggle-enabled' }}
          />
        </div>
        {isLiveQAEnabled && (
          <div className="border-ctrl-border flex items-center gap-3 border-t pt-3">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="qa-moderation-switch"
                className="text-ctrl-ink block text-[15px] font-bold"
              >
                {t('control.liveQuiz.qaModeration')}
              </label>
              <div className="text-ctrl-muted text-[13px]">
                {isModerationEnabled
                  ? t('control.liveQuiz.qaModerationOnHint')
                  : t('control.liveQuiz.qaModerationOffHint')}
              </div>
            </div>
            <Switch
              checked={isModerationEnabled}
              disabled={changingSettings}
              onCheckedChange={(value) => {
                // switching moderation off publishes everything still pending
                if (!value && counts.pending > 0) {
                  setConfirmModerationOff(true)
                } else {
                  setModeration(value)
                }
              }}
              id="qa-moderation-switch"
              data={{ cy: 'qa-toggle-moderation' }}
            />
          </div>
        )}
      </div>

      {(isLiveQAEnabled || questions.length > 0) && (
        <>
          <div role="tablist" className="flex gap-1">
            {filters.map((entry) => {
              const active = entry === activeFilter
              return (
                <button
                  key={entry}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(entry)}
                  data-cy={`qa-filter-${entry}`}
                  className={twMerge(
                    'border-ctrl-border text-ctrl-ink-2 min-h-10 min-w-0 flex-1 rounded-md border bg-white px-1 text-sm font-semibold',
                    active && 'border-uzh-blue bg-uzh-blue-20 text-uzh-blue'
                  )}
                >
                  {`${filterLabels[entry]} (${counts[entry]})`}
                </button>
              )
            })}
          </div>

          {list.length > 0 ? (
            list.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                quizId={quizId}
                now={now}
                onDelete={confirmDelete}
              />
            ))
          ) : (
            <div
              className="text-ctrl-muted p-6 text-center text-sm"
              data-cy="qa-empty"
            >
              {t('control.liveQuiz.qaEmpty')}
            </div>
          )}
        </>
      )}

      <ResponsiveSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('control.liveQuiz.qaDeleteTitle')}
        dataCy="qa-delete-sheet"
        actions={
          <>
            <Button
              onClick={() => setDeleteOpen(false)}
              className={{ root: `${sheetButtonClass} ${outlineButtonClass}` }}
              data={{ cy: 'qa-delete-cancel' }}
            >
              {t('shared.generic.cancel')}
            </Button>
            <Button
              loading={deletingFeedback}
              onClick={async () => {
                if (!deleting) return
                await runAction(() =>
                  deleteFeedback({
                    variables: { id: deleting.id, liveQuizId: quizId },
                  })
                )
                setDeleteOpen(false)
              }}
              className={{ root: `${sheetButtonClass} ${dangerButtonClass}` }}
              data={{ cy: 'qa-delete-confirm' }}
            >
              {t('control.liveQuiz.qaDeleteConfirm')}
            </Button>
          </>
        }
      >
        {deleting && (
          <>
            <p className="text-ctrl-ink bg-ctrl-bg mb-3 rounded-md p-3 text-[15px] break-words">
              {deleting.content}
            </p>
            <p>{t('control.liveQuiz.qaDeleteBody')}</p>
          </>
        )}
      </ResponsiveSheet>

      <ResponsiveSheet
        open={confirmModerationOff}
        onClose={() => setConfirmModerationOff(false)}
        title={t('control.liveQuiz.qaModerationOffTitle')}
        dataCy="qa-moderation-off-sheet"
        actions={
          <>
            <Button
              onClick={() => setConfirmModerationOff(false)}
              className={{ root: `${sheetButtonClass} ${outlineButtonClass}` }}
              data={{ cy: 'qa-moderation-off-cancel' }}
            >
              {t('shared.generic.cancel')}
            </Button>
            <Button
              loading={changingSettings}
              onClick={async () => {
                await setModeration(false)
                setConfirmModerationOff(false)
              }}
              className={{ root: `${sheetButtonClass} ${primaryButtonClass}` }}
              data={{ cy: 'qa-moderation-off-confirm' }}
            >
              {t('control.liveQuiz.qaModerationOffConfirm')}
            </Button>
          </>
        }
      >
        {t('control.liveQuiz.qaModerationOffBody', { count: counts.pending })}
      </ResponsiveSheet>
    </div>
  )
}

export default QAPanel
