import { useMutation } from '@apollo/client'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { RenameParticipantGroupDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface EditableGroupNameProps {
  groupId: string
  groupName: string
}

function EditableGroupName({ groupId, groupName }: EditableGroupNameProps) {
  const t = useTranslations()
  const [editMode, setEditMode] = useState(false)
  const [groupNameValue, setGroupNameValue] = useState(groupName)
  const [renameParticipantGroup, { loading: submitting }] = useMutation(
    RenameParticipantGroupDocument
  )

  if (!editMode) {
    return (
      <H3 className={{ root: 'flex flex-row items-center gap-2' }}>
        {t('shared.generic.group')}: {groupName}
        <FontAwesomeIcon
          icon={faPencil}
          className="h-4"
          onClick={() => setEditMode(true)}
        />
      </H3>
    )
  }

  return (
    <div className="flex h-8 flex-row items-center gap-1.5">
      <TextField
        value={groupNameValue}
        onChange={(newValue) => setGroupNameValue(newValue)}
        className={{ input: 'h-7' }}
      />
      <Button
        disabled={groupNameValue.trim() === ''}
        onClick={async () => {
          if (groupNameValue.trim() === '') {
            setEditMode(false)
            return
          }

          await renameParticipantGroup({
            variables: {
              groupId,
              name: groupNameValue.trim(),
            },
          })
          setEditMode(false)
        }}
        loading={submitting}
        className={{ root: 'h-7' }}
      >
        {t('shared.generic.save')}
      </Button>
      <Button
        basic
        onClick={() => setEditMode(false)}
        className={{ root: 'rounded px-1.5 py-0.5 hover:bg-gray-200' }}
      >
        {t('shared.generic.cancel')}
      </Button>
    </div>
  )
}

export default EditableGroupName
