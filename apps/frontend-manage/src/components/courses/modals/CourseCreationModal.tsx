import {
  Button,
  FormikColorPicker,
  FormikDateChanger,
  FormikSwitchField,
  FormikTextField,
  Label,
  Modal,
  ThemeContext,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useContext } from 'react'
import ContentInput from 'shared-components/src/ContentInput'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'

interface CourseCreationModalProps {
  modalOpen: boolean
  onModalClose: () => void
}

// TODO: add notification email settings, once more generally compatible solution is available
// TODO: add groupDeadlineDate field, once this should be user settable (also add to fields on course overview)
// TODO: add tooltips to fields where it makes sense

function CourseCreationModal({
  modalOpen,
  onModalClose,
}: CourseCreationModalProps) {
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
  const theme = useContext(ThemeContext)
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
        onSubmit={(values, { setSubmitting }) => {
          console.log(values)
          // TODO implement submission
          // TODO: show success toast if successful or on error
          // TODO: set setSubmitting correspondingly
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
                  className={{ root: 'w-full md:w-1/2' }}
                  required
                />
                <FormikTextField
                  name="displayName"
                  label="Anzeigename"
                  placeholder="Kursanzeigename"
                  className={{ root: 'w-full md:w-1/2' }}
                  required
                />
              </div>

              <div>
                <Label
                  label="Beschreibung"
                  className={{ root: 'font-bold' }}
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
                  required
                  className={{ label: 'font-bold' }}
                />
                <FormikDateChanger
                  name="endDate"
                  label="Enddatum"
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
                  standardLabel
                  className={{ label: 'font-bold' }}
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
                  'float-right text-white font-bold mt-2 md:-mt-2 w-full md:w-max',
                  (!isValid || isSubmitting) && 'cursor-not-allowed opacity-50',
                  theme.primaryBgDark
                ),
              }}
            >
              Erstellen
            </Button>
          </Form>
        )}
      </Formik>
    </Modal>
  )
}

export default CourseCreationModal
