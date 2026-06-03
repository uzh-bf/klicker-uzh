import { useMutation, useQuery } from '@apollo/client'
import {
  AdaptiveAnswerInput,
  ElementType,
  FAdaptiveAttemptStateFragment,
  MStartAdaptiveAssessmentAttemptDocument,
  MSubmitAdaptiveAssessmentAnswerDocument,
  QAdaptiveStudentStandingDocument,
  QAdaptiveStudentStandingQuery,
  QPublishedAdaptiveAssessmentsDocument,
  QPublishedAdaptiveAssessmentsQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import CompetenceBars from '@klicker-uzh/shared-components/src/adaptive/CompetenceBars'
import LevelBadge from '@klicker-uzh/shared-components/src/adaptive/LevelBadge'
import LevelBand from '@klicker-uzh/shared-components/src/adaptive/LevelBand'
import {
  formatTheta,
  thetaToPercent,
} from '@klicker-uzh/shared-components/src/adaptive/utils'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { Button, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSidePropsContext } from 'next'
import { useRouter } from 'next/router'
import nookies from 'nookies'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../../components/Layout'

type PublishedAssessment = NonNullable<
  QPublishedAdaptiveAssessmentsQuery['publishedAdaptiveAssessmentInfos']
>[number]
type Standing = NonNullable<
  QAdaptiveStudentStandingQuery['adaptiveStudentStanding']
>
type AdaptiveElement = NonNullable<FAdaptiveAttemptStateFragment['nextElement']>

type Props = {
  courseId: string
  participantToken?: string
  cookiesAvailable?: boolean
}

function AdaptiveLearningPage({
  courseId,
  participantToken,
  cookiesAvailable,
}: Props) {
  const router = useRouter()
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<
    string | null
  >(null)
  const [attemptState, setAttemptState] =
    useState<FAdaptiveAttemptStateFragment | null>(null)
  const [selectedChoices, setSelectedChoices] = useState<
    Record<number, boolean>
  >({})
  const [freeTextResponse, setFreeTextResponse] = useState('')
  const [localElapsedSeconds, setLocalElapsedSeconds] = useState(0)
  const [attemptError, setAttemptError] = useState<string | null>(null)

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data, loading, error } = useQuery(
    QPublishedAdaptiveAssessmentsDocument,
    {
      variables: { courseId },
    }
  )
  const assessments = data?.publishedAdaptiveAssessmentInfos ?? []
  const selectedAssessment = useMemo(
    () =>
      assessments.find(
        (assessment) => assessment.id === selectedAssessmentId
      ) ??
      assessments[0] ??
      null,
    [assessments, selectedAssessmentId]
  )
  const {
    data: standingData,
    loading: loadingStanding,
    refetch: refetchStanding,
  } = useQuery(QAdaptiveStudentStandingDocument, {
    variables: { assessmentId: selectedAssessment?.id ?? '' },
    skip: !participantToken || !selectedAssessment?.id,
    fetchPolicy: 'network-only',
  })
  const standing = standingData?.adaptiveStudentStanding ?? null

  const [startAttempt, { loading: starting }] = useMutation(
    MStartAdaptiveAssessmentAttemptDocument
  )
  const [submitAnswer, { loading: submitting }] = useMutation(
    MSubmitAdaptiveAssessmentAnswerDocument
  )

  useEffect(() => {
    const requestedAssessmentId =
      typeof router.query.assessmentId === 'string'
        ? router.query.assessmentId
        : null
    const nextAssessmentId =
      requestedAssessmentId &&
      assessments.some((assessment) => assessment.id === requestedAssessmentId)
        ? requestedAssessmentId
        : assessments[0]?.id

    if (nextAssessmentId && nextAssessmentId !== selectedAssessmentId) {
      setSelectedAssessmentId(nextAssessmentId)
    }
  }, [assessments, router.query.assessmentId, selectedAssessmentId])

  useEffect(() => {
    setSelectedChoices({})
    setFreeTextResponse('')
    setLocalElapsedSeconds(attemptState?.progress.elapsedSeconds ?? 0)
  }, [
    attemptState?.nextAdaptiveElementId,
    attemptState?.progress.elapsedSeconds,
  ])

  useEffect(() => {
    if (
      !attemptState?.assessment.showTimer ||
      attemptState.progress.completed
    ) {
      return
    }

    const interval = window.setInterval(() => {
      setLocalElapsedSeconds((value) => value + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [attemptState?.assessment.showTimer, attemptState?.progress.completed])

  useEffect(() => {
    if (!attemptState || attemptState.progress.completed) return

    router.beforePopState(() => {
      setAttemptError(
        'Your standing updates after each answer. Please finish the active test before leaving.'
      )
      return false
    })

    return () => router.beforePopState(() => true)
  }, [attemptState, router])

  const loginRedirectPath =
    typeof window !== 'undefined'
      ? window.location.pathname + (window.location.search ?? '')
      : `/course/${courseId}/adaptive-learning`
  const activeElement = attemptState?.nextElement ?? null
  const choices = useMemo(() => {
    if (!isChoicesElement(activeElement)) return []
    return activeElement.options.choices
  }, [activeElement])
  const canSubmit =
    activeElement != null &&
    attemptState?.nextAdaptiveElementId != null &&
    (isChoicesElement(activeElement)
      ? activeElement.type === ElementType.Kprim
        ? choices.length > 0
        : choices.some((choice) => selectedChoices[choice.ix])
      : isFreeTextElement(activeElement)
        ? freeTextResponse.trim().length > 0
        : false)

  const startAdaptiveAttempt = async (assessmentId: string) => {
    setAttemptError(null)

    if (!participantToken) {
      await router.push(
        `/login?expired=true&redirect_to=${encodeURIComponent(
          loginRedirectPath
        )}`
      )
      return
    }

    try {
      const result = await startAttempt({
        variables: { assessmentId },
      })
      const nextState = result.data?.startAdaptiveAssessmentAttempt ?? null

      if (!nextState) {
        setAttemptError(
          'Adaptive learning could not be started. Please try again.'
        )
        return
      }

      setAttemptState(nextState)
      if (nextState.progress.completed) {
        await refetchStanding({ assessmentId })
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Adaptive learning could not be started.'

      if (message.includes('Unauthorized')) {
        await router.push(
          `/login?expired=true&redirect_to=${encodeURIComponent(
            loginRedirectPath
          )}`
        )
        return
      }

      setAttemptError(
        'You need to be logged in and enrolled in this course to start adaptive learning.'
      )
    }
  }

  const submitAdaptiveAnswer = async () => {
    if (!attemptState?.nextAdaptiveElementId || !activeElement) return

    const response: AdaptiveAnswerInput = isChoicesElement(activeElement)
      ? {
          choicesResponse: choices.map((choice) => ({
            ix: choice.ix,
            selected: Boolean(selectedChoices[choice.ix]),
          })),
        }
      : {
          freeTextResponse: freeTextResponse.trim(),
        }

    try {
      setAttemptError(null)
      const result = await submitAnswer({
        variables: {
          attemptId: attemptState.attempt.id,
          adaptiveElementId: attemptState.nextAdaptiveElementId,
          response,
        },
      })
      const nextState = result.data?.submitAdaptiveAssessmentAnswer ?? null
      setAttemptState(nextState)

      if (nextState?.progress.completed) {
        await refetchStanding({
          assessmentId: nextState.assessment.id,
        })
      }
    } catch (error) {
      setAttemptError(
        error instanceof Error
          ? error.message
          : 'The answer could not be submitted.'
      )
    }
  }

  if (loading) {
    return (
      <Layout displayName="Adaptive learning">
        <Loader />
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout displayName="Adaptive learning">
        <UserNotification
          type="error"
          message="Adaptive assessments could not be loaded."
        />
      </Layout>
    )
  }

  if (attemptState && !attemptState.progress.completed) {
    return (
      <Layout
        displayName={
          selectedAssessment?.courseName ?? attemptState.assessment.displayName
        }
      >
        <ActiveAttemptView
          courseName={
            selectedAssessment?.courseName ??
            attemptState.assessment.displayName
          }
          attemptState={attemptState}
          activeElement={activeElement}
          choices={choices}
          selectedChoices={selectedChoices}
          freeTextResponse={freeTextResponse}
          localElapsedSeconds={localElapsedSeconds}
          submitting={submitting}
          canSubmit={canSubmit}
          attemptError={attemptError}
          setSelectedChoices={setSelectedChoices}
          setFreeTextResponse={setFreeTextResponse}
          submitAdaptiveAnswer={submitAdaptiveAnswer}
        />
      </Layout>
    )
  }

  if (
    selectedAssessment &&
    (standing || attemptState?.progress.completed) &&
    !loadingStanding
  ) {
    return (
      <Layout displayName={selectedAssessment.courseName}>
        <CompletedStandingView
          assessment={selectedAssessment}
          standing={standing}
          attemptState={attemptState}
          courseId={courseId}
          retaking={starting}
          onRetake={() => startAdaptiveAttempt(selectedAssessment.id)}
        />
      </Layout>
    )
  }

  return (
    <Layout displayName={selectedAssessment?.courseName ?? 'Adaptive learning'}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {selectedAssessment?.courseName ?? 'Adaptive Learning'}
          </h1>
          <p className="mt-1 text-slate-600">
            Answer a targeted sequence of questions. Your standing updates after
            each answer.
          </p>
        </div>

        {attemptError && (
          <UserNotification type="warning" message={attemptError} />
        )}

        {assessments.length === 0 ? (
          <UserNotification
            type="info"
            message="No adaptive assessments are available for this course."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {assessments.map((assessment) => (
              <AssessmentCard
                key={assessment.id}
                assessment={assessment}
                selected={assessment.id === selectedAssessment?.id}
                participantToken={participantToken}
                starting={starting}
                onSelect={() => {
                  setSelectedAssessmentId(assessment.id)
                  startAdaptiveAttempt(assessment.id)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

function AssessmentCard({
  assessment,
  selected,
  participantToken,
  starting,
  onSelect,
}: {
  assessment: PublishedAssessment
  selected: boolean
  participantToken?: string
  starting: boolean
  onSelect: () => void
}) {
  return (
    <div
      className={twMerge(
        'rounded-lg border border-slate-200 bg-white p-5 shadow-sm',
        selected && 'border-primary-100 ring-primary-100 ring-1'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {assessment.displayName}
          </h2>
          {assessment.description && (
            <p className="mt-1 text-sm text-slate-600">
              {assessment.description}
            </p>
          )}
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          primary
          disabled={starting}
          loading={starting}
          onClick={onSelect}
        >
          <Button.Label>
            {participantToken ? 'Start adaptive test' : 'Log in to start'}
          </Button.Label>
        </Button>
      </div>
    </div>
  )
}

function ActiveAttemptView({
  courseName,
  attemptState,
  activeElement,
  choices,
  selectedChoices,
  freeTextResponse,
  localElapsedSeconds,
  submitting,
  canSubmit,
  attemptError,
  setSelectedChoices,
  setFreeTextResponse,
  submitAdaptiveAnswer,
}: {
  courseName: string
  attemptState: FAdaptiveAttemptStateFragment
  activeElement: AdaptiveElement | null
  choices: { ix: number; value: string }[]
  selectedChoices: Record<number, boolean>
  freeTextResponse: string
  localElapsedSeconds: number
  submitting: boolean
  canSubmit: boolean
  attemptError: string | null
  setSelectedChoices: (choices: Record<number, boolean>) => void
  setFreeTextResponse: (value: string) => void
  submitAdaptiveAnswer: () => void
}) {
  const progressPercent = Math.min(
    100,
    (attemptState.progress.answeredQuestions /
      Math.max(attemptState.progress.maxQuestions, 1)) *
      100
  )
  const currentQuestionNumber = attemptState.progress.answeredQuestions + 1

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">{courseName}</h1>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="bg-primary-100 h-full rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-500">
            Question {currentQuestionNumber}
          </div>
        </div>
        {attemptState.assessment.showTimer && (
          <div className="border-primary-20 bg-primary-20 text-primary-100 rounded-lg border px-4 py-2 text-right shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide">
              Elapsed time
            </div>
            <div className="mt-1 font-mono text-xl font-bold">
              {formatDuration(localElapsedSeconds)}
            </div>
          </div>
        )}
      </div>

      {attemptError && (
        <UserNotification type="warning" message={attemptError} />
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {attemptState.assessment.showCompetenceNames && (
            <span className="bg-uzh-turqoise-20 text-uzh-turqoise-100 rounded-md px-3 py-1 text-sm font-bold">
              {attemptState.nextCompetenceName ?? 'Adaptive item'}
              {attemptState.nextSubCompetenceName
                ? ` - ${attemptState.nextSubCompetenceName}`
                : ''}
            </span>
          )}
          <span className="text-sm font-semibold text-slate-400">
            {isSupportedElement(activeElement) ? `Q-${activeElement.id}` : ''}
          </span>
        </div>

        {isSupportedElement(activeElement) ? (
          <>
            <div className="text-xl font-bold text-slate-900">
              <Markdown
                withProse
                withLinkButtons={false}
                content={activeElement.content}
              />
            </div>

            {isChoicesElement(activeElement) && (
              <div className="mt-6 grid gap-3">
                {choices.map((choice, index) => (
                  <label
                    key={choice.ix}
                    className={twMerge(
                      'flex cursor-pointer items-center gap-4 rounded-lg border border-slate-200 p-4 text-lg font-semibold transition',
                      selectedChoices[choice.ix] &&
                        'border-primary-100 bg-primary-20 text-primary-100'
                    )}
                  >
                    <input
                      className="sr-only"
                      type={
                        activeElement.type === ElementType.Sc
                          ? 'radio'
                          : 'checkbox'
                      }
                      name="adaptive-choice"
                      checked={Boolean(selectedChoices[choice.ix])}
                      onChange={(event) => {
                        if (activeElement.type === ElementType.Sc) {
                          setSelectedChoices({
                            [choice.ix]: event.target.checked,
                          })
                        } else {
                          setSelectedChoices({
                            ...selectedChoices,
                            [choice.ix]: event.target.checked,
                          })
                        }
                      }}
                    />
                    <span
                      className={twMerge(
                        'flex h-10 w-10 flex-none items-center justify-center rounded-full border border-slate-300 text-base font-bold text-slate-500',
                        selectedChoices[choice.ix] &&
                          'border-primary-100 bg-primary-100 text-white'
                      )}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{choice.value}</span>
                  </label>
                ))}
              </div>
            )}

            {isFreeTextElement(activeElement) && (
              <textarea
                className="mt-6 min-h-32 w-full rounded-lg border border-slate-300 p-3 text-lg"
                value={freeTextResponse}
                onChange={(event) => setFreeTextResponse(event.target.value)}
              />
            )}

            {attemptState.assessment.showSolutions && (
              <SolutionPreview element={activeElement} />
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <div className="text-sm text-slate-500">
                Your standing updates after each answer. You cannot go back.
              </div>
              <Button
                primary
                disabled={submitting || !canSubmit}
                loading={submitting}
                onClick={submitAdaptiveAnswer}
              >
                <Button.Label>Submit answer</Button.Label>
              </Button>
            </div>
          </>
        ) : (
          <UserNotification
            type="info"
            message="No further question is available."
          />
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 md:grid-cols-[14rem_minmax(0,1fr)] md:items-center">
          <div>
            <div className="text-sm font-semibold uppercase text-slate-400">
              Current estimate
            </div>
            <div className="text-primary-100 mt-2 font-mono text-4xl font-bold">
              {formatTheta(attemptState.progress.theta)}
            </div>
            <div className="mt-2">
              <LevelBadge label={attemptState.progress.levelLabel} />
            </div>
          </div>
          <LevelBand
            levels={attemptState.assessment.levels}
            thetaMin={attemptState.assessment.thetaMin}
            thetaMax={attemptState.assessment.thetaMax}
            theta={attemptState.progress.theta}
            standardError={attemptState.progress.standardError}
          />
        </div>
      </div>
    </div>
  )
}

function CompletedStandingView({
  assessment,
  standing,
  attemptState,
  courseId,
  retaking,
  onRetake,
}: {
  assessment: PublishedAssessment
  standing: Standing | null
  attemptState: FAdaptiveAttemptStateFragment | null
  courseId: string
  retaking: boolean
  onRetake: () => void
}) {
  const router = useRouter()
  const [showSubCompetences, setShowSubCompetences] = useState(false)
  const theta = standing?.theta ?? attemptState?.progress.theta ?? 0
  const standardError =
    standing?.standardError ?? attemptState?.progress.standardError ?? 0
  const levelLabel = standing?.levelLabel ?? attemptState?.progress.levelLabel
  const message =
    standing?.message ??
    attemptState?.progress.message ??
    'Thanks for completing the adaptive learning test.'
  const standingMessages = standing?.messages ?? []
  const progressMessages = attemptState?.progress.messages ?? []
  const messages =
    standingMessages.length > 0
      ? standingMessages
      : progressMessages.length > 0
        ? progressMessages
        : [message]
  const answeredQuestions =
    standing?.answeredQuestions ?? attemptState?.progress.answeredQuestions ?? 0
  const completedAt =
    standing?.completedAt ?? attemptState?.attempt.completedAt ?? null
  const errorLower = theta - standardError
  const errorUpper = theta + standardError
  const competences =
    standing?.competences ??
    attemptState?.assessment.competences.map((competence) => ({
      competenceId: competence.id,
      competenceName: competence.name,
      theta: null,
      standardError: null,
      levelLabel: null,
      weight: competence.weight,
      answeredQuestions: 0,
      subCompetences: [],
    })) ??
    []
  const normalizedCompetences = competences.map((competence) => ({
    ...competence,
    theta: competence.theta ?? null,
    subCompetences: competence.subCompetences ?? [],
  }))
  const hasSubCompetences = normalizedCompetences.some(
    (competence) => competence.subCompetences.length > 0
  )
  const weakestCompetence = [...normalizedCompetences]
    .filter((competence) => competence.theta != null)
    .sort((a, b) => Number(a.theta) - Number(b.theta))[0]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My standing</h1>
          <p className="mt-1 text-slate-500">{assessment.courseName}</p>
        </div>
        <div className="text-right text-sm font-semibold text-slate-400">
          {completedAt
            ? `Completed ${dayjs(completedAt).format('D MMM YYYY')}`
            : 'Completed'}
          {' · '}
          {answeredQuestions} items
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid overflow-hidden rounded-lg md:grid-cols-[21rem_minmax(0,1fr)]">
          <div className="bg-primary-100 p-8 text-center text-white">
            <div className="font-semibold uppercase">Overall level</div>
            <div className="mt-4 text-5xl font-bold">
              {levelLabel ?? 'Unstarted'}
            </div>
            <div className="mt-5 rounded-full bg-white/20 px-4 py-2 font-mono">
              theta = {formatTheta(theta)}
            </div>
            <div className="mt-3 rounded-lg bg-white/10 px-4 py-3 text-left">
              <div className="text-xs font-bold uppercase text-white/70">
                Error interval
              </div>
              <div className="mt-1 font-mono text-lg font-bold">
                {formatTheta(errorLower)} to {formatTheta(errorUpper)}
              </div>
              <div className="mt-1 text-sm text-white/75">
                +/- {standardError.toFixed(2)} around the estimate
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-8 p-8">
            <div className="grid gap-3">
              {messages.map((entry, index) => (
                <p key={`${entry}-${index}`} className="text-xl text-slate-600">
                  {entry}
                </p>
              ))}
            </div>
            <LevelBand
              levels={assessment.levels}
              thetaMin={assessment.thetaMin}
              thetaMax={assessment.thetaMax}
              theta={theta}
              standardError={standardError}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {hasSubCompetences && (
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() =>
                setShowSubCompetences((currentValue) => !currentValue)
              }
            >
              <Button.Label>
                {showSubCompetences
                  ? 'Hide subcompetences'
                  : 'Show subcompetences'}
              </Button.Label>
            </Button>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {normalizedCompetences.map((competence) => (
            <div
              key={competence.competenceId}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <CompetenceBars
                competences={[competence]}
                thetaMin={assessment.thetaMin}
                thetaMax={assessment.thetaMax}
              />
              {showSubCompetences && (
                <SubCompetenceBreakdown
                  subCompetences={competence.subCompetences}
                  thetaMin={assessment.thetaMin}
                  thetaMax={assessment.thetaMax}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-slate-700">
          <span className="font-bold">What is theta?</span> Your ability is
          estimated on a continuous scale using item response theory. The named
          level is a band on that scale; the +/- value shows how precise the
          estimate is.
        </p>
      </div>

      <div className="bg-primary-20 flex flex-wrap items-center justify-between gap-4 rounded-lg p-5">
        <div>
          <div className="font-bold text-slate-900">
            Focus next on{' '}
            {weakestCompetence?.competenceName ?? 'your lowest competence'}
          </div>
          <div className="text-slate-600">
            Targeted practice will lift your overall standing.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={retaking} loading={retaking} onClick={onRetake}>
            <Button.Label>Retake adaptive test</Button.Label>
          </Button>
          <Button
            primary
            onClick={() =>
              router.push(`/course/${courseId}/practiceQuizzes/overview`)
            }
          >
            <Button.Label>Practice</Button.Label>
          </Button>
        </div>
      </div>
    </div>
  )
}

type StudentSubCompetenceScore = NonNullable<
  NonNullable<Standing>['competences'][number]['subCompetences']
>[number]

function SubCompetenceBreakdown({
  subCompetences,
  thetaMin,
  thetaMax,
}: {
  subCompetences: StudentSubCompetenceScore[]
  thetaMin: number
  thetaMax: number
}) {
  if (subCompetences.length === 0) return null

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
        Subcompetences
      </div>
      <div className="grid gap-3">
        {subCompetences.map((subCompetence) => {
          const percent =
            subCompetence.theta == null
              ? 0
              : thetaToPercent(subCompetence.theta, thetaMin, thetaMax)

          return (
            <div key={subCompetence.subCompetenceId} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-semibold text-slate-600">
                  {subCompetence.subCompetenceName}
                </span>
                <span className="flex-none font-mono font-semibold text-slate-500">
                  {formatTheta(subCompetence.theta)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="bg-primary-80 h-full rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SolutionPreview({ element }: { element: AdaptiveElement }) {
  const solutions = getSolutionEntries(element)
  if (solutions.length === 0) return null

  return (
    <div className="border-uzh-darkgreen-80 bg-uzh-darkgreen-20 mt-5 rounded-lg border border-dashed p-4 text-sm text-slate-700">
      <div className="text-uzh-darkgreen-100 font-bold">
        Solution shown for testing
      </div>
      <ul className="mt-2 grid gap-1">
        {solutions.map((solution, index) => (
          <li key={`${solution}-${index}`}>{solution}</li>
        ))}
      </ul>
    </div>
  )
}

function isChoicesElement(
  element: AdaptiveElement | null
): element is Extract<AdaptiveElement, { __typename: 'ChoicesElement' }> {
  return (
    element?.__typename === 'ChoicesElement' &&
    (element.type === ElementType.Sc ||
      element.type === ElementType.Mc ||
      element.type === ElementType.Kprim)
  )
}

function isFreeTextElement(
  element: AdaptiveElement | null
): element is Extract<AdaptiveElement, { __typename: 'FreeTextElement' }> {
  return element?.__typename === 'FreeTextElement'
}

function isSupportedElement(
  element: AdaptiveElement | null
): element is Extract<
  AdaptiveElement,
  { __typename: 'ChoicesElement' | 'FreeTextElement' }
> {
  return isChoicesElement(element) || isFreeTextElement(element)
}

function getSolutionEntries(element: AdaptiveElement) {
  if (isChoicesElement(element)) {
    return element.options.choices
      .filter((choice) => choice.correct)
      .map((choice) => choice.value)
  }

  if (isFreeTextElement(element)) {
    return element.options.solutions?.filter(Boolean) ?? []
  }

  return []
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
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
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    return addApolloState(apolloClient, {
      props: {
        courseId: ctx.params.courseId,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    })
  } catch (error) {
    console.error('Error in getServerSideProps on adaptive learning:', error)

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
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError`,
        statusCode: 302,
      },
    }
  }
}

export default AdaptiveLearningPage
