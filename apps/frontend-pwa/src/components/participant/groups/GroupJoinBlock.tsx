import { faPeopleGroup } from '@fortawesome/free-solid-svg-icons'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import { trpc } from '../../../lib/trpc'
import GroupAction from './GroupAction'

function GroupJoinBlock({
  courseId,
  setSelectedTab,
  onCourseOverviewChanged,
}: {
  courseId: string
  setSelectedTab: (value: string) => void
  onCourseOverviewChanged?: () => void | Promise<void>
}) {
  const t = useTranslations()
  const joinParticipantGroup =
    trpc.participant.joinParticipantGroup.useMutation()

  return (
    <div className="h-full w-full">
      <GroupAction
        buttonMode={false}
        title={t('pwa.courses.joinGroup')}
        icon={faPeopleGroup}
        validationSchema={Yup.object().shape({
          value: Yup.string()
            .required(t('pwa.groups.pinRequired'))
            .test('is-numeric', t('pwa.groups.pinNumeric'), (value) => {
              return !isNaN(Number(value)) && value.length === 6
            }),
        })}
        onSubmit={async (value) => {
          try {
            const result = await joinParticipantGroup.mutateAsync({
              courseId,
              code: Number(value) >> 0,
            })

            if (!result || result === 'FAILURE') {
              toast({
                type: 'error',
                message: t('pwa.courses.joinGroupError'),
                options: { duration: 6000 },
              })
            } else if (result === 'FULL') {
              toast({
                type: 'warning',
                message: t('pwa.courses.joinGroupFull'),
                options: { duration: 6000 },
              })
            } else {
              void Promise.resolve(onCourseOverviewChanged?.())
                .catch(console.error)
                .finally(() => setSelectedTab(result))
            }
          } catch (error) {
            console.error(error)
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 5000 },
            })
          }
        }}
        loading={joinParticipantGroup.isLoading}
        placeholder={t('pwa.courses.code')}
        textSubmit={t('shared.generic.join')}
        data={undefined}
      />
    </div>
  )
}

export default GroupJoinBlock
