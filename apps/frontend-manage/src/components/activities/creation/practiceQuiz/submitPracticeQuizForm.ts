import {
  ApolloCache,
  ApolloError,
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
  PracticeQuizMode,
} from '@klicker-uzh/graphql/dist/ops'
import { ElementStackFormValues, PracticeQuizFormValues } from '../WizardLayout'
import { serializeAdaptivePracticeQuizConfig } from './adaptivePracticeQuizForm'
import {
  AdaptiveTranslator,
  formatAdaptiveApolloError,
} from './adaptiveReadinessIssue'

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
  onError: (details?: string) => void
  translate: AdaptiveTranslator
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
  translate,
}: PracticeQuizFormSubmissionProps) {
  try {
    let success = false
    const adaptive = values.mode === PracticeQuizMode.Adaptive

    const createOrUpdateJSON = {
      name: values.name,
      displayName: values.displayName,
      description: values.description,
      stacks: adaptive
        ? []
        : values.stacks.map((stack: ElementStackFormValues, ix) => {
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
      mode: values.mode,
      adaptiveConfig: adaptive
        ? serializeAdaptivePracticeQuizConfig(values.adaptiveConfig)
        : undefined,
      multiplier: adaptive ? 0 : parseInt(values.multiplier),
      courseId: values.courseId!,
      order: values.order,
      resetTimeDays: parseInt(values.resetTimeDays),
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
    onError(getServerErrorDetails(error, translate))
  }
}

function getServerErrorDetails(
  error: unknown,
  translate: AdaptiveTranslator
): string | undefined {
  if (error instanceof ApolloError) {
    const localized = formatAdaptiveApolloError(translate, error)
    if (localized !== error.message) return localized
    const graphQLErrors = error.graphQLErrors
      .map((graphQLError) => {
        const code = graphQLError.extensions?.code
        return `${typeof code === 'string' ? `[${code}] ` : ''}${graphQLError.message}`
      })
      .filter(Boolean)

    return graphQLErrors.length > 0 ? graphQLErrors.join('; ') : error.message
  }

  return error instanceof Error ? error.message : undefined
}

export default submitPracticeQuizForm
