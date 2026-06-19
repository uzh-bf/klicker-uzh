import {
  ApolloCache,
  DefaultContext,
  FetchResult,
  MutationFunctionOptions,
} from '@apollo/client'
import {
  CreateLiveQuizMutation,
  CreateLiveQuizMutationVariables,
  EditLiveQuizMutation,
  EditLiveQuizMutationVariables,
} from '@klicker-uzh/graphql/dist/ops'
import { ElementBlockFormValues, LiveQuizFormValues } from '../WizardLayout'

interface LiveQuizFormSubmissionProps {
  id?: string
  previousCourseId?: string | null
  editMode: boolean
  values: LiveQuizFormValues
  createLiveQuiz: (
    options?:
      | MutationFunctionOptions<
          CreateLiveQuizMutation,
          CreateLiveQuizMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<CreateLiveQuizMutation>>
  editLiveQuiz: (
    options?:
      | MutationFunctionOptions<
          EditLiveQuizMutation,
          EditLiveQuizMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<EditLiveQuizMutation>>
  setIsWizardCompleted: (isCompleted: boolean) => void
  invalidateCourseDetail: (courseId: string) => Promise<void>
  onError: () => void
}

async function submitLiveQuizForm({
  id,
  previousCourseId,
  editMode,
  values,
  createLiveQuiz,
  editLiveQuiz,
  setIsWizardCompleted,
  invalidateCourseDetail,
  onError,
}: LiveQuizFormSubmissionProps) {
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
          isGamificationEnabled: values.isGamificationEnabled,
          isPinProtected: values.isPinProtected,
          isConfusionFeedbackEnabled: values.isConfusionFeedbackEnabled,
          isLiveQAEnabled: values.isLiveQAEnabled,
          isModerationEnabled: values.isModerationEnabled,
        },
      })
      success = Boolean(liveQuiz.data?.editLiveQuiz)
      if (liveQuiz.data?.editLiveQuiz) {
        const courseIds = new Set(
          [previousCourseId, liveQuiz.data.editLiveQuiz.courseId].filter(
            (courseId): courseId is string => Boolean(courseId)
          )
        )
        await Promise.all(Array.from(courseIds).map(invalidateCourseDetail))
      }
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
          isGamificationEnabled: values.isGamificationEnabled,
          isPinProtected: values.isPinProtected,
          isConfusionFeedbackEnabled: values.isConfusionFeedbackEnabled,
          isLiveQAEnabled: values.isLiveQAEnabled,
          isModerationEnabled: values.isModerationEnabled,
        },
      })
      success = Boolean(liveQuiz.data?.createLiveQuiz)
      if (liveQuiz.data?.createLiveQuiz?.courseId) {
        await invalidateCourseDetail(liveQuiz.data.createLiveQuiz.courseId)
      }
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
