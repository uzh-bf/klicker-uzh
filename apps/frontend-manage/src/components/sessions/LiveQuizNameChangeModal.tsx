import { useMutation } from '@apollo/client'
import { ChangeLiveQuizNameDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField, Modal, Toast } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
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
    name: Yup.string().required(t('manage.sessionForms.sessionName')),
    displayName: Yup.string().required(
      t('manage.sessionForms.sessionDisplayName')
    ),
  })

  return (
    <>
      <Modal
        hideCloseButton
        escapeDisabled
        open={open}
        onClose={(): void => setOpen(false)}
        title={t('manage.sessions.changeLiveQuizName')}
        className={{
          content: 'h-max min-h-max w-[30rem] self-center pt-0',
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
                label={t('manage.sessionForms.name')}
                tooltip={t('manage.sessionForms.liveQuizName')}
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
                label={t('manage.sessionForms.displayName')}
                tooltip={t('manage.sessionForms.displayNameTooltip')}
                className={{
                  root: 'w-full',
                  tooltip: 'z-20 w-80',
                  label: 'w-36',
                }}
                data-cy="insert-live-quiz-display-name"
              />
              <div className="-mb-4 mt-3 flex flex-row justify-between">
                <Button
                  type="button"
                  onClick={(): void => setOpen(false)}
                  data={{ cy: 'live-quiz-name-change-cancel' }}
                >
                  {t('shared.generic.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  loading={isSubmitting}
                  onClick={submitForm}
                  className={{
                    root: twMerge(
                      'bg-primary-80 font-bold text-white',
                      !isValid && 'bg-primary-60 cursor-not-allowed'
                    ),
                  }}
                  data={{ cy: 'live-quiz-name-change-confirm' }}
                >
                  {t('shared.generic.confirm')}
                </Button>
              </div>
            </>
          )}
        </Formik>
      </Modal>
      <Toast
        openExternal={successToast}
        setOpenExternal={setSuccessToast}
        type="success"
      >
        {t('manage.sessions.liveQuizNameChangeSuccess')}
      </Toast>
      <Toast
        openExternal={errorToast}
        setOpenExternal={setErrorToast}
        type="error"
      >
        {t('manage.sessions.liveQuizNameChangeError')}
      </Toast>
    </>
  )
}

export default LiveQuizNameChangeModal
