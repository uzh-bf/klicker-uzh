import {
  ApolloCache,
  DefaultContext,
  FetchResult,
  MutationFunctionOptions,
} from '@apollo/client'
import {
  CreatePollMutation,
  CreatePollMutationVariables,
  EditPollMutation,
  EditPollMutationVariables,
} from '@klicker-uzh/graphql/dist/ops'
import { ElementStackFormValues, PollFormValues } from '../WizardLayout'

interface PollFormSubmissionProps {
  id?: string
  values: PollFormValues
  editMode: boolean
  createPoll: (
    options?:
      | MutationFunctionOptions<
          CreatePollMutation,
          CreatePollMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<CreatePollMutation>>
  editPoll: (
    options?:
      | MutationFunctionOptions<
          EditPollMutation,
          EditPollMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<EditPollMutation>>
  setIsWizardCompleted: (isCompleted: boolean) => void
  onError: () => void
}

async function submitPollForm({
  id,
  values,
  editMode,
  createPoll,
  editPoll,
  setIsWizardCompleted,
  onError,
}: PollFormSubmissionProps) {
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
    }

    if (editMode && id) {
      const result = await editPoll({
        variables: { id, ...createOrUpdateJSON },
      })

      success = Boolean(result.data?.editPoll)
    } else {
      const result = await createPoll({
        variables: createOrUpdateJSON,
      })

      success = Boolean(result.data?.createPoll)
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

export default submitPollForm
