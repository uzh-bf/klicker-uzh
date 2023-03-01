import { useMutation } from '@apollo/client'
import {
  CreateMicroSessionDocument,
  EditMicroSessionDocument,
  MicroSession,
  QuestionType,
} from '@klicker-uzh/graphql/dist/ops'
import {
  FormikDateField,
  FormikSelectField,
  FormikTextField,
  H3,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { ErrorMessage } from 'formik'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import SessionCreationErrorToast from '../../toasts/SessionCreationErrorToast'
import BlockField from './BlockField'
import EditorField from './EditorField'
import MultistepWizard from './MultistepWizard'

interface MicroSessionWizardProps {
  courses?: {
    label: string
    value: string
  }[]
  initialValues?: MicroSession
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
  startDate: yup
    .date()
    .required('Bitte geben Sie ein Startdatum für Ihre Session ein.'),
  endDate: yup
    .date()
    .min(yup.ref('startDate'), 'Das Enddatum muss nach dem Startdatum liegen.')
    .required('Bitte geben Sie ein Enddatum für Ihre Session ein.'),
  multiplier: yup
    .string()
    .matches(/^[0-9]+$/, 'Bitte geben Sie einen gültigen Multiplikator ein.'),
  courseId: yup.string(),
})

const stepThreeValidationSchema = yup.object().shape({
  questions: yup
    .array()
    .of(
      yup.object().shape({
        id: yup.string(),
        title: yup.string(),
        type: yup
          .string()
          .oneOf(
            [
              QuestionType.Sc,
              QuestionType.Mc,
              QuestionType.Kprim,
              QuestionType.Numerical,
            ],
            'Micro-Sessions können nur Single-Choice, Multiple-Choice, Kprim und Numerische Fragen enthalten.'
          ),
      })
    )
    .min(1),
})

function MicroSessionWizard({
  courses,
  initialValues,
}: MicroSessionWizardProps) {
  const router = useRouter()

  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)

  const [createMicroSession] = useMutation(CreateMicroSessionDocument)
  const [editMicroSession] = useMutation(EditMicroSessionDocument)
  dayjs.extend(utc)

  const [selectedCourseId, setSelectedCourseId] = useState('')

  const onSubmit = async (values) => {
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
            startDate: dayjs(values.startDate).utc().format(),
            endDate: dayjs(values.endDate).utc().format(),
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
            startDate: dayjs(values.startDate).utc().format(),
            endDate: dayjs(values.endDate).utc().format(),
            multiplier: parseInt(values.multiplier),
            courseId: values.courseId,
          },
        })
        success = Boolean(result.data?.createMicroSession)
      }

      if (success) {
        setSelectedCourseId(values.courseId)
        setEditMode(!!initialValues)
        setIsWizardCompleted(true)
      }
    } catch (error) {
      console.log(error)
      setEditMode(!!initialValues)
      setErrorToastOpen(true)
    }
  }

  return (
    <div>
      <MultistepWizard
        completionSuccessMessage={(elementName) => (
          <div>
            Micro Session <strong>{elementName}</strong> erfolgreich{' '}
            {editMode ? 'modifiziert' : 'erstellt'}.
          </div>
        )}
        initialValues={{
          name: initialValues?.name || '',
          displayName: initialValues?.displayName || '',
          description: initialValues?.description || '',
          questions:
            initialValues?.instances?.map((instance) => {
              return {
                id: instance.questionData.id,
                title: instance.questionData.name,
                hasAnswerFeedbacks: instance.questionData.hasAnswerFeedbacks,
                hasSampleSolution: instance.questionData.hasSampleSolution,
              }
            }) || [],
          startDate: initialValues?.scheduledStartAt.substr(0, 16) || '',
          endDate: initialValues?.scheduledEndAt.substr(0, 16) || '',
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          courseId: initialValues?.course?.id || courses[0].value,
        }}
        onSubmit={onSubmit}
        isCompleted={isWizardCompleted}
        onRestartForm={() => {
          setIsWizardCompleted(false)
        }}
        onViewElement={() => {
          router.push(`/courses/${selectedCourseId}`)
        }}
      >
        <StepOne validationSchema={stepOneValidationSchema} />
        <StepTwo validationSchema={stepTwoValidationSchema} courses={courses} />
        <StepThree validationSchema={stepThreeValidationSchema} />
      </MultistepWizard>
      <SessionCreationErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        error={
          editMode
            ? 'Anpassen der Micro-Session fehlgeschlagen...'
            : 'Erstellen der Micro-Session fehlgeschlagen...'
        }
      />
    </div>
  )
}

export default MicroSessionWizard

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
        autoComplete="off"
        name="name"
        label="Name"
        tooltip="Der Name soll Ihnen ermöglichen, diese Micro-Session von anderen zu unterscheiden. Er wird den Teilnehmenden nicht angezeigt, verwenden Sie hierfür bitte den Anzeigenamen im nächsten Feld."
        className={{ root: 'mb-1' }}
      />
      <FormikTextField
        required
        autoComplete="off"
        name="displayName"
        label="Anzeigename"
        tooltip="Der Anzeigename wird den Teilnehmenden bei der Durchführung angezeigt."
        className={{ root: 'mb-1' }}
      />

      <EditorField
        label="Beschreibung"
        tooltip="Fügen Sie eine Beschreibung zu Ihrer Micro-Session hinzu, welche den Teilnehmern zu Beginn angezeigt wird."
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
    <div className="flex flex-col gap-2">
      <H3 className={{ root: 'mb-0' }}>Einstellungen</H3>
      <div className="flex flex-row items-center gap-4 text-left">
        <FormikSelectField
          name="courseId"
          items={props.courses || []}
          required
          tooltip="Für die Erstellung einer Micro-Session ist die Auswahl des zugehörigen Kurses erforderlich."
          label="Kurs"
        />
        <ErrorMessage
          name="courseId"
          component="div"
          className="text-sm text-red-400"
        />
      </div>
      <FormikDateField
        label="Startdatum"
        name="startDate"
        tooltip="Wählen Sie das Startdatum der Micro-Session aus. Die Session wird den Teilnehmenden ab diesem Zeitpunkt angezeigt."
        required
        className={{
          root: 'w-[24rem]',
          input: 'bg-uzh-grey-20',
        }}
      />
      <FormikDateField
        label="Enddatum"
        name="endDate"
        tooltip="Wählen Sie das Enddatum der Micro-Session aus. Die Session wird den Teilnehmenden nach diesem Zeitpunkt nicht mehr angezeigt."
        required
        className={{
          root: 'w-[24rem]',
          input: 'bg-uzh-grey-20',
        }}
      />
      <div className="flex flex-row items-center gap-4">
        <FormikSelectField
          name="multiplier"
          placeholder="Default: 1x"
          label="Multiplier"
          tooltip="Der Multiplier ist ein Faktor, mit welchem die Punkte der Teilnehmenden bei einer gamifizierten Micro-Session multipliziert werden."
          required
          items={[
            { label: 'Einfach (1x)', value: '1' },
            { label: 'Doppelt (2x)', value: '2' },
            { label: 'Dreifach (3x)', value: '3' },
            { label: 'Vierfach (4x)', value: '4' },
          ]}
        />
        <ErrorMessage
          name="multiplier"
          component="div"
          className="text-sm text-red-400"
        />
      </div>
    </div>
  )
}

function StepThree(_: StepProps) {
  return (
    <>
      <div className="mt-2 mb-2">
        <BlockField fieldName="questions" />
      </div>
    </>
  )
}
