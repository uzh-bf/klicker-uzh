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
  GetSingleCourseDocument,
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
  onError,
}: LiveQuizFormSubmissionProps) {
  const blockSubmission = values.blocks.map(
    (block: ElementBlockFormValues, ix) => {
      return {
        order: ix,
        timeLimit: block.timeLimit,
        randomSelection: block.randomSelection,
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
          responseCollectionMode: values.responseCollectionMode,
        },
        update: (cache, { data: res }) => {
          // if the mutation was not successful or no course was assigned (and the activity was not removed from another course), return early
          if (
            !res?.editLiveQuiz ||
            (!res.editLiveQuiz.courseId && !previousCourseId)
          )
            return

          // if the course was changed, remove the live quiz from the previous course
          if (
            previousCourseId &&
            previousCourseId !== res.editLiveQuiz.courseId
          ) {
            cache.updateQuery(
              {
                query: GetSingleCourseDocument,
                variables: { courseId: previousCourseId },
              },
              (data) => {
                if (!data?.course) return data

                const activities = data.course.liveQuizzesInfo?.filter(
                  (ga) => ga.id !== res.editLiveQuiz!.id
                )
                return {
                  course: { ...data.course, liveQuizzesInfo: activities },
                }
              }
            )
          }

          // replace / add the live quiz in the course overview with the new version
          if (res.editLiveQuiz.courseId) {
            cache.updateQuery(
              {
                query: GetSingleCourseDocument,
                variables: { courseId: res.editLiveQuiz.courseId! },
              },
              (data) => {
                if (!data?.course) return data

                const activities = [
                  ...(data.course.liveQuizzesInfo?.filter(
                    (ga) => ga.id !== res.editLiveQuiz!.id
                  ) ?? []),
                  res.editLiveQuiz!,
                ]
                return {
                  course: { ...data.course, liveQuizzesInfo: activities },
                }
              }
            )
          }
        },
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
          isGamificationEnabled: values.isGamificationEnabled,
          isPinProtected: values.isPinProtected,
          isConfusionFeedbackEnabled: values.isConfusionFeedbackEnabled,
          isLiveQAEnabled: values.isLiveQAEnabled,
          isModerationEnabled: values.isModerationEnabled,
          responseCollectionMode: values.responseCollectionMode,
        },
        update: (cache, { data: res }) => {
          // if the mutation was not successful, return early
          if (!res?.createLiveQuiz?.courseId) return

          // change the status of the live quiz on the course overview back to draft
          cache.updateQuery(
            {
              query: GetSingleCourseDocument,
              variables: { courseId: res.createLiveQuiz.courseId },
            },
            (data) => {
              if (!data?.course) return data

              return {
                course: {
                  ...data.course,
                  liveQuizzesInfo: [
                    ...(data.course.liveQuizzesInfo ?? []),
                    res.createLiveQuiz!,
                  ],
                },
              }
            }
          )
        },
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
