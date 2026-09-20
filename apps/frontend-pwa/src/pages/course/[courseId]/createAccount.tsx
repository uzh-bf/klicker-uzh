import { GetServerSidePropsContext } from 'next'
import ParticipantRedirect from '../../../components/ParticipantRedirect'
import { initializeApollo } from '../../../lib/apollo'
import getParticipantToken from '../../../lib/getParticipantToken'
import { participantRedirect } from '../../../lib/participantRedirect'

function AccountCreationRedirect(props: {
  participantToken: string
  redirectTo: string
}) {
  return <ParticipantRedirect {...props} />
}

// page should redirect to generic account management page with LTI logic, etc. (not course specific)
export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const jwt =
    typeof ctx.query.jwt === 'string'
      ? `?${new URLSearchParams({ jwt: ctx.query.jwt }).toString()}`
      : ''

  if (typeof ctx.params?.courseId !== 'string') return { notFound: true }

  const auth = await getParticipantToken({
    apolloClient: initializeApollo(),
    courseId: ctx.params.courseId,
    ctx,
  })
  return participantRedirect({
    destination: `${ctx.locale ? `/${ctx.locale}` : ''}/createAccount${jwt}`,
    ...auth,
    locale: ctx.locale,
  })
}

export default AccountCreationRedirect
