import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function AddObjectToCatalogButton({
  setIsModalOpen,
}: {
  setIsModalOpen: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  return (
    <div className="flex justify-end">
      <Button
        small
        primary
        onClick={() => setIsModalOpen(true)}
        className={{ root: 'my-3' }}
        data={{ cy: 'add-object-to-catalog-button' }}
      >
        <Button.Icon>
          <FontAwesomeIcon icon={faPlus} />
        </Button.Icon>
        <Button.Label>{t('manage.catalog.addObjectToCatalog')}</Button.Label>
      </Button>
    </div>
  )
}

export default AddObjectToCatalogButton
