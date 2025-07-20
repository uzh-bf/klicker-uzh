import { useMutation } from '@apollo/client'
import {
  GetAnswerCollectionsInfoDocument,
  GetCatalogCollectionsListDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  GetObjectPermissionsDocument,
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
  GetUserElementsDocument,
  GetUserLiveQuizzesDocument,
  ObjectType,
  TransferObjectOwnershipDocument,
} from '@klicker-uzh/graphql/dist/ops'

function useTransferObjectOwnership({
  objectType,
  objectId,
  catalogCollectionId,
  onError,
}: {
  objectType: ObjectType
  objectId: string | number
  catalogCollectionId?: string
  onError: () => void
}): {
  onTransfer: (shortnameOrEmail: string) => Promise<boolean>
  transferring: boolean
} {
  const [transferObjectOwnership, { loading: transferringOwnership }] =
    useMutation(TransferObjectOwnershipDocument)

  const onTransfer = async (shortnameOrEmail: string) => {
    try {
      const res = await transferObjectOwnership({
        variables: {
          objectId: String(objectId),
          objectType,
          shortnameOrEmail,
        },
        refetchQueries: [
          // use refetch query instead of cache update, because new owner permissions might also
          // be removed in addition to the added new admin permission for the previous owner
          {
            query: GetObjectPermissionsDocument,
            variables: { objectId: String(objectId), objectType },
          },
          { query: GetCatalogSharingRequestsDocument },
          ...(objectType === ObjectType.CatalogCollection
            ? [{ query: GetCatalogCollectionsListDocument }]
            : []),
          ...(objectType === ObjectType.AnswerCollection
            ? [
                {
                  query: GetCatalogObjectsDocument,
                  variables: { catalogCollectionId },
                },
                { query: GetAnswerCollectionsInfoDocument },
              ]
            : []),
          ...(objectType === ObjectType.Element
            ? [{ query: GetUserElementsDocument }]
            : []),
          ...(objectType === ObjectType.Course
            ? [
                {
                  query: GetSingleCourseDocument,
                  variables: { courseId: String(objectId) },
                },
              ]
            : []),
          ...(objectType === ObjectType.LiveQuiz
            ? [
                { query: GetUserLiveQuizzesDocument },
                { query: GetUserActivitiesDocument },
              ]
            : []),
          ...(objectType === ObjectType.PracticeQuiz
            ? [{ query: GetUserActivitiesDocument }]
            : []),
          ...(objectType === ObjectType.MicroLearning
            ? [{ query: GetUserActivitiesDocument }]
            : []),
          ...(objectType === ObjectType.GroupActivity
            ? [{ query: GetUserActivitiesDocument }]
            : []),
        ],
      })

      if (res.data?.transferObjectOwnership) {
        return true
      } else {
        onError()
        return false
      }
    } catch (error) {
      console.error(error)
      onError()
      return false
    }
  }

  return {
    onTransfer,
    transferring: transferringOwnership,
  }
}

export default useTransferObjectOwnership
