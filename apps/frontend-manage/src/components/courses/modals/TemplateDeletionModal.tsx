import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityInfo,
  ActivityType,
  DeleteActivityTemplateDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface TemplateDeletionModalProps {
  activityId: string
  activityType: ActivityType
  courseId?: string | null
  onClose: () => void
  onSuccess: () => void
  onError: () => void
  refetchActivities?: () => Promise<void>
}

function TemplateDeletionModal({
  activityId,
  activityType,
  courseId,
  onClose,
  onSuccess,
  onError,
  refetchActivities,
}: TemplateDeletionModalProps) {
  const t = useTranslations()
  const [deleteActivityTemplate, { loading: deleting }] = useMutation(
    DeleteActivityTemplateDocument,
    {
      variables: { activityId: activityId, activityType: activityType },
      update: (cache, { data: res }) => {
        // if the activity template is not part of a course or the mutation was not successful, return early
        if (!courseId || !res?.deleteActivityTemplate) return

        // change the status of the activity template on the course overview back to draft
        cache.updateQuery(
          {
            query: GetSingleCourseDocument,
            variables: { courseId },
          },
          (data) => {
            if (!data?.course) return data

            let updatedActivities: ActivityInfo[] = []
            let updatedActivitiesKey:
              | 'liveQuizzesInfo'
              | 'practiceQuizzesInfo'
              | 'microLearningsInfo'
              | 'groupActivitiesInfo' = 'liveQuizzesInfo'

            switch (activityType) {
              case ActivityType.LiveQuiz:
                updatedActivities = [...(data.course.liveQuizzesInfo ?? [])]
                updatedActivitiesKey = 'liveQuizzesInfo'
                break
              case ActivityType.PracticeQuiz:
                updatedActivities = [...(data.course.practiceQuizzesInfo ?? [])]
                updatedActivitiesKey = 'practiceQuizzesInfo'
                break
              case ActivityType.MicroLearning:
                updatedActivities = [...(data.course.microLearningsInfo ?? [])]
                updatedActivitiesKey = 'microLearningsInfo'
                break
              case ActivityType.GroupActivity:
                updatedActivities = [...(data.course.groupActivitiesInfo ?? [])]
                updatedActivitiesKey = 'groupActivitiesInfo'
                break
              default:
                break
            }

            // remove the deleted activity template from the list
            updatedActivities = updatedActivities.filter(
              (activity) => activity.id !== res.deleteActivityTemplate
            )

            return {
              course: {
                ...data.course,
                [updatedActivitiesKey]: updatedActivities,
              },
            }
          }
        )
      },
    }
  )

  return (
    <Modal
      open
      title={t('manage.template.deleteTemplate')}
      onClose={onClose}
      data={{ cy: 'delete-template-modal' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!deleting && <FontAwesomeIcon icon={faTrashCan} />}
          <span>{t('manage.template.deleteTemplate')}</span>
        </div>
      }
      primaryButtonStyle="destructive"
      primaryLoading={deleting}
      onPrimaryAction={async () => {
        try {
          const { data } = await deleteActivityTemplate()

          if (data?.deleteActivityTemplate) {
            await refetchActivities?.()
            onSuccess()
            onClose()
          } else {
            onError()
          }
        } catch (e) {
          console.error(e)
          onError()
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-template-deletion' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-deletion' }}
      className={{ content: 'max-w-xl' }}
    >
      {t('manage.template.deleteTemplateExplanation')}
    </Modal>
  )
}

export default TemplateDeletionModal
