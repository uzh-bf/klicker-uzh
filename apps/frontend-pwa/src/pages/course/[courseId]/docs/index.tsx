import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { H3 } from '@uzh-bf/design-system'
import { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import DocsLayout from '../../../../components/docs/DocsLayout'

const DynamicMarkdown = dynamic(() => import('@klicker-uzh/markdown'), {
  ssr: false,
})

function Landing() {
  return (
    <DocsLayout>
      {(courseInformation) => (
        <>
          <H3>Kursinformationen</H3>
          <DynamicMarkdown content={courseInformation.description} />
        </>
      )}
    </DocsLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
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

  if (participant && !participant.avatar) {
    return {
      redirect: {
        destination: `/editProfile?redirect_to=${encodeURIComponent(
          `/course/${ctx.params.courseId}/docs`
        )}`,
        statusCode: 302,
      },
    }
  }

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
    },
  })
}

export default Landing
