import { useMutation } from '@apollo/client'
import { faLightbulb, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreateGroupActivityDocument,
  EditGroupActivityDocument,
  ElementStackInput,
  ElementType,
  GetSingleCourseDocument,
  GroupActivity,
  ParameterType,
} from '@klicker-uzh/graphql/dist/ops'
import useGamifiedCourseGrouping from '@lib/hooks/useGamifiedCourseGrouping'
import {
  Button,
  FormikDateField,
  FormikSelectField,
  FormikTextField,
  Label,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import {
  ErrorMessage,
  FieldArray,
  FieldArrayRenderProps,
  useField,
  useFormikContext,
} from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../toasts/ElementCreationErrorToast'
import BlockField from './BlockField'
import EditorField from './EditorField'
import { ElementSelectCourse } from './ElementCreation'
import GroupActivityClueModal from './GroupActivityClueModal'
import MultistepWizard, {
  GroupActivityClueType,
  GroupActivityFormValues,
} from './MultistepWizard'
import WizardErrorMessage from './WizardErrorMessage'

interface GroupActivityWizardProps {
  title: string
  closeWizard: () => void
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
  courses?: {
    label: string
    value: string
  }[]
  initialValues?: GroupActivity
}

function GroupActivityWizard({
  title,
  closeWizard,
  gamifiedCourses,
  nonGamifiedCourses,
  courses,
  initialValues,
}: GroupActivityWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)

  const [createGroupActivity] = useMutation(CreateGroupActivityDocument)
  const [editGroupActivity] = useMutation(EditGroupActivityDocument)

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
          type: yup
            .string()
            .oneOf([ParameterType.String, ParameterType.Number]),
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

  const onSubmit = async (values: GroupActivityFormValues) => {
    try {
      let success = false
      if (initialValues) {
        const result = await editGroupActivity({
          variables: {
            id: initialValues?.id || '',
            name: values.name,
            displayName: values.displayName,
            description: values.description,
            startDate: dayjs(values.startDate).utc().format(),
            endDate: dayjs(values.endDate).utc().format(),
            multiplier: parseInt(values.multiplier),
            courseId: values.courseId,
            clues: values.clues,
            stack: values.questions.reduce<ElementStackInput>(
              (acc, q, ix) => {
                acc.elements.push({ elementId: q.id, order: ix })
                return acc
              },
              { order: 0, elements: [] }
            ),
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

        success = Boolean(result.data?.editGroupActivity)
      } else {
        const result = await createGroupActivity({
          variables: {
            name: values.name,
            displayName: values.displayName,
            description: values.description,
            startDate: dayjs(values.startDate).utc().format(),
            endDate: dayjs(values.endDate).utc().format(),
            multiplier: parseInt(values.multiplier),
            courseId: values.courseId,
            clues: values.clues,
            stack: values.questions.reduce<ElementStackInput>(
              (acc, q, ix) => {
                acc.elements.push({ elementId: q.id, order: ix })
                return acc
              },
              { order: 0, elements: [] }
            ),
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
        success = Boolean(result.data?.createGroupActivity)
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
              ? t.rich('manage.sessionForms.groupActivityEdited', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })
              : t.rich('manage.sessionForms.groupActivityCreated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })}
          </div>
        )}
        initialValues={{
          name: initialValues?.name || '',
          displayName: initialValues?.displayName || '',
          description: initialValues?.description || '',
          clues:
            initialValues?.clues?.map((clue) => {
              return {
                name: clue.name,
                displayName: clue.displayName,
                type: clue.type,
                value: clue.value,
                unit: clue.unit ?? undefined,
              }
            }) ?? [],
          questions:
            initialValues?.stacks && initialValues?.stacks[0].elements
              ? initialValues.stacks[0].elements?.map((element) => {
                  return {
                    id: element.elementData.elementId,
                    title: element.elementData.name,
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
          router.push(`/courses/${selectedCourseId}?tab=groupActivities`)
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
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
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
          data={{ cy: 'insert-groupactivity-description' }}
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
  const [clueIx, setClueIx] = useState<number | undefined>(undefined)
  const [clueModal, setClueModal] = useState(false)
  const { values } = useFormikContext<{
    courseId?: string
    [key: string]: any
  }>()

  const groupedCourses = useGamifiedCourseGrouping({
    gamifiedCourses: props.gamifiedCourses ?? [],
    nonGamifiedCourses: props.nonGamifiedCourses ?? [],
  })

  return (
    <div className="flex flex-row gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center gap-4 text-left">
          <FormikSelectField
            required
            hideError
            name="courseId"
            groups={groupedCourses}
            placeholder={t('manage.sessionForms.practiceQuizCoursePlaceholder')}
            tooltip={t('manage.sessionForms.groupActivityCourse')}
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
        <div className="w-full">
          <FieldArray name="clues">
            {({ push, remove, replace }: FieldArrayRenderProps) => (
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
                      className="text-sm rounded flex flex-row justify-between w-full border"
                      data-cy={`groupActivity-clue-${clue.name}`}
                    >
                      <div className="flex flex-col p-1">
                        <div className="font-bold">{clue.name}</div>
                        <div className="border-black h-full">
                          <div className="w-full h-full">
                            {clue.type === ParameterType.Number && clue.unit
                              ? `${clue.value} ${clue.unit}`
                              : clue.value}
                          </div>
                          {/* <Button
                        basic
                        onClick={() => remove(ix)}
                        className={{
                          root: 'h-full hidden p-1 w-full group-hover:flex bg-red-600 items-center justify-center',
                        }}
                        data={{ cy: `remove-clue-${clue.name}` }}
                      >
                        <Button.Icon>
                          <FontAwesomeIcon
                            className="text-white"
                            icon={faTrash}
                          />
                        </Button.Icon>
                      </Button> */}
                        </div>
                      </div>
                      <div className="h-full flex flex-col">
                        <Button
                          className={{ root: 'h-1/2' }}
                          data={{ cy: `edit-clue-${clue.name}` }}
                          onClick={() => {
                            setClueIx(ix)
                            setClueModal(true)
                          }}
                        >
                          <FontAwesomeIcon icon={faPencil} />
                        </Button>
                        <Button
                          className={{ root: 'h-1/2 bg-red-600 text-white' }}
                          data={{ cy: `remove-clue-${clue.name}` }}
                          onClick={() => remove(ix)}
                        >
                          <FontAwesomeIcon icon={faTrashCan} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <GroupActivityClueModal
                    open={clueModal}
                    setOpen={setClueModal}
                    pushClue={(values) => {
                      push(values)
                      setClueIx(undefined)
                    }}
                    replaceClue={(values) => {
                      replace(clueIx ?? -1, values)
                      setClueIx(undefined)
                    }}
                    initialValues={
                      typeof clueIx !== 'undefined'
                        ? field.value[clueIx]
                        : undefined
                    }
                    clueIx={clueIx}
                    unsetClueIx={() => setClueIx(undefined)}
                  />
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
          ElementType.FreeText,
          ElementType.Content,
        ]}
      />
    </div>
  )
}
