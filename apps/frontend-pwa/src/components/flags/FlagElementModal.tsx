import { useMutation } from '@apollo/client'
import { faMessage } from '@fortawesome/free-regular-svg-icons'
import {
  faEnvelope,
  faMessage as faMessageSolid,
} from '@fortawesome/free-solid-svg-icons'
import {
  FlagElementDocument,
  GetStackElementFeedbacksDocument,
} from '@klicker-uzh/graphql/dist/ops'
import ForwardRefButton from '@klicker-uzh/shared-components/src/ForwardRefButton'
import {
  Button,
  FormikTextareaField,
  Modal,
  toast,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

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
          message: error?.message ?? t('shared.generic.systemError'),
          options: { duration: 5000 },
        })
      }
    }
    setSubmitting(false)
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
            'hover:text-primary-80 text-uzh-grey-100 !px-1',
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
