import { useQuery } from '@apollo/client'
import {
  GetCatalogAnswerCollectionsDocument,
  GetCatalogLiveQuizTemplatesDocument,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import Select from 'react-select'

interface SelectObjectForCatalogProps {
  objectType: SharingObjectType
  setFieldValue: (field: string, value: any) => void
}

function SelectObjectForCatalog({
  objectType,
  setFieldValue,
}: SelectObjectForCatalogProps) {
  const t = useTranslations()
  const [isLoading, setIsLoading] = useState(true)
  const [options, setOptions] = useState<{ value: string; label: string }[]>([])

  // mutations for data fetching
  const { data: collectionsData, loading: collectionsLoading } = useQuery(
    GetCatalogAnswerCollectionsDocument,
    {
      skip: objectType !== SharingObjectType.AnswerCollection,
      fetchPolicy: 'cache-and-network',
    }
  )
  const { data: liveQuizTemplateData, loading: liveQuizTemplateLoading } =
    useQuery(GetCatalogLiveQuizTemplatesDocument, {
      skip: objectType !== SharingObjectType.LiveQuizTemplate,
      fetchPolicy: 'cache-and-network',
    })
  // ... add loading queries for other object types

  const anyLoading = collectionsLoading

  useEffect(() => {
    // load available objects based on the selected type
    const loadObjects = async () => {
      setIsLoading(true)

      try {
        // load objects available to the user for sharing (owner or admin access)
        if (objectType === SharingObjectType.AnswerCollection) {
          const collections =
            collectionsData?.getCatalogAnswerCollections?.map((c) => ({
              value: c.id,
              label: c.name,
            })) ?? []
          setOptions(collections)
        } else if (objectType === SharingObjectType.LiveQuizTemplate) {
          const templates =
            liveQuizTemplateData?.getCatalogLiveQuizTemplates?.map((t) => ({
              value: t.id,
              label: t.name,
            })) ?? []
          setOptions(templates)
        } else {
          setOptions([])
        }
      } catch (error) {
        console.error('Error loading objects:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadObjects()
  }, [collectionsData, liveQuizTemplateData, objectType])

  return (
    <div>
      <p className="mb-3 text-sm text-gray-600">
        {t('manage.catalog.selectSpecificObjectDescription', {
          type: t(`shared.types.${objectType}`),
        })}
      </p>

      {anyLoading ? (
        <Loader />
      ) : options.length > 0 ? (
        <Select
          id="object-selection-catalog-addition"
          instanceId="object-selection-catalog-addition"
          isSearchable
          isLoading={isLoading}
          menuPlacement="top" // open menu towards the top for space reasons on modal
          options={options}
          placeholder={t('manage.catalog.searchObjects')}
          onChange={(selected) => setFieldValue('objectId', selected?.value)}
          noOptionsMessage={() => t('manage.catalog.noObjectsFound')}
          styles={{
            control: (baseStyles) => ({
              ...baseStyles,
              borderColor: '#d1d5db',
            }),
          }}
        />
      ) : (
        <UserNotification
          type="info"
          message={t('manage.catalog.noObjectsAvailable')}
        />
      )}
    </div>
  )
}

export default SelectObjectForCatalog
