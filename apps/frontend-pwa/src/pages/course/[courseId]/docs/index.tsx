import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { GetServerSidePropsContext } from 'next'
import dynamic from 'next/dynamic'
import DocsLayout from '../../../../components/docs/DocsLayout'

const DynamicMarkdown = dynamic(
  async () => {
    const { Markdown } = await import('@klicker-uzh/markdown')
    return Markdown
  },
  {
    ssr: false,
  }
)

function Landing() {
  return (
    <DocsLayout>
      {(courseInformation) => (
        <DynamicMarkdown
          className={{ root: 'prose-headings:mt-0' }}
          content={
            courseInformation.description ??
            `
In dieser Dokumentation finden Sie die wichtigsten Informationen zum KlickerUZH in Ihrem Kurs:

- [Erstmaliges Log-in und Profileinrichtung](docs/login)
- [Installation der KlickerUZH-App](docs/appSetup)
- [Wichtige Features des KlickerUZH](docs/features)
`
          }
        />
      )}
    </DocsLayout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (typeof ctx.params?.courseId !== 'string') {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

  const { participantToken, participant } = await getParticipantToken({
    apolloClient,
    ctx,
  })

  const result = await apolloClient.query({
    query: GetBasicCourseInformationDocument,
    variables: {
      courseId: ctx.params.courseId as string,
    },
    context: participantToken
      ? {
          headers: {
            authorization: `Bearer ${participantToken}`,
          },
        }
      : undefined,
  })

  if (!result.data.basicCourseInformation) {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  return addApolloState(apolloClient, {
    props: {
      courseId: ctx.params.courseId,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}.json`))
        .default,
    },
  })
}

export default Landing
