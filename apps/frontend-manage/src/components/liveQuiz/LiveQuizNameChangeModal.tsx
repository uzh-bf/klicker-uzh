import { useMutation } from '@apollo/client'
import {
  ChangeLiveQuizNameDocument,
  GetUserActivitiesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField, Modal, Toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'

interface LiveQuizNameChangeModalProps {
  quizId: string
  name: string
  displayName: string
  open: boolean
  setOpen: (value: boolean) => void
}

function LiveQuizNameChangeModal({
  quizId,
  name,
  displayName,
  open,
  setOpen,
}: LiveQuizNameChangeModalProps) {
  const t = useTranslations()
  const [changeLiveQuizName] = useMutation(ChangeLiveQuizNameDocument)
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
        title={t('manage.liveQuizzes.changeLiveQuizName')}
        className={{
          content: 'w-[30rem]',
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
            const result = await changeLiveQuizName({
              variables: {
                id: quizId,
                name: values.name,
                displayName: values.displayName,
              },
              optimisticResponse: {
                __typename: 'Mutation',
                changeLiveQuizName: {
                  id: quizId,
                  name: values.name,
                  displayName: values.displayName,
                },
              },
              refetchQueries: [GetUserActivitiesDocument],
            })

            if (result.data?.changeLiveQuizName?.id) {
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
                data-cy="insert-live-quiz-display-name"
              />
              <div className="mt-3 flex flex-row justify-between">
                <Button
                  type="button"
                  onClick={(): void => setOpen(false)}
                  data={{ cy: 'live-quiz-name-change-cancel' }}
                >
                  <Button.Label>{t('shared.generic.cancel')}</Button.Label>
                </Button>
                <Button
                  primary
                  type="submit"
                  disabled={!isValid}
                  loading={isSubmitting}
                  onClick={submitForm}
                  data={{ cy: 'live-quiz-name-change-confirm' }}
                >
                  <Button.Label>{t('shared.generic.confirm')}</Button.Label>
                </Button>
              </div>
            </>
          )}
        </Formik>
      </Modal>
      <Toast
        dismissible
        openExternal={successToast}
        onCloseExternal={() => setSuccessToast(false)}
        type="success"
        duration={4000}
      >
        {t('manage.liveQuizzes.liveQuizNameChangeSuccess')}
      </Toast>
      <Toast
        dismissible
        openExternal={errorToast}
        onCloseExternal={() => setErrorToast(false)}
        type="error"
        duration={6000}
      >
        {t('manage.liveQuizzes.liveQuizNameChangeError')}
      </Toast>
    </>
  )
}

export default LiveQuizNameChangeModal
