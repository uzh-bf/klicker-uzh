import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H3, TextField, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../lib/trpc'

interface EditableGroupNameProps {
  groupId: string
  groupName: string
  onChanged?: () => void | Promise<void>
}

function EditableGroupName({
  groupId,
  groupName,
  onChanged,
}: EditableGroupNameProps) {
  const t = useTranslations()
  const [editMode, setEditMode] = useState(false)
  const [groupNameValue, setGroupNameValue] = useState(groupName)
  const renameParticipantGroup =
    trpc.participant.renameParticipantGroup.useMutation()

  useEffect(() => {
    setGroupNameValue(groupName)
  }, [groupName])

  if (!editMode) {
    return (
      <H3 className={{ root: 'flex flex-row items-center gap-2' }}>
        {t('shared.generic.group')}: {groupNameValue}
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
        disabled={
          groupNameValue.trim() === '' || renameParticipantGroup.isLoading
        }
        onClick={async () => {
          if (groupNameValue.trim() === '') {
            setEditMode(false)
            return
          }

          try {
            const result = await renameParticipantGroup.mutateAsync({
              groupId,
              name: groupNameValue.trim(),
            })

            if (!result) {
              toast({
                type: 'error',
                message: t('shared.generic.systemError'),
                options: { duration: 6000 },
              })
              return
            }

            setGroupNameValue(result.name)
            setEditMode(false)
            void Promise.resolve(onChanged?.()).catch(console.error)
          } catch (error) {
            console.error(error)
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 6000 },
            })
          }
        }}
        loading={renameParticipantGroup.isLoading}
        className={{ root: 'h-7 py-0' }}
      >
        <Button.Label>{t('shared.generic.save')}</Button.Label>
      </Button>
      <Button
        basic
        onClick={() => setEditMode(false)}
        disabled={renameParticipantGroup.isLoading}
        className={{ root: 'h-7 py-0' }}
      >
        <Button.Label>{t('shared.generic.cancel')}</Button.Label>
      </Button>
    </div>
  )
}

export default EditableGroupName
