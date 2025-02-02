import {
  CatalogObject,
  CatalogObjectType,
  ObjectAccess,
} from '@klicker-uzh/graphql/dist/ops'
import * as JsSearch from 'js-search'
import { useMemo } from 'react'

function useObjectFilters({
  objects,
  search,
  typeFilter,
  accessTypeFilter,
}: {
  objects: CatalogObject[]
  search?: string
  typeFilter: CatalogObjectType | ''
  accessTypeFilter: ObjectAccess | ''
}): CatalogObject[] {
  return useMemo(() => {
    // filter objects based on access type and object type
    const filtered = objects.filter((object) => {
      if (typeFilter !== '' && object.objectType !== typeFilter) {
        return false
      }

      if (accessTypeFilter !== '' && object.access !== accessTypeFilter) {
        return false
      }

      return true
    })

    // initialize js-search
    const searchInstance = new JsSearch.Search('id')
    searchInstance.addIndex('name')
    searchInstance.addDocuments(filtered)

    // apply search filter if search term exists
    const searchFilteredCollections = search
      ? (searchInstance.search(search) as CatalogObject[])
      : filtered

    return searchFilteredCollections
  }, [objects, typeFilter, accessTypeFilter, search])
}

export default useObjectFilters
