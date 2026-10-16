import type { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import { GetCourseAssessmentModeDocument } from '@klicker-uzh/graphql/dist/ops'
import type { GetServerSidePropsContext } from 'next'
import getAssessmentRedirect from './getAssessmentRedirect'

export default async function getCourseAssessmentRedirect({
  apolloClient,
  courseId,
  ctx,
}: {
  apolloClient: ApolloClient<NormalizedCacheObject>
  courseId: string
  ctx: GetServerSidePropsContext
}) {
  const redirect = getAssessmentRedirect(ctx)
  if (!redirect) return null

  const { data } = await apolloClient.query({
    query: GetCourseAssessmentModeDocument,
    variables: { courseId },
  })

  return data.basicCourseInformation?.isAssessmentEnabled ? redirect : null
}
