import { useMutation } from '@apollo/client'
import {
  DeleteLiveQuizDocument,
  GetUserLiveQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'

function useDeleteLiveQuiz({ id }: { id: string }) {
  const [deleteLiveQuiz, { loading: deletingLiveQuiz }] = useMutation(
    DeleteLiveQuizDocument,
    {
      variables: { id },
      update(cache) {
        const data = cache.readQuery({
          query: GetUserLiveQuizzesDocument,
        })
        cache.writeQuery({
          query: GetUserLiveQuizzesDocument,
          data: {
            userLiveQuizzes:
              data?.userLiveQuizzes?.filter((q) => q.id !== id) ?? [],
          },
        })
      },
      optimisticResponse: {
        deleteLiveQuiz: {
          __typename: 'LiveQuiz',
          id,
        },
      },
    }
  )

  return { onDelete: deleteLiveQuiz, deleting: deletingLiveQuiz }
}

export default useDeleteLiveQuiz
