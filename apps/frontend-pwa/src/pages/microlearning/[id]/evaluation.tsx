import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import useStackEvaluationAggregation from '@components/hooks/useStackEvaluationAggregation'
import { faCheckCircle } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetMicroLearningDocument,
  GetParticipationDocument,
  MarkMicroLearningCompletedDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

function MicrolearningEvaluation() {
  const t = useTranslations()
  const router = useRouter()
  const id = router.query.id as string

  const { loading, data } = useQuery(GetMicroLearningDocument, {
    variables: { id },
    skip: !id,
  })
  const { data: participant } = useQuery(SelfDocument)
  const { data: participation } = useQuery(GetParticipationDocument, {
    variables: { courseId: data?.microLearning?.course?.id ?? '' },
    skip: !data?.microLearning?.course?.id,
  })

  const [markMicrolearningCompleted] = useMutation(
    MarkMicroLearningCompletedDocument
  )

  const microlearning = data?.microLearning
  const aggregatedResults = useStackEvaluationAggregation({ microlearning })

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
      <div className="flex flex-col gap-3 md:max-w-5xl md:mx-auto md:w-full md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
        <div className="flex flex-row items-center gap-4">
          <FontAwesomeIcon
            icon={faCheckCircle}
            className="text-green-600 w-14 h-14"
          />
          <div>
            <H3>{t('shared.generic.congrats')}</H3>
            <p>
              {t.rich('pwa.microSession.solvedMicrolearning', {
                name: microlearning.displayName,
                it: (text) => <span className="italic">{text}</span>,
              })}
            </p>
          </div>
        </div>
        <div>
          <div className="flex flex-col items-center justify-between mt-3 md:flex-row md:mt-0">
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
                <div className="flex flex-row justify-between" key={stack.id}>
                  <div>
                    {stack.displayName ||
                      t('pwa.microSession.questionSetN', { number: ix + 1 })}
                  </div>
                  <div>
                    {typeof aggregatedResults.evaluation[stack.id]
                      ?.pointsAwarded !== 'undefined' &&
                      aggregatedResults.evaluation[stack.id]?.pointsAwarded !==
                        null &&
                      `${
                        aggregatedResults.evaluation[stack.id]?.pointsAwarded
                      }/`}
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

        {participation?.getParticipation && (
          <div className="text-right">
            <Button
              onClick={async () => {
                await markMicrolearningCompleted({
                  variables: {
                    courseId: microlearning.course!.id,
                    id,
                  },
                })
                router.replace('/')
              }}
              data={{ cy: 'finish-microlearning' }}
            >
              {t('shared.generic.finish')}
            </Button>
          </div>
        )}
        {typeof participation?.getParticipation?.isActive === 'boolean' &&
          participation?.getParticipation?.isActive === false && (
            <UserNotification type="info">
              {t.rich('pwa.microSession.inactiveParticipation', {
                it: (text) => <span className="italic">{text}</span>,
                name: microlearning.displayName,
              })}
            </UserNotification>
          )}
        {participant?.self && !participation?.getParticipation && (
          <UserNotification className={{ root: 'mt-5' }} type="info">
            {t.rich('pwa.microSession.missingParticipation', {
              it: (text) => <span className="italic">{text}</span>,
              name: microlearning.displayName,
            })}
          </UserNotification>
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
