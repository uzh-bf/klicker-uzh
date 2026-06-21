import { faMessage } from '@fortawesome/free-regular-svg-icons'
import {
  faEnvelope,
  faMessage as faMessageSolid,
} from '@fortawesome/free-solid-svg-icons'
import ForwardRefButton from '@klicker-uzh/shared-components/src/ForwardRefButton'
import {
  Button,
  FormikTextareaField,
  Modal,
  toast,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import { trpc } from '../../lib/trpc'

interface FlagElementModalProps {
  index: number
  instanceId: number
  elementId: number
  feedbackValue?: string
  setFeedbackValue: (newValue: string) => void
  stackInstanceIds: number[]
}

function FlagElementModal({
  index,
  instanceId,
  elementId,
  feedbackValue,
  setFeedbackValue,
  stackInstanceIds,
}: FlagElementModalProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const utils = trpc.useUtils()
  const stackFeedbacksInput = { instanceIds: stackInstanceIds }
  const flagElement = trpc.participant.flagElement.useMutation({
    onSuccess: () => {
      void utils.participant.stackElementFeedbacks
        .invalidate(stackFeedbacksInput)
        .catch(console.error)
    },
  })

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
    try {
      if (!content.match(/^(<br>(\n)*)$/g) && content !== '') {
        const result = await flagElement.mutateAsync({
          elementInstanceId: instanceId,
          elementId,
          content,
        })

        if (result?.id) {
          toast({
            type: 'success',
            message: t('pwa.practiceQuiz.feedbackTransmitted'),
            options: { duration: 5000 },
          })
          setFeedbackValue(content)
          setOpen(false)
        } else {
          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 5000 },
          })
        }
      }
    } catch (error) {
      toast({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('shared.generic.systemError'),
        options: { duration: 5000 },
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={t('pwa.practiceQuiz.flagElement')}
      className={{ content: 'max-w-lg pb-2' }}
      open={open}
      trigger={
        <ForwardRefButton
          basic
          onClick={() => setOpen(true)}
          overrideClassName={twMerge(
            'hover:text-primary-80 text-uzh-grey-100 px-1!',
            !!feedbackValue && 'text-primary-100'
          )}
          data={{ cy: `flag-element-${index}-button` }}
        >
          <Button.Icon
            withoutLabel
            icon={!!feedbackValue ? faMessageSolid : faMessage}
          />
        </ForwardRefButton>
      }
      onClose={() => setOpen(false)}
      hideCloseButton
      escapeDisabled
    >
      <div className="mb-4 mt-2 max-w-none text-sm">
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
                  <Button.Label>{t('shared.generic.cancel')}</Button.Label>
                </Button>
                <Button
                  primary
                  className={{ root: 'order-1 float-right' }}
                  type="submit"
                  disabled={!isValid}
                  loading={isSubmitting}
                  data={{ cy: 'submit-flag-element' }}
                >
                  <Button.Icon icon={faEnvelope} loading={isSubmitting} />
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
  )
}

export default FlagElementModal
