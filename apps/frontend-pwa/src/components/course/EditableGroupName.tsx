import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H3, TextField, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../lib/trpc'

interface EditableGroupNameProps {
  courseId: string
  groupId: string
  groupName: string
  onChanged?: () => void | Promise<void>
}

function EditableGroupName({
  courseId,
  groupId,
  groupName,
  onChanged,
}: EditableGroupNameProps) {
  const t = useTranslations()
  const [editMode, setEditMode] = useState(false)
  const [groupNameValue, setGroupNameValue] = useState(groupName)
  const [groupNameSaving, setGroupNameSaving] = useState(false)
  const renameParticipantGroup =
    trpc.participant.renameParticipantGroup.useMutation()
  const groupNameSubmitting =
    renameParticipantGroup.isLoading || groupNameSaving
  const utils = trpc.useUtils()

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
        disabled={groupNameValue.trim() === '' || groupNameSubmitting}
        onClick={async () => {
          if (groupNameValue.trim() === '') {
            setEditMode(false)
            return
          }

          try {
            setGroupNameSaving(true)
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
            utils.participant.courseOverview.setData({ courseId }, (data) => {
              if (!data) return data

              return {
                ...data,
                courseOverview: data.courseOverview
                  ? {
                      ...data.courseOverview,
                      groupLeaderboard:
                        data.courseOverview.groupLeaderboard?.map((entry) =>
                          entry.id === groupId
                            ? { ...entry, name: result.name }
                            : entry
                        ) ?? null,
                    }
                  : data.courseOverview,
                participantGroups: data.participantGroups.map((group) =>
                  group.id === groupId ? { ...group, name: result.name } : group
                ),
              }
            })
            void Promise.resolve(onChanged?.()).catch(console.error)
            setEditMode(false)
          } catch (error) {
            console.error(error)
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 6000 },
            })
          } finally {
            setGroupNameSaving(false)
          }
        }}
        loading={groupNameSubmitting}
        className={{ root: 'h-7 py-0' }}
      >
        <Button.Label>{t('shared.generic.save')}</Button.Label>
      </Button>
      <Button
        basic
        onClick={() => setEditMode(false)}
        disabled={groupNameSubmitting}
        className={{ root: 'h-7 py-0' }}
      >
        <Button.Label>{t('shared.generic.cancel')}</Button.Label>
      </Button>
    </div>
  )
}

export default EditableGroupName
