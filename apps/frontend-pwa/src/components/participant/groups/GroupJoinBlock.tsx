import { useMutation } from '@apollo/client'
import { faPeopleGroup } from '@fortawesome/free-solid-svg-icons'
import {
  GetCourseOverviewDataDocument,
  JoinParticipantGroupDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import GroupAction from './GroupAction'

function GroupJoinBlock({
  courseId,
  setSelectedTab,
}: {
  courseId: string
  setSelectedTab: (value: string) => void
}) {
  const t = useTranslations()
  const [joinParticipantGroup] = useMutation(JoinParticipantGroupDocument)

  return (
    <GroupAction
      buttonMode={false}
      title={t('pwa.courses.joinGroup')}
      icon={faPeopleGroup}
      onSubmit={async (value) => {
        const result = await joinParticipantGroup({
          variables: {
            courseId: courseId,
            code: Number(value) >> 0,
          },
          refetchQueries: [
            {
              query: GetCourseOverviewDataDocument,
              variables: { courseId },
            },
          ],
        })

        if (result.data?.joinParticipantGroup?.id) {
          setSelectedTab(result.data.joinParticipantGroup.id)
        }
      }}
      placeholder={t('pwa.courses.code')}
      textSubmit={t('shared.generic.join')}
      data={undefined}
    />
  )
}

export default GroupJoinBlock
