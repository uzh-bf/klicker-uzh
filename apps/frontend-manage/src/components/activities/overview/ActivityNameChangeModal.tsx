import { Button, FormikTextField, Modal, toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import type { ActivityType } from '../../../lib/constants/activityEnums'
import { trpc, type RouterInputs } from '../../../lib/trpc'

interface ActivityNameChangeModalProps {
  id: string
  type: ActivityType
  name: string
  displayName: string
  courseId?: string | null
  onClose: () => void
  refetchActivities?: () => Promise<void>
}

function ActivityNameChangeModal({
  id,
  type,
  name,
  displayName,
  courseId,
  onClose,
  refetchActivities,
}: ActivityNameChangeModalProps) {
  const t = useTranslations()
  const utils = trpc.useUtils()

  const changeActivityName = trpc.activity.changeName.useMutation()
  const changingName = changeActivityName.isLoading
  const handleClose = () => {
    if (!changingName) {
      onClose()
    }
  }
  const refreshActivityData = () => {
    return Promise.all([
      courseId ? utils.course.detail.invalidate({ courseId }) : undefined,
      refetchActivities?.(),
    ]).catch(console.error)
  }
  const schema = Yup.object().shape({
    name: Yup.string().required(t('manage.activityWizard.activityName')),
    displayName: Yup.string().required(
      t('manage.activityWizard.activityDisplayName')
    ),
  })

  return (
    <Modal
      open
      hideCloseButton
      escapeDisabled
      onClose={handleClose}
      title={t('manage.activities.changeActivityName')}
      className={{
        content: 'max-w-lg pb-1',
        title: 'text-xl',
      }}
    >
      <Formik
        initialValues={{
          name: name,
          displayName: displayName,
        }}
        onSubmit={async (values, { setSubmitting }) => {
          setSubmitting(true)
          try {
            const result = await changeActivityName.mutateAsync({
              activityId: id,
              activityType:
                type as RouterInputs['activity']['changeName']['activityType'],
              name: values.name,
              displayName: values.displayName,
            })

            if (result.changeActivityName) {
              await refreshActivityData()
              toast({
                type: 'success',
                message: t('manage.activities.activityNameChangeSuccess'),
                options: { duration: 4000 },
              })
              onClose()
            } else {
              toast({
                type: 'error',
                message: t('manage.activities.activityNameChangeError'),
                options: { duration: 4000 },
              })
            }
          } catch (error) {
            console.error(error)
            toast({
              type: 'error',
              message: t('manage.activities.activityNameChangeError'),
              options: { duration: 4000 },
            })
          } finally {
            setSubmitting(false)
          }
        }}
        validationSchema={schema}
        isInitialValid={true}
      >
        {({ isValid, isSubmitting, submitForm }) => (
          <>
            <FormikTextField
              required
              autoComplete="off"
              name="name"
              label={t('manage.activityWizard.name')}
              tooltip={t('manage.activityWizard.liveQuizName')}
              className={{
                root: 'mb-2 w-full',
                tooltip: 'z-20 w-80',
                label: 'w-36',
              }}
              data-cy="insert-live-quiz-name"
              shouldValidate={() => true}
            />
            <FormikTextField
              required
              autoComplete="off"
              name="displayName"
              label={t('manage.activityWizard.displayName')}
              tooltip={t('manage.activityWizard.displayNameTooltip')}
              className={{
                root: 'w-full',
                tooltip: 'z-20 w-80',
                label: 'w-36',
              }}
              data-cy="insert-activity-display-name"
            />
            <div className="mt-3 flex flex-row justify-between">
              <Button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting || changingName}
                data={{ cy: 'activity-name-change-cancel' }}
              >
                <Button.Label>{t('shared.generic.cancel')}</Button.Label>
              </Button>
              <Button
                primary
                type="submit"
                disabled={!isValid || isSubmitting || changingName}
                loading={isSubmitting || changingName}
                onClick={submitForm}
                data={{ cy: 'activity-name-change-confirm' }}
              >
                <Button.Label>{t('shared.generic.confirm')}</Button.Label>
              </Button>
            </div>
          </>
        )}
      </Formik>
    </Modal>
  )
}

export default ActivityNameChangeModal
