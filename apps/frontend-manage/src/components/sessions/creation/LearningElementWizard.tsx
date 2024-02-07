import { useMutation } from '@apollo/client'
import { faLightbulb } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreatePracticeQuizDocument,
  EditPracticeQuizDocument,
  ElementType,
  GetSingleCourseDocument,
  LearningElementOrderType,
  PracticeQuiz,
} from '@klicker-uzh/graphql/dist/ops'
import {
  FormikNumberField,
  FormikSelectField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { ErrorMessage } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../toasts/ElementCreationErrorToast'
import BlockField from './BlockField'
import EditorField from './EditorField'
import MultistepWizard, { LearningElementFormValues } from './MultistepWizard'

interface LearningElementWizardProps {
  title: string
  closeWizard: () => void
  courses: {
    label: string
    value: string
  }[]
  initialValues?: PracticeQuiz
}

function LearningElementWizard({
  title,
  closeWizard,
  courses,
  initialValues,
}: LearningElementWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [createLearningElement] = useMutation(CreatePracticeQuizDocument)
  const [editLearningElement] = useMutation(EditPracticeQuizDocument)
  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(!!initialValues)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)

  const stepOneValidationSchema = yup.object().shape({
    name: yup.string().required(t('manage.sessionForms.sessionName')),
    displayName: yup
      .string()
      .required(t('manage.sessionForms.sessionDisplayName')),
    description: yup.string(),
  })

  //TODO: adjust validation
  const stepTwoValidationSchema = yup.object().shape({
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, t('manage.sessionForms.validMultiplicator')),
    courseId: yup
      .string()
      .required(t('manage.sessionForms.learningElementCourse')),
    order: yup.string(),
    resetTimeDays: yup
      .string()
      .required(t('manage.sessionForms.learningElementResetDays'))
      .matches(
        /^[0-9]+$/,
        t('manage.sessionForms.learningElementValidResetDays')
      ),
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
              t('manage.sessionForms.learningElementTypes')
            ),
          hasSampleSolution: yup
            .boolean()
            .isTrue(t('manage.sessionForms.learningElementSolutionReq')),
          // hasAnswerFeedbacks: yup.boolean().when('type', {
          //   is: (type) => ['SC', 'MC', 'KPRIM'].includes(type),
          //   then: yup.boolean().isTrue(),
          // }),
        })
      )
      .min(1),
  })

  const onSubmit = async (values: LearningElementFormValues) => {
    try {
      if (initialValues) {
        const result = await editLearningElement({
          variables: {
            id: initialValues.id,
            name: values.name,
            displayName: values.displayName,
            description: values.description,
            stacks: values.questions.map((q: any, ix) => {
              return { order: ix, elements: [{ elementId: q.id, order: 0 }] }
            }),
            multiplier: parseInt(values.multiplier),
            courseId: values.courseId,
            order: values.order,
            resetTimeDays: parseInt(values.resetTimeDays),
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

        if (result.data?.editPracticeQuiz) {
          setIsWizardCompleted(true)
        }
        setSelectedCourseId(values.courseId)
      } else {
        const result = await createLearningElement({
          variables: {
            name: values.name,
            displayName: values.displayName,
            description: values.description,
            stacks: values.questions.map((q: any, ix) => {
              return { order: ix, elements: [{ elementId: q.id, order: 0 }] }
            }),
            multiplier: parseInt(values.multiplier),
            courseId: values.courseId,
            order: values.order,
            resetTimeDays: parseInt(values.resetTimeDays),
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

        if (result.data?.createPracticeQuiz) {
          setIsWizardCompleted(true)
        }
        setSelectedCourseId(values.courseId)
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
              ? t.rich('manage.sessionForms.learningElementUpdated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })
              : t.rich('manage.sessionForms.learningElementCreated', {
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
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          courseId: initialValues?.course?.id || courses?.[0]?.value,
          order:
            initialValues?.orderType || LearningElementOrderType.Sequential,
          resetTimeDays: initialValues?.resetTimeDays || '6',
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
            tooltip: t('manage.sessionForms.learningElementDescription'),
          },
          {
            title: t('shared.generic.settings'),
            tooltip: t('manage.sessionForms.learningElementSettings'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
          {
            title: t('shared.generic.questions'),
            tooltip: t('manage.sessionForms.learningElementContent'),
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
            ? t('manage.sessionForms.learningElementEditingFailed')
            : t('manage.sessionForms.learningElementCreationFailed')
        }
      />
    </div>
  )
}

export default LearningElementWizard

interface StepProps {
  onSubmit?: () => void
  validationSchema: any
  isInitialValid?: boolean
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
            tooltip={t('manage.sessionForms.learningElementName')}
            className={{
              root: 'mb-2 w-full md:w-1/2',
              tooltip: 'z-20',
              label: 'w-36',
            }}
            data-cy="insert-practice-quiz-name"
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
            data-cy="insert-practice-quiz-display-name"
          />
        </div>

        <EditorField
          label={t('shared.generic.description')}
          tooltip={t('manage.sessionForms.learningElementDescField')}
          fieldName="description"
          data_cy="insert-practice-quiz-description"
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
        {t.rich('manage.sessionForms.practiceQuizUseCase', {
          link: (text) => (
            <a
              href="https://www.klicker.uzh.ch/use_cases/practice_quiz/"
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
      <div className="flex flex-row items-center gap-4">
        <FormikSelectField
          name="courseId"
          items={
            props.courses?.map((course) => {
              return {
                ...course,
                data: { cy: `select-course-${course.label}` },
              }
            }) || [{ label: '', value: '' }]
          }
          required
          tooltip={t('manage.sessionForms.learningElementSelectCourse')}
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

      <div className="flex flex-row items-center gap-4">
        <FormikSelectField
          label={t('shared.generic.multiplier')}
          required
          tooltip={t('manage.sessionForms.learningElementMultiplier')}
          name="multiplier"
          placeholder={t('manage.sessionForms.multiplierDefault')}
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

      <div className="flex flex-row items-center gap-4">
        <FormikNumberField
          name="resetTimeDays"
          label={t('shared.generic.repetitionInterval')}
          tooltip={t('manage.sessionForms.learningElementRepetition')}
          className={{
            root: 'w-[100px]',
            tooltip: 'z-20',
          }}
          required
          hideError={true}
          data={{ cy: 'insert-reset-time-days' }}
        />
        <ErrorMessage
          name="resetTimeDays"
          component="div"
          className="text-sm text-red-400"
        />
      </div>

      <div className="flex flex-row items-center gap-4">
        <FormikSelectField
          label={t('shared.generic.order')}
          tooltip={t('manage.sessionForms.learningElementOrder')}
          name="order"
          placeholder={t('manage.sessionForms.learningElemenSelectOrder')}
          items={Object.values(LearningElementOrderType).map((order) => {
            return {
              value: order,
              label: t(`manage.sessionForms.learningElement${order}`),
              data: {
                cy: `select-order-${t(
                  `manage.sessionForms.learningElement${order}`
                )}`,
              },
            }
          })}
          required
          data={{ cy: 'select-order' }}
          className={{ tooltip: 'z-20' }}
        />
        <ErrorMessage
          name="order"
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
