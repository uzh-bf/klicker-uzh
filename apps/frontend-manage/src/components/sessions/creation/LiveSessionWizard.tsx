import { useMutation } from '@apollo/client'
import { faLightbulb } from '@fortawesome/free-regular-svg-icons'
import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreateSessionDocument,
  EditSessionDocument,
  Element,
  ElementType,
  GetSingleCourseDocument,
  GetUserSessionsDocument,
  Session,
  StartSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikSwitchField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { ErrorMessage, useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../toasts/ElementCreationErrorToast'
import EditorField from './EditorField'
import MultistepWizard, { LiveSessionFormValues } from './MultistepWizard'
import SessionBlockField from './SessionBlockField'

interface LiveSessionWizardProps {
  title: string
  courses?: {
    label: string
    value: string
    isGamified: boolean
  }[]
  initialValues?: Partial<Session>
  selection: Record<number, Element>
  resetSelection: () => void
  closeWizard: () => void
  editMode: boolean
}

function LiveSessionWizard({
  title,
  courses,
  initialValues,
  selection,
  resetSelection,
  closeWizard,
  editMode,
}: LiveSessionWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [editSession] = useMutation(EditSessionDocument)
  const [createSession, { data }] = useMutation(CreateSessionDocument)
  const [startSession] = useMutation(StartSessionDocument)

  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [errorToastOpen, setErrorToastOpen] = useState(false)

  const stepOneValidationSchema = yup.object().shape({
    name: yup.string().required(t('manage.sessionForms.sessionName')),
    displayName: yup
      .string()
      .required(t('manage.sessionForms.sessionDisplayName')),
    description: yup.string(),
  })

  const stepTwoValidationSchema = yup.object().shape({
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, t('manage.sessionForms.validMultiplicator')),
    courseId: yup.string(),
    isGamificationEnabled: yup
      .boolean()
      .required(t('manage.sessionForms.liveQuizGamified')),
  })

  const stepThreeValidationSchema = yup.object().shape({
    blocks: yup.array().of(
      yup.object().shape({
        ids: yup.array().of(yup.number()),
        titles: yup.array().of(yup.string()),
        types: yup
          .array()
          .of(
            yup
              .string()
              .oneOf(
                [
                  ElementType.Sc,
                  ElementType.Mc,
                  ElementType.Kprim,
                  ElementType.Numerical,
                  ElementType.FreeText,
                ],
                t('manage.sessionForms.liveQuizTypes')
              )
          ),
        timeLimit: yup
          .number()
          .min(1, t('manage.sessionForms.liveQuizTimeRestriction')),
        questionIds: yup.array(),
      })
    ),
  })

  const onSubmit = async (values: LiveSessionFormValues) => {
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

      if (editMode && initialValues) {
        const session = await editSession({
          variables: {
            id: initialValues.id || '',
            name: values.name,
            displayName: values.displayName,
            description: values.description,
            blocks: blockQuestions,
            courseId: values.courseId,
            multiplier:
              values.courseId !== '' ? parseInt(values.multiplier) : 1,
            isGamificationEnabled:
              values.courseId !== '' && values.isGamificationEnabled,
            isConfusionFeedbackEnabled: values.isConfusionFeedbackEnabled,
            isLiveQAEnabled: values.isLiveQAEnabled,
            isModerationEnabled: values.isModerationEnabled,
          },
          refetchQueries: [
            {
              query: GetUserSessionsDocument,
            },
            values.courseId
              ? {
                  query: GetSingleCourseDocument,
                  variables: {
                    courseId: values.courseId,
                  },
                }
              : '',
          ],
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
            isGamificationEnabled:
              values.courseId !== '' && values.isGamificationEnabled,
            isConfusionFeedbackEnabled: values.isConfusionFeedbackEnabled,
            isLiveQAEnabled: values.isLiveQAEnabled,
            isModerationEnabled: values.isModerationEnabled,
          },
          refetchQueries: [
            {
              query: GetUserSessionsDocument,
            },
            values.courseId
              ? {
                  query: GetSingleCourseDocument,
                  variables: {
                    courseId: values.courseId,
                  },
                }
              : '',
          ],
        })
        success = Boolean(session.data?.createSession)
      }

      if (success) {
        setIsWizardCompleted(true)
      }
    } catch (error) {
      console.log('error: ', error)
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
              ? t.rich('manage.sessionForms.liveQuizUpdated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })
              : t.rich('manage.sessionForms.liveQuizCreated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })}
          </div>
        )}
        customCompletionAction={
          !editMode &&
          data?.createSession?.id && (
            <Button
              data={{ cy: 'quick-start' }}
              onClick={async () => {
                await startSession({
                  variables: {
                    id: data?.createSession?.id as string,
                  },
                })
                router.push(`/sessions/${data?.createSession?.id}/cockpit`)
              }}
              className={{ root: 'space-x-1' }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faPlay} />
              </Button.Icon>
              <Button.Label>Start now</Button.Label>
            </Button>
          )
        }
        initialValues={{
          name: initialValues?.name || '',
          displayName: initialValues?.displayName || '',
          description: initialValues?.description || '',
          blocks: initialValues?.blocks?.map((block) => {
            return {
              questionIds: block.instances?.map(
                (instance) => instance.questionData.questionId
              ),
              titles: block.instances?.map(
                (instance) => instance.questionData.name
              ),
              types: block.instances?.map(
                (instance) => instance.questionData.type
              ),
              timeLimit: block.timeLimit ?? undefined,
            }
          }) || [
            { questionIds: [], titles: [], types: [], timeLimit: undefined },
          ],
          courseId: initialValues?.course?.id || '',
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          isGamificationEnabled: initialValues?.isGamificationEnabled ?? false,
          isConfusionFeedbackEnabled:
            initialValues?.isConfusionFeedbackEnabled ?? true,
          isLiveQAEnabled: initialValues?.isLiveQAEnabled ?? false,
          isModerationEnabled: initialValues?.isModerationEnabled ?? true,
        }}
        onSubmit={onSubmit}
        isCompleted={isWizardCompleted}
        editMode={editMode}
        initialValid={!!initialValues}
        onRestartForm={() => {
          setIsWizardCompleted(false)
        }}
        onViewElement={() => {
          router.push(`/sessions`)
        }}
        workflowItems={[
          {
            title: t('shared.generic.description'),
            tooltip: t('manage.sessionForms.liveQuizDescription'),
          },
          {
            title: t('shared.generic.settings'),
            tooltip: t('manage.sessionForms.liveQuizSettings'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
          {
            title: t('manage.sessionForms.liveQuizBlocks'),
            tooltip: t('manage.sessionForms.liveQuizDragDrop'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
        ]}
      >
        <StepOne validationSchema={stepOneValidationSchema} />
        <StepTwo validationSchema={stepTwoValidationSchema} courses={courses} />
        <StepThree
          validationSchema={stepThreeValidationSchema}
          selection={selection}
          resetSelection={resetSelection}
        />
      </MultistepWizard>
      <ElementCreationErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        error={
          editMode
            ? t('manage.sessionForms.liveQuizEditingFailed')
            : t('manage.sessionForms.liveQuizCreationFailed')
        }
      />
    </>
  )
}

export default LiveSessionWizard

interface StepProps {
  onSubmit?: () => void
  validationSchema: any
  courses?: {
    label: string
    value: string
    isGamified: boolean
  }[]
  selection?: Record<number, Element>
  resetSelection?: () => void
}

function StepOne(_: StepProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-row gap-6">
      <div className="flex-1">
        <div className="flex flex-col gap-4 md:flex-row">
          <FormikTextField
            required
            autoComplete="off"
            name="name"
            label={t('manage.sessionForms.name')}
            tooltip={t('manage.sessionForms.liveQuizName')}
            className={{
              root: 'mb-2 w-full md:w-1/2',
              tooltip: 'z-20',
              label: 'w-36',
            }}
            data-cy="insert-live-quiz-name"
            shouldValidate={() => true}
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
            data-cy="insert-live-display-name"
          />
        </div>
        <EditorField
          // key={fieldName.value}
          label={t('shared.generic.description')}
          tooltip={t('manage.sessionForms.liveQuizDescField')}
          fieldName="description"
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
        {t.rich('manage.sessionForms.liveQuizUseCase', {
          link: (text) => (
            <a
              href="https://www.klicker.uzh.ch/use_cases/live_quiz/"
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
  const { values, setFieldValue } = useFormikContext()

  useEffect(() => {
    if (values.courseId === '') {
      setFieldValue('isGamificationEnabled', false)
      setFieldValue('multiplier', '1')
    } else {
      setFieldValue(
        'isGamificationEnabled',
        props.courses?.find((course) => course.value === values.courseId)
          ?.isGamified
      )
    }
  }, [values.courseId])

  useEffect(() => {
    if (values.isGamificationEnabled === false) {
      setFieldValue('multiplier', '1')
    }
  }, [values.isGamificationEnabled])

  const preparedCourses = props.courses?.map((course) => {
    return {
      ...course,
      data: { cy: `select-course-${course.label}` },
    }
  })

  return (
    <div className="flex flex-row gap-16">
      {props.courses && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-center gap-4">
            <FormikSelectField
              name="courseId"
              label={t('shared.generic.course')}
              tooltip={t('manage.sessionForms.liveQuizDescCourse')}
              placeholder={t('manage.sessionForms.liveQuizSelectCourse')}
              items={[
                {
                  label: t('manage.sessionForms.liveQuizNoCourse'),
                  value: '',
                  data: {
                    cy: `select-course-${t(
                      'manage.sessionForms.liveQuizNoCourse'
                    )}`,
                  },
                },
                ...(preparedCourses || []),
              ]}
              hideError
              data={{ cy: 'select-course' }}
              className={{ tooltip: 'z-20' }}
            />
            <ErrorMessage
              name="courseId"
              component="div"
              className="text-sm text-red-400"
            />
          </div>

          <div>
            <FormikSwitchField
              disabled
              name="isGamificationEnabled"
              label={t('shared.generic.gamification')}
              tooltip={t('manage.sessionForms.liveQuizGamification')}
              standardLabel
              data={{ cy: 'set-gamification' }}
              className={{ tooltip: 'z-20' }}
            />
            <ErrorMessage
              name="isGamificationEnabled"
              component="div"
              className="text-sm text-red-400"
            />
          </div>
          <div className="flex flex-row items-center gap-4">
            <FormikSelectField
              disabled={!values.isGamificationEnabled}
              name="multiplier"
              label={t('shared.generic.multiplier')}
              tooltip={t('manage.sessionForms.liveQuizMultiplier')}
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
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div>
          <FormikSwitchField
            name="isConfusionFeedbackEnabled"
            label={t('shared.generic.feedbackChannel')}
            tooltip={t('manage.sessionForms.liveQuizFeedbackChannel')}
            standardLabel
            data={{ cy: 'set-feedback-enabled' }}
            className={{ tooltip: 'z-20' }}
          />
          <ErrorMessage
            name="isConfusionFeedbackEnabled"
            component="div"
            className="text-sm text-red-400"
          />
        </div>
        <div>
          <FormikSwitchField
            name="isLiveQAEnabled"
            label={t('shared.generic.liveQA')}
            tooltip={t('manage.sessionForms.liveQuizLiveQA')}
            standardLabel
            data={{ cy: 'set-liveqa-enabled' }}
            className={{ tooltip: 'z-20' }}
          />
          <ErrorMessage
            name="isLiveQAEnabled"
            component="div"
            className="text-sm text-red-400"
          />
        </div>
        <div>
          <FormikSwitchField
            disabled={!values.isLiveQAEnabled}
            name="isModerationEnabled"
            label={t('shared.generic.moderation')}
            tooltip={t('manage.sessionForms.liveQuizModeration')}
            standardLabel
            data={{ cy: 'set-liveqa-moderation' }}
            className={{ tooltip: 'z-20' }}
          />
          <ErrorMessage
            name="isModerationEnabled"
            component="div"
            className="text-sm text-red-400"
          />
        </div>
      </div>
    </div>
  )
}

function StepThree(props: StepProps) {
  return (
    <SessionBlockField
      fieldName="blocks"
      selection={props.selection}
      resetSelection={props.resetSelection}
    />
  )
}
