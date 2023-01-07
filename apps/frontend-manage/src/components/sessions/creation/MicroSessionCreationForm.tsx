import { useMutation } from '@apollo/client'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreateMicroSessionDocument,
  EditMicroSessionDocument,
  MicroSession,
} from '@klicker-uzh/graphql/dist/ops'
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
import { useRouter } from 'next/router'
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
  initialValues?: Partial<MicroSession>
}

function MicroSessionCreationForm({
  courses,
  initialValues,
}: MicroSessionCreationFormProps) {
  const theme = useContext(ThemeContext)
  const router = useRouter()

  const [createMicroSession] = useMutation(CreateMicroSessionDocument)
  const [editMicroSession] = useMutation(EditMicroSessionDocument)
  dayjs.extend(utc)

  // TODO: keep in mind that only questions with solutions (and maybe also feedbacks) should be used for learning elements
  const microSessionCreationSchema = yup.object().shape({
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
        key={initialValues?.id}
        initialValues={{
          name: initialValues?.name || '',
          displayName: initialValues?.displayName || '',
          description: initialValues?.description || '',
          questions:
            initialValues?.instances?.map((instance) => {
              return {
                id: instance.questionData.id,
                title: instance.questionData.name,
              }
            }) || [],
          startDate: initialValues?.scheduledStartAt || '',
          endDate: initialValues?.scheduledEndAt || '',
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          courseId: initialValues?.course?.id || courses[0].value,
        }}
        isInitialValid={initialValues ? true : false}
        validationSchema={microSessionCreationSchema}
        onSubmit={async (values, { resetForm }) => {
          try {
            let success = false

            if (initialValues) {
              const result = await editMicroSession({
                variables: {
                  id: initialValues?.id || '',
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
              success = Boolean(result.data?.editMicroSession)
            } else {
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
              success = Boolean(result.data?.createMicroSession)
            }

            if (success) {
              router.push('/')
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
              />
              <FormikTextField
                required
                name="displayName"
                label="Anzeigenamen"
                tooltip="Dieser Session-Name wird den Teilnehmenden bei der Durchführung angezeigt."
                className={{ root: 'mb-1' }}
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
                    {({ push, remove, move }: FieldArrayRenderProps) => (
                      <div className="flex flex-row gap-1 overflow-scroll">
                        {values.questions.map(
                          (question: any, index: number) => (
                            <QuestionBlock
                              key={`${question.id}-${index}`}
                              index={index}
                              question={question}
                              numOfBlocks={values.questions.length}
                              remove={remove}
                              move={move}
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

              {initialValues && (
                <div className="flex flex-row float-right gap-3">
                  <Button
                    className={{ root: 'float-right mb-4' }}
                    type="button"
                    disabled={isSubmitting}
                    id="abort-microsession-edit"
                    onClick={() => router.push('/')}
                  >
                    Editieren abbrechen
                  </Button>
                  <Button
                    className={{ root: 'float-right mb-4' }}
                    type="submit"
                    disabled={isSubmitting || !isValid}
                    id="save-microsession-changes"
                  >
                    Änderungen speichern
                  </Button>
                </div>
              )}
              {!initialValues && (
                <Button
                  className={{ root: 'float-right mb-4' }}
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  data={{ cy: 'create-new-microsession' }}
                >
                  Erstellen
                </Button>
              )}
            </Form>
          )
        }}
      </Formik>
    </div>
  )
}

export default MicroSessionCreationForm
