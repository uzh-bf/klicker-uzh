import { useMutation } from '@apollo/client'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CreateMicroSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikTextField,
  H3,
  Label,
  ThemeContext,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import {
  ErrorMessage,
  FieldArray,
  FieldArrayRenderProps,
  Form,
  Formik,
} from 'formik'
import Link from 'next/link'
import { useContext } from 'react'
import toast from 'react-hot-toast'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'
import AddQuestionField from './AddQuestionField'
import EditorField from './EditorField'
import QuestionBlock from './QuestionBlock'

interface MicroSessionCreationFormProps {
  courses: {
    label: string
    value: string
  }[]
}

function MicroSessionCreationForm({ courses }: MicroSessionCreationFormProps) {
  const theme = useContext(ThemeContext)
  const [createMicroSession] = useMutation(CreateMicroSessionDocument)

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

  dayjs.extend(utc)

  // TODO: ensure that a course is selected - "no course" should not be an option for micro-sessions

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
          courseId: courses[0].value,
        }}
        validationSchema={microSessionCreationSchema}
        onSubmit={async (values, { resetForm }) => {
          try {
            const result = await createMicroSession({
              variables: {
                name: values.name,
                displayName: values.displayName,
                description: values.description,
                questions: values.questions.map((q: any) => q.id),
                startDate: values.startDate,
                endDate: values.endDate,
                multiplier: parseInt(values.multiplier),
                courseId: values.courseId,
              },
            })

            if (result.data?.createMicroSession) {
              // TODO: seems like toast is only shown when switching back to live session creation -> fix this
              toast.success(
                <div>
                  <div>Micro-Session erfolgreich erstellt!</div>
                  <div className="flex flex-row items-center">
                    <FontAwesomeIcon icon={faArrowRight} className="mr-2" />
                    Zur
                    <Link
                      href={`/courses/${values.courseId}`}
                      className={twMerge(theme.primaryText, 'ml-1')}
                      id="load-course-link"
                    >
                      Kursübersicht
                    </Link>
                  </div>
                </div>
              )
              resetForm()
            }
          } catch (error) {
            // TODO: add error handling
            console.log(error)
          }
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

                <Label
                  label="Startdatum"
                  required
                  className={{ root: 'ml-4' }}
                />
                <input
                  key={'startDate'}
                  type="datetime-local"
                  value={(dayjs(values.startDate).local().format() || '')
                    .toString()
                    .substring(0, 16)}
                  onChange={(e) => {
                    if (e.target['validity'].valid) {
                      setFieldValue(
                        'startDate',
                        dayjs(e.target['value']).utc().format()
                      )
                    }
                  }}
                />

                <Label label="Enddatum" required className={{ root: 'ml-4' }} />
                <input
                  key={'endDate'}
                  type="datetime-local"
                  value={(dayjs(values.endDate).local().format() || '')
                    .toString()
                    .substring(0, 16)}
                  onChange={(e) => {
                    if (e.target['validity'].valid) {
                      setFieldValue(
                        'endDate',
                        dayjs(e.target['value']).utc().format()
                      )
                    }
                  }}
                />

                <Label label="Multiplier:" className={{ root: 'ml-4 mr-2' }} />
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
