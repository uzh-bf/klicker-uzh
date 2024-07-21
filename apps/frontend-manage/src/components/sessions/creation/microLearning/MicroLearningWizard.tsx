import { useMutation } from '@apollo/client'
import {
  CreateMicroLearningDocument,
  EditMicroLearningDocument,
  ElementType,
  GetSingleCourseDocument,
  MicroLearning,
} from '@klicker-uzh/graphql/dist/ops'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  FormikDateField,
  FormikSelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { ErrorMessage, useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../../toasts/ElementCreationErrorToast'
import BlockField from './../BlockField'
import { ElementSelectCourse } from './../ElementCreation'
import MultistepWizard, { MicroLearningFormValues } from './../MultistepWizard'
import MicroLearningDescriptionStep from './MicroLearningDescriptionStep'
import MicroLearningInformationStep from './MicroLearningInformationStep'
import MicroLearningSettingsStep from './MicroLearningSettingsStep'

export interface MicroLearningWizardStepProps {
  onSubmit?: () => void
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
  courses?: {
    label: string
    value: string
  }[]
}

interface MicroLearningWizardProps {
  title: string
  closeWizard: () => void
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
  courses?: {
    label: string
    value: string
  }[]
  initialValues?: MicroLearning
}

function MicroLearningWizard({
  title,
  closeWizard,
  gamifiedCourses,
  nonGamifiedCourses,
  initialValues,
}: MicroLearningWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)

  const [createMicroLearning] = useMutation(CreateMicroLearningDocument)
  const [editMicroLearning] = useMutation(EditMicroLearningDocument)

  const [selectedCourseId, setSelectedCourseId] = useState('')

  const nameValidationSchema = yup.object().shape({
    name: yup.string().required(t('manage.sessionForms.sessionName')),
  })

  const descriptionValidationSchema = yup.object().shape({
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
          type: yup
            .string()
            .oneOf(
              [
                ElementType.Sc,
                ElementType.Mc,
                ElementType.Kprim,
                ElementType.Numerical,
                ElementType.Flashcard,
                ElementType.Content,
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

  const onSubmit = async (values: MicroLearningFormValues) => {
    try {
      let success = false

      if (initialValues) {
        const result = await editMicroLearning({
          variables: {
            id: initialValues?.id || '',
            name: values.name,
            displayName: values.displayName,
            description: values.description,
            stacks: values.questions.map((q: any, ix) => {
              return { order: ix, elements: [{ elementId: q.id, order: 0 }] }
            }),
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
        success = Boolean(result.data?.editMicroLearning)
      } else {
        const result = await createMicroLearning({
          variables: {
            name: values.name,
            displayName: values.displayName,
            description: values.description,
            stacks: values.questions.map((q: any, ix) => {
              return { order: ix, elements: [{ elementId: q.id, order: 0 }] }
            }),
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
        success = Boolean(result.data?.createMicroLearning)
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
    <>
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
          questions: initialValues?.stacks
            ? initialValues.stacks.map((stack) => {
                return {
                  id: stack.elements![0].elementData.elementId,
                  title: stack.elements![0].elementData.name,
                  hasAnswerFeedbacks: true, // TODO - based on questionData options
                  hasSampleSolution: true, // TODO - based on questionData options
                }
              })
            : [],
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
          courseId: initialValues?.course?.id || undefined,
        }}
        onSubmit={onSubmit}
        isCompleted={isWizardCompleted}
        editMode={!!initialValues}
        initialValid={!!initialValues}
        onRestartForm={() => {
          setIsWizardCompleted(false)
        }}
        onViewElement={() => {
          router.push(`/courses/${selectedCourseId}?tab=microLearnings`)
        }}
        workflowItems={[
          {
            title: t('shared.generic.information'),
            tooltip: t('manage.sessionForms.microLearningInformation'),
          },
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
        <MicroLearningInformationStep validationSchema={nameValidationSchema} />
        <MicroLearningDescriptionStep
          validationSchema={descriptionValidationSchema}
        />
        <MicroLearningSettingsStep
          validationSchema={stepTwoValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
        />
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
    </>
  )
}

export default MicroLearningWizard

function StepTwo(props: MicroLearningWizardStepProps) {
  const t = useTranslations()
  const { values } = useFormikContext<{
    courseId?: string
    [key: string]: any
  }>()

  const groupedCourses = useGamifiedCourseGrouping({
    gamifiedCourses: props.gamifiedCourses ?? [],
    nonGamifiedCourses: props.nonGamifiedCourses ?? [],
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row items-center gap-4 text-left">
        <FormikSelectField
          required
          hideError
          name="courseId"
          groups={groupedCourses}
          placeholder={t('manage.sessionForms.practiceQuizCoursePlaceholder')}
          tooltip={t('manage.sessionForms.microlearningCourse')}
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
      {values.courseId ? (
        <>
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
        </>
      ) : (
        <UserNotification
          type="info"
          className={{ root: 'w-max max-w-[40rem]' }}
        >
          {/* // TODO: the case where no gamified course exists should be caught before starting the wizard - otherwise title and description already entered will be lost! */}
          {props.gamifiedCourses?.length === 0
            ? t('manage.sessionForms.missingGamifiedCourses')
            : t('manage.sessionForms.selectGamifiedCourse')}
        </UserNotification>
      )}

      {values.courseId && (
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
                  cy: `select-multiplier-${t(
                    'manage.sessionForms.multiplier1'
                  )}`,
                },
              },
              {
                label: t('manage.sessionForms.multiplier2'),
                value: '2',
                data: {
                  cy: `select-multiplier-${t(
                    'manage.sessionForms.multiplier2'
                  )}`,
                },
              },
              {
                label: t('manage.sessionForms.multiplier3'),
                value: '3',
                data: {
                  cy: `select-multiplier-${t(
                    'manage.sessionForms.multiplier3'
                  )}`,
                },
              },
              {
                label: t('manage.sessionForms.multiplier4'),
                value: '4',
                data: {
                  cy: `select-multiplier-${t(
                    'manage.sessionForms.multiplier4'
                  )}`,
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
      )}
    </div>
  )
}

function StepThree(_: MicroLearningWizardStepProps) {
  return (
    <div className="mt-2 mb-2">
      <BlockField
        fieldName="questions"
        acceptedTypes={[
          ElementType.Sc,
          ElementType.Mc,
          ElementType.Kprim,
          ElementType.Numerical,
          ElementType.Flashcard,
          ElementType.Content,
        ]}
      />
    </div>
  )
}
