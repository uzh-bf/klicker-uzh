import { useMutation } from '@apollo/client'
import { faFlag } from '@fortawesome/free-regular-svg-icons'
import { faEnvelope } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FlagQuestionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H4, Modal, ThemeContext, Toast } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useContext, useState } from 'react'
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
      <div>{t('pwa.learningElement.feedbackTransmitted')}</div>
    </Toast>
  )
}

interface FlagQuestionModalProps {
  open: boolean
  setOpen: (newValue: boolean) => void
  instanceId: number
}

function FlagQuestionModal({
  open,
  setOpen,
  instanceId,
}: FlagQuestionModalProps) {
  const t = useTranslations()

  const [successToastOpen, setSuccessToastOpen] = useState(false)
  const [errorToastOpen, setErrorToastOpen] = useState(false)

  const theme = useContext(ThemeContext)
  const [flagQuestion, { error }] = useMutation(FlagQuestionDocument)

  const flagQuestionSchema = Yup.object().shape({
    description: Yup.string().test({
      message: t('pwa.learningElement.feedbackRequired'),
      test: (content) => !content?.match(/^(<br>(\n)*)$/g) && content !== '',
    }),
  })

  const flagQuestionFeedback = async (
    content: string,
    setSubmitting: (isSubmitting: boolean) => void
  ) => {
    setSubmitting(true)
    if (!content.match(/^(<br>(\n)*)$/g) && content !== '') {
      const result = await flagQuestion({
        variables: {
          questionInstanceId: instanceId,
          content,
        },
      })
      if (result.data?.flagQuestion === 'OK') {
        setSuccessToastOpen(true)
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
        title={t('pwa.learningElement.flagQuestion')}
        className={{
          content: 'z-20 max-w-lg h-max',
          overlay: 'z-10',
        }}
        open={open}
        trigger={
          <Button onClick={() => setOpen(true)} basic>
            <FontAwesomeIcon icon={faFlag} className="hover:text-red-500" />
          </Button>
        }
        onClose={() => setOpen(false)}
        hideCloseButton
        escapeDisabled
      >
        <div className="mb-4 prose max-w-none">
          {t('pwa.learningElement.flagQuestionText')}
        </div>
        <Formik
          initialValues={{ feedback: '' }}
          isInitialValid={false}
          onSubmit={(values, { setSubmitting }) =>
            flagQuestionFeedback(values.feedback, setSubmitting)
          }
          validationSchema={flagQuestionSchema}
        >
          {({ values, setFieldValue, isSubmitting, isValid, errors }) => (
            <div className="">
              <Form>
                <textarea
                  className="w-full h-24 rounded-md"
                  placeholder={t('pwa.learningElement.addFeedback')}
                  value={values.feedback}
                  onChange={(e) => setFieldValue('feedback', e.target.value)}
                />
                <div className="flex flex-row justify-between w-full mt-1">
                  {errors && (
                    <div className="text-sm text-red-700">
                      {errors.feedback}
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between gap-2 mt-4 md:gap-0 md:flex-row">
                  <Button
                    onClick={() => setOpen(false)}
                    className={{ root: 'order-2 md:order-1' }}
                  >
                    {t('shared.generic.cancel')}
                  </Button>
                  <Button
                    className={{
                      root: twMerge(
                        'float-right px-5 text-white disabled:opacity-20 order-1 md:order-2 border-0',
                        theme.primaryBgDark
                      ),
                    }}
                    type="submit"
                    disabled={isSubmitting || !isValid}
                  >
                    <Button.Icon
                      className={{
                        root: 'mr-1 justify-items-center',
                      }}
                    >
                      <FontAwesomeIcon icon={faEnvelope} />
                    </Button.Icon>
                    <Button.Label>
                      {t('pwa.learningElement.submitFeedback')}
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

export default FlagQuestionModal
