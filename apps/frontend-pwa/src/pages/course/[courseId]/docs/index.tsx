import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import DocsLayout from '../../../../components/docs/DocsLayout'

function Landing() {
  const t = useTranslations()

  return (
    <DocsLayout>
      {(courseInformation) => (
        <DynamicMarkdown
          withProse
          className={{ root: 'prose-headings:mt-0 prose-p:mt-0' }}
          content={
            courseInformation.description ?? t('pwa.studentDocs.pageList')
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
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default Landing
