import { useMutation } from '@apollo/client'
import {
  GetUserRunningLiveQuizzesDocument,
  PublicationStatus,
  StartLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'

function useStartLiveQuiz({ id, name }: { id: string; name: string }) {
  const [startLiveQuiz, { loading: startingQuiz }] = useMutation(
    StartLiveQuizDocument,
    {
      variables: { id },
      update(cache, { data: res }) {
        // return early if the mutation failed
        if (!res?.startLiveQuiz) return

        cache.updateQuery(
          { query: GetUserRunningLiveQuizzesDocument },
          (data) => {
            // if no data is present, return early
            if (!data?.userRunningLiveQuizzes) return data

            // add the new live quiz to the existing list
            return {
              userRunningLiveQuizzes: [
                ...data.userRunningLiveQuizzes,
                { id: res.startLiveQuiz!.id, name: res.startLiveQuiz!.name },
              ],
            }
          }
        )
      },
      optimisticResponse: {
        startLiveQuiz: {
          __typename: 'LiveQuizMeta',
          id,
          name,
          status: PublicationStatus.Published,
        },
      },
    }
  )

  return { onStart: startLiveQuiz, starting: startingQuiz }
}

export default useStartLiveQuiz
