import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AnswerCollectionEditModal from '~/components/resources/answerCollections/AnswerCollectionEditModal'

function AnswerCollectionInlineEditButton({
  disabled = true,
  selectedCollectionId,
  refetchAnswerCollections,
}: {
  disabled?: boolean
  selectedCollectionId?: number
  refetchAnswerCollections: () => Promise<any>
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

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
    <>
      <Button
        onClick={() => setOpen(true)}
        className={{ root: 'h-9 w-9' }}
        data={{ cy: 'inline-edit-answer-collection' }}
      >
        <Button.Icon withoutLabel icon={faPencil} />
      </Button>
      {typeof selectedCollectionId !== 'undefined' && open ? (
        <AnswerCollectionEditModal
          inlineEditing
          collectionId={selectedCollectionId}
          open={open}
          onClose={() => setOpen(false)}
          refetchAnswerCollections={refetchAnswerCollections}
        />
      ) : null}
    </>
  )
}

export default AnswerCollectionInlineEditButton
