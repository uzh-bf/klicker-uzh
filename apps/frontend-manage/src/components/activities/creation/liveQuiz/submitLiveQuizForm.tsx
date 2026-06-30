import type { RouterInputs, RouterOutputs } from '../../../../lib/trpc'
import { ElementBlockFormValues, LiveQuizFormValues } from '../WizardLayout'

type CreateLiveQuizInput = RouterInputs['activity']['createLiveQuiz']
type CreateLiveQuizResult = RouterOutputs['activity']['createLiveQuiz']
type EditLiveQuizInput = RouterInputs['activity']['editLiveQuiz']
type EditLiveQuizResult = RouterOutputs['activity']['editLiveQuiz']

interface LiveQuizFormSubmissionProps {
  id?: string
  previousCourseId?: string | null
  editMode: boolean
  values: LiveQuizFormValues
  createLiveQuiz: (input: CreateLiveQuizInput) => Promise<CreateLiveQuizResult>
  editLiveQuiz: (input: EditLiveQuizInput) => Promise<EditLiveQuizResult>
  setIsWizardCompleted: (isCompleted: boolean) => void
  invalidateCourseDetail: (courseId: string) => Promise<void>
  invalidateActivities: () => Promise<void>
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
  invalidateActivities,
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
    const courseIdsToInvalidate = new Set<string>()

    const createOrUpdateJSON = {
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
    }

    if (editMode && id) {
      const result = await editLiveQuiz({ id, ...createOrUpdateJSON })

      success = Boolean(result.editLiveQuiz)
      if (result.editLiveQuiz) {
        const courseIds = [
          previousCourseId,
          result.editLiveQuiz.courseId,
        ].filter((courseId): courseId is string => Boolean(courseId))

        courseIds.forEach((courseId) => courseIdsToInvalidate.add(courseId))
      }
    } else {
      const result = await createLiveQuiz({
        ...createOrUpdateJSON,
        multiplier: parseInt(values.multiplier),
      })

      success = Boolean(result.createLiveQuiz)
      if (result.createLiveQuiz?.courseId) {
        courseIdsToInvalidate.add(result.createLiveQuiz.courseId)
      }
    }

    if (success) {
      await Promise.all([
        invalidateActivities(),
        ...Array.from(courseIdsToInvalidate).map((courseId) =>
          invalidateCourseDetail(courseId).catch(console.error)
        ),
      ])
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
