import type { GetServerSideProps } from 'next'

function RetiredQuizAnalyticsIndex() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const courseId =
    typeof params?.courseId === 'string' ? params.courseId : undefined

  return {
    redirect: {
      destination: courseId
        ? `/analytics/${encodeURIComponent(courseId)}/activity`
        : '/analytics',
      permanent: false,
    },
  }
}

export default RetiredQuizAnalyticsIndex
