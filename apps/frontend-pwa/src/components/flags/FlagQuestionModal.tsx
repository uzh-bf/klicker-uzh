import { useMutation } from '@apollo/client'
import { faFlag } from '@fortawesome/free-regular-svg-icons'
import { faEnvelope } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FlagQuestionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, Modal, ThemeContext } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

interface FlagQuestionModalProps {
  open: boolean
  setOpen: (newValue: boolean) => void
  setToastOpen: (newValue: boolean) => void
  questionData: { id: number }
}

function FlagQuestionModal({
  open,
  setOpen,
  setToastOpen,
  questionData,
}: FlagQuestionModalProps) {
  const theme = useContext(ThemeContext)
  const [flagQuestion] = useMutation(FlagQuestionDocument)

  const flagQuestionSchema = Yup.object().shape({
    description: Yup.string().test({
      message: 'Bitte fügen Sie einen Inhalt zu Ihrem Feedback hinzu',
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
          questionInstanceId: questionData.id,
          content: content,
        },
      })
      if (result.data?.flagQuestion === 'OK') {
        setToastOpen(true)
        setOpen(false)
      }
    }
    setSubmitting(false)
  }

  return (
    <Modal
      className={{ content: 'h-max mt-20 md:mt-0' }}
      open={open}
      trigger={
        <Button onClick={() => (setOpen(true), setToastOpen(false))} basic>
          <FontAwesomeIcon icon={faFlag} className="hover:text-red-500" />
        </Button>
      }
      onClose={() => setOpen(false)}
      hideCloseButton
    >
      <H2>Frage Markieren</H2>
      <div className="my-4">
        Dieses Feedback-Formular soll ermöglichen, zu den einzelnen Fragen eines
        Lernelements / einer Micro-Session eine direkte Anmerkung abgeben zu
        können, sollte sich ein Fehler eingeschlichen haben. Der Dozierende wird
        eine Nachricht mit Ihrem Feedback erhalten. Bitte versuchen Sie daher,
        den Fehler so genau wie möglich zu beschreiben.
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
          <div className="flex-1">
            <Form>
              <textarea
                className="w-full h-24 rounded-md"
                placeholder="Feedback hinzufügen"
                value={values.feedback}
                onChange={(e) => setFieldValue('feedback', e.target.value)}
              />
              <div className="flex flex-row justify-between w-full mt-1">
                {errors && (
                  <div className="text-sm text-red-700">{errors.feedback}</div>
                )}
              </div>

              <div className="flex flex-col justify-between gap-2 mt-4 md:gap-0 md:flex-row">
                <Button
                  onClick={() => setOpen(false)}
                  className={{ root: 'order-2 md:order-1' }}
                >
                  Abbrechen
                </Button>
                <Button
                  className={{
                    root: twMerge(
                      'float-right px-5 text-white disabled:opacity-80 order-1 md:order-2',
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
                  <Button.Label>Feedback abschicken</Button.Label>
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Formik>
    </Modal>
  )
}

export default FlagQuestionModal
