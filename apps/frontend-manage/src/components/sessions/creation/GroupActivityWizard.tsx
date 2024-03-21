import { faLightbulb } from '@fortawesome/free-regular-svg-icons'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementType, GroupActivity } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikDateField,
  FormikSelectField,
  FormikTextField,
  Label,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import {
  ErrorMessage,
  FieldArray,
  FieldArrayRenderProps,
  useField,
} from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../toasts/ElementCreationErrorToast'
import BlockField from './BlockField'
import EditorField from './EditorField'
import GroupActivityClueModal from './GroupActivityClueModal'
import MultistepWizard, { MicroLearningFormValues } from './MultistepWizard'
import WizardErrorMessage from './WizardErrorMessage'

interface GroupActivityWizardProps {
  title: string
  closeWizard: () => void
  courses?: {
    label: string
    value: string
  }[]
  initialValues?: GroupActivity
}

type GroupActivityClueType =
  | {
      name: string
      displayName: string
      type: 'STRING'
      value: string
    }
  | {
      name: string
      displayName: string
      type: 'NUMBER'
      value: number
      unit: string
    }

function GroupActivityWizard({
  title,
  closeWizard,
  courses,
  initialValues,
}: GroupActivityWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)

  // const [createMicroSession] = useMutation(CreateMicroLearningDocument)
  // const [editMicroSession] = useMutation(EditMicroLearningDocument)

  const [selectedCourseId, setSelectedCourseId] = useState('')

  const stepOneValidationSchema = yup.object().shape({
    name: yup
      .string()
      .required(t('manage.sessionForms.groupActivityNameError')),
    displayName: yup
      .string()
      .required(t('manage.sessionForms.groupActivityDisplayNameError')),
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
      .required(t('manage.sessionForms.groupActivityCourse')),
    clues: yup
      .array()
      .of(
        yup.object().shape({
          name: yup.string().required(t('manage.sessionForms.clueNameMissing')),
          displayName: yup
            .string()
            .required(t('manage.sessionForms.clueDisplayNameMissing')),
          type: yup.string().oneOf(['STRING', 'NUMBER']),
          value: yup
            .string()
            .required(t('manage.sessionForms.clueValueMissing')),
          unit: yup.string(),
        })
      )
      .min(2, t('manage.sessionForms.groupActivityMin2Clues')),
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
                ElementType.FreeText,
                ElementType.Content,
              ],
              t('manage.sessionForms.groupActivityTypes')
            ),
        })
      )
      .min(1),
  })

  const onSubmit = async (values: MicroLearningFormValues) => {
    // try {
    //   let success = false
    //   if (initialValues) {
    //     const result = await editMicroSession({
    //       variables: {
    //         id: initialValues?.id || '',
    //         name: values.name,
    //         displayName: values.displayName,
    //         description: values.description,
    //         stacks: values.questions.map((q: any, ix) => {
    //           return { order: ix, elements: [{ elementId: q.id, order: 0 }] }
    //         }),
    //         startDate: dayjs(values.startDate).utc().format(),
    //         endDate: dayjs(values.endDate).utc().format(),
    //         multiplier: parseInt(values.multiplier),
    //         courseId: values.courseId,
    //       },
    //       refetchQueries: [
    //         {
    //           query: GetSingleCourseDocument,
    //           variables: {
    //             courseId: values.courseId,
    //           },
    //         },
    //       ],
    //     })
    //     success = Boolean(result.data?.editMicroLearning)
    //   } else {
    //     const result = await createMicroSession({
    //       variables: {
    //         name: values.name,
    //         displayName: values.displayName,
    //         description: values.description,
    //         stacks: values.questions.map((q: any, ix) => {
    //           return { order: ix, elements: [{ elementId: q.id, order: 0 }] }
    //         }),
    //         startDate: dayjs(values.startDate).utc().format(),
    //         endDate: dayjs(values.endDate).utc().format(),
    //         multiplier: parseInt(values.multiplier),
    //         courseId: values.courseId,
    //       },
    //       refetchQueries: [
    //         {
    //           query: GetSingleCourseDocument,
    //           variables: {
    //             courseId: values.courseId,
    //           },
    //         },
    //       ],
    //     })
    //     success = Boolean(result.data?.createMicroLearning)
    //   }
    //   if (success) {
    //     setSelectedCourseId(values.courseId)
    //     setEditMode(!!initialValues)
    //     setIsWizardCompleted(true)
    //   }
    // } catch (error) {
    //   console.log(error)
    //   setEditMode(!!initialValues)
    //   setErrorToastOpen(true)
    // }
  }

  return (
    <>
      <MultistepWizard
        title={title}
        onCloseWizard={closeWizard}
        completionSuccessMessage={(elementName) => (
          <div>
            {editMode
              ? t.rich('manage.sessionForms.groupActivityCreated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })
              : t.rich('manage.sessionForms.groupActivityEdited', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })}
          </div>
        )}
        initialValues={{
          name: initialValues?.name || '',
          displayName: initialValues?.displayName || '',
          description: initialValues?.description || '',
          clues: [],
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
            tooltip: t('manage.sessionForms.groupActivityDescription'),
          },
          {
            title: t('shared.generic.settings'),
            tooltip: t('manage.sessionForms.groupActivitySettings'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
          {
            title: t('shared.generic.questions'),
            tooltip: t('manage.sessionForms.groupActivityQuestions'),
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
            ? t('manage.sessionForms.groupActivityEditingFailed')
            : t('manage.sessionForms.groupActivityCreationFailed')
        }
      />
    </>
  )
}

export default GroupActivityWizard

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
            tooltip={t('manage.sessionForms.groupActivityName')}
            className={{
              root: 'mb-2 w-full md:w-1/2',
              tooltip: 'z-20',
              label: 'w-36',
            }}
            data-cy="insert-groupactivity-name"
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
            data-cy="insert-groupactivity-display-name"
          />
        </div>

        <EditorField
          label={t('shared.generic.description')}
          tooltip={t('manage.sessionForms.groupActivityDescField')}
          fieldName="description"
          data_cy="insert-groupactivity-description"
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
        {t.rich('manage.sessionForms.groupActivityUseCase', {
          link: (text) => (
            <a
              href="https://www.klicker.uzh.ch/use_cases/group_activity/"
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
  const [field, meta, helpers] = useField<GroupActivityClueType[]>('clues')

  return (
    <div className="flex flex-row gap-8">
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
            tooltip={t('manage.sessionForms.groupActivityCourse')}
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
          tooltip={t('manage.sessionForms.groupActivityStartDate')}
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
          tooltip={t('manage.sessionForms.groupActivityEndDate')}
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
            tooltip={t('manage.sessionForms.groupActivityMultiplier')}
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
      </div>
      <div className="w-full">
        <FieldArray name="clues">
          {({ push, remove, move }: FieldArrayRenderProps) => (
            <div className="w-full">
              <div className="flex flex-row gap-4">
                <div className="flex flex-row items-center gap-3">
                  <Label
                    required
                    tooltip={t(
                      'manage.sessionForms.groupActivityCluesDescription'
                    )}
                    label={t('shared.generic.clues')}
                    showTooltipSymbol
                    className={{
                      root: 'font-bold',
                      tooltip: 'font-normal text-sm !z-30',
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3 w-full max-h-32 overflow-y-auto">
                {field.value.map((clue, ix) => (
                  <div
                    key={clue.name}
                    className="text-sm rounded flex flex-col w-full"
                  >
                    <div className="font-bold">{clue.name}</div>
                    <div className="group border rounded border-black h-full">
                      <div className="w-full p-1 group-hover:hidden h-full">{`${
                        clue.value
                      } ${clue.type === 'NUMBER' && (clue.unit ?? '')}`}</div>
                      <Button
                        basic
                        onClick={() => remove(ix)}
                        className={{
                          root: 'h-full hidden p-1 w-full group-hover:flex bg-red-600 items-center justify-center',
                        }}
                      >
                        <Button.Icon>
                          <FontAwesomeIcon
                            className="text-white"
                            icon={faTrash}
                          />
                        </Button.Icon>
                      </Button>
                    </div>
                  </div>
                ))}
                <GroupActivityClueModal pushClue={push} />
              </div>
              {meta.error && (
                <div className="text-sm text-red-400 px-2">
                  <WizardErrorMessage fieldName="clues" />
                  {typeof meta.error === 'string' && meta.error}
                </div>
              )}
            </div>
          )}
        </FieldArray>
      </div>
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
          ElementType.FreeText,
          ElementType.Content,
        ]}
      />
    </div>
  )
}
