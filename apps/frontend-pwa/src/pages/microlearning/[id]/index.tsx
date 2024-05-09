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
import { Button, H3, Prose, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPaths, GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'

function MicrolearningIntroduction({ id }: { id: string }) {
  const t = useTranslations()
  const router = useRouter()

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
      <div className="flex flex-col w-full md:p-8 md:pt-6 md:w-full md:border md:rounded md:max-w-3xl md:mx-auto">
        {!selfData?.self && (
          <UserNotification type="warning" className={{ root: 'mb-4' }}>
            {t.rich('pwa.general.userNotLoggedIn', {
              login: (text) => (
                <Button
                  basic
                  className={{
                    root: 'font-bold sm:hover:text-primary',
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
            root: 'max-w-none prose-p:mt-0 prose-headings:mt-0 prose-img:my-0 sm:hover:text-current',
          }}
        >
          <DynamicMarkdown
            content={data.microLearning.description ?? undefined}
          />
        </Prose>

        <div className="grid grid-cols-1 mb-4 text-sm md:mb-0 md:grid-cols-2 gap-y-1">
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
              root: 'justify-center w-full text-lg md:w-auto md:self-end',
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

export async function getStaticProps(ctx: GetStaticPropsContext) {
  if (typeof ctx.params?.id !== 'string') {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    }
  }

  const apolloClient = initializeApollo()

  try {
    await apolloClient.query({
      query: GetMicroLearningDocument,
      variables: { id: ctx.params.id },
    })
  } catch (e) {
    console.error(e)
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    }
  }

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
    revalidate: 60,
  })
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default MicrolearningIntroduction
