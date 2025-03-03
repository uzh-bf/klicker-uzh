import { faPlus } from '@fortawesome/free-solid-svg-icons'
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
        primary
        onClick={() => setIsModalOpen(true)}
        data={{ cy: 'add-object-to-catalog-button' }}
      >
        <Button.Icon icon={faPlus} />
        <Button.Label>{t('manage.catalog.addObjectToCatalog')}</Button.Label>
      </Button>
    </div>
  )
}

export default AddObjectToCatalogButton
