import { useQuery } from '@apollo/client'
import {
  faArrowLeft,
  faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCatalogCollectionsListDocument,
  GetCatalogObjectsDocument,
  ObjectAccess,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, TextField, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import CatalogCollectionListItem from '../administration/CatalogCollectionListItem'
import CatalogObjectItem from './CatalogObjectItem'
import ObjectFilters from './ObjectFilters'
import useObjectFilters from './useObjectFilters'

function ObjectImport({
  collectionName,
  catalogCollectionId,
  collectionEditor, // determines if the current user has sufficient permissions on the collection to make modifications
}: {
  collectionName?: string
  catalogCollectionId?: string
  collectionEditor: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ObjectType | ''>('')
  const [accessTypeFilter, setAccessTypeFilter] = useState<ObjectAccess | ''>(
    ''
  )

  // fetch all available catalog collections
  const { data: collectionsData, loading: collectionsLoading } = useQuery(
    GetCatalogCollectionsListDocument,
    { skip: typeof catalogCollectionId !== 'undefined' }
  )
  const collections = collectionsData?.getCatalogCollectionsList ?? []

  const { data: objectsData, loading: objectsLoading } = useQuery(
    GetCatalogObjectsDocument,
    {
      variables: { catalogCollectionId },
      fetchPolicy: 'cache-and-network',
    }
  )
  const objects = objectsData?.getCatalogObjects ?? []

  const { filteredObjects, filteredCatalogCollections } = useObjectFilters({
    objects,
    collections,
    search,
    typeFilter,
    accessTypeFilter,
  })

  // set initial filter values based on query params
  useEffect(() => {
    if (router.query.filter) {
      setTypeFilter(router.query.filter as ObjectType)
    }
  }, [router.query])

  if (objectsLoading || collectionsLoading) {
    return <Loader />
  }

  return (
    <div>
      {typeof catalogCollectionId !== 'undefined' && (
        <Link
          href="/resources/catalog"
          className="text-primary-100 mb-2 flex cursor-pointer items-center gap-2 hover:underline"
          data-cy="leave-catalog-collection"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>{t('manage.catalog.backToCatalogOverview')}</span>
        </Link>
      )}
      <H2
        className={{ root: 'md:-mb-5' }}
        data={{ cy: 'catalog-browser-title' }}
      >
        {collectionName
          ? `${t('manage.general.catalog')}: ${collectionName}`
          : t('manage.general.catalog')}
      </H2>
      <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <TextField
          placeholder={t('manage.general.searchPlaceholder')}
          value={search}
          onChange={(newValue: string) => setSearch(newValue)}
          icon={faMagnifyingGlass}
          className={{ input: 'w-60 !pl-8' }}
          data={{ cy: 'search-catalog-collection' }}
        />
        <ObjectFilters
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          accessTypeFilter={accessTypeFilter}
          setAccessTypeFilter={setAccessTypeFilter}
        />
      </div>
      <div className="mt-2 flex flex-col">
        {typeof catalogCollectionId === 'undefined' &&
        filteredCatalogCollections.length > 0 ? (
          <div>
            <div className="mt-3 border-b border-slate-100 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-500">
              {t('shared.generic.collections')}
            </div>
            {filteredCatalogCollections.map((collection) => (
              <CatalogCollectionListItem
                key={collection.id}
                collection={collection}
              />
            ))}
          </div>
        ) : null}
        {filteredObjects.length > 0 ? (
          <div>
            <div className="mt-3 border-b border-slate-100 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-500">
              {t('shared.generic.objects')}
            </div>

            {filteredObjects.map((object) => (
              <CatalogObjectItem
                key={`catalog-object-${object.id}-${object.objectType}-${object.name}`}
                object={object}
                catalogCollectionId={catalogCollectionId}
                // if element is in catalog collection -> collection permissions apply regarding object management in catalog collection
                // if element is shown on top level of catalog -> permissions on the object itself apply
                managedAccess={
                  typeof catalogCollectionId !== 'undefined'
                    ? collectionEditor
                    : object.isManager
                }
              />
            ))}
          </div>
        ) : null}
        {filteredObjects.length === 0 &&
        filteredCatalogCollections.length === 0 ? (
          <UserNotification
            type="info"
            message={t('manage.catalog.noObjectsFoundInCatalog')}
            className={{ root: 'mt-2' }}
          />
        ) : null}
      </div>
    </div>
  )
}

export default ObjectImport
