import {
  AccessType,
  AnswerCollection,
  PermissionStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'

function useFormCollections({
  dbCollections,
}: {
  dbCollections?: AnswerCollection[] | null
}) {
  return useMemo(
    () =>
      (dbCollections ?? []).filter(
        (collection) =>
          (collection.accessType === AccessType.Shared &&
            collection.sharingStatus === PermissionStatus.Granted) ||
          collection.accessType === AccessType.Owner
      ),
    [dbCollections]
  )
}

export default useFormCollections
