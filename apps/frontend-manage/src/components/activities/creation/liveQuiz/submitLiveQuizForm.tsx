import {
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
  GetUserLiveQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { ElementBlockFormValues, LiveQuizFormValues } from '../WizardLayout'

interface LiveQuizFormProps {
  id?: string
  editMode: boolean
  values: LiveQuizFormValues
  createLiveQuiz: any
  editLiveQuiz: any
  setIsWizardCompleted: (isCompleted: boolean) => void
  onError: () => void
}

async function submitLiveQuizForm({
  id,
  editMode,
  values,
  createLiveQuiz,
  editLiveQuiz,
  setIsWizardCompleted,
  onError,
}: LiveQuizFormProps) {
  const blockSubmission = values.blocks.map(
    (block: ElementBlockFormValues, ix) => {
      return {
        order: ix,
        timeLimit: block.timeLimit,
        elements: block.elements.map((element, ix) => {
          return {
            elementId: element.id,
            order: ix,
            existingInstanceId: element.existingInstanceId,
            duplicateInstance: element.duplicateInstance,
          }
        }),
      }
    }
  )

  try {
    let success = false

    if (editMode && id) {
      const liveQuiz = await editLiveQuiz({
        variables: {
          id: id,
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          blocks: blockSubmission,
          courseId:
            values.courseId === 'no-course-selected' ? null : values.courseId,
          multiplier:
            values.courseId !== 'no-course-selected'
              ? parseInt(values.multiplier)
              : 1,
          defaultPoints: parseInt(String(values.defaultPoints)),
          defaultCorrectPoints: parseInt(String(values.defaultCorrectPoints)),
          maxBonusPoints: parseInt(String(values.maxBonusPoints)),
          timeToZeroBonus: parseInt(String(values.timeToZeroBonus)),
          isGamificationEnabled:
            values.courseId !== 'no-course-selected' &&
            values.isGamificationEnabled,
          isConfusionFeedbackEnabled: values.isConfusionFeedbackEnabled,
          isLiveQAEnabled: values.isLiveQAEnabled,
          isModerationEnabled: values.isModerationEnabled,
        },
        refetchQueries: [
          { query: GetUserLiveQuizzesDocument },
          { query: GetUserActivitiesDocument },
          ...(values.courseId !== 'no-course-selected'
            ? [
                {
                  query: GetSingleCourseDocument,
                  variables: { courseId: values.courseId },
                },
              ]
            : []),
        ],
      })
      success = Boolean(liveQuiz.data?.editLiveQuiz)
    } else {
      const liveQuiz = await createLiveQuiz({
        variables: {
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          blocks: blockSubmission,
          courseId:
            values.courseId === 'no-course-selected' ? null : values.courseId,
          multiplier: parseInt(values.multiplier),
          defaultPoints: parseInt(String(values.defaultPoints)),
          defaultCorrectPoints: parseInt(String(values.defaultCorrectPoints)),
          maxBonusPoints: parseInt(String(values.maxBonusPoints)),
          timeToZeroBonus: parseInt(String(values.timeToZeroBonus)),
          isGamificationEnabled:
            values.courseId !== 'no-course-selected' &&
            values.isGamificationEnabled,
          isConfusionFeedbackEnabled: values.isConfusionFeedbackEnabled,
          isLiveQAEnabled: values.isLiveQAEnabled,
          isModerationEnabled: values.isModerationEnabled,
        },
        refetchQueries: [
          { query: GetUserLiveQuizzesDocument },
          { query: GetUserActivitiesDocument },
          ...(values.courseId !== 'no-course-selected'
            ? [
                {
                  query: GetSingleCourseDocument,
                  variables: { courseId: values.courseId },
                },
              ]
            : []),
        ],
      })
      success = Boolean(liveQuiz.data?.createLiveQuiz)
    }

    if (success) {
      setIsWizardCompleted(true)
    } else {
      onError()
    }
  } catch (error) {
    console.log('error: ', error)
    onError()
  }
}

export default submitLiveQuizForm
