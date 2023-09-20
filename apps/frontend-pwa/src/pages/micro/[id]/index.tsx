import { useQuery } from '@apollo/client'
import {
  faClock,
  faQuestionCircle,
  faTimesCircle,
} from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetMicroSessionDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { Button, H3, Prose, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPaths, GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'

const DynamicMarkdown = dynamic(
  async () => {
    const { Markdown } = await import('@klicker-uzh/markdown')
    return Markdown
  },
  {
    ssr: false,
  }
)

interface Props {
  id: string
}

function MicroSessionIntroduction({ id }: Props) {
  const t = useTranslations()
  const router = useRouter()

  const { loading, error, data } = useQuery(GetMicroSessionDocument, {
    variables: { id },
  })
  const { data: selfData } = useQuery(SelfDocument)

  if (loading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (!data?.microSession) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('pwa.microSession.notFound')}
        />
      </Layout>
    )
  }
  if (error) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  return (
    <Layout
      displayName={data.microSession.displayName}
      course={data.microSession.course ?? undefined}
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
                >
                  {text}
                </Button>
              ),
            })}
          </UserNotification>
        )}
        <H3>{data.microSession.displayName}</H3>
        <Prose
          className={{
            root: 'max-w-none prose-p:mt-0 prose-headings:mt-0 prose-img:my-0 sm:hover:text-current',
          }}
        >
          <DynamicMarkdown content={data.microSession.description} />
        </Prose>

        <div className="grid grid-cols-1 mb-4 md:mb-0 md:grid-cols-2 text-sm gap-y-1">
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faQuestionCircle} />
            <div>
              {t('pwa.learningElement.numOfQuestions', {
                number: data.microSession.instances?.length,
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faTimesCircle} />
            <div>
              {t('pwa.learningElement.multiplicatorPoints', {
                mult: data.microSession.pointsMultiplier,
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faClock} />
            <div>
              {t('pwa.microSession.availableFrom', {
                date: dayjs(data.microSession.scheduledStartAt).format(
                  'DD.MM.YYYY HH:mm'
                ),
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faClock} />
            <div>
              {t('pwa.microSession.availableUntil', {
                date: dayjs(data.microSession.scheduledEndAt).format(
                  'DD.MM.YYYY HH:mm'
                ),
              })}
            </div>
          </div>
        </div>

        <Link href={`/micro/${data.microSession.id}/0`} legacyBehavior>
          <Button
            className={{
              root: 'justify-center w-full text-lg md:w-auto md:self-end',
            }}
            data={{ cy: 'start-micro-session' }}
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
      query: GetMicroSessionDocument,
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

export default MicroSessionIntroduction
