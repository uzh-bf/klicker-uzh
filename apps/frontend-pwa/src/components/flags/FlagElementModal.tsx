import { useMutation } from '@apollo/client'
import { faMessage } from '@fortawesome/free-regular-svg-icons'
import {
  faEnvelope,
  faMessage as faMessageSolid,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  FlagElementDocument,
  GetStackElementFeedbacksDocument,
} from '@klicker-uzh/graphql/dist/ops'
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
      dismissible
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
      dismissible
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
  index: number
  open: boolean
  setOpen: (newValue: boolean) => void
  instanceId: number
  elementId: number
  feedbackValue?: string
  setFeedbackValue: (newValue: string) => void
  stackInstanceIds: number[]
}

function FlagElementModal({
  index,
  open,
  setOpen,
  instanceId,
  elementId,
  feedbackValue,
  setFeedbackValue,
  stackInstanceIds,
}: FlagElementModalProps) {
  const t = useTranslations()

  const [successToastOpen, setSuccessToastOpen] = useState(false)
  const [errorToastOpen, setErrorToastOpen] = useState(false)

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
        optimisticResponse: {
          __typename: 'Mutation',
          flagElement: {
            __typename: 'ElementFeedback',
            id: -1,
            upvote: false,
            downvote: false,
            feedback: content,
          },
        },
        update(cache, { data: dataFlagging }) {
          const dataQuery = cache.readQuery({
            query: GetStackElementFeedbacksDocument,
            variables: { instanceIds: stackInstanceIds },
          })

          const feedbackIx = dataQuery?.getStackElementFeedbacks?.findIndex(
            (feedback) => feedback.elementInstanceId === instanceId
          )
          let newFeedbacks = [...(dataQuery?.getStackElementFeedbacks ?? [])]
          if (typeof feedbackIx === 'undefined' || feedbackIx === -1) {
            newFeedbacks.push({
              __typename: 'ElementFeedback',
              id:
                dataFlagging?.flagElement?.id ??
                Math.round(Math.random() * -1000000),
              elementInstanceId: instanceId,
              upvote: false,
              downvote: false,
              feedback: content,
            })
          } else {
            newFeedbacks[feedbackIx] = {
              ...newFeedbacks[feedbackIx],
              feedback: content,
            }
          }

          cache.writeQuery({
            query: GetStackElementFeedbacksDocument,
            variables: { instanceIds: stackInstanceIds },
            data: {
              getStackElementFeedbacks: newFeedbacks,
            },
          })
        },
      })
      if (result.data?.flagElement?.id) {
        setSuccessToastOpen(true)
        setFeedbackValue(content)
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
          content: 'z-20 h-max max-w-lg',
          overlay: 'z-10',
        }}
        open={open}
        trigger={
          <Button
            basic
            onClick={() => setOpen(true)}
            data={{ cy: `flag-element-${index}-button` }}
          >
            <Button.Icon>
              <FontAwesomeIcon
                icon={!!feedbackValue ? faMessageSolid : faMessage}
                className={twMerge(
                  'hover:text-primary-80 text-uzh-grey-100',
                  !!feedbackValue && 'text-primary-80'
                )}
              />
            </Button.Icon>
          </Button>
        }
        onClose={() => setOpen(false)}
        hideCloseButton
        escapeDisabled
      >
        <div className="prose mb-4 max-w-none">
          {t('pwa.practiceQuiz.flagElementText')}
        </div>
        <Formik
          initialValues={{ feedback: feedbackValue ?? '' }}
          isInitialValid={!!feedbackValue}
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
                  className={{
                    input: 'h-24 w-full text-base',
                  }}
                  data={{ cy: 'flag-element-textarea' }}
                />
                <div className="mt-4 flex flex-col justify-between gap-2 md:flex-row md:gap-0">
                  <Button
                    onClick={() => setOpen(false)}
                    className={{ root: 'order-2 text-base md:order-1' }}
                    data={{ cy: 'cancel-flag-element' }}
                  >
                    {t('shared.generic.cancel')}
                  </Button>
                  <Button
                    className={{
                      root: 'bg-primary-80 order-1 float-right border-0 px-5 text-base text-white disabled:opacity-20 md:order-2',
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
                      {!!feedbackValue
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
