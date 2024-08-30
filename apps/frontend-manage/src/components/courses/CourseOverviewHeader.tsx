import { useMutation } from '@apollo/client'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Course,
  GetSingleCourseDocument,
  UpdateCourseSettingsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CourseQRModal from '../sessions/cockpit/CourseQRModal'
import CourseManipulationModal, {
  CourseManipulationFormData,
} from './modals/CourseManipulationModal'

interface CourseOverviewHeaderProps {
  course: Omit<
    Course,
    'leaderboard' | 'sessions' | 'practiceQuizzes' | 'microLearnings'
  >
  name: string
  pinCode: number
  numOfParticipants: number
}

function CourseOverviewHeader({
  course,
  name,
  pinCode,
  numOfParticipants,
}: CourseOverviewHeaderProps) {
  const t = useTranslations()
  const [courseSettingsModal, setCourseSettingsModal] = useState(false)
  const [updateCourseSettings] = useMutation(UpdateCourseSettingsDocument)

  return (
    <div className="flex flex-row items-center justify-between">
      <H1 data={{ cy: 'course-name-with-pin' }}>
        {t('manage.course.nameWithPin', {
          name: name,
          pin: String(pinCode)
            .match(/.{1,3}/g)
            ?.join(' '),
        })}
      </H1>
      <div className="mb-2 flex flex-row items-center gap-4">
        <Button
          onClick={() => setCourseSettingsModal(true)}
          className={{ root: 'gap-4' }}
          data={{ cy: 'course-settings-button' }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faPencil} />
          </Button.Icon>
          <Button.Label>{t('manage.course.modifyCourse')}</Button.Label>
        </Button>
        <CourseQRModal
          relativeLink={`/course/${course.id}/join?pin=${pinCode}`}
          triggerText={t('manage.course.joinCourse')}
          className={{ modal: 'w-[40rem]' }}
          dataTrigger={{ cy: 'course-join-button' }}
          dataModal={{ cy: 'course-join-modal' }}
          dataCloseButton={{ cy: 'course-join-modal-close' }}
        />
        <div className="italic">
          {t('manage.course.nParticipants', {
            number: numOfParticipants,
          })}
        </div>
      </div>
      <CourseManipulationModal
        initialValues={course}
        modalOpen={courseSettingsModal}
        onModalClose={() => setCourseSettingsModal(false)}
        onSubmit={async (
          values: CourseManipulationFormData,
          setSubmitting,
          setShowErrorToast
        ) => {
          try {
            // convert dates to UTC
            const startDateUTC = dayjs(values.startDate + 'T00:00:00.000')
              .utc()
              .toISOString()
            const endDateUTC = dayjs(values.endDate + 'T23:59:59.999')
              .utc()
              .toISOString()
            const groupDeadlineDateUTC = dayjs(
              values.groupCreationDeadline + 'T23:59:59.999'
            )
              .utc()
              .toISOString()

            const result = await updateCourseSettings({
              variables: {
                id: course.id,
                name: values.name,
                displayName: values.displayName,
                description: values.description,
                color: values.color,
                startDate: startDateUTC,
                endDate: endDateUTC,
                isGamificationEnabled: values.isGamificationEnabled,
                isGroupCreationEnabled: values.isGroupCreationEnabled,
                groupDeadlineDate: groupDeadlineDateUTC,
              },
              refetchQueries: [
                {
                  query: GetSingleCourseDocument,
                  variables: {
                    courseId: course.id,
                  },
                },
              ],
            })

            if (result.data?.updateCourseSettings) {
              setCourseSettingsModal(false)
            } else {
              setShowErrorToast(true)
              setSubmitting(false)
            }
          } catch (error) {
            setShowErrorToast(true)
            setSubmitting(false)
            console.log(error)
          }
        }}
      />
    </div>
  )
}

export default CourseOverviewHeader
