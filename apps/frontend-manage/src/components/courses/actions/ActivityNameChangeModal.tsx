import { useMutation } from '@apollo/client'
import {
  ActivityType,
  ChangeActivityNameDocument,
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikTextField,
  Modal,
  ToastLegacy,
} from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'

interface ActivityNameChangeModalProps {
  id: string
  type: ActivityType
  name: string
  displayName: string
  courseId?: string | null
  open: boolean
  setOpen: (value: boolean) => void
}

function ActivityNameChangeModal({
  id,
  type,
  name,
  displayName,
  courseId,
  open,
  setOpen,
}: ActivityNameChangeModalProps) {
  const t = useTranslations()
  const [changeActivityName] = useMutation(ChangeActivityNameDocument)
  const [successToast, setSuccessToast] = useState(false)
  const [errorToast, setErrorToast] = useState(false)

  const schema = Yup.object().shape({
    name: Yup.string().required(t('manage.activityWizard.activityName')),
    displayName: Yup.string().required(
      t('manage.activityWizard.activityDisplayName')
    ),
  })

  return (
    <>
      <Modal
        hideCloseButton
        escapeDisabled
        open={open}
        onClose={(): void => setOpen(false)}
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
              setSuccessToast(true)
              setSubmitting(false)
              setOpen(false)
            } else {
              setErrorToast(true)
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
                  onClick={(): void => setOpen(false)}
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
      <ToastLegacy
        dismissible
        openExternal={successToast}
        onCloseExternal={() => setSuccessToast(false)}
        type="success"
        duration={4000}
      >
        {t('manage.activities.activityNameChangeSuccess')}
      </ToastLegacy>
      <ToastLegacy
        dismissible
        openExternal={errorToast}
        onCloseExternal={() => setErrorToast(false)}
        type="error"
        duration={6000}
      >
        {t('manage.activities.activityNameChangeError')}
      </ToastLegacy>
    </>
  )
}

export default ActivityNameChangeModal
