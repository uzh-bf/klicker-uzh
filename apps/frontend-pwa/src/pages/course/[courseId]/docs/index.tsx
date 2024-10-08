import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import DocsLayout from '../../../../components/docs/DocsLayout'

interface Props {
  participantToken?: string
  cookiesAvailable?: boolean
}

function Landing({ participantToken, cookiesAvailable }: Props) {
  const t = useTranslations()

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

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

  const { participantToken, cookiesAvailable } = await getParticipantToken({
    apolloClient,
    courseId: ctx.params.courseId,
    ctx,
  })

  if (participantToken) {
    return {
      props: {
        cookiesAvailable,
        participantToken,
        courseId: ctx.params.courseId,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
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
