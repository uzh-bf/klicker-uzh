import {
  AnswerCollection,
  CollectionAccess,
} from '@klicker-uzh/graphql/dist/ops'
import * as JsSearch from 'js-search'
import { useMemo } from 'react'

function useCollectionFilters({
  collections,
  typeFilter,
  shortnameFilter,
  search,
}: {
  collections: AnswerCollection[]
  typeFilter?: CollectionAccess | ''
  shortnameFilter?: string
  search?: string
}) {
  return useMemo(() => {
    // filter collections based on access type and shortname
    const filtered = collections.filter((collection) => {
      if (typeFilter && collection.access !== typeFilter) {
        return false
      }

      if (shortnameFilter && collection.ownerShortname !== shortnameFilter) {
        return false
      }

      return true
    })

    // initialize js-search
    const searchInstance = new JsSearch.Search('id')
    searchInstance.addIndex('name')
    searchInstance.addDocuments(filtered)

    // Apply search filter if search term exists
    const searchFilteredCollections = search
      ? (searchInstance.search(search) as AnswerCollection[])
      : filtered

    return searchFilteredCollections
  }, [collections, typeFilter, shortnameFilter, search])
}

export default useCollectionFilters
