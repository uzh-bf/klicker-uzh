import { GetServerSidePropsContext } from 'next'

function StudentDocs() {
  return null
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return {
    redirect: {
      destination: `${ctx.locale ? `/${ctx.locale}` : ''}/docs`,
      permanent: false,
    },
  }
}

export default StudentDocs
