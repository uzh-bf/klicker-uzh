import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function AnswerCollectionInlineEditButton({
  disabled = true,
  selectedCollectionId,
  openAnswerCollectionEditModal,
}: {
  disabled?: boolean
  selectedCollectionId?: number
  openAnswerCollectionEditModal: (selectedCollectionId: number) => void
}) {
  const t = useTranslations()

  if (disabled || typeof selectedCollectionId === 'undefined') {
    return (
      <Tooltip
        tooltip={t('manage.elements.notSufficientPermissionsEditCollection')}
        className={{ tooltip: 'text-sm' }}
      >
        <Button
          disabled
          className={{ root: 'h-9 w-9' }}
          data={{ cy: 'inline-edit-answer-collection' }}
        >
          <Button.Icon withoutLabel icon={faPencil} />
        </Button>
      </Tooltip>
    )
  }

  return (
    <Button
      onClick={() => {
        if (typeof selectedCollectionId !== 'undefined') {
          openAnswerCollectionEditModal(selectedCollectionId)
        }
      }}
      className={{ root: 'h-9 w-9' }}
      data={{ cy: 'inline-edit-answer-collection' }}
    >
      <Button.Icon withoutLabel icon={faPencil} />
    </Button>
  )
}

export default AnswerCollectionInlineEditButton
