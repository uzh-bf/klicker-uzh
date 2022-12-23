import {
  Button,
  FormikNumberField,
  FormikSelectField,
  FormikTextField,
  H3,
  Label,
} from '@uzh-bf/design-system'
import {
  ErrorMessage,
  FieldArray,
  FieldArrayRenderProps,
  Form,
  Formik,
} from 'formik'
import { LEARNING_ELEMENT_ORDERS } from 'shared-components/src/constants'
import * as yup from 'yup'
import AddQuestionField from './AddQuestionField'
import EditorField from './EditorField'
import QuestionBlock from './QuestionBlock'

interface LearningElementCreationFormProps {
  courses: {
    label: string
    value: string
  }[]
}

function LearningElementCreationForm({
  courses,
}: LearningElementCreationFormProps) {
  // TODO: keep in mind that only questions with solutions and feedbacks should be used for learning elements
  const learningElementCreationSchema = yup.object().shape({
    name: yup
      .string()
      .required('Bitte geben Sie einen Namen für Ihre Session ein.'),
    displayName: yup
      .string()
      .required('Bitte geben Sie einen Anzeigenamen für Ihre Session ein.'),
    description: yup.string(),
    questions: yup
      .array()
      .of(
        yup.object().shape({
          id: yup.string(),
          title: yup.string(),
        })
      )
      .min(1),
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, 'Bitte geben Sie einen gültigen Multiplikator ein.'),
    courseId: yup.string(),
    order: yup.string(),
    daysToRetry: yup
      .string()
      .required(
        'Bitte geben Sie eine Anzahl Tage ein nach welcher das Lernelement wiederholt werden kann.'
      )
      .matches(
        /^[0-9]+$/,
        'Bitte geben Sie eine gültige Anzahl Tage ein nach welcher das Lernelement wiederholt werden kann.'
      ),
  })

  console.log(Object.keys(LEARNING_ELEMENT_ORDERS))

  return (
    <div>
      <H3>Lernelement erstellen</H3>
      <Formik
        initialValues={{
          name: '',
          displayName: '',
          description: '',
          questions: [],
          multiplier: '1',
          courseId: courses[0].value,
          order: Object.keys(LEARNING_ELEMENT_ORDERS)[0],
          daysToRetry: '6',
        }}
        validationSchema={learningElementCreationSchema}
        onSubmit={async (values) => {
          // TODO: creation session with corresponding mutation
        }}
      >
        {({
          values,
          errors,
          touched,
          setFieldValue,
          isSubmitting,
          isValid,
        }) => {
          return (
            <div className="">
              <Form>
                {console.log(values)}
                <FormikTextField
                  required
                  name="name"
                  label="Session-Name"
                  tooltip="Dieser Name der Session soll Ihnen ermöglichen diese Session von anderen zu unterscheiden. Er wird den Teilnehmenden nicht angezeigt, verwenden Sie hierfür bitte den Anzeigenamen im nächsten Feld."
                  className={{ root: 'mb-1' }}
                  id="session-name"
                />
                <FormikTextField
                  required
                  name="displayName"
                  label="Anzeigenamen"
                  tooltip="Dieser Session-Name wird den Teilnehmenden bei der Durchführung angezeigt."
                  className={{ root: 'mb-1' }}
                  id="display-name"
                />

                <EditorField
                  key={values.name}
                  label="Beschreibung"
                  tooltip="Fügen Sie eine Beschreibung zu Ihrer Micro-Session hinzu, welche den Teilnehmern zu Beginn angezeigt wird."
                  field={values.description}
                  fieldName="description"
                  setFieldValue={setFieldValue}
                  error={errors.description}
                  touched={touched.description}
                />
                <div className="w-full text-right">
                  <ErrorMessage
                    name="description"
                    component="div"
                    className="text-sm text-red-400"
                  />
                </div>

                <div className="mt-2 mb-2">
                  <div className="flex flex-row items-center flex-1 gap-2">
                    <Label
                      required
                      label="Fragen:"
                      className={{
                        root: 'font-bold',
                        tooltip: 'font-normal text-sm !w-1/2',
                      }}
                      tooltip="Fügen Sie mittels Drag&Drop Fragen zu Ihrer Micro-Session hinzu."
                      showTooltipSymbol={true}
                    />
                    <FieldArray name="questions">
                      {({ push, remove }: FieldArrayRenderProps) => (
                        <div className="flex flex-row gap-1 overflow-scroll">
                          {values.questions.map(
                            (question: any, index: number) => (
                              <QuestionBlock
                                key={`${question.id}`}
                                index={index}
                                question={question}
                                remove={remove}
                              />
                            )
                          )}
                          <AddQuestionField push={push} />
                        </div>
                      )}
                    </FieldArray>
                  </div>
                  <ErrorMessage
                    name="questions"
                    component="div"
                    className="text-sm text-red-400"
                  />
                </div>

                <div className="flex flex-row items-center">
                  <Label
                    label="Optionen"
                    className={{
                      root: 'my-auto mr-2 font-bold min-w-max',
                      tooltip: 'text-sm font-normal !w-1/2',
                    }}
                  />

                  <FormikSelectField
                    name="courseId"
                    items={courses}
                    required
                    tooltip="Für die Erstellung einer Micro-Session ist die Auswahl des zugehörigen Kurses erforderlich."
                    label="Kurs"
                    className={{ label: 'font-normal' }}
                  />

                  <FormikSelectField
                    label="Multiplier"
                    required
                    tooltip="Wählen Sie einen Multiplier aus. Alle Punkte die von den Studierenden in dieser Session erreicht werden, werden mit dem Multiplier multipliziert."
                    name="multiplier"
                    placeholder="Default: 1x"
                    items={[
                      { label: 'Einfach (1x)', value: '1' },
                      { label: 'Doppelt (2x)', value: '2' },
                      { label: 'Dreifach (3x)', value: '3' },
                      { label: 'Vierfach (4x)', value: '4' },
                    ]}
                    className={{ label: 'font-normal', root: 'ml-4' }}
                  />

                  <FormikNumberField
                    name="daysToRetry"
                    label="Wiederholungszeitraum:"
                    tooltip="Wählen Sie einen Zeitraum nach welchem die Studierenden die Micro-Session wiederholen können."
                    className={{
                      root: 'ml-4',
                      label: 'font-normal',
                      input: 'w-20',
                    }}
                    required
                    hideError={true}
                  />

                  <FormikSelectField
                    label="Reihenfolge"
                    tooltip="Wählen Sie eine Reihenfolge in welcher die Fragen für die Studierenden zu lösen sind."
                    name="order"
                    placeholder="Reihenfolge wählen"
                    items={Object.keys(LEARNING_ELEMENT_ORDERS).map((key) => {
                      return { value: key, label: LEARNING_ELEMENT_ORDERS[key] }
                    })}
                    className={{ label: 'font-normal', root: 'ml-4' }}
                    required
                  />
                </div>
                <div>
                  <ErrorMessage
                    name="courseId"
                    component="div"
                    className="text-sm text-red-400"
                  />
                  <ErrorMessage
                    name="multiplier"
                    component="div"
                    className="text-sm text-red-400"
                  />
                  <ErrorMessage
                    name="daysToRetry"
                    component="div"
                    className="text-sm text-red-400"
                  />
                  <ErrorMessage
                    name="order"
                    component="div"
                    className="text-sm text-red-400"
                  />
                </div>
                <Button
                  className={{ root: 'float-right' }}
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  id="create-new-session"
                >
                  Erstellen
                </Button>
              </Form>
            </div>
          )
        }}
      </Formik>
    </div>
  )
}

export default LearningElementCreationForm
