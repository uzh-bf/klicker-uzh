import { useMutation, useQuery } from '@apollo/client'
import {
  GetMicroSessionDocument,
  GetParticipationDocument,
  MarkMicroSessionCompletedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3 } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import Layout from '../../../components/Layout'

function Evaluation() {
  const t = useTranslations()
  const router = useRouter()

  const id = router.query.id as string
  const { loading, error, data } = useQuery(GetMicroSessionDocument, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-only',
  })

  const { data: participation } = useQuery(GetParticipationDocument, {
    variables: { courseId: data?.microSession?.course?.id ?? '' },
    skip: !data?.microSession?.course?.id,
  })

  const [markMicroSessionCompleted] = useMutation(
    MarkMicroSessionCompletedDocument
  )

  const totalPointsAwarded = useMemo(() => {
    if (!data?.microSession) return 0
    return data.microSession?.instances?.reduce(
      (acc, instance) => acc + (instance?.evaluation?.pointsAwarded ?? 0),
      0
    )
  }, [data?.microSession])

  if (loading || !data?.microSession) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  console.log(participation?.getParticipation)

  return (
    <Layout
      displayName={data.microSession.displayName}
      course={data.microSession.course ?? undefined}
    >
      <div className="flex flex-col gap-3 md:max-w-5xl md:mx-auto md:w-full md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
        <div>
          <H3>{t('shared.generic.congrats')}</H3>
          <p>
            {t.rich('pwa.microSession.solvedMicrolearning', {
              name: data.microSession.displayName,
              it: (text) => <span className="italic">{text}</span>,
            })}
          </p>
        </div>
        <div>
          <div className="flex flex-row items-center justify-between">
            <H3 className={{ root: 'flex flex-row justify-between' }}>
              {t('shared.generic.evaluation')}
            </H3>
            <H3>
              {participation?.getParticipation?.isActive
                ? t('pwa.learningElement.pointsCollectedPossible')
                : t('pwa.learningElement.pointsComputedAvailable')}
            </H3>
          </div>
          <div>
            {data.microSession.instances?.map((instance) => (
              <div className="flex flex-row justify-between" key={instance.id}>
                <div>{instance.questionData.name}</div>
                <div>
                  {typeof instance.evaluation?.pointsAwarded !== 'undefined' &&
                    instance.evaluation.pointsAwarded !== null &&
                    `${instance.evaluation?.pointsAwarded}/`}
                  {instance.evaluation?.score}
                  {`/10`}
                </div>
              </div>
            ))}
          </div>

          {participation?.getParticipation?.isActive && (
            <H3 className={{ root: 'mt-4 text-right' }}>
              {t('pwa.learningElement.totalPoints', {
                points: totalPointsAwarded,
              })}
            </H3>
          )}
        </div>

        {participation?.getParticipation?.isActive && (
          <div className="text-right">
            <Button
              onClick={async () => {
                await markMicroSessionCompleted({
                  variables: {
                    courseId: data.microSession!.course.id,
                    id,
                  },
                })
                router.replace('/')
              }}
            >
              {t('shared.generic.finish')}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  )
}

// TODO: show hint to activate participation or that 0 points were collected due to inactive participation

export async function getStaticProps({ locale }: GetServerSidePropsContext) {
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

export default Evaluation
