import { useMutation } from '@apollo/client'
import { faLightbulb } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreateMicroSessionDocument,
  EditMicroSessionDocument,
  ElementType,
  GetSingleCourseDocument,
  MicroSession,
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
  title: string
  closeWizard: () => void
  courses?: {
    label: string
    value: string
  }[]
  initialValues?: MicroSession
}

function MicroSessionWizard({
  title,
  closeWizard,
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
    courseId: yup
      .string()
      .required(t('manage.sessionForms.microlearningCourse')),
  })

  const stepThreeValidationSchema = yup.object().shape({
    questions: yup
      .array()
      .of(
        yup.object().shape({
          id: yup.string(),
          title: yup.string(),
          type: yup.string().oneOf(
            [
              ElementType.Sc,
              ElementType.Mc,
              ElementType.Kprim,
              ElementType.Numerical,
              // ElementType.Flashcard,
              // ElementType.Content,
            ],
            t('manage.sessionForms.microlearningTypes')
          ),
          hasSampleSolution: yup
            .boolean()
            .isTrue(t('manage.sessionForms.practiceQuizSolutionReq')),
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
          refetchQueries: [
            {
              query: GetSingleCourseDocument,
              variables: {
                courseId: values.courseId,
              },
            },
          ],
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
          refetchQueries: [
            {
              query: GetSingleCourseDocument,
              variables: {
                courseId: values.courseId,
              },
            },
          ],
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
        title={title}
        onCloseWizard={closeWizard}
        completionSuccessMessage={(elementName) => (
          <div>
            {editMode
              ? t.rich('manage.sessionForms.microlearningCreated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })
              : t.rich('manage.sessionForms.microlearningEdited', {
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
            initialValues?.instances?.flatMap((instance) => {
              if (!instance.questionData) {
                return []
              }

              return [
                {
                  id: instance.questionData.questionId,
                  title: instance.questionData.name,
                  hasAnswerFeedbacks:
                    instance.questionData?.options.hasAnswerFeedbacks,
                  hasSampleSolution:
                    instance.questionData.options.hasSampleSolution,
                },
              ]
            }) || [],
          startDate: initialValues?.scheduledStartAt
            ? dayjs(initialValues?.scheduledStartAt)
                .local()
                .format('YYYY-MM-DDTHH:mm')
            : dayjs().local().format('YYYY-MM-DDTHH:mm'),
          endDate: initialValues?.scheduledEndAt
            ? dayjs(initialValues?.scheduledEndAt)
                .local()
                .format('YYYY-MM-DDTHH:mm')
            : dayjs().add(1, 'days').format('YYYY-MM-DDTHH:mm'),
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          courseId: initialValues?.course?.id || courses?.[0]?.value,
        }}
        onSubmit={onSubmit}
        isCompleted={isWizardCompleted}
        editMode={!!initialValues}
        initialValid={!!initialValues}
        onRestartForm={() => {
          setIsWizardCompleted(false)
        }}
        onViewElement={() => {
          router.push(`/courses/${selectedCourseId}`)
        }}
        workflowItems={[
          {
            title: t('shared.generic.description'),
            tooltip: t('manage.sessionForms.microlearningDescription'),
          },
          {
            title: t('shared.generic.settings'),
            tooltip: t('manage.sessionForms.microlearningSettings'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
          {
            title: t('shared.generic.questions'),
            tooltip: t('manage.sessionForms.microlearningQuestions'),
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
            ? t('manage.sessionForms.microlearningEditingFailed')
            : t('manage.sessionForms.microlearningCreationFailed')
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
    <div className="flex flex-row gap-6">
      <div className="flex-1">
        <div className="flex flex-col w-full gap-4 md:flex-row">
          <FormikTextField
            required
            autoComplete="off"
            name="name"
            label={t('manage.sessionForms.name')}
            tooltip={t('manage.sessionForms.microlearningName')}
            className={{
              root: 'mb-2 w-full md:w-1/2',
              tooltip: 'z-20',
              label: 'w-36',
            }}
            data-cy="insert-microlearning-name"
          />
          <FormikTextField
            required
            autoComplete="off"
            name="displayName"
            label={t('manage.sessionForms.displayName')}
            tooltip={t('manage.sessionForms.displayNameTooltip')}
            className={{
              root: 'mb-2 w-full md:w-1/2',
              tooltip: 'z-20',
              label: 'w-36',
            }}
            data-cy="insert-microlearning-display-name"
          />
        </div>

        <EditorField
          label={t('shared.generic.description')}
          tooltip={t('manage.sessionForms.microlearningDescField')}
          fieldName="description"
          data_cy="insert-microlearning-description"
          showToolbarOnFocus={false}
        />

        <div className="w-full text-right">
          <ErrorMessage
            name="description"
            component="div"
            className="text-sm text-red-400"
          />
        </div>
      </div>
      <div className="hidden md:block flex-initial w-[350px] border bg-slate-50 p-4 rounded prose prose-sm">
        <FontAwesomeIcon
          icon={faLightbulb}
          className="mr-2 text-orange-400"
          size="lg"
        />
        {t.rich('manage.sessionForms.microlearningUseCase', {
          link: (text) => (
            <a
              href="https://www.klicker.uzh.ch/use_cases/microlearning/"
              target="_blank"
            >
              {text}
            </a>
          ),
        })}
      </div>
    </div>
  )
}

function StepTwo(props: StepProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row items-center gap-4 text-left">
        <FormikSelectField
          name="courseId"
          items={
            props.courses?.map((course) => {
              return {
                ...course,
                data: { cy: `select-course-${course.label}` },
              }
            }) || []
          }
          required
          tooltip={t('manage.sessionForms.microlearningCourse')}
          label={t('shared.generic.course')}
          data={{ cy: 'select-course' }}
          className={{ tooltip: 'z-20' }}
          hideError
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
        tooltip={t('manage.sessionForms.microlearningStartDate')}
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
        tooltip={t('manage.sessionForms.microlearningEndDate')}
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
          tooltip={t('manage.sessionForms.microlearningMultiplier')}
          required
          items={[
            {
              label: t('manage.sessionForms.multiplier1'),
              value: '1',
              data: {
                cy: `select-multiplier-${t('manage.sessionForms.multiplier1')}`,
              },
            },
            {
              label: t('manage.sessionForms.multiplier2'),
              value: '2',
              data: {
                cy: `select-multiplier-${t('manage.sessionForms.multiplier2')}`,
              },
            },
            {
              label: t('manage.sessionForms.multiplier3'),
              value: '3',
              data: {
                cy: `select-multiplier-${t('manage.sessionForms.multiplier3')}`,
              },
            },
            {
              label: t('manage.sessionForms.multiplier4'),
              value: '4',
              data: {
                cy: `select-multiplier-${t('manage.sessionForms.multiplier4')}`,
              },
            },
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
    <div className="mt-2 mb-2">
      <BlockField fieldName="questions" />
    </div>
  )
}
