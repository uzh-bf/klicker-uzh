import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'

function useCollectionShortnames({
  collections,
}: {
  collections: AnswerCollection[]
}) {
  return useMemo(() => {
    return Array.from(new Set(collections.map((c) => c.ownerShortname)))
      .filter((shortname) => typeof shortname === 'string')
      .sort()
  }, [collections])
}

export default useCollectionShortnames
