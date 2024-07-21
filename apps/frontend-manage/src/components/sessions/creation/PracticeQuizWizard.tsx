import { useMutation } from '@apollo/client'
import { faLightbulb } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreatePracticeQuizDocument,
  EditPracticeQuizDocument,
  ElementOrderType,
  ElementType,
  GetSingleCourseDocument,
  PracticeQuiz,
} from '@klicker-uzh/graphql/dist/ops'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  FormikDateField,
  FormikNumberField,
  FormikSelectField,
  FormikTextField,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { ErrorMessage, useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../toasts/ElementCreationErrorToast'
import BlockField from './BlockField'
import EditorField from './EditorField'
import { ElementSelectCourse } from './ElementCreation'
import MultistepWizard, { PracticeQuizFormValues } from './MultistepWizard'

interface PracticeQuizWizardProps {
  title: string
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
  closeWizard: () => void
  courses: {
    label: string
    value: string
  }[]
  initialValues?: PracticeQuiz
  conversion?: boolean
}

function PracticeQuizWizard({
  title,
  gamifiedCourses,
  nonGamifiedCourses,
  closeWizard,
  courses,
  initialValues,
  conversion = false,
}: PracticeQuizWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [createPracticeQuiz] = useMutation(CreatePracticeQuizDocument)
  const [editPracticeQuiz] = useMutation(EditPracticeQuizDocument)
  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(!!initialValues && !conversion)
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
      .required(t('manage.sessionForms.practiceQuizSelectCourse')),
    order: yup.string(),
    availableFrom: yup.date(),
    resetTimeDays: yup
      .string()
      .required(t('manage.sessionForms.practiceQuizResetDays'))
      .matches(/^[0-9]+$/, t('manage.sessionForms.practiceQuizValidResetDays')),
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
              t('manage.sessionForms.practiceQuizElementTypes')
            ),
          hasSampleSolution: yup
            .boolean()
            .isTrue(t('manage.sessionForms.practiceQuizSolutionReq')),
          // hasAnswerFeedbacks: yup.boolean().when('type', {
          //   is: (type) => ['SC', 'MC', 'KPRIM'].includes(type),
          //   then: yup.boolean().isTrue(),
          // }),
        })
      )
      .min(1),
  })

  const onSubmit = async (values: PracticeQuizFormValues) => {
    try {
      if (initialValues && !conversion) {
        const result = await editPracticeQuiz({
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
            availableFrom: dayjs(values.availableFrom).utc().format(),
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
        const result = await createPracticeQuiz({
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
            availableFrom: dayjs(values.availableFrom).utc().format(),
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
      setEditMode(!!initialValues && !conversion)
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
              ? t.rich('manage.sessionForms.practiceQuizUpdated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })
              : t.rich('manage.sessionForms.practiceQuizCreated', {
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
          courseId: initialValues?.course?.id || undefined,
          order: initialValues?.orderType || ElementOrderType.SpacedRepetition,
          availableFrom: initialValues?.availableFrom
            ? dayjs(initialValues?.availableFrom)
                .local()
                .format('YYYY-MM-DDTHH:mm')
            : dayjs().local().format('YYYY-MM-DDTHH:mm'),
          resetTimeDays: initialValues?.resetTimeDays || '6',
        }}
        onSubmit={onSubmit}
        isCompleted={isWizardCompleted}
        editMode={!!initialValues && !conversion}
        initialValid={!!initialValues}
        onRestartForm={() => {
          setIsWizardCompleted(false)
        }}
        onViewElement={() => {
          router.push(`/courses/${selectedCourseId}?tab=practiceQuizzes`)
        }}
        workflowItems={[
          {
            title: t('shared.generic.description'),
            tooltip: t('manage.sessionForms.practiceQuizDescription'),
          },
          {
            title: t('shared.generic.settings'),
            tooltip: t('manage.sessionForms.practiceQuizSettings'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
          {
            title: t('shared.generic.questions'),
            tooltip: t('manage.sessionForms.practiceQuizContent'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
        ]}
      >
        <StepOne validationSchema={stepOneValidationSchema} />
        <StepTwo
          validationSchema={stepTwoValidationSchema}
          courses={courses}
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
            ? t('manage.sessionForms.practiceQuizEditingFailed')
            : t('manage.sessionForms.practiceQuizCreationFailed')
        }
      />
    </>
  )
}

export default PracticeQuizWizard

interface StepProps {
  onSubmit?: () => void
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
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
            tooltip={t('manage.sessionForms.practiceQuizName')}
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
          tooltip={t('manage.sessionForms.practiceQuizDescField')}
          fieldName="description"
          data={{ cy: 'insert-practice-quiz-description' }}
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
  const { values } = useFormikContext<{
    courseId?: string
    [key: string]: any
  }>()

  // const { validateField } = useFormikContext()

  // useEffect(() => {
  //   const validator = async () => {
  //     await validateField('courseId')
  //   }
  //   validator()
  // }, [validateField, props.courses])

  const groupedCourses = useGamifiedCourseGrouping({
    gamifiedCourses: props.gamifiedCourses ?? [],
    nonGamifiedCourses: props.nonGamifiedCourses ?? [],
  })

  return (
    <div className="flex flex-col md:flex-row gap-2 md:gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center gap-4">
          <FormikSelectField
            required
            hideError
            placeholder={t('manage.sessionForms.practiceQuizCoursePlaceholder')}
            name="courseId"
            groups={groupedCourses}
            tooltip={t('manage.sessionForms.practiceQuizSelectCourse')}
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
            <div className="flex flex-row items-center gap-4">
              <FormikSelectField
                label={t('shared.generic.multiplier')}
                required
                tooltip={t('manage.sessionForms.practiceQuizMultiplier')}
                name="multiplier"
                placeholder={t('manage.sessionForms.multiplierDefault')}
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

            <div className="flex flex-row items-center gap-4">
              <FormikDateField
                label={t('shared.generic.availableFrom')}
                name="availableFrom"
                tooltip={t('manage.sessionForms.practiceQuizAvailableFrom')}
                className={{
                  root: 'w-[24rem]',
                  input: 'bg-uzh-grey-20',
                  tooltip: 'z-20 w-80 md:w-max',
                }}
                data={{ cy: 'select-available-from' }}
              />
              <ErrorMessage
                name="availableFrom"
                component="div"
                className="text-sm text-red-400"
              />
            </div>
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
      </div>

      {values.courseId && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-row items-center gap-4">
            <FormikNumberField
              name="resetTimeDays"
              label={t('shared.generic.repetitionInterval')}
              tooltip={t('manage.sessionForms.practiceQuizRepetition')}
              className={{
                root: '!w-80',
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
              tooltip={t('manage.sessionForms.practiceQuizOrder')}
              name="order"
              placeholder={t('manage.sessionForms.practiceQuizSelectOrder')}
              items={Object.values(ElementOrderType).map((order) => {
                return {
                  value: order,
                  label: t(`manage.sessionForms.practiceQuiz${order}`),
                  data: {
                    cy: `select-order-${t(
                      `manage.sessionForms.practiceQuiz${order}`
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
      )}
    </div>
  )
}

function StepThree(_: StepProps) {
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
