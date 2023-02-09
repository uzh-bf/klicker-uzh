import { useMutation } from '@apollo/client'
import {
  CreateSessionDocument,
  EditSessionDocument,
  GetUserSessionsDocument,
  Session,
} from '@klicker-uzh/graphql/dist/ops'
import {
  FormikSelectField,
  FormikSwitchField,
  FormikTextField,
  Label,
} from '@uzh-bf/design-system'
import { ErrorMessage } from 'formik'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import LiveSessionCreationToast from '../../toasts/LiveSessionCreationToast'
import SessionCreationErrorToast from '../../toasts/SessionCreationErrorToast'
import EditorField from './EditorField'
import MultistepWizard, { LiveSessionFormValues } from './MultistepWizard'
import SessionBlockField from './SessionBlockField'

interface LiveSessionWizardProps {
  courses?: {
    label: string
    value: string
  }[]
  initialValues?: Partial<Session>
}

const stepOneValidationSchema = yup.object().shape({
  name: yup
    .string()
    .required('Bitte geben Sie einen Namen für Ihre Session ein.'),
  displayName: yup
    .string()
    .required('Bitte geben Sie einen Anzeigenamen für Ihre Session ein.'),
  description: yup.string(),
})

const stepTwoValidationSchema = yup.object().shape({
  multiplier: yup
    .string()
    .matches(/^[0-9]+$/, 'Bitte geben Sie einen gültigen Multiplikator ein.'),
  courseId: yup.string(),
  isGamificationEnabled: yup
    .boolean()
    .required('Bitte spezifizieren Sie, ob die Session gamified sein soll.'),
})

const stepThreeValidationSchema = yup.object().shape({
  blocks: yup
    .array()
    .of(
      yup.object().shape({
        ids: yup.array().of(yup.number()),
        titles: yup.array().of(yup.string()),
        timeLimit: yup
          .number()
          .min(1, 'Bitte geben Sie eine gültige Zeitbegrenzung ein.'),
        questionIds: yup.array().min(1),
      })
    )
    .min(1),
})

function LiveSessionWizard({ courses, initialValues }: LiveSessionWizardProps) {
  const [editSession] = useMutation(EditSessionDocument)
  const [createSession] = useMutation(CreateSessionDocument)
  const router = useRouter()
  const [successToastOpen, setSuccessToastOpen] = useState(false)
  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const onSubmit = async (
    values: LiveSessionFormValues,
    { resetForm }: any
  ) => {
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
  }

  return (
    <div>
      <MultistepWizard
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
        onSubmit={onSubmit}
      >
        <StepOne validationSchema={stepOneValidationSchema} />
        <StepTwo validationSchema={stepTwoValidationSchema} courses={courses} />
        <StepThree validationSchema={stepThreeValidationSchema} />
      </MultistepWizard>
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

export default LiveSessionWizard

interface StepProps {
  onSubmit?: () => void
  validationSchema: any
  courses?: {
    label: string
    value: string
  }[]
}

function StepOne(_: StepProps) {
  return (
    <>
      <FormikTextField
        required
        name="name"
        label="Session-Name"
        tooltip="Dieser Name der Session soll Ihnen ermöglichen diese Session von anderen zu unterscheiden. Er wird den Teilnehmenden nicht angezeigt, verwenden Sie hierfür bitte den Anzeigenamen im nächsten Feld."
        className={{ root: 'mb-1' }}
        data-cy="insert-live-session-name"
        shouldValidate={() => true}
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
        // key={fieldName.value}
        label="Beschreibung"
        tooltip="// TODO CONTENT TOOLTIP"
        fieldName="description"
      />
      <div className="w-full text-right">
        <ErrorMessage
          name="description"
          component="div"
          className="text-sm text-red-400"
        />
      </div>
    </>
  )
}

function StepTwo(props: StepProps) {
  return (
    <>
      <div className="flex flex-row items-center gap-4">
        <Label
          label="Optionen"
          className={{
            root: 'my-auto mr-2 font-bold min-w-max',
            tooltip: 'text-sm font-normal !w-1/2',
          }}
        />
        {props.courses && (
          <>
            <div className="mr-2" data-cy="select-course-div">
              Kurs:
            </div>
            <FormikSelectField
              name="courseId"
              placeholder="Kurs auswählen"
              items={[{ label: 'Kein Kurs', value: '' }, ...props.courses]}
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
        <FormikSwitchField
          name="isGamificationEnabled"
          label="Gamification"
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
    </>
  )
}

function StepThree(_: StepProps) {
  return (
    <>
      <div className="mt-2 mb-2">
        <SessionBlockField fieldName="blocks" />
      </div>
    </>
  )
}
