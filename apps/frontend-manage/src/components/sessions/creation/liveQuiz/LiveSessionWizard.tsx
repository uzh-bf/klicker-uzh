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
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../../toasts/ElementCreationErrorToast'
import { ElementSelectCourse } from '../ElementCreation'
import MultistepWizard, { LiveSessionFormValues } from '../MultistepWizard'
import LiveQuizDescriptionStep from './LiveQuizDescriptionStep'
import LiveQuizInformationStep from './LiveQuizInformationStep'
import LiveQuizQuestionsStep from './LiveQuizQuestionsStep'
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
        questionIds: yup.array().of(yup.number()),
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
        <LiveQuizQuestionsStep
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
