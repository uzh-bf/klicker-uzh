import { ObjectAccess, ObjectType } from '@lib/constants/sharingEnums'
import * as JsSearch from 'js-search'
import { useMemo } from 'react'
import type {
  CatalogBrowserCollection,
  CatalogBrowserObject,
} from '../catalogBrowserTypes'

function useObjectFilters({
  objects,
  collections,
  search,
  typeFilter,
  accessTypeFilter,
}: {
  objects: CatalogBrowserObject[]
  collections: CatalogBrowserCollection[]
  search?: string
  typeFilter: ObjectType | 'all'
  accessTypeFilter: ObjectAccess | 'all'
}): {
  filteredObjects: CatalogBrowserObject[]
  filteredCatalogCollections: CatalogBrowserCollection[]
} {
  return useMemo(() => {
    // filter objects based on access type and object type
    const filteredObjects = objects.filter((object) => {
      if (typeFilter !== 'all' && object.objectType !== typeFilter) {
        return false
      }

      if (accessTypeFilter !== 'all' && object.access !== accessTypeFilter) {
        return false
      }

      return true
    })

    // filter catalog collections based on access type
    const filteredCollections = collections.filter((collection) => {
      if (typeFilter !== 'all' && typeFilter !== ObjectType.CatalogCollection) {
        return false
      }

      if (
        accessTypeFilter !== 'all' &&
        collection.access !== accessTypeFilter
      ) {
        return false
      }

      return true
    })

    // initialize js-search
    const searchInstance = new JsSearch.Search('id')
    searchInstance.addIndex('name')
    searchInstance.addDocuments(filteredObjects)

    // initialize second js-search for catalog collections
    const searchInstanceCollections = new JsSearch.Search('id')
    searchInstanceCollections.addIndex('name')
    searchInstanceCollections.addDocuments(filteredCollections)

    // apply search filter if search term exists
    const searchFilteredObjects = search
      ? (searchInstance.search(search) as CatalogBrowserObject[])
      : filteredObjects

    const searchFilteredCollections = search
      ? (searchInstanceCollections.search(search) as CatalogBrowserCollection[])
      : filteredCollections

    return {
      filteredObjects: searchFilteredObjects,
      filteredCatalogCollections: searchFilteredCollections,
    }
  }, [objects, collections, typeFilter, accessTypeFilter, search])
}

export default useObjectFilters
