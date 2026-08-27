import type { GetServerSideProps } from 'next'

function RetiredQuizAnalyticsDetail() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({
  params,
  locale,
  defaultLocale,
}) => {
  const courseId =
    typeof params?.courseId === 'string' ? params.courseId : undefined
  const localePrefix = locale && locale !== defaultLocale ? `/${locale}` : ''

  return {
    redirect: {
      destination: courseId
        ? `${localePrefix}/analytics/${encodeURIComponent(courseId)}/activity`
        : `${localePrefix}/analytics`,
      permanent: false,
    },
  }
}

export default RetiredQuizAnalyticsDetail
