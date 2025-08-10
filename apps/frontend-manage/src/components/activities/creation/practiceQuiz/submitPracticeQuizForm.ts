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
  setSelectedCourseId: (courseId?: string) => void
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
  setSelectedCourseId,
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
            }
          }),
        }
      }),
      multiplier: parseInt(values.multiplier),
      courseId: values.courseId!,
      order: values.order,
      resetTimeDays: parseInt(values.resetTimeDays),
    }

    if (editMode && id) {
      const result = await editPracticeQuiz({
        variables: { id, ...createOrUpdateJSON },
        update: (cache, { data: res }) => {
          // if the mutation was not successful, return early
          if (!res?.editPracticeQuiz) return

          // if the course assignment changed, remove the practice quiz from the previous course
          if (previousCourseId && values.courseId !== previousCourseId) {
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
              variables: { courseId: values.courseId! },
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
          if (!res?.createPracticeQuiz) return

          // change the status of the practice quiz on the course overview back to draft
          cache.updateQuery(
            {
              query: GetSingleCourseDocument,
              variables: { courseId: values.courseId! },
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
      setSelectedCourseId(values.courseId)
    } else {
      onError()
    }
  } catch (error) {
    console.log(error)
    onError()
  }
}

export default submitPracticeQuizForm
