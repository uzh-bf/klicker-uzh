import Loader from '@klicker-uzh/shared-components/src/Loader'
import { ObjectType } from '@lib/constants/catalogEnums'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import Select from 'react-select'
import { trpc } from '../../../lib/trpc'

interface SelectObjectForCatalogProps {
  objectType: ObjectType
  isTemplate?: boolean
  setFieldValue: (field: string, value: any) => void
}

function SelectObjectForCatalog({
  objectType,
  isTemplate,
  setFieldValue,
}: SelectObjectForCatalogProps) {
  const t = useTranslations()
  const answerCollectionsEnabled = objectType === ObjectType.AnswerCollection
  const liveQuizTemplatesEnabled =
    objectType === ObjectType.LiveQuiz && !!isTemplate
  const elementsEnabled = objectType === ObjectType.Element
  const { data: collectionsData, isLoading: collectionsLoading } =
    trpc.sharing.catalogAnswerCollections.useQuery(undefined, {
      enabled: answerCollectionsEnabled,
    })
  const { data: liveQuizTemplateData, isLoading: liveQuizTemplateLoading } =
    trpc.sharing.catalogLiveQuizTemplates.useQuery(undefined, {
      enabled: liveQuizTemplatesEnabled,
    })
  const { data: elementsData, isLoading: elementsLoading } =
    trpc.sharing.catalogElements.useQuery(undefined, {
      enabled: elementsEnabled,
    })
  // TODO: ... add loading queries for other object types

  const isLoading =
    (answerCollectionsEnabled && collectionsLoading) ||
    (liveQuizTemplatesEnabled && liveQuizTemplateLoading) ||
    (elementsEnabled && elementsLoading)
  const options = useMemo(() => {
    // load objects available to the user for sharing (owner or admin access)
    if (objectType === ObjectType.AnswerCollection) {
      return (
        collectionsData?.catalogAnswerCollections.map((collection) => ({
          value: collection.id,
          label: collection.name,
        })) ?? []
      )
    }

    if (objectType === ObjectType.LiveQuiz && isTemplate) {
      return (
        liveQuizTemplateData?.catalogLiveQuizTemplates.map((template) => ({
          value: template.id,
          label: template.name,
        })) ?? []
      )
    }

    if (objectType === ObjectType.Element) {
      return (
        elementsData?.catalogElements.map((element) => ({
          value: element.id,
          label: element.name,
        })) ?? []
      )
    }

    return []
  }, [
    collectionsData,
    elementsData,
    liveQuizTemplateData,
    objectType,
    isTemplate,
  ])

  return (
    <div>
      <p className="mb-3 text-sm text-gray-600">
        {t('manage.catalog.selectSpecificObjectDescription', {
          type: t(`shared.types.${objectType}`),
        })}
      </p>

      {isLoading ? (
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
