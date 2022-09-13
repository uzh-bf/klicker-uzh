import { GetRunningSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { initializeApollo } from './apollo'

export async function getRunningSessionData(ctx: any) {
  const apolloClient = initializeApollo()
  let result: any

  try {
    result = await apolloClient.query({
      query: GetRunningSessionDocument,
      variables: {
        id: ctx.query?.id as string,
      },
    })
  } catch (error) {
    console.error('error while fetching session data: ', error)
    result = undefined
  }

  return {
    apolloClient,
    result: result?.data?.session ?? {},
  }
}
