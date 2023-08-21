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
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { ErrorMessage } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../toasts/ElementCreationErrorToast'
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

function MicroSessionWizard({
  courses,
  initialValues,
}: MicroSessionWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)

  const [createMicroSession] = useMutation(CreateMicroSessionDocument)
  const [editMicroSession] = useMutation(EditMicroSessionDocument)
  dayjs.extend(utc)

  const [selectedCourseId, setSelectedCourseId] = useState('')

  const stepOneValidationSchema = yup.object().shape({
    name: yup.string().required(t('manage.sessionForms.sessionName')),
    displayName: yup
      .string()
      .required(t('manage.sessionForms.sessionDisplayName')),
    description: yup.string(),
  })

  const stepTwoValidationSchema = yup.object().shape({
    startDate: yup.date().required(t('manage.sessionForms.startDate')),
    endDate: yup
      .date()
      .min(yup.ref('startDate'), t('manage.sessionForms.endAfterStart'))
      .required(t('manage.sessionForms.endDate')),
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, t('manage.sessionForms.validMultiplicator')),
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
              t('manage.sessionForms.microSessionTypes')
            ),
        })
      )
      .min(1),
  })

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
            {editMode
              ? t.rich('manage.sessionForms.microSessionCreated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })
              : t.rich('manage.sessionForms.microSessionEdited', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })}
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
          startDate:
            dayjs(initialValues?.scheduledStartAt)
              .local()
              .format('YYYY-MM-DDThh:mm') || '',
          endDate:
            dayjs(initialValues?.scheduledEndAt)
              .local()
              .format('YYYY-MM-DDThh:mm') || '',
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          courseId: initialValues?.course?.id || courses?.[0]?.value,
        }}
        onSubmit={onSubmit}
        isCompleted={isWizardCompleted}
        editMode={!!initialValues}
        onRestartForm={() => {
          setIsWizardCompleted(false)
        }}
        onViewElement={() => {
          router.push(`/courses/${selectedCourseId}`)
        }}
        workflowItems={[
          {
            title: t('shared.generic.description'),
            tooltip: t('manage.sessionForms.microSessionDescription'),
          },
          {
            title: t('shared.generic.settings'),
            tooltip: t('manage.sessionForms.microSessionSettings'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
          {
            title: t('shared.generic.questions'),
            tooltip: t('manage.sessionForms.microSessionQuestions'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
        ]}
      >
        <StepOne validationSchema={stepOneValidationSchema} />
        <StepTwo validationSchema={stepTwoValidationSchema} courses={courses} />
        <StepThree validationSchema={stepThreeValidationSchema} />
      </MultistepWizard>
      <ElementCreationErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        error={
          editMode
            ? t('manage.sessionForms.microSessionEditingFailed')
            : t('manage.sessionForms.microSessionCreationFailed')
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
  const t = useTranslations()

  return (
    <>
      <div className="flex flex-col w-full gap-4 md:flex-row">
        <FormikTextField
          required
          autoComplete="off"
          name="name"
          label={t('manage.sessionForms.name')}
          tooltip={t('manage.sessionForms.microSessionName')}
          className={{ root: 'mb-1 w-full md:w-1/2', tooltip: 'z-20' }}
          data-cy="insert-micro-session-name"
        />
        <FormikTextField
          required
          autoComplete="off"
          name="displayName"
          label={t('manage.sessionForms.displayName')}
          tooltip={t('manage.sessionForms.displayNameTooltip')}
          className={{ root: 'mb-1 w-full md:w-1/2', tooltip: 'z-20' }}
          data-cy="insert-micro-session-display-name"
        />
      </div>

      <EditorField
        label={t('shared.generic.description')}
        tooltip={t('manage.sessionForms.microSessionDescField')}
        fieldName="description"
        data_cy="insert-micro-session-description"
        showToolbarOnFocus={false}
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
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row items-center gap-4 text-left">
        <FormikSelectField
          name="courseId"
          items={props.courses || []}
          required
          tooltip={t('manage.sessionForms.microSessionCourse')}
          label={t('shared.generic.course')}
          data={{ cy: 'select-course' }}
          className={{ tooltip: 'z-20' }}
        />
        <ErrorMessage
          name="courseId"
          component="div"
          className="text-sm text-red-400"
        />
      </div>
      <FormikDateField
        label={t('shared.generic.startDate')}
        name="startDate"
        tooltip={t('manage.sessionForms.microSessionStartDate')}
        required
        className={{
          root: 'w-[24rem]',
          input: 'bg-uzh-grey-20',
          tooltip: 'z-20',
        }}
        data={{ cy: 'select-start-date' }}
      />
      <FormikDateField
        label={t('shared.generic.endDate')}
        name="endDate"
        tooltip={t('manage.sessionForms.microSessionEndDate')}
        required
        className={{
          root: 'w-[24rem]',
          input: 'bg-uzh-grey-20',
          tooltip: 'z-20',
        }}
        data={{ cy: 'select-end-date' }}
      />
      <div className="flex flex-row items-center gap-4">
        <FormikSelectField
          name="multiplier"
          placeholder={t('manage.sessionForms.multiplierDefault')}
          label={t('shared.generic.multiplier')}
          tooltip={t('manage.sessionForms.microSessionMultiplier')}
          required
          items={[
            { label: t('manage.sessionForms.multiplier1'), value: '1' },
            { label: t('manage.sessionForms.multiplier2'), value: '2' },
            { label: t('manage.sessionForms.multiplier3'), value: '3' },
            { label: t('manage.sessionForms.multiplier4'), value: '4' },
          ]}
          data={{ cy: 'select-multiplier' }}
          className={{ tooltip: 'z-20' }}
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
