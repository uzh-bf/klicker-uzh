import {
  ApolloCache,
  DefaultContext,
  FetchResult,
  MutationFunctionOptions,
} from '@apollo/client'
import {
  CreatePracticeQuizMutation,
  CreatePracticeQuizMutationVariables,
  EditPracticeQuizMutation,
  EditPracticeQuizMutationVariables,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { ElementStackFormValues, PracticeQuizFormValues } from '../WizardLayout'

interface PracticeQuizFormSubmissionProps {
  id?: string
  previousCourseId?: string
  values: PracticeQuizFormValues
  editMode: boolean
  createPracticeQuiz: (
    options?:
      | MutationFunctionOptions<
          CreatePracticeQuizMutation,
          CreatePracticeQuizMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<CreatePracticeQuizMutation>>
  editPracticeQuiz: (
    options?:
      | MutationFunctionOptions<
          EditPracticeQuizMutation,
          EditPracticeQuizMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<EditPracticeQuizMutation>>
  setIsWizardCompleted: (isCompleted: boolean) => void
  onError: () => void
}

async function submitPracticeQuizForm({
  id,
  previousCourseId,
  values,
  editMode,
  createPracticeQuiz,
  editPracticeQuiz,
  setIsWizardCompleted,
  onError,
}: PracticeQuizFormSubmissionProps) {
  try {
    let success = false

    const createOrUpdateJSON = {
      name: values.name,
      displayName: values.displayName,
      description: values.description,
      stacks: values.stacks.map((stack: ElementStackFormValues, ix) => {
        return {
          order: ix,
          displayName:
            stack.displayName && stack.displayName.length > 0
              ? stack.displayName
              : undefined,
          description:
            stack.description && stack.description.length > 0
              ? stack.description
              : undefined,
          elements: stack.elements.map((element, ix) => {
            return {
              elementId: element.id,
              order: ix,
              existingInstanceId: element.existingInstanceId,
              duplicateInstance: element.duplicateInstance,
              escapeRoomHint: values.isEscapeRoom
                ? (element.escapeRoomHint ?? undefined)
                : undefined,
            }
          }),
        }
      }),
      multiplier: parseInt(values.multiplier, 10),
      courseId: values.courseId!,
      order: values.order,
      resetTimeDays: parseInt(values.resetTimeDays, 10),
      isEscapeRoom: values.isEscapeRoom ?? false,
      escapeRoomTimeLimit: values.isEscapeRoom
        ? parseInt(values.escapeRoomTimeLimit ?? '60', 10) * 60
        : undefined,
      escapeRoomHintPenalty: values.isEscapeRoom
        ? parseInt(values.escapeRoomHintPenalty ?? '0', 10)
        : undefined,
      escapeRoomIntroText: values.isEscapeRoom
        ? values.escapeRoomIntroText || undefined
        : undefined,
    }

    if (editMode && id) {
      const result = await editPracticeQuiz({
        variables: { id, ...createOrUpdateJSON },
        update: (cache, { data: res }) => {
          // if the mutation was not successful, return early
          if (!res?.editPracticeQuiz?.courseId) return

          // if the course assignment changed, remove the practice quiz from the previous course
          if (
            previousCourseId &&
            res.editPracticeQuiz.courseId !== previousCourseId
          ) {
            cache.updateQuery(
              {
                query: GetSingleCourseDocument,
                variables: { courseId: previousCourseId! },
              },
              (data) => {
                if (!data?.course) return data

                const activities =
                  data.course.practiceQuizzesInfo?.filter(
                    (pq) => pq.id !== res.editPracticeQuiz!.id
                  ) ?? []
                return {
                  course: { ...data.course, practiceQuizzesInfo: activities },
                }
              }
            )
          }

          // updated / add the practice quiz in the currently assigned course
          cache.updateQuery(
            {
              query: GetSingleCourseDocument,
              variables: { courseId: res.editPracticeQuiz.courseId },
            },
            (data) => {
              if (!data?.course) return data

              const activities = [
                ...(data.course.practiceQuizzesInfo?.filter(
                  (pq) => pq.id !== res.editPracticeQuiz!.id
                ) ?? []),
                res.editPracticeQuiz!,
              ]
              return {
                course: { ...data.course, practiceQuizzesInfo: activities },
              }
            }
          )
        },
      })

      success = Boolean(result.data?.editPracticeQuiz)
    } else {
      const result = await createPracticeQuiz({
        variables: createOrUpdateJSON,
        update: (cache, { data: res }) => {
          // if the mutation was not successful, return early
          if (!res?.createPracticeQuiz?.courseId) return

          // change the status of the practice quiz on the course overview back to draft
          cache.updateQuery(
            {
              query: GetSingleCourseDocument,
              variables: { courseId: res.createPracticeQuiz.courseId! },
            },
            (data) => {
              if (!data?.course) return data

              return {
                course: {
                  ...data.course,
                  practiceQuizzesInfo: [
                    ...(data.course.practiceQuizzesInfo ?? []),
                    res.createPracticeQuiz!,
                  ],
                },
              }
            }
          )
        },
      })

      success = Boolean(result.data?.createPracticeQuiz)
    }

    if (success) {
      setIsWizardCompleted(true)
    } else {
      onError()
    }
  } catch (error) {
    console.log(error)
    onError()
  }
}

export default submitPracticeQuizForm
