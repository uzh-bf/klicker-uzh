import { useMutation, useQuery } from '@apollo/client'
import {
  LecturerRatingCoursesDocument,
  type StartLecturerRatingSessionMutation,
  SaveLecturerRatingDocument,
  StartLecturerRatingSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button, Modal, Select, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface LecturerRatingCourse {
  id: string
  name: string
}

type LecturerRatingSession =
  StartLecturerRatingSessionMutation['startLecturerRatingSession']
type LecturerRatingItem = LecturerRatingSession['items'][number]

interface RatingDraft {
  difficulty?: number
  bloom?: string
}

type RatingDraftByItem = Record<string, RatingDraft>
type PendingAction = 'start' | 'save' | 'skip' | null
type PersistMode = 'save' | 'skip'
type RatingErrorKey =
  | 'manage.questionPool.ratingCourseChanged'
  | 'manage.questionPool.ratingErrorStart'
  | 'manage.questionPool.ratingErrorSave'
  | 'manage.questionPool.ratingErrorStale'
  | 'manage.questionPool.ratingErrorUnauthorized'

type RatingError = {
  key: RatingErrorKey
  retry?:
    | { kind: 'start' }
    | { kind: 'persist'; itemId: string; mode: PersistMode }
}

const DIFFICULTIES = [1, 2, 3, 4, 5] as const

function getItemHandled(item: LecturerRatingItem) {
  return item.reviewed || item.unavailable
}

function getNextPendingItem(
  items: LecturerRatingItem[],
  currentItemId: string
) {
  const currentIndex = items.findIndex((item) => item.id === currentItemId)
  if (currentIndex < 0) return items.find((item) => !getItemHandled(item))

  const orderedItems = [
    ...items.slice(currentIndex + 1),
    ...items.slice(0, currentIndex),
    items[currentIndex],
  ]

  return orderedItems.find((item) => !getItemHandled(item))
}

function buildDrafts(items: LecturerRatingItem[]): RatingDraftByItem {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        difficulty: item.difficulty ?? undefined,
        bloom: item.bloom ?? undefined,
      },
    ])
  )
}

function replaceSessionItem(
  session: LecturerRatingSession,
  updatedItem: LecturerRatingItem
): LecturerRatingSession {
  return {
    ...session,
    items: session.items.map((item) =>
      item.id === updatedItem.id ? updatedItem : item
    ),
  }
}

function getRequestError(
  error: unknown,
  operation: 'start' | PersistMode
): RatingError {
  const graphQLErrors = (
    error as { graphQLErrors?: { extensions?: { code?: unknown } }[] }
  )?.graphQLErrors
  const code = graphQLErrors?.[0]?.extensions?.code
  const normalizedCode = typeof code === 'string' ? code.toUpperCase() : ''

  if (
    normalizedCode.includes('COURSE_NOT_CONFIGURED') ||
    normalizedCode.includes('UNAUTHORIZED') ||
    normalizedCode.includes('FORBIDDEN')
  ) {
    return { key: 'manage.questionPool.ratingErrorUnauthorized' }
  }

  if (
    normalizedCode.includes('ITEM_STALE') ||
    normalizedCode.includes('NOT_FOUND') ||
    normalizedCode.includes('BAD_USER_INPUT') ||
    normalizedCode.includes('CONFLICT')
  ) {
    return {
      key: 'manage.questionPool.ratingErrorStale',
      retry: { kind: 'start' },
    }
  }

  return operation === 'start'
    ? {
        key: 'manage.questionPool.ratingErrorStart',
        retry: { kind: 'start' },
      }
    : {
        key: 'manage.questionPool.ratingErrorSave',
        retry: {
          kind: 'persist',
          itemId: '',
          mode: operation,
        },
      }
}

function RatingProgress({ items }: { items: LecturerRatingItem[] }) {
  const t = useTranslations()
  const handledCount = items.filter(getItemHandled).length
  const reviewedCount = items.filter((item) => item.reviewed).length
  const unavailableCount = items.filter((item) => item.unavailable).length
  const progress = items.length > 0 ? (handledCount / items.length) * 100 : 0

  return (
    <div data-cy="lecturer-rating-progress">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-semibold text-slate-900">
          {t('manage.questionPool.ratingProgress', {
            completed: handledCount,
            total: items.length,
          })}
        </div>
        <div className="text-xs text-slate-600">
          {['SC', 'KPRIM'].map((format) => {
            const group = items.filter((item) => item.format === format)
            return (
              <span key={format} className="mr-2">
                {format} {group.filter(getItemHandled).length}/{group.length}
              </span>
            )
          })}
          {t('manage.questionPool.ratingProgressDetail', {
            reviewed: reviewedCount,
            unavailable: unavailableCount,
          })}
        </div>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.max(1, items.length)}
        aria-valuenow={handledCount}
      >
        <div
          className="h-full rounded-full bg-uzh-blue-100 transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

function RatingItemNavigation({
  items,
  selectedItemId,
  pending,
  onSelect,
}: {
  items: LecturerRatingItem[]
  selectedItemId: string | null
  pending: PendingAction
  onSelect: (itemId: string) => void
}) {
  const t = useTranslations()

  return (
    <nav
      aria-label={t('manage.questionPool.ratingQuestionNavigation')}
      className="flex flex-wrap gap-2"
    >
      {items.map((item) => {
        const active = item.id === selectedItemId
        let status = t('manage.questionPool.ratingStatusUnrated')

        if (item.unavailable) {
          status = t('manage.questionPool.ratingStatusUnavailable')
        } else if (item.reviewed) {
          status =
            item.difficulty == null && item.bloom == null
              ? t('manage.questionPool.ratingStatusSkipped')
              : t('manage.questionPool.ratingStatusRated')
        }

        return (
          <Button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            disabled={pending !== null}
            aria-pressed={active}
            className={{
              root: twMerge(
                'h-auto min-h-12 whitespace-normal px-3 py-1.5 text-left',
                active
                  ? 'border-primary-100 bg-primary-20 text-slate-900 hover:bg-primary-20'
                  : 'border-slate-300 bg-white'
              ),
            }}
            data={{ cy: `lecturer-rating-item-${item.id}` }}
          >
            <Button.Label>
              <span className="block">
                {item.format} · {item.position}
              </span>
              <span className="block text-[11px] font-normal text-slate-600">
                {status}
              </span>
            </Button.Label>
          </Button>
        )
      })}
    </nav>
  )
}

function DifficultyScale({
  format,
  value,
  disabled,
  onChange,
}: {
  format: string
  value?: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  const t = useTranslations()
  const rubrics =
    format === 'SC'
      ? [
          t('manage.questionPool.ratingDifficultyScD1'),
          t('manage.questionPool.ratingDifficultyScD2'),
          t('manage.questionPool.ratingDifficultyScD3'),
          t('manage.questionPool.ratingDifficultyScD4'),
          t('manage.questionPool.ratingDifficultyScD5'),
        ]
      : [
          t('manage.questionPool.ratingDifficultyKprimD1'),
          t('manage.questionPool.ratingDifficultyKprimD2'),
          t('manage.questionPool.ratingDifficultyKprimD3'),
          t('manage.questionPool.ratingDifficultyKprimD4'),
        ]

  return (
    <section aria-labelledby="lecturer-rating-difficulty-label">
      <h4
        id="lecturer-rating-difficulty-label"
        className="font-semibold text-slate-900"
      >
        {t('manage.questionPool.ratingDifficulty')}
      </h4>
      <p className="mt-1 text-xs text-slate-600">
        {t('manage.questionPool.ratingDifficultyDescription')}
      </p>
      <div
        className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
        role="group"
        aria-labelledby="lecturer-rating-difficulty-label"
      >
        {DIFFICULTIES.filter(
          (difficulty) => format === 'SC' || difficulty < 5
        ).map((difficulty, index) => (
          <Button
            key={difficulty}
            type="button"
            onClick={() => onChange(difficulty)}
            disabled={disabled}
            aria-pressed={value === difficulty}
            className={{
              root:
                value === difficulty
                  ? 'h-auto min-h-28 items-start justify-start whitespace-normal border-primary-100 bg-primary-20 text-left text-slate-900 hover:bg-primary-20'
                  : 'h-auto min-h-28 items-start justify-start whitespace-normal border-slate-300 text-left',
            }}
            data={{ cy: `lecturer-rating-difficulty-${difficulty}` }}
          >
            <Button.Label>
              <span className="block text-sm font-bold">D{difficulty}</span>
              <span className="mt-1 block text-xs font-normal leading-snug">
                {rubrics[index]}
              </span>
            </Button.Label>
          </Button>
        ))}
      </div>
    </section>
  )
}

function BloomScale({
  value,
  disabled,
  onChange,
}: {
  value?: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const t = useTranslations()
  const options = [
    {
      value: 'remember',
      label: t('manage.questionPool.ratingBloomRemember'),
      description: t('manage.questionPool.ratingBloomRememberDescription'),
    },
    {
      value: 'understand',
      label: t('manage.questionPool.ratingBloomUnderstand'),
      description: t('manage.questionPool.ratingBloomUnderstandDescription'),
    },
    {
      value: 'apply',
      label: t('manage.questionPool.ratingBloomApply'),
      description: t('manage.questionPool.ratingBloomApplyDescription'),
    },
    {
      value: 'analyze',
      label: t('manage.questionPool.ratingBloomAnalyze'),
      description: t('manage.questionPool.ratingBloomAnalyzeDescription'),
    },
    {
      value: 'evaluate',
      label: t('manage.questionPool.ratingBloomEvaluate'),
      description: t('manage.questionPool.ratingBloomEvaluateDescription'),
    },
  ]

  return (
    <section aria-labelledby="lecturer-rating-bloom-label">
      <h4
        id="lecturer-rating-bloom-label"
        className="font-semibold text-slate-900"
      >
        {t('manage.questionPool.ratingBloom')}
      </h4>
      <p className="mt-1 text-xs text-slate-600">
        {t('manage.questionPool.ratingBloomDescription')}
      </p>
      <div
        className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        role="group"
        aria-labelledby="lecturer-rating-bloom-label"
      >
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            aria-pressed={value === option.value}
            className={{
              root:
                value === option.value
                  ? 'h-auto min-h-28 items-start justify-start whitespace-normal border-primary-100 bg-primary-20 text-left text-slate-900 hover:bg-primary-20'
                  : 'h-auto min-h-28 items-start justify-start whitespace-normal border-slate-300 text-left',
            }}
            data={{ cy: `lecturer-rating-bloom-${option.value}` }}
          >
            <Button.Label>
              <span className="block text-sm font-bold">{option.label}</span>
              <span className="mt-1 block text-xs font-normal leading-snug">
                {option.description}
              </span>
            </Button.Label>
          </Button>
        ))}
      </div>
    </section>
  )
}

function QuestionAnswerKey({ item }: { item: LecturerRatingItem }) {
  const t = useTranslations()

  return (
    <section aria-labelledby="lecturer-rating-answer-key-label">
      <h4
        id="lecturer-rating-answer-key-label"
        className="font-semibold text-slate-900"
      >
        {t('manage.questionPool.ratingAnswerKey')}
      </h4>
      <div className="mt-2 flex flex-col gap-2">
        {item.choices.map((choice, index) => (
          <div
            key={`${choice.text}-${index}`}
            className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-3"
            data-cy={`lecturer-rating-choice-${index}`}
          >
            <div className="flex min-w-0 items-start gap-2">
              <span className="mt-0.5 shrink-0 text-xs font-bold text-slate-500">
                {String.fromCharCode(65 + index)}
              </span>
              <Markdown
                withProse
                content={choice.text}
                className={{
                  root: 'prose-p:m-0! prose-img:m-0! min-w-0 leading-snug',
                }}
              />
            </div>
            <span
              className={
                choice.correct
                  ? 'shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800'
                  : 'shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
              }
            >
              {choice.correct
                ? t('manage.questionPool.ratingCorrect')
                : t('manage.questionPool.ratingIncorrect')}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function LecturerRatingModal({
  courses,
  coursesLoading,
  coursesError,
  onRetryCourses,
  onClose,
}: {
  courses: LecturerRatingCourse[]
  coursesLoading: boolean
  coursesError: boolean
  onRetryCourses: () => Promise<unknown>
  onClose: () => void
}) {
  const t = useTranslations()
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? '')
  const [session, setSession] = useState<LecturerRatingSession>()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<RatingDraftByItem>({})
  const [pending, setPending] = useState<PendingAction>(null)
  const [sessionError, setSessionError] = useState<RatingError>()
  const pendingRef = useRef(false)
  const requestIdRef = useRef(0)

  const [startLecturerRatingSession] = useMutation(
    StartLecturerRatingSessionDocument,
    { fetchPolicy: 'no-cache' }
  )
  const [saveLecturerRating] = useMutation(SaveLecturerRatingDocument, {
    fetchPolicy: 'no-cache',
  })

  const selectedCourse = courses.find(
    (course) => course.id === selectedCourseId
  )

  useEffect(() => {
    if (coursesLoading || coursesError) return

    if (courses.some((course) => course.id === selectedCourseId)) return

    requestIdRef.current += 1
    pendingRef.current = false
    setPending(null)
    setSelectedCourseId(courses[0]?.id ?? '')
    setSession(undefined)
    setSelectedItemId(null)
    setDrafts({})
    setSessionError({ key: 'manage.questionPool.ratingCourseChanged' })
  }, [courses, coursesError, coursesLoading, selectedCourseId])

  function resetSessionResult(startedSession: LecturerRatingSession) {
    const firstPendingItem = startedSession.items.find(
      (item) => !getItemHandled(item)
    )

    setSession(startedSession)
    setDrafts(buildDrafts(startedSession.items))
    setSelectedItemId(firstPendingItem?.id ?? null)
  }

  async function startSession() {
    if (
      !selectedCourse ||
      pendingRef.current ||
      coursesLoading ||
      coursesError
    ) {
      return
    }

    const requestId = ++requestIdRef.current
    pendingRef.current = true
    setPending('start')
    setSessionError(undefined)

    try {
      const { data } = await startLecturerRatingSession({
        variables: { courseId: selectedCourse.id },
      })

      if (requestIdRef.current !== requestId) return

      const startedSession = data?.startLecturerRatingSession
      if (!startedSession) {
        setSessionError({
          key: 'manage.questionPool.ratingErrorStart',
          retry: { kind: 'start' },
        })
        return
      }

      resetSessionResult(startedSession)
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setSessionError(getRequestError(error, 'start'))
      }
    } finally {
      if (requestIdRef.current === requestId) {
        pendingRef.current = false
        setPending(null)
      }
    }
  }

  async function persistRating(item: LecturerRatingItem, mode: PersistMode) {
    if (!session || pendingRef.current || item.unavailable) return

    const draft = drafts[item.id]
    if (mode === 'save' && draft?.difficulty == null && !draft?.bloom) {
      return
    }

    const requestId = ++requestIdRef.current
    pendingRef.current = true
    setPending(mode)
    setSessionError(undefined)

    try {
      const { data } = await saveLecturerRating({
        variables: {
          courseId: session.courseId,
          itemId: item.id,
          expectedVersion: item.ratingVersion,
          difficulty: mode === 'skip' ? null : (draft?.difficulty ?? null),
          bloom: mode === 'skip' ? null : (draft?.bloom ?? null),
        },
      })

      if (requestIdRef.current !== requestId) return

      const updatedItem = data?.saveLecturerRating
      if (!updatedItem || updatedItem.id !== item.id) {
        setSessionError({
          key: 'manage.questionPool.ratingErrorStale',
          retry: { kind: 'start' },
        })
        return
      }

      const updatedSession = replaceSessionItem(session, updatedItem)
      setSession(updatedSession)
      setDrafts((previous) => ({
        ...previous,
        [updatedItem.id]: {
          difficulty: updatedItem.difficulty ?? undefined,
          bloom: updatedItem.bloom ?? undefined,
        },
      }))

      if (updatedItem.unavailable) {
        setSelectedItemId(updatedItem.id)
        return
      }

      const nextItem = getNextPendingItem(updatedSession.items, updatedItem.id)
      setSelectedItemId(nextItem?.id ?? null)
    } catch (error) {
      if (requestIdRef.current !== requestId) return

      const requestError = getRequestError(error, mode)
      if (
        requestError.key === 'manage.questionPool.ratingErrorUnauthorized' ||
        requestError.key === 'manage.questionPool.ratingErrorStale'
      ) {
        setSession(undefined)
        setSelectedItemId(null)
        setDrafts({})
      }
      setSessionError({
        ...requestError,
        retry:
          requestError.retry?.kind === 'persist'
            ? {
                kind: 'persist',
                itemId: item.id,
                mode,
              }
            : requestError.retry,
      })
    } finally {
      if (requestIdRef.current === requestId) {
        pendingRef.current = false
        setPending(null)
      }
    }
  }

  function closeModal() {
    if (pendingRef.current) return
    requestIdRef.current += 1
    onClose()
  }

  function retryRequest() {
    if (!sessionError?.retry || pendingRef.current) return

    if (sessionError.retry.kind === 'start') {
      void startSession()
      return
    }

    const retry = sessionError.retry
    const item = session?.items.find(
      (candidate) => candidate.id === retry.itemId
    )
    if (item) void persistRating(item, sessionError.retry.mode)
  }

  function updateDraft(
    itemId: string,
    field: keyof RatingDraft,
    value: number | string
  ) {
    setDrafts((previous) => ({
      ...previous,
      [itemId]: {
        ...previous[itemId],
        [field]: previous[itemId]?.[field] === value ? undefined : value,
      },
    }))
    setSessionError((previous) =>
      previous?.retry?.kind === 'persist' ? undefined : previous
    )
  }

  function selectItem(itemId: string) {
    setSelectedItemId(itemId)
    setSessionError((previous) =>
      previous?.retry?.kind === 'persist' ? undefined : previous
    )
  }

  const items = session?.items ?? []
  const currentItem = items.find((item) => item.id === selectedItemId)
  const currentDraft = currentItem ? drafts[currentItem.id] : undefined
  const handledCount = items.filter(getItemHandled).length
  const ratingComplete = items.length > 0 && handledCount === items.length
  const controlsDisabled =
    pending !== null || !currentItem || currentItem.unavailable

  return (
    <Modal
      open
      title={t('manage.questionPool.ratingTitle')}
      onClose={closeModal}
      className={{ content: 'max-w-6xl pb-2' }}
      data={{ cy: 'lecturer-rating-modal' }}
      dataCloseButton={{ cy: 'close-lecturer-rating-modal' }}
    >
      <div className="flex flex-col gap-4 text-sm">
        {!session ? (
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-slate-600">
              {t('manage.questionPool.ratingEntryDescription')}
            </p>
            <label
              htmlFor="lecturer-rating-course"
              className="mt-4 block text-xs font-semibold text-slate-700"
            >
              {t('manage.questionPool.ratingCourse')}
            </label>
            <Select
              id="lecturer-rating-course"
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              disabled={
                Boolean(pending) ||
                coursesLoading ||
                coursesError ||
                courses.length === 0
              }
              placeholder={
                coursesLoading
                  ? t('manage.questionPool.ratingCoursesLoading')
                  : t('manage.questionPool.ratingSelectCourse')
              }
              items={courses.map((course) => ({
                value: course.id,
                label: course.name,
                data: { cy: `lecturer-rating-course-${course.id}` },
              }))}
              contentPosition="popper"
              className={{ root: 'mt-1 w-full', trigger: 'h-10' }}
              data={{ cy: 'lecturer-rating-course' }}
            />
            {coursesError ? (
              <div className="mt-3" role="alert">
                <UserNotification
                  type="error"
                  message={t('manage.questionPool.ratingCoursesError')}
                >
                  <button
                    type="button"
                    className="cursor-pointer font-bold underline"
                    onClick={() => void onRetryCourses()}
                    disabled={coursesLoading}
                    data-cy="lecturer-rating-retry-courses"
                  >
                    {t('manage.questionPool.ratingRetry')}
                  </button>
                </UserNotification>
              </div>
            ) : courses.length === 0 && !coursesLoading ? (
              <UserNotification
                type="info"
                message={t('manage.questionPool.ratingNoCourses')}
                className={{ root: 'mt-3' }}
              />
            ) : null}
            {sessionError ? (
              <div className="mt-3" role="alert">
                <UserNotification type="error" message={t(sessionError.key)}>
                  {sessionError.retry ? (
                    <button
                      type="button"
                      className="cursor-pointer font-bold underline"
                      onClick={retryRequest}
                      disabled={pending !== null}
                      data-cy="lecturer-rating-retry"
                    >
                      {t('manage.questionPool.ratingRetry')}
                    </button>
                  ) : null}
                </UserNotification>
              </div>
            ) : null}
            <div className="mt-4 flex justify-end">
              <Button
                primary
                type="button"
                loading={pending === 'start'}
                disabled={
                  !selectedCourse ||
                  coursesLoading ||
                  coursesError ||
                  pending !== null
                }
                onClick={() => void startSession()}
                data={{ cy: 'lecturer-rating-start' }}
              >
                <Button.Label>
                  {t('manage.questionPool.ratingStartResume')}
                </Button.Label>
              </Button>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {selectedCourse?.name ??
                      t('manage.questionPool.ratingUnknownCourse')}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {t('manage.questionPool.ratingBlindDescription')}
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  {currentItem
                    ? t('manage.questionPool.ratingQuestionPosition', {
                        current: currentItem.position,
                        total: items.length,
                      })
                    : t('manage.questionPool.ratingSessionOverview')}
                </div>
              </div>
              <div className="mt-3">
                <RatingProgress items={items} />
              </div>
              <div className="mt-4">
                <RatingItemNavigation
                  items={items}
                  selectedItemId={selectedItemId}
                  pending={pending}
                  onSelect={selectItem}
                />
              </div>
            </section>

            {coursesError ? (
              <div role="alert">
                <UserNotification
                  type="error"
                  message={t('manage.questionPool.ratingCoursesError')}
                >
                  <button
                    type="button"
                    className="cursor-pointer font-bold underline"
                    onClick={() => void onRetryCourses()}
                    disabled={coursesLoading}
                    data-cy="lecturer-rating-retry-courses"
                  >
                    {t('manage.questionPool.ratingRetry')}
                  </button>
                </UserNotification>
              </div>
            ) : null}

            {sessionError ? (
              <div role="alert">
                <UserNotification type="error" message={t(sessionError.key)}>
                  {sessionError.retry ? (
                    <button
                      type="button"
                      className="cursor-pointer font-bold underline"
                      onClick={retryRequest}
                      disabled={pending !== null}
                      data-cy="lecturer-rating-retry"
                    >
                      {t('manage.questionPool.ratingRetry')}
                    </button>
                  ) : null}
                </UserNotification>
              </div>
            ) : null}

            {items.length === 0 ? (
              <UserNotification
                type="info"
                message={t('manage.questionPool.ratingNoQuestions')}
              />
            ) : null}

            {ratingComplete && !currentItem ? (
              <UserNotification
                type="success"
                message={t('manage.questionPool.ratingComplete')}
              />
            ) : null}

            {currentItem ? (
              <section className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {currentItem.format}
                  </span>
                  <span className="text-xs text-slate-500">
                    {t('manage.questionPool.ratingElementVersion', {
                      version: currentItem.elementVersion,
                    })}
                  </span>
                </div>
                {currentItem.unavailable ? (
                  <div className="mt-4" role="alert">
                    <UserNotification
                      type="warning"
                      message={t(
                        'manage.questionPool.ratingQuestionUnavailable'
                      )}
                    />
                  </div>
                ) : null}

                {!currentItem.unavailable ? (
                  <>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      {currentItem.title}
                    </h3>
                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t('manage.questionPool.ratingStemLabel')}
                      </div>
                      <div className="mt-2 rounded-md bg-slate-50 p-3">
                        <Markdown
                          withProse
                          content={currentItem.stem}
                          data={{ cy: 'lecturer-rating-stem' }}
                        />
                      </div>
                    </div>
                    <div className="mt-5">
                      <QuestionAnswerKey item={currentItem} />
                    </div>
                    <div className="mt-6 grid gap-6">
                      <DifficultyScale
                        format={currentItem.format}
                        value={currentDraft?.difficulty}
                        disabled={controlsDisabled}
                        onChange={(value) =>
                          updateDraft(currentItem.id, 'difficulty', value)
                        }
                      />
                      <BloomScale
                        value={currentDraft?.bloom}
                        disabled={controlsDisabled}
                        onChange={(value) =>
                          updateDraft(currentItem.id, 'bloom', value)
                        }
                      />
                    </div>
                  </>
                ) : null}

                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  {currentItem.unavailable ? (
                    <Button
                      type="button"
                      onClick={() => {
                        const nextItem = getNextPendingItem(
                          items,
                          currentItem.id
                        )
                        setSelectedItemId(nextItem?.id ?? null)
                      }}
                      disabled={pending !== null}
                      data={{ cy: 'lecturer-rating-next-question' }}
                    >
                      <Button.Label>
                        {t('manage.questionPool.ratingNextQuestion')}
                      </Button.Label>
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        onClick={() => void persistRating(currentItem, 'skip')}
                        loading={pending === 'skip'}
                        disabled={controlsDisabled}
                        data={{ cy: 'lecturer-rating-skip' }}
                      >
                        <Button.Label>
                          {t('manage.questionPool.ratingSkip')}
                        </Button.Label>
                      </Button>
                      <Button
                        primary
                        type="button"
                        onClick={() => void persistRating(currentItem, 'save')}
                        loading={pending === 'save'}
                        disabled={
                          controlsDisabled ||
                          (currentDraft?.difficulty == null &&
                            !currentDraft?.bloom)
                        }
                        data={{ cy: 'lecturer-rating-save-next' }}
                      >
                        <Button.Label>
                          {t('manage.questionPool.ratingSaveNext')}
                        </Button.Label>
                      </Button>
                    </>
                  )}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  )
}

function LecturerRatingEntry() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const {
    data,
    loading: coursesLoading,
    error: coursesError,
    refetch: refetchCourses,
  } = useQuery(LecturerRatingCoursesDocument, {
    fetchPolicy: 'cache-and-network',
  })
  const courses = data?.lecturerRatingCourses ?? []

  if (!open && !courses.length && !coursesError) return null

  return (
    <>
      <section
        className="w-full rounded-lg border border-slate-200 bg-white p-3"
        data-cy="lecturer-rating-entry"
      >
        <h3 className="text-sm font-semibold text-slate-900">
          {t('manage.questionPool.ratingEntryTitle')}
        </h3>
        <p className="mt-1 text-xs leading-snug text-slate-600">
          {t('manage.questionPool.ratingEntryDescription')}
        </p>
        {coursesError ? (
          <div className="mt-3" role="alert">
            <UserNotification
              type="error"
              message={t('manage.questionPool.ratingCoursesError')}
            >
              <button
                type="button"
                className="cursor-pointer font-bold underline"
                onClick={() => void refetchCourses()}
                disabled={coursesLoading}
                data-cy="lecturer-rating-entry-retry"
              >
                {t('manage.questionPool.ratingRetry')}
              </button>
            </UserNotification>
          </div>
        ) : null}
        <Button
          fluid
          type="button"
          className={{
            root: 'mt-3 h-auto min-h-9 whitespace-normal py-2',
          }}
          disabled={coursesLoading || Boolean(coursesError) || !courses.length}
          onClick={() => setOpen(true)}
          data={{ cy: 'lecturer-rating-open' }}
        >
          <Button.Label>
            {t('manage.questionPool.ratingEntryAction')}
          </Button.Label>
        </Button>
      </section>

      {open ? (
        <LecturerRatingModal
          courses={courses}
          coursesLoading={coursesLoading}
          coursesError={Boolean(coursesError)}
          onRetryCourses={refetchCourses}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

export default LecturerRatingEntry
