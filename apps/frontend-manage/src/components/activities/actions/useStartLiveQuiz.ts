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
      variables: { id: id },
      update(cache) {
        const data = cache.readQuery({
          query: GetUserRunningLiveQuizzesDocument,
        })
        cache.writeQuery({
          query: GetUserRunningLiveQuizzesDocument,
          data: {
            userRunningLiveQuizzes: [
              ...(data?.userRunningLiveQuizzes ?? []),
              { id: id, name: name },
            ],
          },
        })
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
