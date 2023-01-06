import { useMutation } from '@apollo/client'
import {
  CreateSessionDocument,
  EditSessionDocument,
  GetUserSessionsDocument,
  Session,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikTextField,
  H3,
  Label,
  Switch,
} from '@uzh-bf/design-system'
import {
  ErrorMessage,
  FieldArray,
  FieldArrayRenderProps,
  Form,
  Formik,
} from 'formik'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import LiveSessionCreationToast from '../../toasts/LiveSessionCreationToast'
import SessionCreationErrorToast from '../../toasts/SessionCreationErrorToast'
import AddBlockButton from './AddBlockButton'
import EditorField from './EditorField'
import SessionBlock from './SessionBlock'

interface LiveSessionCreationFormProps {
  courses?: {
    label: string
    value: string
  }[]
  initialValues?: Partial<Session>
}

function LiveSessionCreationForm({
  courses,
  initialValues,
}: LiveSessionCreationFormProps) {
  const [createSession] = useMutation(CreateSessionDocument)
  const [editSession] = useMutation(EditSessionDocument)
  const router = useRouter()
  const [successToastOpen, setSuccessToastOpen] = useState(false)
  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)

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
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, 'Bitte geben Sie einen gültigen Multiplikator ein.'),
    courseId: yup.string(),
    isGamificationEnabled: yup
      .boolean()
      .required('Bitte spezifizieren Sie, ob die Session gamified sein soll.'),
  })

  return (
    <div>
      {initialValues ? (
        <H3>Live-Session bearbeiten</H3>
      ) : (
        <H3>Live-Session erstellen</H3>
      )}
      <Formik
        key={initialValues?.id}
        initialValues={{
          name: initialValues?.name || '',
          displayName: initialValues?.displayName || '',
          description: initialValues?.description || '',
          blocks: initialValues?.blocks?.map((block) => {
            return {
              questionIds: block.instances.map(
                (instance) => instance.questionData.id
              ),
              titles: block.instances.map(
                (instance) => instance.questionData.name
              ),
              timeLimit: block.timeLimit ?? undefined,
            }
          }) || [{ questionIds: [], titles: [], timeLimit: undefined }],
          courseId: initialValues?.course?.id || '',
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          isGamificationEnabled: initialValues?.isGamificationEnabled || false,
        }}
        isInitialValid={initialValues ? true : false}
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
            let success = false

            if (initialValues) {
              const session = await editSession({
                variables: {
                  id: initialValues.id || '',
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
              success = Boolean(session.data?.editSession)
            } else {
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
              success = Boolean(session.data?.createSession)
            }

            if (success) {
              router.push('/')
              setEditMode(!!initialValues)
              setSuccessToastOpen(true)
              resetForm()
            }
          } catch (error) {
            console.log('error')
            setEditMode(!!initialValues)
            setErrorToastOpen(true)
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
                data-cy="insert-live-session-name"
              />
              <FormikTextField
                required
                name="displayName"
                label="Anzeigenamen"
                tooltip="Dieser Session-Name wird den Teilnehmenden bei der Durchführung angezeigt."
                className={{ root: 'mb-1' }}
                data-cy="insert-live-display-name"
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
                    label="Frageblöcke:"
                    className={{
                      root: 'font-bold',
                      tooltip: 'font-normal text-sm !w-1/2',
                    }}
                    tooltip="Fügen Sie mittels Drag&Drop auf das Plus-Icon Fragen zu Ihren Blöcken hinzu. Neue Blöcken können entweder ebenfalls durch Drag&Drop auf das entsprechende Feld oder durch Klicken auf den Button erstellt werden."
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
                        <AddBlockButton push={push} />
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
                    <div className="mr-2" data-cy="select-course-div">
                      Kurs:
                    </div>
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
                  name="isGamificationEnabled"
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
                    id="abort-session-edit"
                    onClick={() => router.push('/')}
                  >
                    Editieren abbrechen
                  </Button>
                  <Button
                    className={{ root: 'float-right mb-4' }}
                    type="submit"
                    disabled={isSubmitting || !isValid}
                    id="save-session-changes"
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
                  data={{ cy: 'create-new-session' }}
                >
                  Erstellen
                </Button>
              )}
            </Form>
          )
        }}
      </Formik>
      <LiveSessionCreationToast
        open={successToastOpen}
        setOpen={setSuccessToastOpen}
        editMode={editMode}
      />
      <SessionCreationErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        error={
          editMode
            ? 'Anpassen der Live-Session fehlgeschlagen...'
            : 'Erstellen der Live-Session fehlgeschlagen...'
        }
      />
    </div>
  )
}

export default LiveSessionCreationForm
