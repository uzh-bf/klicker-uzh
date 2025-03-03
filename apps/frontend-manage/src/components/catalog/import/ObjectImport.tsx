import { useQuery } from '@apollo/client'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import {
  CatalogObjectType,
  GetCatalogObjectsDocument,
  ObjectAccess,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, TextField, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import CatalogObjectItem from './CatalogObjectItem'
import ObjectFilters from './ObjectFilters'
import useObjectFilters from './useObjectFilters'

function ObjectImport({
  catalogCollectionId,
}: {
  catalogCollectionId?: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<CatalogObjectType | ''>('')
  const [accessTypeFilter, setAccessTypeFilter] = useState<ObjectAccess | ''>(
    ''
  )

  // TODO: also return the catalog collection title here - to be shown next to the Catalog title
  const { data, loading } = useQuery(GetCatalogObjectsDocument, {
    variables: {
      catalogCollectionId,
    },
  })
  const objects = data?.getCatalogObjects ?? []

  const filteredObjects = useObjectFilters({
    objects,
    search,
    typeFilter,
    accessTypeFilter,
  })

  // group filtered objects into a group that is owned / managed with admin access and others
  const { managed, others } = useMemo(() => {
    const managed = filteredObjects.filter((object) => object.isOwnerOrAdmin)
    const others = filteredObjects.filter((object) => !object.isOwnerOrAdmin)
    return { managed, others }
  }, [filteredObjects])

  // set initial filter values based on query params
  useEffect(() => {
    if (router.query.filter) {
      setTypeFilter(router.query.filter as CatalogObjectType)
    }
  }, [router.query])

  if (loading) {
    return <Loader />
  }

  // TODO: enable scrolling on this component on overflow!
  return (
    <div>
      <H2 className={{ root: 'md:-mb-5' }}>{t('manage.general.catalog')}</H2>
      <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <TextField
          placeholder={t('manage.general.searchPlaceholder')}
          value={search}
          onChange={(newValue: string) => {
            setSearch(newValue)
          }}
          icon={faMagnifyingGlass}
          className={{
            input: 'w-60',
          }}
          data={{ cy: 'search-catalog-collection' }}
        />
        <ObjectFilters
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          accessTypeFilter={accessTypeFilter}
          setAccessTypeFilter={setAccessTypeFilter}
        />
      </div>
      <div className="mt-2 flex flex-col border-t">
        {filteredObjects.length > 0 ? (
          <div>
            {managed.length > 0 && (
              <div>
                {managed.map((object) => (
                  <CatalogObjectItem
                    managedAccess
                    key={`catalog-object-${object.id}-${object.name}`}
                    object={object}
                    catalogCollectionId={catalogCollectionId}
                  />
                ))}
              </div>
            )}
            {others.length > 0 && (
              <div>
                {others.map((object) => (
                  <CatalogObjectItem
                    key={`catalog-object-${object.id}-${object.name}`}
                    object={object}
                    catalogCollectionId={catalogCollectionId}
                    managedAccess={false}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <UserNotification
            type="info"
            message={t('manage.catalog.noPublicRestrictedCollections')}
          />
        )}
      </div>
    </div>
  )
}

export default ObjectImport
