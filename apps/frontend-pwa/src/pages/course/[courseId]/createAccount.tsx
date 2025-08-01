import { GetServerSidePropsContext } from 'next'

function AccountCreationRedirect() {
  return null
}

// page should redirect to generic account management page with LTI logic, etc. (not course specific)
export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return {
    redirect: {
      destination: `/createAccount`,
      permanent: false,
    },
  }
}

export default AccountCreationRedirect
