import { useQuery } from '@apollo/client'
import { GetMicroSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { Button, H3, Prose, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPaths, GetStaticProps } from 'next'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import Link from 'next/link'
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

  const { loading, error, data } = useQuery(GetMicroSessionDocument, {
    variables: { id },
  })

  if (loading) return <p>{t('shared.generic.loading')}</p>
  if (!data?.microSession) {
    return (
      <Layout>
        <UserNotification
          notificationType="error"
          message="Unter diesem Link existiert keine Micro-Session oder diese ist noch
          nicht aktiv"
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
