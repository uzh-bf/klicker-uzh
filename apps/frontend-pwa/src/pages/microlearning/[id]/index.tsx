import { useQuery } from '@apollo/client'
import {
  faClock,
  faQuestionCircle,
  faTimesCircle,
} from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetMicroLearningDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { Button, H3, Prose, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'

function MicrolearningIntroduction({
  id,
  participantToken,
  cookiesAvailable,
}: {
  id: string
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()
  const router = useRouter()

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { loading, error, data } = useQuery(GetMicroLearningDocument, {
    variables: { id },
    skip: !id,
  })
  const { data: selfData } = useQuery(SelfDocument)

  if (loading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (!data?.microLearning) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('pwa.microLearning.notFound')}
        />
      </Layout>
    )
  }
  if (error) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  return (
    <Layout
      displayName={data.microLearning.displayName}
      course={data.microLearning.course ?? undefined}
    >
      <div className="flex w-full flex-col md:mx-auto md:w-full md:max-w-3xl md:rounded md:border md:p-8 md:pt-6">
        {!selfData?.self && (
          <UserNotification type="warning" className={{ root: 'mb-4' }}>
            {t.rich('pwa.general.userNotLoggedIn', {
              login: (text) => (
                <Button
                  basic
                  className={{
                    root: 'hover:text-primary-100 font-bold',
                  }}
                  onClick={() =>
                    router.push(
                      `/login?expired=true&redirect_to=${
                        encodeURIComponent(
                          window?.location?.pathname +
                            (window?.location?.search ?? '')
                        ) ?? '/'
                      }`
                    )
                  }
                  data={{ cy: 'login-to-start-microlearning' }}
                >
                  {text}
                </Button>
              ),
            })}
          </UserNotification>
        )}
        <H3>{data.microLearning.displayName}</H3>
        <Prose
          className={{
            root: 'prose-p:mt-0 prose-headings:mt-0 prose-img:my-0 max-w-none hover:text-current',
          }}
        >
          <DynamicMarkdown
            content={data.microLearning.description ?? undefined}
          />
        </Prose>

        <div className="mb-4 grid grid-cols-1 gap-y-1 text-sm md:mb-0 md:grid-cols-2">
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faQuestionCircle} />
            <div>
              {t('pwa.microLearning.numOfQuestionSets', {
                number: data.microLearning.stacks?.length,
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faTimesCircle} />
            <div>
              {t('pwa.practiceQuiz.multiplicatorPoints', {
                mult: data.microLearning.pointsMultiplier,
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faClock} />
            <div>
              {t('pwa.microLearning.availableFrom', {
                date: dayjs(data.microLearning.scheduledStartAt).format(
                  'DD.MM.YYYY HH:mm'
                ),
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faClock} />
            <div>
              {t('pwa.microLearning.availableUntil', {
                date: dayjs(data.microLearning.scheduledEndAt).format(
                  'DD.MM.YYYY HH:mm'
                ),
              })}
            </div>
          </div>
        </div>

        <Link href={`/microlearning/${data.microLearning.id}/0`} legacyBehavior>
          <Button
            className={{
              root: 'w-full justify-center text-lg md:w-auto md:self-end',
            }}
            data={{ cy: 'start-microlearning' }}
          >
            {t('shared.generic.begin')}
          </Button>
        </Link>
      </div>
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (typeof ctx.params?.id !== 'string') {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    }
  }

  const apolloClient = initializeApollo()

  const { participantToken, cookiesAvailable } = await getParticipantToken({
    apolloClient,
    ctx,
  })

  if (participantToken) {
    return {
      props: {
        participantToken,
        cookiesAvailable,
        id: ctx.params.id,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
  }

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      courseId: ctx.params.courseId,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default MicrolearningIntroduction
