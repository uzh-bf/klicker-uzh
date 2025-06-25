import { useMutation } from '@apollo/client'
import {
  ActivityType,
  ChangeActivityNameDocument,
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField, Modal, toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'

interface ActivityNameChangeModalProps {
  id: string
  type: ActivityType
  name: string
  displayName: string
  courseId?: string | null
  onClose: () => void
}

function ActivityNameChangeModal({
  id,
  type,
  name,
  displayName,
  courseId,
  onClose,
}: ActivityNameChangeModalProps) {
  const t = useTranslations()
  const [changeActivityName] = useMutation(ChangeActivityNameDocument)

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
      onClose={onClose}
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
          const result = await changeActivityName({
            variables: {
              id,
              type,
              name: values.name,
              displayName: values.displayName,
            },
            refetchQueries: [
              { query: GetUserActivitiesDocument },
              ...(courseId
                ? [
                    {
                      query: GetSingleCourseDocument,
                      variables: { id: courseId },
                    },
                  ]
                : []),
            ],
          })

          if (result.data?.changeActivityName) {
            toast({
              type: 'success',
              message: t('manage.activities.activityNameChangeSuccess'),
              options: { duration: 4000 },
            })
            setSubmitting(false)
            onClose()
          } else {
            toast({
              type: 'error',
              message: t('manage.activities.activityNameChangeError'),
              options: { duration: 4000 },
            })
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
                root: '-mt-2 mb-2 w-full',
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
                onClick={onClose}
                data={{ cy: 'activity-name-change-cancel' }}
              >
                <Button.Label>{t('shared.generic.cancel')}</Button.Label>
              </Button>
              <Button
                primary
                type="submit"
                disabled={!isValid}
                loading={isSubmitting}
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
