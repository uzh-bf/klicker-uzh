import { useQuery } from '@apollo/client'
import {
  GetMicroSessionDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import {
  Button,
  H3,
  Prose,
  ThemeContext,
  UserNotification,
} from '@uzh-bf/design-system'
import { GetStaticPaths, GetStaticProps } from 'next'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
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
  const theme = useContext(ThemeContext)

  const { loading, error, data } = useQuery(GetMicroSessionDocument, {
    variables: { id },
  })
  const { data: selfData } = useQuery(SelfDocument)

  if (loading) return <p>{t('shared.generic.loading')}</p>
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
  if (error) return <p>Oh no... {error.message}</p>

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
                    root: twMerge('font-bold', theme.primaryTextHover),
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
            root: 'max-w-none prose-p:mt-0 prose-headings:mt-0 prose-img:my-0 hover:text-current',
          }}
        >
          <DynamicMarkdown content={data.microSession.description} />
        </Prose>
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

export const getStaticProps: GetStaticProps = async (ctx) => {
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
      messages: {
        ...require(`shared-components/src/intl-messages/${ctx.locale}.json`),
      },
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
