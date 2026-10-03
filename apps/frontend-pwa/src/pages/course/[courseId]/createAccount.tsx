import { GetServerSidePropsContext } from 'next'

function AccountCreationRedirect() {
  return null
}

// page should redirect to generic account management page with LTI logic, etc. (not course specific)
export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const jwt =
    typeof ctx.query.jwt === 'string'
      ? `?${new URLSearchParams({ jwt: ctx.query.jwt }).toString()}`
      : ''

  return {
    redirect: {
      destination: `${ctx.locale ? `/${ctx.locale}` : ''}/createAccount${jwt}`,
      permanent: false,
    },
  }
}

export default AccountCreationRedirect
