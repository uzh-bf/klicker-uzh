import { useMutation } from '@apollo/client'
import { faPeopleGroup } from '@fortawesome/free-solid-svg-icons'
import {
  GetCourseOverviewDataDocument,
  JoinParticipantGroupDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import GroupAction from './GroupAction'

function GroupJoinBlock({
  courseId,
  setSelectedTab,
}: {
  courseId: string
  setSelectedTab: (value: string) => void
}) {
  const t = useTranslations()
  const [showError, setShowError] = useState(false)
  const [fullMessage, setFullMessage] = useState(false)
  const [joinParticipantGroup, { loading }] = useMutation(
    JoinParticipantGroupDocument
  )

  return (
    <div className="h-full w-full">
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

          if (
            !result.data?.joinParticipantGroup ||
            result.data.joinParticipantGroup === 'FAILURE'
          ) {
            setShowError(true)
          } else if (result.data.joinParticipantGroup === 'FULL') {
            setFullMessage(true)
          } else {
            setSelectedTab(result.data.joinParticipantGroup)
          }
        }}
        loading={loading}
        placeholder={t('pwa.courses.code')}
        textSubmit={t('shared.generic.join')}
        data={undefined}
      />
      <Toast
        type="error"
        duration={6000}
        openExternal={showError}
        setOpenExternal={setShowError}
        className={{ root: 'max-w-[30rem]' }}
      >
        {t('pwa.courses.joinGroupError')}
      </Toast>
      <Toast
        type="warning"
        duration={6000}
        openExternal={fullMessage}
        setOpenExternal={setFullMessage}
        className={{ root: 'max-w-[30rem]' }}
      >
        {t('pwa.courses.joinGroupFull')}
      </Toast>
    </div>
  )
}

export default GroupJoinBlock