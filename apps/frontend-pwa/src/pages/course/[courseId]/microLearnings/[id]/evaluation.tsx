import { faCheckCircle } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc } from '@lib/trpc'
import { Button, H3, UserNotification, toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import PreviewMessage from '../../../../../components/common/PreviewMessage'
import useStackEvaluationAggregation from '../../../../../components/hooks/useStackEvaluationAggregation'
import Layout from '../../../../../components/Layout'

const PARTICIPANT_ROLE = 'PARTICIPANT'

function MicrolearningEvaluation() {
  const t = useTranslations()
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : ''

  const utils = trpc.useUtils()
  const { isLoading, error, data } = trpc.participant.microLearning.useQuery(
    { id },
    { enabled: id !== '' }
  )
  const { data: participant, error: participantError } =
    trpc.participant.self.useQuery()
  const { data: participationData, error: participationError } =
    trpc.participant.participation.useQuery(
      { courseId: data?.microLearning?.course?.id ?? '' },
      { enabled: !!data?.microLearning?.course?.id }
    )
  const markMicrolearningCompleted =
    trpc.participant.markMicroLearningCompleted.useMutation()

  const microlearning = data?.microLearning
  const participation = participationData?.participation
  const participantUnavailable = Boolean(participantError && !participant?.self)
  const participationUnavailable = Boolean(participationError && !participation)
  const aggregatedResults = useStackEvaluationAggregation({
    microlearning: microlearning,
  })
  const [finishPending, setFinishPending] = useState(false)
  const finishingMicrolearning =
    markMicrolearningCompleted.isLoading || finishPending

  if (isLoading && !microlearning) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (error && !microlearning) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  if (!microlearning) {
    return (
      <Layout>
        <UserNotification
          type="warning"
          message={t('pwa.microLearning.notFound')}
        />
      </Layout>
    )
  }

  return (
    <Layout
      displayName={microlearning.displayName}
      course={microlearning.course ?? undefined}
    >
      <div className="flex flex-col gap-3 md:mx-auto md:mb-4 md:w-full md:max-w-6xl md:rounded md:border md:p-8 md:pt-6">
        {error && microlearning ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
          />
        ) : null}
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
          />
          <div>
            <H3>{t('shared.generic.congrats')}</H3>
            <p>
              {t.rich('pwa.microLearning.solvedMicrolearning', {
                name: microlearning.displayName,
                it: (text) => <span className="italic">{text}</span>,
              })}
            </p>
          </div>
        </div>
        <div>
          <div className="mt-3 flex flex-col items-center justify-between md:mt-0 md:flex-row">
            <H3 className={{ root: 'flex flex-row justify-between' }}>
              {t('shared.generic.evaluation')}
            </H3>
            <H3 className={{ root: 'self-end text-base md:text-lg' }}>
              {participation?.isActive
                ? t('pwa.practiceQuiz.pointsCollectedPossible')
                : t('pwa.practiceQuiz.pointsComputedAvailable')}
            </H3>
          </div>
          <div>
            {aggregatedResults &&
              aggregatedResults.evaluation &&
              microlearning.stacks?.map((stack, ix) => (
                <div className="flex flex-row justify-between" key={stack.id}>
                  <div>
                    {stack.displayName ||
                      t('pwa.microLearning.questionSetN', { number: ix + 1 })}
                  </div>
                  <div>
                    {typeof aggregatedResults.evaluation[stack.id]
                      ?.pointsAwarded !== 'undefined' &&
                      aggregatedResults.evaluation[stack.id]?.pointsAwarded !==
                        null &&
                      participation?.isActive &&
                      `${
                        aggregatedResults.evaluation[stack.id]?.pointsAwarded
                      }/`}
                    {aggregatedResults.evaluation[stack.id]?.score}
                    {`/${aggregatedResults.evaluation[stack.id]?.maxPoints}`}
                  </div>
                </div>
              ))}
          </div>

          {participation?.isActive && (
            <H3 className={{ root: 'mt-4 text-right' }}>
              {t('pwa.practiceQuiz.totalPoints', {
                points: aggregatedResults?.totalPointsAwarded ?? 0,
              })}
            </H3>
          )}
        </div>

        {typeof participation?.isActive === 'boolean' &&
          participation?.isActive === false && (
            <UserNotification type="info">
              {t.rich('pwa.microLearning.inactiveParticipation', {
                it: (text) => <span className="italic">{text}</span>,
                name: microlearning.displayName,
              })}
            </UserNotification>
          )}
        {participantUnavailable || participationUnavailable ? (
          <UserNotification
            className={{ root: 'mt-5' }}
            type="error"
            message={t('shared.generic.systemError')}
          />
        ) : null}
        {participant?.self &&
          participant.self.role === PARTICIPANT_ROLE &&
          !participation &&
          !participationUnavailable && (
            <UserNotification className={{ root: 'mt-5' }} type="info">
              {t.rich('pwa.microLearning.missingParticipation', {
                it: (text) => <span className="italic">{text}</span>,
                name: microlearning.displayName,
              })}
            </UserNotification>
          )}
        {participation && (
          <div className="text-right">
            <Button
              primary
              disabled={finishingMicrolearning}
              loading={finishingMicrolearning}
              onClick={async () => {
                if (finishingMicrolearning) return

                setFinishPending(true)

                try {
                  await markMicrolearningCompleted.mutateAsync({
                    courseId: microlearning.course!.id,
                    id,
                  })
                  await utils.participant.participations.invalidate()
                  const routed = await router.replace('/')
                  if (!routed) throw new Error('Finish navigation failed')
                } catch (error) {
                  console.error(error)
                  toast({
                    type: 'error',
                    message: t('shared.generic.systemError'),
                    options: { duration: 5000 },
                  })
                  setFinishPending(false)
                }
              }}
              data={{ cy: 'finish-microlearning' }}
            >
              <Button.Label>{t('shared.generic.finish')}</Button.Label>
            </Button>
          </div>
        )}
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
