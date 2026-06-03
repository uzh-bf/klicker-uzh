import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import { trpc } from '../../../lib/trpc'
import GroupAction from './GroupAction'

function GroupCreationBlock({
  courseId,
  setSelectedTab,
  onCourseOverviewChanged,
}: {
  courseId: string
  setSelectedTab: (value: string) => void
  onCourseOverviewChanged?: () => void | Promise<void>
}) {
  const t = useTranslations()
  const createParticipantGroup =
    trpc.participant.createParticipantGroup.useMutation()

  return (
    <GroupAction
      buttonMode={false}
      title={t('pwa.courses.createGroup')}
      icon={faPlus}
      validationSchema={Yup.object().shape({
        value: Yup.string()
          .required(t('pwa.groups.nameRequired'))
          .test('is-not-empty', t('pwa.groups.nameRequired'), (value) => {
            return value?.trim().length > 0
          }),
      })}
      onSubmit={async (value) => {
        const result = await createParticipantGroup.mutateAsync({
          courseId,
          name: value,
        })

        if (result?.id) {
          await onCourseOverviewChanged?.()
          setSelectedTab(result.id)
        }
      }}
      loading={createParticipantGroup.isLoading}
      placeholder={t('pwa.courses.groupName')}
      textSubmit={t('shared.generic.create')}
      inputData={{ cy: 'group-creation-name-input' }}
      data={{ cy: 'create-new-participant-group' }}
    />
  )
}

export default GroupCreationBlock
