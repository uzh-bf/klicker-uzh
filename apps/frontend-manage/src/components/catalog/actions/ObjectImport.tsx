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
import { H2, TextField, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AddObjectToCatalogButton from '../administration/AddObjectToCatalogButton'
import AddObjectToCatalogModal from '../administration/AddObjectToCatalogModal'
import CatalogCollectionListItem from '../administration/CatalogCollectionListItem'
import CreateCatalogCollectionButton from '../collections/CreateCatalogCollectionButton'
import CreateCatalogCollectionModal from '../collections/CreateCatalogCollectionModal'
import CatalogObjectItem from './CatalogObjectItem'
import CatalogSeparatorTitle from './CatalogSeparatorTitle'
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
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)
  const [objectAdditionModalOpen, setObjectAdditionModalOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<ObjectType | 'all'>('all')
  const [accessTypeFilter, setAccessTypeFilter] = useState<
    ObjectAccess | 'all'
  >('all')

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
    <div className="pb-4">
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
        className={{ root: twMerge(!collectionName && 'md:-mb-5') }}
        data={{ cy: 'catalog-browser-title' }}
      >
        {collectionName
          ? `${t('manage.general.catalog')}: ${collectionName}`
          : t('manage.general.catalog')}
      </H2>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col items-end gap-2 md:flex-row">
          <TextField
            placeholder={t('manage.general.searchPlaceholder')}
            value={search}
            onChange={(newValue: string) => setSearch(newValue)}
            icon={faMagnifyingGlass}
            className={{ input: 'pl-8! w-full lg:w-60' }}
            data={{ cy: 'search-catalog-collection' }}
          />
          <ObjectFilters
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            accessTypeFilter={accessTypeFilter}
            setAccessTypeFilter={setAccessTypeFilter}
          />
        </div>
        <div className="flex flex-row gap-2 self-end">
          {typeof catalogCollectionId === 'undefined' ? (
            <CreateCatalogCollectionButton
              setCollectionModalOpen={setCollectionModalOpen}
            />
          ) : null}
          {collectionEditor ? (
            <AddObjectToCatalogButton
              setIsModalOpen={setObjectAdditionModalOpen}
            />
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-col">
        {typeof catalogCollectionId === 'undefined' &&
        filteredCatalogCollections.length > 0 ? (
          <div>
            <CatalogSeparatorTitle title={t('shared.generic.collections')} />
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
            <CatalogSeparatorTitle title={t('shared.generic.objects')} />

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
      {collectionEditor && objectAdditionModalOpen ? (
        <AddObjectToCatalogModal
          onClose={() => setObjectAdditionModalOpen(false)}
          catalogCollectionId={catalogCollectionId as string | undefined}
          onSuccess={() => {
            toast({
              type: 'success',
              message: t('manage.catalog.objectAddedSuccess'),
              options: { duration: 3500 },
            })
            setObjectAdditionModalOpen(false)
          }}
          onError={() =>
            toast({
              type: 'error',
              message: t('manage.catalog.objectAddedError'),
              options: { duration: 5000 },
            })
          }
        />
      ) : null}

      {typeof catalogCollectionId === 'undefined' && collectionModalOpen ? (
        <CreateCatalogCollectionModal
          onClose={() => setCollectionModalOpen(false)}
          onSuccess={() => {
            toast({
              type: 'success',
              message: t('manage.catalog.collectionCreationSuccess'),
              options: { duration: 3500 },
            })
            setCollectionModalOpen(false)
          }}
          onError={() =>
            toast({
              type: 'error',
              message: t('manage.catalog.collectionCreationError'),
              options: { duration: 5000 },
            })
          }
        />
      ) : null}
    </div>
  )
}

export default ObjectImport
