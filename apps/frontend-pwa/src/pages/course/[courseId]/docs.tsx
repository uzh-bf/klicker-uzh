import { GetServerSidePropsContext } from 'next'
import ParticipantRedirect from '../../../components/ParticipantRedirect'
import { initializeApollo } from '../../../lib/apollo'
import getParticipantToken from '../../../lib/getParticipantToken'
import { participantRedirect } from '../../../lib/participantRedirect'

function StudentDocs(props: { participantToken: string; redirectTo: string }) {
  return <ParticipantRedirect {...props} />
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (typeof ctx.params?.courseId !== 'string') return { notFound: true }

  const auth = await getParticipantToken({
    apolloClient: initializeApollo(),
    courseId: ctx.params.courseId,
    ctx,
  })

  return participantRedirect({
    destination: `${ctx.locale ? `/${ctx.locale}` : ''}/docs`,
    ...auth,
    locale: ctx.locale,
  })
}

export default StudentDocs
