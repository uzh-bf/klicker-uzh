import {
  GetSingleCourseDocument,
  GetUserSessionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { LiveSessionFormValues } from '../WizardLayout'

interface LiveSessionFormProps {
  id?: string
  editMode: boolean
  values: LiveSessionFormValues
  createLiveSession: any
  editLiveSession: any
  setIsWizardCompleted: (isCompleted: boolean) => void
  setErrorToastOpen: (isOpen: boolean) => void
}

async function submitLiveSessionForm({
  id,
  editMode,
  values,
  createLiveSession,
  editLiveSession,
  setIsWizardCompleted,
  setErrorToastOpen,
}: LiveSessionFormProps) {
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

    if (editMode && id) {
      const session = await editLiveSession({
        variables: {
          id: id,
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          blocks: blockQuestions,
          courseId: values.courseId,
          multiplier: values.courseId !== '' ? parseInt(values.multiplier) : 1,
          maxBonusPoints: parseInt(String(values.maxBonusPoints)),
          timeToZeroBonus: parseInt(String(values.timeToZeroBonus)),
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
          ...(values.courseId
            ? [
                {
                  query: GetSingleCourseDocument,
                  variables: {
                    courseId: values.courseId,
                  },
                },
              ]
            : []),
        ],
      })
      success = Boolean(session.data?.editSession)
    } else {
      const session = await createLiveSession({
        variables: {
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          blocks: blockQuestions,
          courseId: values.courseId,
          multiplier: parseInt(values.multiplier),
          maxBonusPoints: parseInt(String(values.maxBonusPoints)),
          timeToZeroBonus: parseInt(String(values.timeToZeroBonus)),
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
          ...(values.courseId
            ? [
                {
                  query: GetSingleCourseDocument,
                  variables: {
                    courseId: values.courseId,
                  },
                },
              ]
            : []),
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

export default submitLiveSessionForm
