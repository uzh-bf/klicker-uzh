import { useMutation } from '@apollo/client'
import { faArrowRight, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreateSessionDocument,
  GetUserSessionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikTextField,
  H3,
  Label,
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
import EditorField from './EditorField'
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
    description: yup.string(),
    blocks: yup.array().of(
      yup.object().shape({
        ids: yup.array().of(yup.number()),
        titles: yup.array().of(yup.string()),
        timeLimit: yup
          .number()
          .min(1, 'Bitte geben Sie eine gültige Zeitbegrenzung ein.'),
      })
    ),
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
          description: '',
          blocks: [{ questionIds: [], titles: [], timeLimit: undefined }],
          timeLimits: [],
          courseId: '',
          multiplier: '1',
          isGamificationEnabled: false,
        }}
        isInitialValid={false}
        validationSchema={liveSessionCreationSchema}
        onSubmit={async (values, { resetForm }) => {
          const blockQuestions = values.blocks
            .filter((block) => block.questionIds.length > 0)
            .map((block) => {
              return {
                questionIds: block.questionIds,
                timeLimit: block.timeLimit,
              }
            })

          try {
            const session = await createSession({
              variables: {
                name: values.name,
                displayName: values.displayName,
                description: values.description,
                blocks: blockQuestions,
                courseId: values.courseId,
                multiplier: parseInt(values.multiplier),
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
                      id="load-session-list"
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
                          {values.blocks.map((block: any, index: number) => (
                            <SessionBlock
                              key={`${index}-${block.questionIds.join('')}`}
                              index={index}
                              block={block}
                              setFieldValue={setFieldValue}
                              remove={remove}
                            />
                          ))}
                          <Button
                            fluid
                            className={{
                              root: 'flex flex-row items-center justify-center font-bold border border-solid w-36 border-uzh-grey-100',
                            }}
                            onClick={() =>
                              push({
                                questionIds: [],
                                titles: [],
                                timeLimit: undefined,
                              })
                            }
                            id="add-block"
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
                      <FormikSelectField
                        name="courseId"
                        placeholder="Kurs auswählen"
                        items={[{ label: 'Kein Kurs', value: '' }, ...courses]}
                      />
                    </>
                  )}
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

export default LiveSessionCreationForm
