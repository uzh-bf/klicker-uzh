import { useMutation, useQuery } from '@apollo/client'
import { faCheckCircle } from '@fortawesome/free-regular-svg-icons'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetMicroLearningDocument,
  GetParticipationDocument,
  MarkMicroLearningCompletedDocument,
  SelfDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import PreviewMessage from '../../../../../components/common/PreviewMessage'
import CourseDiscussionPanel from '../../../../../components/course/CourseDiscussionPanel'
import useStackEvaluationAggregation from '../../../../../components/hooks/useStackEvaluationAggregation'
import Layout from '../../../../../components/Layout'

function MicrolearningEvaluation() {
  const t = useTranslations()
  const router = useRouter()
  const id = router.query.id as string
  const [selectedDiscussionStackId, setSelectedDiscussionStackId] = useState<
    number | null
  >(null)
  const [mobileDiscussionOpen, setMobileDiscussionOpen] = useState(false)

  const { loading, data } = useQuery(GetMicroLearningDocument, {
    variables: { id },
    skip: !id,
  })
  const { data: participant } = useQuery(SelfDocument)
  const { data: participation } = useQuery(GetParticipationDocument, {
    variables: { courseId: data?.microLearning?.course?.id ?? '' },
    skip: !data?.microLearning?.course?.id,
  })

  const [markMicrolearningCompleted, { loading: markingAsCompleted }] =
    useMutation(MarkMicroLearningCompletedDocument)

  const microlearning = data?.microLearning
  const aggregatedResults = useStackEvaluationAggregation({
    microlearning: microlearning,
  })
  const courseQAAvailable =
    !!microlearning?.course?.isCourseQARolloutEnabled &&
    !!microlearning?.course?.isCourseQAEnabled
  const selectedDiscussionStack =
    microlearning?.stacks?.find(
      (stack) => stack.id === selectedDiscussionStackId
    ) ?? microlearning?.stacks?.[0]

  if (loading || !microlearning) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  return (
    <Layout
      displayName={microlearning.displayName}
      course={microlearning.course ?? undefined}
    >
      <div
        className={twMerge(
          'flex flex-col gap-3 md:mx-auto md:mb-4 md:w-full md:max-w-6xl md:rounded md:border md:p-8 md:pt-6',
          courseQAAvailable && 'md:max-w-7xl'
        )}
      >
        {microlearning.isOwner ? (
          <PreviewMessage
            activityType={t('shared.generic.microlearning')}
            name={microlearning.name}
            displayName={microlearning.displayName}
            className="mb-2"
          />
        ) : null}
        <div className="flex flex-row items-center gap-4">
          <FontAwesomeIcon
            icon={faCheckCircle}
            className="text-green-700"
            size="3x"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <H3>{t('shared.generic.congrats')}</H3>
            <p>
              {t.rich('pwa.microLearning.solvedMicrolearning', {
                name: microlearning.displayName,
                it: (text) => <span className="italic">{text}</span>,
              })}
            </p>
          </div>
        </div>
        <div
          className={twMerge(
            'w-full',
            courseQAAvailable &&
              'flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]'
          )}
        >
          <div
            className={twMerge(
              'min-w-0',
              courseQAAvailable && 'order-2 lg:order-1'
            )}
          >
            <div>
              <div className="mt-3 flex flex-col items-center justify-between md:mt-0 md:flex-row">
                <H3 className={{ root: 'flex flex-row justify-between' }}>
                  {t('shared.generic.evaluation')}
                </H3>
                <H3 className={{ root: 'self-end text-base md:text-lg' }}>
                  {participation?.getParticipation?.isActive
                    ? t('pwa.practiceQuiz.pointsCollectedPossible')
                    : t('pwa.practiceQuiz.pointsComputedAvailable')}
                </H3>
              </div>
              <div>
                {aggregatedResults &&
                  aggregatedResults.evaluation &&
                  data.microLearning?.stacks?.map((stack, ix) => (
                    <div
                      className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
                      key={stack.id}
                    >
                      <div className="min-w-0 break-words">
                        {stack.displayName ||
                          t('pwa.microLearning.questionSetN', {
                            number: ix + 1,
                          })}
                      </div>
                      <div className="shrink-0">
                        {typeof aggregatedResults.evaluation[stack.id]
                          ?.pointsAwarded !== 'undefined' &&
                          aggregatedResults.evaluation[stack.id]
                            ?.pointsAwarded !== null &&
                          participation?.getParticipation?.isActive &&
                          `${aggregatedResults.evaluation[stack.id]?.pointsAwarded}/`}
                        {aggregatedResults.evaluation[stack.id]?.score}
                        {`/${aggregatedResults.evaluation[stack.id]?.maxPoints}`}
                      </div>
                    </div>
                  ))}
              </div>

              {participation?.getParticipation?.isActive && (
                <H3 className={{ root: 'mt-4 text-right' }}>
                  {t('pwa.practiceQuiz.totalPoints', {
                    points: aggregatedResults?.totalPointsAwarded ?? 0,
                  })}
                </H3>
              )}
            </div>

            {typeof participation?.getParticipation?.isActive === 'boolean' &&
              participation?.getParticipation?.isActive === false && (
                <UserNotification type="info">
                  {t.rich('pwa.microLearning.inactiveParticipation', {
                    it: (text) => <span className="italic">{text}</span>,
                    name: microlearning.displayName,
                  })}
                </UserNotification>
              )}
            {participant?.self &&
              participant.self.role === UserRole.Participant &&
              !participation?.getParticipation && (
                <UserNotification className={{ root: 'mt-5' }} type="info">
                  {t.rich('pwa.microLearning.missingParticipation', {
                    it: (text) => <span className="italic">{text}</span>,
                    name: microlearning.displayName,
                  })}
                </UserNotification>
              )}
            {participation?.getParticipation && (
              <div className="text-right">
                <Button
                  primary
                  loading={markingAsCompleted}
                  onClick={async () => {
                    await markMicrolearningCompleted({
                      variables: { courseId: microlearning.course!.id, id },
                    })
                    router.replace('/')
                  }}
                  data={{ cy: 'finish-microlearning' }}
                >
                  <Button.Label>{t('shared.generic.finish')}</Button.Label>
                </Button>
              </div>
            )}
          </div>

          {courseQAAvailable &&
            microlearning.course?.id &&
            selectedDiscussionStack && (
              <aside
                aria-label={t('pwa.courseQA.title')}
                className="order-1 mt-3 min-w-0 border-b border-gray-200 pb-4 lg:order-2 lg:mt-0 lg:border-0 lg:pb-0"
                data-cy="microlearning-evaluation-qa-panel"
              >
                <button
                  type="button"
                  onClick={() => setMobileDiscussionOpen((open) => !open)}
                  aria-expanded={mobileDiscussionOpen}
                  aria-controls="microlearning-evaluation-qa-content"
                  className="flex w-full items-center justify-between gap-2 rounded-sm text-left text-sm font-semibold text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 lg:hidden"
                  data-cy="microlearning-evaluation-qa-toggle"
                >
                  <span>{t('pwa.courseQA.title')}</span>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={twMerge(
                      'shrink-0 text-gray-500 motion-safe:transition-transform',
                      mobileDiscussionOpen && 'rotate-180'
                    )}
                    aria-hidden="true"
                  />
                </button>
                <div
                  id="microlearning-evaluation-qa-content"
                  className={twMerge(
                    'mt-4 hidden',
                    mobileDiscussionOpen && 'block',
                    'lg:sticky lg:top-4 lg:mt-0 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto'
                  )}
                >
                  <H3 className={{ root: 'mb-2 hidden lg:block' }}>
                    {t('pwa.courseQA.title')}
                  </H3>
                  <label
                    className="mb-1 block text-sm font-semibold text-gray-700"
                    htmlFor="microlearning-evaluation-discussion-stack"
                  >
                    {t('pwa.courseQA.discussionContext')}
                  </label>
                  <select
                    id="microlearning-evaluation-discussion-stack"
                    name="microlearning-evaluation-discussion-stack"
                    value={selectedDiscussionStack.id}
                    onChange={(event) =>
                      setSelectedDiscussionStackId(
                        Number.parseInt(event.target.value, 10)
                      )
                    }
                    className="mb-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    data-cy="microlearning-evaluation-qa-context"
                  >
                    {microlearning.stacks?.map((stack, ix) => (
                      <option key={stack.id} value={stack.id}>
                        {stack.displayName ||
                          t('pwa.microLearning.questionSetN', {
                            number: ix + 1,
                          })}
                      </option>
                    ))}
                  </select>
                  <CourseDiscussionPanel
                    key={selectedDiscussionStack.id}
                    courseId={microlearning.course.id}
                    scopeKey={`stack:${selectedDiscussionStack.id}`}
                    compact
                    showTitle={false}
                    className="mx-0 max-w-none"
                    idPrefix={`microlearning-evaluation-qa-${selectedDiscussionStack.id}`}
                  />
                </div>
              </aside>
            )}
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default MicrolearningEvaluation
