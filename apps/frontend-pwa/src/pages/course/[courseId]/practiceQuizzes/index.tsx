import { GetServerSidePropsContext } from 'next'

function PracticeQuizOverviewRedirected() {
  return null
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (typeof ctx.params?.courseId !== 'string') {
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
        permanent: false,
      },
    }
  }

  return {
    redirect: {
      destination: `${ctx.locale ? `/${ctx.locale}` : ''}/course/${ctx.params.courseId}/practiceQuizzes/overview`,
      permanent: false,
    },
  }
}

export default PracticeQuizOverviewRedirected
