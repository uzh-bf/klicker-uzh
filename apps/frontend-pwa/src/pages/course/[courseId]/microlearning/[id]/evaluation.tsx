import { GetServerSidePropsContext } from 'next'

function MicroLearningEvaluationRedirected() {
  return null
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (
    typeof ctx.params?.courseId !== 'string' ||
    typeof ctx.params?.id !== 'string'
  ) {
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
        permanent: false,
      },
    }
  }

  return {
    redirect: {
      destination: `${ctx.locale ? `/${ctx.locale}` : ''}/course/${ctx.params.courseId}/microLearnings/${ctx.params.id}/evaluation`,
      permanent: false,
    },
  }
}

export default MicroLearningEvaluationRedirected
