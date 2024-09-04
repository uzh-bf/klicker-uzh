import { useMutation } from '@apollo/client'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import {
  CreateParticipantGroupDocument,
  GetCourseOverviewDataDocument,
  GetParticipantGroupsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import GroupAction from './GroupAction'

function GroupCreationBlock({
  courseId,
  setSelectedTab,
}: {
  courseId: string
  setSelectedTab: (value: string) => void
}) {
  const t = useTranslations()
  const [createParticipantGroup, { loading }] = useMutation(
    CreateParticipantGroupDocument
  )

  return (
    <GroupAction
      buttonMode={false}
      title={t('pwa.courses.createGroup')}
      icon={faPlus}
      onSubmit={async (value) => {
        const result = await createParticipantGroup({
          variables: {
            courseId: courseId,
            name: value,
          },
          refetchQueries: [
            {
              query: GetParticipantGroupsDocument,
              variables: { courseId: courseId },
            },
            {
              query: GetCourseOverviewDataDocument,
              variables: { courseId: courseId },
            },
          ],
        })

        if (result.data?.createParticipantGroup?.id) {
          setSelectedTab(result.data.createParticipantGroup.id)
        }
      }}
      loading={loading}
      placeholder={t('pwa.courses.groupName')}
      textSubmit={t('shared.generic.create')}
      data={{ cy: 'create-new-participant-group' }}
    />
  )
}

export default GroupCreationBlock
