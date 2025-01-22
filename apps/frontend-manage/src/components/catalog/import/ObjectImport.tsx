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
import { useEffect, useState } from 'react'
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
        {filteredObjects && filteredObjects.length > 0 ? (
          filteredObjects?.map((object) => (
            <CatalogObjectItem
              key={`catalog-object-${object.id}-${object.name}`}
              object={object}
            />
          ))
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
