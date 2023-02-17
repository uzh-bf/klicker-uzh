import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { H3 } from '@uzh-bf/design-system'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import DocsLayout from '../../../../components/docs/DocsLayout'

function Landing() {
  return (
    <DocsLayout>
      {(courseInformation) => (
        <>
          <H3>Kursinformationen</H3>
          <Markdown
            content={courseInformation.description}
            components={{
              img: ({ src }: { src: string }) => (
                <div className="relative h-96">
                  <Image
                    src={src}
                    alt="Image"
                    fill
                    className="object-contain m-0"
                  />
                </div>
              ),
            }}
          />
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
