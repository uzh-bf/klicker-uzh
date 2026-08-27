import { useMutation } from '@apollo/client'
import { SetCourseLearningAnalyticsEnabledDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal, Switch, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function CourseLearningAnalyticsModal({
  courseId,
  isEnabled,
  onClose,
}: {
  courseId: string
  isEnabled: boolean
  onClose: () => void
}) {
  const t = useTranslations()
  const [nextEnabled, setNextEnabled] = useState(isEnabled)
  const [hasError, setHasError] = useState(false)
  const [setCourseLearningAnalyticsEnabled, { loading }] = useMutation(
    SetCourseLearningAnalyticsEnabledDocument
  )

  return (
    <Modal
      open
      title={t('manage.course.learningAnalyticsSettings')}
      onClose={onClose}
      primaryLabel={t('shared.generic.save')}
      primaryLoading={loading}
      onPrimaryAction={async () => {
        setHasError(false)
        try {
          const result = await setCourseLearningAnalyticsEnabled({
            variables: { courseId, isEnabled: nextEnabled },
          })
          if (!result.data?.setCourseLearningAnalyticsEnabled) {
            setHasError(true)
            return
          }

          onClose()
        } catch {
          setHasError(true)
        }
      }}
      dataPrimaryAction={{ cy: 'course-learning-analytics-save' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'course-learning-analytics-cancel' }}
      className={{ content: 'max-w-2xl' }}
    >
      <div className="flex flex-col gap-4">
        <UserNotification
          type="info"
          message={t('manage.courseList.learningAnalyticsExplanation')}
        />
        <Switch
          label={t('manage.courseList.learningAnalyticsEnabled')}
          checked={nextEnabled}
          onCheckedChange={setNextEnabled}
          disabled={loading}
          data={{ cy: 'course-learning-analytics-switch' }}
        />
        {nextEnabled !== isEnabled ? (
          <UserNotification
            type={nextEnabled ? 'info' : 'warning'}
            message={t(
              nextEnabled
                ? 'manage.courseList.learningAnalyticsEnableNotice'
                : 'manage.courseList.learningAnalyticsDisableNotice'
            )}
          />
        ) : null}
        {hasError ? (
          <UserNotification
            type="error"
            message={t('manage.courseList.learningAnalyticsUpdateFailed')}
          />
        ) : null}
      </div>
    </Modal>
  )
}

export default CourseLearningAnalyticsModal
