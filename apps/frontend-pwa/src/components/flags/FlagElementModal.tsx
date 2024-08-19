import { useMutation } from '@apollo/client'
import { faMessage } from '@fortawesome/free-regular-svg-icons'
import {
  faEnvelope,
  faMessage as faMessageSolid,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FlagElementDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikTextareaField,
  H4,
  Modal,
  Toast,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

interface FlagErrorToastProps {
  open: boolean
  setOpen: (newValue: boolean) => void
  content: string
}

function FlagErrorToast({ open, setOpen, content }: FlagErrorToastProps) {
  const t = useTranslations()

  return (
    <Toast
      duration={5000}
      type="error"
      openExternal={open}
      setOpenExternal={setOpen}
    >
      <H4>{t('shared.generic.error')}</H4>
      <div>{content}</div>
    </Toast>
  )
}

interface FlagSuccessToastProps {
  open: boolean
  setOpen: (newValue: boolean) => void
}

function FlagSuccessToast({ open, setOpen }: FlagSuccessToastProps) {
  const t = useTranslations()

  return (
    <Toast
      duration={5000}
      type="success"
      openExternal={open}
      setOpenExternal={setOpen}
    >
      <H4>{t('shared.generic.thanks')}</H4>
      <div>{t('pwa.practiceQuiz.feedbackTransmitted')}</div>
    </Toast>
  )
}

interface FlagElementModalProps {
  open: boolean
  setOpen: (newValue: boolean) => void
  instanceId: number
  elementId: number
  previousFeedback?: string
}

function FlagElementModal({
  open,
  setOpen,
  instanceId,
  elementId,
  previousFeedback,
}: FlagElementModalProps) {
  const t = useTranslations()

  const [successToastOpen, setSuccessToastOpen] = useState(false)
  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [feedbackExists, setFeedbackExists] = useState(!!previousFeedback)

  const [flagElement, { error }] = useMutation(FlagElementDocument)

  const flagElementSchema = Yup.object().shape({
    description: Yup.string().test({
      message: t('pwa.practiceQuiz.feedbackRequired'),
      test: (content) => !content?.match(/^(<br>(\n)*)$/g) && content !== '',
    }),
  })

  const flagElementFeedback = async (
    content: string,
    setSubmitting: (isSubmitting: boolean) => void
  ) => {
    setSubmitting(true)
    if (!content.match(/^(<br>(\n)*)$/g) && content !== '') {
      const result = await flagElement({
        variables: {
          elementInstanceId: instanceId,
          elementId: elementId,
          content,
        },
      })
      if (result.data?.flagElement === 'OK') {
        setSuccessToastOpen(true)
        setFeedbackExists(true)
        setOpen(false)
      } else {
        setErrorToastOpen(true)
      }
    }
    setSubmitting(false)
  }

  return (
    <div>
      <Modal
        title={t('pwa.practiceQuiz.flagElement')}
        className={{
          content: 'z-20 max-w-lg h-max',
          overlay: 'z-10',
        }}
        open={open}
        trigger={
          <Button
            basic
            onClick={() => setOpen(true)}
            data={{ cy: 'flag-element-button' }}
          >
            <Button.Icon>
              <FontAwesomeIcon
                icon={feedbackExists ? faMessageSolid : faMessage}
                className={twMerge(
                  'hover:text-primary-80 text-uzh-grey-100',
                  feedbackExists && 'text-primary-80'
                )}
              />
            </Button.Icon>
          </Button>
        }
        onClose={() => setOpen(false)}
        hideCloseButton
        escapeDisabled
      >
        <div className="mb-4 prose max-w-none">
          {t('pwa.practiceQuiz.flagElementText')}
        </div>
        <Formik
          initialValues={{ feedback: previousFeedback ?? '' }}
          isInitialValid={feedbackExists}
          onSubmit={(values, { setSubmitting }) =>
            flagElementFeedback(values.feedback, setSubmitting)
          }
          validationSchema={flagElementSchema}
        >
          {({ isSubmitting, isValid }) => (
            <div className="">
              <Form>
                <FormikTextareaField
                  name="feedback"
                  placeholder={t('pwa.practiceQuiz.addFeedback')}
                  className={{ input: 'w-full h-24' }}
                  data={{ cy: 'flag-element-textarea' }}
                />
                <div className="flex flex-col justify-between gap-2 mt-4 md:gap-0 md:flex-row">
                  <Button
                    onClick={() => setOpen(false)}
                    className={{ root: 'order-2 md:order-1' }}
                    data={{ cy: 'cancel-flag-element' }}
                  >
                    {t('shared.generic.cancel')}
                  </Button>
                  <Button
                    className={{
                      root: 'float-right px-5 text-white disabled:opacity-20 order-1 md:order-2 border-0 bg-primary-80',
                    }}
                    type="submit"
                    disabled={isSubmitting || !isValid}
                    data={{ cy: 'submit-flag-element' }}
                  >
                    <Button.Icon
                      className={{
                        root: 'mr-1 justify-items-center',
                      }}
                    >
                      <FontAwesomeIcon icon={faEnvelope} />
                    </Button.Icon>
                    <Button.Label>
                      {feedbackExists
                        ? t('pwa.practiceQuiz.updateFeedback')
                        : t('pwa.practiceQuiz.submitFeedback')}
                    </Button.Label>
                  </Button>
                </div>
              </Form>
            </div>
          )}
        </Formik>
      </Modal>

      <FlagSuccessToast open={successToastOpen} setOpen={setSuccessToastOpen} />
      <FlagErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        content={error?.message ?? t('shared.generic.systemError')}
      />
    </div>
  )
}

export default FlagElementModal
