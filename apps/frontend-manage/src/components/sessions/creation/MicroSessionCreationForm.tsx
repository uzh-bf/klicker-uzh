import {
  Button,
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
import * as yup from 'yup'
import AddQuestionField from './AddQuestionField'
import EditorField from './EditorField'
import QuestionBlock from './QuestionBlock'

interface MicroSessionCreationFormProps {
  courses?: {
    label: string
    value: string
  }[]
}

function MicroSessionCreationForm({ courses }: MicroSessionCreationFormProps) {
  // TODO: keep in mind that only questions with solutions (and maybe also feedbacks) should be used for learning elements
  const microSessionCreationSchema = yup.object().shape({
    name: yup
      .string()
      .required('Bitte geben Sie einen Namen für Ihre Session ein.'),
    displayName: yup
      .string()
      .required('Bitte geben Sie einen Anzeigenamen für Ihre Session ein.'),
    description: yup.string(),
    questions: yup.array().of(
      yup.object().shape({
        id: yup.string(),
        title: yup.string(),
      })
    ),
    startDate: yup
      .date()
      .required('Bitte geben Sie ein Startdatum für Ihre Session ein.'),
    endDate: yup
      .date()
      .min(
        yup.ref('startDate'),
        'Das Enddatum muss nach dem Startdatum liegen.'
      )
      .required('Bitte geben Sie ein Enddatum für Ihre Session ein.'),
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, 'Bitte geben Sie einen gültigen Multiplikator ein.'),
    courseId: yup.string(),
  })

  return (
    <div>
      <H3>Micro-Session erstellen</H3>
      <Formik
        initialValues={{
          name: '',
          displayName: '',
          description: '',
          questions: [],
          startDate: '',
          endDate: '',
          multiplier: '1',
          courseId: '',
        }}
        validationSchema={microSessionCreationSchema}
        onSubmit={async (values) => {
          console.log(values)
          console.log(
            'dates:',
            new Date(values.startDate),
            new Date(values.endDate)
          )
          // TODO: creation session with corresponding mutation
          // TODO: parse values using console.log(new Date(datetime))
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
            <Form>
              {String(isValid)}
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
                tooltip="// TODO CONTENT TOOLTIP"
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
                    label="Fragen:"
                    className={{
                      root: 'font-bold',
                      tooltip: 'font-normal text-sm !w-1/2',
                    }}
                    tooltip="Fügen Sie hier die Fragen Ihrer Session hinzu - Format Frage-Ids: ##, ##, ###. Jeder Block kann beliebig viele Fragen enthalten. Die Blöcke werden den Teilnehmenden in der eingegebenen Reihenfolge angezeigt."
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
                {courses && (
                  <>
                    <div className="mr-2">Kurs:</div>
                    <FormikSelectField
                      name="courseId"
                      placeholder="Kurs auswählen"
                      items={[{ label: 'Kein Kurs', value: '' }, ...courses]}
                    />
                  </>
                )}

                <div className="ml-4 mr-2">Startdatum:</div>
                <input
                  key={'startDate'}
                  type="datetime-local"
                  value={(values.startDate || '').toString().substring(0, 16)}
                  onChange={(e) =>
                    e.target['validity'].valid
                      ? setFieldValue('startDate', e.target['value'] + ':00Z')
                      : null
                  }
                />

                <div className="ml-4 mr-2">Enddatum:</div>
                <input
                  key={'endDate'}
                  type="datetime-local"
                  value={(values.endDate || '').toString().substring(0, 16)}
                  onChange={(e) =>
                    e.target['validity'].valid
                      ? setFieldValue('endDate', e.target['value'] + ':00Z')
                      : null
                  }
                />

                <div className="ml-4 mr-2">Multiplier:</div>
                <FormikSelectField
                  name="multiplier"
                  placeholder="Default: 1x"
                  items={[
                    { label: 'Einfach (1x)', value: '1' },
                    { label: 'Doppelt (2x)', value: '2' },
                    { label: 'Dreifach (3x)', value: '3' },
                    { label: 'Vierfach (4x)', value: '4' },
                  ]}
                />
              </div>
              <div>
                <ErrorMessage
                  name="courseId"
                  component="div"
                  className="text-sm text-red-400"
                />
                <ErrorMessage
                  name="startDate"
                  component="div"
                  className="text-sm text-red-400"
                />
                <ErrorMessage
                  name="endDate"
                  component="div"
                  className="text-sm text-red-400"
                />
                <ErrorMessage
                  name="multiplier"
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
          )
        }}
      </Formik>
    </div>
  )
}

export default MicroSessionCreationForm
