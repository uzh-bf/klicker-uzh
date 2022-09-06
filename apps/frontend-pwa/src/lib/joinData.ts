import { initializeApollo } from './apollo'
import { GetSessionDocument } from '@klicker-uzh/graphql/dist/ops'
  
export async function getSessionData(ctx: any) {
    const apolloClient = initializeApollo()

    const result = await apolloClient.query({
        query: GetSessionDocument,
        variables: {
            id: ctx.query?.id as string,
        },
    })

    return {
        apolloClient,
        result: result.data?.session ?? {},
    }
}
