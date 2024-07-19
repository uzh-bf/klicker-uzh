import { useMutation } from '@apollo/client'
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
import useLiveQuizCourseGrouping from '@lib/hooks/useLiveQuizCourseGrouping'
import {
  Button,
  FormikSelectField,
  FormikSwitchField,
} from '@uzh-bf/design-system'
import { ErrorMessage, useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../../toasts/ElementCreationErrorToast'
import { ElementSelectCourse } from '../ElementCreation'
import MultistepWizard, { LiveSessionFormValues } from '../MultistepWizard'
import SessionBlockField from '../SessionBlockField'
import LiveQuizDescriptionStep from './LiveQuizDescriptionStep'
import LiveQuizInformationStep from './LiveQuizInformationStep'
import LiveQuizSettingsStep from './LiveQuizSettingsStep'

export interface LiveQuizWizardStepProps {
  onSubmit?: () => void
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
  selection?: Record<number, Element>
  resetSelection?: () => void
}

interface LiveSessionWizardProps {
  title: string
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
  initialValues?: Partial<Session>
  selection: Record<number, Element>
  resetSelection: () => void
  closeWizard: () => void
  editMode: boolean
}

function LiveSessionWizard({
  title,
  gamifiedCourses,
  nonGamifiedCourses,
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

  const nameValidationSchema = yup.object().shape({
    name: yup.string().required(t('manage.sessionForms.sessionName')),
  })

  const descriptionValidationSchema = yup.object().shape({
    displayName: yup
      .string()
      .required(t('manage.sessionForms.sessionDisplayName')),
    description: yup.string(),
  })

  const settingsValidationSchema = yup.object().shape({
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, t('manage.sessionForms.validMultiplicator')),
    courseId: yup.string(),
    isGamificationEnabled: yup
      .boolean()
      .required(t('manage.sessionForms.liveQuizGamified')),
  })

  const questionsValidationSchema = yup.object().shape({
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
              <Button.Label>
                {t('manage.sessionForms.liveQuizStartNow')}
              </Button.Label>
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
                (instance) => instance.questionData!.questionId
              ),
              titles: block.instances?.map(
                (instance) => instance.questionData!.name
              ),
              types: block.instances?.map(
                (instance) => instance.questionData!.type
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
            title: t('shared.generic.information'),
            tooltip: t('manage.sessionForms.liveQuizInformation'),
          },
          {
            title: t('shared.generic.description'),
            tooltip: t('manage.sessionForms.liveQuizDescription'),
            tooltipDisabled: t('manage.sessionForms.liveQuizDescription'),
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
        <LiveQuizInformationStep validationSchema={nameValidationSchema} />
        <LiveQuizDescriptionStep
          validationSchema={descriptionValidationSchema}
        />
        <LiveQuizSettingsStep
          validationSchema={settingsValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
        />
        <StepThree
          validationSchema={questionsValidationSchema}
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

function StepTwo(props: LiveQuizWizardStepProps) {
  const t = useTranslations()
  const { values, setFieldValue } = useFormikContext<LiveSessionFormValues>()

  useEffect(() => {
    if (values.courseId === '') {
      setFieldValue('isGamificationEnabled', false)
      setFieldValue('multiplier', '1')
    } else {
      setFieldValue(
        'isGamificationEnabled',
        [...props.gamifiedCourses!, ...props.nonGamifiedCourses!].find(
          (course) => course.value === values.courseId
        )?.isGamified
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.courseId])

  useEffect(() => {
    if (values.isGamificationEnabled === false) {
      setFieldValue('multiplier', '1')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.isGamificationEnabled])

  const groupedCourses = useLiveQuizCourseGrouping({
    gamifiedCourses: props.gamifiedCourses ?? [],
    nonGamifiedCourses: props.nonGamifiedCourses ?? [],
  })

  return (
    <div className="flex flex-row gap-16">
      <div className="flex flex-col gap-4">
        <div className="flex flex-row items-center gap-4">
          <FormikSelectField
            name="courseId"
            label={t('shared.generic.course')}
            tooltip={t('manage.sessionForms.liveQuizDescCourse')}
            placeholder={t('manage.sessionForms.liveQuizSelectCourse')}
            groups={groupedCourses}
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

function StepThree(props: LiveQuizWizardStepProps) {
  return (
    <SessionBlockField
      fieldName="blocks"
      selection={props.selection}
      resetSelection={props.resetSelection}
    />
  )
}
