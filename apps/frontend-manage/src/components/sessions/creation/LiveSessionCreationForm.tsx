import { useMutation } from '@apollo/client'
import { faArrowRight, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreateSessionDocument,
  GetUserSessionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikTextField,
  H3,
  Label,
  Select,
  Switch,
  ThemeContext,
} from '@uzh-bf/design-system'
import {
  ErrorMessage,
  FieldArray,
  FieldArrayRenderProps,
  Form,
  Formik,
} from 'formik'
import Link from 'next/link'
import { useContext } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'
import SessionBlock from './SessionBlock'

interface LiveSessionCreationFormProps {
  courses?: {
    label: string
    value: string
  }[]
}

function LiveSessionCreationForm({ courses }: LiveSessionCreationFormProps) {
  const [createSession] = useMutation(CreateSessionDocument)
  const theme = useContext(ThemeContext)

  const liveSessionCreationSchema = yup.object().shape({
    name: yup
      .string()
      .required('Bitte geben Sie einen Namen für Ihre Session ein.'),
    displayName: yup
      .string()
      .required('Bitte geben Sie einen Anzeigenamen für Ihre Session ein.'),
    // description: yup.string(),
    blocks: yup
      .array()
      .of(
        yup
          .array()
          .of(
            yup
              .string()
              .required(
                'Bitte überprüfen Sie Ihre eingabe und geben sie durch Kommas getrennte Frage-IDs ein.'
              )
          )
          .min(
            1,
            'Bitte beachten das Eingabteformat beachten und sicherstellen, dass jeder Block mind. eine Frage enthält. Für Sessions ohne Fragen bitten den Default-Block löschen.'
          )
      ),
    // timeLimits is an array with the same length as blocks and contains the time limit for each block which is a string that contains an integer that is at least zero
    timeLimits: yup.array().of(
      yup
        .string()
        .matches(/^[0-9]+$/, 'Bitte geben Sie eine gültige Zeitbegrenzung ein.')
        .min(1, 'Bitte geben Sie eine gültige Zeitbegrenzung ein.')
    ),
    courseId: yup.string(),
    isGamificationEnabled: yup
      .boolean()
      .required('Bitte spezifizieren Sie, ob die Session gamified sein soll.'),
  })

  return (
    <div>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{ duration: 6000 }}
      />
      <H3>Live-Session erstellen</H3>
      <Formik
        initialValues={{
          name: '',
          displayName: '',
          // description: '',
          blocks: [[]],
          timeLimits: [],
          courseId: '',
          isGamificationEnabled: false,
        }}
        isInitialValid={false}
        validationSchema={liveSessionCreationSchema}
        onSubmit={async (values, { resetForm }) => {
          const blockQuestions = values.blocks
            .filter((questions) => questions.length > 0)
            .map((questions, idx) => {
              return {
                questionIds: questions,
                timeLimit:
                  values.timeLimits[idx] !== '' &&
                  Number(values.timeLimits[idx]) > 0
                    ? Number(values.timeLimits[idx])
                    : undefined,
              }
            })

          try {
            const session = await createSession({
              variables: {
                name: values.name,
                displayName: values.displayName,
                blocks: blockQuestions,
                courseId: values.courseId,
                isGamificationEnabled: values.isGamificationEnabled,
              },
              refetchQueries: [GetUserSessionsDocument],
            })
            if (session.data?.createSession) {
              toast.success(
                <div>
                  <div>Session erfolgreich erstellt!</div>
                  <div className="flex flex-row items-center">
                    <FontAwesomeIcon icon={faArrowRight} className="mr-2" />
                    Zur
                    <Link
                      href="/sessions"
                      className={twMerge(theme.primaryText, 'ml-1')}
                    >
                      Session-Liste
                    </Link>
                  </div>
                </div>
              )
              resetForm()
            }
          } catch (error) {
            alert('Bitte geben Sie nur gültige Frage-IDs ein.')
          }

          // TODO: add possibilities to add time limits to questions
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
            <div>
              <Form className="">
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

                {/* <EditorField
                  label="Beschreibung"
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
                </div> */}

                {/* // TODO: add possibility to add and remove blocks */}
                <div className="mt-2 mb-2">
                  <div className="flex flex-row items-center flex-1 gap-2">
                    <Label
                      label="Blocks:"
                      className={{
                        root: 'font-bold',
                        tooltip: 'font-normal text-sm !w-1/2',
                      }}
                      tooltip="Fügen Sie hier die Fragen Ihrer Session hinzu - Format Frage-Ids: ##, ##, ###. Jeder Block kann beliebig viele Fragen enthalten. Die Blöcke werden den Teilnehmenden in der eingegebenen Reihenfolge angezeigt."
                      showTooltipSymbol={true}
                    />
                    <FieldArray name="blocks">
                      {({ push, remove }: FieldArrayRenderProps) => (
                        <div className="flex flex-row gap-1 overflow-scroll">
                          {values.blocks.map(
                            (questions: number[], index: number) => (
                              <SessionBlock
                                key={questions.join(',')}
                                index={index}
                                blockQuestions={questions}
                                timeLimit={values.timeLimits[index]}
                                setFieldValue={setFieldValue}
                                remove={remove}
                              />
                            )
                          )}
                          <Button
                            fluid
                            className={{
                              root: 'flex flex-row items-center justify-center font-bold border border-solid w-36 border-uzh-grey-100',
                            }}
                            onClick={() => push([])}
                          >
                            <FontAwesomeIcon icon={faPlus} />
                            <div>Neuer Block</div>
                          </Button>
                        </div>
                      )}
                    </FieldArray>
                  </div>
                  <ErrorMessage
                    name="blocks"
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
                      <Select
                        placeholder="Kurs auswählen"
                        items={[{ label: 'Kein Kurs', value: '' }, ...courses]}
                        onChange={(newValue: string) =>
                          setFieldValue('courseId', newValue)
                        }
                        value={values.courseId}
                      />
                    </>
                  )}
                  <Switch
                    label="Gamification"
                    checked={values.isGamificationEnabled}
                    onCheckedChange={(newValue: boolean) =>
                      setFieldValue('isGamificationEnabled', newValue)
                    }
                    className={{ root: 'ml-4' }}
                  />
                </div>
                <Button
                  className={{ root: 'float-right' }}
                  type="submit"
                  disabled={isSubmitting || !isValid}
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

export default LiveSessionCreationForm
