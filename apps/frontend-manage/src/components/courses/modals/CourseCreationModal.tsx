import { useMutation } from '@apollo/client'
import ElementCreationErrorToast from '@components/toasts/ElementCreationErrorToast'
import { CreateCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import ContentInput from '@klicker-uzh/shared-components/src/ContentInput'
import {
  Button,
  FormikColorPicker,
  FormikDateChanger,
  FormikSwitchField,
  FormikTextField,
  Label,
  Modal,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'

interface CourseCreationModalProps {
  modalOpen: boolean
  onModalClose: () => void
}

// TODO: add notification email settings, once more generally compatible solution is available
// TODO: add groupDeadlineDate field, once this should be user settable (also add to fields on course overview)

function CourseCreationModal({
  modalOpen,
  onModalClose,
}: CourseCreationModalProps) {
  const router = useRouter()
  const [createCourse] = useMutation(CreateCourseDocument)
  const [showErrorToast, setShowErrorToast] = useState(false)

  const schema = yup.object().shape({
    name: yup.string().required('Bitte geben Sie einen Namen für den Kurs an.'),
    displayName: yup
      .string()
      .required('Bitte geben Sie einen Anzeigenamen für den Kurs an.'),
    description: yup.string(),
    color: yup.string().required('Bitte wählen Sie eine Farbe für den Kurs.'),
    startDate: yup
      .date()
      .required(
        'Bitte geben Sie ein Startdatum für Ihren Kurs ein. Die Daten können auch nach Erstellen des Kurses noch verändert werden.'
      ),
    endDate: yup
      .date()
      .min(new Date(), 'Das Enddatum muss in der Zukunft liegen.')
      .min(
        yup.ref('startDate'),
        'Das Enddatum muss nach dem Startdatum liegen.'
      )
      .required(
        'Bitte geben Sie ein Enddatum für Ihren Kurs ein. Die Daten können auch nach dem Erstellen des Kurses noch verändert werden.'
      ),
    isGamificationEnabled: yup.boolean(),
  })
  const today = new Date()
  const initEndDate = new Date(today.setMonth(today.getMonth() + 6))

  return (
    <Modal
      title="Neuen Kurs erstellen"
      open={modalOpen}
      onClose={onModalClose}
      className={{ content: 'h-max' }}
    >
      <Formik
        initialValues={{
          name: '',
          displayName: '',
          description: '',
          color: '#0028A5',
          startDate: new Date().toISOString().slice(0, 10),
          endDate: initEndDate.toISOString().slice(0, 10),
          isGamificationEnabled: true,
        }}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            const result = await createCourse({
              variables: {
                name: values.name,
                displayName: values.displayName,
                description: values.description,
                color: values.color,
                startDate: values.startDate + 'T00:00:00.000Z',
                endDate: values.endDate + 'T23:59:59.999Z',
                isGamificationEnabled: values.isGamificationEnabled,
              },
            })

            if (result.data?.createCourse) {
              onModalClose()
              router.push(`/courses/${result.data.createCourse.id}`)
            } else {
              setShowErrorToast(true)
              setSubmitting(false)
            }
          } catch (error) {
            setShowErrorToast(true)
            setSubmitting(false)
            console.log(error)
          }
        }}
        validationSchema={schema}
        isInitialValid={false}
      >
        {({
          values,
          setFieldValue,
          isSubmitting,
          isValid,
          touched,
          errors,
        }) => (
          <Form>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col w-full gap-3 md:flex-row">
                <FormikTextField
                  name="name"
                  label="Kursname"
                  placeholder="Kursname"
                  tooltip="Der Kursname dient Ihnen zur Identifizierung des Kurses. Den Studierenden wird dieser Name nicht angezeigt."
                  className={{ root: 'w-full md:w-1/2' }}
                  required
                />
                <FormikTextField
                  name="displayName"
                  label="Anzeigename"
                  placeholder="Kursanzeigename"
                  tooltip="Der Anzeigename wird den Studierenden angezeigt. Er kann vom Kursnamen abweichen."
                  className={{ root: 'w-full md:w-1/2' }}
                  required
                />
              </div>

              <div>
                <Label
                  label="Beschreibung"
                  className={{ root: 'font-bold', tooltip: 'text-sm' }}
                  tooltip="Die Beschreibung wird den Studierenden angezeigt. Sie können hier z.B. die Ziele des Kurses beschreiben."
                  showTooltipSymbol
                  required
                />
                <ContentInput
                  placeholder="Beschreibung hinzufügen"
                  touched={touched.description}
                  content={values.description}
                  onChange={(newValue: string) =>
                    setFieldValue('description', newValue)
                  }
                  className={{ editor: 'h-20' }}
                />
              </div>

              <div className="flex flex-col gap-2 mt-4 md:gap-8 md:flex-row">
                <FormikDateChanger
                  name="startDate"
                  label="Startdatum"
                  tooltip="Ab dem Startdatum können die Studierenden auf die freigeschalteten Inhalte des Kurses zugreifen. Das Startdatum können Sie auch nach Erstellen des Kurses noch verändern."
                  required
                  className={{ label: 'font-bold' }}
                />
                <FormikDateChanger
                  name="endDate"
                  label="Enddatum"
                  tooltip="Nach dem Enddatum wird der Kurs für die Studierenden als archiviert angezeigt, sie können aber weiterhin auf die Inhalte zugreifen. Das Enddatum können Sie auch nach Erstellen des Kurses noch verändern."
                  required
                  className={{ label: 'font-bold' }}
                />
              </div>
              <div className="flex flex-col gap-2 mt-4 md:gap-8 md:flex-row">
                <FormikColorPicker
                  name="color"
                  label="Kursfarbe"
                  position="top"
                  abortText="Abbrechen"
                  submitText="Bestätigen"
                  required
                />
                <FormikSwitchField
                  name="isGamificationEnabled"
                  label="Gamifizierung"
                  className={{ label: 'font-bold' }}
                  standardLabel
                  required
                />
              </div>
            </div>
            <div className="flex flex-row justify-between mt-1">
              {errors && (
                <div className="text-sm text-red-700">{errors.description}</div>
              )}
            </div>
            <Button
              disabled={!isValid || isSubmitting}
              type="submit"
              className={{
                root: twMerge(
                  'float-right text-white font-bold mt-2 md:-mt-2 w-full md:w-max bg-primary-80',
                  (!isValid || isSubmitting) && 'cursor-not-allowed opacity-50'
                ),
              }}
            >
              Erstellen
            </Button>
          </Form>
        )}
      </Formik>
      <ElementCreationErrorToast
        open={showErrorToast}
        setOpen={setShowErrorToast}
        error="Erstellen des Kurses fehlgeschlagen..."
      />
    </Modal>
  )
}

export default CourseCreationModal
